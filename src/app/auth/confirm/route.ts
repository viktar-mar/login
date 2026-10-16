import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { publicEnv } from "@/config/env";
import { privateAuthResponse } from "@/lib/auth/private-response";

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
  } else {
    destination.searchParams.set("confirmed", "email");
  }

  return privateAuthResponse(NextResponse.redirect(destination));
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
    // A confirmation link is a bearer credential, not proof that this browser
    // owns the account. Never install its session or read the visitor's cookies.
    const supabase = createClient(
      publicEnv.supabaseUrl,
      publicEnv.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error || !data.user?.id) {
      return redirectTo("/login", "invalid_link");
    }
  } catch {
    return redirectTo("/login", "invalid_link");
  }

  return redirectTo("/login");
}
