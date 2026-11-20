import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StationFrame, loadStation } from "@/components/workstation/station-frame";
import { StationSetup } from "@/components/workstation/station-setup";
import { TodayTab } from "@/components/workstation/today-tab";
import { getExamChoices } from "@/lib/workstation/exam-server";
import { parseTab } from "@/schemas/workstation";

export const metadata: Metadata = { title: "Today · Study Station" };

export default async function StationTodayPage({ searchParams }: PageProps<"/work-station">) {
  // Old `?tab=` links (bookmarks) go to the section's own page.
  const tab = parseTab((await searchParams).tab);
  if (tab !== "today") redirect(`/work-station/${tab}`);

  const { user, data } = await loadStation();
  if (!data) return <StationSetup userId={user.id} timezone={user.timezone} />;
  const exam = await getExamChoices(user, data.plan.id);
  return (
    <StationFrame data={data} section="Today">
      <TodayTab data={data} exam={exam} />
    </StationFrame>
  );
}
