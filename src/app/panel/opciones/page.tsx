import { OptionsManager } from "@/components/panel/OptionsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelOptionsPage() {
  return <OptionsManager />;
}
