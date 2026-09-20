# Copilot instructions — Web IQ Sandbox

Repo custom instructions for AI coding agents. Read this first; it captures the project
shape and — more importantly — the **gotchas that previously cost the most time**, so you
can skip the research and debugging next time.

## What this is

An interactive developer sandbox for the **Microsoft Web IQ** grounding APIs, built on the
official [`@microsoft/webiq`](https://www.npmjs.com/package/@microsoft/webiq) SDK.

- **Monorepo** (npm workspaces): `server/` (Express + TS, **CommonJS**) and `web/`
  (React + Vite + Tailwind, **ESM**). Node ≥ 22, npm ≥ 10.
- **Split production hosting:** Azure Static Web Apps Free serves `web/dist`; Azure
  Container Apps serves only `/api/*`.
- **Backend scales to zero by default** (`minReplicas: 0`; `WEBIQ_MIN_REPLICAS=1` keeps
  one warm replica). Infra comes from `azd provision` + Bicep; GitHub Actions deploys the
  SWA artifact and rolls the public **ghcr.io** API image. The generated SWA URL is live;
  `https://webiq.isainative.dev` requires the documented Cloudflare CNAME cutover.

## Conventions

- 2-space indent, single quotes, semicolons, trailing commas (Prettier + ESLint configured).
- `server/` is CommonJS — author normal `import` TS that compiles to CJS; **no top-level await**.
- `web/` is ESM — Vite/Tailwind/PostCSS configs use `export default`.
- The HTTP contract lives in `server/src/contract.ts` and is **mirrored verbatim** in
  `web/src/types/meta.ts`. Change both together.
- Add a Web IQ endpoint = **one descriptor file** in `server/src/endpoints/` + register it
  in `registry.ts`. The UI adapts automatically (see [architecture.md](../docs/architecture.md)).
- Verify before claiming done: `npm run typecheck`, `npm run lint`, `npm run build`. The
  big bugs below were **not** caught by typecheck/build — only by running the app.

## On-demand documentation (read when relevant)

- [docs/architecture.md](../docs/architecture.md) — full solution architecture + extensibility model.
- [docs/webiq-sdk.md](../docs/webiq-sdk.md) — `@microsoft/webiq` reference (endpoints, enums, errors, telemetry).
- [docs/deployment.md](../docs/deployment.md) — SWA + ACA deployment, resource names, cost model, azd env.
- [docs/custom-domain.md](../docs/custom-domain.md) — Cloudflare cutover from ACA to Static Web Apps.

---

# ⚠️ Gotchas & hard-won lessons

Each entry is **symptom → cause → fix**. These are the things that previously caused the most debugging.

## A. App / Node

### A1. Every request aborts with "Client disconnected" (~80ms)
- **Symptom:** all `/api/search/*` calls fail instantly with `{ class:'Error', message:'Client disconnected' }`; telemetry shows ~86 ms, 1 attempt. Typecheck/build pass.
- **Cause:** the abort handler listened on the **`req`** `'close'` event, which fires as soon as the request **body** is fully read — long before the response is sent — so it aborts the in-flight SDK call.
- **Fix:** listen on the **`res`** `'close'` event and only abort if `!res.writableFinished`. See `server/src/routes/search.ts` (`requestAbortSignal(res)`).
- **Lesson:** for request-cancellation in Express, key off the **response** lifecycle, not the request stream. And **always run the app** — this class of bug is invisible to the compiler.

### A2. Malformed JSON body returns 500 instead of 400
- **Fix:** in the error mapper, honor an `err.status`/`err.statusCode` (express.json throws a 400-tagged `SyntaxError`). See `server/src/middleware/errorHandler.ts`.

### A3. Static files vs SPA fallback ordering
- **Symptom:** `/robots.txt`, `/og-image.png`, `/sitemap.xml` return the SPA `index.html`.
- **Fix:** mount `express.static(webDist)` **before** the `app.get('*')` SPA fallback. Already correct in `server/src/index.ts`.

## B. `@microsoft/webiq` SDK

### B1. Enum typing
- The SDK enum **values are plain strings** (`ContentFormat.HTML === 'html'`), so the value string works at runtime, but TypeScript wants the enum type. Resolve incoming strings via a helper and cast options to the SDK type or `any`. Pattern: `buildSdkOptions` + `resolveEnumValue` in `server/src/endpoints/types.ts` / `webiqClient.ts`.
- `freshness` and `liveCrawl` are **plain strings**, not enums — model them as `type:'enum'` **without** `enumImport`.
- Full enum tables + endpoint options: [docs/webiq-sdk.md](../docs/webiq-sdk.md).

### B2. Auth is enforced
- A bad/empty key returns **401 `AuthenticationError`** — the API really validates it. Useful for testing the error path; don't assume "preview = no auth".

### B3. Rate limits are never auto-retried
- `RateLimitError` (429/430) exposes `.retryAfter` (string like `"60s"`) from the response **body**. Surface it; do not loop.

## C. azd authentication (MSA / personal accounts)

### C1. Subscription "not found" even though it exists
- **Symptom:** `azd provision` fails: `failed to resolve user 'live.com#...@gmail.com' access to subscription <id>`.
- **Cause:** the subscription lived in a **different tenant** than azd's home tenant. For MSA/personal accounts, azd defaults to the wrong tenant.
- **Fix:** find the right tenant, then re-auth pinned to it and persist it:
  ```bash
  azd auth login --tenant-id <tenant-id> --use-device-code
  azd env set AZURE_TENANT_ID <tenant-id>
  ```
- **How to discover tenants/subscriptions when `az` is a different identity:** get an ARM token from azd and query ARM REST:
  ```powershell
  $tok = (azd auth token --tenant-id <tid> --output json | ConvertFrom-Json).token
  Invoke-RestMethod -Headers @{Authorization="Bearer $tok"} -Uri "https://management.azure.com/tenants?api-version=2022-12-01"
  Invoke-RestMethod -Headers @{Authorization="Bearer $tok"} -Uri "https://management.azure.com/subscriptions?api-version=2022-12-01"
  ```

### C2. Refresh token expired (90 days)
- `AADSTS700082: The refresh token has expired due to inactivity` → just `azd auth login` (interactive/device-code). All offline prep (Bicep build, docker build, `azd package`) needs **no** auth, so do that first and only block on the one interactive step.

### C3. `azd auth token` panics / returns error JSON
- v1.23.0 can panic: `failed to resolve console for unknown flags error:unsupported format 'none'`. Capture raw output and parse defensively.
- `azd auth token --output json` returns an **error JSON** (not a token) when the env's `AZURE_SUBSCRIPTION_ID` is set to an inaccessible sub. Temporarily clear it to enumerate access.

## D. Container image on GitHub Container Registry (ghcr.io) + Container Apps

> **Cost/registry migration:** the app **no longer uses Azure Container Registry**. The image
> is built + pushed to **ghcr.io** (free for this public repo) by `.github/workflows/deploy.yml`
> and rolled out with `az containerapp update`. `azd` is now **provision-only** (no `services`
> block in `azure.yaml`). The Container App also defaults to **scale-to-zero** (`minReplicas: 0`).
> The ACR-era gotchas below are kept as historical context — the pitfalls they warn about no
> longer apply to this repo, but the reasoning is useful if you ever reintroduce a private registry.

### D0. Pulling a ghcr.io image from Container Apps (current model)
- **Public package ⇒ no credentials.** Because the `ghcr.io/webmaxru/webiq-demo` package is
  **public**, the Container App pulls it with **no `registries` block, no managed identity, no
  stored token**. This is the whole point of the migration: free registry, credential-less pull.
- **One-time step after the first push:** a freshly pushed ghcr package is **private** by default →
  `az containerapp update` fails to pull it until you flip the package visibility to **Public**
  (repo → *Packages* → *Package settings* → *Change visibility*). If you must keep it private,
  re-add a `registries` block authenticating to `ghcr.io` with a PAT stored as a Container App
  secret (reintroduces a managed secret — avoided here on purpose).
- **Auth split:** CI **pushes** with the workflow's built-in `GITHUB_TOKEN` (`packages: write`);
  the Container App **pulls** anonymously. Azure sign-in for the `az containerapp update` step is
  OIDC via `azure/login@v2` (reuses the `msi-webiq-demo` federated creds).

### D1 (historical, ACR). Image pull fails with `UNAUTHORIZED` after `azd deploy`
- **Symptom:** `RESPONSE 200 ... ContainerAppOperationError ... UNAUTHORIZED: authentication required` pulling `cr....azurecr.io/...`.
- **Cause:** the Container App had **no `registries` block** linking its managed identity to ACR. The AcrPull role alone is not enough — the app must be told to authenticate to ACR via `identity: system`.
- **Was fixed (Bicep)** by adding a `registries: [{ server: <acr>, identity: 'system' }]` block + a separate `acr-pull-role.bicep` module. No longer present — ghcr public pull needs none of this.

### D2 (historical, ACR). Two-phase deploy for Container Apps + ACR + managed identity
- With ACR you had to run **`azd provision` then `azd deploy` as separate steps** (not `azd up`) and wait for **AcrPull** RBAC to propagate (a missing role caused a ~900 s revision timeout). Irrelevant now: provisioning (`azd provision`) and image rollout (CI) are already separate, and there is no pull-time RBAC.

### D3 (historical, ACR). `azd package` fails: "must specify language or image"
- azd 1.23 required a **`language`** field in `azure.yaml` even with a `docker:` block. Moot now — `azure.yaml` has no `services`/`docker` block; azd only provisions infra.

## E. Custom domain + managed certificate (Container Apps)

> Full guide: [docs/custom-domain.md](../docs/custom-domain.md). Key traps below.

### E1. Cert creation requires the hostname first (`RequireCustomHostnameInEnvironment`)
- You **cannot** create the managed cert and an `SniEnabled` binding in one pass. Order is **(1) bind hostname `bindingType: Disabled` → (2) create managed cert (CNAME-validated) → (3) switch binding to `SniEnabled` with the cert id**. The Bicep encodes this via the `bindCertificate` param (azd `WEBIQ_BIND_CERT`: phase 1 `false`, phase 2 `true`).

### E2. Managed cert stuck in `Pending` forever (no error)
- **Cause:** the Container App's `provisioningState` is `Failed` — Azure won't validate a cert for a hostname on a Failed app. The cert just sits `Pending` for 20+ min.
- **Fix:** return the app to `Succeeded` (see F2), then **delete and recreate** the cert. With a healthy app, CNAME validation completes in ~3–8 min.

### E3. Cloudflare proxy must be OFF during issuance
- The CNAME must be **grey-cloud (DNS only)** while the cert issues — Cloudflare's proxy hides the CNAME and breaks validation. Verify it resolves directly to the env IP (`68.220.145.84`), not a Cloudflare edge IP. Switch to orange + SSL **Full (strict)** only **after** issuance.

### E4. Cost budgets have no currency — and `''` is not how you escape a quote in Bicep
- **Cost alerts:** the subscription-wide `Microsoft.Consumption/budgets` (`budget-webiq-demo`, `WEBIQ_MONTHLY_BUDGET`, default 50) emits spend alerts via a dedicated cost action group → Owner role (same "no stored email" pattern as the abuse alert, Section J5). `notifications.*.threshold` is a **percent of `amount`** (so 80/100), not an absolute value; `amount` is an **integer with NO currency field** — Azure reads it in the **subscription's billing currency**, so `50` = 50 NOK only if the sub bills in NOK. At RG scope a budget needs `contactEmails` **or** `contactGroups`; supplying `contactGroups: [actionGroupId]` with `contactEmails: []` satisfies it without storing an address. Azure will not update an existing budget's `startDate`: store its original first-of-month value in `WEBIQ_BUDGET_START_DATE`; a separate `generatedBudgetStartDate` parameter uses `utcNow('yyyy-MM-01')` only for new environments.
- **Bicep quote escaping:** inside a single-quoted Bicep string, escape an apostrophe as `\'` — **not** `''` (the ARM-JSON/SQL style). Writing `subscription''s` makes the parser see two adjacent strings and fails with a confusing `BCP071 "Expected 1 argument, but got 2"` on the `@description(...)`. Invisible until `bicep build`.

## F. Editing a live Container App via ARM REST (GET → PUT)

When `az` CLI is signed into a different identity, you may patch the app directly through
ARM REST with azd's token. Three traps, all learned the hard way:

### F1. Secrets come back empty → `ContainerAppSecretInvalid`
- A GET does **not** return secret **values** (write-only). PUTting the response back sends an empty secret → 400 `ContainerAppSecretInvalid`.
- **Fix:** re-supply the secret value in the PUT body (read it from `azd env get-value WEBIQ_API_KEY`).

### F2. Echoing read-only fields → app stuck `provisioningState: Failed`
- A full GET→PUT that includes **computed/read-only** fields (`latestRevisionFqdn`, `outboundIpAddresses`, etc.) makes the reconcile fail; the app sticks in `Failed` (revision still serves, but cert issuance stalls — see E2).
- **Fix:** PUT a **clean body with only writable fields**: `location`, `identity`, `tags`, and `properties.{environmentId, configuration{activeRevisionsMode, ingress, secrets}, template{containers, scale}}`. (There is no longer a `registries` block — the ghcr.io image is public.)

### F3. Dropping `tags` breaks the CI image rollout
- If your clean PUT omits `tags`, the `azd-service-name: app` tag is lost. The deploy workflow finds the app **by that tag** (`az containerapp list --query "[?tags.\"azd-service-name\"=='app'].name"`), so the `az containerapp update` step can no longer locate it.
- **Fix:** always include `tags: { 'azd-env-name': 'webiq-demo', 'azd-service-name': 'app' }` in the PUT.

## G. Tooling & environment (Windows / PowerShell)

### G1. `curl.exe` POST bodies get mangled by PowerShell quoting
- Inline `-d '{"k":"v"}'` is corrupted. **Write the JSON to a file and use `--data "@body.json"`**.

### G2. Long-running `azd` commands lose the shell handle
- Sync shells sometimes complete just after the read window closes, dropping output. For `azd provision`/`deploy`, run as a **detached process logging to a file** and poll the file:
  ```powershell
  $p = Start-Process azd -ArgumentList 'provision','--no-prompt' -RedirectStandardOutput out.log -RedirectStandardError err.log -PassThru -WindowStyle Hidden
  # then poll out.log and Get-Process -Id $p.Id
  ```

### G3. SVG → PNG (favicons, OG image)
- No converter is preinstalled. Install `sharp` as a temporary dev dep, generate PNG/ICO, then **uninstall it** to keep the Docker build lean (commit the rendered PNGs; keep the SVG sources). `sharp` can't write `.ico` — assemble the ICO container manually from PNG buffers.

### G4. Reading `bicep-build` (MCP) output
- The result is **two concatenated JSON objects** — `{…"diagnostics":[…]}` immediately followed by `{…"success":true,"template":…}` — so a naive `ConvertFrom-Json` fails with *"Additional text encountered after finished reading JSON content."* Parse by substring/regex on `"diagnostics"` / `"success"`, or grep the saved temp file (output is large, >50 KB, and is saved to a temp file).
- To find which source line a diagnostic refers to, decode its `position`/`length` as a **character offset** into the file (`$src.Substring(position, length)`). The flagged token is often **not** the line you just edited (see J6).

## H. Secrets & git hygiene

- `.env` (real `WEBIQ_API_KEY`) is **gitignored**; azd auto-creates `.azure/.gitignore` that ignores the whole `.azure/` folder (incl. its env secret file).
- **Before every commit**, scan staged files for the key value (read it from `.env`, `String.Contains` over each staged file). Confirm 0 hits. The verification ID for the custom domain is a **public** ownership token — safe to commit; the API key is not.
- The repo is **public** on GitHub (`webmaxru/webiq-demo`). Never commit `.env`, `.azure/`, or any real key.

## I. Telemetry / Application Insights

> Full reference: [docs/deployment.md](../docs/deployment.md) → "Monitoring & telemetry".

### I1. `applicationinsights` default import is `undefined` at runtime (CJS trap)
- **Symptom:** `TypeError: Cannot read properties of undefined (reading 'setup')` in `dist/appInsights.js`, even though `npm run typecheck` and `npm run build` pass.
- **Cause:** `applicationinsights` v3 ships CommonJS with `__esModule:true` but **no default export**. With `esModuleInterop`, `import appInsights from 'applicationinsights'` compiles to `mod.default`, which is `undefined`.
- **Fix:** use a namespace import — `import * as appInsights from 'applicationinsights'` (then `appInsights.setup(...)`, `appInsights.defaultClient`). Classic invisible-to-the-compiler bug — **run the built server** (`node server/dist/index.js`) to catch it.

### I2. Init order matters
- `server/src/appInsights.ts` must be the **first import in `index.ts`** (before express/http) so auto-instrumentation can patch the HTTP layer. It imports `./env` first for the dotenv side effect so the connection string can come from `.env` locally. No connection string ⇒ the whole module is a no-op (local dev keeps working).

### I3. v3 has no `tagOverrides` on track* calls
- The v3 `Telemetry` contract dropped `tagOverrides` (the type won't compile with it). To attach a per-event user/session id, put it in **`properties`** (we use `anonId`) and query `dcount(tostring(customDimensions.anonId))` — not the `user_Id` column.

### I4. Custom events drive the dashboard + alert
- Every sandbox run emits a `SandboxSearch` custom event; a 429/430 also emits `SandboxRateLimited`. The engagement **Workbook** and the abuse **scheduledQueryRules** alert query these from `customEvents`. The abuse alert + action group are now **always provisioned** and notify the subscription **Owner** role (see Section J) — the old `WEBIQ_ALERT_EMAIL` param has been removed.

## J. Abuse protection (rate limiting, helmet, input caps) + the App-Insights merge

> Full feature write-up: [docs/abuse-protection.md](../docs/abuse-protection.md). The entries below are the parts that actually cost research / trial-and-error.

### J1. Reuse the existing telemetry SDK — do not add a second one
- **Trap:** the abuse feature was first built on the **OpenTelemetry distro** (`@azure/monitor-opentelemetry` + `microsoft.custom_event.name`) on a branch cut **before** `main` integrated App Insights. `main` already ships the **classic `applicationinsights`** SDK (`server/src/appInsights.ts`, `trackEvent`/`trackException`/`trackMetric`/`clientIp`). Running both = double HTTP auto-instrumentation + two exporters.
- **Fix / lesson:** when rebasing onto a moved `main`, **adopt the foundation already there**. Abuse events go through the existing `trackEvent`; there is **no** `instrumentation.ts` and **no** OTel deps. Before designing telemetry, `git show main:server/src/appInsights.ts` to see what already exists.

### J2. Emit the event names the existing workbook/alert already query
- `main` shipped a workbook "rate-limit" tile + a scheduled-query alert keyed on **`SandboxRateLimited`** — but no enforcement code emitting it. The per-IP limiter fills that gap: it emits `SandboxRateLimited` (with `source:'gateway'` to distinguish from main's upstream-429 use). Oversized input/body uses a separate **`SandboxAbuse`** event; the alert query is broadened to `name in ("SandboxRateLimited","SandboxAbuse")`. Match existing event names instead of inventing new ones, or the dashboards stay dark.

### J3. `express-rate-limit` rejects `trust proxy = true`
- **Symptom/constraint:** behind the Container Apps (Envoy) ingress, `req.ip` is the proxy, so a per-IP limiter buckets *all* clients together. But `app.set('trust proxy', true)` makes express-rate-limit throw `ERR_ERL_PERMISSIVE_TRUST_PROXY` — a permissive setting lets a client spoof `X-Forwarded-For` to dodge the limit.
- **Fix:** set a **finite** hop count: `app.set('trust proxy', env.trustProxyHops)` — **1** for Container Apps, **0** for direct/local. Configurable via `TRUST_PROXY_HOPS`. (main's `clientIp()` reads `x-forwarded-for` directly, so it's correct either way.)

### J4. `helmet`'s default CSP blocks external result thumbnails
- **Symptom:** with helmet's default `img-src 'self'`, news/image/video result thumbnails (third-party CDNs) silently fail to render.
- **Fix:** widen only `img-src` to `["'self'", 'data:', 'https:']`; keep the rest of helmet's strict defaults. Safe because the SPA's only executable script is the same-origin module bundle, and its inline `<script type="application/ld+json">` is a **non-executable data block** (unaffected by `script-src`). Verify with a grep for external `<img src>` in `web/src/components/results/*` before loosening anything else.

### J5. Email alert without storing an address → action group **ARM-role receiver**
- **Goal:** notify the operator using the email on *their Azure account*, with nothing account-specific committed (public repo).
- **Fix:** `Microsoft.Insights/actionGroups` with an **`armRoleReceivers`** entry → built-in **Owner** role GUID `8e3af657-a8ff-443c-a75c-2fe8c4bcb635` (`useCommonAlertSchema: true`), **no `emailReceivers`, no param, no `if()` gate**. This replaced main's earlier `emailReceivers` + `WEBIQ_ALERT_EMAIL` (which required a custom address). The scheduled query rule is also unconditional now.

### J6. A BCP334 warning that isn't about your new code
- **Symptom:** historically `bicep build` reported one `BCP334` ("value can be length 0… minimum length 5"). Easy to assume it's a new line.
- **Reality:** decoding the diagnostic's `position`/`length` (see G4) showed it was the **pre-existing** `containerRegistryName` (ACR names have a min length), not the code you just touched. **That var was removed with the ACR→ghcr.io migration, so this warning no longer fires** — but the lesson stands: decode a diagnostic's real offset before `#disable-next-line`-ing the wrong line, and leave pre-existing warnings alone.

### J7. The "Apply" button can't bring a stale agent branch back
- **Symptom:** VS Code "Apply changes to the current workspace" fails with *"stage or commit your changes and try again"* even though every worktree is clean.
- **Cause:** the agent branch had **diverged** from `main` (cut ~13 commits back, before App Insights/dark-theme/GDPR). Apply can't reconcile that automatically; the message is misleading.
- **Fix:** ignore Apply — `git reset --hard main` the agent branch and **re-apply the work on top** (a manual rebase), reconciling the overlap, then open a PR. Keep a `backup/...` branch first so the original commits are recoverable.
