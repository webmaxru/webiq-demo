# Architecture

The Web IQ Sandbox is an interactive developer playground for the
[Microsoft Web IQ](https://www.microsoft.com/en-us/webiq) grounding APIs, built on the
official [`@microsoft/webiq`](https://www.npmjs.com/package/@microsoft/webiq) TypeScript
SDK.

## High-level topology

```
┌──────────────┐     /api/*      ┌──────────────────┐   @microsoft/webiq   ┌──────────┐
│  web (React) │ ───────────────▶│  server (Express) │ ───────────────────▶│  Web IQ  │
│  Vite + TW   │◀─────────────── │  thin proxy + DX  │◀─────────────────── │   APIs   │
└──────────────┘   JSON + meta   └──────────────────┘    grounding data    └──────────┘
        ▲ renders forms/results          ▲ keeps WEBIQ_API_KEY server-side
```

The browser never sees the API key. In production, Azure Static Web Apps serves the
compiled SPA from its Free tier. The browser calls the ACA-hosted Express API through
`VITE_API_BASE_URL`; ACA restricts CORS to the generated SWA hostname and optional
frontend custom domain. The API scales to zero while idle.

## Monorepo layout (npm workspaces)

```
webiq-demo/
├─ package.json            # workspaces [server, web] + root scripts
├─ tsconfig.base.json      # shared strict TS config
├─ Dockerfile              # multi-stage API-only ACA image
├─ docker-compose.yml      # local two-container dev (web + server)
├─ azure.yaml              # azd provision-only configuration
├─ infra/                  # Bicep IaC (Static Web Apps, ACA, monitoring)
├─ server/                 # Express + TypeScript backend (CommonJS)
└─ web/                    # React + Vite + Tailwind frontend (ESM)
```

## Backend (`server/`, CommonJS, Node ≥ 22)

| File | Responsibility |
|------|----------------|
| `src/index.ts` | Express API bootstrap: starts App Insights first, `helmet` (tuned CSP), `trust proxy`, `express.json`, configured CORS, per-IP rate limiters, `/api` routes, JSON 404, and telemetry flush on SIGTERM/SIGINT. |
| `src/appInsights.ts` | App Insights bootstrap (imported **first**). Auto-collects requests/dependencies/exceptions; helpers `trackEvent`/`trackException`/`trackMetric`, `clientIp`, `anonIdFor`, `flushAppInsights`. No-op when no connection string. |
| `src/abuse.ts` | `trackAbuse(kind, req, details)` — logs to stdout + emits a `SandboxRateLimited` (rate-limit) or `SandboxAbuse` (oversized input/body) custom event via `trackEvent`. |
| `src/env.ts` | Loads `.env` (tries several paths), exposes `{ apiKey, port, webOrigin, timeoutMs, keyConfigured, authMode, trustProxyHops, maxInputLength, rateLimit }`. |
| `src/webiqClient.ts` | Lazily constructs a singleton `WebIQClient`; holds the `SDK_ENUMS` registry + `resolveEnumValue`/`enumMemberName` helpers; `ConfigurationError`. |
| `src/telemetry.ts` | `AsyncLocalStorage` that correlates the SDK `telemetryHook` events to the in-flight request; `runWithTelemetry`, `summarizeTelemetry`, `telemetryEventsFromError`. |
| `src/contract.ts` | **The HTTP contract** (`ParamMeta`, `EndpointMeta`, `TelemetryInfo`, `SearchSuccess`/`SearchFailure`). Mirrored verbatim by the frontend. |
| `src/endpoints/types.ts` | `EndpointDescriptor` (extends `EndpointMeta` + `invoke`), `toMeta`, `buildSdkOptions`. |
| `src/endpoints/*.ts` | One descriptor per endpoint (web, news, videos, images, browse, classic). |
| `src/endpoints/registry.ts` | Ordered array of all descriptors + `getDescriptor(id)`. Single source of truth. |
| `scripts/generateWebMeta.ts` | Build-time generator that strips server-only invocation functions and emits the web metadata module. It is not part of the API runtime build. |
| `src/validation.ts` | `validateAndCoerce` — per-descriptor range/enum/url checks, type coercion, and input/string length caps (`maxInputLength`). |
| `src/codegen.ts` | `generateSnippet` — builds copy-paste SDK TypeScript from a descriptor + user params. |
| `src/middleware/rateLimit.ts` | Per-IP `express-rate-limit` limiters (strict `searchRateLimiter`, looser `generalRateLimiter`); the 429 handler records a `rate_limit` abuse event. |
| `src/middleware/errorHandler.ts` | `toApiError` — maps SDK error classes → structured `{ httpStatus, info }`; the `errorHandler` records `payload_too_large` on 413 + tracks exceptions. |
| `src/routes/health.ts` | `GET /api/health`; runtime status only. |
| `src/routes/search.ts` | `POST /api/search/:endpointId` — input-length cap → validate → invoke (with abort + timeout) → `{ data, telemetry, snippet }`; emits the `SandboxSearch` / `SandboxRateLimited` App Insights events. |

### Request flow

`UI form → POST /api/search/:id {input, params}` →
`helmet` + per-IP rate limiter (429 + `SandboxRateLimited` abuse event if over limit) →
`getDescriptor(id)` → input-length cap (400 + `SandboxAbuse` event if over) → `validateAndCoerce` →
`runWithTelemetry(descriptor.invoke(client, …))`
with an `AbortSignal` → respond
`{ ok:true, data, telemetry:{elapsedMs,statusCode,traceId}, snippet }`
or, on error, `toApiError` → `{ ok:false, error:{class,statusCode,message,retryAfter,…} }`.

Abuse signals (`rate_limit`, `input_too_long`, `payload_too_large`) are recorded by
`trackAbuse` and drive the Owner-role Azure Monitor alert (see
[abuse-protection.md](./abuse-protection.md)).

## Frontend (`web/`, ESM, React 18 + Vite 5 + Tailwind 3)

| Area | Files |
|------|-------|
| Shell | `App.tsx` (state, run/abort, sticky-footer layout), `main.tsx`, `components/Header.tsx`, `components/Footer.tsx` |
| API | `api/client.ts` (one-shot background `warmBackend`, plus `runSearch` with `AbortController`), `types/meta.ts` (mirrors `contract.ts`) |
| Generated data | `src/generated/endpointMeta.ts` (ignored; regenerated before dev/typecheck/build and bundled by Vite) |
| Dynamic form | `components/ParameterForm.tsx` + `components/fields/{Text,Number,Boolean,Enum,MultiEnum}Field.tsx` |
| Output | `components/OutputTabs.tsx`, `ResultsPanel.tsx`, `results/*` (per-endpoint + `GenericCards` fallback), `RawJsonViewer.tsx`, `CodeSnippet.tsx`, `TelemetryPanel.tsx`, `ErrorBanner.tsx`, `ApiKeyBanner.tsx` |

The UI has **no hard-coded knowledge of individual parameters**. Endpoint metadata is
generated from the backend registry and bundled into the SPA, so the complete sidebar
and forms render without waiting for ACA. After the index renders, it sends one
fire-and-forget `/api/health` request to warm the scale-to-zero backend; its result is not
shown. Hosted search calls resolve against `VITE_API_BASE_URL`; local development uses
Vite's `/api` proxy. A search still pending after five seconds displays an accessible
“Application is starting” status.

## The extensibility model (core design)

Every endpoint is a **declarative descriptor**. Adding a new Web IQ endpoint is a
**one-file change** on the backend; the UI adapts automatically.

1. Create `server/src/endpoints/<name>.ts` exporting an `EndpointDescriptor`
   (`id`, `label`, `description`, `kind`, `inputLabel`, `inputPlaceholder`, `resultKey`,
   `params[]`, and an `invoke(client, input, opts, signal)` function).
2. Register it in `server/src/endpoints/registry.ts`.
3. Run a normal dev/typecheck/build command; the pre-script regenerates the bundled
   metadata. The sidebar, parameter form, raw JSON, code snippet, and telemetry all work.
   Results render via `GenericCards` when `resultKey` points at an array; for a bespoke
   layout add `web/src/components/results/<Name>.tsx` and map it in `ResultsPanel.tsx`.

`ParamMeta.type` is one of `string | number | boolean | enum | multiEnum`. Enum params
carry `options` (the **values** sent to the API) and an optional `enumImport` (the SDK
enum name, used by codegen to render `EnumName.MEMBER`).

## Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `WEBIQ_API_KEY` | yes | — | Web IQ API key. Server-side only; a Container App secret in prod. |
| `PORT` | no | `3001` (local), `8080` (container) | Backend HTTP port. |
| `WEB_ORIGIN` / `WEB_ORIGINS` | no | `http://localhost:5173` | One CORS origin or a comma-separated origin list. Bicep supplies the SWA origins in production. |
| `WEBIQ_TIMEOUT_MS` | no | `15000` | Per-request SDK wall-clock budget (incl. retries). |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | no | — | App Insights telemetry. A Container App secret in prod; unset ⇒ telemetry disabled. |
| `WEBIQ_ANON_SALT` | no | built-in | Salt for the anonymous visitor id used in engagement stats. |
| `WEBIQ_MAX_INPUT_LENGTH` | no | `2048` | Max input/string-param length before rejection (abuse signal). |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_SEARCH_MAX` / `RATE_LIMIT_GENERAL_MAX` | no | `60000` / `15` / `100` | Per-IP rate-limit window + per-window caps for `/api/search` and the rest of `/api`. |
| `TRUST_PROXY_HOPS` | no | `1` | Reverse-proxy hops to trust for client IP (Container Apps = 1). |

The abuse alert needs no env var — it is always provisioned and notifies the subscription
Owner role (see [abuse-protection.md](./abuse-protection.md)).

## Build & run

- **Metadata generation:** `npm run generate:web-meta`; normal web dev/typecheck/build
  commands invoke it automatically.
- **Local dev:** `npm run dev` → generated metadata + web on `:5173` (Vite proxies searches to `:3001`).
- **Production backend:** `Dockerfile` builds and runs only the Express API on port `8080`.
- **Production frontend:** Vite builds `web/dist`; GitHub Actions uploads it to SWA.
- **Deploy:** Bicep/`azd` provisions SWA + ACA; GitHub Actions deploys both artifacts.

## Related docs

- [Web IQ SDK reference](./webiq-sdk.md)
- [Deployment & operations](./deployment.md)
- [Abuse protection & alerting](./abuse-protection.md)
- [Custom domain (Cloudflare)](./custom-domain.md)
