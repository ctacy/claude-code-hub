import type { ReactNode } from "react";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "../providers";

export const metadata = {
  title: "AI使用分析",
};

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <AppProviders>
          <div className="min-h-screen bg-background text-foreground">{children}</div>
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
