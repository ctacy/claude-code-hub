import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import { isPortalConfigured } from "@/lib/config/env.schema";
import { IoLogsView } from "./_components/io-logs-view";

export const dynamic = "force-dynamic";

export default async function IoLogsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    return redirect({ href: "/login?from=/dashboard/io-logs", locale });
  }

  if (session.user.role !== "admin") {
    return redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations({ locale, namespace: "ioLogs" });
  const portalEnabled = isPortalConfigured();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </div>
        {portalEnabled && (
          <a
            href="/portal/summaries"
            className="shrink-0 mt-1 text-sm text-primary hover:underline"
          >
            {t("portalLink")} →
          </a>
        )}
      </div>
      <IoLogsView />
    </div>
  );
}
