import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import { providers } from "@/drizzle/schema";
import { getPortalSession } from "@/lib/auth/require-portal-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .selectDistinct({ groupTag: providers.groupTag })
    .from(providers)
    .where(
      sql`${providers.groupTag} IS NOT NULL AND ${providers.isEnabled} = true AND ${providers.deletedAt} IS NULL`
    );

  const tags = rows
    .map((r) => r.groupTag as string)
    .filter(Boolean)
    .sort();
  return NextResponse.json({ tags });
}
