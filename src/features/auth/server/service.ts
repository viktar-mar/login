import { authConfig } from "@/config/auth";
import { publicEnv } from "@/config/env";
import { siteConfig } from "@/config/site";
import { safeNextPath } from "@/lib/navigation/safe-next";
import { mapAuthError } from "../error-map";
import type {
  ForgotPasswordInput,
  LoginInput,
  ProviderInput,
  SignupInput,
  UpdatePasswordInput,
} from "../schemas";
import type { AuthServiceResult } from "../types";

type AuthResponse<T = unknown> = Promise<{ data: T; error: unknown }>;

export type AuthServiceClient = {
  auth: {
    signInWithPassword(input: {
      email: string;
      password: string;
    }): AuthResponse;
    signUp(input: {
      email: string;
      password: string;
      options: { emailRedirectTo: string };
    }): AuthResponse<{ session?: unknown | null }>;
    resetPasswordForEmail(
      email: string,
      options: { redirectTo: string },
    ): AuthResponse;
    updateUser(input: { password: string }): AuthResponse;
    signOut(): Promise<{ error: unknown }>;
    signInWithOAuth(input: {
      provider: ProviderInput["provider"];
      options: { redirectTo: string; scopes?: string };
    }): AuthResponse<{ url?: string | null }>;
  };
};

type RedirectResult = AuthServiceResult<{ redirectTo: string }>;
type SignupResult = AuthServiceResult<
  { status: "check_email" } | { status: "authenticated"; redirectTo: string }
>;

function signupErrorResult(error: unknown): SignupResult {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "email_exists" || error.code === "user_already_exists")
  ) {
    return { ok: true, data: { status: "check_email" } };
  }

  return { ok: false, error: mapAuthError(error) };
}

function siteOrigin(): string {
  return new URL(publicEnv.siteUrl).origin;
}

function disabledEmailResult(): {
  ok: false;
  error: "provider_unavailable";
} {
  return { ok: false, error: "provider_unavailable" };
}

function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "user_not_found"
  );
}

export async function signInWithPassword(
  client: AuthServiceClient,
  input: LoginInput,
): Promise<RedirectResult> {
  if (!authConfig.emailEnabled) {
    return disabledEmailResult();
  }

  try {
    const { error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      return { ok: false, error: mapAuthError(error) };
    }

    return {
      ok: true,
      data: {
        redirectTo: safeNextPath(input.next, siteConfig.afterLoginPath),
      },
    };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signUpWithPassword(
  client: AuthServiceClient,
  input: SignupInput,
): Promise<SignupResult> {
  if (!authConfig.emailEnabled) {
    return disabledEmailResult();
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: siteOrigin() },
    });

    if (error) {
      return signupErrorResult(error);
    }

    if (!data.session) {
      return { ok: true, data: { status: "check_email" } };
    }

    return {
      ok: true,
      data: {
        status: "authenticated",
        redirectTo: safeNextPath(input.next, siteConfig.afterLoginPath),
      },
    };
  } catch (error) {
    return signupErrorResult(error);
  }
}

export async function sendPasswordRecovery(
  client: AuthServiceClient,
  input: ForgotPasswordInput,
): Promise<AuthServiceResult> {
  if (!authConfig.emailEnabled) {
    return disabledEmailResult();
  }

  try {
    const { error } = await client.auth.resetPasswordForEmail(input.email, {
      redirectTo: new URL(
        "/auth/callback?next=%2Fupdate-password",
        siteOrigin(),
      ).href,
    });

    if (error && !isUserNotFound(error)) {
      return { ok: false, error: mapAuthError(error) };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function updatePassword(
  client: AuthServiceClient,
  input: UpdatePasswordInput,
): Promise<AuthServiceResult> {
  if (!authConfig.emailEnabled) {
    return disabledEmailResult();
  }

  try {
    const { error } = await client.auth.updateUser({
      password: input.password,
    });

    return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signOut(
  client: AuthServiceClient,
): Promise<AuthServiceResult> {
  try {
    const { error } = await client.auth.signOut();

    return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

export async function signInWithOAuth(
  client: AuthServiceClient,
  input: ProviderInput,
): Promise<RedirectResult> {
  if (!authConfig.providers.includes(input.provider)) {
    return { ok: false, error: "provider_unavailable" };
  }

  const callbackUrl = new URL("/auth/callback", siteOrigin());
  callbackUrl.searchParams.set(
    "next",
    safeNextPath(input.next, siteConfig.afterLoginPath),
  );

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: input.provider,
      options: {
        redirectTo: callbackUrl.href,
        ...(input.provider === "azure" ? { scopes: "email" } : {}),
      },
    });

    if (error || !data.url) {
      return { ok: false, error: mapAuthError(error) };
    }

    return { ok: true, data: { redirectTo: data.url } };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}
