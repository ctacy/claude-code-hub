import { describe, expect, it } from "vitest";
import {
  aggregateDailyTotals,
  normalizeProviderRows,
  sortByAbsDelta,
} from "@/lib/portal/dashboard-profile";
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

  // AI Accept 2026-07-16 main v1
  it("hour 粒度按小时桶聚合（今日走势），同日多小时不塌缩", () => {
    // 用本地时间构造，避免 getHours() 因运行机器时区偏移导致断言漂移
    const rows = [
      {
        user_id: 1,
        user_name: "alice",
        date: new Date(2026, 6, 16, 8, 0, 0),
        api_calls: 2,
        total_cost: "1.0",
      },
      {
        user_id: 2,
        user_name: "bob",
        date: new Date(2026, 6, 16, 8, 0, 0),
        api_calls: 1,
        total_cost: "0.5",
      },
      {
        user_id: 1,
        user_name: "alice",
        date: new Date(2026, 6, 16, 9, 0, 0),
        api_calls: 3,
        total_cost: "2.0",
      },
    ];

    const result = aggregateDailyTotals(rows, "hour");

    // 两个小时桶保持独立，而非塌缩为单日一点
    expect(result.series.length).toBe(2);
    expect(result.series.map((p) => p.date)).toEqual(["2026-07-16 08", "2026-07-16 09"]);
    expect(result.series[0]).toEqual({
      date: "2026-07-16 08",
      totalCost: 1.5,
      totalRequests: 3,
    });
    expect(result.totalCost).toBe(3.5);
    expect(result.totalRequests).toBe(6);
  });

  it("hour 粒度接受 ISO 字符串并归一到 YYYY-MM-DD HH", () => {
    const rows = [
      {
        user_id: 1,
        user_name: "alice",
        date: "2026-07-16T08:30:00Z",
        api_calls: 1,
        total_cost: "1",
      },
    ];

    const result = aggregateDailyTotals(rows, "hour");

    expect(result.series[0].date).toBe("2026-07-16 08");
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

describe("sortByAbsDelta", () => {
  it("按 |deltaPct| 降序，差值相同时保留顺序", () => {
    const sorted = sortByAbsDelta([
      { userId: 1, userName: "a", currentCost: 10, priorCost: 5, deltaPct: 100 },
      { userId: 2, userName: "b", currentCost: 10, priorCost: 2, deltaPct: 400 },
      { userId: 3, userName: "c", currentCost: 10, priorCost: 50, deltaPct: -80 },
    ]);

    expect(sorted.map((r) => r.userName)).toEqual(["b", "a", "c"]);
  });

  it("新增用户（deltaPct=null）沉底", () => {
    const sorted = sortByAbsDelta([
      { userId: 1, userName: "a", currentCost: 10, priorCost: 5, deltaPct: 100 },
      { userId: 2, userName: "new", currentCost: 8, priorCost: 0, deltaPct: null },
      { userId: 3, userName: "b", currentCost: 10, priorCost: 5, deltaPct: 50 },
    ]);

    expect(sorted.map((r) => r.userName)).toEqual(["a", "b", "new"]);
  });

  it("不修改原数组", () => {
    const input = [
      { userId: 1, userName: "a", currentCost: 10, priorCost: 5, deltaPct: 100 },
      { userId: 2, userName: "b", currentCost: 10, priorCost: 5, deltaPct: -50 },
    ];
    const before = input.map((r) => r.userName);
    sortByAbsDelta(input);
    expect(input.map((r) => r.userName)).toEqual(before);
  });
});
