import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyAuthRoute,
  getAuthRedirect,
  updateSupabaseSession,
} from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  publicEnv: {
    supabaseUrl: "https://project.example",
    supabasePublishableKey: "sb_publishable_test_key",
  },
}));

type CookieWrite = {
  name: string;
  value: string;
  options: { httpOnly?: boolean; path?: string; sameSite?: "lax" };
};

type ProxyCookieAdapter = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieWrite[], headers: Record<string, string>): void;
};

const refreshedCookies: CookieWrite[] = [
  {
    name: "sb-access-token",
    value: "new-access-token",
    options: { httpOnly: true, path: "/", sameSite: "lax" },
  },
  {
    name: "sb-refresh-token",
    value: "new-refresh-token",
    options: { httpOnly: true, path: "/", sameSite: "lax" },
  },
];

function arrangeClaims(claims: { sub: string } | null) {
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    const cookies = options.cookies as ProxyCookieAdapter;

    return {
      auth: {
        getClaims: async () => {
          cookies.setAll(refreshedCookies, {
            "Cache-Control":
              "private, no-cache, no-store, must-revalidate, max-age=0",
            Expires: "0",
          });

          return claims
            ? {
                data: {
                  claims,
                  header: { alg: "RS256", typ: "JWT" },
                  signature: new Uint8Array(),
                },
                error: null,
              }
            : { data: null, error: null };
        },
        getSession: async () => {
          throw new Error("getSession must not be used for identity");
        },
      },
    } as never;
  });
}

describe("classifyAuthRoute", () => {
  it.each([
    ["/dashboard", "protected"],
    ["/dashboard/activity", "protected"],
    ["/profile/settings", "protected"],
    ["/update-password", "protected"],
    ["/login", "anonymous-only"],
    ["/signup", "anonymous-only"],
    ["/forgot-password", "anonymous-only"],
    ["/auth/callback", "public"],
    ["/", "public"],
    ["/dashboard-preview", "public"],
  ] as const)("classifies %s as %s", (pathname, expected) => {
    expect(classifyAuthRoute(pathname)).toBe(expected);
  });
});

describe("getAuthRedirect", () => {
  it("sends anonymous protected requests to login with a local continuation", () => {
    const request = new NextRequest("https://app.example/dashboard");

    expect(getAuthRedirect(request, null)?.href).toBe(
      "https://app.example/login?next=%2Fdashboard",
    );
  });

  it("sends authenticated login requests to the configured landing page", () => {
    const request = new NextRequest("https://app.example/login");

    expect(getAuthRedirect(request, { sub: "user-123" })?.href).toBe(
      "https://app.example/dashboard",
    );
  });

  it("does not redirect public requests", () => {
    const request = new NextRequest("https://app.example/auth/callback");

    expect(getAuthRedirect(request, null)).toBeNull();
  });
});

describe("updateSupabaseSession", () => {
  beforeEach(() => {
    vi.mocked(createServerClient).mockReset();
  });

  it("keeps every refreshed cookie and cache header on pass-through responses", async () => {
    arrangeClaims({ sub: "user-123" });

    const response = await updateSupabaseSession(
      new NextRequest("https://app.example/dashboard", {
        headers: { cookie: "existing=value" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(
      response.cookies.getAll().map(({ name, value }) => ({ name, value })),
    ).toEqual([
      { name: "sb-access-token", value: "new-access-token" },
      { name: "sb-refresh-token", value: "new-refresh-token" },
    ]);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(response.headers.get("expires")).toBe("0");
  });

  it("keeps every refreshed cookie and cache header on redirect responses", async () => {
    arrangeClaims(null);

    const response = await updateSupabaseSession(
      new NextRequest("https://app.example/dashboard"),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/login?next=%2Fdashboard",
    );
    expect(
      response.cookies.getAll().map(({ name, value }) => ({ name, value })),
    ).toEqual([
      { name: "sb-access-token", value: "new-access-token" },
      { name: "sb-refresh-token", value: "new-refresh-token" },
    ]);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(response.headers.get("expires")).toBe("0");
  });
});
