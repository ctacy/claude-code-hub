import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_SUMMARY_PROMPT } from "@/jobs/daily-work-summary";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { getSystemSettings, updateSystemSettings } from "@/repository/system-config";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSystemSettings();
  return NextResponse.json({
    prompt: settings.dailySummaryPrompt ?? null,
    model: settings.dailySummaryModel ?? null,
    defaultPrompt: DEFAULT_SUMMARY_PROMPT,
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
  const model = typeof body.model === "string" ? body.model.trim() || null : undefined;

  await updateSystemSettings({
    dailySummaryPrompt: prompt,
    ...(model !== undefined ? { dailySummaryModel: model } : {}),
  });
  return NextResponse.json({ ok: true });
}
