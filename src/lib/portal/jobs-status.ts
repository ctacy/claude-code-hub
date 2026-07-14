// AI Accept 2026-07-14 main v1
import "server-only";

import type { JobStatePayload } from "@/jobs/daily-work-summary-runner";
import type { PeriodJobStatePayload } from "@/jobs/period-work-summary-runner";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis/client";
import { scanPattern } from "@/lib/redis/scan-helper";

export type PortalJobData = JobStatePayload | PeriodJobStatePayload;

/**
 * Returns the timestamp to sort by: prefer finishedAt, fall back to startedAt.
 * The runner overwrites startedAt with "" on done/failed states, so finishedAt
 * is the authoritative recency signal for completed jobs.
 */
function getJobTimestamp(job: PortalJobData): string {
  return job.finishedAt ?? job.startedAt ?? "";
}

export async function getLatestPortalJob(prefix: "summary"): Promise<JobStatePayload | null>;
export async function getLatestPortalJob(
  prefix: "period-summary"
): Promise<PeriodJobStatePayload | null>;
export async function getLatestPortalJob(
  prefix: "summary" | "period-summary"
): Promise<PortalJobData | null> {
  const redis = getRedisClient({ allowWhenRateLimitDisabled: true });
  if (!redis || redis.status !== "ready") {
    return null;
  }

  let keys: string[];
  try {
    keys = await scanPattern(redis, `portal:${prefix}-job:*`);
  } catch (error) {
    logger.error("[getLatestPortalJob] SCAN failed", {
      prefix,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (keys.length === 0) {
    return null;
  }

  let rawValues: (string | null)[];
  try {
    rawValues = await redis.mget(keys);
  } catch (error) {
    logger.error("[getLatestPortalJob] MGET failed", {
      prefix,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const jobs: PortalJobData[] = [];
  for (const raw of rawValues) {
    if (!raw) continue;
    try {
      jobs.push(JSON.parse(raw) as PortalJobData);
    } catch {
      // skip malformed entries
    }
  }

  if (jobs.length === 0) {
    return null;
  }

  // Sort descending by most recent activity timestamp
  jobs.sort((a, b) => {
    const ta = getJobTimestamp(a);
    const tb = getJobTimestamp(b);
    return tb.localeCompare(ta);
  });

  return jobs[0] ?? null;
}
