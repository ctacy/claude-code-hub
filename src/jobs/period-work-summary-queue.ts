/**
 * period-work-summary Bull 队列
 * - 周汇总：每周一 01:00（日报 0:30 跑完后聚合上周）
 * - 月汇总：每月 1 日 01:30
 * - 年汇总：每年 1 月 1 日 02:00
 */
import type { Job } from "bull";
import Queue from "bull";
import {
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { logger } from "@/lib/logger";
import { resolveSystemTimezone } from "@/lib/utils/timezone";
import { runPeriodWorkSummary } from "./period-work-summary";

type PeriodJobData = {
  periodType: "week" | "month" | "year";
  periodStart: string;
};

let _periodSummaryQueue: Queue.Queue | null = null;

function buildRedisOptions(): Queue.QueueOptions["redis"] {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for period summary queue");

  const opts: Queue.QueueOptions["redis"] = {};
  const url = new URL(redisUrl);
  opts.host = url.hostname;
  opts.port = parseInt(url.port || "6379", 10);
  opts.password = url.password;
  opts.username = url.username;

  if (redisUrl.startsWith("rediss://")) {
    const rejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false";
    opts.tls = { host: url.hostname, servername: url.hostname, rejectUnauthorized };
  }
  return opts;
}

function getPeriodSummaryQueue(): Queue.Queue {
  if (_periodSummaryQueue) return _periodSummaryQueue;

  _periodSummaryQueue = new Queue("period-work-summary", {
    redis: buildRedisOptions(),
    defaultJobOptions: { attempts: 1, removeOnComplete: 10, removeOnFail: 10 },
  });

  _periodSummaryQueue.process("period-work-summary", async (job: Job<PeriodJobData>) => {
    logger.info({ action: "period_summary_job_start", jobId: job.id, ...job.data });
    const tz = await resolveSystemTimezone();
    // periodStart 在 job 触发时动态计算（不依赖 queue.add 时的快照）
    const periodStart = computePreviousPeriodStart(job.data.periodType, tz);
    const result = await runPeriodWorkSummary({ periodType: job.data.periodType, periodStart });
    logger.info({ action: "period_summary_job_complete", jobId: job.id, ...result });
    return result;
  });

  _periodSummaryQueue.on("failed", (job: Job, err: Error) => {
    logger.error({ action: "period_summary_job_failed", jobId: job.id, error: err.message });
  });

  logger.info({ action: "period_summary_queue_initialized" });
  return _periodSummaryQueue;
}

/** 计算上周/上月/上年的 periodStart（以系统时区今日为参考点） */
function computePreviousPeriodStart(type: "week" | "month" | "year", tz: string): string {
  const now = toZonedTime(new Date(), tz);
  switch (type) {
    case "week": {
      const prevWeekEnd = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
      return format(startOfWeek(prevWeekEnd, { weekStartsOn: 1 }), "yyyy-MM-dd");
    }
    case "month": {
      const prevMonth = subMonths(startOfMonth(now), 1);
      return format(startOfMonth(prevMonth), "yyyy-MM-dd");
    }
    case "year": {
      const prevYear = subYears(startOfYear(now), 1);
      return format(startOfYear(prevYear), "yyyy-MM-dd");
    }
  }
}

export async function schedulePeriodWorkSummary(): Promise<void> {
  try {
    const queue = getPeriodSummaryQueue();
    const tz = await resolveSystemTimezone();

    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }

    // 周汇总：每周一 01:00 聚合上周（周一~周日）
    await queue.add(
      "period-work-summary",
      { periodType: "week", periodStart: "__computed_at_runtime__" },
      { repeat: { cron: "0 1 * * 1", tz } }
    );

    // 月汇总：每月 1 日 01:30 聚合上月
    await queue.add(
      "period-work-summary",
      { periodType: "month", periodStart: "__computed_at_runtime__" },
      { repeat: { cron: "30 1 1 * *", tz } }
    );

    // 年汇总：每年 1 月 1 日 02:00 聚合上年
    await queue.add(
      "period-work-summary",
      { periodType: "year", periodStart: "__computed_at_runtime__" },
      { repeat: { cron: "0 2 1 1 *", tz } }
    );

    logger.info({ action: "period_summary_scheduled", tz });
  } catch (error) {
    logger.error({
      action: "schedule_period_summary_error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function stopPeriodSummaryQueue(): Promise<void> {
  if (_periodSummaryQueue) {
    await _periodSummaryQueue.close();
    logger.info({ action: "period_summary_queue_closed" });
  }
}
