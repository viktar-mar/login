import type { Locale } from "@/i18n/types";

export const siteConfig = {
  name: "Your Product",
  description: "Your product description",
  logo: "/logo.svg",
  defaultLocale: "en",
  locales: ["en", "ru"],
  afterLoginPath: "/dashboard",
} as const satisfies {
  name: string;
  description: string;
  logo: string;
  defaultLocale: Locale;
  locales: readonly [Locale, ...Locale[]];
  afterLoginPath: string;
};
