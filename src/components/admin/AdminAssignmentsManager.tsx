"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCcw,
  UserRoundPlus,
} from "lucide-react";
import {
  getPanelAuthHeaders,
  getSavedPanelToken,
  hasSavedPanelAuth,
} from "@/lib/panel/client-auth";

type StoreRow = {
  id: string;
  slug: string;
  name: string;
};

type AssignmentRow = {
  id: string;
  store_id: string;
  user_id: string;
  role: string;
  user_email: string;
  store_name: string;
  store_slug: string;
};

async function apiRequest(pin: string, options?: RequestInit) {
  const response = await fetch("/api/admin/assign-user", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getPanelAuthHeaders(pin)),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Error cargando asignaciones.");

  return data;
}

export function AdminAssignmentsManager() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState("");
  const [role, setRole] = useState("operator");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(() => hasSavedPanelAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAssignments() {
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest("");
      const nextStores = data.stores || [];

      setStores(nextStores);
      setAssignments(data.assignments || []);
      setStoreId((current) => current || nextStores[0]?.id || "");
      setIsUnlocked(true);
    } catch (error: any) {
      setError(error.message || "No se pudo cargar asignaciones.");
      setIsUnlocked(false);
    } finally {
      setIsLoading(false);
      setIsCheckingAccess(false);
    }
  }

  async function assignUser() {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiRequest("", {
        method: "POST",
        body: JSON.stringify({
          email,
          store_id: storeId,
          role,
        }),
      });

      setMessage(data.message || "Usuario asignado.");
      setEmail("");
      await loadAssignments();
    } catch (error: any) {
      setError(error.message || "No se pudo asignar usuario.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const savedToken = getSavedPanelToken();

    if (savedToken) {
      loadAssignments();
    } else {
      setIsCheckingAccess(false);
    }
  }, []);

  if (isCheckingAccess) {
    return (
      <section className="rounded-[34px] bg-white p-6 text-center shadow-xl shadow-[#2E3A79]/[0.07]">
        <Loader2 size={22} className="mx-auto animate-spin text-[#25262B]" />
        <p className="mt-3 text-sm font-black text-[#746f69]">Validando acceso...</p>
      </section>
    );
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-xl rounded-[36px] bg-white p-6 text-center shadow-2xl shadow-[#2E3A79]/[0.08] ring-1 ring-[#25262B]/[0.06]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
          <Lock size={26} />
        </div>
        <h2 className="mt-5 text-3xl font-black">Acceso fundador</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          Inicia sesión con un email fundador para asignar usuarios.
        </p>
        <a
          href="/panel/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B]"
        >
          <CheckCircle2 size={18} />
          Iniciar sesión
        </a>
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[#25262B] text-[#FFB547]">
          <UserRoundPlus size={24} />
        </div>
        <h2 className="mt-4 text-3xl font-black">Asignar usuario</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[#746f69]">
          El usuario debe estar registrado primero. Aquí solo se conecta al comercio.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Email del usuario
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="cliente@email.com"
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Comercio
            </span>
            <select
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#746f69]">
              Rol
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-2xl border border-[#25262B]/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#25262B]"
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="operator">operator</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={assignUser}
          disabled={isSaving}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFB547] px-5 py-4 text-sm font-black text-[#25262B] disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Asignar
        </button>

        {message && <p className="mt-3 text-sm font-black text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm font-black text-red-600">{error}</p>}
      </section>

      <section className="rounded-[34px] bg-white p-5 shadow-xl shadow-[#2E3A79]/[0.07] ring-1 ring-[#25262B]/[0.06]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#746f69]">
              Usuarios asignados
            </p>
            <h2 className="mt-1 text-3xl font-black">{assignments.length} accesos</h2>
          </div>
          <button
            type="button"
            onClick={() => loadAssignments()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F8F3E8] px-4 py-3 text-sm font-black text-[#2E3A79]"
          >
            <RefreshCcw size={16} />
            Actualizar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {assignments.map((assignment) => (
            <article
              key={assignment.id}
              className="rounded-2xl bg-[#F8F3E8] p-4"
            >
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <p className="font-black">{assignment.user_email}</p>
                  <p className="mt-1 text-sm font-bold text-[#746f69]">
                    {assignment.store_name} · /{assignment.store_slug}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-2 text-xs font-black text-[#2E3A79]">
                  {assignment.role}
                </span>
              </div>
            </article>
          ))}

          {assignments.length === 0 && (
            <p className="text-sm font-bold text-[#746f69]">
              Todavía no hay usuarios asignados a comercios.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
