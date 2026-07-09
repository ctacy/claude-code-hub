import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { defaultLocale } from "@/i18n/config";
import { AppProviders } from "../providers";

export const metadata = {
  title: "AI使用分析",
};

// Portal segment lives outside the `[locale]` route tree, so it has no intl
// context from routing. `<Toaster />` calls `useTranslations`, which throws an
// empty Error during static prerender of `/portal/login` without a provider.
// Pin the default locale (portal UI is zh-CN) and supply messages explicitly.
export default async function PortalRootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages({ locale: defaultLocale });
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider locale={defaultLocale} messages={messages}>
          <AppProviders>
            <div className="min-h-screen bg-background text-foreground">{children}</div>
            <Toaster />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
