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

The browser never sees the API key. In **production a single container** runs only the
Express server, which **also serves the built SPA** (`web/dist`) on the same origin — so
there is no CORS and no second service.

## Monorepo layout (npm workspaces)

```
webiq-demo/
├─ package.json            # workspaces [server, web] + root scripts
├─ tsconfig.base.json      # shared strict TS config
├─ Dockerfile              # multi-stage: build both → run server, serve SPA
├─ docker-compose.yml      # local two-container dev (web + server)
├─ azure.yaml              # azd service definition (single containerapp)
├─ infra/                  # Bicep IaC (Container Apps, ACR, Log Analytics, cert)
├─ server/                 # Express + TypeScript backend (CommonJS)
└─ web/                    # React + Vite + Tailwind frontend (ESM)
```

## Backend (`server/`, CommonJS, Node ≥ 22)

| File | Responsibility |
|------|----------------|
| `src/index.ts` | Express bootstrap: starts App Insights first, `express.json`, CORS (dev), mount `/api`, 404 JSON, prod static serve of `web/dist` + SPA fallback, telemetry flush on SIGTERM/SIGINT. |
| `src/appInsights.ts` | App Insights bootstrap (imported **first**). Auto-collects requests/dependencies/exceptions; helpers `trackEvent`/`trackException`/`trackMetric`, `anonIdFor`, `flushAppInsights`. No-op when no connection string. |
| `src/env.ts` | Loads `.env` (tries several paths), exposes `{ apiKey, port, webOrigin, timeoutMs, keyConfigured, authMode }`. |
| `src/webiqClient.ts` | Lazily constructs a singleton `WebIQClient`; holds the `SDK_ENUMS` registry + `resolveEnumValue`/`enumMemberName` helpers; `ConfigurationError`. |
| `src/telemetry.ts` | `AsyncLocalStorage` that correlates the SDK `telemetryHook` events to the in-flight request; `runWithTelemetry`, `summarizeTelemetry`, `telemetryEventsFromError`. |
| `src/contract.ts` | **The HTTP contract** (`ParamMeta`, `EndpointMeta`, `MetaResponse`, `TelemetryInfo`, `SearchSuccess`/`SearchFailure`). Mirrored verbatim by the frontend. |
| `src/endpoints/types.ts` | `EndpointDescriptor` (extends `EndpointMeta` + `invoke`), `toMeta`, `buildSdkOptions`. |
| `src/endpoints/*.ts` | One descriptor per endpoint (web, news, videos, images, browse, classic). |
| `src/endpoints/registry.ts` | Ordered array of all descriptors + `getDescriptor(id)`. Single source of truth. |
| `src/validation.ts` | `validateAndCoerce` — per-descriptor range/enum/url checks and type coercion. |
| `src/codegen.ts` | `generateSnippet` — builds copy-paste SDK TypeScript from a descriptor + user params. |
| `src/middleware/errorHandler.ts` | `toApiError` — maps SDK error classes → structured `{ httpStatus, info }`. |
| `src/routes/meta.ts` | `GET /api/meta` (form schema), `GET /api/health`. |
| `src/routes/search.ts` | `POST /api/search/:endpointId` — validate → invoke (with abort + timeout) → `{ data, telemetry, snippet }`; emits the `SandboxSearch` / `SandboxRateLimited` App Insights events. |

### Request flow

`UI form → POST /api/search/:id {input, params}` →
`getDescriptor(id)` → `validateAndCoerce` → `runWithTelemetry(descriptor.invoke(client, …))`
with an `AbortSignal` → respond
`{ ok:true, data, telemetry:{elapsedMs,statusCode,traceId}, snippet }`
or, on error, `toApiError` → `{ ok:false, error:{class,statusCode,message,retryAfter,…} }`.

## Frontend (`web/`, ESM, React 18 + Vite 5 + Tailwind 3)

| Area | Files |
|------|-------|
| Shell | `App.tsx` (state, run/abort, sticky-footer layout), `main.tsx`, `components/Header.tsx`, `components/Footer.tsx` |
| API | `api/client.ts` (`getMeta`, `runSearch` with `AbortController`), `types/meta.ts` (mirrors `contract.ts`) |
| Dynamic form | `components/ParameterForm.tsx` + `components/fields/{Text,Number,Boolean,Enum,MultiEnum}Field.tsx` |
| Output | `components/OutputTabs.tsx`, `ResultsPanel.tsx`, `results/*` (per-endpoint + `GenericCards` fallback), `RawJsonViewer.tsx`, `CodeSnippet.tsx`, `TelemetryPanel.tsx`, `ErrorBanner.tsx`, `ApiKeyBanner.tsx` |

The UI has **no hard-coded knowledge of individual parameters**. It renders forms and
result tabs **dynamically from `/api/meta`**.

## The extensibility model (core design)

Every endpoint is a **declarative descriptor**. Adding a new Web IQ endpoint is a
**one-file change** on the backend; the UI adapts automatically.

1. Create `server/src/endpoints/<name>.ts` exporting an `EndpointDescriptor`
   (`id`, `label`, `description`, `kind`, `inputLabel`, `inputPlaceholder`, `resultKey`,
   `params[]`, and an `invoke(client, input, opts, signal)` function).
2. Register it in `server/src/endpoints/registry.ts`.
3. Done. The sidebar, parameter form, raw JSON, code snippet, and telemetry all work.
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
| `WEB_ORIGIN` | no | `http://localhost:5173` | CORS origin in dev. |
| `WEBIQ_TIMEOUT_MS` | no | `15000` | Per-request SDK wall-clock budget (incl. retries). |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | no | — | App Insights telemetry. A Container App secret in prod; unset ⇒ telemetry disabled. |
| `WEBIQ_ANON_SALT` | no | built-in | Salt for the anonymous visitor id used in engagement stats. |
| `WEBIQ_ALERT_EMAIL` | no | — | **Deploy-time (azd) only.** Recipient for the rate-limit email alert; empty ⇒ no alert created. |

## Build & run

- **Local dev:** `npm run dev` → web on `:5173` (Vite proxies `/api` → `:3001`).
- **Production image:** `Dockerfile` builds both workspaces, then runs only the server
  with `NODE_ENV=production`, which serves the SPA. Single port `8080`.
- **Deploy:** Azure Container Apps via `azd` — see [deployment.md](./deployment.md).

## Related docs

- [Web IQ SDK reference](./webiq-sdk.md)
- [Deployment & operations](./deployment.md)
- [Custom domain (Cloudflare)](./custom-domain.md)
