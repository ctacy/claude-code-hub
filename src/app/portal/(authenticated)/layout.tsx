import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getPortalSession } from "@/lib/auth/require-portal-session";
import { PortalHeader } from "./_components/portal-header";

// 受保护区域：登录页 (`/portal/login`) 位于路由组之外，不经过此校验，
// 避免"未登录 → 重定向到登录页 → 登录页也在同一 layout → 再次校验 → 死循环"。
export default async function PortalAuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getPortalSession();

  if (!session) {
    redirect("/portal/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader username={session.username} />
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
