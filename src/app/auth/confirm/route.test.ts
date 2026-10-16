// @vitest-environment node

import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "google,github",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { GET } from "./route";

const confirmationUrl =
  "https://request-host.example/auth/confirm?token_hash=secret-hash&type=email";
let browserCookies: Map<string, string>;
let authFetch: ReturnType<typeof vi.fn>;

function verifiedSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: expiresAt }),
  ).toString("base64url");

  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
    refresh_token: `private-refresh-${userId}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: `${userId}@example.test`,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-16T00:00:00Z",
    },
  };
}

beforeEach(() => {
  browserCookies = new Map();
  vi.mocked(cookies).mockResolvedValue({
    getAll: () =>
      Array.from(browserCookies, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => browserCookies.set(name, value),
  } as never);
  authFetch = vi.fn().mockImplementation(async (url, init) => {
    if (
      String(url) !== "https://project.example/auth/v1/verify" ||
      init?.method !== "POST"
    ) {
      throw new Error("Unexpected Auth request");
    }
    return Response.json(verifiedSession("link-owner"));
  });
  vi.stubGlobal("fetch", authFetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /auth/confirm", () => {
  it("confirms the email without signing an anonymous browser in", async () => {
    const response = await GET(
      new Request(`${confirmationUrl}&next=%2Fignored&leak=raw`),
    );

    expect(authFetch).toHaveBeenCalledOnce();
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toMatchObject({
      token_hash: "secret-hash",
      type: "email",
    });
    expect(browserCookies.size).toBe(0);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?confirmed=email",
    );
    expect(await response.text()).not.toContain("private-refresh");
  });

  it("does not replace an existing browser session with the link owner's session", async () => {
    const existingCookie = `base64-${Buffer.from(
      JSON.stringify(verifiedSession("existing-user")),
    ).toString("base64url")}`;
    browserCookies.set("sb-project-auth-token", existingCookie);
    browserCookies.set("auth-starter-locale", "ru");
    const before = new Map(browserCookies);

    const response = await GET(new Request(confirmationUrl));

    expect(authFetch).toHaveBeenCalledOnce();
    expect(browserCookies).toEqual(before);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?confirmed=email",
    );
  });

  it.each([
    "https://request-host.example/auth/confirm?type=email",
    "https://request-host.example/auth/confirm?token_hash=&type=email",
    "https://request-host.example/auth/confirm?token_hash=first&token_hash=second&type=email",
    "https://request-host.example/auth/confirm?token_hash=secret&type=signup",
    "https://request-host.example/auth/confirm?token_hash=secret&type=recovery",
    "https://request-host.example/auth/confirm?token_hash=secret&type=email&type=recovery",
  ])(
    "rejects missing, repeated, or unsupported confirmation data: %s",
    async (url) => {
      const response = await GET(new Request(url));

      expect(authFetch).not.toHaveBeenCalled();
      expect(browserCookies.size).toBe(0);
      expect(response.headers.get("location")).toBe(
        "https://app.example/login?error=invalid_link",
      );
    },
  );

  it("maps an expired token to invalid_link without exposing auth data", async () => {
    authFetch.mockResolvedValue(
      Response.json(
        { code: "otp_expired", msg: "raw backend message" },
        { status: 403 },
      ),
    );

    const response = await GET(new Request(confirmationUrl));

    expect(browserCookies.size).toBe(0);
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=invalid_link",
    );
  });

  it("fails closed on an unexpected verification error", async () => {
    authFetch.mockResolvedValue(
      Response.json({ user: null, access_token: "malformed" }),
    );

    const response = await GET(new Request(confirmationUrl));

    expect(browserCookies.size).toBe(0);
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=invalid_link",
    );
  });

  it.each(["success", "missing", "expired"])(
    "prevents caching of the %s confirmation response",
    async (outcome) => {
      if (outcome === "expired") {
        authFetch.mockResolvedValue(
          Response.json(
            { code: "otp_expired", msg: "Token expired" },
            { status: 403 },
          ),
        );
      }
      const response = await GET(
        new Request(
          outcome === "missing"
            ? "https://app.example/auth/confirm"
            : confirmationUrl,
        ),
      );

      expect(response.headers.get("cache-control")).toBe(
        "private, no-cache, no-store, must-revalidate, max-age=0",
      );
      expect(response.headers.get("pragma")).toBe("no-cache");
      expect(response.headers.get("expires")).toBe("0");
    },
  );
});
