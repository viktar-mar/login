import { beforeEach, expect, it, vi } from "vitest";
import { setLocaleAction } from "./actions";
import { localeCookieName } from "./server";

const { values, options, enabledLocales } = vi.hoisted(() => ({
  values: new Map<string, string>(),
  options: new Map<string, unknown>(),
  enabledLocales: ["en"],
}));

vi.mock("@/config/site", () => ({
  siteConfig: { locales: enabledLocales, defaultLocale: "en" },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, settings: unknown) => {
      values.set(name, value);
      options.set(name, settings);
    },
  }),
}));

beforeEach(() => {
  values.clear();
  options.clear();
  enabledLocales.splice(0, enabledLocales.length, "en");
});

it("persists an enabled locale with a year-long, same-site cookie", async () => {
  await setLocaleAction("en");
  expect(values.get(localeCookieName)).toBe("en");
  expect(options.get(localeCookieName)).toEqual({
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
  });
});

it.each(["ru", "xx", "__proto__", "", null, { locale: "en" }])(
  "ignores disabled or malformed locale input: %j",
  async (value) => {
    values.set(localeCookieName, "en");
    await setLocaleAction(value as Parameters<typeof setLocaleAction>[0]);
    expect(values.get(localeCookieName)).toBe("en");
    expect(options.size).toBe(0);
  },
);

it("rejects an unregistered locale even if enabled by a bad runtime configuration", async () => {
  enabledLocales.push("xx");
  await setLocaleAction("xx" as Parameters<typeof setLocaleAction>[0]);
  expect(values.size).toBe(0);
});
