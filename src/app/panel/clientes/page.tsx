import { CustomersManager } from "@/components/panel/CustomersManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PanelCustomersPage() {
  return <CustomersManager />;
}
