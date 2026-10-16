import { z } from "zod";
import { authConfig } from "@/config/auth";
import type { AuthProvider } from "@/config/env-schema";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(authConfig.passwordMinLength);
const nextSchema = z.string().optional();

export const captchaTokenSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine((token) => authConfig.captcha.provider === "none" || Boolean(token));

// Zod omits absent optional properties before reporting their refinements.
// Check the object too, so omitting the field cannot bypass action validation.
function requireCaptchaToken(
  input: { captchaToken?: string },
  context: z.RefinementCtx,
) {
  if (authConfig.captcha.provider === "turnstile" && !input.captchaToken) {
    context.addIssue({ code: "custom", path: ["captchaToken"] });
  }
}

const passwordConfirmationSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ["confirmPassword"],
  });

export const loginSchema = z
  .object({
    captchaToken: captchaTokenSchema,
    email: emailSchema,
    password: passwordSchema,
    next: nextSchema,
  })
  .superRefine(requireCaptchaToken);

export const signupSchema = z
  .object({
    captchaToken: captchaTokenSchema,
    email: emailSchema,
    next: nextSchema,
  })
  .superRefine(requireCaptchaToken)
  .and(passwordConfirmationSchema);

export const forgotPasswordSchema = z
  .object({
    captchaToken: captchaTokenSchema,
    email: emailSchema,
  })
  .superRefine(requireCaptchaToken);

export const updatePasswordSchema = passwordConfirmationSchema;

export const providerSchema = z.object({
  provider: z.custom<AuthProvider>(
    (value) =>
      typeof value === "string" &&
      authConfig.providers.some((provider) => provider === value),
  ),
  next: nextSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type ProviderInput = z.infer<typeof providerSchema>;
