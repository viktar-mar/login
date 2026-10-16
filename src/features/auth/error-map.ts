import type { AuthErrorCode } from "./types";

const authErrorCodes: Readonly<Record<string, AuthErrorCode>> = {
  captcha_failed: "captcha_failed",
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  weak_password: "weak_password",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  over_sms_send_rate_limit: "rate_limited",
  otp_expired: "invalid_link",
  bad_code_verifier: "invalid_link",
  bad_oauth_state: "invalid_link",
  bad_oauth_callback: "invalid_link",
  flow_state_not_found: "invalid_link",
  flow_state_expired: "invalid_link",
  provider_disabled: "provider_unavailable",
  oauth_provider_not_supported: "provider_unavailable",
  email_provider_disabled: "provider_unavailable",
  signup_disabled: "provider_unavailable",
};

export function mapAuthError(error: unknown): AuthErrorCode {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return Object.prototype.hasOwnProperty.call(authErrorCodes, error.code)
      ? authErrorCodes[error.code]
      : "unexpected";
  }

  return "unexpected";
}
