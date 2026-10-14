import { beforeAll, describe, expect, it, vi } from "vitest";

let schemas: typeof import("./schemas");

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example");
  vi.stubEnv("NEXT_PUBLIC_AUTH_PROVIDERS", "google,github");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_EMAIL_AUTH", "true");

  schemas = await import("./schemas");
});

describe("auth schemas", () => {
  it("rejects an invalid login email", () => {
    const result = schemas.loginSchema.safeParse({
      email: "not-an-email",
      password: "password",
      next: "/dashboard",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toBeDefined();
  });

  it.each([
    [
      "login",
      () =>
        schemas.loginSchema.safeParse({
          email: "user@example.com",
          password: "1234567",
        }),
    ],
    [
      "signup",
      () =>
        schemas.signupSchema.safeParse({
          email: "user@example.com",
          password: "1234567",
          confirmPassword: "1234567",
        }),
    ],
    [
      "update password",
      () =>
        schemas.updatePasswordSchema.safeParse({
          password: "1234567",
          confirmPassword: "1234567",
        }),
    ],
  ])("rejects a seven-character password for %s", (_name, parse) => {
    expect(parse().success).toBe(false);
  });

  it("rejects mismatched signup password confirmation", () => {
    const result = schemas.signupSchema.safeParse({
      email: "user@example.com",
      password: "correct-password",
      confirmPassword: "different-password",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.confirmPassword).toBeDefined();
  });

  it("rejects mismatched updated password confirmation", () => {
    const result = schemas.updatePasswordSchema.safeParse({
      password: "correct-password",
      confirmPassword: "different-password",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.confirmPassword).toBeDefined();
  });

  it("rejects a supported provider that is disabled in auth configuration", () => {
    expect(
      schemas.providerSchema.safeParse({ provider: "facebook" }).success,
    ).toBe(false);
  });

  it("accepts a provider enabled in auth configuration", () => {
    expect(schemas.providerSchema.parse({ provider: "github" })).toEqual({
      provider: "github",
    });
  });
});
