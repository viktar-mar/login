import { z } from "zod";

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "required").max(100, "too_long"),
  avatarUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "invalid_url"),
});

export type ProfileInput = z.infer<typeof profileSchema>;
