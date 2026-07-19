# Web IQ Sandbox

An interactive developer **sandbox** for [Microsoft **Web IQ**](https://aka.ms/WebIQ) — a
suite of AI-native grounding APIs that connect agents to fresh, real-world intelligence
from across the web (web pages, news, images, videos, browse, and classic multi-answer
search).

This app is a **playground**: pick an endpoint, tweak every SDK parameter from a UI, fire
a live request, and inspect rendered results, the **raw JSON**, a copy-paste **SDK code
snippet**, **latency/telemetry**, and structured **errors**. It is built to be
**extensible** — adding a new Web IQ endpoint is a one-file change.

Built on the official [`@microsoft/webiq`](https://www.npmjs.com/package/@microsoft/webiq)
TypeScript SDK.

```
┌──────────────┐     /api/*      ┌──────────────────┐   @microsoft/webiq   ┌──────────┐
│  web (React) │ ───────────────▶│  server (Express) │ ───────────────────▶│  Web IQ  │
│  Vite + TW   │◀─────────────── │  thin proxy + DX  │◀─────────────────── │   APIs   │
└──────────────┘   JSON + meta   └──────────────────┘    grounding data    └──────────┘
        ▲ renders forms/results          ▲ keeps WEBIQ_API_KEY server-side
```

The browser never sees your API key — all SDK calls run on the backend.

---

## Features

- **All Web IQ endpoints**: `web`, `news`, `videos`, `images`, `browse`, `classic`.
- **Interactive parameter forms** generated dynamically from server-described metadata
  (every SDK option, with ranges, enums, and defaults).
- **Rendered result cards** with thumbnails and video/image previews, plus a generic
  fallback renderer so new endpoints display without UI changes.
- **Raw JSON** request + response viewer with copy buttons.
- **Generated SDK code snippet** — copy-paste TypeScript that reproduces your request.
- **Latency & telemetry panel** driven by the SDK `telemetryHook` (elapsed ms, HTTP
  status, attempts, trace ID).
- **Error / rate-limit visualization** mapping the SDK error classes
  (`AuthenticationError`, `PermissionDeniedError`, `RateLimitError`, `APIStatusError`,
  `APIConnectionError`) including `retryAfter`.
- **Abuse protection**: per-IP rate limiting, `helmet` security headers (incl. CSP),
  and an input-length cap — each tripped control emits a `SandboxRateLimited` / `SandboxAbuse`
  Application Insights event, with an Azure Monitor alert to the subscription Owner role.

---

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/architecture.md](./docs/architecture.md) | Solution architecture + extensibility model |
| [docs/webiq-sdk.md](./docs/webiq-sdk.md) | `@microsoft/webiq` SDK reference (endpoints, enums, errors) |
| [docs/deployment.md](./docs/deployment.md) | Azure Container Apps deploy, resources, cost model |
| [docs/abuse-protection.md](./docs/abuse-protection.md) | Rate limiting, helmet, input caps, abuse events + alert |
| [docs/custom-domain.md](./docs/custom-domain.md) | Cloudflare → Container Apps custom domain + TLS |
| [.github/copilot-instructions.md](./.github/copilot-instructions.md) | Gotchas & hard-won lessons for AI agents / contributors |

---

## Prerequisites

- **Node.js >= 22** and **npm >= 10** (required by the `@microsoft/webiq` SDK).
- A **Web IQ API key**. Request access / get a key at <https://aka.ms/WebIQ>.
- (Optional) **Docker** + **Docker Compose** for the containerized run.

---

## Quick start (local development)

```bash
# 1. Install dependencies (root installs both workspaces)
npm install

# 2. Configure your API key
cp .env.example .env        # on Windows PowerShell: Copy-Item .env.example .env
#   then edit .env and set WEBIQ_API_KEY=<your key>

# 3. Run backend + frontend together (hot reload)
npm run dev
```

- Frontend (Vite dev server): <http://localhost:5173>
- Backend (Express API): <http://localhost:3001> — the Vite dev server proxies `/api` to it.

Open <http://localhost:5173> and start exploring. If `WEBIQ_API_KEY` is not set, the UI
shows a banner and API calls return a clear configuration error.

### Useful scripts (run from the repo root)

| Command | Description |
| --- | --- |
| `npm run dev` | Run server + web together with hot reload |
| `npm run dev:server` / `npm run dev:web` | Run just one side |
| `npm run build` | Type-check and build both workspaces |
| `npm run typecheck` | Type-check both workspaces |
| `npm run lint` | ESLint across the repo |
| `npm run format` | Prettier write |
| `npm run docker:up` / `npm run docker:down` | Build & run / stop the Docker stack |

---

## Configuration

All configuration is via environment variables (see [`.env.example`](./.env.example)).

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `WEBIQ_API_KEY` | **yes** | — | Your Web IQ API key. Kept server-side only. |
| `PORT` | no | `3001` | Backend HTTP port. |
| `WEB_ORIGIN` | no | `http://localhost:5173` | Allowed CORS origin (the web app). |
| `WEBIQ_TIMEOUT_MS` | no | `15000` | Per-request SDK timeout (wall-clock budget incl. retries). |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | no | — | App Insights telemetry + abuse events. Injected automatically in Azure; unset ⇒ disabled. |
| `WEBIQ_ANON_SALT` | no | built-in | Salt for the anonymised visitor id used in engagement stats. |
| `WEBIQ_MAX_INPUT_LENGTH` | no | `2048` | Max characters for the search input before rejection (abuse signal). |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Per-IP rate-limit window (ms). |
| `RATE_LIMIT_SEARCH_MAX` | no | `15` | Max `/api/search` requests per IP per window. |
| `RATE_LIMIT_GENERAL_MAX` | no | `100` | Max other `/api` requests per IP per window. |
| `TRUST_PROXY_HOPS` | no | `1` | Reverse-proxy hops to trust for client IP (Container Apps = 1, local = 0). |

---

## Run with Docker

The stack runs as two containers: **web** (nginx serving the built SPA and proxying
`/api` to the server) and **server** (the Express API).

```bash
# Ensure .env contains WEBIQ_API_KEY, then:
npm run docker:up        # = docker compose up --build
```

- App: <http://localhost:8080>
- API (direct): <http://localhost:3001>

Stop with `npm run docker:down`.

---

## Deploy to Azure (Container Apps)

This repo is deploy-ready for **Azure Container Apps**. Infrastructure is provisioned with
the **Azure Developer CLI (`azd provision`)** + **Bicep**; the container image is built and
published to **GitHub Container Registry (ghcr.io)** — free for this public repo, no Azure
Container Registry — by **GitHub Actions**, which then rolls the Container App onto the new
image. It runs a **single container** (the Express server serves both the API and the built
SPA) on a **Consumption** Container Apps environment. By default it **scales to zero when
idle** (`minReplicas: 0`) so idle compute costs **$0**; the trade-off is a brief cold start
on the first request after a quiet period. Set `WEBIQ_MIN_REPLICAS 1` to keep one warm
replica instead (no cold start, billed at the reduced Container Apps **idle** rate).

**What gets created:** 1 Container Apps environment (Consumption), 1 Container App
(0.25 vCPU / 0.5 GiB, scale 0→3), 1 Log Analytics workspace, 1 Application Insights.
The image lives in **ghcr.io** (free), not ACR. `WEBIQ_API_KEY` is stored as a Container
App **secret**.

**Idle cost:** scale-to-zero compute **$0** · Consumption env **$0** base · Log Analytics
within free tier · **ghcr.io $0** (public package) → **~$0/mo idle**. Keeping one warm
replica (`WEBIQ_MIN_REPLICAS 1`) adds **~$4–5/mo** (idle rates). See
[docs/deployment.md](./docs/deployment.md#cost-model).

**Spend alerts:** a subscription-scoped Cost Management **budget** (`WEBIQ_MONTHLY_BUDGET`,
default **50**) emails the subscription **Owner** role at 80% / 100% / forecast-100% of the
amount. Note: budgets carry **no currency** — `50` is in the subscription's billing currency
(50 NOK only if it bills in NOK). See
[docs/deployment.md](./docs/deployment.md#spend-alerts-cost-management-budget).

### Prerequisites
- [Azure Developer CLI (`azd`)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) (for infra) and Docker (to build/push the image).
- An Azure subscription.

### One-time deploy

**1. Provision the infrastructure** (Container Apps env + app + monitoring — no image yet):

```bash
azd auth login                       # sign in to your Azure account
azd env new webiq-demo               # (first time) creates the environment
azd env set AZURE_LOCATION eastus2
azd env set WEBIQ_API_KEY <your-web-iq-key>
azd provision                        # deploy infra/main.bicep (~3-5 min)
```

**2. Build, push, and roll the image** — normally done automatically by GitHub Actions on
every push to `main` (`.github/workflows/deploy.yml`). To do it by hand:

```bash
IMAGE=ghcr.io/<owner>/webiq-demo
echo $GHCR_TOKEN | docker login ghcr.io -u <owner> --password-stdin   # PAT with write:packages
docker build -t $IMAGE:latest .
docker push $IMAGE:latest
az containerapp update -n <app-name> -g rg-webiq-demo --image $IMAGE:latest
```

> **One-time:** make the `ghcr.io/<owner>/webiq-demo` package **Public** (repo → Packages →
> package → *Package settings* → *Change visibility*) so the Container App can pull it with
> no registry credentials. That's what keeps the registry **free** and credential-less.

`azd provision` exports the public URL as `WEBIQ_APP_URL`. Redeploy app changes by pushing
to `main` (or re-running the manual steps above); tear everything down with `azd down`.

> The deployment plan, architecture, and cost rationale live in
> [`.azure/deployment-plan.md`](./.azure/deployment-plan.md).

### Files
- [`azure.yaml`](./azure.yaml) — provision-only azd config (infra, no service/registry).
- [`Dockerfile`](./Dockerfile) — multi-stage build → one image serving API + SPA.
- [`infra/`](./infra) — Bicep: Container Apps env, Log Analytics, App Insights, the app.

### Custom domain

To serve the app on your own domain (e.g. `webiq.example.com`) with a **free
Azure-managed TLS certificate**, set the `WEBIQ_CUSTOM_DOMAIN` azd variable and add the
required DNS records, then `azd provision`. A full walkthrough — including
**Cloudflare** DNS, proxy (orange vs. grey cloud), and SSL/TLS mode guidance — is in
[`docs/custom-domain.md`](./docs/custom-domain.md).

---

## Project structure

```
webiq-demo/
├─ package.json            # npm workspaces + root scripts
├─ tsconfig.base.json      # shared strict TS config
├─ eslint.config.js        # flat ESLint config
├─ docker-compose.yml      # web + server services
├─ .env.example
├─ server/                 # Express backend (thin proxy over the SDK)
│  ├─ Dockerfile
│  └─ src/
│     ├─ index.ts          # app bootstrap, CORS, routes
│     ├─ env.ts            # env loading/validation
│     ├─ webiqClient.ts    # singleton WebIQClient + telemetry hook
│     ├─ telemetry.ts      # AsyncLocalStorage telemetry correlation
│     ├─ codegen.ts        # generates the copy-paste SDK snippet
│     ├─ validation.ts     # per-descriptor param validation/coercion
│     ├─ contract.ts       # shared HTTP contract types
│     ├─ endpoints/        # one descriptor per endpoint + registry
│     ├─ routes/           # /api/meta, /api/health, /api/search/:id
│     └─ middleware/       # SDK error → structured HTTP mapping
└─ web/                    # React + Vite + Tailwind sandbox UI
   ├─ Dockerfile  nginx.conf  vite.config.ts  tailwind.config.js
   └─ src/
      ├─ App.tsx  main.tsx
      ├─ api/client.ts      # talks to the backend
      ├─ types/meta.ts      # mirrors server/src/contract.ts
      ├─ components/        # sidebar, form, fields, results, viewers, panels
      └─ components/results # per-endpoint renderers (+ generic fallback)
```

### How it works

1. The backend describes each endpoint as a **declarative descriptor** (its parameters,
   enums, ranges, and an `invoke` function that calls the SDK).
2. `GET /api/meta` serves those descriptors (minus server-only fields).
3. The frontend renders the **parameter form and result tabs dynamically** from that
   metadata — so the UI has no hard-coded knowledge of individual parameters.
4. `POST /api/search/:endpointId` validates/coerces the params, calls the SDK with an
   abort/timeout budget, and returns `{ data, telemetry, snippet }` (or a structured
   error).

---

## Extending: add a new Web IQ endpoint

When Web IQ ships a new endpoint, wire it up in **one place** on the backend — the UI
adapts automatically.

1. **Create a descriptor** at `server/src/endpoints/<name>.ts`:

   ```ts
   import type { EndpointDescriptor } from './types';

   export const myEndpoint: EndpointDescriptor = {
     id: 'myEndpoint',
     label: 'My Endpoint',
     description: 'What it does.',
     kind: 'query',                       // or 'url'
     inputLabel: 'Query',
     inputPlaceholder: 'example input',
     resultKey: 'myResults',              // primary array field, or null
     params: [
       { name: 'maxResults', label: 'Max results', type: 'number', default: 10, min: 1, max: 50 },
       { name: 'contentFormat', label: 'Content format', type: 'enum',
         enumImport: 'ContentFormat', options: ['passage', 'text', 'html', 'markdown'], default: 'markdown' },
       // string | number | boolean | enum | multiEnum
     ],
     async invoke(client, input, opts /*, signal */) {
       return client.myEndpoint.search(input, opts);
     },
   };
   ```

2. **Register it** in `server/src/endpoints/registry.ts` (add to the array).

3. That's it. The sidebar, parameter form, raw JSON, code snippet, and telemetry all work
   immediately. Results render via the **generic card renderer** when `resultKey` points
   at an array; for a bespoke layout, add `web/src/components/results/MyResults.tsx` and
   map it in `ResultsPanel.tsx`.

---

## Security notes

- The `WEBIQ_API_KEY` lives only on the server and is never sent to the browser.
- CORS is restricted to `WEB_ORIGIN` in development.
- The backend is a thin proxy — it does not persist requests or responses.
- Abuse protection: `helmet` security headers (incl. a tuned CSP), per-IP rate
  limiting on the API (stricter on `/api/search`), and a hard input-length cap.
  Tripped controls are recorded as `SandboxRateLimited` / `SandboxAbuse` Application
  Insights events and trigger an Azure Monitor alert to the subscription **Owner**
  role (the email registered on your Azure account — no custom address configured).
  See [docs/abuse-protection.md](./docs/abuse-protection.md).

---

## License

MIT
