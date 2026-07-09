import { type NextRequest, NextResponse } from "next/server";
import { createPortalSession, PORTAL_SESSION_COOKIE_NAME } from "@/lib/auth/portal-session";
import { getEnvConfig } from "@/lib/config/env.schema";
import { getClientIpWithFreshSettings } from "@/lib/ip";
import { logger } from "@/lib/logger";
import { withAuthResponseHeaders } from "@/lib/security/auth-response-headers";
import { constantTimeEqual } from "@/lib/security/constant-time-compare";
import { createCsrfOriginGuard } from "@/lib/security/csrf-origin-guard";
import { LoginAbusePolicy } from "@/lib/security/login-abuse-policy";

// 需要 Redis 连接（session 存储）
export const runtime = "nodejs";

const csrfGuard = createCsrfOriginGuard({
  allowedOrigins: [],
  allowSameOrigin: true,
  enforceInDevelopment: process.env.VITEST === "true",
});

// 独立于 dashboard 登录的节流器实例，避免互相污染计数
const loginPolicy = new LoginAbusePolicy();

async function resolveClientIp(request: NextRequest): Promise<string> {
  const platformIp = (request as unknown as { ip?: string }).ip;
  if (platformIp) return platformIp;
  return (await getClientIpWithFreshSettings(request.headers)) ?? "unknown";
}

export async function POST(request: NextRequest) {
  const csrfResult = csrfGuard.check(request);
  if (!csrfResult.allowed) {
    return withAuthResponseHeaders(NextResponse.json({ error: "CSRF_REJECTED" }, { status: 403 }));
  }

  const clientIp = await resolveClientIp(request);
  const decision = loginPolicy.check(clientIp);
  if (!decision.allowed) {
    const response = withAuthResponseHeaders(
      NextResponse.json({ error: "Too many attempts", errorCode: "RATE_LIMITED" }, { status: 429 })
    );
    if (decision.retryAfterSeconds != null) {
      response.headers.set("Retry-After", String(decision.retryAfterSeconds));
    }
    return response;
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return withAuthResponseHeaders(
      NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    );
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    loginPolicy.recordFailure(clientIp);
    return withAuthResponseHeaders(
      NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    );
  }

  const env = getEnvConfig();
  const expectedUsername = env.PORTAL_USERNAME;
  const expectedPassword = env.PORTAL_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    logger.error("[PortalLogin] PORTAL_USERNAME/PORTAL_PASSWORD not configured");
    return withAuthResponseHeaders(
      NextResponse.json({ error: "Portal is not configured" }, { status: 503 })
    );
  }

  // 用户名+密码均做常量时间比较，避免用户名枚举 + 密码时序侧信道
  const usernameOk = constantTimeEqual(username, expectedUsername);
  const passwordOk = constantTimeEqual(password, expectedPassword);

  if (!usernameOk || !passwordOk) {
    loginPolicy.recordFailure(clientIp);
    logger.warn("[PortalLogin] Invalid credentials", { clientIp });
    return withAuthResponseHeaders(
      NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    );
  }

  const session = await createPortalSession(expectedUsername);
  if (!session) {
    logger.error("[PortalLogin] Failed to create portal session (Redis unavailable?)");
    return withAuthResponseHeaders(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }

  loginPolicy.recordSuccess(clientIp);
  logger.info("[PortalLogin] Login success", { clientIp });

  const response = withAuthResponseHeaders(NextResponse.json({ ok: true }));
  response.cookies.set(PORTAL_SESSION_COOKIE_NAME, session.sessionId, {
    httpOnly: true,
    secure: env.ENABLE_SECURE_COOKIES,
    sameSite: "lax",
    maxAge: env.PORTAL_SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
