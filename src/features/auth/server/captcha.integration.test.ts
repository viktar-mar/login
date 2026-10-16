// @vitest-environment node

import { createClient } from "@supabase/supabase-js";
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

import { authConfig } from "@/config/auth";
import {
  sendPasswordRecovery,
  signInWithPassword,
  signUpWithPassword,
} from "./service";

afterEach(() => {
  authConfig.captcha = { provider: "none", siteKey: "" };
});

it.each([
  ["login", "/token?grant_type=password"],
  ["signup", "/signup?redirect_to=https%3A%2F%2Fapp.example"],
  [
    "forgot",
    "/recover?redirect_to=https%3A%2F%2Fapp.example%2Fauth%2Fcallback%3Fnext%3D%252Fupdate-password",
  ],
] as const)(
  "sends the CAPTCHA through the real SDK in the %s HTTP request",
  async (mode, path) => {
    authConfig.captcha = { provider: "turnstile", siteKey: "public-site-key" };
    const authFetch = vi.fn(async () =>
      Response.json(
        { code: "captcha_failed", msg: "private verifier details" },
        { status: 400, headers: { "x-supabase-api-version": "2024-01-01" } },
      ),
    );
    const client = createClient(
      "https://project.example",
      "sb_publishable_test_key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: authFetch },
      },
    );
    const input = {
      email: "reader@example.test",
      password: "password",
      confirmPassword: "password",
      captchaToken: "one-time-token",
    };
    const result = await {
      login: signInWithPassword,
      signup: signUpWithPassword,
      forgot: sendPasswordRecovery,
    }[mode](client, input);
    expect(result).toEqual({ ok: false, error: "captcha_failed" });
    expect(authFetch).toHaveBeenCalledOnce();
    const [url, init] = authFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://project.example/auth/v1${path}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      email: input.email,
      gotrue_meta_security: { captcha_token: "one-time-token" },
    });
  },
);
