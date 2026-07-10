import { PortalIoLogsView } from "./_components/portal-io-logs-view";

export const dynamic = "force-dynamic";

export default function PortalIoLogsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">请求记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">实时请求日志（只读）。</p>
      </div>
      <PortalIoLogsView />
    </div>
  );
}
