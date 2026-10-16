"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  providerSchema,
  signupSchema,
  updatePasswordSchema,
} from "./schemas";
import {
  sendPasswordRecovery,
  signInWithOAuth,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from "./server/service";
import type { AuthActionState, AuthErrorCode } from "./types";

type SafeParseError = {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
};

function formValues(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

function invalidFormState(
  error: SafeParseError,
  code: AuthErrorCode = "unexpected",
): AuthActionState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );

  return {
    status: "error",
    code: fieldErrors.captchaToken ? "captcha_failed" : code,
    fieldErrors,
  };
}

async function getClient(): Promise<SupabaseClient | null> {
  try {
    return await createServerSupabaseClient();
  } catch {
    return null;
  }
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return invalidFormState(parsed.error);
  }

  const client = await getClient();
  if (!client) {
    return { status: "error", code: "unexpected" };
  }

  const result = await signInWithPassword(client, parsed.data);
  if (!result.ok) {
    return { status: "error", code: result.error };
  }

  redirect(result.data.redirectTo);
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return invalidFormState(parsed.error);
  }

  const client = await getClient();
  if (!client) {
    return { status: "error", code: "unexpected" };
  }

  const result = await signUpWithPassword(client, parsed.data);
  if (!result.ok) {
    return { status: "error", code: result.error };
  }

  if (result.data.status === "check_email") {
    return { status: "success", code: "check_email" };
  }

  redirect(result.data.redirectTo);
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return invalidFormState(parsed.error);
  }

  const client = await getClient();
  if (!client) {
    return { status: "error", code: "unexpected" };
  }

  const result = await sendPasswordRecovery(client, parsed.data);
  return result.ok
    ? { status: "success", code: "recovery_sent" }
    : { status: "error", code: result.error };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return invalidFormState(parsed.error);
  }

  const client = await getClient();
  if (!client) {
    return { status: "error", code: "unexpected" };
  }

  const identity = await getVerifiedIdentity(client, {
    requiredAuthMethod: "recovery",
  });
  if (!identity) {
    return { status: "error", code: "invalid_link" };
  }

  const result = await updatePassword(client, parsed.data);
  if (!result.ok) {
    return { status: "error", code: result.error };
  }

  const signOutResult = await signOut(client);
  if (!signOutResult.ok) {
    return { status: "error", code: signOutResult.error };
  }

  redirect("/login");
}

export async function signOutAction(): Promise<AuthActionState> {
  const client = await getClient();
  if (!client) {
    return { status: "error", code: "unexpected" };
  }

  const result = await signOut(client);
  if (!result.ok) {
    return { status: "error", code: result.error };
  }

  redirect("/login");
}

export async function oauthAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = providerSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return invalidFormState(parsed.error, "provider_unavailable");
  }

  const client = await getClient();
  if (!client) {
    return { status: "error", code: "unexpected" };
  }

  const result = await signInWithOAuth(client, parsed.data);
  if (!result.ok) {
    return { status: "error", code: result.error };
  }

  redirect(result.data.redirectTo);
}
