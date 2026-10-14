"use server";

import { cookies } from "next/headers";
import { siteConfig } from "@/config/site";
import { isLocale, localeCookieName } from "./server";

export async function setLocaleAction(locale: unknown): Promise<void> {
  if (
    !isLocale(locale) ||
    !siteConfig.locales.some((enabled) => enabled === locale)
  ) {
    return;
  }

  const cookieStore = await cookies();

  cookieStore.set(localeCookieName, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
