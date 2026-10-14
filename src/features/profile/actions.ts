"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { profileSchema } from "./schema";
import type { ProfileActionState } from "./types";

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    avatarUrl: formData.get("avatarUrl") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      code: "validation",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const identity = await getVerifiedIdentity(supabase);
    if (!identity) return { status: "error", code: "unauthorized" };

    // Never use a submitted ID or elevate the request client: RLS is mandatory.
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        avatar_url: parsed.data.avatarUrl,
      })
      .eq("id", identity.userId)
      .select("id")
      .maybeSingle();

    if (error || !data) return { status: "error", code: "unexpected" };

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { status: "success" };
  } catch {
    return { status: "error", code: "unexpected" };
  }
}
