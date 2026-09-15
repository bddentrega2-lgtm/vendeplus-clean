"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import { buildSomosWhatsAppUrl } from "@/lib/whatsapp";

type Props = {
  shareTitle: string;
  shareText: string;
  whatsappMessage?: string;
  className?: string;
};

export function PublicShareActions({ shareTitle, shareText, whatsappMessage, className = "" }: Props) {
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
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <PwaInstallButton footer label="Instalar" />
        <button
          type="button"
          onClick={sharePage}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-black text-white ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/15"
        >
          <Share2 size={13} />
          {copied ? "Link copiado" : "Compartir"}
        </button>
        <a
          href={buildSomosWhatsAppUrl(whatsappMessage || "Hola Somos, necesito informacion sobre la plataforma.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-[11px] font-black text-white shadow-sm shadow-[#25D366]/20 transition hover:-translate-y-0.5"
        >
          <MessageCircle size={13} />
          WhatsApp
        </a>
      </div>
  );
}
