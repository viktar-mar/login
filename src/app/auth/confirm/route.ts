import { NextResponse } from "next/server";
import { publicEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Recovery uses the PKCE callback so its verified session retains recovery AMR.
const confirmationTypes = ["email"] as const;
type ConfirmationType = (typeof confirmationTypes)[number];

function isConfirmationType(value: string): value is ConfirmationType {
  return confirmationTypes.some((type) => type === value);
}

function redirectTo(path: string, error?: "invalid_link") {
  const destination = new URL(publicEnv.siteUrl);

  destination.pathname = path;
  destination.search = "";
  destination.hash = "";

  if (error) {
    destination.searchParams.set("error", error);
  }

  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const tokenHashes = searchParams.getAll("token_hash");
  const types = searchParams.getAll("type");
  const tokenHash = tokenHashes[0];
  const type = types[0];

  if (
    tokenHashes.length !== 1 ||
    !tokenHash ||
    types.length !== 1 ||
    !type ||
    !isConfirmationType(type)
  ) {
    return redirectTo("/login", "invalid_link");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      return redirectTo("/login", "invalid_link");
    }
  } catch {
    return redirectTo("/login", "invalid_link");
  }

  return redirectTo("/dashboard");
}
