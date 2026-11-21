import type { Metadata } from "next";
import { ArchivedTab } from "@/components/workstation/archived-tab";
import { StationFrame, requireStation } from "@/components/workstation/station-frame";

export const metadata: Metadata = { title: "Archived · Study Station" };

export default async function StationArchivedPage() {
  const { data } = await requireStation();
  return (
    <StationFrame data={data} section="Archived">
      <ArchivedTab
        subjects={data.subjects}
        projections={data.schedule.subjects}
        exams={data.exams}
      />
    </StationFrame>
  );
}
