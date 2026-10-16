import { z } from "zod";

const providerSchema = z.enum([
  "google",
  "facebook",
  "apple",
  "github",
  "azure",
  "discord",
]);

const rawPublicEnvSchema = z.object({
  supabaseUrl: z
    .string()
    .min(1, "Supabase URL is required")
    .url("Supabase URL must be a valid URL"),
  supabasePublishableKey: z
    .string()
    .min(1, "Supabase publishable key is required"),
  siteUrl: z
    .string()
    .min(1, "Site URL is required")
    .url("Site URL must be a valid URL"),
  authProviders: z.string(),
  emailAuth: z.enum(["true", "false"]),
  captchaProvider: z.enum(["none", "turnstile"]).default("none"),
  turnstileSiteKey: z.string().trim().default(""),
});

export type AuthProvider = z.infer<typeof providerSchema>;

export type PublicEnvInput = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  siteUrl: string | undefined;
  authProviders: string | undefined;
  emailAuth: string | undefined;
  captchaProvider?: string;
  turnstileSiteKey?: string;
};

export type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  siteUrl: string;
  authProviders: AuthProvider[];
  emailAuth: boolean;
  captchaProvider: "none" | "turnstile";
  turnstileSiteKey: string;
};

export function parsePublicEnv(input: PublicEnvInput): PublicEnv {
  const env = rawPublicEnvSchema.parse(input);
  if (env.captchaProvider === "turnstile" && !env.turnstileSiteKey) {
    throw new Error("Turnstile site key is required when CAPTCHA is enabled");
  }
  const authProviders = env.authProviders
    .split(",")
    .filter(Boolean)
    .map((provider) => {
      const normalizedProvider = provider.trim();
      const parsedProvider = providerSchema.safeParse(normalizedProvider);

      if (!parsedProvider.success) {
        throw new Error(
          `Unknown authentication provider: ${normalizedProvider}`,
        );
      }

      return parsedProvider.data;
    });
  const emailAuth = env.emailAuth === "true";

  if (!emailAuth && authProviders.length === 0) {
    throw new Error("At least one authentication method must be enabled");
  }

  return {
    supabaseUrl: env.supabaseUrl,
    supabasePublishableKey: env.supabasePublishableKey,
    siteUrl: env.siteUrl,
    authProviders,
    emailAuth,
    captchaProvider: env.captchaProvider,
    turnstileSiteKey: env.turnstileSiteKey,
  };
}
