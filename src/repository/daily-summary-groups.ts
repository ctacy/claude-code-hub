import { asc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { dailySummaryGroups } from "@/drizzle/schema";

export interface DailySummaryGroup {
  id: number;
  name: string;
  groupTag: string | null;
  model: string | null;
  sortOrder: number;
  enabled: boolean;
}

export async function getDailySummaryGroups(): Promise<DailySummaryGroup[]> {
  const rows = await db
    .select({
      id: dailySummaryGroups.id,
      name: dailySummaryGroups.name,
      groupTag: dailySummaryGroups.groupTag,
      model: dailySummaryGroups.model,
      sortOrder: dailySummaryGroups.sortOrder,
      enabled: dailySummaryGroups.enabled,
    })
    .from(dailySummaryGroups)
    .orderBy(asc(dailySummaryGroups.sortOrder));
  return rows;
}

export async function createDailySummaryGroup(data: {
  name: string;
  groupTag?: string | null;
  model?: string | null;
  sortOrder?: number;
  enabled?: boolean;
}): Promise<DailySummaryGroup> {
  const [row] = await db
    .insert(dailySummaryGroups)
    .values({
      name: data.name,
      groupTag: data.groupTag ?? null,
      model: data.model ?? null,
      sortOrder: data.sortOrder ?? 0,
      enabled: data.enabled ?? true,
    })
    .returning({
      id: dailySummaryGroups.id,
      name: dailySummaryGroups.name,
      groupTag: dailySummaryGroups.groupTag,
      model: dailySummaryGroups.model,
      sortOrder: dailySummaryGroups.sortOrder,
      enabled: dailySummaryGroups.enabled,
    });
  return row;
}

export async function updateDailySummaryGroup(
  id: number,
  data: Partial<{
    name: string;
    groupTag: string | null;
    model: string | null;
    sortOrder: number;
    enabled: boolean;
  }>
): Promise<DailySummaryGroup | null> {
  const [row] = await db
    .update(dailySummaryGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dailySummaryGroups.id, id))
    .returning({
      id: dailySummaryGroups.id,
      name: dailySummaryGroups.name,
      groupTag: dailySummaryGroups.groupTag,
      model: dailySummaryGroups.model,
      sortOrder: dailySummaryGroups.sortOrder,
      enabled: dailySummaryGroups.enabled,
    });
  return row ?? null;
}

export async function deleteDailySummaryGroup(id: number): Promise<boolean> {
  const result = await db
    .delete(dailySummaryGroups)
    .where(eq(dailySummaryGroups.id, id))
    .returning({ id: dailySummaryGroups.id });
  return result.length > 0;
}

// 批量更新 sortOrder（拖拽排序用）
export async function reorderDailySummaryGroups(
  items: Array<{ id: number; sortOrder: number }>
): Promise<void> {
  await Promise.all(
    items.map(({ id, sortOrder }) =>
      db
        .update(dailySummaryGroups)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(dailySummaryGroups.id, id))
    )
  );
}
