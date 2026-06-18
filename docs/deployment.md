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
| Container App | `ca-webiq-demo-wr3bqs` | scale 0→3, 0.25 vCPU / 0.5 GiB, system-assigned MI |
| Container Apps Env | `cae-webiq-demo-wr3bqs` | **Consumption** (no idle base cost) |
| Container Registry | `crwebiqdemowr3bqs` | **Basic** |
| Log Analytics | `log-webiq-demo-wr3bqs` | 30-day retention |
| Application Insights | `appi-webiq-demo-wr3bqs` | workspace-based (shares the Log Analytics workspace) |
| Workbook | `Web IQ — User Engagement` | engagement dashboard, bound to App Insights |
| Action group + alert | `ag-/alert-webiq-demo-ratelimit` | only when `WEBIQ_ALERT_EMAIL` is set |
| Managed certificate | `mc-webiq-isainative-dev` | free, on the env, for the custom domain |

## Cost model (why idle ≈ $0)

| Resource | Idle cost |
|----------|-----------|
| Container App compute (`minReplicas: 0`) | **$0** when no traffic |
| Container Apps Environment (Consumption) | **$0** base |
| Log Analytics | within free tier |
| **ACR Basic** | **~$5/mo** flat — the only unavoidable idle cost |

Trade-off: scale-to-zero adds a brief **cold start** on the first request after idle.

## Infrastructure (`infra/`)

| File | Purpose |
|------|---------|
| `main.bicep` | Subscription-scoped entry: RG + `resources` module + `acr-pull-role` module. Params: `environmentName`, `location`, `webiqApiKey` (secure), `customDomain`, `bindCertificate`. |
| `modules/resources.bicep` | Log Analytics, ACR, Container Apps env, the Container App, optional managed cert. |
| `modules/acr-pull-role.bicep` | `AcrPull` role for the app's system identity, scoped to ACR (separate module → no circular dependency). |
| `main.parameters.json` | ARM-JSON params with `${AZURE_ENV_NAME}` / `${WEBIQ_API_KEY}` / `${WEBIQ_CUSTOM_DOMAIN}` / `${WEBIQ_BIND_CERT}` placeholders azd substitutes. |

### azd environment variables

```bash
azd env set AZURE_SUBSCRIPTION_ID d0b7d6ee-17bf-4c4f-b79d-4f6c2cb583fd
azd env set AZURE_TENANT_ID       347ef3c8-1f54-41d9-b57d-22a4923cb3c4   # REQUIRED — see gotchas
azd env set AZURE_LOCATION        eastus2
azd env set WEBIQ_API_KEY         <key>     # becomes a Container App secret
azd env set WEBIQ_CUSTOM_DOMAIN   webiq.isainative.dev   # optional
azd env set WEBIQ_BIND_CERT       true                    # phase 2 of custom domain
azd env set WEBIQ_ALERT_EMAIL     you@example.com         # optional — enables the rate-limit email alert
```

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

## Health, logs, scaling

- Health: `GET /api/health` → `{ status:'ok', keyConfigured, auth, node }`. Used by the
  Container App liveness/readiness probes (`/api/health` on the target port).
- Logs: Log Analytics (`ContainerAppConsoleLogs_CL` / `ContainerAppSystemLogs_CL`).
- Scale: HTTP rule, `concurrentRequests: 50`, `minReplicas 0`, `maxReplicas 3`.

## Monitoring & telemetry (Application Insights)

The Express server is instrumented with the `applicationinsights` SDK (initialised first
in `server/src/appInsights.ts`, before express/http load). It auto-collects requests,
dependencies (the Web IQ SDK calls) and exceptions, and emits these custom signals:

| Signal | Table | When |
|--------|-------|------|
| `SandboxSearch` event | `customEvents` | every "Run request" — props: `endpointId`, `outcome` (success/failure/validation_error/not_configured/unknown_endpoint), `errorClass`, `statusCode`, `anonId`; measurements: `elapsedMs`, `inputLength`, `attempts` |
| `SandboxRateLimited` event | `customEvents` | on a 429/430 `RateLimitError` (drives the email alert) |
| `SandboxRateLimitErrors` metric | `customMetrics` | on a 429/430 `RateLimitError` |
| exceptions | `exceptions` | every failed run + anything reaching the error handler |

Privacy: only **metadata** is logged — never the query text. Users are unique-counted by an
anonymised `anonId` = `sha256(salt + ip + user-agent)` (no PII stored). The site uses **no
cookies** and a public **/privacy** notice (`web/src/components/PrivacyPolicy.tsx`) documents
the processing under GDPR. Visitors can object via a one-click opt-out, and the server also
honours `DNT: 1` / `Sec-GPC: 1` (`analyticsOptedOut` in `appInsights.ts`): when opted out, the
search route emits **no** `anonId` and **no** custom telemetry (`SandboxSearch` etc.).

- **Engagement dashboard:** an Azure Monitor **Workbook** — "Web IQ — User Engagement" —
  is deployed with the App Insights resource (Monitoring → Workbooks). It shows searches &
  unique visitors over time, searches by endpoint, outcome breakdown, p50/p95 latency,
  errors by class, rate-limit events, and top exceptions.
- **Rate-limit email alert:** when `WEBIQ_ALERT_EMAIL` is set, a scheduled log-query alert
  (`alert-<env>-ratelimit`) + action group (`ag-<env>-ratelimit`) email that address
  whenever a `SandboxRateLimited` event is ingested (evaluated every 5 min). Leave the env
  var empty to skip both. The connection string is injected as a Container App secret
  (`APPLICATIONINSIGHTS_CONNECTION_STRING`).

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
