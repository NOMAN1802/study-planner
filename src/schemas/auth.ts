import { z } from "zod";

export const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long");

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const timezoneSchema = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : undefined));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
  timezone: timezoneSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  timezone: timezoneSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type AuthField = "email" | "password";

export type AuthState = {
  error?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
};

/** Collapse a Zod error into one message per field (first issue wins). */
export function toFieldErrors(error: z.ZodError): Partial<Record<AuthField, string>> {
  const out: Partial<Record<AuthField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if ((key === "email" || key === "password") && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}
