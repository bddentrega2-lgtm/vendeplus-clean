# Mesa / Barra: pago independiente y revision rapida

## Diagnostico

El usuario reporto que Iniciar preparacion no respondia y confirmo que el pago no estaba marcado como pagado. La UI deshabilitaba el boton y solo explicaba el requisito en un title. Ademas, el RPC rechazaba preparar/entregar sin pago verificado. El usuario aclaro que el control de pago debe ser independiente de la operacion.

Los PATCH observados del Preview anterior respondieron 200, pero no se pudo correlacionar una peticion con ese intento particular. No atribuirlo a lentitud SQL ni afirmar una medicion end-to-end del navegador del usuario.

## Cambios

- Preparacion, listo y entrega independientes del estado de pago; ninguna de estas acciones marca el pedido como pagado.
- Ojito por pedido, tanto en mesa como en barra, abre referencia/comprobante sin cargar toda la comanda. Tambien permite marcar como pagado explicitamente, incluido efectivo/punto sin comprobante.
- El resumen incorpora referencia y existencia de comprobante mediante un embed indexado, sin N+1, sin URL firmada ni ruta privada. La imagen se solicita solo al abrir el visor.
- PATCH de pago conserva campos omitidos (referencia, banco, moneda, monto y notas); un cambio solo de estado ya no los borra. Mantiene autorizacion y filtro por comercio.
- Solicitudes de resumen, detalle y cambios rapidos limitadas a 15 segundos. Una escritura sin confirmacion no se repite automaticamente ni se presenta como fallida de forma definitiva: se avisa y se revalida el estado. El limite no cancela una escritura ya recibida por servidor.
- Bloqueo por pedido compartido entre cambios rapidos de estado y pago; otros pedidos continuan operables.

## Archivos

- `src/components/panel/TablesManager.tsx`
- `src/components/panel/orders/PaymentReviewDialog.tsx`
- `src/components/panel/OrdersManager.tsx` (texto del control de pago)
- `src/lib/panel/table-snapshot-client.ts`
- `src/app/api/panel/tables/route.ts`
- `src/app/api/panel/orders/route.ts`
- `src/app/api/panel/orders/[orderId]/payment/route.ts`
- Pruebas behavior, contratos y `scripts/table-payment-independent.rollback.sql`.

## Migracion

Aplicada `20260922233000_table_status_independent_payment.sql`. Crea `update_table_order_status_v2`, solo service_role, con bloqueo de fila, comercio, estado esperado, cierre y cancelacion auditada/inventario intactos. El RPC anterior no se modifica, para preservar el comportamiento de deployments anteriores en la base compartida. Solo el nuevo Preview llama v2. Dry-run posterior al dia; sin SQL pendiente.

## Validacion

- 79 contratos y 33 pruebas behavior pasan.
- `npm.cmd run build` final local y Vercel OK, 226 paginas; TypeScript y diff check OK. Preview READY `dpl_DgJPBa7zcPBgpa9gX9vUN6cSNnHt`: https://vendeplus-clean-2wzue004g-entrega2-s-projects.vercel.app/panel/mesas . Produccion web sigue en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`.
- Smoke Preview PASS: login/QR200, GET privados y PATCH pedidos/pago401 sin sesion, rutas QA ausentes, asistencia con QR invalido404/UUID invalido400. No creo pedidos ni marco pagos.
- SQL real en una transaccion con rollback sobre fixture de Smash (Test): pending/review/verified/rejected avanzan a preparing/ready/completed sin cambiar pago; tenant incorrecto, estado obsoleto y cancelacion sin motivo rechazados; RPC anterior y permisos intactos. Ningun pedido ni pago queda alterado por esta prueba.
- Consulta real de referencia/comprobante valida el embed y conserva pedidos sin imagen.
- Playwright local, APIs simuladas, 20 pedidos, 1440x900 y 390x900: preparacion sin verificar, mesa/barra, ojito, imagen, referencia, sin evidencia, error/reintento de pago, lectura sin marcar pago, timeout y reintento explicito, sin errores JS ni overflow. Browser integrado no pudo iniciar; estas no son pruebas en la sesion real del usuario.
- Regresion de rendimiento con 600ms simulados: una sola carga inicial, otros pedidos disponibles durante escritura, doble toque protegido, confirmacion 982ms con boton situado; no es latencia de Vercel ni SLA.

## Como Probar

En el nuevo Preview, Smash Test: aprobar un pedido con pago pendiente y pulsar Iniciar preparacion; debe avanzar manteniendo pago pendiente. Abrir el ojito para ver evidencia; verlo no debe verificar pago. Pulsar Marcar como pagado y comprobar que solo cambia el control de pago. Repetir con barra y comprobar que otro pedido sigue operable.

## Pendientes / V2

Revision autenticada del usuario antes de promover a produccion. Sin commit/push. Cuentas abiertas, dividir cuenta y nuevos estados quedan fuera de alcance. El flujo de primer acceso y reenvio de correo discutido en la conversacion no fue modificado.
