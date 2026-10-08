# Memoria de trabajo - Entrega2 y SOMOS

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
