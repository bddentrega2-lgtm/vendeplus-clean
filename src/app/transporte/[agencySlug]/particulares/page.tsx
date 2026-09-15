import { notFound } from "next/navigation";
import { ParticularDeliveryForm } from "@/components/public/ParticularDeliveryForm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function normalizePaymentMethod(value: unknown) {
  const text = String(value || "").trim();
  const key = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (key === "pago movil" || key === "pago mÃ³vil") return "Pago móvil";
  if (key === "efectivo") return "Efectivo";
  return "";
}

export default async function ParticularDeliveryPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  const supabase = createSupabaseAdminClient();
  let result = await supabase
    .from("transport_agencies")
    .select(
      "id,name,slug,logo_url,whatsapp_phone,contact_phone,city,state,marketplace_primary_color,marketplace_accent_color,particular_payment_methods,particular_payment_details,particular_payment_proof_mode,particular_payment_proof_required,premium_dispatch_enabled,status,is_active"
    )
    .eq("slug", agencySlug)
    .eq("status", "active")
    .eq("is_active", true)
    .maybeSingle();

  if (result.error && /particular_payment_proof/i.test(result.error.message || "")) {
    result = await supabase
      .from("transport_agencies")
      .select("id,name,slug,logo_url,whatsapp_phone,contact_phone,city,state,marketplace_primary_color,marketplace_accent_color,particular_payment_methods,particular_payment_details,premium_dispatch_enabled,status,is_active")
      .eq("slug", agencySlug)
      .eq("status", "active")
      .eq("is_active", true)
      .maybeSingle();
  }

  const agency = result.data;
  if (!agency || agency.premium_dispatch_enabled !== true) notFound();

  const paymentMethods: string[] = Array.from(
    new Set((agency.particular_payment_methods || []).map(normalizePaymentMethod).filter(Boolean))
  );

  return (
    <ParticularDeliveryForm
      agency={{
        name: agency.name,
        slug: agency.slug,
        logoUrl: agency.logo_url,
        location: [agency.city, agency.state].filter(Boolean).join(", "),
        primaryColor: agency.marketplace_primary_color || "#143D42",
        accentColor: agency.marketplace_accent_color || "#FF7133",
        paymentMethods,
        paymentDetails: agency.particular_payment_details || {},
        paymentProofMode: ["reference", "image"].includes(agency.particular_payment_proof_mode)
          ? agency.particular_payment_proof_mode
          : "disabled",
        paymentProofRequired: agency.particular_payment_proof_required === true,
      }}
    />
  );
}
