# Mesa / Barra: carga real en Preview

## Actualizacion: produccion autorizada

Despues de este ensayo, el usuario autorizo publicar. El 2026-09-22 se repitieron las 114 pruebas y el build local, todos aprobados. Se reconstruyo el mismo codigo con entorno production para respetar las ramas VERCEL_ENV (selectores de sedes y prototipo privado), sin promover directamente el entorno Preview.

Deployment activo: `dpl_2Jzf9WvuV5gPDTeSLKCuCM4KN4oN`, confirmado por `vercel inspect www.somos-ve.com`, READY. Acceso: https://www.somos-ve.com/panel/mesas . Build Vercel aprobado, 226 paginas. Reversion disponible al deployment anterior `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`.

Se hicieron 17 comprobaciones antes de activar y 17 sobre el dominio real: paginas publicas y QR responden; APIs privadas exigen sesion; pedidos/pagos sin sesion rechazados; tokens de asistencia invalidos rechazados; rutas QA y prototipo no disponibles. El notFound transmitido por streaming puede devolver HTTP200 con marcador interno404; se valido el cuerpo, no solo el estado. Evidencia en `tmp/table-production-staged-smoke-result.json` y `tmp/table-production-live-smoke-result.json`.

Esta promocion no creo pedidos ni verifico pagos, no agrego migraciones/SQL y no incluyo commit/push. La prueba autenticada de diez pedidos sigue siendo la realizada en Preview; no se repitio carga real en produccion. Se elimino la cookie temporal utilizada para la proteccion del despliegue staged. Los pendientes V2 del informe siguen vigentes.

## Alcance

Prueba autorizada de 10 pedidos simultaneos en Smash (Test), repetida antes y despues del ajuste: 20 pedidos en total. Usuario autorizo crear y eliminar acceso temporal exclusivo al comercio. Sin promocion de produccion, commit ni push.

Preview final: https://vendeplus-clean-g1uj45l40-entrega2-s-projects.vercel.app/panel/mesas

Deployment: `dpl_EAkhdjgBRfqJsQJMCHbA3BRad4bs`.
Produccion inspeccionada sigue en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`.

## Diagnostico y cambios

- `src/app/api/orders/route.ts`: los pedidos de mesa consultaban configuraciones de delivery, zonas, tarifas y transporte que no necesitan. Mesa usa ahora configuracion base del comercio; conserva validaciones de QR, mesa, producto, pago, precios, permisos e idempotencia. Delivery, retiro y envio conservan sus consultas.
- `src/components/panel/TableOrderNotifier.tsx`: una notificacion recibida durante un refresco podia descartarse y dejar el ultimo cambio esperando al sondeo de respaldo. Se conserva un unico refresco pendiente, se agrupan eventos y se descartan resultados tras desmontar. La corrida inicial no perdio pedidos; este riesgo se comprobo mediante lectura y prueba determinista.
- `scripts/table-operations.behavior.test.cjs`: regresiones para rafaga de eventos/desmontaje y omision de consultas de delivery exclusivamente en mesa.
- Documentacion: este informe y `SESSION_HANDOFF.md`. Arnes y evidencias generadas en `tmp`, excluidos del despliegue.

## Metodo

- Chromium/Playwright contra Vercel Preview y Supabase reales; login normal con usuario temporal de rol operator asignado solo a Smash Test. Acceso a otro comercio devuelve 403.
- Diez POST concurrentes desde una misma conexion, repartidos entre las tres mesas habilitadas (4/3/3). No equivale a diez dispositivos o veinte mesas fisicas.
- Un Perrito Gourmet por pedido, sin inventario asociado, pago Efectivo pendiente. Sin envio de WhatsApp ni verificacion de pagos.
- Observador del DOM mide aparicion de cada pedido. Se prueban diez cambios concurrentes por etapa, persistencia y repeticion idempotente sin duplicados.
- En la segunda corrida se accionan tambien los diez botones reales de Iniciar preparacion y luego Marcar listo, y se espera confirmacion visual de todos.
- Escritorio 1440x1000 y movil 390x844 revisados; sin desborde horizontal. Browser integrado no inicio; se uso Playwright local contra el Preview real.

## Resultados

| Medicion | Antes | Despues |
| --- | --- | --- |
| Pedidos creados / errores | 10 / 0 | 10 / 0 |
| Todos visibles en panel desde inicio de tanda | 4.824 s | 2.951 s |
| Crear pedido bajo concurrencia, minimo-maximo | 2.597-4.179 s | 2.545-3.338 s |
| GET resumen, tres muestras | 412/400/457 ms | 464/409/376 ms |
| PATCH preparar, minimo-maximo | 691-989 ms | 530-775 ms |
| Diez botones de preparar, todos confirmados | No medido | 1.492 s |
| Diez botones de listo, todos confirmados | No medido | 822 ms |

Las respuestas HTTP y confirmaciones visuales son mediciones distintas. La aparicion puede preceder al retorno del POST por la notificacion de base de datos. Dos tandas pequenas no establecen p95 ni SLA; red y calentamiento varian. No atribuir toda mejora de tiempo al codigo: el endpoint de cambio de estado no se modifico en esta tarea.

Evidencias: `tmp/table-live-load-CARGA-MUD9WLEM.json` y `tmp/table-live-load-CARGA-MUDA6CLT.json`, con capturas `tmp/table-live-<run>-desktop.png` y `-mobile.png`.

## Validacion y limpieza

- 79 contratos criticos y 35 pruebas de comportamiento aprobados.
- Build local (`npm.cmd run build`, cargando entorno del workspace padre) y build Vercel aprobados, TypeScript y 226 paginas. Diff check aprobado.
- Smoke final sin sesion de aplicacion: login 200; GET tables, tables live y orders, y PATCH orders devuelven 401.
- Ambos lotes persistieron diez pedidos unicos y el reintento idempotente devolvio el mismo pedido. Preparar no cambio el pago pendiente.
- Veinte pedidos cancelados con motivo `Otro: Prueba de carga finalizada`. Ningun pago marcado ni asignacion de inventario. Se preserva historial y clientes sinteticos del comercio de prueba.
- Usuarios temporales y asignaciones eliminados, incluida una tentativa inicial de configuracion sin pedidos. Auditoria posterior confirma Auth user_not_found y cero asignaciones para los tres usuarios.
- La base es compartida con produccion: hubo escrituras reales de prueba. Permanecen registros de fee por US$2.00 (20 x US$0.10), porque cancelar no elimina el fee. Comercio is_test=true, excluido por la logica central de cobro a comercios de prueba; no se ejecuto cobro alguno.
- No hay migracion ni SQL nuevos o pendientes por esta optimizacion. Las migraciones de Mesa de tareas anteriores permanecen aplicadas.

## Como probar

Abrir el Preview con la sesion habitual, entrar a Smash Test > Mesa / Barra y usar un pedido controlado con pago pendiente. Iniciar preparacion debe confirmar sin exigir verificar pago; el ojo permite revisar evidencia de forma independiente. Comprobar otro dispositivo para observar actualizacion remota. No repetir el arnes inadvertidamente: crea pedidos reales y conserva historial.

## Pendientes / V2

- Revisar politica de limite para QR de restaurante validado: actualmente 24 intentos por comercio+IP cada 10 minutos y 60 por IP global. Una red Wi-Fi compartida puede alcanzarlo. No se debilito la proteccion antiabuso.
- Medir carga sostenida, dispositivos distintos y conexiones moviles lentas antes de prometer capacidad de veinte mesas en operacion continua.
- Perfil adicional de actualizacion sincrona del cliente al crear pedido, sin sacrificar consistencia.
- Discrepancia previa separada: algunos flujos mencionan rol staff, mientras store_users permite owner/admin/operator. La prueba uso operator; no se cambio administracion de usuarios en esta tarea.
