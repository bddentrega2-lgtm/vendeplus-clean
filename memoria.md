# Memoria de trabajo - Entrega2 y SOMOS

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
