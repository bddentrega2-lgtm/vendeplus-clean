# Mesa / Barra: rendimiento medido

## Alcance

Reporte del 22-09-2026. El usuario reporto lentitud en el ultimo Preview y autorizo usar Smash (Test).
No es una prueba de carga contra produccion ni una promesa de latencia maxima.

## Causas y cambios

- El manager y el notificador pedian el resumen completo al entrar: ahora comparten la misma solicitud.
- Cada cambio bloqueaba todas las mesas y esperaba un GET completo adicional: ahora solo se bloquea el pedido en proceso y se aplica la respuesta confirmada del servidor, sin ese GET obligatorio.
- Cache de navegacion en memoria, separada por token de sesion y comercio, maximo 8 entradas, reutilizable durante 30 segundos. Siempre revalida en segundo plano.
- Versionado local descarta respuestas anteriores a una mutacion confirmada y respuestas de lecturas fuera de orden. No se muestran estados guardados antes de confirmacion.
- El refresco operativo no pide otra vez el QR; la libreria y la imagen del QR se cargan al abrir configuracion.
- Lecturas de configuracion y operacion en paralelo, despues de validar acceso al comercio.
- PATCH combina la lectura del pedido y la comprobacion de delivery en una sola consulta. Conserva la validacion de pago, expectedStatus, cancelacion e inventario.
- GET Tables y PATCH Orders devuelven Server-Timing (autenticacion y total), sin datos personales.

## Navegador con 20 mesas

Playwright, APIs simuladas con 600 ms por respuesta, render real en localhost, vistas 1440x1000 y 390x1000. Dos muestras base y varias optimizadas. No son tiempos de Vercel ni de la conexion del usuario.

| Medida | Antes | Despues |
| --- | --- | --- |
| Resumenes completos al entrar | 2 | 1 |
| GET adicional obligatorio por cambio exitoso | 1 | 0 |
| Otras mesas bloqueadas al guardar | Si | No |
| Reabrir el componente de mesas en escritorio | 958-972 ms | 193-318 ms |
| Accion completa, incluyendo desplazamiento automatizado hasta el boton | 2418-2465 ms | 2140-2173 ms |

Con el boton ya situado para medir respuesta interactiva: feedback Guardando en 156-170 ms; confirmacion en 894-953 ms en escritorio. En movil se observaron 894-1458 ms. Son pocas muestras, no percentiles de produccion.
No comparar la accion completa que incluye desplazamiento con la medicion del boton ya situado.

Pruebas adicionales: dos pedidos simultaneos, doble toque (una sola escritura), rechazo del servidor conserva estado, error de red/reintento, respuesta vieja no revierte una confirmacion, aislamiento de cache por usuario/comercio y comprobantes sin regresion.

## Base real y cambio autorizado

Lecturas reales a Supabase desde esta maquina: la primera serie dio 150-312 ms por consulta. Otra serie mostro variabilidad y un pico de 1139 ms. No son tiempos SQL puros: incluyen red y PostgREST; tampoco son la carga completa de la pantalla.

Lectura de pedido y guardia delivery, tres pares antes: 322/633/553 ms sumados. Consulta unificada: 164/164/415 ms. Muestra pequena con variabilidad de red, no afirmar porcentajes estables.

Pedido autorizado de prueba VP-0922-MG7, Smash (Test):
- accepted -> received: 768 ms.
- received -> accepted: 363 ms.
- Estado final restaurado a accepted; payment_status permanecio review. No se crearon pedidos ni se marcaron pagos o cancelaciones.

Estos dos cambios ejecutaron la logica PATCH actual y las escrituras reales en Supabase desde un arnes local. La autenticacion fue sustituida por un alcance fijo al comercio autorizado: EXCLUYEN autenticacion real, HTTP/Vercel y navegador. No deben presentarse como medicion end-to-end de la sesion del cajero.

## Pendiente

Preview optimizado: https://vendeplus-clean-hjv185eo3-entrega2-s-projects.vercel.app/panel/mesas
Validacion: 79 contratos + 30 pruebas behavior, QA de navegador, build local/Vercel y smoke de acceso aprobados. Archivos y continuidad en SESSION_HANDOFF.md.

- Comparar el nuevo Preview desde la conexion/dispositivo del usuario, leyendo Network y Server-Timing con su sesion legitima. Medir al menos 20 operaciones antes de hablar de p95 o fijar un objetivo de SLA.
- Probar dos dispositivos con el pedido de prueba antes de promover a produccion.
- El acceso directo con ojito sigue pendiente: se priorizo esta optimizacion por peticion del usuario.
- Sin migracion ni SQL nuevos en este ajuste. No se ha publicado en produccion ni realizado commit/push.
