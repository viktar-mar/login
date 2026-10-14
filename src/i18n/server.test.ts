import { beforeEach, describe, expect, it, vi } from "vitest";
import { chooseLocale, getRequestLocale } from "./server";

const { config, request } = vi.hoisted(() => ({
  config: { locales: ["en"], defaultLocale: "en" },
  request: { cookie: "ru", language: "ru-RU" },
}));

vi.mock("@/config/site", () => ({ siteConfig: config }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: request.cookie }) }),
  headers: async () => ({ get: () => request.language }),
}));

beforeEach(() => {
  config.defaultLocale = "en";
});

it("ignores a disabled language in both the cookie and browser preferences", async () => {
  expect(await getRequestLocale()).toBe("en");
});

it("falls back to an enabled language if the configured default was disabled", async () => {
  config.defaultLocale = "ru";
  expect(await getRequestLocale()).toBe("en");
});

describe("chooseLocale", () => {
  it("uses an enabled intermediate language subtag before falling back", () => {
    expect(
      chooseLocale(undefined, "zh-Hant-TW,en;q=0.5", ["en", "zh-Hant"], "en"),
    ).toBe("zh-Hant");
  });

  it("matches a regional locale cookie case-insensitively", () => {
    expect(chooseLocale("pt-BR", null, ["en", "pt-BR"], "en")).toBe("pt-BR");
  });

  it("matches a regional browser locale while preserving its registry code", () => {
    expect(
      chooseLocale(undefined, "pt-br,en;q=0.5", ["en", "pt-BR"], "en"),
    ).toBe("pt-BR");
  });

  it("prefers a validated locale cookie over the request language", () => {
    expect(chooseLocale("ru", "en-US,en;q=0.9", ["en", "ru"], "en")).toBe("ru");
  });

  it("uses a supported weighted request language when the cookie is invalid", () => {
    expect(chooseLocale("xx", "ru-RU,ru;q=0.9", ["en", "ru"], "en")).toBe("ru");
  });

  it("falls back when neither the cookie nor request languages are supported", () => {
    expect(chooseLocale(undefined, "de-DE", ["en", "ru"], "en")).toBe("en");
  });

  it("honors Accept-Language weights before matching primary language subtags", () => {
    expect(
      chooseLocale(undefined, "en-US;q=0.4,ru-RU;q=0.9", ["en", "ru"], "en"),
    ).toBe("ru");
  });
});
