# Cloudflare DNS Setup for equityinvestmentgroup.club

## Required DNS Records

After deploying to GCP Cloud Run, add these records in Cloudflare:

### A / CNAME Records
| Type  | Name | Target | Proxy | TTL |
|-------|------|--------|-------|-----|
| CNAME | @    | eig-platform-HASH-uc.a.run.app | Proxied (orange) | Auto |
| CNAME | www  | equityinvestmentgroup.club | Proxied (orange) | Auto |

> Replace `eig-platform-HASH-uc.a.run.app` with your actual Cloud Run service URL.
> Get it with: `gcloud run services describe eig-platform --region=us-central1 --format="value(status.url)"`

### Page Rules (or Transform Rules)
1. **www redirect**: `www.equityinvestmentgroup.club/*` → 301 to `https://equityinvestmentgroup.club/$1`

### SSL/TLS Settings
- Mode: **Full (strict)** — Cloud Run serves HTTPS
- Always Use HTTPS: **On**
- Minimum TLS Version: **TLS 1.2**
- HSTS: Enabled with 1-year max-age, includeSubDomains, preload

### Cloudflare Cache Settings
- Cache Level: Standard
- Browser Cache TTL: 1 hour for HTML, 1 year for static assets (_next/static)
- Cache Rules for static assets: `equityinvestmentgroup.club/_next/static/*` → Edge TTL 1 year

### Firewall / Security
- Bot Fight Mode: On
- Security Level: Medium

## Verifying Setup
After DNS propagation (~5 minutes with Cloudflare proxy):
```bash
curl -I https://equityinvestmentgroup.club
# Should return: HTTP/2 200, x-powered-by: Next.js
```
