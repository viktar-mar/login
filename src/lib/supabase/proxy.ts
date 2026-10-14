import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/config/env";
import { siteConfig } from "@/config/site";
import { safeNextPath } from "@/lib/navigation/safe-next";

export type AuthRoute = "protected" | "anonymous-only" | "public";

type CookieWrite = {
  name: string;
  value: string;
  options: CookieOptions;
};

const protectedRoutes = ["/dashboard", "/profile", "/update-password"];
const anonymousOnlyRoutes = ["/login", "/signup", "/forgot-password"];

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function classifyAuthRoute(pathname: string): AuthRoute {
  if (protectedRoutes.some((route) => matchesRoute(pathname, route))) {
    return "protected";
  }

  if (anonymousOnlyRoutes.some((route) => matchesRoute(pathname, route))) {
    return "anonymous-only";
  }

  return "public";
}

function hasVerifiedSubject(
  claims: Partial<JwtPayload> | null | undefined,
): claims is Partial<JwtPayload> & { sub: string } {
  return typeof claims?.sub === "string" && claims.sub.length > 0;
}

export function getAuthRedirect(
  request: NextRequest,
  claims: Partial<JwtPayload> | null | undefined,
): URL | null {
  const route = classifyAuthRoute(request.nextUrl.pathname);

  if (route === "protected" && !hasVerifiedSubject(claims)) {
    const loginUrl = new URL("/login", request.url);
    const requestedPath = safeNextPath(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      siteConfig.afterLoginPath,
    );
    loginUrl.searchParams.set("next", requestedPath);
    return loginUrl;
  }

  if (route === "anonymous-only" && hasVerifiedSubject(claims)) {
    return new URL(siteConfig.afterLoginPath, request.url);
  }

  return null;
}

function applySessionWrites(
  response: NextResponse,
  cookies: CookieWrite[],
  headers: Map<string, string>,
) {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  headers.forEach((value, name) => {
    response.headers.set(name, value);
  });
}

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  const sessionCookies: CookieWrite[] = [];
  const sessionHeaders = new Map<string, string>();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          sessionCookies.push(...cookiesToSet);
          Object.entries(headers).forEach(([name, value]) => {
            sessionHeaders.set(name, value);
          });

          response = NextResponse.next({ request });
          applySessionWrites(response, sessionCookies, sessionHeaders);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const redirectUrl = getAuthRedirect(request, data?.claims);

  if (!redirectUrl) {
    return response;
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);
  applySessionWrites(redirectResponse, sessionCookies, sessionHeaders);
  return redirectResponse;
}
