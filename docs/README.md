# Documentation

Technical documentation for the Web IQ Sandbox.

| Doc | What's inside |
|-----|---------------|
| [architecture.md](./architecture.md) | Solution architecture: monorepo layout, backend/frontend responsibilities, the declarative-descriptor extensibility model, request flow, config. |
| [webiq-sdk.md](./webiq-sdk.md) | Condensed `@microsoft/webiq` reference: client, all 6 endpoints with options/result shapes, enums, errors, telemetry, cancellation. |
| [deployment.md](./deployment.md) | Azure Static Web Apps + Container Apps deployment, resource names, scale-to-zero cost model, Bicep, CI/CD, and operations. |
| [custom-domain.md](./custom-domain.md) | Moving the Cloudflare hostname from ACA to Static Web Apps, including CNAME, TLS, CORS, and validation. |

For the **gotchas and hard-won lessons** (the things that cost the most time to figure
out), see [.github/copilot-instructions.md](../.github/copilot-instructions.md).

## Quick links

- **Live app:** https://webiq.isainative.dev
- **Generated SWA fallback:** https://delightful-cliff-0ee0ef20f.2.azurestaticapps.net
- **Repo:** https://github.com/webmaxru/webiq-demo
- **Web IQ:** https://www.microsoft.com/en-us/webiq · SDK: [`@microsoft/webiq`](https://www.npmjs.com/package/@microsoft/webiq)
