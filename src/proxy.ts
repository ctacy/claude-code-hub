import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { type Locale, localeCookieName } from "@/i18n/config";
import { getLocaleFromValue, normalizePathnameForLocaleNavigation } from "@/i18n/pathname";
import { routing } from "@/i18n/routing";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { PORTAL_SESSION_COOKIE_NAME } from "@/lib/auth/portal-session";
import { isDevelopment } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";

// Public paths that don't require authentication
// Note: These paths will be automatically prefixed with locale by next-intl middleware
const PUBLIC_PATH_PATTERNS = [
  "/login",
  "/usage-doc",
  "/status",
  "/api/auth/login",
  "/api/auth/logout",
];

// Portal public paths (no portal session required)。注意：matcher 配置排除了所有
// `/api/*` 路径（见文件末尾），中间件不会运行在 `/api/portal/*` 上——那些路由必须在
// 各自 handler 内部自行调用 getPortalSession() 校验，这里仅处理 `/portal/*` 页面路由。
const PORTAL_PUBLIC_PATH_PATTERNS = ["/portal/login"];

const API_PROXY_PATH = "/v1";

function matchesPublicPath(pathname: string, pattern: string) {
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}

// Create next-intl middleware for locale detection and routing
const intlMiddleware = createMiddleware(routing);

function proxyHandler(request: NextRequest) {
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-cch-public-status");
  const sanitizedRequest = {
    ...request,
    headers: requestHeaders,
    cookies: request.cookies,
  } as NextRequest;

  if (isDevelopment()) {
    logger.info("Request received", { method: method.toUpperCase(), pathname });
  }

  // ── Portal 独立门户路由（不走 next-intl locale，不走主系统 auth cookie）──
  // 仅处理 `/portal/*` 页面；`/api/portal/*` 被 matcher 排除，鉴权在各 handler 内自行完成。
  if (pathname.startsWith("/portal")) {
    // 公开路径（登录页、登录/注销 API）无需 session
    if (PORTAL_PUBLIC_PATH_PATTERNS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.next();
    }
    // 其余 portal 路径只检查 cookie 存在性；真正的 session 验证在 layout/page 层完成
    const portalCookie = sanitizedRequest.cookies.get(PORTAL_SESSION_COOKIE_NAME);
    if (!portalCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // API 代理路由不需要 locale 处理和 Web 鉴权（使用自己的 Bearer token）
  if (pathname.startsWith(API_PROXY_PATH)) {
    return NextResponse.next();
  }

  const isLocalePrefixedPublicStatusPath = routing.locales.some(
    (locale) => pathname === `/${locale}/status` || pathname.startsWith(`/${locale}/status/`)
  );
  if (isLocalePrefixedPublicStatusPath) {
    requestHeaders.set("x-cch-public-status", "1");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Skip locale handling for static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Apply locale middleware first (handles locale detection and routing)
  const localeResponse = intlMiddleware(sanitizedRequest);

  const isExplicitPublicStatusPath = pathname === "/status" || pathname.startsWith("/status/");

  if (isExplicitPublicStatusPath) {
    return localeResponse;
  }

  // Extract locale from pathname (format: /[locale]/path or just /path)
  const localeMatch = pathname.match(/^\/([^/]+)/);
  const potentialLocale = localeMatch?.[1];
  const isLocaleInPath = routing.locales.includes(potentialLocale as Locale);

  // Get the pathname without locale prefix
  // When isLocaleInPath is true, potentialLocale is guaranteed to be defined
  const pathWithoutLocale = isLocaleInPath
    ? pathname.slice((potentialLocale?.length ?? 0) + 1)
    : pathname;

  // Check if current path (without locale) is a public path
  const isPublicPath = PUBLIC_PATH_PATTERNS.some((pattern) =>
    matchesPublicPath(pathWithoutLocale, pattern)
  );
  // Public paths don't require authentication
  if (isPublicPath) {
    return localeResponse;
  }

  // Check authentication for protected routes (cookie existence only).
  // Full session validation (Redis lookup, key permissions, expiry) is handled
  // by downstream layouts (dashboard/layout.tsx, etc.) which run in Node.js
  // runtime with guaranteed Redis/DB access. This avoids a death loop where
  // the proxy deletes the cookie on transient validation failures.
  const authToken = sanitizedRequest.cookies.get(AUTH_COOKIE_NAME);

  if (!authToken) {
    // Not authenticated, redirect to login page
    const url = request.nextUrl.clone();
    // Preserve locale in redirect
    const localeFromCookie = getLocaleFromValue(
      sanitizedRequest.cookies.get(localeCookieName)?.value
    );
    const locale = isLocaleInPath ? potentialLocale : localeFromCookie || routing.defaultLocale;
    url.pathname = `/${locale}/login`;
    url.searchParams.set("from", normalizePathnameForLocaleNavigation(pathWithoutLocale));
    return NextResponse.redirect(url);
  }

  // Cookie exists - pass through to layout for full validation
  return localeResponse;
}

// Default export required for Next.js 16 proxy file
export default proxyHandler;

export { matchesPublicPath };

export const config = {
  // KEEP IN SYNC with `src/proxy.matcher.ts` — must be a string literal here
  // so Next.js's build-time static analyzer can collect it. The unit test
  // `tests/unit/proxy-matcher.test.ts` asserts the two stay in sync. See the
  // matcher module for the full per-segment rationale.
  matcher: ["/((?!api|v1(?:/|$)|v1beta(?:/|$)|_next/static|_next/image|favicon.ico).*)"],
};
