import { SubscriptionPaymentManager } from "@/components/panel/SubscriptionPaymentManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PanelSubscriptionPage() {
  return <SubscriptionPaymentManager />;
}
