import { DashboardManager } from "@/components/panel/DashboardManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelInicioPage() {
  return <DashboardManager />;
}
