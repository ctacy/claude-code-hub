import "server-only";

import { cookies } from "next/headers";
import {
  PORTAL_SESSION_COOKIE_NAME,
  type PortalSessionData,
  readPortalSession,
} from "./portal-session";

/**
 * 服务端组件/页面专用：读取并验证 portal_session cookie（含 Redis 校验）。
 * 与 proxy.ts 中间件不同——中间件只检查 cookie 是否存在，这里做完整校验。
 */
export async function getPortalSession(): Promise<PortalSessionData | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(PORTAL_SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await readPortalSession(sessionId);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) return null;

  return session;
}
