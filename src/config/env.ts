import { parsePublicEnv } from "./env-schema";

export const publicEnv = parsePublicEnv({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  authProviders: process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
  emailAuth: process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH,
  captchaProvider: process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER,
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
});
