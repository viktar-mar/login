import { NextResponse } from "next/server";
import { publicEnv } from "@/config/env";
import { siteConfig } from "@/config/site";
import { privateAuthResponse } from "@/lib/auth/private-response";
import { safeNextPath } from "@/lib/navigation/safe-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function redirectTo(path: string, error?: "invalid_link") {
  const destination = new URL(publicEnv.siteUrl);
  const localTarget = new URL(path, publicEnv.siteUrl);

  destination.pathname = localTarget.pathname;
  destination.search = "";
  destination.hash = localTarget.hash;

  if (error) {
    destination.searchParams.set("error", error);
  } else {
    destination.search = localTarget.search;
  }

  return privateAuthResponse(NextResponse.redirect(destination));
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const codes = searchParams.getAll("code");

  if (codes.length !== 1 || !codes[0]) {
    return redirectTo("/login", "invalid_link");
  }

  const nextValues = searchParams.getAll("next");
  const next = safeNextPath(
    nextValues.length === 1 ? nextValues[0] : undefined,
    siteConfig.afterLoginPath,
  );

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(codes[0]);

    if (error) {
      return redirectTo("/login", "invalid_link");
    }
  } catch {
    return redirectTo("/login", "invalid_link");
  }

  return redirectTo(next);
}
