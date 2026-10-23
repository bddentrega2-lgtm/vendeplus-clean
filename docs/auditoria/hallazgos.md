# Hallazgos priorizados (revision estatica ampliada)

Prioridad = impacto potencial x probabilidad/exposicion x urgencia. `P1`
requiere reproducir y corregir antes de ampliar el uso de ese flujo; `P2`
requiere plan y prueba focal; `P3` es deuda controlada. Ningun hallazgo es
declaracion de explotacion o incidente si no se observo tal evento.

## A-16 - Agencia activa expone columnas internas a lectura publica (P1)

- **Clase:** permiso amplio confirmado en migraciones **y comprobado en
  produccion sin descargar filas**. Un GET anonimo
  `transport_agencies?select=admin_notes&limit=0` dio HTTP 200; el control
  `stores?select=monthly_price_usd&limit=0` dio HTTP 401. HEAD con conteo
  mostro 8 agencias activas, 4 de ellas con `rates_visibility=private` al
  momento de la prueba. No se leyeron valores de notas, tarifas ni pagos.
  `20260711153646_freeze_public_rls_and_grants.sql:80,206-211` otorga
  `SELECT` de **toda** `public.transport_agencies` a `anon` y
  `authenticated`; la politica RLS limita filas activas, no columnas. La
  tabla incluye `admin_notes`, `contact_email` y `rif` desde
  `20260708120000_transport_agency_network.sql:1-22`, terminos de cobro en
  `20260709030237_transport_agency_request_terms.sql:3-6` y detalles de pago
  particulares en
  `20260905020000_integrate_particular_delivery_orders_and_payments.sql:2-4`.
  Ademas, `:81-83,213-259` concede lectura publica de tarifas, zonas y
  tramos activos sin verificar `rates_visibility='private'`, aunque
  `src/app/api/panel/transport/agencies/route.ts:239-249` oculta esas tarifas
  en su respuesta y `TransportMarketplaceSection.tsx:263` tambien respeta esa
  opcion en UI. No se encontro una revocacion posterior especifica.
- **Impacto:** el rol anonimo tiene permiso para leer notas administrativas y
  datos financieros/operativos de agencias activas directamente por PostgREST;
  el SQL tambien permite tarifas marcadas privadas, salvo un control externo
  no visto en esta auditoria. No se consultaron ni copiaron valores reales ni
  se afirma que terceros los hayan accedido.
- **Correccion minima propuesta:** publicar solo las columnas necesarias para el
  directorio, preferiblemente mediante vista/endpoint publico acotado, y
  dejar los datos de administracion y pago detras de APIs autorizadas. Antes
  de revocar, localizar lecturas directas anonimas para no romper marketplace
  ni la seleccion de delivery. Las politicas de tarifas deben consultar
  `rates_visibility` y la conexion aprobada; no basta esconderlas en React.
- **Aceptacion:** con clave anonima no se leen `admin_notes`, RIF, email
  privado, condiciones, detalles de pago ni tarifas privadas; directorio y
  cotizacion siguen
  operando; admin y agencia conservan acceso autorizado.

## A-01 - El admin no exige MFA en la autorizacion efectiva (P1)

- **Clase:** debilidad confirmada en el codigo, sin intento de acceso no
  autorizado. `src/lib/admin/access.ts:5-13` solo exige `isFounderMode`;
  `src/lib/panel/auth.ts:159-171` lo deriva del correo del token o sesion.
  `src/app/api/auth/panel-session/route.ts:65` crea sesion sin nivel AAL y
  `src/lib/server/panel-session-store.ts:30` llama `create_panel_session`, no
  `create_panel_session_v2`. La migracion
  `20260916203000_panel_session_aal_rpc_v2.sql` agrega AAL, pero esta ruta no
  lo consume. El proxy solo lee el flag `founder`.
- **Impacto:** una sesion de fundador con solo primer factor puede administrar
  comercios, usuarios y pagos. No prueba que una cuenta haya sido comprometida.
- **Correccion minima:** exigir AAL2 en la emision de la sesion y en la guardia
  admin, incluyendo peticiones Bearer; prueba negativa con AAL1 y positiva
  con AAL2. Preparar recuperacion de MFA antes de activar la barrera.
- **Regresion:** bloquear al fundador si aun no tiene MFA enrolado. Validar en
  Preview con cuenta propia, sin desactivar accesos actuales por sorpresa.

## A-05 - Pedido persistido antes de vincular comprobante (P1)

- **Clase:** hueco transaccional confirmado por lectura de flujo;
  `src/app/api/orders/route.ts:544-560,689-710`.
- **Activacion:** se comprueba que el token de captura existe, pero
  `createOrderAtomic` inserta cabecera/items antes de verificar que el token
  no pertenezca a otro pedido y antes del `UPDATE` que lo vincula. Si el
  comprobante ya pertenece a otro pedido o el `UPDATE` falla, la API devuelve
  500 **despues** de crear la orden. Un comercio puede verla como recibida y
  cobrar fee aunque el cliente vea un error. No se reprodujo con clientes.
- **Correccion minima:** reservar/vincular comprobante dentro de la misma
  transaccion RPC que crea la orden, con `store_id`, expiracion, no reutilizacion
  y replay idempotente validados. No resolverlo con borrar la orden tras el
  fallo: ya existen triggers, stock y efectos observables.
- **Aceptacion:** error al usar token ajeno/usado deja cero ordenes nuevas;
  fallo entre insert y asociacion hace rollback completo; un reintento con
  misma clave devuelve la misma orden y un solo comprobante.

## A-14 - Sharp vulnerable puede recibir SVG en imagen social (P1)

- **Clase:** riesgo de dependencia con camino de entrada plausible, sin
  explotacion ni entorno runtime demostrado. `package-lock.json:6729` fija
  `sharp@0.35.4`, afectado por
  [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)
  (corregido en 0.35.5). `src/app/[storeSlug]/opengraph-image.tsx:20-51`
  acepta imagen de cualquier host `*.supabase.co` y la procesa con
  `sharp(source)` sin rechazar SVG. `src/app/api/panel/settings/route.ts:184-185`
  permite a un gerente configurar esas URL sin comprobar formato.
- **Condicion/impacto:** un SVG especialmente preparado en un host permitido
  puede alcanzar el decodificador librsvg al generar la imagen social; el
  aviso indica posibilidad de RCE bajo condiciones especificas de Linux/glibc.
  No se verifico si el runtime productivo cumple esas condiciones, ni si se
  han usado SVG. La ruta de comprobantes verifica JPEG/PNG/WebP tras metadata
  y no es la evidencia principal de esta exposicion.
- **Correccion minima propuesta:** en cambio acotado y probado, bloquear el
  decodificador SVG o aceptar solo formatos raster por firma real en la imagen
  social; actualizar `sharp` y lockfile a version corregida tras validar build,
  Open Graph y cargas. No confiar solo en extension o Content-Type.
- **Aceptacion:** SVG rechazada antes de decodificar, JPG/PNG/WebP validos
  generan imagen, `npm audit` sin este aviso, build Linux y Windows correctos.
  Esfuerzo bajo-medio; regresion posible en logos SVG existentes.

## A-02 - Pedido sin `quote` devuelve 500 (P2)

- **Clase:** fallo confirmado en produccion con solicitud tecnica incompleta.
  **Contrato:** `src/app/api/orders/route.ts:473,478,491`, `SavedOrder`.
- **Evidencia/activacion:** POST valido en los campos iniciales pero sin
  `order.quote` devolvio 500 y log `Cannot read properties of undefined
  (reading 'zoneId')`. Con `quote` presente, el pedido QA de Retiro se creo,
  aparecio en panel y se cancelo correctamente. `CheckoutForm.tsx:543-575`
  siempre construye `quote`, por lo que no hay evidencia de fallo del flujo
  normal actual; una version cliente antigua o tercero mal formado si lo activa.
- **Actual/esperado:** error interno en vez de 400 explicito antes de consultar
  tarifa/persistir. No creo orden en la reproduccion. Impacto: UX de versiones
  incompatibles, monitoreo ruidoso, soporte; no hay cobro demostrado.
- **Reproduccion:** POST QA sin `quote` a entorno aislado con tienda de prueba;
  repetir con cotizacion valida para verificar que nada cambia. **Correccion
  minima:** validar esquema de `order.quote` antes de uso o usar acceso opcional
  y error 400, sin confiar en su precio. **Riesgo de regresion:** compatibilidad
  de clientes web/Android antiguos y Delivery/Mesa. **Esfuerzo:** bajo.
  **Aceptacion:** 400 legible sin escritura para payload incompleto; cuatro
  modalidades con payload completo siguen creando exactamente una orden.

## A-03 - Fallback de limite por IP es local a cada instancia (P2)

- **Clase:** riesgo fundamentado de capacidad/abuso, no bypass medido.
  **Contrato:** `src/lib/server/rate-limit.ts:8-12,76-101`.
- **Evidencia/activacion:** si `check_rate_limit` de Supabase falla, se usa un
  `Map` de proceso. En despliegue con varias instancias el contador no es
  compartido; puede reiniciarse con cold start. El `Map` no tiene limpieza de
  claves vencidas, por lo que muchas claves distintas durante una falla de DB
  pueden elevar memoria hasta reinicio. Actualmente es un fallback
  deliberado que conserva disponibilidad, pero no la misma proteccion.
- **Actual/esperado:** la limitacion puede ser menos estricta justo cuando la
  DB falla. Impacta signup, carrito, orden, cotizacion y otros endpoints que
  llaman `checkDistributedRateLimit`; no implica acceso a datos ajenos.
- **Prueba:** fallo simulado de RPC con dos procesos aislados, sin trafico de
  carga a produccion. **Correccion minima:** clasificar rutas por riesgo:
  fallar cerrado o degradar con alarma en altas/operaciones costosas, mantener
  disponibilidad controlada donde proceda. **Esfuerzo:** bajo-medio;
  **regresion:** pedidos durante caida de DB. **Aceptacion:** politica de
  degradacion documentada y probada por tipo de ruta.

## A-04 - Limpieza de comprobantes acotada a 200 por ejecucion (P3)

- **Clase:** riesgo inferido de crecimiento; volumen actual no medido.
  **Contrato:** `vercel.json` y
  `src/app/api/cron/payment-receipts-cleanup/route.ts:12-40`.
- **Evidencia/activacion:** cron diario, `.limit(200)` y respuesta `hasMore`,
  pero no se ve otro ciclo ni reprogramacion. Si vencen mas de 200 archivos al
  dia, la cola puede crecer. Ante error tras borrar Storage y antes de marcar
  DB, el siguiente intento requiere comprobar recuperacion idempotente.
- **Impacto:** retencion superior a la esperada y costo de Storage; no se
  confirma incumplimiento porque falta volumen y politica real de retencion.
- **Prueba:** fixture aislado con >200 registros y fallo entre Storage/DB.
  **Correccion minima:** lotes repetibles con limite temporal y metricas de
  backlog, preservando autenticacion del cron. **Esfuerzo:** bajo-medio;
  **regresion:** borrado de evidencia aun vigente. **Aceptacion:** backlog
  decrece y ninguna prueba borra comprobantes no vencidos.

## A-07 - Resumen admin transporta todas las ordenes del periodo (P2)

- **Clase:** limite de escalabilidad confirmado en implementacion, sin p95
  medido. `src/app/api/admin/summary/route.ts:10-21,45-83` pagina de 500 en
  500 todas las ordenes y pagos del periodo de todos los comercios para sumar
  en Node. La vista completa agrega mas consultas y contadores exactos.
- **Impacto:** tiempo, memoria y trafico PostgREST crecen con el numero de
  pedidos nacionales. Un periodo mensual amplio es el caso mas costoso.
- **Correccion minima:** agregar/resumir en PostgreSQL por periodo y comercio,
  mantener desglose paginado, comprobar equivalencia centavo a centavo y
  tiempos con datos anonimizados. **No** cachear saldos sin invalidacion.
- **Aceptacion:** resultados identicos y p95 estable al multiplicar pedidos;
  cancelar sigue contando fee segun la regla del producto.

## A-08 - Marketplace y directorios tienen topes silenciosos (P2)

- **Clase:** riesgo confirmado en codigo. `src/lib/supabase/catalog.ts:1039-1078`
  carga comercios sin paginar, sujeto al maximo de filas PostgREST del proyecto;
  `:1153,1163` limita a 200 conexiones/ajustes de una empresa delivery.
  `src/lib/buyer/ratings-server.ts:6` limita calificaciones a los primeros
  500 IDs, sin pagina siguiente.
- **Impacto:** al crecer el numero de comercios o conexiones algunos pueden
  desaparecer del marketplace o perder su calificacion sin que se vea un error. Volumen actual y
  `max_rows` desplegado no comprobados. `src/app/marketplace/page.tsx:9-21`
  pasa todas las tiendas recibidas al componente cliente, elevando el HTML y
  la hidratacion movil con el crecimiento nacional aunque la lectura se cachee
  60 segundos.
- **Correccion minima:** paginacion server-side estable y verificacion de
  completitud, idealmente por ciudad y elegibilidad, con limite de respuesta
  por pantalla. No enviar todos los comercios al navegador.
- **Aceptacion:** fixture >1000 comercios y >200 conexiones de una agencia;
  todos aparecen al buscar/navegar, sin duplicados.

## A-09 - Fallback de estadisticas puede mostrar totales parciales (P2)

- **Clase:** comportamiento condicional confirmado en codigo si falta/falla
  `panel_store_stats` o su version no es 2.
  `src/app/api/panel/stats/route.ts:250-254,377-417,688,732` limita las
  ordenes a 50-1000, consulta clientes/productos sin paginar y calcula sobre
  ese subconjunto. `capped` usa `billableOrders.length === ordersLimit`, que
  puede ser falso si dentro de las 1000 filas hay cancelados.
- **Impacto:** numeros aparentemente exactos en una degradacion de schema o
  RPC; no se afirma que ocurra hoy. La ruta normal RPC SQL agrega sin ese
  limite (`20260825024934_optimize_panel_store_stats_rpc.sql`).
- **Correccion minima:** no servir agregados truncados como exactos; devolver
  error/degradacion visible o un fallback SQL completo. Alerta si el RPC
  versionado deja de responder.
- **Aceptacion:** con RPC apagada en fixture >1000 ordenes, nunca se presenta
  un total parcial sin aviso.

## A-10 - Limite de cuerpo basado solo en Content-Length (P2)

- **Clase:** riesgo de abuso. `src/app/api/orders/route.ts:202-234` rechaza
  `Content-Length` >180 KB, pero despues usa `request.json()`; sin ese header
  no hay limite real de bytes del cuerpo en esta ruta. Existe un patron similar
  en subida de comprobante antes de `formData()`.
- **Impacto:** peticiones grandes pueden consumir memoria/CPU antes de la
  validacion funcional. No se hizo prueba de carga contra produccion.
- **Correccion minima:** lectura acotada del stream o limite efectivo en el
  edge/runtime, con 413 consistente. Probar cliente movil y cargas legitimas.

## A-11 - La puerta de calidad local falla por reglas sobre los tests (P2)

- **Clase:** fallo reproducido en este worktree: `npm.cmd run lint` salio 1
  con ocho errores `@next/next/no-assign-module-variable` en siete archivos
  de pruebas/documentacion y dos advertencias de hooks. `quality.yml` ejecuta
  lint antes de pruebas/build; un PR con este arbol no pasaria esa puerta.
- **Impacto:** dificulta distinguir fallos nuevos y bloquea despliegues con
  CI obligatorio. No es un error runtime demostrado.
- **Correccion minima:** ajustar los harnesses o el alcance ESLint sin excluir
  codigo de producto. Aceptacion: lint, tests, TypeScript y build verdes en
  checkout limpio con `npm ci`.

## A-12 - Envio externo puede competir con cierre/cancelacion (P2)

- **Clase:** riesgo de concurrencia fundamentado, no reproducido en sistema
  real. `src/app/api/panel/orders/[orderId]/send-delivery/route.ts:428-444`
  lee y comprueba estado; despues crea/actualiza `transport_orders` y, para
  Entrega2 credito, reserva integracion y llama al proveedor en pasos
  separados (`:516-576`, `:137-242`). Otro operador o webhook puede cerrar
  la orden despues de la comprobacion inicial. La reserva por `order_integrations`
  impide dos envios simultaneos, pero no bloquea esa carrera con el estado de
  `orders`.
- **Impacto:** posible despacho de pedido ya cancelado, o estados cruzados;
  fee e historial se mantienen, pero la operacion del repartidor se confunde.
- **Correccion minima:** reserva atomica condicionada por estado vigente de
  orden y proveedor, con conciliacion al recibir respuesta externa. Probar
  cancelacion concurrente antes/durante HTTP y repeticion de webhook.
- **Regresion:** no bloquear reintentos legitimos ni cancelar servicios
  externos ya aceptados sin conciliarlos. Esfuerzo medio-alto.

## A-13 - Cron de tasa actualiza una sede por consulta y no pagina (P2)

- **Clase:** limite de capacidad fundamentado; volumen activo desconocido.
  `src/app/api/cron/exchange-rates/route.ts:30-76` lee comercios activos sin
  paginar y emite un `UPDATE` secuencial por cada uno. Existe indice por
  `orders`, pero no elimina este trabajo N+1; el cron corre diario.
- **Impacto:** con muchas sedes puede agotar tiempo de funcion y dejar tasas
  desiguales o antiguas, afectando montos en Bs del checkout. En el codigo el
  fallback de tasa faltante es 600; no hay prueba de que se use hoy.
- **Correccion minima:** paginar lectura, actualizar por lote/transaccion
  acotada, registrar ultimo lote/errores y alertar tasas vencidas. Probar con
  >1000 sedes ficticias y fallos a mitad, sin tocar tasas productivas.
- **Aceptacion:** cada sede habilitada actualizada o listada como fallida; la
  funcion termina dentro de su presupuesto y puede reanudar sin saltos.

## A-15 - Resumen de ultimo pedido de cliente no verifica sede (P2)

- **Clase:** riesgo condicionado de aislamiento por integridad de datos, no
  fuga observada. `src/app/api/panel/customers/route.ts:158-207` obtiene
  clientes filtrados por sede, pero consulta sus `last_order_id` con solo
  `.in("id", lastOrderIds)` y devuelve productos/importe sin cotejar
  `orders.store_id` ni `orders.customer_id`. La tabla `customers` guarda
  `last_order_id` sin FK compuesta por sede
  (`20260614013000_create_customers.sql:12`).
- **Condicion/impacto:** un puntero incorrecto introducido por importacion,
  backfill o bug futuro permitiria a una sede ver el resumen de una orden de
  otra. El flujo de escritura actual pretende usar la misma sede; esto es una
  defensa de lectura ausente, no prueba de fuga presente.
- **Correccion minima:** filtrar la consulta de ordenes por `store_id` de las
  sedes autorizadas y verificar par `(last_order_id, store_id, customer_id)`
  antes de enriquecer. Considerar restriccion compuesta en una migracion
  futura tras sanear datos. Prueba con cliente cuyo puntero apunta a orden
  ajena: respuesta no revela nada ajeno.

## Observaciones no clasificadas como fallos

- **A-06 descartado para produccion:** el reemplazo de ceros por saldos demo
  de `src/app/api/admin/affiliates/route.ts:18-35` se activa solo con la URL
  `xpqmmdmixpyqruykkbkf`, identificada en `SESSION_HANDOFF.md` como staging
  pausado. Produccion usa otro proyecto (`rvmtjtuztewcrmodrodb`). La primera
  lectura lo clasifico mal como riesgo productivo; no llevarlo al plan de
  remediacion salvo que cambie la configuracion. Confirmar identidad del
  proyecto desplegado antes de toda conclusion sobre datos reales.
- `npm.cmd audit --omit=dev --audit-level=high` tambien marca
  `source-map-js@1.2.1` ([GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q));
  en el arbol local llega por Tailwind/PostCSS y no se encontro un camino
  donde un cliente entregue source maps a SOMOS. Es dependencia afectada, no
  vulnerabilidad explotable demostrada en el servicio. Revisar al reparar CI,
  sin ejecutar `npm audit fix` a ciegas.

- El webhook Entrega2 actualiza integracion, orden y transporte en pasos
  separados, pero `src/lib/entrega2-contract.ts:115-120` acepta reintentos del
  mismo estado y `close_entrega2_order_v2` es idempotente. La hipotesis de
  reintento descartado quedo refutada al leer el contrato completo. Aun falta
  inyectar fallos entre pasos en un entorno aislado; no se declara defecto.
- Archivos de UI de 700-2600 lineas y rutas de 700-1100 lineas concentran
  responsabilidades (`TransportAgencyPanel`, `ConfigManager`, `ProductManager`,
  `OrdersManager`, `/api/panel/orders`), aumentando costo de cambio. Esto solo
  justifica dividir cuando una correccion concreta lo necesite; no un refactor
  masivo preventivo.
- Build y TypeScript locales fallaron por un `node_modules` junction fuera de
  la raiz Turbopack y por dependencias declaradas pero no instaladas en esa
  carpeta compartida. Es bloqueo de verificacion local, no prueba de que la
  compilacion desplegada este rota; ver [cobertura](cobertura-y-validacion.md).
