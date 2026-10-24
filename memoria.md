# Memoria de trabajo - Entrega2 y SOMOS

## 2026-10-22: MFA Admin sin riesgo para comercios

- La preparacion MFA no debe modificar `create_panel_session`, la cookie ni
  `getPanelAuthContext`: esas piezas son compartidas por todos los comercios.
  El historial conserva RPC v2/AAL, pero el flujo productivo actual usa v1;
  cambiarlo globalmente antes de comprobar recuperacion puede bloquear accesos.
- Fase 1 aislada: pagina `/admin/seguridad` con TOTP nativo de Supabase Auth,
  disponible solo en la interfaz Admin y sin exigir AAL2. Nunca sincronizar ni
  recrear la sesion de panel al verificar un factor durante esta fase.
- Preview ficticio `dpl_J9x7whkzWuX9G8ute41Qdp5ngcF4` permite probar enrolamiento
  y comercio en paralelo. Produccion no contiene este cambio. Antes de exigir
  MFA: probar fundador de prueba, comercio de prueba, nueva sesion y plan de
  recuperacion; luego una bandera exclusiva para Admin, no un cambio global.

## 2026-10-22: exigencia MFA aislada por sesion Admin

- No guardar AAL2 en la cookie compartida del panel. La exigencia usa cookie
  HTTP-only `somos_admin_mfa`, asociada a una fila v2 AAL2 en
  `private.panel_sessions`, y coteja usuario/correo con la sesion normal.
  Cerrar sesion debe revocar ambas filas y limpiar ambas cookies.
- `requireAdminAuth` aplica MFA solo si la bandera de servidor
  `ADMIN_MFA_ENFORCEMENT` es `true`. El endpoint bootstrap de MFA es la unica
  ruta que la omite y sigue obligando founder; no extender esta excepcion.
- La interfaz debe bloquear Admin mientras permite `/admin/seguridad`; de lo
  contrario un founder sin factor no tendria como enrolarlo. Preview activo
  `dpl_4v9MzzMzNhCYef3PZon3gj4bH2qn` fuerza la bandera solo para datos
  ficticios. Produccion permanece sin codigo ni bandera MFA obligatoria.
- La prueba humana del Preview completo paso: el reto reaparecio al cerrar y
  volver a entrar como Admin, y Comercio siguio entrando a `/panel` sin MFA.
  Publicar primero con la bandera apagada y no activar la exigencia productiva
  hasta contar con recuperacion real o un segundo founder preparado.

## 2026-10-22: primera publicacion MFA sin exigencia

- Se promovio `dpl_CknQ5gxrLfaHpxiLJWLVq6ZKAwyA` a `www.somos-ve.com` con el
  codigo MFA disponible, pero `ADMIN_MFA_ENFORCEMENT` no esta configurada en
  Produccion; el resultado efectivo es apagado y Comercio no cambia.
- Smoke oficial: catalogos y login 200; API privada sin sesion 401. Punto de
  rollback: `dpl_B4f65FgAd8oGMB6SEmP4FvinRzfm`. Antes de encender MFA, enrolar
  el factor real y acordar recuperacion/segundo founder.

## 2026-10-22: reset seguro de factor MFA historico

- La pantalla puede mostrar un factor ya existente aunque la exigencia MFA este
  apagada: `listFactors()` refleja Supabase Auth, no una configuracion creada
  por la pantalla actual. Se encontro un factor founder historico de 2026-09-16.
- Para borrar un factor usar primero una lectura exacta, exigir un unico UUID y
  despues borrar por ese UUID. La API administrativa puede devolver una fila
  directa para un solo resultado, no siempre un objeto con `.value`; validar la
  forma antes de mutar. Dos intentos se abortaron sin cambios por esa guardia.
- Despues de eliminar, verificar el conteo exacto. Nunca borrar todos los
  factores ni tocar contrasenas, sesiones compartidas o cuentas de comercios.

## 2026-10-22: MFA Admin obligatorio activado

- Solo Production tiene `ADMIN_MFA_ENFORCEMENT=true`. El deployment activo es
  `dpl_4hZyxgGa8g7grLNgtD51VFJPiijQ`; sin sesion, el bootstrap MFA declara
  `required:true` y las APIs privadas conservan 401. Catalogos/login siguen 200.
- Vercel dejo ese deployment como produccion al finalizar `deploy --prod
  --skip-domain`; comprobar siempre `vercel inspect www.somos-ve.com` antes de
  promover de nuevo. Rollback que deja MFA apagado:
  `dpl_CknQ5gxrLfaHpxiLJWLVq6ZKAwyA`.

## 2026-10-21: cierre QA del Preview de auditoria

- No basta lista vacia: sembrar clientes sin ultimo pedido detecto500. `candidateOrder?.customer_id == null` tambien es true si el objeto no existe; luego leer candidateOrder.customer_phone rompe. Exigir objeto presente. Regresion con last_order_id null y referencia no devuelta reproducida antes del fix.
- Admin/Comercios emitia React418 por useState inicializado desde hasSavedPanelAuth: SSR y navegador diferian. Estado inicial estable y sesion en effect, sin saltar controles server-side; recorrido posterior sin pageerror.
- Volver a filtro cacheado no exige otra llamada HTTP. Probar filtros nuevos en UI y datos completos por API; no tratar cache intencional como fallo. Para ultimo pedido usar fixture con customer_id explicito, no telefono demo vacio.
- Confirmar READY y compartir Preview antes de HTTP QA: primer intento nuevo recibio401 de Vercel, no de SOMOS. Fixtures retirados y prueba repetida sin debilitar auth. Nuevo Preview jqytfi2b1 e informe `docs/auditoria/2026-10-21-qa-preview-final.md`. Sin commit/produccion.

## 2026-10-21: recuperacion aislada de staging SOMOS

- Solo SOMOS: reutilizada rama `nmuypksuaxwyonilzoqs` con respaldo DB/Storage, ensayo de restauracion con ROLLBACK y copia externa verificada. No confundir ramas Supabase con worktrees Git; no tocar Mila/ENTREGA2 ni reactivar el staging independiente pausado. Ver `docs/auditoria/2026-10-21-staging-recuperado.md`.
- GET generico de proyecto puede dar 404 para una rama que CLI/SQL si reconocen. Comprobar identidad, parent y branch ID; no crear otra instancia por inferencia. MIGRATIONS_FAILED es un marcador del pipeline antiguo, no prueba de que el SQL actual no funcione.
- Exportar solo esquema no basta: trasladar configuracion/politicas Storage y Realtime, nunca credenciales, usuarios, pedidos ni objetos productivos. Scrub de todas las variables heredadas por deployment; no modificar variables compartidas de Vercel.
- Restore: excluir solo default ACL del rol gestionado supabase_admin que postgres no puede ejecutar; conservar permisos efectivos y verificar anon/service. Restablecer search_path antes de permisos exportados con funciones sin schema. Usar to_jsonb(roles) para roles de pg_policies y tratar PUBLIC como pseudorol.
- SQL por API en una transaccion evita latencia por cada DDL; native psql sigue siendo necesario para dump con COPY. Primeros ensayos fallidos hicieron rollback, no se ocultaron ni se siguio con una restauracion parcial. Verificar archivos Storage por longitud y SHA256.
- Un test viejo puede violar el contrato actual: expectedStatus es obligatorio y ready->accepted es retroceso prohibido. Corregir el test y probar recorrido hacia adelante; no debilitar el producto para pasar QA.
- Hubo CHANNEL_ERROR inicial de Realtime sin causa demostrada; reintento completo paso con En vivo y cambios efectivos en Mesa. No atribuir causa ni declarar un fix ficticio. En Playwright esperar hidratacion mediante contexto inicial, no networkidle ni llenar antes de hidratar.
- Credenciales demo solo en archivo local ignorado; accesos reales por formulario pasaron. Nunca publicar las claves o incluirlas en Git. Sin commit ni produccion para esta recuperacion.

## 2026-10-18: estados cruzados, lo que mostro la prueba real

- No basta ocultar una comanda de Cocina por `delivery_status`: el ticket persistido tambien debe cerrarse cuando Entrega2 pase a `llevando`. El pedido permanece abierto hasta `entregado`. Prueba HTTP staging confirmo la discrepancia y el trigger `orders_entrega2_handoff_kitchen` la corrigio.
- Una actualizacion de `transport_orders` de una agencia anterior no debe propagar estados a `orders` ni a la integracion vigente. La mutacion ahora comprueba `delivery_type`, proveedor y `transport_agency_id`; prueba SQL con dos agencias paso.
- Verificar pago y autoaceptar son una sola decision sobre la fila bloqueada. Un pago tardio tras la recogida se registra, pero no cambia el estado interno ni reabre Cocina. La autoaceptacion normal con modo de despacho por pago sigue creando la comanda.
- Los webhooks terminales de Entrega2 repetidos SI concilian de forma idempotente: la condicion de estado igual permite volver a recorrer la sincronizacion. No confundir un riesgo hipotetico con un bug confirmado; probar con HTTP y leer el contrato completo antes de cambiarlo.
- Pendiente: `send-delivery` usa varias escrituras independientes y puede competir con cierre/envio externo. No considerar este conjunto listo para produccion por el mero PASS de flujos secuenciales. Preview aislado `dpl_8mpTqvo1GjaAeYxKyLh3oVd9w9Vo`; produccion intacta.

## 2026-10-17: prioridades acordadas para retomar

- El usuario confirma que Global Burger quedo bien y deja para manana la prueba humana del Preview del carrito. No publicar ni crear commit sin nueva instruccion. Preview READY `dpl_7yaVS8zFoJAEJ9rb2YxjffWCS5uM`; produccion permanece en `dpl_GY6a7UvDj8unt2LWCcFc6t56jb13`. Probar en Smash Test: agregar/cambiar cantidad sin espera; al entrar a Finalizar pedido revisar producto oculto, precio cambiado y opcion retirada. El Preview usa datos reales: mutar solo productos de prueba. Informe `docs/audits/2026-10-17-cart-review-preview.md`.
- Prioridad operativa siguiente: resolver la auditoria de estados `docs/audits/2026-10-16-order-status-flow-audit.md`. La entrega de agencias puede quedar abierta en `orders.status` aunque Cocina ya la oculte; proteger transiciones, verificacion de pago y concurrencia de webhooks; completar seguimiento publico para agencias/Retiro. Conciliar historico primero en dry-run, sin cerrar pedidos en masa ni inventar fechas. Hallazgos fechados 2026-10-16; revalidar antes de mutar produccion.
- Seguridad: MFA AAL2 obligatorio en rutas/sesiones de admin sigue pendiente, con enrolamiento y recuperacion previos. Revisar tambien abuso de Auth/registro/sesiones. El parche de Next y el cierre de columnas administrativas ya se publicaron; no tratarlos como pendientes.
- Referidos: reglas y paneles publicados; falta observar el primer ciclo real de un aliado (Google, comercio referido, pago confirmado, fee cobrado y liquidacion), sin marcar pagos ficticios. Android: APK 1.5.1 firmada publicada, pero falta probar esa release en otro telefono/tablet, respaldar la firma, definir titular/contacto/retencion, completar declaraciones y pruebas internas de Play Console.
- Menores: Global Burger conserva `Refresco` y `Agua Mineral` publicados a USD 0; no ocultarlos sin indicacion. Quedan nueve productos sin foto. El build local del worktree falla por junction de `node_modules`/Turbopack; build remoto del Preview paso. Hay tres contratos criticos heredados fallando (WhatsApp oficial, cambio de clave y clasificacion de referidos) que requieren limpieza separada.
- Esta memoria contiene historia, incluidas entradas de "pendiente" que luego se resolvieron. Para el estado actual contrastar con la primera entrada de `SESSION_HANDOFF.md` y los informes recientes; no reabrir trabajos ya publicados por leer una entrada vieja. Git del worktree sigue con cambios sin commit propios del Preview; la raiz tambien esta sucia. No mezclar worktrees ni desplegar la raiz.

## 2026-10-12: auditar aliados sin suplantar accesos

- Revisar condiciones reales con SELECT readonly, saldos de RPC admin y enlace
  publico; no generar sesion de un aliado real para "probar" su panel.
- Correo configurado sin Auth aun no es fallo: pendiente primer login Google.
  Delivery usa membresia owner/admin de su empresa, no un correo extra del codigo.
- FED tiene 0% inicial y50% fee durante1mes: valido y distinto del vendedor.
  No normalizar acuerdos diferentes sin solicitarlo. Informar los valores exactos.
- Git conserva codigo e historial, no las filas de los aliados de Supabase.
  Etiqueta de respaldo remoto sin mover main evita un nuevo despliegue solicitado.
- Compilacion local requiere env privado inyectado. Un nuevo registro de QA puede
  agregar tiendas a staging: no borrarlas. Guard de build readonly puede admitirlas
  sin relajar guardias de deploy/pruebas mutantes ni identidad de credenciales.

## 2026-10-12: publicacion del cobro independiente

- Publicar artefacto con entorno productivo, nunca promover Preview con Supabase
  aislado. --skip-domain puede mover alias del proyecto: verificar dominio oficial
  mediante su HTML antes y despues de promover, no solo targets.production.
- Migracion puntual ensayada con ROLLBACK, bloqueo con timeout3s e historial dentro
  de la misma transaccion; comparar filas antes/despues para preservar solicitudes.
  Ante timeout de red, inspeccionar estado antes de repetir una escritura.
- Produccion permite registros nuevos concurrentes: no borrar ni interpretar como
  fixtures los codigos creados por usuarios durante rollout (verify encontro1).
- Rollback de deployment no revierte SQL ni datos. Version anterior aun exigia
  pago antes de aprobar en API; evaluar coherencia de reglas si hay que volver.
- Controles productivos readonly:19rutas y10vistas PASS, sin crear pedidos/pagos.
  Logs sin errores en ventana corta no equivalen a garantia absoluta.

## 2026-10-12: separar acceso y cobro por decision comercial

- Para renovar acceso QA de una persona no ejecutar demo-login general (rota dos
  cuentas). admin-login/--admin-only limita al adminexistente de staging. Probar
  password+API protegida, cerrar sesion y entregar clave solo por chat, no en docs.

- Nueva regla explicita: solicitud sin pago previo; WhatsApp con condiciones y total;
  admin aprueba acceso y cobro independientemente. No imponer pago previo en SQL
  aunque la interfaz quite el bloqueo. Confirmar monto/referencia no activa cuenta.
- La comision setup debe escuchar ambos cambios (status y setup_payment_status),
  exigir aprobado+confirmado y conservar UNIQUE. Testear ambos ordenes y concurrencia.
- Nunca usar aprobar acceso para llenar setup_paid_usd ni marcar ingreso ficticio.
  Aprobados sin pagar deben poder encontrarse en filtro de pagos pendientes.
- Bienvenida para personas: correoGoogle+aliados; empresasdelivery: cuenta propia+
  transporte. No inventar correo deempresa ni enviar mensajes automaticamente.
- Staging antiguo no tiene historial supabase_migrations: verificar trigger real,
  sin crear historial incompleto ni confundirlo con historial productivo existente.
- Un select envuelto en label puede incluir opciones en su nombre accesible:
  usar prefijo semantico al probar. Capturas y pruebas negativas complementan build.

## 2026-10-12: referidos publicado y comprobado

- Confirmacion explicita del usuario permite preservar solicitudes antiguas;17
  migraciones aplicadas una vez, datoslegacy y permisos verificados antes de promover.
  Confirmar deployment en HTML oficial despues; no confundir alias de proyecto.
- Una falla transitoria de red/CLI no prueba fallo de despliegue ni de SQL. Leer
  estado remoto antes de reintentar escrituras; salida0 sin metadata no basta.
- Comparar registros anteriores y posteriores al intervalo esquema/promocion para
  evitar cobrar20USD a quienes vieron condiciones viejas. Nueve antes/despues,
  trespendienteslegacy preservadas. No se generaron pagos ni registros ficticios.
- QA visual no debe usar longitud minima grande para detectar pagina vacia:
  "Mis referidos" + error de acceso + login puede ser una pantalla valida corta.
  Esperar elemento semantico, revisar contenido/overflow/JS y captura.
- Pruebas productivas readonly y permisos401 no sustituyen Google/correo reales
  ni operacion financiera autenticada. Ese paso requiere primer aliado real.
  No copiar porcentajes de demos a acuerdos comerciales ni marcar liquidado
  sin pago real. Publicar no equivale a commit/push: aun no solicitado.

## 2026-10-12: candidato de referidos sin mover dominio

- `vercel deploy --prod --skip-domain` construye con variables productivas y puede
  mover el alias predeterminado del proyecto, aunque NO mueva somos-ve.com. Revisar
  el deployment ID en el HTML del dominio oficial, no solo project.targets.production.
- Antes de aplicar17 migraciones se ensayaron juntas con rollback, lock timeout3s
  y registros de migracion en la misma transaccion. Verificar esquema e historial
  despues del ensayo: ambos ausentes, cambios no persistidos.
- Los registros anteriores necesitan compatibilidad en SQL, API y botones admin;
  mostrar la etiqueta legacy no basta. Caso11 PASS15 comprobaciones: aprobar sin
  pago y sin comision inventados, y rechazar cobro del inicial legacy.
- Una redireccion307 de admin al login sin sesion es correcta. El smoke debe seguir
  redirecciones de paginas, conservando la exigencia401 JSON en APIs privadas.
- Autorizacion de publicar no resuelve automaticamente condiciones comerciales
  pendientes. Esperar respuesta sobre3 solicitudes previas, sin aplicar cobros
  retroactivos ni crear5 aliados con porcentajes demostrativos.

## 2026-10-12: referidos de principio a fin, solo staging

- No dar por terminado un flujo financiero porque los demos y sumas SQL coincidan.
  Probar registro, comprobante, aprobacion, pedidos, pago de fee y liquidacion por
  las APIs reales. La aprobacion detecto un bucket product-images ausente solo en
  staging; se agrego alli, sin tocar produccion.
- Un resumen agregado sin limites no garantiza que todos los importes se puedan
  liquidar. La prueba de 510 pedidos produjo 511 comisiones y encontro 11 fuera
  del detalle global limitado a 500. Solucion: endpoint admin por aliado,
  paginas de 100 con conteo completo y ajustes netos, seleccion limpia al cambiar
  de pagina/aliado. Validar tambien el navegador, no solo SQL.
- Ejecucion final 4f2730fc6f: 10/10 escenarios, 550 comprobaciones, 607 pedidos
  cobrables y 2 sin fee. Incluye descuentos, cobro rechazado, reintentos,
  cancelados cobrables, manuales, condiciones congeladas y cobro despues del
  vencimiento. Paginas UI 390/1280 sin overflow/errores JS; 20 controles de acceso
  y SQL transaccional pasaron. Datos temporales eliminados.
- No confundir codigo de prueba incorrecto con bug de producto: products usa
  is_available; cancelar exige motivo del conjunto permitido y detalle si es Otro.
  Corregir el harness al contrato existente, no debilitar validaciones para pasar.
- Pruebas con correos .invalid no demuestran entrega de correo. Sesiones QA
  verificadas no demuestran Google OAuth interactivo ni transferencias reales.
  Cerrar solo la sesion QA (signOut scope local), no todas las del usuario demo.
- Produccion aun no tiene tablas/campos/RPC de referidos. Existen 3 solicitudes
  pendientes anteriores al pago de USD20: consultar su tratamiento antes de
  migrar, no cobrar retroactivamente por suposicion. Un rollback de codigo no
  revierte guards de base de datos. Nunca promover artefacto de staging.
- Informe: docs/audits/2026-10-12-referrals-release-readiness.md.

## 2026-10-06: estados que dejaron de verse

### Hechos comprobados

- Entrega2 seguia enviando avisos. Los logs de Vercel muestran que el aviso del 2026-10-06 17:02 UTC llego al Preview antiguo `dpl_EKxrwHMJzg83tzuJxCdNn3TkPWJM`, no al Preview nuevo. El HTTP 200 del endpoint antiguo no demuestra que la logica nueva haya corrido.
- La base guardo el estado terminal del delivery, pero el pedido principal de tres pedidos de Smash Test siguio en `received`. El webhook antiguo no sincronizaba `orders.status` en cancelacion/entrega.
- La regresion visual fue nuestra: quitamos la segunda etiqueta junto a la moto, pero dejamos `orders.status` como unico valor visible en la tarjeta. Los estados intermedios de Entrega2 estan en `order_integrations.status` y nunca se reflejan en `orders.status`; por eso dejaron de verse aunque el webhook funcionara.
- Los pedidos de prueba `SO-1006-105508`, `SO-1006-543269` y `SO-1006-637802` se conciliaron por repeticion autenticada de sus eventos terminales, sin crear otro despacho. Quedaron cancelado, cancelado y completado respectivamente. Verificar cualquier pedido adicional antes de mutarlo.

### Correccion y regla de producto

- La tarjeta de Pedidos conserva un solo espacio de estado, junto a cocina. Si Entrega2 tiene un servicio activo, ese espacio muestra el estado externo (Buscando repartidor, Repartidor asignado, Retirando, Llevando o Con novedad); no se duplica junto a la moto. El estado interno sigue editable en el detalle para preparar la comida.
- Al llegar `cancelado` o `entregado` al webhook nuevo, el pedido principal pasa respectivamente a `cancelled` o `completed`; la cancelacion usa el helper existente para motivo, inventario y metricas. No forzar `orders.status` a valores intermedios que el esquema no contempla.
- La configuracion de Entrega2 no debe apuntar a una URL inmutable de despliegue de Preview. Se creo el alias fijo `https://vendeplus-entrega2-preview.vercel.app/api/integrations/entrega2/order-status`. En futuros previews, primero validar el despliegue y luego ejecutar `node scripts/ops/entrega2-smash-preview.mjs activate` para mover el alias; el comando verifica target Preview y que produccion no cambio.
- La URL en el panel de Entrega2 aun debe ser cambiada manualmente por el usuario. Mantener el mismo Bearer, mapeo y payload; nunca copiar el secreto a chat, logs o repositorio. Un alias no corrige la configuracion externa hasta que ella apunte a el.
- Preview final activado en alias: deployment `dpl_5mFwwvwLvR7F8LMo1Q8oCSjk8EEJ`; el alias se resolvio a ese ID y el webhook sin autorizacion devolvio 401. El seguimiento publico de los pedidos conciliados devolvio estados terminales coherentes.

### Lista de comprobacion antes de afirmar que funciona

1. Consultar `git status` y `SESSION_HANDOFF.md`; no mezclar los worktrees ni promover cambios de Preview a produccion sin autorizacion.
2. Verificar en los logs de Vercel el ID del despliegue que recibio el webhook y su HTTP; no inferir recepcion por datos de BD solamente.
3. Comprobar juntos `order_integrations.status`, `orders.delivery_status`, `orders.status` y el estado mostrado por la tarjeta; no confundir estado logistico con estado operativo.
4. Probar los siete estados de Entrega2, los dos modos de proveedor (directo y empresa delivery), callbacks duplicados y fuera de orden, cancelacion y entrega terminal.
5. En un pedido real controlado, asegurar que no se reenvia a Entrega2 ni se cobra otro despacho durante una prueba de callback.
6. El build local en este worktree debe cargar el entorno del proyecto padre con `@next/env` sin mostrar secretos. El build sin ese entorno falla al prerenderizar `/`, aunque TypeScript compile.

### Estado pendiente

- Usuario debe actualizar en Entrega2 la URL de `Webhook: Cambio de Estado` al alias fijo y probar un nuevo avance real. Hasta entonces, Entrega2 seguira llamando al Preview viejo; no afirmar funcionamiento extremo a extremo futuro.
- Los cambios de codigo siguen solo en Preview; produccion Vercel no fue promovida. No hay migracion ni SQL.

## 2026-10-07: cancelacion externa terminal

- El error visible reaparecio porque Entrega2 siguio llamando una URL vieja de Preview. Antes de tocar estados, consultar logs del deployment exacto: un HTTP200 en una version anterior no garantiza la logica actual.
- Para auditar una cancelacion comparar `orders.status`, `orders.delivery_status`, `order_integrations.status` y `transport_orders.status`; una sola columna en `cancelled` no significa pedido cancelado. Dos pedidos Smash (`SO-1007-131742` y `SO-1007-899622`) se conciliaron con callbacks terminales autenticados al alias vigente, sin reenviar despachos.
- Una integracion Entrega2 terminal debe bloquear la reapertura manual tanto en UI como en API, con acceso por comercio comprobado antes de la guardia. El estado visible es `Cancelado` o `Entregado`; no ofrecer selector operativo para esos casos. No bloquear la preparacion normal mientras el delivery aun esta activo.
- Preview actual `dpl_8FFMWz1UYZg1ubEBkUSNKMRr8jEP` bajo `https://vendeplus-entrega2-preview.vercel.app`; produccion intacta. Faltan la actualizacion manual de la URL externa en Entrega2 y una prueba nueva de cancelacion de punta a punta. No declarar resuelto el flujo futuro hasta ambos pasos.

## 2026-10-07: release con proveedor actual

- Una integracion Entrega2 historica no basta para decidir el estado visible o bloquear acciones. Verificar `orders.delivery_provider`; si es empresa, consultar la agencia actualmente asignada mediante `orders_transport_agency_id_fkey` y comprobar slug `entrega2`. La misma condicion debe aplicarse en UI, PATCH y webhook.
- `transport_orders` permite una fila por `(order_id, agency_id)`, no una sola por pedido. Elegir la fila de `orders.transport_agency_id`, aunque una fila vieja de otra empresa tenga `updated_at` mas reciente.
- QA de release: 149/149 pruebas, build Next/TypeScript, lint focal y lectura real de FK. Preview `dpl_5GiCKmdtz7P9yfnNiJbqM7wHpRtU`; codigo productivo `dpl_DviayccsCdga6XDx7JY9S1Qvdqs8`; rollback `dpl_H1YyhEHKF5oHu4cBN9jeuZ7vN9ic`.
- NO cambiar solo la URL externa a produccion: la clave Bearer de Preview es distinta a la productiva y da 401 en el endpoint productivo. Coordinar ambos campos y probar con un pedido de Smash. Mientras tanto, mantener el webhook en el alias Preview que apunta a BD productiva. No rotar una clave productiva sin poder actualizar Entrega2 inmediatamente.
- Los preflight generales contienen expectativas antiguas de arquitectura; clasificar y reparar aparte. No ocultar sus FAIL ni interpretarlos como regresion de este release.

## 2026-10-08: transicion de credencial Entrega2

- La URL y el `Authorization: Bearer` forman una pareja: Preview y produccion tienen claves distintas. Cambiar solo la URL causa 401; el usuario restauro el alias Preview antes de rotar la clave productiva.
- Rotar `ENTREGA2_WEBHOOK_SECRET` en Vercel requiere redesplegar produccion. Confirmar READY y probar POST sin clave=401 y con clave+pedido ficticio=404 antes de pedir el cambio externo. No imprimir credenciales en chat, logs o Git; copiar JSON al portapapeles local.
- El CLI de Vercel emite progreso por stderr; con PowerShell `$ErrorActionPreference='Stop'` puede abortar un script antes de completar `env update`. Usar un proceso Node con `spawnSync` y stdin para la clave, capturar/sanear salida y comprobar el resultado. El primer intento fallo antes de actualizar; el segundo concluyo y se verifico.
- Nuevo deployment productivo `dpl_4sjszZkSMxtwiHTbx8n6hVim58Mm`; cambio de URL+Header en Entrega2 y prueba real Smash siguen pendientes. El Preview alias permanece operativo mientras tanto.
- Despues del cambio externo, usuario reporto prueba de pedido satisfactoria. Vercel registro cuatro POST nuevos HTTP 200 en el deployment productivo; no hubo 401 en esa secuencia. Sin codigo SO no atribuir logs a una fila concreta ni afirmar auditoria de BD del pedido.

## 2026-10-08: estados historicos que parecen activos

- La integracion `sent` se guardaba al enviar, antes de tener webhooks confiables. 575 integraciones previas al 6 de octubre siguen en `sent`; 10 corresponden a pedidos principales terminales. Traducir `sent` historico como "Buscando repartidor" aparenta actividad que no se puede confirmar.
- Corregir solo la etiqueta de lectura usando `order_integrations.created_at` y un corte fijo de inicio de seguimiento; no usar antiguedad relativa, que cambiaria el significado de pedidos actuales con el tiempo. Priorizar estado final del pedido para `sent` terminal. No reescribir masivamente estados externos sin conciliacion fiable.
- Aplicar coherencia en tarjeta/detalle de Pedidos, transporte y confirmacion publica. Probar ambos lados del corte, terminales, proveedor distinto y API con fecha original. Preview compartido; produccion sigue sin este cambio hasta validacion del usuario.
- Usuario aprobo Preview con `listo`; etiqueta publicada en deployment productivo `dpl_HxioU2sGtxUNpgJ5zbfM4nTFKBqU`. Anterior productivo `dpl_4sjszZkSMxtwiHTbx8n6hVim58Mm` conserva la misma clave para rollback. Smoke web/publico y 401 sin Bearer pasaron; llamada con Bearer no se repitio porque portapapeles ya no tenia la clave. No afirmar callback autenticado nuevo en este deployment hasta observar uno real.
# 2026-10-18 - Estados listos para rollout controlado

- La carrera de `send-delivery` no se resuelve con una segunda lectura de `orders`: el courier puede cambiar el estado entre lectura y escritura. Reservar bajo bloqueo en base de datos y sincronizar leyendo `transport_orders` bajo el mismo bloqueo. Los triggers nuevos rechazan pedido cerrado, empresa anterior y regresion de un servicio avanzado; los particulares (`order_id` nulo) quedan intactos.
- Probar simultaneidad real, no solo secuencias: cancelacion vs reserva, recogida vs upsert antiguo, cancelacion vs reserva directa Entrega2. Las tres invariantes pasaron en staging. El webhook HTTP Entrega2 termino y tolero duplicado. Compilacion remota y suites verdes; build local limitado por junction de dependencias del worktree.
- Produccion no cambiada. El despliegue futuro requiere migracion antes de codigo y smoke de todas las modalidades. Conciliacion historica de pedidos de agencia es una operacion separada, no parte del release.

# 2026-10-18 - Release productivo controlado

- La migracion de estados se aplico en Supabase produccion con transaccion antes de Vercel. Vercel productivo quedo en `dpl_3CPyEhVz17C3oantJbVASS3zBTsr`; rollback anterior `dpl_GY6a7UvDj8unt2LWCcFc6t56jb13`. La matriz QA con rollback paso en produccion y no dejo datos ficticios. Smoke publico y guardias HTTP correctos; sin logs de error inmediatos.
- Aprendizaje: un fixture con slug global `entrega2` colisiona en produccion; el test transaccional debe reutilizar la agencia existente y nunca actualizarla. No confundir un fallo del fixture con fallo de la migracion. SQL aplicado manualmente no equivale a version marcada en `supabase_migrations`; documentar antes de futuros `db push`.
- Sin commit por instruccion AGENTS. Conciliacion historica queda fuera. Ver `SESSION_HANDOFF.md` para estado completo.

# 2026-10-22 - A-14 dependencias e imagen social segura en Preview

- Next.js subio de 16.3.8 a 16.4.2, Sharp de 0.35.4 a 0.35.5 y source-map-js de 1.2.1 a 1.2.2. `npm audit --omit=dev --audit-level=high` queda en cero. Las cinco alertas restantes del audit completo pertenecen al tooling ESLint/braces y npm propone un downgrade incompatible a Next 14; no usar `audit fix --force`.
- La imagen Open Graph del comercio valida firma binaria raster antes de Sharp, bloquea SVG aunque falsee Content-Type y rechaza redirecciones desde hosts permitidos. Pruebas de PNG/JPEG/WebP/GIF, SVG y contenido desconocido: 3/3 PASS; contratos criticos 90/90 y ESLint focal PASS.
- Preview aislado READY/shared `dpl_gUm2pM6TgQHApiL2qwz4cUGbFRbx`: `https://vendeplus-clean-awc0b2lyp-entrega2-s-projects.vercel.app`. Home, Marketplace, tienda demo, login y Open Graph 200; OG devuelve `image/png`. Produccion permanece en `dpl_4hZyxgGa8g7grLNgtD51VFJPiijQ`.
- El `npm.cmd run build` local con Turbopack falla antes de compilar por el junction externo de `node_modules`; Webpack local tambien encuentra dos paquetes declarados pero ausentes del junction. El build limpio de Vercel desde lockfile PASS con las versiones nuevas. No confundir esa limitacion local con regresion.
- Sin migracion, SQL, cambios de datos, commit ni despliegue productivo. Siguiente paso: revision humana breve del Preview y autorizacion separada antes de Produccion.

# 2026-10-23 - A-14 publicado de forma controlada

- Usuario aprobo el Preview y autorizo `procede`. Punto seguro anterior: `dpl_4hZyxgGa8g7grLNgtD51VFJPiijQ`. Se construyo primero el candidato con entorno productivo y `--skip-domain`: `dpl_6mr4mxM26AaGjerUm4KBrohATXf2`, URL `https://vendeplus-clean-lhasaao9s-entrega2-s-projects.vercel.app`.
- Build remoto limpio PASS con Next 16.4.2, TypeScript y 267 rutas. Antes de promover, smoke autenticado de Vercel: Home, Marketplace, Shibui y login 200; Open Graph Shibui 200 `image/png`; Stats y MFA anonimos 401. Luego se promovio exactamente el mismo ID.
- `www.somos-ve.com` y `somos-ve.com` quedaron en `dpl_6mr4mxM26AaGjerUm4KBrohATXf2` READY. Smoke posterior: rutas publicas 200, apex redirige 308 a www, OG PNG, APIs privadas 401 y logs de error sin entradas al revisar.
- Sin migracion, SQL ni cambios de datos. Rollback web inmediato: promover `https://vendeplus-clean-65cbfrxst-entrega2-s-projects.vercel.app` (`dpl_4hZyxgGa8g7grLNgtD51VFJPiijQ`). Sin commit/push; asegurar en Git solo cuando el usuario lo pida.

# Pendientes inmediatos acordados para retomar

1. Implementar limites efectivos de cuerpo/payload con respuestas 413 consistentes, priorizando creacion de pedidos y cargas de comprobantes; validar movil y las cuatro modalidades.
2. Recuperar una puerta CI reproducible: corregir los errores heredados de lint en harnesses/pruebas sin ocultar codigo de producto y ejecutar lint, TypeScript, pruebas y build en instalacion limpia.
3. Preparar escala nacional en bloques medidos: optimizar resumen Admin, paginar completamente Marketplace/conexiones y procesar el cron de tasas por lotes reanudables, sin N+1.
4. Incorporar observabilidad y pruebas de carga con datos ficticios: p50/p95/p99, errores, bytes y consultas para catalogo, checkout, pedidos, productos, Admin, mesas, webhook e impresion.
5. Tratar la conciliacion historica de pedidos externos entregados pero abiertos como operacion separada, con informe previo, respaldo, dry-run y autorizacion expresa; nunca mezclarla con un release de codigo.

Orden recomendado al retomar: payloads, CI, medicion base, optimizaciones de escala y finalmente conciliacion historica.

# 2026-10-24 - Alerta Zod detectada durante el checkpoint

- Al repetir `npm audit --omit=dev` antes del commit aparecio una alerta high nueva para `zod<4.6.6` por agotamiento de memoria con colecciones restringidas sobredimensionadas. El deployment del 23 de octubre habia pasado la auditoria disponible entonces, pero contiene Zod 4.4.3.
- Se actualizo de forma acotada el manifiesto y lockfile a Zod 4.6.7; `npm audit --omit=dev` vuelve a cero. Este parche debe compilarse/probarse en Preview y requiere un pase productivo separado; no afirmar que Produccion ya lo tiene.
- Preview aislado del lockfile final READY: `dpl_8fH6zfBXTABb8MgeJ2LVGMZPVRXY`, `https://vendeplus-clean-g0rsnm9ej-entrega2-s-projects.vercel.app`. Build remoto limpio PASS; Home, Marketplace, tienda demo, login y Open Graph 200, Stats anonimo 401. Produccion permanecio en `dpl_6mr4mxM26AaGjerUm4KBrohATXf2`.
