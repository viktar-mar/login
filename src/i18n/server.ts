import { cookies, headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { dictionaries } from "./registry";
import type { Dictionary, Locale } from "./types";

export const localeCookieName = "auth-starter-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(dictionaries, value);
}

function supportedLocale<T extends string>(
  value: string | undefined,
  supported: readonly T[],
) {
  const normalized = value?.trim().toLowerCase();

  return supported.find((locale) => locale.toLowerCase() === normalized);
}

export function chooseLocale<T extends string>(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
  supported: readonly T[],
  fallback: T,
): T {
  const fromCookie = supportedLocale(cookieValue, supported);

  if (fromCookie) {
    return fromCookie;
  }

  const languageRanges = (acceptLanguage ?? "")
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const weight = quality ? Number.parseFloat(quality.trim().slice(2)) : 1;

      return { tag, index, weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter(({ tag, weight }) => tag && tag !== "*" && weight > 0)
    .sort(
      (left, right) => right.weight - left.weight || left.index - right.index,
    );

  for (const { tag } of languageRanges) {
    const subtags = tag.split("-");

    while (subtags.length > 0) {
      const match = supportedLocale(subtags.join("-"), supported);
      if (match) return match;

      subtags.pop();
      // Do not leave an extension singleton (e.g. "x") at the end.
      if (subtags.at(-1)?.length === 1) subtags.pop();
    }
  }

  return fallback;
}

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const fallback = siteConfig.locales.some(
    (locale) => locale === siteConfig.defaultLocale,
  )
    ? siteConfig.defaultLocale
    : siteConfig.locales[0];

  return chooseLocale(
    cookieStore.get(localeCookieName)?.value,
    requestHeaders.get("accept-language"),
    siteConfig.locales,
    fallback,
  );
}

export function getDictionary(locale: Locale): Dictionary {
  if (!isLocale(locale)) {
    throw new Error("No dictionary registered for the requested locale");
  }

  return dictionaries[locale];
}
