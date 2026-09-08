# Puente Entrega2 Somos -> Entrega2 App

## Responsabilidades

- Entrega2 Somos es la fuente operativa: afiliaciones, modalidad de cobro, solicitudes, pedidos, particulares y trazabilidad.
- Entrega2 App es el proveedor externo de cotizacion y despacho para la empresa con slug `entrega2`.
- Un comercio nunca se conecta directamente a Entrega2 App desde el superadmin.
- Las demas empresas delivery operan solo en Somos y nunca llaman al adaptador de Entrega2 App.

## Fuente de verdad

- `store_transport_agency_connections`: afiliacion comercio-empresa y `delivery_billing_mode` (`credit` o `cash`).
- `store_delivery_settings`: seleccion operativa `transport_agency` y referencias a empresa/conexion.
- `transport_orders`: registro de todo servicio operado por una empresa delivery.
- `transport_particular_requests`: origen de las solicitudes particulares.
- `order_integrations`: intento, identificador y estado de Entrega2 App.

El modo de cobro decide el despacho; no crea un proveedor o una conexion paralela.

## Cotizacion

1. Somos calcula la distancia de ruta y resuelve la empresa afiliada.
2. Solo cuando la empresa es Entrega2, el servidor consulta Entrega2 App.
3. Entrega2 App tiene un limite de 4,5 segundos, menor al maximo funcional de 5 segundos.
4. Ante timeout, error HTTP, circuito abierto o respuesta invalida, se usan los rangos configurados por Entrega2 en Somos.
5. La respuesta conserva `transport_agency` como proveedor operativo y marca claramente el respaldo de Somos.
6. Otras empresas usan exclusivamente su configuracion de tarifas en Somos.

## Pedidos de comercio

### Credito

1. El pedido se crea en `orders` con la empresa Entrega2.
2. Al solicitar delivery se crea o actualiza primero `transport_orders`.
3. Somos envia inmediatamente a Entrega2 App.
4. `order_integrations` enlaza el pedido y el servicio operativo con la respuesta externa.

### Contado

1. El pedido se crea en `orders` y `transport_orders`.
2. Queda pendiente de validacion en Entrega2 Somos.
3. El comercio abre el mensaje preparado para el WhatsApp de Entrega2.
4. La operadora valida el pago y pulsa `Enviar a Entrega2 App`.
5. El envio queda registrado en `order_integrations` y en el historial del servicio.

## Particulares

1. El enlace publico cotiza con Entrega2 App y usa respaldo Somos si aplica.
2. La solicitud se registra en `transport_particular_requests`.
3. Un trigger crea el `transport_order` correspondiente.
4. El solicitante abre el mensaje preparado para WhatsApp.
5. La operadora valida y envia a Entrega2 App desde Somos.

## Marketplace

El Marketplace de Entrega2 consulta conexiones activas y vigentes. La modalidad credito/contado y la visibilidad del Marketplace general no filtran comercios. Solo se excluyen comercios inactivos o con suscripcion vencida.

## Transicion legacy

Mientras existan filas con `store_delivery_settings.delivery_provider = 'entrega2'`, las rutas antiguas se conservan solo como compatibilidad. La migracion de alineacion crea la conexion con Entrega2 Somos, asigna credito/contado y cambia el proveedor a `transport_agency`. Despues de validar la migracion en staging, se podra retirar la compatibilidad legacy.

## Regla de despliegue

1. Probar codigo y migraciones en staging.
2. Validar credito, contado, particular, timeout y una empresa distinta de Entrega2.
3. Ejecutar migracion productiva solo con autorizacion explicita.
4. Promover el Preview validado despues de la migracion y smoke tests.
