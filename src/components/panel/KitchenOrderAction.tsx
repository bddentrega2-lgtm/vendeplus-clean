'use client';
import { ChefHat, Loader2 } from 'lucide-react';
import { elapsedKitchen, kitchenStateLabels, type KitchenTicket } from '@/lib/kitchen';

export function KitchenOrderAction({ order, ticket, now, pending, onSend, iconOnly = false }: {
  order: { id: string; public_code: string; status: string; payment_status: string | null };
  ticket?: KitchenTicket; now: number; pending: boolean; onSend: () => void;
  iconOnly?: boolean;
}) {
  if (['completed','cancelled','delivering'].includes(order.status)) return null;
  if (ticket && iconOnly) return <span title={`En cocina: ${kitchenStateLabels[ticket.state]}`} aria-label={`En cocina: ${kitchenStateLabels[ticket.state]}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800"><ChefHat size={18} aria-hidden="true" /></span>;
  if (ticket) return <span className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-emerald-800"><ChefHat size={16} />
    {kitchenStateLabels[ticket.state]} · {elapsedKitchen(ticket.sent_at, now, ticket.ready_at)} en cocina
  </span>;
  return <button type="button" disabled={pending} title={pending ? 'Enviando a cocina' : 'Enviar a cocina'} aria-label={pending ? 'Enviando a cocina' : 'Enviar a cocina'} onClick={() => {
    if (order.payment_status !== 'verified' && !window.confirm(`Enviar ${order.public_code} a cocina sin pago verificado? El pago no cambiara.`)) return;
    onSend();
  }} className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-700 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50 ${iconOnly ? 'w-10' : 'px-3'}`}>
    {pending ? <Loader2 size={18} className="animate-spin" /> : <ChefHat size={18} />} {!iconOnly && (pending ? 'Enviando...' : 'Enviar a cocina')}
  </button>;
}
