// AI Accept 2026-07-14 main v1
import { type RunResult, runDailyWorkSummary } from "./daily-work-summary";
import { type PeriodRunResult, runPeriodWorkSummary } from "./period-work-summary";

/**
 * 为指定用户名列表重跑日报汇总
 * @param date      目标业务日期 YYYY-MM-DD
 * @param userNames 要处理的用户名列表（非空）
 */
export async function runDailyWorkSummaryForUsers(
  date: string,
  userNames: string[]
): Promise<RunResult> {
  return runDailyWorkSummary({ dateOverride: date, userNamesFilter: userNames });
}

/**
 * 为指定用户名列表重跑周期汇总
 * @param periodType  周期粒度
 * @param periodStart 周期起始日 YYYY-MM-DD
 * @param userNames   要处理的用户名列表（非空）
 */
export async function runPeriodWorkSummaryForUsers(
  periodType: "week" | "month" | "year",
  periodStart: string,
  userNames: string[]
): Promise<PeriodRunResult> {
  return runPeriodWorkSummary({ periodType, periodStart, userNamesFilter: userNames });
}
