// AI Accept 2026-07-14 main v1
"use client";

import { Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/portal/summaries", label: "AI使用分析" },
  { href: "/portal/cost", label: "成本榜" },
  { href: "/portal/io-logs", label: "请求记录" },
  { href: "/portal/settings", label: "设置" },
];

export function PortalHeader({ username }: { username: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // 路由切换完成后清除 pending 状态
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" }).catch(() => {});
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold">管理门户</span>
          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const isPending = pendingHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (!isActive) setPendingHref(item.href);
                  }}
                  className={cn(
                    "flex items-center gap-1 text-sm transition-colors hover:text-foreground",
                    isActive || isPending ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {isPending && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{username}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1.5" />
            退出
          </Button>
        </div>
      </div>
    </header>
  );
}
