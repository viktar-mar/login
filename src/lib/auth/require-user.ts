import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { safeNextPath } from "@/lib/navigation/safe-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireUser(nextPath?: string) {
  const supabase = await createServerSupabaseClient();
  const identity = await getVerifiedIdentity(supabase);

  if (!identity) {
    const next = safeNextPath(nextPath, siteConfig.afterLoginPath);
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return { supabase, ...identity };
}
