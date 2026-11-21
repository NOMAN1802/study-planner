import { LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex h-8 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="size-3.5" aria-hidden />
        Sign out
      </button>
    </form>
  );
}
