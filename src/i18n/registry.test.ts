import { expect, it, vi } from "vitest";
import { getDictionary, chooseLocale } from "./server";
import type { Locale } from "./types";

vi.mock("./registry", async (importOriginal) => {
  const original = await importOriginal<typeof import("./registry")>();
  return {
    dictionaries: {
      ...original.dictionaries,
      fr: {
        ...original.dictionaries.en,
        auth: { ...original.dictionaries.en.auth, signIn: "Se connecter" },
      },
    },
  };
});

it("loads a third registered dictionary instead of silently returning English", () => {
  expect(getDictionary("fr" as Locale).auth.signIn).toBe("Se connecter");
});

it("rejects an unknown dictionary rather than returning English", () => {
  expect(() => getDictionary("xx" as Locale)).toThrow();
  expect(() => getDictionary("__proto__" as Locale)).toThrow();
});

it("selects a third language from a regional browser preference", () => {
  expect(chooseLocale(undefined, "fr-CA,en;q=0.5", ["en", "fr"], "en")).toBe(
    "fr",
  );
});
