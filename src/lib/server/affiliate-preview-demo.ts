type DemoCode = {
  id: string;
  code: string;
  name?: string;
  beneficiary_email?: string | null;
  transport_agency_id?: string | null;
  discount_percent: number;
  setup_commission_percent: number;
  commission_percent: number;
  duration_months: number;
};

const profiles = {
  "preview-aliado@somos.test": {
    code: "VENDEDORDEMO",
    stores: [
      ["Arepa Centro", 12, 8, 3],
      ["Pizza Norte", 15, 11, 4],
      ["Pollo Plaza", 18, 14, 5],
    ],
  },
  "preview-creador@somos.test": {
    code: "CREADORDEMO",
    stores: [
      ["Cafe Aurora", 11, 7, 2],
      ["Meriendas Rio", 14, 10, 3],
      ["Brasa Urbana", 16, 12, 4],
    ],
  },
  "preview-delivery@somos.test": {
    code: "DELIVERYDEMO",
    stores: [
      ["Sushi Estacion", 13, 9, 3],
      ["Sazon Express", 17, 12, 4],
      ["Dulce Ruta", 19, 15, 5],
    ],
  },
} as const;

function usd(value: number) { return Math.round(value * 100) / 100; }

export function affiliatePreviewDemo(email: string, codes: DemoCode[]) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xpqmmdmixpyqruykkbkf.supabase.co") return null;
  const profile = profiles[email as keyof typeof profiles];
  if (!profile) return null;
  const code = codes.find((item) => item.code === profile.code);
  if (!code) return null;

  const feePerOrder = usd(0.1 * code.commission_percent / 100);
  const setupBase = usd(20 * (1 - code.discount_percent / 100));
  const setupCommission = usd(setupBase * code.setup_commission_percent / 100);

  const stores = profile.stores.map(([storeName, , collectedCount, paidCount], index) => {
    const referralId = `demo-${code.code}-${index + 1}`;
    return {
      referralId, storeName,
      feePendingUsd: usd((collectedCount - paidCount) * feePerOrder),
      feePaidUsd: usd(paidCount * feePerOrder),
      setupPendingUsd: index === 0 ? 0 : setupCommission,
      setupPaidUsd: index === 0 ? setupCommission : 0,
    };
  });
  return {
    demo: true,
    codes: [code],
    stores, settlements: [], asOf: new Date().toISOString(),
  };
}

export function affiliatePreviewAdminBalances(codes: DemoCode[]) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xpqmmdmixpyqruykkbkf.supabase.co") return [];
  return Object.entries(profiles).flatMap(([email, profile]) => {
    const code = codes.find((item) => item.code === profile.code);
    if (!code) return [];
    const demo = affiliatePreviewDemo(email, [code]);
    if (!demo) return [];
    const total = (key: "setupPendingUsd" | "feePendingUsd" | "setupPaidUsd" | "feePaidUsd") =>
      usd(demo.stores.reduce((sum, store) => sum + store[key], 0));
    return [{
      allyKey: code.transport_agency_id ? `agency:${code.transport_agency_id}` : `email:${code.beneficiary_email}`,
      displayName: code.name || profile.code,
      beneficiaryEmail: code.beneficiary_email || null,
      transportAgencyId: code.transport_agency_id || null,
      codes: [code.code],
      partnerTypes: [code.transport_agency_id ? "delivery" : code.code === "CREADORDEMO" ? "creator" : "seller"],
      commerceCount: profile.stores.length,
      setupPendingCount: demo.stores.filter((store) => store.setupPendingUsd > 0).length,
      setupPaidCount: demo.stores.filter((store) => store.setupPaidUsd > 0).length,
      feePendingCount: profile.stores.reduce((sum, [, , collected, paid]) => sum + collected - paid, 0),
      feePaidCount: profile.stores.reduce((sum, [, , , paid]) => sum + paid, 0),
      setupPendingUsd: total("setupPendingUsd"), feePendingUsd: total("feePendingUsd"),
      setupPaidUsd: total("setupPaidUsd"), feePaidUsd: total("feePaidUsd"),
      demo: true,
    }];
  });
}
