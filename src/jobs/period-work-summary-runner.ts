// AI Accept 2026-07-12 main v1
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { type PeriodRunResult, runPeriodWorkSummary } from "./period-work-summary";

const JOB_TTL_SECONDS = 3600;
const JOB_KEY = (jobId: string) => `portal:period-summary-job:${jobId}`;

export type PeriodJobStatus = "running" | "done" | "failed";

export interface PeriodJobStatePayload {
  jobId: string;
  status: PeriodJobStatus;
  periodType: "week" | "month" | "year";
  periodStart: string;
  startedAt: string;
  finishedAt?: string;
  result?: PeriodRunResult;
  error?: string;
}

function createRedis() {
  const client = getRedisClient();
  if (!client) {
    throw new Error("Redis 不可用，无法启动后台汇总任务");
  }
  return client;
}

async function writeJobState(jobId: string, payload: PeriodJobStatePayload) {
  const client = createRedis();
  await client.setex(JOB_KEY(jobId), JOB_TTL_SECONDS, JSON.stringify(payload));
}

export async function startPeriodWorkSummaryJob(options: {
  periodType: "week" | "month" | "year";
  periodStart: string;
}): Promise<string> {
  const jobId = randomUUID();

  await writeJobState(jobId, {
    jobId,
    status: "running",
    periodType: options.periodType,
    periodStart: options.periodStart,
    startedAt: new Date().toISOString(),
  });

  void (async () => {
    try {
      const result = await runPeriodWorkSummary(options);
      await writeJobState(jobId, {
        jobId,
        status: "done",
        periodType: options.periodType,
        periodStart: options.periodStart,
        startedAt: "",
        finishedAt: new Date().toISOString(),
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[PeriodWorkSummaryRunner] job failed", { jobId, error: message });
      try {
        await writeJobState(jobId, {
          jobId,
          status: "failed",
          periodType: options.periodType,
          periodStart: options.periodStart,
          startedAt: "",
          finishedAt: new Date().toISOString(),
          error: message,
        });
      } catch (writeError) {
        logger.error("[PeriodWorkSummaryRunner] failed to persist failed state", {
          jobId,
          writeError: String(writeError),
        });
      }
    }
  })();

  return jobId;
}
