# Seguridad y Hardening - VendeMas

Fecha: 2026-07-07  
Alcance: auditoria de aplicacion Next.js/Supabase, APIs, multi-tenant, datos de clientes, pedidos, delivery y exportacion.

## Veredicto

Estado: **mejorado y apto para beta controlada**, con riesgos residuales documentados.

El proyecto ya tiene una base razonable: service role solo en servidor, APIs de panel/admin con autenticacion, recalculo server-side de pedidos, RLS habilitado segun checks previos y tablas privadas sin grants publicos segun la verificacion anterior.

En esta ronda se endurecieron puntos de fuga de informacion y se agrego export seguro de clientes para comercios.

## Cambios aplicados

| Area | Cambio | Motivo |
| --- | --- | --- |
| APIs panel/admin | Errores inesperados ahora devuelven mensaje generico | Evitar filtrar SQL, estructura interna o mensajes de proveedor |
| Pedido publico | Errores internos de `/api/orders` ya no exponen detalle tecnico | Evitar fuga de informacion en un endpoint publico |
| Signup | Error interno generico y limpieza best-effort | Evitar exponer errores de Supabase/Auth al publico |
| Entrega2 webhooks | Errores internos genericos | Evitar filtrar detalles internos a terceros |
| Cron tasas | Error interno generico | Evitar exposicion de error de base de datos |
| Admin eliminar comercio | `order_integrations` se elimina por `order_id` | Corregir borrado definitivo y evitar residuos |
| Clientes | Nuevo endpoint `GET /api/panel/customers/export` | Descargar reporte CSV compatible con Excel por comercio |
| Export clientes | Auth panel, control multi-tenant, rate limit, limite 5000 filas, CSV injection guard | Exportar data sin abrir fuga entre comercios |
| Persistencia | Nuevo `supabase/data_persistence_checks.sql` | Validar pedidos, items, extras, clientes, pagos y delivery guardados |

## Riesgos revisados

### Secretos

- `SUPABASE_SERVICE_ROLE_KEY` aparece solo en `src/lib/supabase/admin.ts`.
- No hay service role en componentes cliente.
- No se imprimen valores secretos.

### Multi-tenant

- APIs panel usan `requirePanelAuth`.
- Acceso por comercio se valida con `assertStoreAccess` cuando se opera sobre un `storeId`.
- Founder puede acceder a todos los comercios por diseño.
- Export de clientes respeta `auth.storeIds` y solo permite `storeId` si el usuario lo puede acceder.

### Datos de pedidos

- `/api/orders` recalcula productos, variantes, opciones, delivery y totales desde Supabase.
- No confia en precios del frontend.
- Valida disponibilidad de producto y opcion.
- Guarda items y extras en tablas separadas.
- Actualiza/crea cliente con `safeUpsertCustomerFromOrder`.

### Datos de clientes

- Modulo Clientes lee solo comercios autorizados.
- Export CSV incluye datos basicos: comercio, nombre, telefono, pedidos, total, ticket, ultima compra, preferencias, pagos pendientes, etiquetas y notas.
- CSV protege celdas que empiecen con `=`, `+`, `-`, `@`, tab o retorno para reducir riesgo de formula injection en Excel.

### Endpoints publicos

- `/api/orders` tiene limite de tamano y rate limit.
- `/api/signup` tiene limite de tamano y rate limit.
- Webhooks Entrega2 exigen secreto y limite de tamano.
- Cron de tasas exige `CRON_SECRET` en produccion.

## Riesgos residuales

| Riesgo | Severidad | Estado | Recomendacion |
| --- | --- | --- | --- |
| Rate limit en memoria | Media | Aceptable para beta | Migrar a Upstash/Redis si escala o hay abuso real |
| Supabase advisors no ejecutados por timeout anterior | Media | Pendiente operativo | Ejecutar advisors desde red estable o dashboard |
| `npm audit` por `next -> postcss` | Media | Pendiente upstream | No usar `--force`; actualizar Next cuando salga parche seguro |
| Logs `console.warn` server-side con mensajes de error | Baja | Aceptable | Cambiar a logger con redaccion antes de crecimiento |
| Export CSV contiene PII de clientes | Media | Mitigado con auth | Usar solo por usuarios autorizados y no reenviar archivos sin cuidado |
| Eliminacion definitiva admin es poderosa | Alta operativa | Mitigada con reautenticacion | Hacer backup antes de borrar comercios reales |

## Como validar que se guardan los datos

1. Hacer un pedido real de prueba por comercio.
2. Abrir Supabase SQL Editor.
3. Ejecutar `supabase/data_persistence_checks.sql`.
4. Revisar:
   - `recent_order_integrity`: cada pedido debe tener `item_count > 0`.
   - `orders_without_items`: debe ser `0`.
   - `order_items_without_order`: debe ser `0`.
   - `order_item_options_without_item`: debe ser `0`.
   - `recent_orders_without_customer_record`: debe ser `0` si hay telefono normalizado.
   - `delivery_data_capture`: delivery debe tener provider/pricing/status segun modalidad.
   - `payment_data_capture`: pedidos deben tener metodo y estado de pago.

## Como bajar reporte de clientes

1. Entrar al panel del comercio.
2. Ir a `Clientes`.
3. Usar filtros si hace falta.
4. Presionar `Excel`.
5. Se descarga `clientes-vendemas-YYYY-MM-DD.csv`.
6. Abrirlo con Excel o Google Sheets.

El archivo respeta el comercio del usuario autenticado. Un comercio no debe poder descargar clientes de otro.

