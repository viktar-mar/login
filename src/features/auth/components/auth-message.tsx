"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDictionary } from "@/i18n/provider";
import type { AuthActionState } from "../types";

export type AuthMessageProps = {
  state: AuthActionState;
};

export function AuthMessage({ state }: AuthMessageProps) {
  const { dictionary } = useDictionary();

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "success") {
    const message =
      state.code === "check_email"
        ? dictionary.signup.checkEmail
        : dictionary.passwordRecovery.success;

    return (
      <Alert role="status">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  const messages = {
    captcha_failed: dictionary.captcha.failed,
    invalid_credentials: dictionary.errors.invalidCredentials,
    email_not_confirmed: dictionary.errors.emailNotConfirmed,
    weak_password: dictionary.validation.passwordMinLength,
    rate_limited: dictionary.errors.generic,
    invalid_link: dictionary.errors.recoveryLinkInvalid,
    provider_unavailable: dictionary.errors.generic,
    unexpected: dictionary.errors.generic,
  } satisfies Record<typeof state.code, string>;

  return (
    <Alert variant="destructive">
      <AlertDescription>{messages[state.code]}</AlertDescription>
    </Alert>
  );
}
