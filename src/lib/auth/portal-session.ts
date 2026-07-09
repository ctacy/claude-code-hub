import "server-only";

import { getEnvConfig } from "@/lib/config/env.schema";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";

/**
 * Portal Session — 独立管理门户会话
 *
 * 与现有 dashboard / API Key 认证体系完全隔离：
 * - 账号密码来自环境变量 PORTAL_USERNAME / PORTAL_PASSWORD（明文比对，非哈希）
 * - session token 存 Redis，cookie 名 `portal_session`，与现有 `auth-token` 不同名
 * - 不复用 resolveAuth / AuthTier / AuthSession 等现有认证逻辑
 */

const PORTAL_SESSION_KEY_PREFIX = "cch:portal-session:";
export const PORTAL_SESSION_COOKIE_NAME = "portal_session";

export interface PortalSessionData {
  sessionId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

function toLogError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildSessionKey(sessionId: string): string {
  return `${PORTAL_SESSION_KEY_PREFIX}${sessionId}`;
}

function parsePortalSessionData(raw: string): PortalSessionData | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.sessionId !== "string") return null;
    if (typeof obj.username !== "string") return null;
    if (typeof obj.createdAt !== "number" || !Number.isFinite(obj.createdAt)) return null;
    if (typeof obj.expiresAt !== "number" || !Number.isFinite(obj.expiresAt)) return null;
    return {
      sessionId: obj.sessionId,
      username: obj.username,
      createdAt: obj.createdAt,
      expiresAt: obj.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * 是否已配置门户账号（PORTAL_USERNAME + PORTAL_PASSWORD 均已设置）。
 * 未配置时 /portal/* 应直接拒绝访问，避免空密码意外放行。
 */
export function isPortalConfigured(): boolean {
  const env = getEnvConfig();
  return Boolean(env.PORTAL_USERNAME && env.PORTAL_PASSWORD);
}

/**
 * 校验门户登录凭据。明文比对（env 配置要求），非哈希。
 */
export function verifyPortalCredentials(username: string, password: string): boolean {
  const env = getEnvConfig();
  if (!env.PORTAL_USERNAME || !env.PORTAL_PASSWORD) return false;
  return username === env.PORTAL_USERNAME && password === env.PORTAL_PASSWORD;
}

function getReadyRedis() {
  const redis = getRedisClient({ allowWhenRateLimitDisabled: true });
  if (!redis || redis.status !== "ready") return null;
  return redis;
}

/**
 * 创建门户会话，写入 Redis，TTL 由 PORTAL_SESSION_TTL_SECONDS 控制。
 */
export async function createPortalSession(username: string): Promise<PortalSessionData | null> {
  const redis = getReadyRedis();
  if (!redis) {
    logger.error("[PortalSession] Redis not ready: session not persisted");
    return null;
  }

  const env = getEnvConfig();
  const ttlSeconds = env.PORTAL_SESSION_TTL_SECONDS;
  const createdAt = Date.now();
  const sessionData: PortalSessionData = {
    sessionId: `portal_${globalThis.crypto.randomUUID()}`,
    username,
    createdAt,
    expiresAt: createdAt + ttlSeconds * 1000,
  };

  try {
    await redis.setex(
      buildSessionKey(sessionData.sessionId),
      ttlSeconds,
      JSON.stringify(sessionData)
    );
  } catch (error) {
    logger.error("[PortalSession] Failed to create session", { error: toLogError(error) });
    return null;
  }

  return sessionData;
}

export async function readPortalSession(sessionId: string): Promise<PortalSessionData | null> {
  const redis = getReadyRedis();
  if (!redis) return null;

  try {
    const value = await redis.get(buildSessionKey(sessionId));
    if (!value) return null;
    const parsed = parsePortalSessionData(value);
    if (!parsed) {
      logger.warn("[PortalSession] Invalid session payload", { sessionId });
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error("[PortalSession] Failed to read session", { error: toLogError(error), sessionId });
    return null;
  }
}

export async function revokePortalSession(sessionId: string): Promise<boolean> {
  const redis = getReadyRedis();
  if (!redis) return false;

  try {
    const deleted = await redis.del(buildSessionKey(sessionId));
    return deleted > 0;
  } catch (error) {
    logger.error("[PortalSession] Failed to revoke session", {
      error: toLogError(error),
      sessionId,
    });
    return false;
  }
}
