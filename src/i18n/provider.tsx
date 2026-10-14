"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./types";

type DictionaryContextValue = {
  locale: Locale;
  dictionary: Dictionary;
};

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: DictionaryContextValue & { children: React.ReactNode }) {
  return (
    <DictionaryContext.Provider value={{ locale, dictionary }}>
      {children}
    </DictionaryContext.Provider>
  );
}

export function useDictionary(): DictionaryContextValue {
  const value = useContext(DictionaryContext);

  if (!value) {
    throw new Error("useDictionary must be used within an I18nProvider");
  }

  return value;
}
