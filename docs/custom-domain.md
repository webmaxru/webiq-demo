# Move the Cloudflare domain from ACA to Azure Static Web Apps

The public React frontend now belongs on **Azure Static Web Apps (SWA)**. The Container
App remains the API origin on its generated `*.azurecontainerapps.io` hostname and scales
to zero while idle.

## Cut over `webiq.isainative.dev`

### 1. Provision and deploy SWA before changing DNS

Leave `WEBIQ_FRONTEND_CUSTOM_DOMAIN` empty for the first provision:

```bash
azd env set WEBIQ_FRONTEND_CUSTOM_DOMAIN ""
azd provision
gh workflow run "Deploy to Azure" --ref main
```

Get the generated frontend URL:

```bash
azd env get-value WEBIQ_STATIC_WEB_APP_URL
```

It has the form `https://<generated-name>.azurestaticapps.net`. Confirm that URL loads
before changing Cloudflare.

### 2. Change the Cloudflare record

In Cloudflare → **isainative.dev** → **DNS**, edit the existing `webiq` record:

| Setting | Old value | New value |
|---------|-----------|-----------|
| Type | `CNAME` | `CNAME` |
| Name | `webiq` | `webiq` |
| Target | `ca-webiq-demo-....azurecontainerapps.io` | `<generated-name>.azurestaticapps.net` |
| Proxy status | DNS only | **DNS only (grey cloud)** |
| TTL | Auto | Auto |

Do not include `https://` or a path in the CNAME target. Remove any competing `A` or
`AAAA` record for `webiq`. The old `asuid.webiq` TXT record belonged to ACA validation
and can be removed after the SWA domain is healthy.

Verify the public DNS answer:

```bash
nslookup -type=CNAME webiq.isainative.dev
```

### 3. Bind the hostname to SWA and update API CORS

After the CNAME resolves to SWA:

```bash
azd env set WEBIQ_FRONTEND_CUSTOM_DOMAIN webiq.isainative.dev

# The public hostname no longer belongs to ACA.
azd env set WEBIQ_CUSTOM_DOMAIN ""
azd env set WEBIQ_BIND_CERT false

azd provision
gh workflow run "Deploy to Azure" --ref main
```

The Bicep custom-domain resource uses CNAME delegation. SWA validates the record and
provisions a free TLS certificate. The same provision adds both the generated SWA origin
and `https://webiq.isainative.dev` to ACA's CORS allowlist.

> `azd provision` applies ACA's bootstrap image, so rerun the deployment workflow after
> every infrastructure provision to restore the application image and frontend artifact.

### 4. Validate the cutover

```bash
curl -I https://webiq.isainative.dev
curl https://ca-webiq-demo-wr3bqs.delightfulhill-9c37dc23.eastus2.azurecontainerapps.io/api/health
```

Open `https://webiq.isainative.dev`, run a request, and confirm the browser does not show
a CORS error. After ACA has been idle, a request taking more than five seconds should
show “Application is starting”.

### 5. Optional Cloudflare proxy

Keep the record **DNS only** until Azure reports the custom domain as validated and HTTPS
works. You can then enable the orange-cloud proxy if desired and set Cloudflare
**SSL/TLS encryption mode** to **Full (strict)**. Do not use Flexible mode.

---

## Optional dedicated custom domain for the ACA backend

The remaining instructions apply only if the API itself needs a separate hostname such
as `api.example.com`. The frontend does not require an ACA custom domain.

Azure validates domain ownership and issues the certificate via DNS, so the DNS records
must exist before the certificate is provisioned.

## Values for this deployment

| Item | Value |
|------|-------|
| Custom domain | `webiq.isainative.dev` |
| CNAME target (app FQDN) | `ca-webiq-demo-wr3bqs.delightfulhill-9c37dc23.eastus2.azurecontainerapps.io` |
| Domain verification ID (`asuid` TXT value) | `5BFCC063D1C3C26567C5CE072026BB5CE03258385AE700DF177521A0BEF0DA62` |
| Container Apps env inbound IP (apex fallback) | `68.220.145.84` |

> The verification ID is `containerApp.properties.customDomainVerificationId`. Re-fetch
> it any time with the Azure Portal (Container App → Custom domains) or the REST/CLI API.

---

## Step 1 — Configure Cloudflare DNS

In the Cloudflare dashboard → **`isainative.dev`** zone → **DNS → Records**:

1. **⚠️ Remove the stale record.** There is currently an **A record** `webiq` →
   `4.153.175.99` that does **not** point to this app. Delete it (a name can't have both
   an A and a CNAME record).

2. **Add the CNAME** (routes traffic to the app):

   | Type | Name | Target | Proxy status | TTL |
   |------|------|--------|--------------|-----|
   | CNAME | `webiq` | `ca-webiq-demo-wr3bqs.delightfulhill-9c37dc23.eastus2.azurecontainerapps.io` | **DNS only (grey cloud)** | Auto |

3. **Add the ownership TXT** (`asuid.` + subdomain):

   | Type | Name | Content | Proxy status | TTL |
   |------|------|---------|--------------|-----|
   | TXT | `asuid.webiq` | `5BFCC063D1C3C26567C5CE072026BB5CE03258385AE700DF177521A0BEF0DA62` | n/a (TXT is never proxied) | Auto |

> **🔑 The proxy must be OFF (grey cloud) during certificate issuance.** Azure validates
> the domain by reading the CNAME and issues the managed cert via an HTTP/TLS challenge
> that must reach Azure directly. If Cloudflare proxies (orange cloud), it hides the
> CNAME and intercepts the challenge, and issuance fails. You can switch the CNAME to
> proxied **after** the certificate is issued (see Step 3).

Wait for DNS to propagate (usually < 1–2 min on Cloudflare). Verify:

```bash
nslookup -type=CNAME webiq.isainative.dev
nslookup -type=TXT asuid.webiq.isainative.dev
```

---

## Step 2 — Bind the domain + issue the managed certificate (Azure)

> ⚠️ **Ordering matters (two phases).** Azure won't create the managed certificate until
> the hostname is already bound to the app, and an `SniEnabled` binding can't be created
> until the certificate exists. So a single pass is impossible — it's always:
> **(1) bind hostname as `Disabled` → (2) create managed cert → (3) switch binding to `SniEnabled`.**

This repo's Bicep encodes that two-phase flow via two azd variables:
`WEBIQ_CUSTOM_DOMAIN` (the hostname) and `WEBIQ_BIND_CERT` (`false` = phase 1,
`true` = phase 2). Once DNS (Step 1) is in place:

```bash
azd env set WEBIQ_CUSTOM_DOMAIN webiq.isainative.dev

# Phase 1 — register the hostname (binding type Disabled)
azd env set WEBIQ_BIND_CERT false
azd provision

# Phase 2 — issue the managed cert (DNS-validated) and switch to SniEnabled
azd env set WEBIQ_BIND_CERT true
azd provision

# Re-roll the real image — `azd provision` resets it to the placeholder (see below)
IMAGE=ghcr.io/webmaxru/webiq-demo
APP=$(az containerapp list -g rg-webiq-demo --query "[?tags.\"azd-service-name\"=='app'].name | [0]" -o tsv)
az containerapp update -n $APP -g rg-webiq-demo --image $IMAGE:latest
```

> ⚠️ `azd provision` re-applies the Bicep, which resets the container image to the
> public placeholder. Afterwards restore the real image — push to `main` (CI rebuilds and
> rolls it) or run the `az containerapp update` step above. Certificate issuance via CNAME
> validation typically takes 3–8 minutes; the app keeps serving on its default
> `*.azurecontainerapps.io` hostname throughout.

<details>
<summary>Alternative: Azure CLI one-shot (handles both phases)</summary>

```bash
az containerapp hostname add \
  --hostname webiq.isainative.dev \
  --resource-group rg-webiq-demo \
  --name ca-webiq-demo-wr3bqs

az containerapp hostname bind \
  --hostname webiq.isainative.dev \
  --resource-group rg-webiq-demo \
  --name ca-webiq-demo-wr3bqs \
  --environment cae-webiq-demo-wr3bqs \
  --validation-method CNAME
```

`az containerapp hostname bind` performs the add → managed-cert → SNI-enable sequence
for you, and does **not** reset the image (no image re-roll needed afterwards).
</details>

Verify it serves:

```bash
curl -s https://webiq.isainative.dev/api/health
# {"status":"ok",...}
```

---

## Step 3 — (Optional) Enable the Cloudflare proxy (orange cloud)

After the Azure certificate shows **Succeeded**, you may turn the CNAME's proxy **on**
to gain Cloudflare's CDN, WAF, caching, and analytics:

1. DNS → the `webiq` CNAME → set **Proxy status = Proxied (orange cloud)**.
2. SSL/TLS → **Overview** → set the encryption mode to **Full (strict)**.
   - *Full (strict)* makes Cloudflare connect to Azure over HTTPS and validate the
     Azure-managed certificate end-to-end. Do **not** use *Flexible* (it would talk to
     Azure over HTTP, but the app forces HTTPS — causing a redirect loop).
3. Leave the **Host header** unchanged. Cloudflare forwards `Host: webiq.isainative.dev`,
   which the Container App now accepts because the domain is bound. No Host override or
   Transform Rule is needed.

> The Azure-managed certificate auto-renews. Keeping the binding in Azure (even when
> proxied) means TLS works whether or not Cloudflare is in front.

### Proxied vs. DNS-only — quick comparison

| | DNS only (grey) | Proxied (orange) |
|--|------------------|------------------|
| TLS terminated by | Azure (managed cert) | Cloudflare edge (+ Azure origin in Full strict) |
| CDN / cache / WAF | ❌ | ✅ |
| Hides origin IP | ❌ | ✅ |
| Required during cert issuance | ✅ | ❌ (must be grey) |

---

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Cert stuck in *Pending* / validation fails | CNAME proxied (orange) — set to **DNS only** during issuance; confirm the `asuid.webiq` TXT value matches the verification ID exactly. |
| `404` / wrong app on the custom domain | The binding hasn't completed, or a stale A record still exists — remove `webiq → 4.153.175.99`. |
| Redirect loop after enabling proxy | Cloudflare SSL mode is *Flexible* — change to **Full (strict)**. |
| Works on grey, breaks on orange | SSL mode not *Full (strict)*, or an old/expired edge setting — re-check SSL/TLS overview. |
| Apex/root domain instead of a subdomain | Use an **A record** to `68.220.145.84` (or Cloudflare CNAME flattening) + the `asuid` TXT, and bind with `--validation-method TXT`/`HTTP`. |
| Managed cert stuck in *Pending* forever (no error) | The Container App's `provisioningState` is `Failed` (often left over from an earlier failed deployment). Cert validation won't complete while the app is `Failed`. Re-apply a clean app update to return it to `Succeeded`, then recreate the cert. Avoid PUTting computed/read-only fields (e.g. `latestRevisionFqdn`, `outboundIpAddresses`) back into the app — that can re-trigger `Failed`. |
