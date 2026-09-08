import { notFound } from "next/navigation";
import { ParticularDeliveryForm } from "@/components/public/ParticularDeliveryForm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ParticularDeliveryPage({ params }: { params: Promise<{ agencySlug: string }> }) {
  const { agencySlug } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: agency } = await supabase
    .from("transport_agencies")
    .select("id,name,slug,logo_url,whatsapp_phone,contact_phone,city,state,marketplace_primary_color,marketplace_accent_color,particular_payment_methods,particular_payment_details,status,is_active")
    .eq("slug", agencySlug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (!agency) notFound();

  return <ParticularDeliveryForm agency={{
    name: agency.name,
    slug: agency.slug,
    logoUrl: agency.logo_url,
    location: [agency.city, agency.state].filter(Boolean).join(", "),
    primaryColor: agency.marketplace_primary_color || "#143D42",
    accentColor: agency.marketplace_accent_color || "#FF7133",
    paymentMethods: (agency.particular_payment_methods || []).filter((method: string) => method === "Pago móvil" || method === "Efectivo"),
    paymentDetails: agency.particular_payment_details || {},
  }} />;
}
