import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="enter mx-auto w-full max-w-2xl">
      <section
        aria-labelledby="prefs-heading"
        className="rounded-sm border border-border bg-surface p-4 sm:p-6"
      >
        <h2 id="prefs-heading" className="mb-1 text-base font-medium">
          Preferences
        </h2>
        <p className="mb-5 text-sm text-fg-muted">
          Changing these moves period boundaries for future check-ins; past check-ins keep the
          period they were logged in.
        </p>
        <SettingsForm
          timezone={user.timezone}
          weekStartsOn={user.weekStartsOn}
          timezones={timezones}
        />
      </section>
    </div>
  );
}
