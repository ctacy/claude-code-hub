// AI Accept 2026-07-12 main v1
import { type NextRequest, NextResponse } from "next/server";
import { startPeriodWorkSummaryJob } from "@/jobs/period-work-summary-runner";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { getRedisClient } from "@/lib/redis/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let periodType: "week" | "month" | "year" | undefined;
  let periodStart: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (["week", "month", "year"].includes(body?.periodType)) {
      periodType = body.periodType;
    }
    if (typeof body?.periodStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.periodStart)) {
      periodStart = body.periodStart;
    }
  } catch {
    // ignore
  }

  if (!periodType || !periodStart) {
    return NextResponse.json({ error: "Missing periodType or periodStart" }, { status: 400 });
  }

  const jobId = await startPeriodWorkSummaryJob({ periodType, periodStart });

  return NextResponse.json({ jobId });
}

export async function GET(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const raw = await getRedisClient()?.get(`portal:period-summary-job:${jobId}`);
  if (!raw) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  return new NextResponse(raw, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
