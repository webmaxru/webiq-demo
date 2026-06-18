# Documentation

Technical documentation for the Web IQ Sandbox.

| Doc | What's inside |
|-----|---------------|
| [architecture.md](./architecture.md) | Solution architecture: monorepo layout, backend/frontend responsibilities, the declarative-descriptor extensibility model, request flow, config. |
| [webiq-sdk.md](./webiq-sdk.md) | Condensed `@microsoft/webiq` reference: client, all 6 endpoints with options/result shapes, enums, errors, telemetry, cancellation. |
| [deployment.md](./deployment.md) | Azure Container Apps deployment: live environment + resource names, cost model (scale-to-zero), Bicep infra, azd env vars, deploy/redeploy/teardown, container build. |
| [custom-domain.md](./custom-domain.md) | Binding a custom domain on **Cloudflare** → Azure Container Apps with a free managed TLS cert: DNS records, grey/orange proxy, Full(strict) SSL, two-phase binding, troubleshooting. |

For the **gotchas and hard-won lessons** (the things that cost the most time to figure
out), see [.github/copilot-instructions.md](../.github/copilot-instructions.md).

## Quick links

- **Live app:** https://webiq.isainative.dev
- **Repo:** https://github.com/webmaxru/webiq-demo
- **Web IQ:** https://www.microsoft.com/en-us/webiq · SDK: [`@microsoft/webiq`](https://www.npmjs.com/package/@microsoft/webiq)
