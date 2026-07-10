import { type NextRequest, NextResponse } from "next/server";
import { decodeCursor, encodeCursor } from "@/lib/api/v1/_shared/pagination";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { listIoLogs } from "@/repository/io-log-query";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursorRaw = searchParams.get("cursor");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200) : 50;

  let cursor: { createdAt: string; id: number } | null = null;
  if (cursorRaw) {
    const decoded = decodeCursor(cursorRaw);
    if (
      !decoded ||
      typeof decoded.createdAt !== "string" ||
      typeof decoded.id !== "number" ||
      !Number.isInteger(decoded.id)
    ) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    cursor = { createdAt: decoded.createdAt, id: decoded.id };
  }

  const result = await listIoLogs({
    limit,
    cursor,
    userName: searchParams.get("userName") || null,
    startTime: searchParams.get("startTime") || null,
    endTime: searchParams.get("endTime") || null,
    keyword: searchParams.get("keyword") || null,
  });

  return NextResponse.json({
    items: result.items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    pageInfo: {
      nextCursor: result.nextCursor
        ? encodeCursor({ createdAt: result.nextCursor.createdAt, id: result.nextCursor.id })
        : null,
      hasMore: Boolean(result.nextCursor),
    },
  });
}
