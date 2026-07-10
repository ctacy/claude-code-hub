import { type NextRequest, NextResponse } from "next/server";
import { runDailyWorkSummary } from "@/jobs/daily-work-summary";
import { getPortalSession } from "@/lib/auth/require-portal-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dateOverride: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      dateOverride = body.date;
    }
  } catch {
    // no body
  }

  try {
    const result = await runDailyWorkSummary({ dateOverride });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `汇总失败：${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
