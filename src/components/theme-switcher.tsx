"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useDictionary } from "@/i18n/provider";

export function ThemeSwitcher() {
  const { dictionary } = useDictionary();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server cannot read the saved theme. Keep its first client render identical.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <span>{dictionary.theme.label}</span>
      <select
        className="border-border bg-card text-foreground min-h-10 rounded-md border px-2 shadow-sm"
        disabled={!mounted}
        onChange={(event) => setTheme(event.target.value)}
        value={mounted ? (theme ?? "system") : ""}
      >
        <option value="" disabled hidden>
          {dictionary.theme.label}
        </option>
        <option value="light">{dictionary.theme.light}</option>
        <option value="dark">{dictionary.theme.dark}</option>
        <option value="system">{dictionary.theme.system}</option>
      </select>
    </label>
  );
}
