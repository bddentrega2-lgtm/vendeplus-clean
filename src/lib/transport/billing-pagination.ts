// The factory retains authorized scope and stable ordering by created_at, id.
// Financial calculations must never consume a silently truncated response.
export async function loadCompleteBillingRows<T extends { id: string }>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
) {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  for (;;) {
    const result = await page(rows.length, rows.length + 199);
    if (result.error) throw result.error;
    if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error("No se pudo verificar el total de servicios. Intenta nuevamente.");
    }
    if (result.count > 20_000) throw new Error("El detalle es demasiado amplio. Selecciona un periodo menor.");
    if (expected !== null && expected !== result.count) throw new Error("Los servicios cambiaron. Actualiza el informe.");
    expected = result.count;
    for (const row of result.data || []) {
      if (!row.id || seen.has(row.id)) throw new Error("Los servicios cambiaron. Actualiza el informe.");
      seen.add(row.id);
      rows.push(row);
    }
    if (rows.length === expected) return { data: rows, error: null };
    // Continue even if PostgREST imposes a page size smaller than requested.
    if (!result.data?.length || rows.length > expected) throw new Error("No se pudo cargar el informe completo.");
  }
}
