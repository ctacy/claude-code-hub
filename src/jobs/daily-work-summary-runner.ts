/**
 * 后台运行 daily-work-summary，把进度/结果写 Redis，
 * 触发接口立刻返回 jobId，前端轮询 GET /trigger?jobId=xxx。
 *
 * 进程生命周期内任务"守护"在 promise rejection 处兜底：
 * 只要进程还在跑（Next.js server 不重启），任务会跑完并写终态到 Redis。
 */

import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { type RunResult, runDailyWorkSummary } from "./daily-work-summary";

const JOB_TTL_SECONDS = 3600; // 1 小时够追状态
const JOB_KEY = (jobId: string) => `portal:summary-job:${jobId}`;

export type JobStatus = "running" | "done" | "failed";

export interface JobStatePayload {
  jobId: string;
  status: JobStatus;
  date: string;
  startedAt: string;
  finishedAt?: string;
  result?: RunResult;
  error?: string;
}

function createRedis() {
  const client = getRedisClient();
  if (!client) {
    throw new Error("Redis 不可用，无法启动后台汇总任务");
  }
  return client;
}

async function writeJobState(jobId: string, payload: JobStatePayload) {
  const client = createRedis();
  await client.setex(JOB_KEY(jobId), JOB_TTL_SECONDS, JSON.stringify(payload));
}

export async function startDailyWorkSummaryJob(options?: {
  dateOverride?: string;
}): Promise<string> {
  const jobId = randomUUID();

  // 启动时即落库 running 状态，便于前端轮询拿到启动时刻
  await writeJobState(jobId, {
    jobId,
    status: "running",
    date: options?.dateOverride ?? "yesterday",
    startedAt: new Date().toISOString(),
  });

  // 后台跑 —— 不 await（关键：触发接口立即返回）
  void (async () => {
    try {
      const result = await runDailyWorkSummary({ dateOverride: options?.dateOverride });
      await writeJobState(jobId, {
        jobId,
        status: "done",
        date: result.dateStr,
        startedAt: "",
        finishedAt: new Date().toISOString(),
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[DailyWorkSummaryRunner] job failed", { jobId, error: message });
      try {
        await writeJobState(jobId, {
          jobId,
          status: "failed",
          date: options?.dateOverride ?? "yesterday",
          startedAt: "",
          finishedAt: new Date().toISOString(),
          error: message,
        });
      } catch (writeError) {
        logger.error("[DailyWorkSummaryRunner] failed to persist failed state", {
          jobId,
          writeError: String(writeError),
        });
      }
    }
  })();

  return jobId;
}
