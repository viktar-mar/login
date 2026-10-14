export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "weak_password"
  | "rate_limited"
  | "invalid_link"
  | "provider_unavailable"
  | "unexpected";

export type AuthActionState =
  | { status: "idle" }
  | { status: "success"; code: "check_email" | "recovery_sent" }
  | {
      status: "error";
      code: AuthErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

export type AuthServiceResult<T = undefined> =
  | ([T] extends [undefined] ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: AuthErrorCode };
