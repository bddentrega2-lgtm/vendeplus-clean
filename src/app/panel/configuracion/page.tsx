import { ConfigManager } from "@/components/panel/ConfigManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelSettingsPage() {
  return <ConfigManager />;
}
