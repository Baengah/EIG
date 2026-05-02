/**
 * Cloudflare Worker — EIG Platform Edge Handler
 * Proxies equityinvestmentgroup.club to GCP Cloud Run
 * Adds security headers and handles www redirect.
 */

const CLOUD_RUN_ORIGIN = "https://eig-platform-HASH-uc.a.run.app"; // Replace with actual URL

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://*.supabase.co https://*.supabase.com`,
    "img-src 'self' data: https://*.supabase.co blob:",
    "frame-ancestors 'none'",
  ].join("; "),
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Redirect www to apex domain
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.replace(/^www\./, "");
      return Response.redirect(url.toString(), 301);
    }

    // Proxy request to Cloud Run
    const origin = env.CLOUD_RUN_ORIGIN || CLOUD_RUN_ORIGIN;
    const proxyUrl = new URL(url.pathname + url.search, origin);

    const proxyRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    // Add forwarded-for headers
    proxyRequest.headers.set("X-Forwarded-Host", url.hostname);
    proxyRequest.headers.set("X-Forwarded-Proto", "https");

    const response = await fetch(proxyRequest);

    // Clone response and add security headers
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
