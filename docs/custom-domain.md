# Custom domain on Cloudflare → Azure Container Apps

This guide binds a custom domain (example: **`webiq.isainative.dev`**) to the
Container App, using a **free Azure-managed TLS certificate**. DNS is hosted on
**Cloudflare**.

Azure validates domain ownership and issues the certificate via DNS, so the DNS
records must exist **before** the certificate is provisioned.

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

The custom domain is wired into this repo's infrastructure as code, driven by the
`WEBIQ_CUSTOM_DOMAIN` azd environment variable. Once DNS (Step 1) is in place:

```bash
azd env set WEBIQ_CUSTOM_DOMAIN webiq.isainative.dev
azd provision     # creates the managed certificate (DNS-validated) and binds it
```

`azd provision` blocks until the certificate is issued and bound (typically 2–5 min).

<details>
<summary>Alternative: one-shot Azure CLI (no IaC change)</summary>

```bash
az containerapp hostname bind \
  --hostname webiq.isainative.dev \
  --resource-group rg-webiq-demo \
  --name ca-webiq-demo-wr3bqs \
  --environment cae-webiq-demo-wr3bqs \
  --validation-method CNAME
```

> ⚠️ If you bind with the CLI instead of IaC, a later `azd provision` could drop the
> binding unless `WEBIQ_CUSTOM_DOMAIN` is set (the Bicep is the source of truth here).
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
