import { describe, expect, it } from "vitest";
import { aggregateDailyTotals, normalizeProviderRows } from "@/lib/portal/dashboard-profile";
import type { ProviderLeaderboardEntry } from "@/repository/leaderboard";

function makeRow(partial: Partial<ProviderLeaderboardEntry>): ProviderLeaderboardEntry {
  return {
    providerId: 1,
    providerName: "p",
    totalRequests: 0,
    totalCost: 0,
    totalTokens: 0,
    successRate: 1,
    avgTtfbMs: 0,
    avgTokensPerSecond: 0,
    avgCostPerRequest: 0,
    avgCostPerMillionTokens: 0,
    ...partial,
  };
}

describe("aggregateDailyTotals", () => {
  it("按日聚合每位用户成本与请求数为每日总量", () => {
    const rows = [
      { user_id: 1, user_name: "alice", date: "2026-07-09", api_calls: 3, total_cost: "1.5" },
      { user_id: 2, user_name: "bob", date: "2026-07-09", api_calls: 2, total_cost: 0.5 },
      { user_id: 1, user_name: "alice", date: "2026-07-10", api_calls: 4, total_cost: "2" },
    ];

    const result = aggregateDailyTotals(rows);

    expect(result.series).toEqual([
      { date: "2026-07-09", totalCost: 2.0, totalRequests: 5 },
      { date: "2026-07-10", totalCost: 2.0, totalRequests: 4 },
    ]);
    expect(result.totalCost).toBe(4);
    expect(result.totalRequests).toBe(9);
  });

  it("接受 Date 对象（运行时实际类型）并规范到 YYYY-MM-DD", () => {
    const rows = [
      {
        user_id: 1,
        user_name: "alice",
        date: new Date("2026-07-09T00:00:00Z"),
        api_calls: 2,
        total_cost: "1.0",
      },
      {
        user_id: 1,
        user_name: "alice",
        date: new Date("2026-07-10T00:00:00Z"),
        api_calls: 1,
        total_cost: "0.25",
      },
    ];

    const result = aggregateDailyTotals(rows);

    expect(result.series.map((p) => p.date)).toEqual(["2026-07-09", "2026-07-10"]);
    expect(result.totalCost).toBe(1.25);
  });

  it("容忍 null/undefined 成本与零值", () => {
    const rows = [
      { user_id: 1, user_name: "alice", date: "2026-07-09", api_calls: 0, total_cost: null },
      { user_id: 2, user_name: "bob", date: "2026-07-09", api_calls: 1, total_cost: undefined },
    ];

    const result = aggregateDailyTotals(rows);

    expect(result.series).toEqual([{ date: "2026-07-09", totalCost: 0, totalRequests: 1 }]);
  });

  it("忽略未识别的 date 与空输入", () => {
    const rows = [
      { user_id: 1, user_name: "alice", date: "", api_calls: 5, total_cost: "1" },
      { user_id: 2, user_name: "bob", date: "garbage", api_calls: 3, total_cost: "0.5" },
    ];

    const result = aggregateDailyTotals(rows);

    expect(result.series).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.totalRequests).toBe(0);
  });
});

describe("normalizeProviderRows", () => {
  it("截断至前 N 条并把 null 字段收尾为 0", () => {
    const rows: ProviderLeaderboardEntry[] = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        providerId: i + 1,
        providerName: `p${i + 1}`,
        totalCost: 0.123456789,
        totalRequests: 7,
        successRate: i === 3 ? null : 0.95,
        avgTtfbMs: 123.6,
      })
    );

    const result = normalizeProviderRows(rows);

    expect(result.length).toBe(6);
    expect(result[0].providerName).toBe("p1");
    // 精度截到 4 位
    expect(result[0].totalCost).toBe(0.1235);
    // null → 0
    expect(result[3].successRate).toBe(0);
    // TTFB 取整
    expect(result[0].avgTtfbMs).toBe(124);
  });

  it("输入为空时返回空数组", () => {
    expect(normalizeProviderRows([])).toEqual([]);
  });
});
