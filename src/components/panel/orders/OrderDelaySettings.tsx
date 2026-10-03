'use client';

import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { normalizeOrderDelayThresholds, orderDelayStates, type OrderDelayThresholds } from '@/lib/order-delay';

export function OrderDelaySettings({ enabled, thresholds, pending, onSave }: {
  enabled: boolean;
  thresholds: OrderDelayThresholds;
  pending: boolean;
  onSave: (enabled: boolean, thresholds: OrderDelayThresholds) => void;
}) {
  const [draft, setDraft] = useState(() => normalizeOrderDelayThresholds(thresholds));
  useEffect(() => setDraft(normalizeOrderDelayThresholds(thresholds)), [thresholds]);

  const valid = orderDelayStates.every(state => {
    const value = draft[state.value];
    return Number.isInteger(value) && value >= 1 && value <= 240;
  });

  return <section aria-labelledby="delay-settings-title" className="mt-4 border-t border-[#25262B]/10 pt-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 id="delay-settings-title" className="text-sm font-black">Alertas de demora</h3>
        <p className="mt-1 text-xs font-bold text-[#746f69]">Marca en rojo los pedidos que superen el tiempo definido.</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} disabled={pending} onClick={() => onSave(!enabled, draft)}
        aria-label="Activar alertas de demora" className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${enabled ? 'bg-[#146B60]' : 'bg-gray-300'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
    {enabled ? <><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {orderDelayStates.map(state => <label key={state.value} className="min-w-0 text-xs font-black text-[#25262B]">
        {state.label}
        <span className="mt-1 flex items-center gap-2 rounded-lg border border-[#25262B]/15 bg-white px-2">
          <input type="number" min={1} max={240} step={1} inputMode="numeric" value={draft[state.value]}
            onChange={event => setDraft(current => ({ ...current, [state.value]: Number(event.target.value) }))}
            aria-label={`Demora para ${state.label}`} className="min-h-10 min-w-0 flex-1 bg-transparent text-sm font-black outline-none" />
          <span className="shrink-0 text-[10px] text-[#746f69]">min</span>
        </span>
      </label>)}
    </div>
    <div className="mt-3 flex justify-end"><button type="button" disabled={pending || !valid} onClick={() => onSave(true, draft)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#073B4C] px-4 text-xs font-black text-white disabled:opacity-50">
      <Save size={15} /> {pending ? 'Guardando...' : 'Guardar tiempos'}
    </button></div>
    {!valid ? <p role="alert" className="mt-2 text-xs font-black text-red-700">Usa valores entre 1 y 240 minutos.</p> : null}</> : null}
  </section>;
}
