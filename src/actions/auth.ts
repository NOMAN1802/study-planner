"use server";

import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema, toFieldErrors, type AuthState } from "@/schemas/auth";

function formValues(formData: FormData) {
  return {
    email: formData.get("email"),
    password: formData.get("password"),
    timezone: formData.get("timezone"),
  };
}

const NETWORK_ERROR = "Couldn't reach the sign-in service. Check your connection and try again.";

/** Supabase reports network failures as "fetch failed" / retryable errors; don't show those raw. */
function authErrorMessage(
  error: { message: string; name?: string; status?: number },
  fallback: string,
): string {
  const network =
    error.name === "AuthRetryableFetchError" ||
    /fetch failed|network/i.test(error.message) ||
    error.status === 0;
  return network ? NETWORK_ERROR : fallback;
}

function safeNext(value: FormDataEntryValue | null): string {
  // Only allow same-origin relative paths to avoid open redirects.
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: authErrorMessage(error, error.message) };
  }
  if (!data.user) {
    return { error: "Sign up failed. Please try again." };
  }
  if (!data.session) {
    // Email confirmation is enabled on the Supabase project.
    return { error: "Check your inbox to confirm your email, then sign in." };
  }

  await ensureProfile({
    id: data.user.id,
    email: data.user.email ?? parsed.data.email,
    timezone: parsed.data.timezone,
  });

  redirect("/dashboard");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return {
      error: error
        ? authErrorMessage(error, "Incorrect email or password.")
        : "Incorrect email or password.",
    };
  }

  await ensureProfile({
    id: data.user.id,
    email: data.user.email ?? parsed.data.email,
    timezone: parsed.data.timezone,
  });

  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
