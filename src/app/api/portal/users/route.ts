import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { requestIoLog } from "@/drizzle/io-log-schema";
import { getPortalSession } from "@/lib/auth/require-portal-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .selectDistinct({ userName: requestIoLog.userName })
    .from(requestIoLog)
    .where(isNotNull(requestIoLog.userName))
    .limit(500);

  const items = rows
    .map((r, i) => ({ id: i + 1, name: r.userName as string }))
    .filter((r) => r.name);

  return NextResponse.json({ items });
}
