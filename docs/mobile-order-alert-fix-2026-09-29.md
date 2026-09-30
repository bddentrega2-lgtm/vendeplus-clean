# Correccion del aviso automatico de pedidos

Actualizacion posterior: publicado en Preview unificado1.3.1,
`dpl_HqFHskZuAWKUjfAZvUFX8BwdUoCL`. APK preparada pero instalacion pendiente.
Ver `docs/mobile-unified-preview-2026-09-29.md`; la seccion de entrega pendiente
mas abajo conserva el estado historico al terminar la correccion local.

## Diagnostico

Usuario confirma que Probar produce sonido, pero la llegada de un pedido no.
La campana consultaba `/api/panel/orders?status=pending`; el alta publica guarda
`orders.status = received` y el listado filtra el estado literalmente. Por tanto
los pedidos nuevos nunca entraban en la lista de deteccion. No era necesario
cambiar el canal Android ni el servicio de impresion para corregir este defecto.

La prueba E2E anterior usaba fixtures con status pending y devolvia la lista
completa sin aplicar el filtro solicitado. Eso oculto la incompatibilidad real.

## Archivos y cambios

- `src/components/panel/PanelNotifications.tsx`: filtro de estado received.
- `scripts/mobile-buyer-alerts.test.mjs`: contrato entre estado de alta,
  filtro literal del listado y consulta de la campana.
- `scripts/mobile-polish.e2e.mjs`: fixtures received y filtros status/storeId
  fieles al listado; comprueba temporizador real de 15 segundos, no un foco
  artificial para la primera llegada. Incluye pedido accepted con pago pending
  para comprobar que no se confunden estado de pedido y estado de pago.
- Este documento y `SESSION_HANDOFF.md`: diagnostico, validacion y continuidad.

No se cambio API, autenticacion, Java, canal Android, cola/servicio de impresion,
precio, pagos, base de datos ni variables. Sin migracion ni SQL.

## Validacion

- Regresion nueva: FAIL con el filtro anterior y PASS despues de corregirlo.
- 80/80 contratos criticos y 18/18 unitarios moviles PASS.
- `npm.cmd run build`, ejecutado por `node scripts/mobile-local.mjs build` con
  entorno privado en memoria: PASS TypeScript y 240 paginas.
- ESLint de los tres archivos de codigo/pruebas: PASS.
- E2E visual/funcional: 29 casos/capturas mas comprobaciones web, sin errores
  React. La llegada se detecto por polling con panel visible; una notificacion
  automatica, sin repetir tras foco y sin incluir el pedido accepted.
- E2E Etapa 1: PASS navegacion, sesion, cambio cuenta, recuperacion y web.
- `git diff --check`: PASS.

Pruebas privadas simuladas con escrituras bloqueadas, sin pedidos reales ni
impresiones. Esto no constituye confirmacion fisica en el telefono.

## Entrega pendiente

Corregido SOLO local, en http://127.0.0.1:3107. Servidor compilado reiniciado
despues del build, launcher PID17908; logs tmp/mobile-polish/alerts-fix-start*.log.
La APK instalada 1.3.0 apunta al Preview inmutable anterior y NO tiene el arreglo.

Se pregunto al usuario si el pedido llego con el panel visible y si autoriza un
nuevo Preview + APK de prueba, sin produccion. Aun no hay respuesta registrada.
ADB no detecta dispositivos al revisar; instalacion requiere nueva conexion.
No se genero APK, desplego Preview ni promovio produccion; sin commit/push.

Tras autorizacion: desplegar nuevo Preview desde este worktree, validar acceso
publico limitado al deployment y rechazo anonimo en rutas privadas. Preparar APK
versionCode10 con origen Preview exacto y luego restaurar config generado oficial.
Conectar A34 por USB o depuracion inalambrica vigente, instalar con -r sin borrar
datos/vinculacion. No cambiar proteccion global ni incluir tokens en APK.

Prueba fisica: abrir panel Smash (Test), activar Sonido y notificacion, esperar
linea base; desde otro equipo crear pedido Retiro de prueba en el MISMO Preview.
Mantener panel visible y esperar unos 15 segundos mas red. Comprobar aviso,
sonido y una sola comanda. Registrar codigo/hora/foto. No marcar aprobado hasta
confirmacion del usuario. Si el telefono estaba bloqueado, ese escenario sigue
fuera del alcance actual y requiere Firebase/entrega en segundo plano.

## Riesgos y V2

Solo panel visible. Pedidos anteriores a abrir el panel son linea base silenciosa;
limite de diez recibidos por consulta y dependencia de red. Mover un pedido fuera
de received antes del sondeo puede impedir el aviso. Firebase/segundo plano,
mapa con logos, historial autenticado y calificaciones no incluidos.
