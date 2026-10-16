import type { AuthProvider } from "./env-schema";
import { publicEnv } from "./env";

export const authConfig: {
  emailEnabled: boolean;
  providers: readonly AuthProvider[];
  passwordMinLength: 8;
  captcha: { provider: "none" | "turnstile"; siteKey: string };
} = {
  emailEnabled: publicEnv.emailAuth,
  providers: publicEnv.authProviders,
  passwordMinLength: 8,
  captcha: {
    provider: publicEnv.captchaProvider,
    siteKey: publicEnv.turnstileSiteKey,
  },
};
