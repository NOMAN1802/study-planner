"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { TimezoneInput } from "@/components/auth/timezone-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, signupSchema, toFieldErrors, type AuthState } from "@/schemas/auth";

type Mode = "login" | "signup";

type AuthFormProps = {
  mode: Mode;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
};

const copy: Record<
  Mode,
  { title: string; submit: string; switchText: string; switchHref: string; switchLabel: string }
> = {
  login: {
    title: "Sign in",
    submit: "Sign in",
    switchText: "New here?",
    switchHref: "/signup",
    switchLabel: "Create an account",
  },
  signup: {
    title: "Create your account",
    submit: "Create account",
    switchText: "Already have an account?",
    switchHref: "/login",
    switchLabel: "Sign in",
  },
};

const initialState: AuthState = {};

export function AuthForm({ mode, action, next }: AuthFormProps) {
  const [serverState, formAction, pending] = useActionState(action, initialState);
  const [clientErrors, setClientErrors] = useState<AuthState["fieldErrors"]>();

  const fieldErrors = clientErrors ?? serverState.fieldErrors;
  const text = copy[mode];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const schema = mode === "signup" ? signupSchema : loginSchema;
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      timezone: form.get("timezone"),
    });
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(toFieldErrors(parsed.error));
      return;
    }
    setClientErrors(undefined);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-medium tracking-tight text-fg">{text.title}</h1>
        <p className="text-sm text-fg-muted">
          {text.switchText}{" "}
          <Link href={text.switchHref} className="font-medium text-accent hover:underline">
            {text.switchLabel}
          </Link>
        </p>
      </div>

      {serverState.error ? (
        <p
          role="alert"
          className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {serverState.error}
        </p>
      ) : null}

      <Field id="email" label="Email" error={fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          invalid={Boolean(fieldErrors?.email)}
          aria-describedby={fieldErrors?.email ? "email-error" : undefined}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        error={fieldErrors?.password}
        hint={mode === "signup" ? "At least 8 characters" : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : 1}
          invalid={Boolean(fieldErrors?.password)}
          aria-describedby={
            fieldErrors?.password
              ? "password-error"
              : mode === "signup"
                ? "password-hint"
                : undefined
          }
        />
      </Field>

      <TimezoneInput />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Button type="submit" loading={pending} className="mt-1">
        {text.submit}
      </Button>
    </form>
  );
}
