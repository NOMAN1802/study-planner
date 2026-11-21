import Link from "next/link";

export default function NotFound() {
  return (
    <div className="enter mx-auto w-full max-w-page">
      <div className="flex flex-col items-start gap-3 rounded-sm border border-border bg-surface p-6">
        <h2 className="text-base font-medium">Not found</h2>
        <p className="text-sm text-fg-muted">That item doesn&apos;t exist or isn&apos;t yours.</p>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
