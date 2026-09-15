"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { buildSomosWhatsAppUrl } from "@/lib/whatsapp";

type Props = {
  shareTitle: string;
  shareText: string;
  whatsappMessage?: string;
};

export function PublicShareActions({ shareTitle, shareText, whatsappMessage }: Props) {
  const [copied, setCopied] = useState(false);

  async function sharePage() {
    const url = typeof window === "undefined" ? "https://www.somos-ve.com" : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="bg-white py-5">
      <div className="vp-container flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={sharePage}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#E8F6F1] px-4 text-xs font-black text-[#0F6B63] ring-1 ring-[#0F6B63]/10 transition hover:-translate-y-0.5"
        >
          <Share2 size={15} />
          {copied ? "Link copiado" : "Compartir"}
        </button>
        <a
          href={buildSomosWhatsAppUrl(whatsappMessage || "Hola Somos, necesito informacion sobre la plataforma.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-xs font-black text-white shadow-sm shadow-[#25D366]/20 transition hover:-translate-y-0.5"
        >
          <MessageCircle size={15} />
          WhatsApp
        </a>
      </div>
    </section>
  );
}
