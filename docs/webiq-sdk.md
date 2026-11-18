# Web IQ SDK reference

The sandbox uses `@microsoft/webiq` **1.2.1** (Node 22.13+ or >= 24), verified against the
published TypeScript declarations and the November 2026 Microsoft Learn references.
The package supports CommonJS and ESM. Search base URL: `https://api.microsoft.ai/v3`.

## Sandbox capabilities

| Sandbox entry | SDK method | Result |
| --- | --- | --- |
| Auto | `client.auto.search(question, options)` | `results[]`, each with `evidence` and its own `citations[]` |
| Weather & Time Zones | `client.auto.search(question, options)` | Auto preset with `responseFilter: ['weather', 'timezone']` |
| Places | `client.places.search(query, options)` | `placeResults[]` |
| Web / News | `client.web.search` / `client.news.search` | `webResults[]` / `newsResults[]` |
| Videos / Images | `client.videos.search` / `client.images.search` | `videoResults[]` / `imageResults[]` |
| Browse | `client.browse.fetch(url, options)` | `content`, or `retryAfter` for a pending crawl |
| Commerce Search (private preview) | `client.commerce.search(query, options)` | `products[]` with offer arrays |
| Commerce Offers (private preview) | `client.commerce.fetchOffers(options)` | `offers[]` |
| Product Details (private preview) | `client.commerce.fetchDetails(options)` | `products[]` with description/rating |

Classic Search is no longer exported by this SDK; Auto replaces it in the sandbox.
The Weather entry is a preset, not a separate Weather API. No LLM is called: all
displayed text is retrieved evidence, not a generated final answer.

## Auto

`AutoMode.LITE` (default) prioritizes speed. `AutoMode.ADVANCED` performs additional
retrieval passes. Both are generally available from November 17, 2026. A question
is at most 1,000 characters. `maxResponseLength` (1,500-500,000, default 30,000)
controls web content, not the entire response; passage-only AppIDs are capped at
30,000. `maxCitations` is 1-50. The sandbox exposes the documented eligible answer
types: `web`, `news`, `timezone`, `weather`, `images`, `videos`.

Evidence discriminators differ from those categories: `text`, `text/news`,
`media/image`, `media/video`, `structured/weather`, `structured/timeZone`.
Keep citations associated with their evidence item. Structured fields and lists
can be absent. Read weather numbers with their returned `units`, preserve zero
measurements, and do not assume time-zone strings are bare ISO timestamps.

SDK 1.2.1's Auto resource forwards all option fields, but its declared
`AutoSearchOptions` omits the documented scope/site fields. The sandbox uses its
validated descriptor options and tests the actual SDK wire payload. Generated
examples assign options to a variable before passing them to the SDK, avoiding
an inline excess-property error while preserving the documented fields.

## Passages and existing endpoints

Web and News default to `ContentFormat.PASSAGE` with `maxLength: 3000`.
Browse uses `BrowseContentFormat.PASSAGE` and requires a nonblank selection
`query` of at most 1,000 characters. Text, HTML and Markdown require full document
access on the server AppID; otherwise the service returns 403.

Browse exposes only the documented `LiveCrawlMode.NONE` and `FALLBACK`, not the
older `force` setting. Dynamic rendering requires fallback. A 202 response has
`retryAfter` as an ISO UTC timestamp: retry manually then, not in an automatic loop.

News freshness filters **discovery date**, supports relative periods or ISO date
intervals with `..` boundaries, has a 12-hour tolerance, and does not extend its
30-day retention. Videos accept week/month/year or date intervals, not day.
Places `maxResults` is 1-10. Other result limits remain Web 50, News 20, Images
30, Videos 30. Web also exposes strict/off SafeSearch.

## Scopes and site filters

Web, News and Auto accept a pre-created `scopeName` plus
`failOnMissingScope` (sandbox and service default **true**). Auto scopes affect
only Web and News; use `responseFilter: ['web', 'news']` if all evidence must
be scoped. A reported `scopeApplied: false` is visibly flagged; an absent field
does not prove application. `true` does not prove the latest definition propagated.

Manage scopes through the portal or a separately authorized billing-account
management identity, never through this public demo's runtime key. Names are
1-128 ASCII letters/digits/periods/underscores/hyphens. Propagation typically takes
10-30 minutes. Web and Auto also expose inline include/exclude site arrays;
at most 250 entries, paths limited to two segments, exclusions take precedence.

## Commerce requirements

The AppID must have private-preview access. Supported markets are en-US, es-US,
en-CA, fr-CA, en-GB, de-DE, fr-FR, en-AU and ja-JP. Search returns product `id`,
`skuId` and offer `id`; pass all available identifiers for Offers, and product/SKU
identifiers for Details. Unknown IDs can return an empty successful list.

Prices are in ISO 4217 **minor units**, including currencies without two decimal
places. Every displayed offer link uses the exact response `clickUrl`, preserving
attribution and escaping only for HTML. `displayUrl` is never a navigation target.
Offers without a usable HTTP(S) `clickUrl` are not displayed. Raw JSON remains
available for inspection.

## Access, logging, cancellation and errors

The API key is server-only. Premium Content/licensed data and Zero Query Logging
require arrangements with Microsoft; they are not per-query toggles. Health-aware
ranking is automatic, not a medical-advice feature. Do not enter personal health
information. Sandbox analytics opt-out is separate from Microsoft service logging.

All invocations receive `AbortSignal` and a 60-second default wall-clock budget
(configurable with `WEBIQ_TIMEOUT_MS`). Rate-limit errors (429/430) are never
automatically retried; display `retryAfter`. Error class/status/body/trace IDs
and SDK per-attempt telemetry retain the existing sandbox contract.

## Official references

- [Ignite announcement](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/whats-new-with-web-iq-ignite-2026-edition/4574183)
- [API endpoints](https://learn.microsoft.com/web-iq/reference/endpoints)
- [Auto](https://learn.microsoft.com/web-iq/reference/auto), [Places](https://learn.microsoft.com/web-iq/reference/places), [Commerce](https://learn.microsoft.com/web-iq/reference/commerce)
- [Web](https://learn.microsoft.com/web-iq/reference/web-search), [News](https://learn.microsoft.com/web-iq/reference/news-search), [Browse](https://learn.microsoft.com/web-iq/reference/browse)
- [Scopes](https://learn.microsoft.com/web-iq/guides/create-scopes)
- [SDKs](https://learn.microsoft.com/web-iq/integrations/sdk), [MCP](https://learn.microsoft.com/web-iq/integrations/mcp)
- [Pricing](https://learn.microsoft.com/web-iq/resources/pricing), [privacy/logging FAQ](https://learn.microsoft.com/web-iq/resources/faq#privacy-and-data-handling)
