// AI Accept 2026-07-14 main v1
import { type NextRequest, NextResponse } from "next/server";
import { startBatchWorkSummaryJob } from "@/jobs/batch-work-summary-runner";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { getRedisClient } from "@/lib/redis/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userNames: string[] | undefined;
  let period: "day" | "week" | "month" | "year" | undefined;
  let periodStart: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));

    if (
      Array.isArray(body?.userNames) &&
      body.userNames.every((n: unknown) => typeof n === "string")
    ) {
      userNames = body.userNames as string[];
    }
    if (["day", "week", "month", "year"].includes(body?.period)) {
      period = body.period as "day" | "week" | "month" | "year";
    }
    if (typeof body?.periodStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.periodStart)) {
      periodStart = body.periodStart;
    }
  } catch {
    // ignore parse errors
  }

  if (!userNames || userNames.length === 0) {
    return NextResponse.json({ error: "userNames must be a non-empty array" }, { status: 400 });
  }
  if (!period) {
    return NextResponse.json(
      { error: "period must be one of: day, week, month, year" },
      { status: 400 }
    );
  }
  if (!periodStart) {
    return NextResponse.json({ error: "periodStart is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const jobId = await startBatchWorkSummaryJob({ userNames, period, periodStart });

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
  const raw = await getRedisClient()?.get(`portal:batch-summary-job:${jobId}`);
  if (!raw) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  return new NextResponse(raw, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
