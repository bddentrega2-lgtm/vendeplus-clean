# Plan: modulo opcional de cadenas

Estado: idea guardada; decision de arquitectura pendiente. No implementar hasta autorizacion expresa.

## Alternativa nueva: una marca con sedes internas

Se evaluara una arquitectura mas simple para el comercio:

- `stores` representa la marca, con un unico enlace y catalogo.
- Una tabla `store_branches` representa las sedes.
- El cliente debe seleccionar sede antes de ver el catalogo.
- La disponibilidad de productos por sede se controla con `product_branches`, sin duplicar el producto base.
- Cada pedido conserva `store_id` y agrega `branch_id`.
- Cada sede define nombre, telefono, ubicacion, horarios, pagos, retiro y delivery.
- Los operadores ven solo las sedes autorizadas; la central puede ver todas y filtrar.
- Entrega2 debe usar telefono y ubicacion de retiro de la sede seleccionada.

Alcance recomendado para una V1 de esta alternativa:

- Productos, categorias, imagenes, opciones y precios compartidos por marca.
- Disponibilidad distinta por sede.
- Sin precios distintos ni inventario cuantitativo por sede inicialmente.
- Clientes consolidados por marca y pedidos identificados por sede.
- Activacion opcional; los comercios actuales siguen funcionando sin `branch_id`.

## Comparacion y valoracion actual

### Marca con sedes internas

- Mejor experiencia publica, mantenimiento de catalogo, fidelizacion y escalabilidad para cadenas.
- Mayor riesgo inicial: exige adaptar permisos, carrito, checkout, pagos, delivery, Entrega2, notificaciones y estadisticas a `branch_id`.
- Valoracion preliminar: 7.8/10.

### Central con cada sede como `store`

- Mayor aislamiento y compatibilidad inmediata con la arquitectura actual, especialmente pedidos, pagos y delivery.
- Genera duplicacion de catalogos y mas carga operativa conforme aumentan las sedes.
- Valoracion preliminar: 7.3/10.

### Recomendacion pendiente de decision

La opcion preferida a largo plazo es una marca con sedes internas, manteniendo el modelo actual para comercios independientes. Solo debe construirse si en el primer lanzamiento quedan cubiertos server-side los permisos por sede, pagos, delivery, Entrega2, carrito, pedidos y notificaciones. La opcion de central + `stores` sigue siendo la alternativa de menor riesgo y salida mas rapida.

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

