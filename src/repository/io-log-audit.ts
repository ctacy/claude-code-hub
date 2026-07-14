// AI Accept 2026-07-14 main v1
import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";

export interface AuditFlags {
  repeatedBlast: number;
  emptyOutput: number;
  hugeInput: number;
  total: number;
}

export interface IoLogWithFlags {
  id: number;
  requestBody: string | null;
  responseBody: string | null;
  createdAt: Date;
  flagBlast: boolean;
  flagEmpty: boolean;
  flagHuge: boolean;
}

/**
 * 指定日期所有用户的无效请求审计：批量返回 Map<userName, AuditFlags>。
 * 三类标记：
 *   repeatedBlast — 同一 request_body 在 30min 内重复 >=3 次
 *   emptyOutput   — response_body IS NULL / 长度 < 5 / output_tokens = 0
 *   hugeInput     — input_tokens > 100000
 */
export async function auditFlagsForDate(
  dateStr: string,
  timezone: string
): Promise<Map<string, AuditFlags>> {
  const rows = await db.execute(sql`
    WITH base AS (
      SELECT iol.user_name,
             iol.request_body,
             iol.response_body,
             iol.created_at,
             mr.input_tokens,
             mr.output_tokens
      FROM request_io_log iol
      LEFT JOIN message_request mr ON mr.id = iol.request_id
      WHERE iol.user_name IS NOT NULL
        AND iol.created_at >= (${dateStr}::date AT TIME ZONE ${timezone})
        AND iol.created_at <  ((${dateStr}::date + INTERVAL '1 day') AT TIME ZONE ${timezone})
    ),
    blast_bodies AS (
      SELECT DISTINCT user_name, request_body
      FROM (
        SELECT user_name,
               request_body,
               created_at,
               LEAD(created_at, 2) OVER (
                 PARTITION BY user_name, request_body
                 ORDER BY created_at
               ) AS lead2
        FROM base
        WHERE request_body IS NOT NULL
      ) t
      WHERE lead2 - created_at <= INTERVAL '30 minutes'
    ),
    annotated AS (
      SELECT b.user_name,
             b.response_body,
             b.input_tokens,
             b.output_tokens,
             (bb.user_name IS NOT NULL) AS is_blast
      FROM base b
      LEFT JOIN blast_bodies bb
        ON bb.user_name = b.user_name
       AND bb.request_body = b.request_body
    )
    SELECT
      user_name,
      COUNT(*) FILTER (WHERE is_blast)::int                                                                   AS repeated_blast,
      COUNT(*) FILTER (WHERE response_body IS NULL
                           OR length(response_body) < 5
                           OR COALESCE(output_tokens, 0) = 0)::int                                            AS empty_output,
      COUNT(*) FILTER (WHERE COALESCE(input_tokens, 0) > 100000)::int                                        AS huge_input,
      COUNT(*)::int                                                                                           AS total
    FROM annotated
    GROUP BY user_name
  `);

  const map = new Map<string, AuditFlags>();
  for (const row of rows) {
    const r = row as {
      user_name: string;
      repeated_blast: unknown;
      empty_output: unknown;
      huge_input: unknown;
      total: unknown;
    };
    map.set(r.user_name, {
      repeatedBlast: Number(r.repeated_blast ?? 0),
      emptyOutput: Number(r.empty_output ?? 0),
      hugeInput: Number(r.huge_input ?? 0),
      total: Number(r.total ?? 0),
    });
  }
  return map;
}

/**
 * 指定用户+日期的 io-log 逐行列表，附带三类无效标记。
 * 供详情页高亮异常行使用。上限 300 条。
 */
export async function listIoLogsWithFlags(
  userName: string,
  dateStr: string,
  timezone: string
): Promise<IoLogWithFlags[]> {
  const rows = await db.execute(sql`
    WITH base AS (
      SELECT iol.id,
             iol.request_body,
             iol.response_body,
             iol.created_at,
             mr.input_tokens,
             mr.output_tokens
      FROM request_io_log iol
      LEFT JOIN message_request mr ON mr.id = iol.request_id
      WHERE iol.user_name = ${userName}
        AND iol.created_at >= (${dateStr}::date AT TIME ZONE ${timezone})
        AND iol.created_at <  ((${dateStr}::date + INTERVAL '1 day') AT TIME ZONE ${timezone})
    ),
    blast_bodies AS (
      SELECT DISTINCT request_body
      FROM (
        SELECT request_body,
               created_at,
               LEAD(created_at, 2) OVER (
                 PARTITION BY request_body
                 ORDER BY created_at
               ) AS lead2
        FROM base
        WHERE request_body IS NOT NULL
      ) t
      WHERE lead2 - created_at <= INTERVAL '30 minutes'
    )
    SELECT
      b.id,
      b.request_body,
      b.response_body,
      b.created_at,
      (bb.request_body IS NOT NULL)                                                                AS flag_blast,
      (b.response_body IS NULL OR length(b.response_body) < 5
        OR COALESCE(b.output_tokens, 0) = 0)                                                      AS flag_empty,
      (COALESCE(b.input_tokens, 0) > 100000)                                                      AS flag_huge
    FROM base b
    LEFT JOIN blast_bodies bb ON bb.request_body = b.request_body
    ORDER BY b.created_at ASC
    LIMIT 300
  `);

  return rows.map((row) => {
    const r = row as {
      id: unknown;
      request_body: unknown;
      response_body: unknown;
      created_at: unknown;
      flag_blast: unknown;
      flag_empty: unknown;
      flag_huge: unknown;
    };
    return {
      id: Number(r.id),
      requestBody: typeof r.request_body === "string" ? r.request_body : null,
      responseBody: typeof r.response_body === "string" ? r.response_body : null,
      createdAt: r.created_at instanceof Date ? r.created_at : new Date(String(r.created_at)),
      flagBlast: Boolean(r.flag_blast),
      flagEmpty: Boolean(r.flag_empty),
      flagHuge: Boolean(r.flag_huge),
    };
  });
}
