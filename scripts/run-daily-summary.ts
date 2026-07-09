/**
 * 手动触发 daily-work-summary job(测试/应急补跑)
 *
 * 用法:
 *   bun scripts/run-daily-summary.ts             # 处理"昨天"(本地时区)
 *   bun scripts/run-daily-summary.ts 2026-07-08  # 处理指定日期
 */
import { runDailyWorkSummary } from "@/jobs/daily-work-summary";

const dateArg = process.argv[2];

runDailyWorkSummary({ dateOverride: dateArg })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
