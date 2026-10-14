"use client";

import { useTheme } from "next-themes";
import { useDictionary } from "@/i18n/provider";

export function ThemeSwitcher() {
  const { dictionary } = useDictionary();
  const { setTheme, theme } = useTheme();

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <span>{dictionary.theme.label}</span>
      <select
        className="border-border bg-card text-foreground min-h-10 rounded-md border px-2 shadow-sm"
        onChange={(event) => setTheme(event.target.value)}
        value={theme ?? "system"}
      >
        <option value="light">{dictionary.theme.light}</option>
        <option value="dark">{dictionary.theme.dark}</option>
        <option value="system">{dictionary.theme.system}</option>
      </select>
    </label>
  );
}
