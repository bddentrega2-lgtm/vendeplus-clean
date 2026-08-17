"use client";

import { MapPin, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CatalogClient } from "@/components/public/CatalogClient";
import type { Store } from "@/types";
import {
  getTableOrderContext,
  saveTableOrderContext,
  type PublicStoreTable,
  type TableOrderContext,
} from "@/lib/table-orders";

type Props = {
  store: Store;
  storeToken: string;
  tables: PublicStoreTable[];
  enabled: boolean;
  paymentMethods: string[];
  fulfillmentMode: "table_service" | "counter_pickup";
};

export function TableEntryClient({
  store,
  storeToken,
  tables,
  enabled,
  paymentMethods,
  fulfillmentMode,
}: Props) {
  const [selectedTable, setSelectedTable] = useState<TableOrderContext | null>(null);
  const [restoredSelection, setRestoredSelection] = useState(false);

  useEffect(() => {
    if (fulfillmentMode === "counter_pickup") {
      const counterContext: TableOrderContext = {
        storeToken,
        tableId: "",
        tableName: "Retiro en barra",
        tableZone: null,
        paymentMethods,
        fulfillmentMode,
      };
      saveTableOrderContext(store.slug, counterContext);
      setSelectedTable(counterContext);
      setRestoredSelection(true);
      return;
    }
    const previousContext = getTableOrderContext(store.slug);
    if (
      previousContext?.storeToken === storeToken &&
      tables.some((table) => table.id === previousContext.tableId)
    ) {
      setSelectedTable(previousContext);
    }
    setRestoredSelection(true);
  }, [fulfillmentMode, paymentMethods, store.slug, storeToken, tables]);

  const tablesByZone = useMemo(() => {
    const groups = new Map<string, PublicStoreTable[]>();
    for (const table of tables) {
      const zone = table.zone || "Mesas";
      groups.set(zone, [...(groups.get(zone) || []), table]);
    }
    return Array.from(groups.entries());
  }, [tables]);

  if (!enabled || paymentMethods.length === 0) {
    return (
      <main className="vp-container grid min-h-screen place-items-center py-8">
        <section className="vp-phone-shell rounded-[32px] bg-white p-7 text-center shadow-xl ring-1 ring-[#25262B]/10">
          <UtensilsCrossed className="mx-auto text-[#2E3A79]" size={42} />
          <h1 className="mt-4 text-2xl font-black">Pedidos en mesa no disponibles</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
            {store.name} no está recibiendo pedidos en mesa en este momento.
          </p>
        </section>
      </main>
    );
  }

  if (!restoredSelection) {
    return <main className="min-h-screen bg-[#FFF8F0]" aria-busy="true" />;
  }

  if (selectedTable) {
    return (
      <CatalogClient
        store={{ ...store, paymentMethods }}
        tableOrder={selectedTable}
        onChangeTable={fulfillmentMode === "table_service" ? () => setSelectedTable(null) : undefined}
      />
    );
  }

  return (
    <main className="vp-container min-h-screen py-6">
      <div className="vp-phone-shell">
        <section className="rounded-[32px] bg-[#2E3A79] p-6 text-center text-white shadow-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFB547] text-[#25262B]">
            <UtensilsCrossed size={26} />
          </div>
          <p className="mt-4 text-sm font-black text-[#FFB547]">{store.name}</p>
          <h1 className="mt-1 text-3xl font-black">¿En cuál mesa estás?</h1>
          <p className="mt-2 text-sm font-semibold text-white/75">
            Elige tu mesa para abrir el catálogo y recibir allí tu pedido.
          </p>
        </section>

        <div className="mt-5 space-y-5">
          {tablesByZone.map(([zone, zoneTables]) => (
            <section key={zone}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-[#746f69]">
                <MapPin size={16} /> {zone}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {zoneTables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => {
                      const context = {
                        storeToken,
                        tableId: table.id,
                        tableName: table.name,
                        tableZone: table.zone,
                        paymentMethods,
                        fulfillmentMode,
                      };
                      saveTableOrderContext(store.slug, context);
                      setSelectedTable(context);
                    }}
                    className="min-h-24 rounded-[24px] bg-white p-4 text-left shadow-lg ring-1 ring-[#25262B]/10 transition hover:-translate-y-0.5 hover:ring-[#FFB547]"
                  >
                    <span className="block text-base font-black text-[#25262B]">{table.name}</span>
                    <span className="mt-1 block text-xs font-bold text-[#746f69]">
                      Toca para elegir
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {tables.length === 0 ? (
          <section className="mt-5 rounded-[28px] bg-white p-6 text-center text-sm font-bold text-[#746f69] shadow-lg">
            No hay mesas activas disponibles. Consulta al personal.
          </section>
        ) : null}
      </div>
    </main>
  );
}
