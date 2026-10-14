import { z } from "zod";
import { authConfig } from "@/config/auth";
import type { AuthProvider } from "@/config/env-schema";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(authConfig.passwordMinLength);
const nextSchema = z.string().optional();

const passwordConfirmationSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  next: nextSchema,
});

export const signupSchema = z
  .object({
    email: emailSchema,
    next: nextSchema,
  })
  .and(passwordConfirmationSchema);

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

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
