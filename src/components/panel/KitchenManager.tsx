'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChefHat, Clock3, Check, Maximize, Minimize, RefreshCw, Settings, Loader2, UserRound, WifiOff, X } from 'lucide-react';
import { useKitchen } from '@/hooks/use-kitchen';
import { useTableCancellation } from '@/components/panel/orders/use-table-cancellation';
import { OrderDelaySettings } from '@/components/panel/orders/OrderDelaySettings';
import { elapsedKitchen, kitchenMode, kitchenOrderNote, kitchenOrigin, type KitchenState } from '@/lib/kitchen';
import { isOrderDelayed } from '@/lib/order-delay';

const stages: Array<{ state: KitchenState; label: string; color: string; cardColor: string }> = [
  { state: 'queued', label: 'Por preparar', color: 'border-amber-400', cardColor: 'border-t-amber-400' },
  { state: 'preparing', label: 'En preparación', color: 'border-sky-500', cardColor: 'border-t-sky-500' },
  { state: 'ready', label: 'Listos', color: 'border-emerald-500', cardColor: 'border-t-emerald-500' },
];
export function KitchenManager() {
  const kitchen = useKitchen(true);
  const { requestCancellation, cancellationDialog } = useTableCancellation();
  const [mode, setMode] = useState('Todas');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<KitchenState | 'all'>('all');
  const [setup, setSetup] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const listener = () => setFullscreen(document.fullscreenElement === board.current);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);
  const tickets = useMemo(() => kitchen.tickets.filter(ticket => ticket.orders &&
    (mode === 'Todas' || kitchenMode(ticket.orders) === mode) &&
    `${ticket.orders.public_code} ${ticket.orders.customer_name || ''} ${ticket.orders.table_name_snapshot || ''} ${ticket.orders.delivery_reference || ''}`.toLowerCase().includes(search.toLowerCase())), [kitchen.tickets, mode, search]);
  const visibleStages = stages.filter(option => stage === 'all' || option.state === stage);
  const cancelOrder = async (order: NonNullable<(typeof kitchen.tickets)[number]['orders']>) => {
    const cancellation = await requestCancellation();
    if (!cancellation) return;
    await kitchen.cancel(order.id, order.status, cancellation);
  };
  if (!kitchen.eligible) return <div className="py-8"><h2 className="text-lg font-bold">Cocina no disponible</h2><p className="mt-2 text-sm">Requiere Mesa activa y autorizada por administración.</p><Link href="/panel/pedidos" className="mt-4 inline-block font-bold text-emerald-800">Ir a Pedidos</Link></div>;
  return <div ref={board} className={`@container min-w-0 bg-[#F5F7F8] text-[#203538] ${fullscreen ? 'h-screen overflow-auto p-4' : ''}`}>
    {cancellationDialog}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 py-3">
      <div className="flex flex-wrap items-center gap-2"><ChefHat size={22} /><h2 className="text-xl font-bold">Comandas</h2>
        <span role="status" title={kitchen.connected ? 'Las comandas se actualizan al instante.' : 'Las comandas se actualizan automáticamente cada 15 segundos.'} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold ${!kitchen.online ? 'border-red-200 bg-red-50 text-red-700' : kitchen.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${!kitchen.online ? 'bg-red-500' : kitchen.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {!kitchen.online ? 'Sin conexión' : kitchen.connected ? 'En vivo' : 'Respaldo cada 15 s'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/panel/pedidos" className="px-2 py-2 text-sm font-bold">Pedidos</Link>
        <Link href="/panel/mesas" className="px-2 py-2 text-sm font-bold">Mesas</Link>
        <button type="button" title="Actualizar comandas" aria-label="Actualizar comandas" onClick={kitchen.refresh} className="grid h-11 w-11 place-items-center rounded-lg border bg-white"><RefreshCw size={19} /></button>
        <button type="button" title="Configurar Cocina" aria-label="Configurar Cocina" onClick={() => setSetup(!setup)} className="grid h-11 w-11 place-items-center rounded-lg border bg-white"><Settings size={19} /></button>
        <button type="button" title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={() => {
          if (fullscreen) void document.exitFullscreen?.(); else void board.current?.requestFullscreen?.().catch(() => {});
        }} className="grid h-11 w-11 place-items-center rounded-lg border bg-white">{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>
      </div>
    </div>
    {setup || (!kitchen.loading && !kitchen.settings.enabled) ? <section aria-label="Configuración de Cocina" className="border-b bg-white py-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" checked={kitchen.settings.enabled} disabled={kitchen.isPending('settings')} onChange={e => void kitchen.configure(e.target.checked, kitchen.settings.dispatch_mode)} /> Cocina activa</label>
        <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Entrada de comandas
          <select aria-label="Entrada de comandas" value={kitchen.settings.dispatch_mode} disabled={kitchen.isPending('settings')} onChange={e => void kitchen.configure(kitchen.settings.enabled, e.target.value)} className="min-h-11 max-w-full rounded-lg border bg-white px-3">
            <option value="manual">Botón Enviar a cocina</option><option value="paid">Al confirmar el pago</option>
          </select>
        </label>
      </div>
      {setup ? <OrderDelaySettings enabled={kitchen.settings.delay_alerts_enabled} thresholds={kitchen.settings.delay_thresholds} pending={kitchen.isPending('settings')}
        onSave={(enabled, thresholds) => void kitchen.configure(kitchen.settings.enabled, kitchen.settings.dispatch_mode, thresholds, enabled)} /> : null}
    </section> : null}
    {!kitchen.online ? <p role="alert" className="flex items-center gap-2 bg-amber-50 p-3 text-sm"><WifiOff size={18} /> Sin conexión. Los cambios requieren confirmación.</p> : null}
    {kitchen.error ? <p role="alert" className="border-l-4 border-red-500 bg-red-50 p-3 text-sm">{kitchen.error}</p> : null}
    {kitchen.loading ? <div className="flex items-center gap-2 py-12"><Loader2 className="animate-spin" size={20} /> Cargando comandas...</div> : null}
    {kitchen.settings.enabled ? <>
      <div className="flex flex-wrap gap-2 py-3">
        <input aria-label="Buscar pedido, cliente o mesa" placeholder="Pedido, cliente o mesa" value={search} onChange={e => setSearch(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border bg-white px-3" />
        <select aria-label="Modalidad" value={mode} onChange={e => setMode(e.target.value)} className="min-h-11 rounded-lg border bg-white px-3">{['Todas','Mesa','Barra','Retiro','Delivery'].map(value => <option key={value}>{value}</option>)}</select>
      </div>
      <div role="group" aria-label="Estado de las comandas" className="mb-3 grid grid-cols-2 gap-1 border-b border-gray-200 sm:grid-cols-4">
        {[{ state: 'all' as const, label: 'Todas', color: 'border-[#146B60]' }, ...stages].map(option => (
          <button key={option.state} type="button" aria-pressed={stage === option.state} onClick={() => setStage(option.state)} className={`flex min-h-11 min-w-0 items-center justify-between gap-2 border-b-2 px-2 py-2 text-left text-sm ${stage === option.state ? `${option.color} bg-white font-bold text-[#203538]` : 'border-transparent text-gray-600 hover:bg-white'}`}>
            <span>{option.label}</span><span className="shrink-0 tabular-nums">{option.state === 'all' ? tickets.length : tickets.filter(ticket => ticket.state === option.state).length}</span>
          </button>
        ))}
      </div>
      <div aria-label="Comandas activas" className={`grid min-w-0 items-start gap-3 ${stage === 'all' ? 'grid-cols-1 @[840px]:grid-cols-3' : 'grid-cols-1'}`}>
        {visibleStages.map(column => {
          const rows = tickets.filter(ticket => ticket.state === column.state);
          return <section key={column.state} aria-label={column.label} data-kitchen-stage={column.state} className="min-w-0">
            <h3 className={`mb-2 flex min-h-11 items-center justify-between gap-2 border-b-2 ${column.color} text-sm font-bold`}><span>{column.label}</span><span className="tabular-nums">{rows.length}</span></h3>
            {!rows.length && !kitchen.loading ? <p className="py-5 text-center text-sm text-gray-500">Sin comandas</p> : null}
            <div className="grid min-w-0 items-start gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
              {rows.map(ticket => {
                const order = ticket.orders!;
                const modality = kitchenMode(order);
                const age = Math.max(0, kitchen.now - Date.parse(order.created_at));
                const state = stages.find(option => option.state === ticket.state)!;
                const phase = ticket.state === 'ready' ? `Listo hace ${elapsedKitchen(ticket.ready_at, kitchen.now)}` : ticket.state === 'preparing' ? `Preparando ${elapsedKitchen(ticket.started_at, kitchen.now)}` : `Espera ${elapsedKitchen(ticket.sent_at, kitchen.now)}`;
                const delayed = kitchen.settings.delay_alerts_enabled && isOrderDelayed(order, kitchen.settings.delay_thresholds, kitchen.now);
                const generalNote = kitchenOrderNote(order);
                return <article key={ticket.order_id} className={`min-w-0 rounded-lg border border-gray-200 border-t-[3px] bg-white p-2.5 shadow-sm ${state.cardColor} ${delayed ? 'ring-2 ring-red-300' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs"><span className="font-semibold">{state.label}</span><span className="text-gray-600">{kitchenOrigin(order)}</span></div>
                  <h4 className="mt-1 break-words text-sm font-bold leading-5 [overflow-wrap:anywhere]">{order.public_code}</h4>
                  <p className="flex min-w-0 items-start gap-1 text-sm font-bold leading-5"><UserRound aria-hidden="true" className="mt-0.5 shrink-0" size={14} /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{order.customer_name || 'Cliente sin nombre'}</span></p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm font-bold">
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">{modality === 'Mesa' ? order.table_name_snapshot || order.delivery_reference || 'Mesa sin referencia' : modality}</p>
                    <span title="Tiempo desde que se recibió el pedido" className={`inline-flex shrink-0 items-center gap-1 tabular-nums ${age > 30 * 60_000 ? 'text-amber-800' : ''}`}><Clock3 size={15} /><span className="sr-only">Recibido hace </span>{elapsedKitchen(order.created_at, kitchen.now)}</span>
                  </div>
                  <div className="mt-1 border-b pb-1.5 text-xs tabular-nums">
                    <span className={delayed ? 'font-black text-red-700' : ticket.state === 'ready' ? 'font-bold text-emerald-800' : 'font-semibold text-gray-600'}>{delayed ? `Demorado · ${phase}` : phase}</span>
                  </div>
                  <ul className="divide-y">{order.order_items?.map(item => <li key={item.id} className="py-1.5 text-sm leading-5">
                    <p className="break-words font-bold [overflow-wrap:anywhere]">{item.quantity} × {item.product_name}{item.variant_name ? <span className="font-normal"> · {item.variant_name}</span> : null}</p>
                    {item.order_item_options?.length ? <p className="break-words text-gray-600 [overflow-wrap:anywhere]">{item.order_item_options.map(option => `${option.option_group_name}: ${option.option_name}${option.quantity > 1 ? ` × ${option.quantity}` : ''}`).join(' · ')}</p> : null}
                    {item.notes ? <p className="break-words border-l-2 border-amber-500 pl-2 [overflow-wrap:anywhere]"><span className="font-bold">Nota:</span> {item.notes}</p> : null}
                  </li>)}</ul>
                  {order.order_details || generalNote ? <div className="mb-1.5 break-words bg-amber-50 px-2 py-1 text-sm leading-5 [overflow-wrap:anywhere]">
                    <p className="font-bold">Nota del pedido</p>
                    {order.order_details ? <p>{order.order_details}</p> : null}
                    {generalNote ? <p>{generalNote}</p> : null}
                  </div> : null}
                  {ticket.dispatch_method === 'manual' && ticket.payment_at_dispatch !== 'verified' ? <p className="mb-1.5 text-xs text-gray-600">Envío manual sin pago verificado</p> : null}
                  <div className="flex items-center gap-2">
                    {ticket.state !== 'ready' ? <button type="button" disabled={!kitchen.online || kitchen.isPending(order.id)} onClick={() => void kitchen.operate(order.id, ticket.state === 'queued' ? 'prepare' : 'ready', ticket.state)} className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-[#146B60] px-2 py-2 text-sm font-bold text-white disabled:opacity-50">
                      {kitchen.isPending(order.id) ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{kitchen.isPending(order.id) ? 'Guardando...' : ticket.state === 'queued' ? 'Iniciar preparación' : 'Marcar listo'}
                    </button> : <p className="min-w-0 flex-1 py-2 text-center text-sm font-bold text-emerald-800">Pendiente de entrega</p>}
                    <button type="button" title="Cancelar pedido" aria-label={`Cancelar ${order.public_code}`} disabled={!kitchen.online || kitchen.isPending(order.id)} onClick={() => void cancelOrder(order)} className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-red-50 text-red-700 disabled:opacity-50"><X size={18} /></button>
                  </div>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
    </> : null}
  </div>;
}
