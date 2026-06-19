# Deployment & operations

The app runs as a **single Azure Container App** (the Express server serves the API and
the built SPA), deployed with the **Azure Developer CLI (`azd`)** and **Bicep**, optimized
so an **idle app consumes ~$0** of compute.

## Live environment

| Item | Value |
|------|-------|
| URL (custom) | https://webiq.isainative.dev |
| URL (default) | https://ca-webiq-demo-wr3bqs.delightfulhill-9c37dc23.eastus2.azurecontainerapps.io |
| Subscription | Visual Studio Enterprise Subscription `d0b7d6ee-17bf-4c4f-b79d-4f6c2cb583fd` |
| Tenant | `347ef3c8-1f54-41d9-b57d-22a4923cb3c4` (Salnikov Gmail Directory) |
| Region | East US 2 |
| Resource group | `rg-webiq-demo` |

### Resources (all in `rg-webiq-demo`)

| Resource | Name | Notes |
|----------|------|-------|
| Container App | `ca-webiq-demo-wr3bqs` | scale 1→3 (one warm replica), 0.25 vCPU / 0.5 GiB, system-assigned MI |
| Container Apps Env | `cae-webiq-demo-wr3bqs` | **Consumption** (no idle base cost) |
| Container Registry | `crwebiqdemowr3bqs` | **Basic** |
| Log Analytics | `log-webiq-demo-wr3bqs` | 30-day retention |
| Application Insights | `appi-webiq-demo-wr3bqs` | workspace-based (shares the Log Analytics workspace) |
| Workbook | `Web IQ — User Engagement` | engagement dashboard, bound to App Insights |
| Action group + alert | `ag-/alert-webiq-demo-abuse` | abuse alert → notifies the subscription **Owner** role (always provisioned) |
| Cost action group | `ag-webiq-demo-cost` | spend-alert receiver → notifies the subscription **Owner** role |
| Cost budget | `budget-webiq-demo` | **subscription-scoped** Cost Management budget (default 50, billing currency) → spend alerts at 80% / 100% actual + 100% forecast |
| Managed certificate | `mc-webiq-isainative-dev` | free, on the env, for the custom domain |

## Cost model

The app defaults to **one always-warm replica** (`minReplicas: 1`) so the first request
after a quiet period skips the Container Apps **cold start**. An idle warm replica is
billed at the reduced **idle** rate, not the active rate.

| Resource | Monthly cost (idle) |
|----------|---------------------|
| Container App compute (`minReplicas: 1`, 0.25 vCPU / 0.5 GiB) | **~$4–5/mo** — one warm replica at idle rates, after the free grant |
| Container Apps Environment (Consumption) | **$0** base |
| Log Analytics | within free tier |
| **ACR Basic** | **~$5/mo** flat |

**Estimated total ≈ $9–10/mo** (warm) vs **≈ $5/mo** with scale-to-zero (ACR only).

### Warm-replica math (East US 2, Consumption plan)

One replica running 24×7 ≈ 0.25 vCPU and 0.5 GiB for ~2,628,000 s/month:

- vCPU: 0.25 × 2,628,000 = 657,000 vCPU-s − 180,000 free = **477,000** billable
- Memory: 0.5 × 2,628,000 = 1,314,000 GiB-s − 360,000 free = **954,000** billable

At **idle** rates ($0.000003 /vCPU-s and /GiB-s): 477,000 × $0.000003 + 954,000 ×
$0.000003 ≈ $1.43 + $2.86 = **~$4.3/mo**. (At **active** rates — $0.000024 /vCPU-s — it
would be ~$14/mo, but a low-traffic demo replica is idle almost all the time, so expect
the lower end.) Idle billing applies because the revision has `minReplicas ≥ 1`; a replica
counts as idle while it serves no HTTP requests, uses < 0.01 vCPU, and receives < 1 KB/s.
The free grants (180k vCPU-s, 360k GiB-s, 2M requests) are per **subscription** per month,
so a subscription that already consumes them elsewhere shifts this estimate upward.
0.25 vCPU / 0.5 GiB is the smallest Container Apps allocation, so this is the cheapest way
to keep a minimum instance warm — a Dedicated plan would add a ~$73/mo management base.

### Scale to zero instead (cheapest, with cold start)

Set the minimum back to 0 to drop idle compute to **$0** (only ACR ~$5/mo), at the cost of
a brief cold start on the first request after idle:

```bash
azd env set WEBIQ_MIN_REPLICAS 0
azd provision
```

`WEBIQ_MIN_REPLICAS` is optional and **defaults to 1** when unset.

### Spend alerts (Cost Management budget)

A **subscription-scoped** `Microsoft.Consumption/budgets` resource (`budget-webiq-demo`)
raises Azure spend alerts. It defaults to an amount of **50** and notifies the subscription
**Owner** role (via the `ag-webiq-demo-cost` action group — no personal email stored, same
pattern as the abuse alert). Three notifications fire by email:

| Notification | Trigger | At amount 50 |
|--------------|---------|--------------|
| Actual ≥ 80% | actual month-to-date spend passes 80% of the amount | 40 |
| Actual ≥ 100% | actual spend passes the amount (the requested threshold) | 50 |
| Forecasted ≥ 100% | the month is *forecast* to exceed the amount | 50 |

Change the amount (and switch off the warning thresholds in Bicep if you only want the
exact-100% alert):

```bash
azd env set WEBIQ_MONTHLY_BUDGET 50   # optional, default 50
azd provision
```

> **⚠️ Currency:** Azure Cost Management budgets have **no currency field** — `50` is
> interpreted in the **subscription's billing currency**, so it equals **50 NOK only if the
> subscription bills in NOK**. Confirm under *Cost Management → Properties / Invoices*; if it
> bills in another currency, set `WEBIQ_MONTHLY_BUDGET` to the equivalent number.
>
> **⚠️ Reality check:** this app costs **~$9–10/mo warm ≈ ~100 NOK** or **~$5/mo
> scale-to-zero ≈ ~55 NOK** (at ~10–11 NOK/USD). Because the budget is subscription-wide and
> even ACR Basic alone (~$5 ≈ ~55 NOK) exceeds 50, a **50 NOK** budget will likely alert
> every month. Raise `WEBIQ_MONTHLY_BUDGET`, or scope the budget to just `rg-webiq-demo` by
> moving the `costBudget` resource into `modules/resources.bicep`, if that isn't intended.

## Infrastructure (`infra/`)

| File | Purpose |
|------|---------|
| `main.bicep` | Subscription-scoped entry: RG + `resources` module + `acr-pull-role` module + a subscription-wide cost budget. Params: `environmentName`, `location`, `webiqApiKey` (secure), `customDomain`, `bindCertificate`, `minReplicas`, `monthlyBudgetAmount`. |
| `modules/resources.bicep` | Log Analytics, App Insights + engagement workbook, ACR, Container Apps env, the Container App, optional managed cert, the abuse alert (action group → Owner role + scheduled query rule), and the cost action group (→ Owner role) used by the budget. |
| `modules/acr-pull-role.bicep` | `AcrPull` role for the app's system identity, scoped to ACR (separate module → no circular dependency). |
| `main.parameters.json` | ARM-JSON params with `${AZURE_ENV_NAME}` / `${WEBIQ_API_KEY}` / `${WEBIQ_CUSTOM_DOMAIN}` / `${WEBIQ_BIND_CERT}` / `${WEBIQ_MIN_REPLICAS}` / `${WEBIQ_MONTHLY_BUDGET}` placeholders azd substitutes. |

### azd environment variables

```bash
azd env set AZURE_SUBSCRIPTION_ID d0b7d6ee-17bf-4c4f-b79d-4f6c2cb583fd
azd env set AZURE_TENANT_ID       347ef3c8-1f54-41d9-b57d-22a4923cb3c4   # REQUIRED — see gotchas
azd env set AZURE_LOCATION        eastus2
azd env set WEBIQ_API_KEY         <key>     # becomes a Container App secret
azd env set WEBIQ_CUSTOM_DOMAIN   webiq.isainative.dev   # optional
azd env set WEBIQ_BIND_CERT       true                    # phase 2 of custom domain
azd env set WEBIQ_MIN_REPLICAS    1                       # optional, default 1 (warm). 0 = scale to zero
azd env set WEBIQ_MONTHLY_BUDGET  50                      # optional, default 50 — cost-budget amount (billing currency)
```

> The abuse alert needs no env var — it is always provisioned and notifies the subscription
> **Owner** role. See [abuse-protection.md](./abuse-protection.md).

## Deploy / redeploy

> ⚠️ For Container Apps + ACR with a managed identity, always run **`azd provision` and
> `azd deploy` as separate steps** (not `azd up`), with the AcrPull RBAC propagation gate
> between them. See [pre-deploy checklist] behavior in the gotchas doc.

```bash
azd auth login --tenant-id 347ef3c8-1f54-41d9-b57d-22a4923cb3c4   # MSA → see gotchas
azd provision   # infra (idempotent)
azd deploy      # build image → push to ACR → roll the app (~40-60s)
```

- **Code-only change:** `azd deploy` alone.
- **Infra change:** `azd provision` then `azd deploy`.
- **Tear down everything:** `azd down --force --purge`.

## CI/CD (GitHub Actions)

Pushes to `main` deploy automatically via **`.github/workflows/deploy.yml`** — a minimal,
two-job pipeline:

| Job | Triggers | What it does |
|-----|----------|--------------|
| `validate` | push + PR to `main` | `npm ci` → `typecheck` → `lint` → `build` |
| `deploy` | push to `main` + manual `workflow_dispatch` | `azd env refresh` (read-only — pull infra outputs) → `azd deploy` (build image on ACR, roll the Container App) |

- **Minimal by design:** CI only ever runs a **code deploy** — it never provisions or mutates
  infrastructure. Infra stays an out-of-band, owner-run step (`azd provision`), so the CI
  identity is granted **Contributor only**.
- **Secret-less auth (OIDC / federated):** `azd pipeline config` created a user-assigned
  managed identity (`msi-webiq-demo`, in `rg-webiq-demo-msi`) with federated credentials for
  `main` and PRs, and set the GitHub **repository variables** `AZURE_CLIENT_ID`,
  `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_ENV_NAME`, `AZURE_LOCATION`,
  `AZURE_RESOURCE_GROUP` (+ `WEBIQ_*`). The Web IQ key lives as the encrypted Actions secret
  `WEBIQ_API_KEY` (used only so `azd env refresh` can resolve the template params).
- **Doc/markdown-only** pushes are skipped (`paths-ignore`) so they never trigger a deploy.
- **Manual run:** Actions → *Deploy to Azure* → *Run workflow*, or
  `gh workflow run "Deploy to Azure" --ref main`.

> Re-create the pipeline auth from scratch with:
> `azd pipeline config --provider github --auth-type federated --principal-role Contributor`

## Health, logs, scaling

- Health: `GET /api/health` → `{ status:'ok', keyConfigured, auth, node }`. Used by the
  Container App liveness/readiness probes (`/api/health` on the target port).
- Logs: Log Analytics (`ContainerAppConsoleLogs_CL` / `ContainerAppSystemLogs_CL`).
- Scale: HTTP rule, `concurrentRequests: 50`, `minReplicas 1` (warm; set `WEBIQ_MIN_REPLICAS 0` to scale to zero), `maxReplicas 3`.

## Monitoring & telemetry (Application Insights)

The Express server is instrumented with the `applicationinsights` SDK (initialised first
in `server/src/appInsights.ts`, before express/http load). It auto-collects requests,
dependencies (the Web IQ SDK calls) and exceptions, and emits these custom signals:

| Signal | Table | When |
|--------|-------|------|
| `SandboxSearch` event | `customEvents` | every "Run request" — props: `endpointId`, `outcome` (success/failure/validation_error/input_too_long/not_configured/unknown_endpoint), `errorClass`, `statusCode`, `anonId`; measurements: `elapsedMs`, `inputLength`, `attempts` |
| `SandboxRateLimited` event | `customEvents` | on an upstream 429/430 `RateLimitError` **or** a per-IP gateway rate-limit hit (`source: 'gateway'`) — drives the abuse alert |
| `SandboxAbuse` event | `customEvents` | on oversized input (`input_too_long`) or body (`payload_too_large`) — drives the abuse alert |
| `SandboxRateLimitErrors` metric | `customMetrics` | on a 429/430 `RateLimitError` |
| exceptions | `exceptions` | every failed run + anything reaching the error handler |

Privacy: only **metadata** is logged — never the query text. Users are unique-counted by an
anonymised `anonId` = `sha256(salt + ip + user-agent)` (no PII stored). The site uses **no
cookies** and a public **/privacy** notice (`web/src/components/PrivacyPolicy.tsx`) documents
the processing under GDPR. Visitors can object via a one-click opt-out, and the server also
honours `DNT: 1` / `Sec-GPC: 1` (`analyticsOptedOut` in `appInsights.ts`): when opted out, the
search route emits **no** `anonId` and **no** analytics telemetry (`SandboxSearch`, plus the
upstream-429 `SandboxRateLimited` + `SandboxRateLimitErrors`). The **gateway** abuse signals —
`SandboxAbuse` and the per-IP `SandboxRateLimited` carrying `source: 'gateway'`, both emitted by
`trackAbuse` — are recorded **regardless** of opt-out and include the raw IP so an operator can
act on abuse.

- **Engagement dashboard:** an Azure Monitor **Workbook** — "Web IQ — User Engagement" —
  is deployed with the App Insights resource (Monitoring → Workbooks). It shows searches &
  unique visitors over time, searches by endpoint, outcome breakdown, p50/p95 latency,
  errors by class, rate-limit events, and top exceptions.
- **Abuse alert (no config):** a scheduled log-query alert (`alert-<env>-abuse`) + action
  group (`ag-<env>-abuse`) fire on any `SandboxRateLimited` / `SandboxAbuse` event (evaluated
  every 5 min). The action group uses an **ARM-role receiver** targeting the subscription
  **Owner** role, so Azure notifies the email registered on the owning account — no custom
  address is stored. The connection string is injected as a Container App secret
  (`APPLICATIONINSIGHTS_CONNECTION_STRING`). Full details:
  [abuse-protection.md](./abuse-protection.md).

## Custom domain

Bound to `webiq.isainative.dev` with a free managed TLS cert via a **two-phase** flow.
Full walkthrough (Cloudflare DNS, proxy, SSL mode, the issuance gotchas) in
[custom-domain.md](./custom-domain.md).

## Container build (`Dockerfile`)

Multi-stage, **build context = repo root**:
1. `node:22-alpine` build stage → `npm ci` → copy sources → `npm run build` (server tsc +
   web vite). Produces `server/dist` and `web/dist`.
2. `node:22-alpine` runtime stage → `npm ci --omit=dev`, copy `server/dist` + `web/dist`,
   run as non-root `node` user, `CMD node server/dist/index.js`, `PORT=8080`.

In production the server serves `web/dist` statically (so `/`, `/robots.txt`,
`/og-image.png`, etc. are served before the SPA fallback).

## Related docs

- [Architecture](./architecture.md)
- [Custom domain (Cloudflare)](./custom-domain.md)
- [Gotchas & hard-won lessons](../.github/copilot-instructions.md)
