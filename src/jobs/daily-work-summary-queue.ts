/**
 * daily-work-summary Bull 队列 — 每天本地时间 0:30 触发按用户按日 AI 工作总结
 *
 * 复用 log-cleanup 队列的 Redis 连接/TLS 解析模式（见 src/lib/log-cleanup/cleanup-queue.ts）
 */
import type { Job } from "bull";
import Queue from "bull";
import { logger } from "@/lib/logger";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { runDailyWorkSummary } from "./daily-work-summary";

const CRON_SCHEDULE = "30 0 * * *"; // 每天本地时间 0:30（由 TZ env 决定时区解释）

let _dailySummaryQueue: Queue.Queue | null = null;

function getDailySummaryQueue(): Queue.Queue {
  if (_dailySummaryQueue) {
    return _dailySummaryQueue;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.error({
      action: "daily_summary_queue_init_error",
      error: "REDIS_URL environment variable is not set",
    });
    throw new Error("REDIS_URL environment variable is required for daily summary queue");
  }

  const useTls = redisUrl.startsWith("rediss://");
  const redisQueueOptions: Queue.QueueOptions["redis"] = {};

  try {
    const url = new URL(redisUrl);
    redisQueueOptions.host = url.hostname;
    redisQueueOptions.port = parseInt(url.port || "6379", 10);
    redisQueueOptions.password = url.password;
    redisQueueOptions.username = url.username;

    if (useTls) {
      const rejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false";
      redisQueueOptions.tls = {
        host: url.hostname,
        servername: url.hostname,
        rejectUnauthorized,
      };
    }
  } catch (e) {
    logger.error("[DailySummaryQueue] Failed to parse REDIS_URL, connection will fail:", e);
    throw new Error("Invalid REDIS_URL format");
  }

  _dailySummaryQueue = new Queue("daily-work-summary", {
    redis: redisQueueOptions,
    defaultJobOptions: {
      attempts: 1, // 单用户失败已在 runDailyWorkSummary 内部处理，job 级不重试避免重复计费
      removeOnComplete: 30,
      removeOnFail: 30,
    },
  });

  setupQueueProcessor(_dailySummaryQueue);

  logger.info({ action: "daily_summary_queue_initialized" });

  return _dailySummaryQueue;
}

function setupQueueProcessor(queue: Queue.Queue): void {
  queue.process(async (job: Job) => {
    logger.info({ action: "daily_summary_job_start", jobId: job.id });
    const result = await runDailyWorkSummary();
    logger.info({ action: "daily_summary_job_complete", jobId: job.id, ...result });
    return result;
  });

  queue.on("failed", (job: Job, err: Error) => {
    logger.error({
      action: "daily_summary_job_failed",
      jobId: job.id,
      error: err.message,
    });
  });
}

/**
 * 注册每日总结定时任务（幂等：先清空旧的 repeatable job 再重新添加）
 */
export async function scheduleDailyWorkSummary(): Promise<void> {
  try {
    const queue = getDailySummaryQueue();

    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }

    // 与 daily-leaderboard 等现有定时任务保持一致：cron 携带系统配置时区（system_settings.timezone
    // 优先，env TZ 兜底），而非依赖进程本地时区，避免"系统设置的时区"与"触发时刻"错位。
    const tz = await resolveSystemTimezone();

    await queue.add(
      "daily-work-summary",
      {},
      {
        repeat: { cron: CRON_SCHEDULE, tz },
      }
    );

    logger.info({ action: "daily_summary_scheduled", cron: CRON_SCHEDULE, tz });
  } catch (error) {
    logger.error({
      action: "schedule_daily_summary_error",
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail Open: 调度失败不影响应用启动
  }
}

export async function stopDailySummaryQueue(): Promise<void> {
  if (_dailySummaryQueue) {
    await _dailySummaryQueue.close();
    logger.info({ action: "daily_summary_queue_closed" });
  }
}
