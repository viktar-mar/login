import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env-schema";

const validInput = {
  supabaseUrl: "http://127.0.0.1:54321",
  supabasePublishableKey: "sb_publishable_test_key",
  siteUrl: "http://localhost:3000",
  authProviders: "google,github",
  emailAuth: "true",
};

describe("parsePublicEnv", () => {
  it("leaves CAPTCHA off without additional configuration", () => {
    expect(parsePublicEnv(validInput)).toMatchObject({
      captchaProvider: "none",
      turnstileSiteKey: "",
    });
  });

  it("accepts Turnstile only with its public site key", () => {
    expect(
      parsePublicEnv({
        ...validInput,
        captchaProvider: "turnstile",
        turnstileSiteKey: "public-site-key",
      }),
    ).toMatchObject({
      captchaProvider: "turnstile",
      turnstileSiteKey: "public-site-key",
    });
  });

  it.each([undefined, "", "   "])(
    "fails closed for Turnstile without a usable site key: %j",
    (turnstileSiteKey) => {
      expect(() =>
        parsePublicEnv({
          ...validInput,
          captchaProvider: "turnstile",
          turnstileSiteKey,
        }),
      ).toThrow();
    },
  );

  it("rejects an unknown CAPTCHA provider", () => {
    expect(() =>
      parsePublicEnv({ ...validInput, captchaProvider: "unknown" }),
    ).toThrow();
  });

  it("parses enabled providers in their configured order", () => {
    expect(parsePublicEnv(validInput).authProviders).toEqual([
      "google",
      "github",
    ]);
  });

  it("rejects unknown auth providers", () => {
    expect(() =>
      parsePublicEnv({ ...validInput, authProviders: "google,unknown" }),
    ).toThrow(/unknown/i);
  });

  it("rejects configurations with no enabled authentication method", () => {
    expect(() =>
      parsePublicEnv({ ...validInput, authProviders: "", emailAuth: "false" }),
    ).toThrow(/method/i);
  });
});
