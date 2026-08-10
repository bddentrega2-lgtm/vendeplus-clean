# Plan: modulo opcional de cadenas

Estado: aprobado conceptualmente; pendiente de autorizacion para implementar.

## Decision de arquitectura

Construir el caso de cadenas dentro de Somos, en la misma aplicacion y base de datos, como un modulo opcional. No crear un servidor separado en esta etapa.

Los comercios independientes deben continuar funcionando exactamente como hoy. El modulo solo aparece para organizaciones autorizadas.

## Caso objetivo inicial

- Cadena con 12 sedes ubicadas en zonas diferentes.
- Cada sede opera pedidos, inventario, delivery, horarios y usuarios de forma independiente.
- Aproximadamente 15 productos comunes a todas las sedes.
- Productos y SKU adicionales variables por sede.
- Un solo WhatsApp central recibe todos los pedidos.
- La central valida inventario con cada sede y coordina los despachos.
- La central necesita ver pedidos y estadisticas por sede o consolidados.
- La central necesita crear, editar, publicar o retirar productos en varias sedes.

## Principios obligatorios

1. Cada sede sigue siendo un registro independiente en `stores`.
2. Todo pedido conserva obligatoriamente un `store_id`.
3. Pedidos, stock, delivery, direccion, horarios y operacion permanecen aislados por sede.
4. La organizacion agrupa sedes, pero no reemplaza `stores` ni elimina el aislamiento multi-tenant.
5. Comercios sin organizacion no ven selectores ni funciones de cadenas.
6. Los permisos se guardan en tablas con RLS; no se autorizan mediante metadata editable del usuario.
7. La funcionalidad se habilita de manera privada para el cliente piloto antes de ofrecerla como plan publico.

## Modelo conceptual

### Organizaciones y accesos

- `organizations`: identidad de la cadena y configuracion central.
- `organization_stores`: sedes asociadas a la organizacion.
- `organization_users`: usuarios centrales y sus roles.
- `store_users`: se conserva para los usuarios que operan sedes especificas.

Roles iniciales sugeridos:

- `organization_owner`: control completo de la cadena.
- `central_operator`: pedidos y operacion consolidada.
- `catalog_manager`: catalogo maestro y publicacion en sedes.
- `analyst`: estadisticas consolidadas en solo lectura.
- Roles actuales de `store_users`: acceso limitado a una sede.

### Catalogo maestro y productos por sede

- `organization_products`: producto maestro compartido por la cadena.
- `store_products`: vinculacion y configuracion operativa del producto en cada sede.

El producto maestro contiene nombre, descripcion, imagenes, categoria y SKU maestro opcional. La configuracion por sede contiene SKU local, precio, stock, disponibilidad, visibilidad y cualquier ajuste local.

Un producto exclusivo se vincula solo con una sede. Un producto comun se publica en las sedes seleccionadas sin duplicar manualmente su contenido base.

No reemplazar inmediatamente la tabla actual `products`. Durante el diseno tecnico se debe escoger una migracion compatible que preserve catalogos y APIs existentes.

## Pedidos y WhatsApp

Agregar una configuracion de enrutamiento:

- `store_whatsapp`: comportamiento actual por sede.
- `centralized_whatsapp`: todos los pedidos de la organizacion llegan al numero central.

Aunque el WhatsApp sea central, el cliente debe seleccionar una sede o recibir una sugerencia por ubicacion antes de confirmar. El mensaje debe incluir sede, codigo del pedido y datos necesarios para validar inventario.

Central y sede trabajan sobre el mismo pedido; no se crean copias separadas. La central ve todos los pedidos autorizados y la sede solo los que tengan su `store_id`.

Estados iniciales sugeridos:

- Nuevo.
- Validando stock.
- Confirmado.
- En preparacion.
- Listo para despacho.
- Despachado.
- Cancelado.

## Experiencia de usuario

### Panel de sede (`/panel`)

- Mantiene la experiencia actual.
- Ve pedidos, productos, stock y estadisticas de una sola sede.
- Puede actualizar disponibilidad y stock local.

### Central de cadena (`/central`)

- Bandeja de pedidos de todas las sedes.
- Filtros por sede, estado, fecha, producto y operador.
- Catalogo maestro y acciones masivas por sedes seleccionadas.
- Estadisticas consolidadas y comparacion por sede.
- Administracion de usuarios y permisos.
- Entrada al contexto de una sede cuando sea necesario.

## Implementacion por fases

### Fase 1: operacion central

- Organizaciones, sedes y permisos.
- WhatsApp centralizado.
- Bandeja central de pedidos.
- Filtros y acceso al detalle por sede.
- Estadisticas basicas consolidadas e individuales.

### Fase 2: catalogo maestro

- Productos comunes.
- Publicacion y retiro masivo en sedes seleccionadas.
- SKU, precio y disponibilidad por sede.
- Productos exclusivos de una sede.

### Fase 3: inventario

- Stock por sede.
- Historial de movimientos.
- Alertas de bajo inventario.
- Reserva de stock al confirmar pedidos.

No incluir inicialmente ERP, compras a proveedores, almacenes complejos ni transferencias entre sedes.

## Seguridad y rendimiento

- RLS en todas las tablas nuevas expuestas.
- Validar en servidor acceso a organizacion y sede antes de cada consulta o cambio.
- Las consultas centrales se limitan a sedes vinculadas a la organizacion del usuario.
- Indices previstos en todas las claves de acceso: `organization_id`, `store_id`, `user_id`, `product_id`, estados y fechas usadas en filtros.
- Acciones masivas con transacciones y limites razonables.
- No usar `service_role` para saltar autorizacion sin validar primero al usuario y su alcance.

## Criterios para considerar otro servidor

Separar el modulo solo si aparece integracion profunda con ERP, operacion logistica independiente, volumen extraordinario, infraestructura aislada por contrato o un producto/equipo independiente. El caso inicial de 12 sedes no lo requiere.

## Decisiones pendientes antes de implementar

1. Si los precios comunes se heredan por defecto o siempre se copian como configuracion local.
2. Como se selecciona o sugiere la sede al cliente.
3. Si clientes y recompra se consolidan por organizacion o permanecen por sede.
4. Alcance exacto de edicion para operadores centrales y encargados de sede.
5. Modelo comercial y facturacion del modulo de cadenas.
6. Estrategia compatible para evolucionar la tabla actual `products` sin romper produccion.

