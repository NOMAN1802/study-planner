import type { Metadata } from "next";
import { signIn } from "@/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  return <AuthForm mode="login" action={signIn} next={nextPath} />;
}
