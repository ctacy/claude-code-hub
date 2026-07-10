import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_SUMMARY_PROMPT } from "@/jobs/daily-work-summary";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { getSystemSettings } from "@/repository/system-config";
import { updateSystemSettings } from "@/repository/system-config";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSystemSettings();
  return NextResponse.json({
    prompt: settings.dailySummaryPrompt ?? null,
    default: DEFAULT_SUMMARY_PROMPT,
  });
}

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "Invalid body: prompt must be a string" }, { status: 400 });
  }

  const prompt = body.prompt.trim() || null;
  await updateSystemSettings({ dailySummaryPrompt: prompt });
  return NextResponse.json({ ok: true });
}
