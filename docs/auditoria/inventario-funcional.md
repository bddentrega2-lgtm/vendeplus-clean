# Inventario funcional inicial

Estado: `codigo + prueba` = evidencia ejecutada focal; `codigo` = implementado
sin prueba integral reciente; `parcial` = requiere confirmar configuracion o
operacion. Rutas resumidas, no catalogo exhaustivo de los 110 archivos API.

Inventario mecanico de entradas HTTP propias (`rg` sobre exports en
`src/app/api`): 110 archivos `route.ts` y 160 exports de metodo: GET 64,
POST 51, PATCH 31, DELETE 12, PUT 2. Por primer segmento: `panel` 38
archivos, `transport` 22, `admin` 21; los restantes incluyen catalogo,
pedido, comprador, registro, webhooks, impresion y cron. Esto identifica
entradas, **no** demuestra que cada handler haya sido revisado. Los puntos de
entrada no HTTP incluyen RPC/triggers SQL, FCM, Realtime, Android nativo y
cron; ver [arquitectura](arquitectura-actual.md).

| Modulo / actores | Pantallas y entradas | Funciones, datos y consumidores | Estado / pruebas |
| --- | --- | --- | --- |
| Marketplace / comprador | `/marketplace`, `/api/marketplace/directory`, `src/lib/marketplace.ts` | Elegibilidad y descubrimiento; `stores`, `products`, `marketplace_discovery_v2`; consumidor catalogo | Codigo; contratos criticos, UX/ranking parcial |
| Catalogo y productos / comprador-comercio | `/{storeSlug}`, `/panel/productos`, `/api/panel/products`, `/api/catalog/product-options` | `getStoreBySlug`, opciones, variantes, precios, stock; consumidores carrito, marketplace, pedido | Codigo + cart-review/stock focal |
| Carrito/checkout / comprador | `/{storeSlug}/carrito`, `/checkout`, `CartPageClient`, `CheckoutForm` | Estado local, `reviewStoredCart`, cotizacion, comprobante; pedido/WhatsApp | Codigo + seis rutas HTTP y API focal; navegador E2E no completo |
| Pedido publico / comprador-comercio | `/api/orders`, `/confirmacion`, `/api/buyer/orders` | Recalculo servidor, `create_order_atomic`, `orders`, items, fee; panel/recompra/notificaciones | Codigo + un Retiro QA en Smash; otras modalidades simuladas |
| Pedido manual / comercio | `/panel/pedidos/nuevo`, `/panel/pos`, POST `/api/panel/orders` | Catalogo, totales y costo delivery internos; fee cero, no despacho automatico | Codigo; prueba E2E pendiente |
| Pedidos/cocina/mesa / comercio-cliente | `/panel/pedidos`, `/cocina`, `/mesas`, `/[storeSlug]/mesa/[storeToken]` | `transition_order_status_v3`, `operate_kitchen_order`, `store_tables`, tickets; seguimiento | Codigo + contratos focales; E2E multiestado pendiente |
| Pagos, comprobantes y fee / comercio-admin | `/panel/suscripcion`, `/admin/suscripciones`, `/api/panel/orders/[orderId]/payment` | `order_payment_receipts`, `store_subscription_payments`, `update_order_payment_v2`, `loadServiceFeeBalances` | Codigo; conciliacion historica parcial |
| Delivery y transporte / cliente-comercio-agencia | `/panel/delivery`, `/transporte/panel/*`, `/api/delivery/quote` | Zonas/distancias, proveedores, `transport_orders`, despacho y estados; Entrega2 | Codigo + cotizacion manual Shibui; despacho E2E pendiente |
| Registro/admin/acceso / solicitante-fundador | `/registro`, `/admin/solicitudes`, `/admin/comercios`, `/panel/login` | `commerce_registration_requests`, Auth, `stores`, `store_users`; correo o clave definida por admin | Codigo; atomicidad/rollback parcial |
| Afiliados / aliado-admin-agencia | `/aliados`, `/admin/aliados`, `/transporte/panel/referidos` | Codigos, terminos snapshot, pagos/comisiones y RPC/triggers | Codigo; finanzas y RLS pendientes de contraste |
| Clientes/recompra y comprador | `/panel/clientes`, `/mi-cuenta`, `/api/buyer/*` | Telefono normalizado, `customers`, pedidos/reseñas; consumidores estadisticas | Codigo; reconciliacion parcial |
| Notificaciones/impresion / comercio Android | `/panel/impresion`, `/api/printing-agent/*`, FCM | Cola `order_print_jobs`, dispositivos, Bluetooth; avisos de pedidos/asistencia | Codigo; dispositivo/cola offline no probados aqui |
| Configuracion, estadisticas, admin / comercio-fundador | `/panel/configuracion`, `/estadisticas`, `/admin` | Medio de pago, horario, moneda, resumen, RPC agregadas | Codigo; comparacion contable/performance pendiente |

Contratos compartidos a vigilar: `SavedOrder`/`CartItem` en `src/types`,
`DeliveryQuote`, estados `orders.status`, `delivery_status`,
`transport_orders.status`, `order_integrations.status`, `payment_status`,
identificador `store_id`, `public_code` e `id_externo`. Origen comercial,
modo de registro y proveedor de transporte son dimensiones distintas; no
inferir una de otra solo por el nombre de la ruta.

Entradas menos visibles: cron en `vercel.json`, triggers/RPC en `supabase/migrations`,
webhook Entrega2, Realtime, FCM y llamadas nativas. La ausencia de un import
directo no demuestra codigo muerto. Para cobertura real ver
[cobertura-y-validacion](cobertura-y-validacion.md).
