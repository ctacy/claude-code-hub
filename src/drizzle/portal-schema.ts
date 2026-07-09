/**
 * Portal Schema — 独立管理门户（用户名+密码登录，环境变量配置账号）
 *
 * 与现有 dashboard / API Key 认证体系完全隔离：
 * - 不依赖 users/keys 表
 * - 仅新增 daily_work_summary 一张表，用于存储按用户按日聚合的 AI 工作总结
 *
 * 按 userName（字符串快照）分组，而非 userId：
 * request_io_log 表本身只记录 userName 快照（无 userId 列），
 * 现有 io-logs 查询/筛选也是按 userName 做主键，此处保持一致。
 */
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const dailyWorkSummary = pgTable(
  "daily_work_summary",
  {
    id: serial("id").primaryKey(),
    /** 用户名快照（与 request_io_log.user_name 对应） */
    userName: varchar("user_name", { length: 255 }).notNull(),
    /** 业务日期，本地时区 YYYY-MM-DD */
    date: varchar("date", { length: 10 }).notNull(),
    /** 当日请求条数（冗余存储，便于列表展示） */
    requestCount: integer("request_count").notNull().default(0),

    // 工作类型分类标签（次数）
    tagsDebugging: integer("tags_debugging").notNull().default(0),
    tagsDocumentation: integer("tags_documentation").notNull().default(0),
    tagsCodeGen: integer("tags_code_gen").notNull().default(0),
    tagsRefactor: integer("tags_refactor").notNull().default(0),
    tagsTesting: integer("tags_testing").notNull().default(0),
    tagsOther: integer("tags_other").notNull().default(0),

    /** LLM 生成的自然语言总结（200 字以内） */
    summaryText: text("summary_text").notNull(),

    // 生成元数据（用于追溯/审计）
    providerId: integer("provider_id"),
    model: varchar("model", { length: 128 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),

    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // 一人一日一条：定时任务重跑时按 (userName, date) upsert
    dailyWorkSummaryUserDateIdx: uniqueIndex("idx_daily_work_summary_user_date").on(
      table.userName,
      table.date
    ),
    dailyWorkSummaryDateIdx: index("idx_daily_work_summary_date").on(table.date),
  })
);
