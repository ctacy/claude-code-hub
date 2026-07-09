import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { listRecentDatesByUser } from "@/repository/daily-work-summary";

export const dynamic = "force-dynamic";

export default async function PortalUserSummaryListPage({
  params,
}: {
  params: Promise<{ userName: string }>;
}) {
  const { userName: encodedUserName } = await params;
  const userName = decodeURIComponent(encodedUserName);
  if (!userName) notFound();

  const dates = await listRecentDatesByUser(userName, 60);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/portal/summaries" className="text-sm text-muted-foreground hover:underline">
          ← 返回用户列表
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{userName}</h1>
      </div>

      {dates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            该用户暂无总结记录。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          {dates.map((date) => (
            <Link
              key={date}
              href={`/portal/summaries/${encodeURIComponent(userName)}/${date}`}
              className="flex items-center h-11 px-3 text-sm font-mono border-b border-border/40 last:border-b-0 hover:bg-accent/50 transition-colors"
            >
              {date}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
