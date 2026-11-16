import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell email={user.email} userMenu={<SignOutButton />}>
      {children}
    </AppShell>
  );
}
