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
