# Flujos criticos y invariantes

La matriz de consumidores esta en [matriz-impacto.csv](matriz-impacto.csv).
Estos recorridos son trazas de codigo, no certificaciones E2E completas.

## F-01 Alta, aprobacion y acceso

`/registro` -> POST `/api/signup` ->
`commerce_registration_requests` (solicitud, logo privado) -> fundador en
`/admin/solicitudes` -> PATCH `/api/admin/registration-requests` -> Auth,
`stores`, `store_users`, perfil y posible referido -> correo o clave definida
por admin -> `/panel/login` -> `requirePanelAuth` y `assertStoreAccess`.

Fuente de verdad: Auth para identidad, `store_users` para membresia y `stores`
para sede. La solicitud cambia a `activating` antes de crear recursos; hay
limpieza compensatoria con `Promise.allSettled`, no transaccion distribuida.
Invariantes: una solicitud aprobada tiene comercio y usuario asignado; un
correo existente no pierde su clave; un usuario sin membresia no modifica la
sede. Pendiente: simular fallos despues de cada escritura y reintentos sin
duplicacion; comparar politicas reales de Auth/Storage/RLS.

## F-02 Catalogo, carrito y pedido

`/{storeSlug}` -> `ProductCard`/opciones -> carrito local ->
`/{storeSlug}/checkout` -> POST `/api/catalog/cart-review` -> cotizacion
`/api/delivery/quote` si aplica -> POST `/api/orders` ->
`reviewStoredCart` -> recalculo de tarifa y fee -> `createOrderAtomic` ->
`orders`, items, opciones, stock -> confirmacion/WhatsApp/panel.

Fuente de verdad: productos y opciones en DB; stock y pedido en RPC atomica;
tarifa validada en servidor. El navegador conserva una copia para UX pero no
autoriza precio ni stock. `idempotencyKey` y RPC evitan doble creacion; faltan
pruebas de concurrencia en produccion aislada. Si precio/opciones cambian, la
API devuelve `CART_CHANGED` 409 antes de persistir. El inventario se
descuenta en transaccion y el pedido cancelado debe devolverlo una sola vez.
Verificacion: suite `cart-review` y `basic-inventory`, mas Retiro QA; Mesa,
Barra y Delivery requieren E2E adicional. A-02 documenta payload incompleto.
Si se usa captura, la asociacion ocurre **despues** de la RPC de pedido;
un fallo entre ambas operaciones puede dejar pedido creado y API 500 (A-05).

## F-03 Pago, cocina y seguimiento

Comprobante o referencia -> revision humana de pago en panel ->
`update_order_payment_v2` -> posible despacho a cocina ->
`order_kitchen_tickets`/`operate_kitchen_order` -> estados de `orders` ->
Pedidores, Mesa/Barra y cliente. Las tarjetas de cocina solo consultan
comandas abiertas (`queued`, `preparing`, `ready`) ligadas a estados de orden
activos; hay filtros por `delivery_status` en la API.

Fuente de verdad: `orders.payment_status` no es dinero acreditado por si
mismo; `orders.status` y `order_kitchen_tickets.state` son contratos distintos.
La migracion `20261018120000_order_status_consistency.sql` usa bloqueo de fila
y estado esperado para transiciones del panel. Debe revisarse que pago y cocina
no dupliquen la entrada ni permitan retroceder una orden cerrada. El modo sin
cocina mantiene cambio de estados desde Pedidos. Pendiente: E2E con dos
operadores concurrentes y cliente siguiendo el pedido.

## F-04 Delivery externo y Entrega2

Pedido con origen comercial conservado -> proveedor seleccionado ->
`transport_orders`/`order_integrations` -> API Entrega2 -> webhook con secreto
-> `order_integrations.status` -> `orders.delivery_status`/cierre de orden ->
`transport_orders.status` -> paneles/seguimiento. El origen comercial
(SOMOS/otro), la forma de captura (web/manual) y el proveedor de reparto
(Entrega2/otra empresa/propio) no son la misma dimension.

El webhook valida autenticidad, tamano e `id_externo`. Escribe la integracion
antes de sincronizar la orden y el servicio, pero
`src/lib/entrega2-contract.ts:115` permite reintentar el mismo estado; la
RPC `close_entrega2_order_v2` tambien devuelve la orden ya terminal. Por eso
no hay evidencia de que un 500 intermedio deje el evento irrecuperable. Una
orden terminal externa debe cerrar el pedido solo si Entrega2 sigue siendo
proveedor actual. La suite cubre eventos duplicados/desordenados; falta
inyeccion de fallo entre escrituras para verificar recuperacion completa.
El envio inicial desde panel lee el estado, crea/reserva servicio y llama a la
empresa en pasos separados. La reserva evita dos llamadas simultaneas para el
mismo `order_integrations`, pero no prueba que un cierre concurrente del pedido
antes de la llamada sea imposible (A-12).

## F-06 Admin, aliados y estadisticas

Token/cookie Supabase -> `getPanelAuthContext` -> guardia admin por correo
fundador -> RPC/consultas con service role. La migracion agrega RPC de sesion
con AAL, pero el codigo actual emite/lee sesion v1 sin comprobar AAL2 (A-01).
En aliados, el libro de comisiones es la fuente real. La rama que muestra
datos demo requiere la URL del proyecto staging y no afecta produccion segun
la configuracion documentada (A-06 descartado para produccion).
Resumen admin agrega todas las filas del periodo en Node (A-07), mientras las
estadisticas del comercio usan RPC SQL versionada y un fallback limitado
(A-09). Invariantes: solo fundador administra, un saldo mostrado se reconcilia
con pagos reales y una estadistica parcial nunca se presenta como exacta.

## F-05 Cambios de oferta durante un pedido

Edicion de producto/precio/variante/opcion/stock u horario en panel ->
catalogo y marketplace leen estado actualizado -> carrito antiguo conserva
snapshot -> `cart-review` y POST `/api/orders` vuelven a validar -> DB decide
stock final. La regla debe ser igual para Shibui con inventario y comercios
sin inventario. Una variante inactiva no debe obligar a elegirla; una variante
activa no puede omitirse. Pruebas focales cubren ambos casos; la propagacion
visual por dispositivo y cache no se midio aqui.
