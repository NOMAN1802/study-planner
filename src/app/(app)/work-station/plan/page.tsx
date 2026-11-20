import type { Metadata } from "next";
import { PlanTab } from "@/components/workstation/plan-tab";
import { StationFrame, requireStation } from "@/components/workstation/station-frame";

export const metadata: Metadata = { title: "Plan · Study Station" };

export default async function StationPlanPage() {
  const { user, data } = await requireStation();
  return (
    <StationFrame data={data} section="Plan">
      <PlanTab data={data} weekStartsOn={user.weekStartsOn} />
    </StationFrame>
  );
}
