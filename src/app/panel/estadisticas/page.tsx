import { StatsManager } from "@/components/panel/StatsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelStatsPage() {
  return <StatsManager />;
}
