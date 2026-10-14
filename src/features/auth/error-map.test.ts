import { describe, expect, it } from "vitest";
import { mapAuthError } from "./error-map";

describe("mapAuthError", () => {
  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["email_not_confirmed", "email_not_confirmed"],
    ["weak_password", "weak_password"],
    ["over_request_rate_limit", "rate_limited"],
    ["over_email_send_rate_limit", "rate_limited"],
    ["otp_expired", "invalid_link"],
    ["flow_state_expired", "invalid_link"],
    ["provider_disabled", "provider_unavailable"],
    ["oauth_provider_not_supported", "provider_unavailable"],
  ] as const)("maps Supabase code %s to %s", (code, expected) => {
    expect(mapAuthError({ code, message: "backend detail" })).toBe(expected);
  });

  it("maps an unknown backend error to unexpected without returning its message", () => {
    const rawMessage = "secret backend detail containing a token";
    const result = mapAuthError({
      code: "new_server_code",
      message: rawMessage,
    });

    expect(result).toBe("unexpected");
    expect(JSON.stringify(result)).not.toContain(rawMessage);
  });

  it("maps thrown non-error values to unexpected", () => {
    expect(mapAuthError("raw backend failure")).toBe("unexpected");
  });

  it.each(["constructor", "toString", "__proto__"])(
    "maps inherited object key %s to unexpected",
    (code) => {
      expect(mapAuthError({ code })).toBe("unexpected");
    },
  );
});
