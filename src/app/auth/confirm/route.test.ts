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
let verifyOtp: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  GET = (await import("./route")).GET;
});

beforeEach(() => {
  verifyOtp = vi.fn().mockResolvedValue({
    data: { session: { access_token: "secret" }, user: { id: "user-1" } },
    error: null,
  });
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { verifyOtp },
  } as unknown as SupabaseClient);
});

describe("GET /auth/confirm", () => {
  it.each([["email", "/dashboard"]] as const)(
    "verifies an allowlisted %s token and redirects to %s",
    async (type, pathname) => {
      const response = await GET(
        new Request(
          `https://attacker.example/auth/confirm?token_hash=secret-hash&type=${type}&next=%2Fignored&leak=raw`,
        ),
      );

      expect(verifyOtp).toHaveBeenCalledOnce();
      expect(verifyOtp).toHaveBeenCalledWith({
        token_hash: "secret-hash",
        type,
      });
      expect(response.headers.get("location")).toBe(
        `https://app.example${pathname}`,
      );
      expect(response.headers.get("location")).not.toContain("secret-hash");
      expect(response.headers.get("location")).not.toContain("leak");
    },
  );

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

      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        "https://app.example/login?error=invalid_link",
      );
    },
  );

  it("maps verification failure to invalid_link without exposing auth data", async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: "otp_expired", message: "raw backend message" },
    });

    const response = await GET(
      new Request(
        "https://request-host.example/auth/confirm?token_hash=secret-hash&type=email&error=raw",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=invalid_link",
    );
    expect(response.headers.get("location")).not.toContain("secret-hash");
    expect(response.headers.get("location")).not.toContain("raw");
  });
});
