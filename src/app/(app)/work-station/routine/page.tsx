import type { Metadata } from "next";
import { RoutineTab } from "@/components/workstation/routine-tab";
import { StationFrame, requireStation } from "@/components/workstation/station-frame";

export const metadata: Metadata = { title: "Routine · Study Station" };

export default async function StationRoutinePage() {
  const { data } = await requireStation();
  return (
    <StationFrame data={data} section="Routine">
      <RoutineTab slots={data.slots} />
    </StationFrame>
  );
}
