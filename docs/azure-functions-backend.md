# Azure Functions backend (cost-optimized branch)

This branch keeps the same React/Vite frontend and swaps the Container App API for a
serverless Azure Functions backend on the Consumption plan.

## Why this is cheaper

- Static Web Apps Free stays on the frontend at $0.
- Azure Functions Consumption costs only when the API is executing.
- No always-on Container App replica is kept warm; cold starts are paid only on demand.
- The same Web IQ key remains server-side and the app still runs behind a public endpoint.
- The required Standard LRS storage account has a small usage-based cost; no premium or
  zone-redundant storage is provisioned.

## Deployment shape

- Frontend: Azure Static Web Apps Free
- Backend: Azure Functions Consumption
- Telemetry: platform logs only; Application Insights is disabled to avoid ingestion cost
- Secrets: Azure Function App application settings (`WEBIQ_API_KEY`)

## Azure resource plan

```text
Static Web App (Free)
   └─ Vite web app

Function App (Consumption plan)
   ├─ GET  /api/health
   ├─ POST /api/search/{endpointId}
   └─ WEBIQ_API_KEY + App Insights connection string in app settings
```

## Cost-minimizing settings

- Run the Function App on the Consumption plan with no always-on setting.
- Avoid a custom domain unless there is a real production requirement.
- Keep compute at the default scale-to-zero behavior and rely on the SWA free tier for the frontend.
- Cap the Function App at one scale-out instance to bound burst spend.
- Disable Application Insights for this alternative deployment; enable it only when the
  operational value justifies ingestion cost.
- Use a Standard LRS storage account, the least expensive redundancy option.

## Local run

```bash
npm install
cp functions/local.settings.json.example functions/local.settings.json
# set WEBIQ_API_KEY in functions/local.settings.json
npm run dev:functions
```

## Azure deployment

The Functions backend is the **production backend on `main`**. Merging to `main` runs
`.github/workflows/deploy-azure-functions.yml`, which provisions an idempotent Linux
Consumption Function App and Standard LRS storage account, disables Application Insights,
caps scale-out at one instance, deploys a self-contained package, and verifies both
`/api/health` and a real Web IQ search. Pull requests run validation only.

The workflow also builds the frontend with `VITE_API_BASE_URL` set to the deployed Functions
URL, verifies that URL is embedded in the generated bundle, and uploads the SPA to the existing
Static Web Apps Free resource. The deployed API URL is printed in the workflow log.

> **Only one workflow may own the frontend.** `.github/workflows/deploy.yml` (Container Apps +
> ghcr.io) publishes to the *same* Static Web Apps resource with `VITE_API_BASE_URL` pointing at
> the Container App. To stop the two from overwriting each other, that Container Apps deploy job
> is **manual only** (`workflow_dispatch`) and is kept as a rollback path; pushes to `main` run
> only its validate job. Dispatching it repoints the SPA at the Container App — re-run this
> Functions workflow to switch back.

Search rate limiting is scoped to a random browser-tab session identifier stored in
`sessionStorage`; the backend hashes it before using it as a limiter key and falls back to the
client IP when the header is absent or invalid. No account, cookie, or paid state store is
required.
