import type { SupabaseClient } from "@supabase/supabase-js";

type ClaimsReader = {
  auth: Pick<SupabaseClient["auth"], "getClaims">;
};

export type VerifiedIdentity = {
  userId: string;
  email?: string;
};

export type VerifiedIdentityOptions = {
  requiredAuthMethod?: string;
};

export async function getVerifiedIdentity(
  supabase?: ClaimsReader,
  options: VerifiedIdentityOptions = {},
): Promise<VerifiedIdentity | null> {
  const client = supabase ?? (await createDefaultClaimsReader());
  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;

  if (
    error ||
    !claims ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    (options.requiredAuthMethod &&
      !hasAuthMethod(claims.amr, options.requiredAuthMethod))
  ) {
    return null;
  }

  return {
    userId: claims.sub,
    ...(typeof claims.email === "string" ? { email: claims.email } : {}),
  };
}

function hasAuthMethod(amr: unknown, requiredMethod: string): boolean {
  return (
    Array.isArray(amr) &&
    amr.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "method" in entry &&
        entry.method === requiredMethod,
    )
  );
}

async function createDefaultClaimsReader(): Promise<ClaimsReader> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  return createServerSupabaseClient();
}
