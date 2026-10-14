import type { Metadata } from "next";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { siteConfig } from "@/config/site";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary, getRequestLocale } from "@/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <div className="flex min-h-screen flex-col">
              <header className="border-border bg-card border-b">
                <div className="mx-auto flex min-h-20 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                  <Link
                    className="text-foreground font-semibold tracking-tight"
                    href="/"
                  >
                    {siteConfig.name}
                  </Link>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <ThemeSwitcher />
                    <LocaleSwitcher />
                  </div>
                </div>
              </header>
              {children}
            </div>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
