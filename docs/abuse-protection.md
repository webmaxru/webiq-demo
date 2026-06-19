# Abuse protection & alerting

How the backend defends the (public, unauthenticated) Web IQ proxy against automated
abuse, and how abuse is surfaced to operators. This builds on the existing Application
Insights telemetry layer (`server/src/appInsights.ts`) — it does **not** add a second
telemetry SDK. The non-obvious bits are distilled as gotchas in
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md) (Section J).

## Why

`/api/search/:endpointId` is anonymous and every call spends the owner's metered Web IQ
quota. Compute is bounded by Container Apps autoscale (`maxReplicas: 3`), but **API spend
is not** — so the real risk is quota exhaustion / cost abuse via scripted traffic. The
controls below cap per-IP volume, reject oversized payloads, harden headers, and alert a
human when any of them trips.

## Controls (server)

| Control | Where | Default | Behavior |
|---------|-------|---------|----------|
| Per-IP rate limiting | `server/src/middleware/rateLimit.ts` | `15`/min on `/api/search`, `100`/min on the rest of `/api` (60 s window) | Returns `429` `RateLimitError` (+ `Retry-After`); records a `rate_limit` abuse event. Health is exempt. |
| Security headers (`helmet`) | `server/src/index.ts` | strict defaults, `img-src` widened to `https:` | CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, etc. |
| Input-length cap | `server/src/validation.ts` + `routes/search.ts` | `2048` chars | Rejects oversized primary input and string params with `400`; oversized primary input records an `input_too_long` abuse event. |
| Body-size cap | `server/src/index.ts` (`express.json({ limit: '1mb' })`) | `1mb` | `413` → records a `payload_too_large` abuse event (`server/src/middleware/errorHandler.ts`). |

All three abuse signals — `rate_limit`, `input_too_long`, `payload_too_large` — flow
through `trackAbuse()` in `server/src/abuse.ts`, which:

1. writes a structured `console.warn('[abuse] …')` line (always, even without App Insights), and
2. emits an Application Insights **custom event** via the shared `trackEvent` helper.

Abuse signals are **security telemetry**, so (unlike the `SandboxSearch` analytics event)
they are recorded regardless of the visitor's analytics opt-out, and they include the raw
client IP so an operator can act on it. They never include query text.

### Request flow

```
POST /api/search/:id {input, params}
  → helmet + CORS
  → searchRateLimiter (429 + SandboxRateLimited event if over limit)
  → getDescriptor(id)
  → input-length cap (400 + SandboxAbuse event if over)
  → validateAndCoerce (range/enum/url + per-field length caps)
  → runWithTelemetry(descriptor.invoke(client, …))  [AbortSignal: client-close ∪ timeout]
  → 200 { data, telemetry, snippet }   (also emits the SandboxSearch analytics event)
  (any 413 along the way → SandboxAbuse event in the error handler)
```

## Telemetry (Application Insights)

The backend uses the classic **`applicationinsights`** SDK, bootstrapped once in
`server/src/appInsights.ts` (imported first in `index.ts`). Abuse tracking reuses its
`trackEvent` / `clientIp` helpers — there is no separate instrumentation module.

Event-name mapping (chosen to light up the **existing** engagement workbook + alert):

| Abuse kind | Custom event | Notes |
|------------|--------------|-------|
| `rate_limit` (per-IP gateway 429) | `SandboxRateLimited` | Same event the app already emits for **upstream** Web IQ 429/430s; gateway hits carry `source: 'gateway'`. Lights up the workbook's "rate-limit" tile. |
| `input_too_long`, `payload_too_large` | `SandboxAbuse` | Dedicated event with a `kind` dimension. |

```ts
// server/src/abuse.ts (shape)
trackEvent('SandboxRateLimited' | 'SandboxAbuse', {
  kind, source: 'gateway', ip, endpointId, path, method, userAgent, limit, actual, windowMs,
});
```

Inspect in App Insights / Log Analytics:

```kql
customEvents
| where name in ("SandboxRateLimited", "SandboxAbuse")
| extend kind = tostring(customDimensions.kind),
         ip = tostring(customDimensions.ip),
         endpointId = tostring(customDimensions.endpointId),
         source = tostring(customDimensions.source)
| project timestamp, name, kind, source, ip, endpointId,
          path = tostring(customDimensions.path)
| order by timestamp desc
```

## Alerting (infra)

Provisioned unconditionally in `infra/modules/resources.bicep` (no per-deploy config) —
this replaces the earlier email-gated rate-limit alert:

- **Application Insights** — workspace-based (already present), shared by all telemetry.
- **Action group** (`ag-<env>-abuse`) — uses an **ARM-role receiver** targeting the
  built-in **Owner** role (`8e3af657-a8ff-443c-a75c-2fe8c4bcb635`,
  `useCommonAlertSchema: true`). Azure delivers to the email registered on each account
  that owns the subscription — **no custom address is stored in the repo**.
- **Scheduled query rule** (`alert-<env>-abuse`, kind `LogAlert`) — scoped to the App
  Insights component, query `customEvents | where name in ("SandboxRateLimited",
  "SandboxAbuse")`, `evaluationFrequency`/`windowSize` = `PT5M`, `threshold > 0`,
  `autoMitigate: true`. Notifications arrive within ~5 minutes of an abuse event (5 minutes
  is the practical floor for log alerts).
- **Engagement workbook** — main's existing "rate-limit" tile (`SandboxRateLimited`) now
  also covers gateway rate-limit hits.

To route alerts elsewhere, add receivers to the `ag-<env>-abuse` action group in the
portal, or change `ownerRoleId` / `armRoleReceivers` in `infra/modules/resources.bicep`.

## Configuration

All optional; sensible defaults apply when unset (see [`.env.example`](../.env.example)).

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEBIQ_MAX_INPUT_LENGTH` | `2048` | Max characters for the search input / string params. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Per-IP rate-limit window (ms). |
| `RATE_LIMIT_SEARCH_MAX` | `15` | Max `/api/search` requests per IP per window. |
| `RATE_LIMIT_GENERAL_MAX` | `100` | Max other `/api` requests per IP per window. |
| `TRUST_PROXY_HOPS` | `1` | Reverse-proxy hops to trust for the client IP (Container Apps = 1, local = 0). |

## Local testing

```powershell
# tiny limits so the controls trip immediately
$env:RATE_LIMIT_SEARCH_MAX='1'; $env:WEBIQ_MAX_INPUT_LENGTH='50'
npm run build -w server; node server/dist/index.js
```

- Oversized input → `400` `ValidationError` + `[abuse] input_too_long …` in the log.
- 2nd `/api/search/*` call within the window → `429` `RateLimitError` (`Retry-After`) +
  `[abuse] rate_limit …`.
- Set a (dummy) `APPLICATIONINSIGHTS_CONNECTION_STRING` to verify the telemetry path runs;
  the abuse emit must not disturb the response.

## Related docs

- [Architecture](./architecture.md) — server module map + request flow.
- [Deployment & operations](./deployment.md) — resources, cost, and the abuse alert.
- [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) — Section J: the
  hard-won gotchas behind this feature.
