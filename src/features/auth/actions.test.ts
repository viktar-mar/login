import { AuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuthActionState } from "./types";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

type AuthDouble = {
  auth: {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    signInWithOAuth: ReturnType<typeof vi.fn>;
    getClaims: ReturnType<typeof vi.fn>;
  };
};

const idle: AuthActionState = { status: "idle" };
let actions: typeof import("./actions");
let client: AuthDouble;

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

async function expectRedirect(
  promise: Promise<unknown>,
  destination: string,
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected action to redirect");
  } catch (error) {
    expect(error).toMatchObject({
      digest: expect.stringContaining(`;${destination};`),
    });
  }
}

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example");
  vi.stubEnv(
    "NEXT_PUBLIC_AUTH_PROVIDERS",
    "google,facebook,apple,github,azure,discord",
  );
  vi.stubEnv("NEXT_PUBLIC_ENABLE_EMAIL_AUTH", "true");

  actions = await import("./actions");
});

beforeEach(() => {
  client = {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
      getClaims: vi.fn().mockResolvedValue({
        data: {
          claims: {
            sub: "user-1",
            amr: [{ method: "recovery", timestamp: 1_789_164_000 }],
          },
          header: { alg: "RS256", typ: "JWT" },
          signature: new Uint8Array(),
        },
        error: null,
      }),
    },
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(
    client as unknown as SupabaseClient,
  );
});

describe("auth server actions", () => {
  it("rejects invalid login FormData before creating a Supabase client", async () => {
    const result = await actions.loginAction(
      idle,
      formData({ email: "not-an-email", password: "1234567" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: "unexpected",
      fieldErrors: {
        email: expect.any(Array),
        password: expect.any(Array),
      },
    });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("redirects a successful login only to its sanitized continuation", async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    await expectRedirect(
      actions.loginAction(
        idle,
        formData({
          email: "user@example.com",
          password: "password",
          next: "//attacker.example/steal",
        }),
      ),
      "/dashboard",
    );
  });

  it("returns check_email after signup requiring confirmation", async () => {
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    });

    const result = await actions.signupAction(
      idle,
      formData({
        email: "user@example.com",
        password: "password",
        confirmPassword: "password",
      }),
    );

    expect(result).toEqual({ status: "success", code: "check_email" });
  });

  it.each([
    ["email_exists", "returned"],
    ["user_already_exists", "returned"],
    ["email_exists", "rejected"],
    ["user_already_exists", "rejected"],
  ] as const)(
    "returns indistinguishable serializable signup state for %s (%s) and a new account",
    async (code, delivery) => {
      const input = formData({
        email: "user@example.com",
        password: "password",
        confirmPassword: "password",
      });
      client.auth.signUp.mockResolvedValueOnce({
        data: { user: { id: "user-1" }, session: null },
        error: null,
      });
      const newAccount = await actions.signupAction(idle, input);
      const error = new AuthApiError("User already registered", 422, code);
      if (delivery === "returned") {
        client.auth.signUp.mockResolvedValueOnce({
          data: { user: null, session: null },
          error,
        });
      } else {
        client.auth.signUp.mockRejectedValueOnce(error);
      }

      const duplicate = await actions.signupAction(idle, input);

      expect(duplicate).toEqual({ status: "success", code: "check_email" });
      expect(JSON.stringify(duplicate)).toBe(JSON.stringify(newAccount));
      expect(JSON.parse(JSON.stringify(duplicate))).toEqual(duplicate);
    },
  );

  it.each([
    ["signup_disabled", "provider_unavailable"],
    ["over_email_send_rate_limit", "rate_limited"],
    ["unexpected_failure", "unexpected"],
  ] as const)(
    "preserves signup failure %s as a safe action error",
    async (code, expected) => {
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError("User already registered", 422, code),
      });

      const result = await actions.signupAction(
        idle,
        formData({
          email: "user@example.com",
          password: "password",
          confirmPassword: "password",
        }),
      );

      expect(result).toEqual({ status: "error", code: expected });
      expect(JSON.stringify(result)).not.toContain("User already registered");
    },
  );

  it("returns the same recovery_sent state when the account is absent", async () => {
    client.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { code: "user_not_found", message: "User not found" },
    });

    const result = await actions.forgotPasswordAction(
      idle,
      formData({ email: "missing@example.com" }),
    );

    expect(result).toEqual({ status: "success", code: "recovery_sent" });
    expect(JSON.stringify(result)).not.toContain("User not found");
  });

  it("ends the recovery session before returning to login after a password update", async () => {
    client.auth.updateUser.mockResolvedValue({
      data: { user: {} },
      error: null,
    });
    client.auth.signOut.mockResolvedValue({ error: null });

    await expectRedirect(
      actions.updatePasswordAction(
        idle,
        formData({
          password: "new-password",
          confirmPassword: "new-password",
        }),
      ),
      "/login",
    );
    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });

  it("does not redirect as signed out when ending the recovery session fails", async () => {
    client.auth.updateUser.mockResolvedValue({
      data: { user: {} },
      error: null,
    });
    client.auth.signOut.mockResolvedValue({ error: { code: "unexpected" } });

    const result = await actions.updatePasswordAction(
      idle,
      formData({ password: "new-password", confirmPassword: "new-password" }),
    );

    expect(result).toEqual({ status: "error", code: "unexpected" });
  });

  it("rejects a password update without a verified recovery AMR method", async () => {
    client.auth.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-1",
          amr: [{ method: "password", timestamp: 1_789_164_000 }],
        },
        header: { alg: "RS256", typ: "JWT" },
        signature: new Uint8Array(),
      },
      error: null,
    });

    const result = await actions.updatePasswordAction(
      idle,
      formData({
        password: "new-password",
        confirmPassword: "new-password",
      }),
    );

    expect(result).toEqual({ status: "error", code: "invalid_link" });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it("redirects to login after signing out", async () => {
    client.auth.signOut.mockResolvedValue({ error: null });

    await expectRedirect(actions.signOutAction(), "/login");
  });

  it("rejects disabled OAuth provider FormData before creating a client", async () => {
    const { authConfig } = await import("@/config/auth");
    const enabledProviders = authConfig.providers;
    authConfig.providers = ["google", "github"];
    try {
      const result = await actions.oauthAction(
        idle,
        formData({ provider: "facebook", next: "/dashboard" }),
      );

      expect(result).toEqual({
        status: "error",
        code: "provider_unavailable",
        fieldErrors: { provider: expect.any(Array) },
      });
      expect(createServerSupabaseClient).not.toHaveBeenCalled();
    } finally {
      authConfig.providers = enabledProviders;
    }
  });

  it("redirects to the Supabase OAuth URL only after a successful request", async () => {
    client.auth.signInWithOAuth.mockResolvedValue({
      data: {
        provider: "github",
        url: "https://github.com/login/oauth/authorize?safe=1",
      },
      error: null,
    });

    await expectRedirect(
      actions.oauthAction(
        idle,
        formData({ provider: "github", next: "/dashboard" }),
      ),
      "https://github.com/login/oauth/authorize?safe=1",
    );
  });

  it("returns a stable code and does not redirect after an expected failure", async () => {
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "raw backend message" },
    });

    const result = await actions.loginAction(
      idle,
      formData({ email: "user@example.com", password: "password" }),
    );

    expect(result).toEqual({ status: "error", code: "invalid_credentials" });
    expect(JSON.stringify(result)).not.toContain("raw backend message");
  });

  it.each([
    ["azure", { scopes: "email" }],
    ["google", {}],
    ["facebook", {}],
    ["apple", {}],
    ["github", {}],
    ["discord", {}],
  ] as const)(
    "preserves provider-specific OAuth options through the %s action",
    async (provider, options) => {
      client.auth.signInWithOAuth.mockResolvedValue({
        data: { provider, url: "https://project.example/auth/v1/authorize" },
        error: null,
      });

      await expectRedirect(
        actions.oauthAction(idle, formData({ provider, next: "/profile" })),
        "https://project.example/auth/v1/authorize",
      );
      expect(client.auth.signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
        provider,
        options: {
          redirectTo: "https://app.example/auth/callback?next=%2Fprofile",
          ...options,
        },
      });
    },
  );
});
