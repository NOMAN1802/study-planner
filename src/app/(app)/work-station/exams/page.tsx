import type { Metadata } from "next";
import { ExamsTab } from "@/components/workstation/exams-tab";
import { StationFrame, requireStation } from "@/components/workstation/station-frame";
import { getExamChoices } from "@/lib/workstation/exam-server";

export const metadata: Metadata = { title: "Exams · Study Station" };

export default async function StationExamsPage() {
  const { user, data } = await requireStation();
  const choices = await getExamChoices(user, data.plan.id);
  return (
    <StationFrame data={data} section="Exams">
      <ExamsTab data={data} choices={choices} />
    </StationFrame>
  );
}
