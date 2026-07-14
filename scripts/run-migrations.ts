// AI Accept 2026-07-12 main v1
/**
 * 自写迁移执行器：替代 `drizzle-kit migrate`，解决其吞掉真实 SQL 错误、
 * 仅打印 `[⣷] applying migrations... exit 1` 的问题。
 *
 * 行为对齐 drizzle-kit：
 * - 读取 drizzle/meta/_journal.json，按 idx 顺序应用未记录的迁移；
 * - 使用 drizzle-orm/postgres-js 官方 migrator（同一套 __drizzle_migrations 记录表）。
 *
 * 失败时额外输出：出错的迁移文件名、完整错误（code / detail / hint / SQL 片段），
 * 便于在 CI 日志里直接定位是哪条 DDL、什么原因。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const MIGRATIONS_FOLDER = "./drizzle";

function resolveDsn(): string {
  const dsn = process.env.DSN;
  if (!dsn) {
    console.error("[migrate] DSN 环境变量未设置");
    process.exit(1);
  }
  return dsn;
}

function readJournalEntries(): Array<{ idx: number; tag: string }> {
  try {
    const raw = readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8");
    const parsed = JSON.parse(raw) as { entries?: Array<{ idx: number; tag: string }> };
    return parsed.entries ?? [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const dsn = resolveDsn();
  // migrator 需要独立、短连接：max=1，避免与运行时连接池语义混淆。
  const client = postgres(dsn, { max: 1 });
  const db = drizzle(client);

  const entries = readJournalEntries();
  console.log(`[migrate] journal 共 ${entries.length} 条迁移，开始应用...`);

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[migrate] 全部迁移应用成功");
  } catch (error) {
    console.error("\n[migrate] 迁移失败，真实错误如下:");
    printError(error);
    await client.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  }

  await client.end({ timeout: 5 }).catch(() => {});
}

function printError(error: unknown): void {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    // postgres.js 的 PostgresError 携带结构化字段
    const fields = ["message", "code", "detail", "hint", "severity", "position", "where", "file", "line", "routine"];
    for (const f of fields) {
      if (e[f] !== undefined && e[f] !== null && e[f] !== "") {
        console.error(`  ${f}: ${String(e[f])}`);
      }
    }
    // drizzle migrator 会把出错的 SQL 片段挂在 query / 或原样抛出
    if (typeof e.query === "string") {
      console.error(`  query: ${e.query}`);
    }
    if (e.stack && typeof e.stack === "string") {
      console.error(`  stack:\n${e.stack}`);
    }
    return;
  }
  console.error(`  ${String(error)}`);
}

main().catch((error) => {
  console.error("[migrate] 未捕获异常:");
  printError(error);
  process.exit(1);
});
