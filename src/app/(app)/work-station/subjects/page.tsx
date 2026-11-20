import type { Metadata } from "next";
import { StationFrame, requireStation } from "@/components/workstation/station-frame";
import { SubjectsTab } from "@/components/workstation/subjects-tab";

export const metadata: Metadata = { title: "Subjects · Study Station" };

export default async function StationSubjectsPage() {
  const { data } = await requireStation();
  return (
    <StationFrame data={data} section="Subjects">
      <SubjectsTab
        subjects={data.subjects}
        projections={data.schedule.subjects}
        days={data.schedule.days}
      />
    </StationFrame>
  );
}
