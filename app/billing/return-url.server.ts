/**
 * Shopify requires HTTPS return URLs. Behind tunnels/proxies, request.url may be http.
 */
export function getBillingReturnUrl(
  request: Request,
  path = "/app/billing",
): string {
  const qs = new URLSearchParams({ subscribed: "1" });
  const suffix = `${path.startsWith("/") ? path : `/${path}`}?${qs.toString()}`;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${suffix}`;
  }

  const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
  if (appUrl && !appUrl.includes("example.com")) {
    return `${appUrl}${suffix}`;
  }

  const origin = new URL(request.url).origin.replace(/^http:/, "https:");
  return `${origin}${suffix}`;
}
