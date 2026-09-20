# Deployment & operations

Production uses two independently scalable Azure services:

- **Azure Static Web Apps (Free)** hosts the React/Vite frontend.
- **Azure Container Apps (Consumption)** hosts the Express API and scales 0→3.

Infrastructure is provisioned with `azd provision` + Bicep. GitHub Actions publishes the
public ghcr.io API image, rolls ACA, builds the SPA with ACA's URL, and uploads the static
artifact to SWA. The frontend remains available while ACA has zero idle replicas.

## Live environment

| Item | Value |
|------|-------|
| Frontend (generated, live) | https://delightful-cliff-0ee0ef20f.2.azurestaticapps.net |
| Frontend custom domain | https://webiq.isainative.dev — live on SWA |
| Backend API | https://ca-webiq-demo-wr3bqs.delightfulhill-9c37dc23.eastus2.azurecontainerapps.io |
| Subscription | Visual Studio Enterprise Subscription `d0b7d6ee-17bf-4c4f-b79d-4f6c2cb583fd` |
| Tenant | `347ef3c8-1f54-41d9-b57d-22a4923cb3c4` (Salnikov Gmail Directory) |
| Region | East US 2 |
| Resource group | `rg-webiq-demo` |

### Resources (all in `rg-webiq-demo`)

| Resource | Name | Notes |
|----------|------|-------|
| Static Web App | `swa-webiq-demo-wr3bqs` | **Free** tier, hosts the SPA |
| Container App | `ca-webiq-demo-wr3bqs` | scale **0**→3 (scale-to-zero when idle), 0.25 vCPU / 0.5 GiB, system-assigned MI |
| Container Apps Env | `cae-webiq-demo-wr3bqs` | **Consumption** (no idle base cost) |
| Container image registry | `ghcr.io/webmaxru/webiq-demo` | **GitHub Container Registry** — free (public package), replaces ACR |
| Log Analytics | `log-webiq-demo-wr3bqs` | 30-day retention |
| Application Insights | `appi-webiq-demo-wr3bqs` | workspace-based (shares the Log Analytics workspace) |
| Workbook | `Web IQ — User Engagement` | engagement dashboard, bound to App Insights |
| Action group + alert | `ag-/alert-webiq-demo-abuse` | abuse alert → notifies the subscription **Owner** role (always provisioned) |
| Cost action group | `ag-webiq-demo-cost` | spend-alert receiver → notifies the subscription **Owner** role |
| Cost budget | `budget-webiq-demo` | **subscription-scoped** Cost Management budget (default 50, billing currency) → spend alerts at 80% / 100% actual + 100% forecast |
| Managed certificate | `mc-webiq-isainative-dev` | free, on the env, for the custom domain |

## Cost model

The frontend uses the SWA **Free** tier. The backend defaults to **scale-to-zero**
(`minReplicas: 0`): when no API traffic arrives ACA runs zero replicas and idle compute
costs **$0**. The trade-off is a brief cold start on the first API request after a quiet
period; after five seconds the UI displays “Application is starting”. The public backend
image remains on free GitHub Container Registry storage.

The SWA index renders from bundled metadata and immediately sends a background
`GET /api/health` request. This warm-up does not block or alter the page, but often makes
the user's first search avoid most of the scale-from-zero delay.

| Resource | Monthly cost (idle) |
|----------|---------------------|
| Static Web Apps frontend (Free) | **$0** |
| Container App compute (`minReplicas: 0`, scale-to-zero) | **$0** — no replicas run while idle |
| Container Apps Environment (Consumption) | **$0** base |
| Log Analytics | within free tier |
| **GitHub Container Registry (ghcr.io)** | **$0** — free for public packages |

**Estimated hosting compute ≈ $0/mo idle.** Active requests, network transfer, telemetry
ingestion, and unrelated subscription resources can still incur usage charges. Keeping
one warm backend replica (`WEBIQ_MIN_REPLICAS 1`) adds **~$4–5/mo**.

### Warm-replica math (East US 2, Consumption plan)

If you opt into one warm replica (`WEBIQ_MIN_REPLICAS 1`), it runs 24×7 ≈ 0.25 vCPU and
0.5 GiB for ~2,628,000 s/month:

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

### Keep one warm replica instead (no cold start)

The default is scale-to-zero. To trade **~$4–5/mo** for zero cold starts, keep one warm
replica:

```bash
azd env set WEBIQ_MIN_REPLICAS 1
azd provision
```

`WEBIQ_MIN_REPLICAS` is optional and **defaults to 0** (scale-to-zero) when unset.

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
> **⚠️ Reality check:** this app now costs **~$0/mo idle** with scale-to-zero (ghcr.io is
> free and there is no ACR), or **~$4–5/mo ≈ ~50 NOK** if you opt into one warm replica
> (`WEBIQ_MIN_REPLICAS 1`). The budget is **subscription-wide**, so it still catches spend
> from *other* resources in the subscription. Raise `WEBIQ_MONTHLY_BUDGET`, or scope the
> budget to just `rg-webiq-demo` by moving the `costBudget` resource into
> `modules/resources.bicep`, if the subscription-wide scope isn't intended.

## Infrastructure (`infra/`)

| File | Purpose |
|------|---------|
| `main.bicep` | Subscription entry: RG, resources module, and subscription budget. Includes separate backend and frontend custom-domain parameters. |
| `modules/resources.bicep` | Free SWA frontend, Log Analytics, App Insights/workbook, Consumption ACA environment, API Container App, optional custom domains, abuse alert, and cost action group. |
| `main.parameters.json` | Maps `AZURE_*` / `WEBIQ_*` azd environment values into Bicep parameters. |

### azd environment variables

```bash
azd env set AZURE_SUBSCRIPTION_ID d0b7d6ee-17bf-4c4f-b79d-4f6c2cb583fd
azd env set AZURE_TENANT_ID       347ef3c8-1f54-41d9-b57d-22a4923cb3c4   # REQUIRED — see gotchas
azd env set AZURE_LOCATION        eastus2
azd env set WEBIQ_API_KEY         <key>     # becomes a Container App secret
azd env set WEBIQ_FRONTEND_CUSTOM_DOMAIN webiq.isainative.dev # optional; set after its CNAME points to SWA
azd env set WEBIQ_CUSTOM_DOMAIN   api.example.com         # optional ACA API hostname
azd env set WEBIQ_BIND_CERT       true                    # phase 2 of an ACA API hostname
azd env set WEBIQ_MIN_REPLICAS    0                       # optional, default 0 (scale-to-zero). 1 = keep one warm replica
azd env set WEBIQ_MONTHLY_BUDGET  50                      # optional, default 50 — cost-budget amount (billing currency)
azd env set WEBIQ_BUDGET_START_DATE 2026-06-01            # preserve an existing budget's immutable start date
```

For a new environment, leave `WEBIQ_BUDGET_START_DATE` empty and Bicep uses the first
day of the current month. After the first successful provision, keep the resulting date
stable for later runs; Azure rejects attempts to update an existing budget's start date.

> The abuse alert needs no env var — it is always provisioned and notifies the subscription
> **Owner** role. See [abuse-protection.md](./abuse-protection.md).

## Deploy / redeploy

Infrastructure and code are deployed separately: `azd provision` owns SWA, ACA, and
monitoring; GitHub Actions owns both application artifacts.

```bash
# 1. Infra (owner, out-of-band) — idempotent
azd auth login --tenant-id 347ef3c8-1f54-41d9-b57d-22a4923cb3c4   # MSA → see gotchas
azd provision

# 2. Backend + frontend — normally CI on push to main:
gh workflow run "Deploy to Azure" --ref main
```

> **One-time:** make the `ghcr.io/webmaxru/webiq-demo` package **Public** (repo → *Packages*
> → *Package settings* → *Change visibility*). A public package is what lets the Container
> App pull the image with **no registry credentials** — keeping the registry free and
> credential-less. Until it is public, `az containerapp update` will fail to pull the image.

- **Code-only change:** push to `main` (CI deploys both applications).
- **Infra change:** `azd provision`, then rerun the deployment workflow because Bicep
  intentionally uses the public placeholder for ACA provisioning.
- **Tear down everything:** `azd down --force --purge`.

## CI/CD (GitHub Actions)

Pushes to `main` deploy automatically via **`.github/workflows/deploy.yml`** — a minimal,
two-job pipeline:

| Job | Triggers | What it does |
|-----|----------|--------------|
| `validate` | push + PR to `main` | `npm ci` → `typecheck` → `lint` → `build` |
| `deploy` | push to `main` + manual `workflow_dispatch` | deploy API image to ACA, build with `VITE_API_BASE_URL`, upload `web/dist` to SWA |

- **Minimal by design:** CI deploys code but does not create infrastructure. It obtains the
  provisioned SWA deployment token through ARM at runtime; the masked token is not stored
  in GitHub. The OIDC identity retains **Contributor**.
- **Free image registry:** the image is pushed to **GitHub Container Registry (ghcr.io)** with
  the workflow's built-in `GITHUB_TOKEN` (`packages: write`) — no ACR, no registry secret.
- **Secret-less Azure auth (OIDC / federated):** `azd pipeline config` created a user-assigned
  managed identity (`msi-webiq-demo`, in `rg-webiq-demo-msi`) with federated credentials for
  `main` and PRs; the workflow signs in with `azure/login@v2` using the GitHub **repository
  variables** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
  `AZURE_RESOURCE_GROUP` (+ `AZURE_ENV_NAME`, `AZURE_LOCATION`).
- **Doc/markdown-only** pushes are skipped (`paths-ignore`) so they never trigger a deploy.
- **Manual run:** Actions → *Deploy to Azure* → *Run workflow*, or
  `gh workflow run "Deploy to Azure" --ref main`.

> Re-create the Azure pipeline auth from scratch with:
> `azd pipeline config --provider github --auth-type federated --principal-role Contributor`

## Health, logs, scaling

- Health: `GET /api/health` → `{ status:'ok', keyConfigured, auth, node }`. Used by the
  Container App liveness/readiness probes (`/api/health` on the target port).
- Logs: Log Analytics (`ContainerAppConsoleLogs_CL` / `ContainerAppSystemLogs_CL`).
- Scale: HTTP rule, `concurrentRequests: 50`, `minReplicas 0` (scale-to-zero; set `WEBIQ_MIN_REPLICAS 1` to keep one warm replica), `maxReplicas 3`.

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

`webiq.isainative.dev` is bound to SWA with an Azure-managed certificate. The generated
SWA hostname remains available as a fallback. The Cloudflare cutover and rollback-safe
order are documented in [custom-domain.md](./custom-domain.md).

## Container build (`Dockerfile`)

Multi-stage, **build context = repo root**. CI builds and pushes this API-only image to
ghcr.io:
1. `node:22-alpine` build stage → `npm ci` → `npm run build:server`.
2. `node:22-alpine` runtime stage → production dependencies + `server/dist`, non-root
   `node` user, `CMD node server/dist/index.js`, `PORT=8080`.

The frontend is a separate Vite build uploaded from `web/dist` to SWA.

## Related docs

- [Architecture](./architecture.md)
- [Custom domain (Cloudflare)](./custom-domain.md)
- [Gotchas & hard-won lessons](../.github/copilot-instructions.md)
