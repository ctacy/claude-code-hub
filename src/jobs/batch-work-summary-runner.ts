// AI Accept 2026-07-14 main v1
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { runDailyWorkSummaryForUsers, runPeriodWorkSummaryForUsers } from "./batch-work-summary";
import type { RunResult } from "./daily-work-summary";
import type { PeriodRunResult } from "./period-work-summary";

const JOB_TTL_SECONDS = 3600;
const JOB_KEY = (jobId: string) => `portal:batch-summary-job:${jobId}`;

export type BatchJobStatus = "running" | "done" | "failed";

export interface BatchJobStatePayload {
  jobId: string;
  status: BatchJobStatus;
  period: string;
  periodStart: string;
  userCount: number;
  startedAt: string;
  finishedAt?: string;
  result?: RunResult | PeriodRunResult;
  error?: string;
}

function createRedis() {
  const client = getRedisClient();
  if (!client) {
    throw new Error("Redis 不可用，无法启动批量汇总任务");
  }
  return client;
}

async function writeJobState(jobId: string, payload: BatchJobStatePayload) {
  const client = createRedis();
  await client.setex(JOB_KEY(jobId), JOB_TTL_SECONDS, JSON.stringify(payload));
}

export async function startBatchWorkSummaryJob(options: {
  userNames: string[];
  period: "day" | "week" | "month" | "year";
  periodStart: string;
}): Promise<string> {
  const jobId = randomUUID();
  const { userNames, period, periodStart } = options;

  await writeJobState(jobId, {
    jobId,
    status: "running",
    period,
    periodStart,
    userCount: userNames.length,
    startedAt: new Date().toISOString(),
  });

  void (async () => {
    try {
      let result: RunResult | PeriodRunResult;
      if (period === "day") {
        result = await runDailyWorkSummaryForUsers(periodStart, userNames);
      } else {
        result = await runPeriodWorkSummaryForUsers(period, periodStart, userNames);
      }
      await writeJobState(jobId, {
        jobId,
        status: "done",
        period,
        periodStart,
        userCount: userNames.length,
        startedAt: "",
        finishedAt: new Date().toISOString(),
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[BatchWorkSummaryRunner] job failed", { jobId, error: message });
      try {
        await writeJobState(jobId, {
          jobId,
          status: "failed",
          period,
          periodStart,
          userCount: userNames.length,
          startedAt: "",
          finishedAt: new Date().toISOString(),
          error: message,
        });
      } catch (writeError) {
        logger.error("[BatchWorkSummaryRunner] failed to persist failed state", {
          jobId,
          writeError: String(writeError),
        });
      }
    }
  })();

  return jobId;
}
