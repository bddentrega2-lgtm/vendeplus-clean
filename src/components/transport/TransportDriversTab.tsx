"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, PlusCircle, RefreshCcw, Save } from "lucide-react";

export type TransportDriverDraft = {
  name: string;
  phone: string;
  documentNumber: string;
  commissionPercent: string;
  notes: string;
  isActive: boolean;
};

interface TransportDriversTabProps {
  drivers: any[];
  isLoading: boolean;
  premiumDispatchEnabled: boolean;
  schemaReady: boolean;
  savingDriverId: string | null;
  onCreateDriver: (draft: TransportDriverDraft) => Promise<void>;
  onRefresh: () => Promise<void>;
  onUpdateDriver: (driverId: string, draft: TransportDriverDraft) => Promise<void>;
}

const emptyDraft: TransportDriverDraft = {
  name: "",
  phone: "",
  documentNumber: "",
  commissionPercent: "60",
  notes: "",
  isActive: true,
};

function driverToDraft(driver: any): TransportDriverDraft {
  return {
    name: String(driver.name || ""),
    phone: String(driver.phone || ""),
    documentNumber: String(driver.document_number || ""),
    commissionPercent: String(driver.commission_percent ?? "60"),
    notes: String(driver.notes || ""),
    isActive: driver.is_active !== false,
  };
}

export function TransportDriversTab({
  drivers,
  isLoading,
  premiumDispatchEnabled,
  schemaReady,
  savingDriverId,
  onCreateDriver,
  onRefresh,
  onUpdateDriver,
}: TransportDriversTabProps) {
  const [draft, setDraft] = useState<TransportDriverDraft>(emptyDraft);
  const [editingDrafts, setEditingDrafts] = useState<Record<string, TransportDriverDraft>>({});

  const canManage = schemaReady && premiumDispatchEnabled;

  async function submitNewDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateDriver(draft);
    setDraft(emptyDraft);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
              Paquete premium
            </p>
            <h2 className="mt-1 text-xl font-black">Repartidores y comisiones</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
              Crea repartidores, define su porcentaje fijo y asigna servicios desde pedidos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRefresh()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-3 text-sm font-black text-[#25262B]"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Actualizar
          </button>
        </div>

        {!schemaReady ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-black text-amber-800">
            Falta aplicar la migracion premium en la base de datos para probar esta funcion.
          </p>
        ) : !premiumDispatchEnabled ? (
          <p className="mt-4 rounded-2xl bg-[#F8F3E8] p-4 text-sm font-black text-[#746f69]">
            Esta empresa aun no tiene activo el paquete premium de repartidores. Al activarlo,
            podra crear repartidores, asignarlos y ver pagos semanales.
          </p>
        ) : null}
      </div>

      {canManage ? (
        <form
          onSubmit={submitNewDriver}
          className="grid gap-3 rounded-[32px] bg-white p-5 shadow-xl shadow-[#25262B]/10 lg:grid-cols-[1.1fr_0.8fr_0.8fr_140px_1fr_auto]"
        >
          <Input
            label="Nombre"
            value={draft.name}
            onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
            placeholder="Ej. Carlos Perez"
          />
          <Input
            label="Telefono"
            value={draft.phone}
            onChange={(value) => setDraft((current) => ({ ...current, phone: value }))}
            placeholder="WhatsApp"
          />
          <Input
            label="Cedula"
            value={draft.documentNumber}
            onChange={(value) => setDraft((current) => ({ ...current, documentNumber: value }))}
            placeholder="Uso interno"
          />
          <Input
            label="% comision"
            value={draft.commissionPercent}
            onChange={(value) => setDraft((current) => ({ ...current, commissionPercent: value }))}
            type="number"
          />
          <Input
            label="Nota"
            value={draft.notes}
            onChange={(value) => setDraft((current) => ({ ...current, notes: value }))}
            placeholder="Opcional"
          />
          <button
            type="submit"
            disabled={savingDriverId === "new"}
            className="self-end inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2E3A79] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {savingDriverId === "new" ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
            Crear
          </button>
        </form>
      ) : null}

      <div className="grid gap-3">
        {drivers.map((driver) => {
          const driverDraft = editingDrafts[driver.id] || driverToDraft(driver);
          const isSaving = savingDriverId === driver.id;

          return (
            <article key={driver.id} className="rounded-[28px] bg-white p-5 shadow-xl shadow-[#25262B]/10">
              <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.8fr_140px_1fr_auto]">
                <Input
                  label="Nombre"
                  value={driverDraft.name}
                  disabled={!canManage}
                  onChange={(value) =>
                    setEditingDrafts((current) => ({
                      ...current,
                      [driver.id]: { ...driverDraft, name: value },
                    }))
                  }
                />
                <Input
                  label="Telefono"
                  value={driverDraft.phone}
                  disabled={!canManage}
                  onChange={(value) =>
                    setEditingDrafts((current) => ({
                      ...current,
                      [driver.id]: { ...driverDraft, phone: value },
                    }))
                  }
                />
                <Input
                  label="Cedula"
                  value={driverDraft.documentNumber}
                  disabled={!canManage}
                  onChange={(value) =>
                    setEditingDrafts((current) => ({
                      ...current,
                      [driver.id]: { ...driverDraft, documentNumber: value },
                    }))
                  }
                />
                <Input
                  label="% comision"
                  value={driverDraft.commissionPercent}
                  disabled={!canManage}
                  onChange={(value) =>
                    setEditingDrafts((current) => ({
                      ...current,
                      [driver.id]: { ...driverDraft, commissionPercent: value },
                    }))
                  }
                  type="number"
                />
                <label className="flex items-end gap-2 pb-3 text-sm font-black text-[#746f69]">
                  <input
                    type="checkbox"
                    checked={driverDraft.isActive}
                    disabled={!canManage}
                    onChange={(event) =>
                      setEditingDrafts((current) => ({
                        ...current,
                        [driver.id]: { ...driverDraft, isActive: event.target.checked },
                      }))
                    }
                  />
                  Activo para asignar
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateDriver(driver.id, driverDraft)}
                  disabled={!canManage || isSaving}
                  className="self-end inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F8F3E8] px-5 py-3 text-sm font-black text-[#2E3A79] disabled:opacity-60"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar
                </button>
              </div>
            </article>
          );
        })}

        {!drivers.length ? (
          <div className="rounded-[28px] bg-white p-5 text-sm font-black text-[#746f69]">
            {isLoading ? "Cargando repartidores..." : "Aun no hay repartidores creados."}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Input({
  disabled = false,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#746f69]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-black outline-none focus:border-[#2E3A79] disabled:bg-[#F8F3E8]"
      />
    </label>
  );
}
