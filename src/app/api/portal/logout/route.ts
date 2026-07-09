import { type NextRequest, NextResponse } from "next/server";
import { PORTAL_SESSION_COOKIE_NAME, revokePortalSession } from "@/lib/auth/portal-session";
import { withAuthResponseHeaders } from "@/lib/security/auth-response-headers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(PORTAL_SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await revokePortalSession(sessionId).catch(() => {});
  }

  const response = withAuthResponseHeaders(NextResponse.json({ ok: true }));
  response.cookies.set(PORTAL_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
