"use client";

import { BellRing, X } from "lucide-react";

export type NewOrderToastData = {
  id: string;
  title: string;
  subtitle?: string;
};

export function NewOrderToast({
  notification,
  onClose,
}: {
  notification: NewOrderToastData | null;
  onClose: () => void;
}) {
  if (!notification) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] w-[calc(100vw-2.5rem)] max-w-sm rounded-[28px] bg-[#25262B] p-4 text-white shadow-2xl shadow-[#25262B]/30 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFB547] text-[#25262B]">
          <BellRing size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FFB547]">
            Nuevo pedido
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight">{notification.title}</h3>
          {notification.subtitle ? (
            <p className="mt-1 text-sm font-bold leading-relaxed text-white/70">
              {notification.subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white"
          aria-label="Cerrar notificación"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
