import { AuthApiError } from "@supabase/supabase-js";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AuthServiceClient } from "./service";

type AuthMethod = ReturnType<typeof vi.fn>;
type AuthDouble = {
  auth: {
    signInWithPassword: AuthMethod;
    signUp: AuthMethod;
    resetPasswordForEmail: AuthMethod;
    updateUser: AuthMethod;
    signOut: AuthMethod;
    signInWithOAuth: AuthMethod;
  };
};

let service: typeof import("./service");
let client: AuthDouble & AuthServiceClient;
let authConfig: typeof import("@/config/auth").authConfig;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example/base-path/");
  vi.stubEnv(
    "NEXT_PUBLIC_AUTH_PROVIDERS",
    "google,facebook,apple,github,azure,discord",
  );
  vi.stubEnv("NEXT_PUBLIC_ENABLE_EMAIL_AUTH", "true");

  service = await import("./service");
  authConfig = (await import("@/config/auth")).authConfig;
});

afterEach(() => {
  Object.assign(authConfig, { captcha: { provider: "none", siteKey: "" } });
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
    },
  } as unknown as AuthDouble & AuthServiceClient;
});

describe("auth server service", () => {
  it("passes CAPTCHA through all protected email flows without losing redirects", async () => {
    Object.assign(authConfig, {
      captcha: { provider: "turnstile", siteKey: "public-key" },
    });
    client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    client.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });
    const input = {
      email: "reader@example.com",
      password: "password",
      confirmPassword: "password",
      captchaToken: "one-time-token",
    };
    await service.signInWithPassword(client, input);
    await service.signUpWithPassword(client, input);
    await service.sendPasswordRecovery(client, input);
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: { captchaToken: "one-time-token" },
    });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: "https://app.example",
        captchaToken: "one-time-token",
      },
    });
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      input.email,
      {
        redirectTo: "https://app.example/auth/callback?next=%2Fupdate-password",
        captchaToken: "one-time-token",
      },
    );
  });

  it.each([
    "signInWithPassword",
    "signUpWithPassword",
    "sendPasswordRecovery",
  ] as const)(
    "fails closed without a token in %s even when called outside an action",
    async (method) => {
      Object.assign(authConfig, {
        captcha: { provider: "turnstile", siteKey: "public-key" },
      });
      const result = await service[method](client, {
        email: "reader@example.com",
        password: "password",
        confirmPassword: "password",
      });
      expect(result).toEqual({ ok: false, error: "captcha_failed" });
      expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(client.auth.signUp).not.toHaveBeenCalled();
      expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    },
  );

  it("signs in with a password and preserves a safe local continuation", async () => {
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "secret" } },
      error: null,
    });

    const result = await service.signInWithPassword(client, {
      email: "user@example.com",
      password: "password",
      next: "/profile?tab=security",
    });

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
    });
    expect(result).toEqual({
      ok: true,
      data: { redirectTo: "/profile?tab=security" },
    });
  });

  it("replaces an unsafe login continuation with the configured landing page", async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    const result = await service.signInWithPassword(client, {
      email: "user@example.com",
      password: "password",
      next: "//attacker.example/steal",
    });

    expect(result).toEqual({ ok: true, data: { redirectTo: "/dashboard" } });
  });

  it("signs up with an email redirect derived only from the configured site origin", async () => {
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    });

    const result = await service.signUpWithPassword(client, {
      email: "user@example.com",
      password: "password",
      confirmPassword: "password",
    });

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
      options: { emailRedirectTo: "https://app.example" },
    });
    expect(result).toEqual({ ok: true, data: { status: "check_email" } });
  });

  it("returns a safe error code for a Supabase signup failure", async () => {
    client.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "weak_password", message: "sensitive password detail" },
    });

    const result = await service.signUpWithPassword(client, {
      email: "user@example.com",
      password: "password",
      confirmPassword: "password",
    });

    expect(result).toEqual({ ok: false, error: "weak_password" });
    expect(JSON.stringify(result)).not.toContain("sensitive password detail");
  });

  it.each([
    ["email_exists", "returned"],
    ["user_already_exists", "returned"],
    ["email_exists", "rejected"],
    ["user_already_exists", "rejected"],
  ] as const)(
    "normalizes %s (%s) to the same signup result as a new account",
    async (code, delivery) => {
      const input = {
        email: "user@example.com",
        password: "password",
        confirmPassword: "password",
      };
      client.auth.signUp.mockResolvedValueOnce({
        data: { user: { id: "user-1" }, session: null },
        error: null,
      });
      const newAccount = await service.signUpWithPassword(client, input);
      const error = new AuthApiError("User already registered", 422, code);
      if (delivery === "returned") {
        client.auth.signUp.mockResolvedValueOnce({
          data: { user: null, session: null },
          error,
        });
      } else {
        client.auth.signUp.mockRejectedValueOnce(error);
      }

      const duplicate = await service.signUpWithPassword(client, input);

      expect(duplicate).toEqual({ ok: true, data: { status: "check_email" } });
      expect(JSON.stringify(duplicate)).toBe(JSON.stringify(newAccount));
    },
  );

  it.each([
    ["signup_disabled", "provider_unavailable"],
    ["email_provider_disabled", "provider_unavailable"],
    ["over_email_send_rate_limit", "rate_limited"],
    ["unexpected_failure", "unexpected"],
    ["identity_already_exists", "unexpected"],
    [undefined, "unexpected"],
  ] as const)(
    "keeps non-signup-duplicate code %s distinct even with duplicate-looking error text",
    async (code, expected) => {
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError("User already registered", 422, code),
      });

      const result = await service.signUpWithPassword(client, {
        email: "user@example.com",
        password: "password",
        confirmPassword: "password",
      });

      expect(result).toEqual({ ok: false, error: expected });
      expect(JSON.stringify(result)).not.toContain("User already registered");
    },
  );

  it("sends recovery through PKCE with the password-update continuation", async () => {
    client.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });

    const result = await service.sendPasswordRecovery(client, {
      email: "user@example.com",
    });

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      {
        redirectTo: "https://app.example/auth/callback?next=%2Fupdate-password",
      },
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns the same neutral recovery result when Supabase reveals no user", async () => {
    client.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { code: "user_not_found", message: "User does not exist" },
    });

    const result = await service.sendPasswordRecovery(client, {
      email: "missing@example.com",
    });

    expect(result).toEqual({ ok: true });
    expect(JSON.stringify(result)).not.toContain("User does not exist");
  });

  it("updates the current user's password", async () => {
    client.auth.updateUser.mockResolvedValue({
      data: { user: {} },
      error: null,
    });

    const result = await service.updatePassword(client, {
      password: "new-password",
      confirmPassword: "new-password",
    });

    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: "new-password",
    });
    expect(result).toEqual({ ok: true });
  });

  it("signs out the current session", async () => {
    client.auth.signOut.mockResolvedValue({ error: null });

    const result = await service.signOut(client);

    expect(client.auth.signOut).toHaveBeenCalledWith();
    expect(result).toEqual({ ok: true });
  });

  it("rejects a disabled OAuth provider without contacting Supabase", async () => {
    const { authConfig } = await import("@/config/auth");
    const enabledProviders = authConfig.providers;
    authConfig.providers = ["google", "github"];
    try {
      const result = await service.signInWithOAuth(client, {
        provider: "facebook",
        next: "/dashboard",
      });

      expect(client.auth.signInWithOAuth).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, error: "provider_unavailable" });
    } finally {
      authConfig.providers = enabledProviders;
    }
  });

  it("starts enabled OAuth with a safe callback built from the site origin", async () => {
    client.auth.signInWithOAuth.mockResolvedValue({
      data: {
        provider: "github",
        url: "https://github.com/login/oauth/authorize?safe=1",
      },
      error: null,
    });

    const result = await service.signInWithOAuth(client, {
      provider: "github",
      next: "//attacker.example/steal",
    });

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: "https://app.example/auth/callback?next=%2Fdashboard",
      },
    });
    expect(result).toEqual({
      ok: true,
      data: { redirectTo: "https://github.com/login/oauth/authorize?safe=1" },
    });
  });

  it.each([
    ["azure", { scopes: "email" }],
    ["google", {}],
    ["facebook", {}],
    ["apple", {}],
    ["github", {}],
    ["discord", {}],
  ] as const)(
    "sends provider-specific OAuth options for %s",
    async (provider, options) => {
      client.auth.signInWithOAuth.mockResolvedValue({
        data: { provider, url: "https://project.example/auth/v1/authorize" },
        error: null,
      });

      const result = await service.signInWithOAuth(client, {
        provider,
        next: "/profile",
      });

      expect(client.auth.signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
        provider,
        options: {
          redirectTo: "https://app.example/auth/callback?next=%2Fprofile",
          ...options,
        },
      });
      expect(result).toEqual({
        ok: true,
        data: { redirectTo: "https://project.example/auth/v1/authorize" },
      });
    },
  );
});
