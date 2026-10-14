"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/config/site";
import { setLocaleAction } from "@/i18n/actions";
import { useDictionary } from "@/i18n/provider";
import type { Locale } from "@/i18n/types";

export function LocaleSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { locale, dictionary } = useDictionary();
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });

  function changeLocale(nextLocale: Locale) {
    startTransition(async () => {
      await setLocaleAction(nextLocale);
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <span>{dictionary.locale.label}</span>
      <select
        aria-label={dictionary.locale.label}
        className="border-border bg-card text-foreground min-h-10 rounded-md border px-2 shadow-sm"
        disabled={isPending}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        value={locale}
      >
        {siteConfig.locales.map((enabledLocale) => (
          <option key={enabledLocale} value={enabledLocale}>
            {languageNames.of(enabledLocale) ?? enabledLocale}
          </option>
        ))}
      </select>
    </label>
  );
}
