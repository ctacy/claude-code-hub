import { type NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import {
  createDailySummaryGroup,
  deleteDailySummaryGroup,
  getDailySummaryGroups,
  reorderDailySummaryGroups,
  updateDailySummaryGroup,
} from "@/repository/daily-summary-groups";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await getDailySummaryGroups();
  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const group = await createDailySummaryGroup({
    name: body.name.trim(),
    groupTag: typeof body.groupTag === "string" ? body.groupTag.trim() || null : null,
    model: typeof body.model === "string" ? body.model.trim() || null : null,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    enabled: body.enabled !== false,
  });
  return NextResponse.json({ group }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // 批量重排序：{ reorder: [{id, sortOrder}] }
  if (Array.isArray(body.reorder)) {
    await reorderDailySummaryGroups(body.reorder as Array<{ id: number; sortOrder: number }>);
    return NextResponse.json({ ok: true });
  }

  // 单条更新：{ id, ...fields }
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { id, ...rest } = body as Record<string, unknown>;
  const updates: Parameters<typeof updateDailySummaryGroup>[1] = {};
  if (typeof rest.name === "string") updates.name = rest.name.trim();
  if ("groupTag" in rest)
    updates.groupTag = typeof rest.groupTag === "string" ? rest.groupTag.trim() || null : null;
  if ("model" in rest)
    updates.model = typeof rest.model === "string" ? rest.model.trim() || null : null;
  if (typeof rest.sortOrder === "number") updates.sortOrder = rest.sortOrder;
  if (typeof rest.enabled === "boolean") updates.enabled = rest.enabled;

  const updated = await updateDailySummaryGroup(id as number, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ group: updated });
}

export async function DELETE(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deleted = await deleteDailySummaryGroup(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
