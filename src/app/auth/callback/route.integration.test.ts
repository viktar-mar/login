// @vitest-environment node

import { cookies } from "next/headers";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

it("keeps a real SDK PKCE session exchange private while writing the session cookies", async () => {
  const cookieJar = new Map([
    [
      "sb-project-auth-token-code-verifier",
      `base64-${Buffer.from(JSON.stringify("browser-verifier")).toString("base64url")}`,
    ],
  ]);
  vi.mocked(cookies).mockResolvedValue({
    getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: { maxAge?: number }) => {
      if (options.maxAge === 0) cookieJar.delete(name);
      else cookieJar.set(name, value);
    },
  } as never);
  const authFetch = vi.fn(async () =>
    Response.json({
      access_token: "private-access-token",
      refresh_token: "private-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: "pkce-user",
        aud: "authenticated",
        role: "authenticated",
        email: "pkce@example.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-10-16T00:00:00Z",
      },
    }),
  );
  vi.stubGlobal("fetch", authFetch);

  const response = await GET(
    new Request(
      "https://app.example/auth/callback?code=one-time-code&next=%2Fupdate-password",
    ),
  );

  expect(authFetch).toHaveBeenCalledOnce();
  const [url, init] = authFetch.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("https://project.example/auth/v1/token?grant_type=pkce");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({
    auth_code: "one-time-code",
    code_verifier: "browser-verifier",
  });
  expect(cookieJar.has("sb-project-auth-token")).toBe(true);
  expect(cookieJar.has("sb-project-auth-token-code-verifier")).toBe(false);
  expect(response.headers.get("location")).toBe(
    "https://app.example/update-password",
  );
  expect(response.headers.get("cache-control")).toBe(
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("expires")).toBe("0");
  expect(await response.text()).not.toContain("private-access-token");
});
