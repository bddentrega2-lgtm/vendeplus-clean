# Referidos: validacion previa a produccion

Fecha: 2026-10-12. Rama: `feature/referrals-v2-20261011`.
Entorno aislado: `xpqmmdmixpyqruykkbkf`. Produccion no modificada.

Preview READY/shared:
https://vendeplus-clean-kphcjq1vf-entrega2-s-projects.vercel.app/admin/aliados
Deployment: `dpl_9ZcjAER5LGG5nJgo9hRWiELcVyoD`.

## Alcance

Diez recorridos con solicitudes, cuentas y comercios ficticios: enlace, registro,
comprobante, revision, aprobacion, activacion de fee, pedidos, cobro confirmado
por SOMOS, ganancias del aliado, datos de Pago Movil y liquidacion desde admin.
Se comparan persistencia, API del aliado/empresa delivery y resumen de admin.
Los movimientos monetarios son simulados: no hubo transferencias bancarias.

Resultado: **10/10 PASS**, 550 comprobaciones, sin bloqueadores en los recorridos.
Ejecucion `4f2730fc6f`, 16:05:17-16:10:50 UTC, limpieza completa confirmada.
Se simularon 607 pedidos cobrables mas un pedido en prueba y uno manual sin fee.
La salida a produccion sigue condicionada al apartado "Antes de publicar".

| Caso | Escenario | Pago inicial USD | Comision suscripcion USD | Comision fee USD |
| --- | --- | ---: | ---: | ---: |
| 1 | Vendedor: 75% inicial, 50% fee, 3 meses, 10 pedidos | 20.00 | 15.00 | 0.50 |
| 2 | Creador: descuento 50%, comision inicial 100%, 1 mes, 12 pedidos | 10.00 | 10.00 | 0.60 |
| 3 | Delivery: descuento 75%, comision inicial 50%, fee 30%, 2 meses, 15 pedidos | 5.00 | 2.50 | 0.45 |
| 4 | Registro directo sin referido, 10 pedidos | 20.00 | 0.00 | 0.00 |
| 5 | Exoneracion inicial completa, 10 pedidos | 0.00 | 0.00 | 0.50 |
| 6 | Pedido en prueba y manual sin fee; 10 cobrables, 4 cancelados | 15.00 | 7.50 | 0.50 |
| 7 | Fee reportado, rechazado y luego confirmado, 10 pedidos | 20.00 | 15.00 | 0.50 |
| 8 | Reintentos de comprobante, aprobacion y liquidacion, 10 pedidos | 10.00 | 10.00 | 0.50 |
| 9 | Condiciones originales congeladas; 510 pedidos y 511 comisiones | 20.00 | 15.00 | 25.50 |
| 10 | Ventana vencida: 2 pedidos elegibles cobrados tarde y 8 fuera de periodo | 20.00 | 15.00 | 0.10 |

## Reglas comprobadas

- Sin pago inicial confirmado o exonerado no se activa la cuenta.
- El servidor ignora importes iniciales y precios adulterados por el navegador.
- La comision inicial se calcula sobre lo efectivamente pagado tras el descuento.
- La ventana de fee empieza al activar ese plan, no durante la prueba gratuita.
- Cambiar un codigo no altera condiciones de solicitudes existentes.
- Un comprobante de fee pendiente o rechazado no genera ganancias liquidables.
- Los cancelados con fee se cobran; los manuales y pedidos de prueba no.
- Confirmar el cobro no reinicia la ventana de comisiones.
- La fecha elegible del pedido determina la comision aunque el cobro sea posterior.
- Liquidar mueve el importe de pendiente a pagado; repetir no duplica el pago.
- Los saldos del comercio regresan a cero tras confirmar el pago total del fee.
- Registro directo sin referido no genera comisiones de terceros.

## Hallazgos y correcciones

1. El resumen sumaba todo, pero el detalle global de 500 comisiones dejaba
   11 fuera de alcance en el caso de volumen. Se agrego un endpoint exclusivo
   de admin, por aliado, con paginas de 100, conteo completo y ajustes netos.
   La seleccion se limpia al cambiar de pagina/aliado para evitar cruces.
2. El entorno aislado no tenia el bucket `product-images`, necesario al aprobar
   un comercio. Se creo solamente en staging. Produccion ya lo tenia.
3. Los primeros errores del harness fueron campos de producto y motivo de
   cancelacion incorrectos. Se ajustaron al contrato real, sin relajar APIs.

## Pruebas complementarias

- `npm.cmd run build`: PASS, Next 16.3.8, TypeScript, 138 paginas.
- Acceso: 20/20 PASS; aislamiento entre aliados y empresas, datos de Pago Movil
  privados, pagina de comisiones admin denegada a anonimos/aliados.
- SQL transaccional: PASS; incluye reintegros, reintentos, importes netos,
  privilegios y agregado sin fee aun no cobrado. Termina con rollback.
- Navegador: PASS en 390/1280; seis paginas, 511 comisiones, seleccion, limpieza
  de seleccion al navegar, sin errores JS ni desbordamiento horizontal.
  Capturas inspeccionadas: controles y textos legibles.
- Preview remoto publicado: PASS390/1280 para lista, tres demos, buscador y
  detalle; cero overflow/errores JS. Produccion sin cambios al compartir.

## Archivos de esta validacion

- `src/app/api/admin/affiliates/commissions/route.ts`: consulta paginada protegida.
- `src/components/admin/AdminAffiliatesManager.tsx`: detalle y seleccion paginados.
- `scripts/ops/affiliate-v2-journeys.mjs`: los diez recorridos y limpieza.
- `scripts/ops/affiliate-v2-access-qa.mjs`: permisos de la nueva consulta.
- `scripts/ops/affiliate-v2-admin-qa.mjs`: cierre solo de la sesion de QA.
- `scripts/ops/supabase-buyer-staging.ps1`: accion journey-test y preflight solo lectura.
- `SESSION_HANDOFF.md`, `memoria.md` y este informe; puntero de continuidad en la raiz.

No se agregaron migraciones por la correccion de paginacion. Las 16 migraciones
del desarrollo previo siguen pendientes en produccion; no hay SQL para ejecutar
sin coordinar el despliegue.

## Evidencia y repeticion

- Runner: `scripts/ops/affiliate-v2-journeys.mjs`.
- Resultados: `tmp/referrals-v2-journeys/latest.json` y copia por ID de ejecucion.
- Capturas: `tmp/referrals-v2-journeys/visual/`.
- Arrancar el servidor de staging con `-PreviewAction start -AffiliatePreview`;
  ejecutar `scripts/ops/supabase-buyer-staging.ps1 -AffiliateV2Action journey-test`.
- El runner comprueba identidad staging, crea usuarios ficticios y elimina sus
  cuentas, comercios, pedidos, comprobantes y movimientos al terminar cada caso.
- Los pedidos normales usan las APIs reales. En el caso 9, dos usan la API y
  otros 508 son fixtures DB para superar el limite de historial. El caso 10 usa
  fechas controladas de staging para simular el vencimiento, no espera un mes.
- El acceso automatizado usa sesiones temporales verificadas, no prueba Google
  OAuth interactivo. Correos `.invalid`: no se verifica entrega a un buzon real.

## Antes de publicar

1. Resolver las 3 solicitudes productivas pendientes previas al esquema de USD20.
   Se consulto si conservan condiciones anteriores; no asumir un cobro nuevo.
2. Aplicar en orden las 16 migraciones de referidos pendientes, desde
   `20261004120000_affiliate_registration.sql` hasta
   `20261012121000_affiliate_admin_list.sql`, contrastando primero el historial
   real de Supabase. No ejecutar indiscriminadamente todas las migraciones del repo.
3. Confirmar el tratamiento del registro antiguo durante la transicion: el guard
   final exige pago confirmado/exonerado para nuevas activaciones. Las solicitudes
   ya aprobadas quedan `legacy` por la migracion existente.
4. Construir un candidato con variables productivas, sin asignarle el dominio;
   no promover el artefacto de staging. Revisar login, registro, catalogo, pedidos,
   suscripcion, admin y transporte antes de mover el dominio.
5. Hacer un registro controlado con buzon real para revisar correo de acceso y
   entrada por Google. Verificar un cobro/liquidacion controlados tras publicar.
6. Conservar el deployment anterior y definir rollback compatible con los nuevos
   guards de registro: volver al codigo anterior no deshace las reglas de DB.

Preflight productivo, solo lectura: faltan tablas/RPC de referidos y campos de
pago inicial; 3 solicitudes pendientes y 5 aprobadas; `product-images` existente;
`subscription-receipts` aun ausente (lo crea la migracion V2); comprobantes de
registro pasan de 2 a 5 MB con su migracion.
Deployment productivo observado: `dpl_GRtQNdWLDv7G5McqVQWcVNs9c7P9`.

## Limites y V2

Esto valida los escenarios enumerados, no garantiza ausencia absoluta de errores.
No se verifico dinero bancario real, entrega de correo ni concurrencia masiva.
El resumen y comisiones por pagar no truncan historial; otras listas secundarias
de codigos, comercios e historial reciente conservan sus limites existentes.
Reintegros posteriores a una liquidacion pueden requerir conciliacion manual.
Mejoras futuras: historial completo paginado y seleccion por lotes mas ergonomica.
