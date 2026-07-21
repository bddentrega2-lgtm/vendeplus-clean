# Integraciones reales con apps de delivery

Objetivo: que Somos pueda conectar varias apps externas de delivery sin mezclar esa lógica con el módulo interno de delivery configurable.

## Principios

- Cada app externa debe tener su propio adaptador server-side.
- Ninguna API key debe llegar al navegador.
- El checkout solo debe pedir cotización a una API interna de Somos.
- La creación del pedido externo debe ocurrir desde el servidor y con validación del comercio.
- El comercio confirma el envío a la app externa desde el panel de pedidos.
- El pedido debe guardar el proveedor, costo cotizado, payload enviado y respuesta recibida.
- Debe existir idempotencia por `id_externo` o equivalente para evitar duplicados.

## Contrato mínimo por proveedor

Cada proveedor nuevo debería implementar:

- `provider`: identificador interno, por ejemplo `entrega2`, `otro_provider`.
- `quoteDelivery(payload)`: cotiza desde origen a destino.
- `sendOrder(payload)`: crea/envía pedido al proveedor.
- `normalizeOrderStatus(value)`: traduce estados externos a estados internos de Somos.
- `getExternalOrderId(orderId)`: genera id externo idempotente.
- `getConfig()`: lee variables de entorno server-side.

## Flujo recomendado

1. Checkout carga ubicación del cliente.
2. Somos llama a `/api/delivery/quote`.
3. La API interna decide el proveedor según `store_delivery_settings.delivery_provider`.
4. Si el proveedor externo responde, se guarda/usa su costo.
5. Si falla y hay fallback configurado, se calcula con tarifas locales por km.
6. El pedido se crea en Somos con delivery pendiente de envío externo.
7. El comercio revisa el pedido en panel.
8. El comercio pulsa enviar delivery.
9. Somos crea el pedido en la app externa y registra la respuesta en `order_integrations`.

## Estados internos sugeridos

- `pending_external_delivery`: pendiente por enviar a proveedor.
- `sent`: enviado al proveedor.
- `accepted`: aceptado/asignado por proveedor.
- `delivering`: retirando/llevando.
- `completed`: entregado.
- `cancelled`: cancelado.
- `issue`: con novedad.
- `failed`: falló el envío o consulta.

## Pendientes para V2

- Tabla/config genérica de proveedores externos.
- Endpoint genérico para consultar estado por proveedor.
- Webhook interno por proveedor con secreto.
- Reintentos controlados para fallos temporales.
- Panel de logs legible para superadmin.
- Métricas por proveedor: pedidos enviados, fallos, costo promedio, tiempo de respuesta.
