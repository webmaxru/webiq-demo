# Web IQ SDK reference (`@microsoft/webiq`)

Condensed, verified reference for the official SDK as used by this project
(`@microsoft/webiq` v0.1.0). Extracted from the package's `dist/index.d.ts` — treat this
as the quick lookup so you don't have to re-read the type definitions.

## Package facts

- **Version:** 0.1.0 · **Engines:** Node ≥ 22, npm ≥ 10.
- **Dual package:** ships both CJS (`dist/index.js`, `require`) and ESM
  (`dist/index.mjs`, `import`) + `dist/index.d.ts`. A CommonJS server can `import` it
  cleanly.
- **Base URL:** `https://api.microsoft.ai/v3`.

## Client

```ts
import { WebIQClient } from '@microsoft/webiq';

const client = new WebIQClient({
  apiKey: process.env.WEBIQ_API_KEY, // OR credential / auth
  timeout: 15000,                    // ms, per attempt (default 10000)
  telemetryHook: (e) => { /* ... */ },
  retry: new RetryPolicy({ maxRetries: 2 }),
});
// ... client.web / .news / .videos / .images / .browse / .classic
await client.close();
```

Auth options (mutually exclusive): `apiKey` **or** an `@azure/identity` `credential`
**or** a custom `auth` provider. The API **does enforce auth** — a bad key returns
**401 `AuthenticationError`**.

## Endpoints, options & result shapes

All search methods are `client.<resource>.search(query, options)`; browse is
`client.browse.fetch(url, options)`. Every option bag also accepts `timeout?: number` and
`signal?: AbortSignal`.

### `web.search(query, opts)` → `{ webResults, traceId }`
- `maxResults` 1–50 (d 10), `language` (ISO 639-1), `region` (2-letter), `location`
  (`'lat:..;long:..'`), `contentFormat` (`ContentFormat`), `maxLength` 1–500000 (d 10000).
- `WebResult`: `{ title, url, content, lastUpdatedAt, crawledAt, language, isAdult }`.

### `news.search(query, opts)` → `{ newsResults, traceId }`
- `maxResults` 1–20 (d 10), `language`, `region`, `location`, `contentFormat`, `maxLength`.
- `NewsItem`: `{ title, url, content, snippet, thumbnail{url,width,height}, lastUpdatedAt, source, isAdult }`.

### `videos.search(query, opts)` → `{ videoResults, playlists, traceId }`
- `maxResults` 1–30 (d 30), `language`, `region`, `enablePlaylist` (bool),
  `freshness` (`day|week|month|year` or date range), `embeddable` (string[]),
  `resolution` (`VideoResolution`), `safeSearch` (`SafeSearch`), `duration` (`VideoDuration`).
- `VideoItem`: `{ title, url, description, publishedBy, viewCount, summary, length,
  embeddingUrl, lastUpdatedAt, moments[], thumbnailUrl, width, height, isAdult }`.

### `images.search(query, opts)` → `{ imageResults, traceId }`
- `maxResults` 1–30 (d 30), `language`, `region`, `aspectRatio` (`ImageAspectRatio`),
  `color` (`ImageColor`), `safeSearch` (`SafeSearch`), `imageSize` (`ImageSize`),
  `watermarkFree` (bool), `maxHeight/minHeight/maxWidth/minWidth`.
- `ImageItem`: `{ title, url, hostPageUrl, caption, width, height, thumbnailUrl, lastUpdatedAt, isAdult }`.

### `browse.fetch(url, opts)` → `{ url, title, content, isAdult, lastUpdatedAt, crawledAt, retryAfter, traceId }`
- `maxLength` 1–500000 (d 10000), `liveCrawl` (`none|fallback|force`, d `none`),
  `includeWebLinks` (bool), `renderDynamicPages` (bool), `includeImageLinks` (bool),
  `language`, `region`, `contentFormat` (`BrowseContentFormat`).

### `classic.search(query, opts)` → `{ querySignals, traceId, [answerType]: any }`
- `maxAnswerTypes` 1–6 (d 6), `language`, `region`, `location`, `maxResultsWeb` 1–50 (d 10),
  `maxLength`, `contentFormat` (`ContentFormat`), `freshness`, `responseFilter` (string[]
  of answer types e.g. `['webResults','newsResults']`), `safeSearch` (`SafeSearchMode`).
- Response is an **open object**: typed `querySignals`
  `{ originalQuery, normalizedQuery, isDefensive, isAdult, isNav, isFresh }` + `traceId`
  plus dynamic answer arrays (`webResults`, `newsResults`, `imageResults`, …).

## Enums (NAME = `"value"`)

> ⚠️ The enum **values are plain strings**, so passing the value string works at runtime.
> But to satisfy TypeScript, resolve incoming strings to the enum and cast the options to
> the SDK option type (or `any`). This repo does that in `endpoints/types.ts`
> (`buildSdkOptions` + `resolveEnumValue`).

| Enum | Members |
|------|---------|
| `ContentFormat` | `PASSAGE="passage"`, `TEXT="text"`, `HTML="html"`, `MARKDOWN="markdown"` |
| `BrowseContentFormat` | `TEXT="text"`, `HTML="html"`, `MARKDOWN="markdown"` (no PASSAGE) |
| `SafeSearch` | `OFF="off"`, `STRICT="strict"` |
| `SafeSearchMode` | `OFF="off"`, `MODERATE="moderate"`, `STRICT="strict"` |
| `ImageAspectRatio` | `SQUARE="square"`, `WIDE="wide"`, `TALL="tall"` |
| `ImageColor` | `COLOR_ONLY="colorOnly"`, `MONOCHROME="monochrome"` |
| `ImageSize` | `SMALL="small"`, `MEDIUM="medium"`, `LARGE="large"`, `EXTRA_LARGE="extraLarge"` |
| `VideoDuration` | `SHORT="short"`, `MEDIUM="medium"`, `LONG="long"` |
| `VideoResolution` | `_360P="360p"`, `_480P="480p"`, `_720P="720p"`, `_1080P="1080p"` |

`freshness` and `liveCrawl` are **plain strings** (not enums) — in this repo they are
`type:'enum'` params **without** `enumImport`.

## Errors

All extend `WebIQError`. `APIStatusError` carries `.statusCode`, `.body`, `.requestId`,
`.traceId`.

| Class | HTTP | Notes |
|-------|------|-------|
| `AuthenticationError` | 401 | Invalid/missing key. |
| `PermissionDeniedError` | 403 | Authn ok, not authorized; check `body.errorCode`. |
| `RateLimitError` | 429 / 430 | **Never auto-retried.** `.retryAfter` (string, e.g. `"60s"`) from the response body. |
| `APIStatusError` | 4xx/5xx | Base for the above. |
| `APIConnectionError` | — | Network/DNS/timeout. |
| `WebIQError` | — | Base. |

Error `body` (when an object) may include: `errorCode`, `errorCategory`,
`technicalDetails`, `traceId`, `retryAfter`. This repo maps all of this in
`server/src/middleware/errorHandler.ts`.

## Telemetry

Pass `telemetryHook: (event: TelemetryEvent) => void`. Each attempt emits
`{ method, path, transport, attempt, statusCode?, requestId?, traceId?, retryAfter?, elapsedMs?, error?, errorBody? }`.
This repo correlates events per-request via `AsyncLocalStorage` (`server/src/telemetry.ts`).

## Cancellation

Every call accepts `options.signal`. On abort, the in-flight request is cancelled, retries
stop, and the signal's `reason` is re-thrown unchanged (no `APIConnectionError` wrapping).
Combine `req`-driven abort with `AbortSignal.timeout(ms)` via `AbortSignal.any([...])` for
a wall-clock budget that includes retries.
