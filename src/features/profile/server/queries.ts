import type { SupabaseClient } from "@supabase/supabase-js";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import type { Profile } from "../types";

export async function getOwnProfile(
  supabase: SupabaseClient,
): Promise<Profile | null> {
  const identity = await getVerifiedIdentity(supabase);
  if (!identity) return null;

  // The explicit owner filter supplements the mandatory database RLS policy.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, updated_at")
    .eq("id", identity.userId)
    .maybeSingle<Profile>();

  if (error) throw new Error("Unable to load profile");
  return data;
}
