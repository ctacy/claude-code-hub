import { type NextRequest, NextResponse } from "next/server";
import { startDailyWorkSummaryJob } from "@/jobs/daily-work-summary-runner";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { getRedisClient } from "@/lib/redis/client";

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
    // ignore
  }

  const jobId = await startDailyWorkSummaryJob({ dateOverride });

  return NextResponse.json({ jobId });
}

/** 供前端轮询查询汇总进度 */
export async function GET(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const raw = await getRedisClient()?.get(`portal:summary-job:${jobId}`);
  if (!raw) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  return new NextResponse(raw, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
