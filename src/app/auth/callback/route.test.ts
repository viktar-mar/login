import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.hoisted(() => {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    NEXT_PUBLIC_SITE_URL: "https://app.example",
    NEXT_PUBLIC_AUTH_PROVIDERS: "google,github",
    NEXT_PUBLIC_ENABLE_EMAIL_AUTH: "true",
  });
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

let GET: typeof import("./route").GET;
let exchangeCodeForSession: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  GET = (await import("./route")).GET;
});

beforeEach(() => {
  exchangeCodeForSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: "secret" }, user: { id: "user-1" } },
    error: null,
  });
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { exchangeCodeForSession },
  } as unknown as SupabaseClient);
});

describe("GET /auth/callback", () => {
  it("exchanges one PKCE code and redirects to the safe continuation", async () => {
    const response = await GET(
      new Request(
        "https://attacker.example/auth/callback?code=one-time-code&next=%2Fprojects%3Fview%3Dactive&leak=raw",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledOnce();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(response.headers.get("location")).toBe(
      "https://app.example/projects?view=active",
    );
    expect(response.headers.get("location")).not.toContain("code");
    expect(response.headers.get("location")).not.toContain("leak");
  });

  it.each(["https://attacker.example/steal", "//attacker.example/steal"])(
    "falls back to the dashboard for unsafe next value %s",
    async (next) => {
      const response = await GET(
        new Request(
          `https://request-host.example/auth/callback?code=one-time-code&next=${encodeURIComponent(next)}`,
        ),
      );

      expect(response.headers.get("location")).toBe(
        "https://app.example/dashboard",
      );
    },
  );

  it.each([
    "https://request-host.example/auth/callback",
    "https://request-host.example/auth/callback?code=",
    "https://request-host.example/auth/callback?code=first&code=second",
  ])("rejects a missing, empty, or repeated code: %s", async (url) => {
    const response = await GET(new Request(url));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=invalid_link",
    );
  });

  it("maps an exchange failure to invalid_link without exposing backend data", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "bad_code_verifier", message: "raw backend message" },
    });

    const response = await GET(
      new Request(
        "https://request-host.example/auth/callback?code=secret-code&next=%2Fprivate&error=raw",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=invalid_link",
    );
    expect(response.headers.get("location")).not.toContain("secret-code");
    expect(response.headers.get("location")).not.toContain("raw");
  });
});
