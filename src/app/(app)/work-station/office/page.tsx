import type { Metadata } from "next";
import { OfficeTab } from "@/components/workstation/office-tab";
import { StationFrame, requireStation } from "@/components/workstation/station-frame";
import { getTaskRows } from "@/lib/tasks";
import { DEFAULT_FILTERS } from "@/schemas/task";

export const metadata: Metadata = { title: "Office · Study Station" };

export default async function StationOfficePage() {
  const { user, data } = await requireStation();
  const tasks = await getTaskRows(user, { ...DEFAULT_FILTERS, status: "all" }, new Date(), "OFFICE");
  return (
    <StationFrame data={data} section="Office">
      <OfficeTab tasks={tasks} slots={data.slots} />
    </StationFrame>
  );
}
