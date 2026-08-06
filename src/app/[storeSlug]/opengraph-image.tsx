import { ImageResponse } from "next/og";
import { getPublicStoreShellBySlug } from "@/lib/supabase/catalog";
import { buildPublicUrl } from "@/lib/public-url";

export const runtime = "edge";
export const alt = "Catálogo Somos";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function toAbsoluteImageUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return buildPublicUrl("/favicon.png");

  try {
    return new URL(raw).toString();
  } catch {
    return buildPublicUrl(raw.startsWith("/") ? raw : `/${raw}`);
  }
}

function truncateText(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

export default async function StoreOpenGraphImage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getPublicStoreShellBySlug(storeSlug);
  const storeName = store?.name || "Somos";
  const description = truncateText(
    store?.description || `Catálogo digital de ${storeName}. Arma tu pedido y envíalo por WhatsApp.`,
    118
  );
  const imageUrl = toAbsoluteImageUrl(store?.logoUrl || store?.coverImageUrl || store?.heroImageUrl);
  const primaryColor = store?.primaryColor || "#2E3A79";
  const accentColor = store?.accentColor || "#FFB547";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #FFFDF8 0%, #F8F3E8 48%, #EEF3FF 100%)",
          color: "#25262B",
          fontFamily: "Arial, sans-serif",
          padding: 58,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 20%, rgba(255,181,71,0.22), transparent 28%), radial-gradient(circle at 86% 18%, rgba(46,58,121,0.16), transparent 30%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            border: "1px solid rgba(37,38,43,0.08)",
            borderRadius: 46,
            background: "rgba(255,255,255,0.78)",
            boxShadow: "0 28px 80px rgba(46,58,121,0.16)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "58%",
              padding: "54px 48px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  background: primaryColor,
                  color: accentColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 31,
                  fontWeight: 900,
                }}
              >
                S
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1 }}>SOMOS</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#746F69" }}>
                  Catálogo digital
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  background: `${accentColor}26`,
                  color: primaryColor,
                  padding: "12px 20px",
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                Pide por WhatsApp
              </div>
              <h1
                style={{
                  margin: 0,
                  color: "#25262B",
                  fontSize: storeName.length > 22 ? 58 : 68,
                  lineHeight: 0.95,
                  letterSpacing: -3,
                  fontWeight: 900,
                }}
              >
                {truncateText(storeName, 38)}
              </h1>
              <p
                style={{
                  margin: 0,
                  color: "#746F69",
                  fontSize: 28,
                  lineHeight: 1.25,
                  fontWeight: 700,
                }}
              >
                {description}
              </p>
            </div>

            <div style={{ display: "flex", gap: 18, color: "#746F69", fontSize: 22, fontWeight: 800 }}>
              <span>Catálogo</span>
              <span>•</span>
              <span>Carrito</span>
              <span>•</span>
              <span>Pedido rápido</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "42%",
              background: `linear-gradient(160deg, ${primaryColor}14, ${accentColor}24)`,
              padding: 48,
            }}
          >
            <div
              style={{
                width: 330,
                height: 330,
                borderRadius: 72,
                background: "#FFFFFF",
                border: "10px solid rgba(255,255,255,0.78)",
                boxShadow: "0 22px 60px rgba(37,38,43,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img
                src={imageUrl}
                alt=""
                width={330}
                height={330}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
