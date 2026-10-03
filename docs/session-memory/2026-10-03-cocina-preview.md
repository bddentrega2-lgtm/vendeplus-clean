# Cocina opcional: Preview aislado, 2026-10-03

## Alertas configurables, filtro Activos y Pedidos compactos

- Se resolvieron las prioridades operativas2-5: Pedidos abre en Activos, puede alternar Todos, muestra actualizacion durante debounce/fetch, snapshot distingue `tableOrders` y `counterOrders`, y los umbrales de demora son configurables por fase.
- Umbrales default: received10, accepted10, preparing20, ready10, delivering30; enteros1-240. La API valida server-side. `Demorado` se activa solo al superar, no igualar, el umbral de la fase actual. Se presenta en rojo en Pedidos, Cocina y Mesas usando timestamps ya consultados, sin N+1 ni reloj remoto adicional.
- Migracion nueva `20261003170000_configurable_order_delay_alerts.sql`, aditiva e idempotente, aplicada unicamente a XPQM. Produccion no tiene estas columnas todavia y requiere migracion antes de promover esta web.
- Tarjetas Pedidos redisenadas tras feedback: aproximadamente110px de alto en escritorio para casos compactos frente a~220px anterior. Codigo+total, cliente+antiguedad, estado+reloj y acciones forman cuatro zonas. Se elimino la etiqueta redundante Estado, WA/Detalle usan iconos con title/aria-label y se mantienen pago/modalidad/Cocina. En movil no se truncan nombre, fecha o tarifa; controles tactiles min40px en app. Tablet usa3 columnas+acciones y escritorio app4.
- Error aprendido: `native-polish.css` dependia de los indices de seis hijos de la tarjeta anterior; tras cambiar DOM comprimio `Nuevo` e iconos. Se reemplazo por reglas semanticas de cuatro bloques y breakpoints768/1024. No asumir que Tailwind web basta para Capacitor.
- Preview final `https://vendeplus-clean-occ2dus6o-entrega2-s-projects.vercel.app`, deployment `dpl_Hpsp4H8CBZYXpH1PPXudWnsU3wvB`, READY/shared. Produccion conserva `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- QA: build257/TypeScript,131 contratos, ESLint focal, diff-check y E2E mock web/app6anchos PASS. Simulacion remota PICO:22 total,7 Activos,15 completados, Cocina2/2/2,10 mesas/3 activas, cero overflow. Guardado real de umbrales PASS y valor0 rechazado400. Primer timeout remoto fue una expectativa antigua de22 mientras Activos mostraba correctamente7; auditor actualizado para validar7 y luego cambiar a Todos/22.
- No commit/push, deploy productivo ni APK. Siguiente: validacion humana de densidad, filtros y demora; prueba simultanea en dos dispositivos antes de autorizar migracion+produccion.

## Hora pico realista y mesas compactas

- Escenario staging persistente `PICO-*`: 22 pedidos sinteticos, distribuidos 10 Mesa, 2 Barra, 5 Delivery y 5 Retiro; productos, cantidades, variantes, extras, notas, efectivo/pago movil y antiguedades distintas. Solo Cocina Demo en `xpqmmdmixpyqruykkbkf`.
- Recorrido por APIs reales del Preview con concurrencia10:14 pagos verificados,21 envios a Cocina,19 inicios de preparacion,17 listos y15 completados. Estado final:15/22 completados (68.2%, entero mas cercano al70%);7 activos: received1, accepted2, preparing2, ready2. Board Cocina: queued2, preparing2, ready2. Mesas fisicas ocupadas3 de10. Barra se conserva en Cocina/Pedidos, no se cuenta como mesa fisica.
- `TablesManager.tsx`: divide Mesas con pedidos y Mesas sin pedidos. Activas primero y por antiguedad del pedido mas viejo (Mesa10, Mesa9, Mesa8 en fixture); libres/desactivadas compactas con nombre, zona, estado, editar y power accesibles. No se presenta una desactivada como disponible.
- QA visual del Preview en1440x1000,800x1000,390x844: Cocina6, Pedidos22, Mesas10, primeras10/9/8, siete tarjetas compactas max101px, cero overflow/pageerror/recorte. Capturas inspeccionadas en `tmp/kitchen-peak`. Vista movil pasa de una tarjeta completa por mesa libre a dos columnas compactas.
- Metricas segunda corrida: create p50/p95310/601ms; payment1471/1583ms; kitchen send192/270ms; prepare232/503ms; ready252/438ms; complete218/249ms; snapshots tables169, orders205, kitchen209ms. Primera corrida tambien paso; pago habia dado454/756ms, por lo que hay variacion y no debe llamarse SLA. Todos los requests exitosos.
- Hallazgos: pago es el unico camino que supera1s en rafaga; Pedidos conserva filas previas mientras espera el filtro debounced (puede aparentar un registro extra transitoriamente);22 pedidos en una sola lista hacen que15 terminados desplacen los7 operativos; snapshot Mesas llama `activeOrders` a la mezcla que tambien incluye Barra, aunque UI filtra por `store_table_id`; faltan umbrales SLA por fase y prueba humana de dos equipos/reconexion larga.
- Herramienta `scripts/kitchen-peak-simulation.mjs`, conectada como `-PreviewAction kitchen-peak`, tiene guardas exactas de proyecto/Preview/store, usuario temporal eliminado en finally, reemplaza solo PICO y elimina parciales ante fallo. El escenario final PICO se deja intencionalmente para revision humana.
- Preview actual `https://vendeplus-clean-cdunn1a5o-entrega2-s-projects.vercel.app`, deployment `dpl_GqfKgAPa9B5m25xPYoQCzeJaF3FP`, READY. Excepcion de proteccion ya existia; login HTTP200. Produccion intacta y verificada `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- Build257 PASS,94/94 pruebas, ESLint focal y diff/sintaxis PASS. Sin SQL/migracion nueva, deploy productivo, commit o push. Proxima prioridad recomendada: filtro Activos+indicador de actualizacion en Pedidos, luego instrumentar pago; solo despues prueba fisica de dos dispositivos y decision productiva.

## Correccion: movimiento entre columnas

- Usuario reporto perdida del movimiento visual por estado tras compactar. Error de alcance nuestro: se cambio la estructura del tablero, aunque solo se necesitaba reducir tarjetas. Guardar estado y actualizar etiqueta no equivale a conservar el flujo visual.
- Restauradas secciones por estado en KitchenManager.tsx, con encabezados/conteos, sin deshacer densidad ni filtros. Todas muestra tres columnas en contenedores>=840px (container query); apiladas con espacio insuficiente. Enfoque de un estado aprovecha cuadricula compacta dentro de su grupo. No cambiar API por una regresion de agrupacion de UI.
- scripts/kitchen.e2e.mjs ahora verifica pertenencia a seccion y salida de la anterior tras prepare/ready, no solo texto/boton. Errores conservan tarjeta original. Cambio simulado de otro operador al refrescar tambien mueve. Comprueba posiciones de encabezados y orden de columnas en escritorio/fullscreen, ademas de10pedidos/6anchos, notas largas, filtros y errores ya existentes.
- PASS6/6 UI,92/92 contratos/Cocina, ESLint focal, build npm.cmd run build257paginas. Browser iab sigue no disponible, fallback Playwright local con HTTPmock; captura final de tres estados inspeccionada. No se cambiaron pedidos existentes ni contrasenas del staging.
- Preview READY y compartido: https://vendeplus-clean-m5mgos1x8-entrega2-s-projects.vercel.app/panel/cocina , dpl_5fXTVX5CvRSYqAvZt6L99stVQY2e. Sondeo intermedio fallo por respuesta Vercel vacia; se reintento sin nuevo deployment y se confirmo READY/produccion intacta.
- Produccion sin cambios dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n, smoke200/307/401. Sin SQL/migracion adicional, commit o push. Archivos solo KitchenManager.tsx, kitchen.e2e.mjs y continuidad.
- Como probar: nuevo enlace, acceso Preview existente, Todas, Iniciar preparacion -> tarjeta columna central, Marcar listo -> columna derecha. En movil los grupos se apilan; filtros permiten enfocarlos. Pendiente validacion humana y dos equipos fisicos; no sumar mas funciones a esta correccion.

## Actualizacion: densidad de comandas

- Feedback: funcionando, pero tarjetas grandes/confusas al recibir10 pedidos. No cambiar logica de negocio.
- KitchenManager.tsx ahora usa cuadricula auto-fill min260px adaptada al contenedor, en vez de tres columnas de estado con espacio vacio. Filtros por estado con contadores y modalidad/busqueda combinables. Todas por defecto, orden del servidor conservado.
- Recibido y tiempo de fase visibles. Tiempos historicos de espera/preparacion bajo details. Productos, cantidades, variantes, extras, notas y excepcion sin pago no se recortan ni ocultan. Botones44px; tipografia14px productos/codigo. No forzar altura fija que corte una comanda larga.
- Color de estado en borde superior: clases border-t-* especificas. Primer screenshot descubrio que border-gray-200 anulaba border-amber-400 general; corregido y test de computedStyle verifica franja distinta del borde base.
- Pruebas scripts/kitchen.e2e.mjs:10 comandas MOCK,6 anchos320/390/800/1024/1280/1440, filtros cruzados, cambios estado y error persistente, notas largas sin espacios que ajustan sin desbordar, colores, fullscreen. PASS6/6. Capturas inspeccionadas;295-335px por tarjeta en fixture con extra y tres notas. 1280normal3columnas y fullscreen4;800tablet2;1440normal4. No es promesa de caber10 completas en cualquier pantalla o con productos ilimitados.
- Build final npm.cmd run build PASS257;92contratos/Cocina PASS;ESLint focal PASS. Browser integrado iab no disponible, fallback Playwright local. No pruebas fisicas nuevas ni pruebas API de mutacion adicionales, pues no se modificaron.
- Preview NUEVO https://vendeplus-clean-a6x7pbsai-entrega2-s-projects.vercel.app/panel/cocina ; dpl_9yfRVCw2y1nAfiuX2oo4KAHT7Lir READY compartido. Misma cuenta/password de Preview, puede pedir login de nuevo por dominio diferente. No se cambiaron cuentas, pedidos o settings de staging en esta actualizacion.
- Produccion intacta dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n con smoke aprobado. Sin nueva migracion/SQL, commit o push. Archivos de esta iteracion: KitchenManager.tsx, scripts/kitchen.e2e.mjs, memorias y puntero raiz.
- Siguiente: validacion humana densidad/filtros/fullscreen. Pendiente V2 no bloqueante: modo compacto de navegacion web general si se solicita; no refactorizar PanelShell por este ajuste local. Los filtros de estado antes sugeridos como V2 ya estan resueltos aqui.

## Actualizacion: acceso humano preparado

- Usuario facilito smash@gmail.com. Cuenta Auth nueva e independiente en staging, owner solo Cocina Demo. Clave inicial de pruebas entregada directamente al usuario, nunca guardada en este documento ni archivos. La contrasena productiva no cambia.
- Login: https://vendeplus-clean-fa83xrgkp-entrega2-s-projects.vercel.app/panel/login?next=/panel/cocina . Usar login Email, no credenciales reales de Smash. No se envio correo.
- Login password verificado y APIs contexto, Cocina, Mesas y Pedidos200; contexto contiene solo Cocina Demo. Siguiente pendiente es prueba humana en dos dispositivos, no obtener correo.
- Auditor inicial olvido storeId query en /api/panel/tables, que usa query y no header:403 esperado, corregido script. No cambiar permisos para resolver un request mal formado. Clave inicial regenerada antes de entrega tras recuperar el aprovisionamiento incompleto.
- Nuevos helpers de acceso staging permiten crear usuario o asociar uno existente sin reemplazar su clave automaticamente. Reset exige flag explicito y rechaza cuentas con otras membresias. Script valida identidad de proyecto/comercio y Preview antes de actuar. Build repetido PASS/257paginas; sin cambios al codigo web, migracion ni nuevo deployment.
- Archivos de esta actualizacion: scripts/ops/{kitchen-preview-access.mjs,buyer-staging-preview.mjs,supabase-buyer-staging.ps1}, memorias y puntero raiz. No commit/push.

## Pedidos legibles, tiempos y Mesas pantalla completa (revision actual)

- Usuario pidio nombres/horas/tarifas completos en PC, estado unico con gorro de envio, tiempos por estado, y posteriormente pantalla completa en Mesas. Todo SOLO Preview.
- Causa recortes: seis columnas rigidas dejaban casi sin ancho al cliente y truncate ocultaba texto. OrdersManager usa tres columnas en dos filas en escritorio, texto envolvente y controles legibles; conserva las posiciones que espera native-polish.css. Gorro iconOnly envia con confirmacion si no esta verificado; una vez enviado es indicador, no segundo selector de estado. Mesas conserva sus acciones anteriores.
- Tiempos: nuevos status_entered_at/status_elapsed_ms acotados a cinco fases operativas, trigger server-side compartido por Pedidos/Mesas/Cocina. No backfill de pedidos antiguos; primera transicion real comienza registro. Pago/reintento no resetea; reingresos acumulan por fase; finalizados no acumulan tiempo cerrado. No reemplaza first_responded_at/completed_at usados por retos.
- Migracion 20261003153000_order_status_timing.sql aplicada SOLO xpqmmdmixpyqruykkbkf mediante KitchenAction timing-apply. GET incluye campos en consulta existente (sin N+1) y serverTime; fallback si esquema anterior carece de campos. PATCH devuelve tiempo servidor; UI mergea resultado confirmado, refresca Cocina y evita respuesta de lectura anterior a mutacion confirmada. Tick local15s sin peticion adicional por reloj.
- Hallazgo QA: errores de mutacion en Pedidos se guardaban pero no se renderizaban tras desbloquear panel. Ahora aviso visible y persistente separado del error de carga; error de cambio mantiene estado anterior. No modificar pagos para resolver fallos de operacion.
- Mesas: icono expandir/contraer, header visible en fullscreen, mantiene comprobante y detalle dentro del elemento expandido; fallback de panel fijo para dispositivos sin Fullscreen API, salida explicita/Escape y back nativo. No cambia pedidos/mesas por expandir.
- Archivos nuevos: src/lib/order-status-timing.ts, src/components/panel/orders/OrderStatusTime.tsx, supabase/migrations/20261003153000_order_status_timing.sql, supabase/order_status_timing_test.sql, scripts/order-status-timing.test.mjs, scripts/orders-operations.e2e.mjs. Modificados OrdersManager,TablesManager,KitchenOrderAction,orders-manager-helpers,API orders,critical-contracts,helper staging y memorias.
- QA inicial: PGlite2/2, contratos+Cocina92/92, SQL real timing y Cocina con rollback PASS sin tocar pedidos humanos. UI Cocina6/6 PASS conservando columnas. Lint focal y primer build257 PASS; repeticion final por aviso de error en curso. QA visual Pedidos6anchos web PASS; script encontro aviso invisible (corregido) y una expectativa sin acento (script corregido).
- PGlite no es dependencia de produccion: se reutiliza instalacion tmp/buyer-db-test como buyer-accounts.db.test.mjs. El browser integrado no estuvo disponible; Playwright usa APIs mock, no escribe datos reales.
- QA FINAL: npm.cmd run build257 PASS; ESLint focal PASS;94/94 contratos+Cocina+PGlite; scripts/orders-operations.e2e.mjs PASS web/app simulada en320/390/800/1024/1280/1440, sin recortes de nombre/fecha/tarifa/codigo ni selector; pago no reinicia reloj, fallo conserva estado y aviso, recarga conserva tiempos, gorro envia sin pago. Mesas Fullscreen API abre comprobante/comanda, sale correctamente; fallback fijo PASS320/390/800/1280. Capturas inspeccionadas. Cocina6/6 PASS previamente. Local3107 cerrado.
- Preview FINAL READY y compartido: https://vendeplus-clean-nhxipzcee-entrega2-s-projects.vercel.app/panel/pedidos , dpl_6e7VPtCsRV3dXynZT42k2nU6sfMH. Mesas /panel/mesas, Cocina /panel/cocina. Produccion revalidada dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n intacta. No commit/push ni cambio APK. Credenciales humanas de Preview intactas, no datos humanos modificados. Siguiente: prueba humana de caja/cocina en dos dispositivos, aprobacion antes de planificar produccion.

## Acuerdos y diagnostico

- No construir POS/Caja independiente, mesas abiertas ni cuenta acumulada.
- Pedidos sigue siendo el lugar de gestion completa; Cocina es opcional. Sin Cocina se mantienen los cambios de estado existentes y no se exige verificar pago para preparar.
- Mantener las restricciones existentes de operaciones ya cedidas a empresa delivery; no sobrescribir repartos desde Cocina.
- Solo comercios autorizados por admin para Mesa y con Mesa activa pueden usar Cocina. Misma cuenta; ajustes owner/admin existentes.
- Entrada configurable manual o al verificar pago. Excepcion manual sin pago permitida; no convierte el pedido en pagado o gratuito.
- Seguimiento cliente usa orders.status existente: preparando/listo, sin inventar estados incompatibles. Pedidos/Mesas entregan.
- Tiempos persistentes de recepcion, espera, preparacion y listo. Modalidad y origen separados.
- Manual Mesa antes guardaba pickup+referencia libre sin FK; ahora se puede elegir una mesa activa real, validada por comercio en servidor.

## Cambios y archivos

- `supabase/migrations/20261003120000_optional_kitchen_board.sql`: settings por comercio, ticket unico por pedido, RPC con locks y expectedState, sincronizacion con orders, canales privados existentes, RLS sin acceso directo anon/authenticated.
- `src/app/api/panel/kitchen/route.ts`: API autenticada y scoped, consulta paginada, configuracion manager, operaciones atomicas; sin telefonos/comprobantes en Cocina.
- `src/lib/kitchen.ts`, `src/hooks/use-kitchen.ts`, `src/components/panel/KitchenManager.tsx`, `KitchenOrderAction.tsx`, `src/app/panel/cocina/page.tsx`: interfaz y realtime con sondeo de respaldo, filtros, notas y tiempos. Errores de mutacion permanecen visibles aun al refrescar datos.
- `OrdersManager.tsx`, `TablesManager.tsx`: envio/estado Cocina; Mesas elimina listado separado de barra. No se modifica PATCH normal de estados.
- `ManualOrderManager.tsx`, `src/app/api/panel/orders/route.ts`: seleccion y snapshots de mesa real; precios/opciones siguen recalculados en servidor.
- `PanelAuthProvider.tsx`, `PanelFrame.tsx`, `PanelShell.tsx`, API context, `orders-manager-helpers.ts`, `src/lib/mobile/state.ts`: acceso y navegacion, sin cambios Android nativos.
- Scripts Kitchen unit/UI/API, SQL transaccional y seed; helpers existentes de staging ampliados con guardas estrictas del proyecto.

## Entornos y migracion

- Preview: https://vendeplus-clean-fa83xrgkp-entrega2-s-projects.vercel.app/panel/cocina
- Deployment dpl_8iSLKBSJ8BYK2zpc9wSV2ZmEDJzn, READY, no target production.
- Staging xpqmmdmixpyqruykkbkf, exclusivamente cocina-demo/tienda-demo. Migracion aplicada SOLO aqui. No reaplicar CREATE TABLE; `-KitchenAction refresh-functions` actualiza exclusivamente tres funciones de este modulo en staging.
- `-KitchenAction seed` creo dos mesas y cuatro pedidos ficticios, idempotente. No copia datos de comercios reales.
- Produccion sigue dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n, rollback dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC. Smoke final 200 publicas,307 login,401 API privada.
- No hay SQL que el usuario deba ejecutar ahora. Despliegue futuro necesita esta migracion primero y autorizacion explicita. No commit/push actual.

## Validaciones y errores aprendidos

- Build local npm.cmd run build via mobile-local.mjs: PASS, Next16.3.4,257 paginas. Build Vercel READY.
- 101/101 tests: critical-contracts + firebase push + kitchen. ESLint focal0errores/0warnings, diff-check PASS.
- SQL con BEGIN/ROLLBACK: cuatro modalidades, excepcion sin pago, precios/fee intactos, aislamiento tenant, deduplicacion, reintentos, estados obsoletos, cancelacion, estados sin Cocina, flags admin/RLS. Todo PASS.
- Regresion de estado listo->preparando dejaba ready_at y congelaba tiempo: se limpia al volver a preparacion; al volver a received/accepted se limpian ambos hitos. Prueba SQL agregada.
- Seed inicialmente uso table_delivery; la restriccion real es table_service/counter_pickup. La transaccion fallo sin persistir y se corrigio; Manual API ya usaba table_service correctamente. No inventar valores de enums.
- Browser integrado devolvio iab no disponible; se uso Playwright local. Mock HTTP protege de escrituras reales. 320/390/800/1280: filtros, notas/extras, pasos de estado, error persistente, ajustes y geometria PASS. Capturas inspeccionadas en tmp/kitchen-qa (ignoradas).
- API REAL contra Preview: usuario temporal de Auth exclusivo staging, membresia owner solo Cocina Demo, anon401 y otro tenant403, board con items/options, listado mesas, envio sin pago dos veces sin duplicar, preparing/ready, transicion obsoleta rechazada400. Con Cocina desactivada, PATCH Pedidos accepted/preparing/ready/completed PASS.
- API REAL extendida: producto temporal sin variantes, pedido manual Mesa con nombre falso cliente sustituido por nombre validado; FK/snapshots correctos. En modo paid no aparece ticket antes del pago; PATCH payment verified crea ticket automatico. PASS.
- Usuarios/pedidos/productos QA eliminados; settings originales restaurados en finally. No se modifican cuentas humanas. Seed demo permanece.
- Tiempos API desde esta PC: operaciones Cocina calientes~0.18-0.40s, Pedidos~0.23-0.33s, board~0.26s caliente/~0.91s primera prueba. No es prueba de carga ni SLA nacional; no prometerlo para otras redes.

## Como probar y pendientes

1. Falta correo para asignar operador humano al staging. Usuario contesto "gran combo"; se solicito correo, nunca contrasena. Gran Combo real NO habilitado ni modificado.
2. Entrar en Preview con acceso SOLO Cocina Demo. Cocina tiene tres comandas ficticias; otra de Barra sigue pendiente para envio manual desde Pedidos.
3. Confirmar origen/modalidad, productos/extras/notas y tiempo; preparar/listo y ver el mismo cambio en Pedidos/seguimiento.
4. En dos dispositivos probar caja y cocina, reconexion y estados simultaneos. Los tests actuales no certifican dos equipos fisicos ni impresora.
5. Desactivar Cocina y operar normalmente en Pedidos. Rehabilitar y probar modo pago con un nuevo pedido ficticio.
6. Aprobar UX y luego planear migracion+publicacion. No incluir cambio de APK o produccion automaticamente.

V2: origen dedicado en esquema en lugar de prefijo historico de notas; vista movil por pestañas de estado si el volumen lo requiere; perfiles diferenciados, alertas configurables, pruebas carga/realtime prolongadas. No se agregaron impresion automatica por enviar a Cocina, caja abierta o estados financieros.
# Ajuste operativo final: estados, Barra y Realtime

- El flujo de orden es general y Cocina lo reutiliza: received -> accepted -> preparing -> ready -> completed/delivering. Pago verificado y envio manual a Cocina solo promueven received a accepted; no retroceden estados.
- Alertas son opcionales (`delay_alerts_enabled`, default false). El detalle historico desplegable de Cocina se retiro por redundante.
- Mesa/Barra presenta `counterOrders` por separado y comparte mutaciones con `tableOrders`; acciones compactas siguen siendo accesibles.
- La etiqueta `Actualizacion periodica` era real: staging carecia de policy SELECT en `realtime.messages`. Aplicada policy privada historica solo staging y comprobado evento `kitchen_changed`; no falsificar nunca `En vivo` cuando el canal no este suscrito.
- Reutilizar un singleton de Supabase por pestana evita multiples GoTrueClient y sockets por cada modulo.
- Preview final: https://vendeplus-clean-gbywiwlfc-entrega2-s-projects.vercel.app, deployment dpl_738mUqgqAjkXLN7DUhe9hoebGrGQ. Produccion intacta.
# Ajuste final: configuracion, Realtime y notas

- Alertas de demora pertenecen al engranaje de Cocina, no a Filtros de Pedidos. Pedidos solo consume la configuracion para resaltar demoras.
- El encabezado de Cocina muestra un estado visible y veraz: `En vivo`, `Respaldo cada 15 s` o `Sin conexion`.
- Las comandas muestran extras, notas por producto y nota general. En pedidos manuales se limpia solo el prefijo tecnico y se conserva el mensaje util.
- Preview validado: https://vendeplus-clean-6w4d77tsh-entrega2-s-projects.vercel.app/panel/cocina (`dpl_Gx7sQFRjqoCTSzuem6fET8rsnmt7`). Produccion intacta.
# Correccion del falso respaldo Realtime

- Supabase reutiliza canales con el mismo topic. Cocina y el notificador general se suscribian por separado al mismo topic: el segundo no recibia otro `SUBSCRIBED` y podia eliminar el canal compartido al desmontar.
- Se centralizo un canal por comercio con listeners y conteo de consumidores en `src/lib/panel/store-orders-realtime.ts`.
- Browser movil autenticado real confirmo `En vivo` con Cocina y notificador montados juntos. Preview: https://vendeplus-clean-o18q9ee5p-entrega2-s-projects.vercel.app/panel/cocina.
# Nombre del cliente en Cocina

- `customer_name` se incluye en el board y aparece debajo del codigo de la comanda; tambien permite buscar por cliente.
- No se expuso telefono ni se agregaron consultas. Nombres largos envuelven sin overflow en320-1440px.
- Preview: https://vendeplus-clean-v2qkncas3-entrega2-s-projects.vercel.app/panel/cocina.

# Cancelacion desde Cocina

- Cada comanda tiene X roja compacta en todos los estados activos. Solicita motivo y usa `/api/panel/orders` con estado esperado; no duplica la logica de cancelacion.
- Staging real confirmo pedido y ticket cancelados, motivo almacenado, inventario protegido y retiro inmediato del board.
- Preview: https://vendeplus-clean-m3s9vpr9y-entrega2-s-projects.vercel.app/panel/cocina.
# Produccion controlada

- Produccion promovida el 2026-10-03 a `dpl_5HH27Zh8v3TjE1a8fL1xD1efFa6p`; rollback web `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- Cuatro migraciones Cocina/timing/alertas aplicadas a `rvmtjtuztewcrmodrodb`. Pre/post conservaron 63 comercios, 4.225 pedidos, distribucion de estados y 1.980 productos. Cocina quedo con cero settings, cero habilitados y cero tickets.
- Gating real confirmado: Smash con Mesa ve Cocina desactivada y Realtime En vivo; Don Aniello sin Mesa no ve Cocina y el acceso directo falla cerrado. Usuarios temporales eliminados.
- Activar Cocina solamente de forma manual en el comercio piloto. Nunca habilitarla en lote.

# Campana de pedidos revisados

- El estado leido de la campana no debe usar el prefijo privado borrado en logout. La clave durable queda aislada por `accountId:storeId`, contiene solo IDs y conserva un maximo de 500.
- La lista de la campana y su badge tienen significados distintos: la lista muestra pedidos pendientes; el badge cuenta pendientes aun no revisados. Abrir la campana marca los pedidos visibles como revisados.
- El estado previo se migra una vez desde `somos_mobile_v1_private_order_read_*`; el evento `storage` sincroniza otras pestanas del mismo navegador.
- Preview con correccion: `https://vendeplus-clean-ltbmcef43-entrega2-s-projects.vercel.app`, deployment `dpl_7T4QVpFFEm2fdEbgbABHMpB8s54G`. Produccion no fue promovida.
