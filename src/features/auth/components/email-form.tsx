"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authConfig } from "@/config/auth";
import {
  forgotPasswordAction,
  loginAction,
  signupAction,
  updatePasswordAction,
} from "@/features/auth/actions";
import type { AuthActionState } from "@/features/auth/types";
import { useDictionary } from "@/i18n/provider";
import { safeNextPath } from "@/lib/navigation/safe-next";
import { siteConfig } from "@/config/site";
import { AuthMessage } from "./auth-message";
import { CaptchaWidget } from "./captcha-widget";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";

export type EmailFormMode = "login" | "signup" | "forgot" | "update";

export type EmailFormProps = {
  mode: EmailFormMode;
  next?: string;
};

const initialState: AuthActionState = { status: "idle" };

const actions = {
  login: loginAction,
  signup: signupAction,
  forgot: forgotPasswordAction,
  update: updatePasswordAction,
};

export function EmailForm({ mode, next }: EmailFormProps) {
  const { dictionary } = useDictionary();
  const baseId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaRequired =
    authConfig.captcha.provider === "turnstile" && mode !== "update";
  const sanitizedNext = safeNextPath(next, siteConfig.afterLoginPath);
  const selectedAction = actions[mode];
  const [state, formAction] = useActionState(
    async (previousState: AuthActionState, formData: FormData) => {
      try {
        return await selectedAction(previousState, formData);
      } finally {
        setPassword("");
        setConfirmation("");
        setCaptchaToken("");
        setCaptchaResetKey((value) => value + 1);
      }
    },
    initialState,
  );

  if (!authConfig.emailEnabled) {
    return null;
  }

  const hasEmail = mode !== "update";
  const hasPassword = mode !== "forgot";
  const hasConfirmation = mode === "signup" || mode === "update";
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const emailError = fieldErrors?.email
    ? dictionary.validation.emailInvalid
    : undefined;
  const passwordError = fieldErrors?.password
    ? dictionary.validation.passwordMinLength
    : undefined;
  const confirmationError = fieldErrors?.confirmPassword
    ? dictionary.validation.passwordMismatch
    : undefined;
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;
  const confirmationId = `${baseId}-confirmation`;
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;
  const confirmationErrorId = `${confirmationId}-error`;
  const submitLabel = {
    login: dictionary.auth.signIn,
    signup: dictionary.signup.submit,
    forgot: dictionary.auth.sendRecoveryLink,
    update: dictionary.auth.updatePassword,
  }[mode];
  const nextQuery = `next=${encodeURIComponent(sanitizedNext)}`;

  return (
    <form action={formAction} className="space-y-5" aria-label="Authentication">
      <AuthMessage state={state} />

      {(mode === "login" || mode === "signup") && (
        <input type="hidden" name="next" value={sanitizedNext} />
      )}

      {hasEmail ? (
        <div className="space-y-2">
          <Label htmlFor={emailId}>{dictionary.auth.email}</Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? emailErrorId : undefined}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          {emailError ? (
            <p id={emailErrorId} className="text-destructive text-sm">
              {emailError}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasPassword ? (
        <PasswordField
          id={passwordId}
          name="password"
          label={
            mode === "update"
              ? dictionary.auth.newPassword
              : dictionary.auth.password
          }
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={authConfig.passwordMinLength}
          required
          value={password}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? passwordErrorId : undefined}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      ) : null}
      {passwordError ? (
        <p id={passwordErrorId} className="text-destructive text-sm">
          {passwordError}
        </p>
      ) : null}

      {hasConfirmation ? (
        <PasswordField
          id={confirmationId}
          name="confirmPassword"
          label={dictionary.auth.confirmPassword}
          autoComplete="new-password"
          minLength={authConfig.passwordMinLength}
          required
          value={confirmation}
          aria-invalid={confirmationError ? true : undefined}
          aria-describedby={confirmationError ? confirmationErrorId : undefined}
          onChange={(event) => setConfirmation(event.currentTarget.value)}
        />
      ) : null}
      {confirmationError ? (
        <p id={confirmationErrorId} className="text-destructive text-sm">
          {confirmationError}
        </p>
      ) : null}

      {mode === "login" ? (
        <div className="text-right text-sm">
          <Link
            className="underline underline-offset-4"
            href="/forgot-password"
          >
            {dictionary.auth.forgotPassword}
          </Link>
        </div>
      ) : null}

      {captchaRequired ? (
        <>
          <input type="hidden" name="captchaToken" value={captchaToken} />
          <CaptchaWidget
            onTokenChange={setCaptchaToken}
            resetKey={captchaResetKey}
          />
        </>
      ) : null}
      <SubmitButton
        className="w-full"
        disabled={captchaRequired && !captchaToken}
      >
        {submitLabel}
      </SubmitButton>

      {mode === "login" ? (
        <p className="text-muted-foreground text-center text-sm">
          {dictionary.auth.noAccount}{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href={`/signup?${nextQuery}`}
          >
            {dictionary.auth.signUp}
          </Link>
        </p>
      ) : null}
      {mode === "signup" ? (
        <p className="text-muted-foreground text-center text-sm">
          {dictionary.auth.haveAccount}{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href={`/login?${nextQuery}`}
          >
            {dictionary.auth.signIn}
          </Link>
        </p>
      ) : null}
    </form>
  );
}
