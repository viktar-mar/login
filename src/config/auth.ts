import type { AuthProvider } from "./env-schema";
import { publicEnv } from "./env";

export const authConfig: {
  emailEnabled: boolean;
  providers: readonly AuthProvider[];
  passwordMinLength: 8;
} = {
  emailEnabled: publicEnv.emailAuth,
  providers: publicEnv.authProviders,
  passwordMinLength: 8,
};
