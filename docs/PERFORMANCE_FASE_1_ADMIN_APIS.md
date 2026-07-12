# Performance Fase 1 - Admin APIs

Fecha: 2026-07-12, America/Caracas  
Rama: `perf/fase-1-admin-apis`  
Commit de implementacion: `60d3ae9 perf: aggregate admin metrics in postgres`

## Objetivo

Reducir el costo de los endpoints administrativos que cargaban miles de filas desde Supabase para contar o sumar en JavaScript.

Esta fase no modifica autenticacion, autorizacion, RLS, reglas comerciales, checkout ni calculo de precios.

## Archivos modificados

- `src/app/api/admin/summary/route.ts`
- `src/app/api/admin/stores/route.ts`
- `src/app/api/admin/stores/[storeId]/route.ts`
- `supabase/migrations/20260712000604_admin_api_aggregate_metrics.sql`

## Cambio aplicado

Antes:

- `/api/admin/summary` cargaba hasta `20,000` pedidos y `20,000` clientes para calcular totales en Next.js.
- `/api/admin/stores` cargaba productos, pedidos y usuarios con limites altos para agrupar por comercio en JavaScript.
- `/api/admin/stores/[storeId]` cargaba productos, pedidos y clientes completos del comercio para calcular metricas.

Ahora:

- Las metricas agregadas se calculan dentro de PostgreSQL mediante RPCs:
  - `admin_summary_metrics()`
  - `admin_store_metrics()`
  - `admin_store_detail_metrics(p_store_id uuid)`
- Los endpoints admin reciben solo resultados agregados.
- `requireAdminAuth` se mantiene intacto.

### Fallback temporal anti-ruptura

Despues del commit inicial se agrego un fallback server-side para evitar que el admin falle si el codigo se despliega antes de aplicar la migracion SQL.

El fallback solo se activa cuando Supabase/PostgREST reporta que la RPC no existe o no esta en el schema cache (`PGRST202` / schema cache). No oculta errores reales de permisos, datos o autorizacion.

Archivo:

- `src/lib/admin/metrics-fallback.ts`

Cuando la migracion ya esta aplicada, los endpoints usan las RPCs agregadas y no ejecutan el fallback.

## Seguridad

Las funciones se crean sin `security definer`; se ejecutan con los privilegios del invocador.

La migracion revoca `execute` para:

- `public`
- `anon`
- `authenticated`

Y concede `execute` solo a:

- `service_role`

Esto mantiene las RPCs como herramienta server-side de los endpoints admin, no como API publica.

## Validacion local

Comandos ejecutados:

```powershell
npm.cmd run lint
npm.cmd run build
```

Resultado:

- Lint limpio.
- Build limpio.
- TypeScript estricto sin errores.

Tambien se verifico que los tres endpoints ya no contienen los limites masivos:

- `.limit(5000)`
- `.limit(10000)`
- `.limit(20000)`

## Orden seguro de despliegue

El orden ideal sigue siendo aplicar primero la migracion y despues desplegar codigo. Sin embargo, los endpoints tienen un fallback temporal para que el admin no quede inutilizable si se despliega antes de aplicar la migracion.

Orden recomendado:

1. Aplicar `supabase/migrations/20260712000604_admin_api_aggregate_metrics.sql` en staging o produccion.
2. Verificar que las RPC existen y responden con service role:
   - `admin_summary_metrics`
   - `admin_store_metrics`
   - `admin_store_detail_metrics`
3. Desplegar el codigo Next.js.
4. Probar `/admin`, `/admin/comercios` y `/admin/comercios/[storeId]` como founder.

## SQL de verificacion

```sql
select * from public.admin_summary_metrics();
select * from public.admin_store_metrics() limit 5;
select * from public.admin_store_detail_metrics('<STORE_ID_REAL>'::uuid);
```

## Rollback

Si la migracion se aplico pero el codigo no se despliega, no hay impacto visible: las funciones quedan sin uso.

Si el codigo se despliega y hay error con las RPC:

1. Revertir el deploy de Vercel al commit anterior.
2. Mantener las funciones SQL o eliminarlas luego con una migracion de rollback.

Rollback SQL opcional:

```sql
drop function if exists public.admin_summary_metrics();
drop function if exists public.admin_store_metrics();
drop function if exists public.admin_store_detail_metrics(uuid);
```

## Checklist manual

1. Entrar como founder.
2. Abrir `/admin`.
3. Confirmar totales:
   - comercios activos/inactivos;
   - pedidos totales;
   - pedidos de hoy;
   - pedidos ultimos 7 dias;
   - clientes;
   - revenue.
4. Abrir `/admin/comercios`.
5. Confirmar conteos por comercio:
   - productos;
   - productos activos;
   - pedidos;
   - pedidos ultimos 30 dias;
   - usuarios.
6. Abrir detalle de un comercio.
7. Confirmar metricas del comercio.
8. Revisar logs Vercel para errores RPC.

## Riesgos pendientes

- Falta medir endpoints con sesion founder real antes/despues.
- Falta ejecutar `EXPLAIN` en staging/produccion para planes reales.
- Falta confirmar que la migracion fue aplicada en produccion antes de desplegar esta rama.
