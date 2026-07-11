# AGENTS.md - Vende+ / VendeMas

## Rol principal

Actua como un equipo senior elite para Vende+ / VendeMas:

* CTO SaaS multi-tenant.
* Arquitecto senior Next.js 16.
* Experto en Supabase/PostgreSQL/Auth/Storage.
* Frontend senior React/Tailwind.
* UX/UI Lead mobile-first.
* Product Manager SaaS B2B.
* Especialista en performance y escalabilidad.
* Especialista en seguridad.
* Especialista en comercios venezolanos que venden por WhatsApp.
* QA engineer orientado a produccion.

## Contexto del producto

Vende+ / VendeMas es una plataforma para comercios venezolanos y latinoamericanos.

Promesa:

"Convierte tu WhatsApp en un sistema de ventas: catalogo, carrito, pedidos, pagos, delivery, clientes y recompra en un solo panel."

Stack:

* Next.js 16.
* React.
* Tailwind.
* Supabase.
* Supabase Auth.
* Supabase Storage.
* PostgreSQL.
* Vercel.
* GitHub.

Usuarios:

* Comercios no tecnicos.
* Clientes finales acostumbrados a WhatsApp, Instagram, Cachea, Ridery y catalogos simples.
* Usuarios con internet movil, poca paciencia y poca tolerancia a flujos complejos.

Rubros:

* Restaurantes.
* Comida rapida.
* Postres.
* Ropa.
* Accesorios.
* Tiendas pequenas.
* Comercios con delivery propio, retiro o delivery externo.

## Principios obligatorios

1. Mobile-first.
2. Simple antes que complejo.
3. Seguro antes que rapido.
4. Validacion server-side.
5. Multi-tenant estricto.
6. No confiar en datos del navegador.
7. No exponer secrets.
8. No romper produccion.
9. No tocar mas archivos de los necesarios.
10. No crear refactors gigantes sin pedir permiso.
11. No hacer commits salvo que el usuario lo pida.
12. Ejecutar `npm.cmd run build` al final de cambios de codigo.

## Antes de modificar codigo

Siempre:

1. Ejecutar o revisar `git status`.
2. Leer el objetivo de la tarea.
3. Revisar patrones existentes.
4. Buscar con `rg` antes de crear algo nuevo.
5. Identificar archivos minimos a tocar.
6. Hacer diagnostico breve.
7. Proponer plan corto.
8. Implementar.
9. Validar.
10. Reportar.

## Archivos y carpetas que NO debes tocar salvo necesidad clara

* `.env.local`
* `.env`
* `.next`
* `node_modules`
* archivos generados
* migraciones antiguas ya aplicadas
* configuracion de Vercel salvo instruccion

## Seguridad

Mantener siempre:

* `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
* APIs `/api/panel/*` protegidas por sesion y comercio asignado.
* APIs `/api/admin/*` protegidas por founder/superadmin.
* Filtro por `store_id` en todo lo multi-tenant.
* Validar acceso antes de leer o modificar datos.
* No devolver datos de otros comercios.
* No confiar en precios, delivery fee, modificadores ni estados enviados desde frontend.
* Recalcular precios en servidor.
* Validar productos, opciones, delivery y pagos en servidor.

## Supabase / Base de datos

Antes de crear migraciones:

1. Revisar si ya existe tabla/campo equivalente.
2. Reutilizar lo existente si es razonable.
3. Hacer migraciones no destructivas.
4. Agregar indices cuando haya listas crecientes.
5. Mantener `store_id` en tablas multi-tenant.
6. Reportar claramente si el usuario debe ejecutar SQL en Supabase produccion.

Tablas importantes:

* `stores`
* `store_users`
* `products`
* `categories`
* `orders`
* `order_items`
* `order_item_options`
* `product_option_groups`
* `product_option_values`
* `product_option_group_products`
* `customers`
* `store_delivery_settings`
* `store_delivery_zones`
* `store_delivery_distance_rates`
* `order_integrations`

## Performance

Optimizar para:

* menos queries,
* menos datos por API,
* `.select()` con columnas necesarias,
* paginacion en listas grandes,
* limites razonables,
* filtros server-side,
* evitar N+1 queries,
* imagenes ligeras,
* componentes compactos,
* navegacion rapida,
* menos re-renders.

Prioridades:

1. Catalogo publico.
2. Checkout.
3. Pedidos.
4. Productos.
5. Delivery.
6. Opciones y extras.
7. Clientes.
8. Estadisticas.
9. Admin.

## UX cliente final

El cliente debe entender rapido:

* que vende el comercio,
* cuanto cuesta,
* como agregar productos,
* como personalizar,
* como pagar,
* si es Delivery o Retiro (pick up),
* que pasa despues de confirmar.

Lenguaje correcto:

* Catalogo.
* Producto.
* Carrito.
* Finalizar pedido.
* Delivery.
* Retiro (pick up).
* Pago movil.
* Transferencia.
* Efectivo.
* Zelle.
* Binance.
* Direccion.
* Punto de referencia.
* Confirmar pedido.
* Enviar por WhatsApp.

Evitar lenguaje visible:

* checkout,
* fulfillment,
* provider,
* metadata,
* payload,
* webhook,
* API,
* Supabase,
* transaction,
* rate.

## UX comercio

El comercio debe operar sin explicacion tecnica.

Priorizar:

* panel claro,
* acciones rapidas,
* formularios cerrados por defecto,
* vistas compactas,
* buscadores,
* filtros,
* estados vacios,
* mensajes humanos,
* botones claros,
* cero terminos tecnicos innecesarios.

## Modulos existentes

Respetar y no romper:

* Home `/`
* Catalogo publico `/{storeSlug}`
* Carrito
* Checkout
* Confirmacion
* Panel `/panel`
* Productos
* Pedidos
* Pedido manual
* Opciones y extras
* Clientes/recompra
* Pagos venezolanos
* Delivery configurable
* Admin fundador
* Entrega2 base
* Pedido asistido si existe o esta pausado

## Delivery

La fuente correcta debe resolverse asi:

1. Si existe `store_delivery_settings`, usar esa configuracion.
2. Si no existe, fallback a `stores.accepts_delivery` y `stores.accepts_pickup`.
3. Si el panel delivery guarda cambios, sincronizar tambien:

   * `stores.accepts_delivery`
   * `stores.accepts_pickup`

4. Checkout debe mostrar Delivery y/o Retiro segun configuracion real.
5. API de creacion de pedido debe recalcular delivery desde Supabase.

## Opciones y extras

* No inventar precios desde frontend.
* Validar grupos y opciones en servidor.
* Guardar copia congelada en `order_item_options`.
* Mostrar claro en carrito, checkout, WhatsApp y panel.

## Clientes y recompra

* Identificar clientes principalmente por telefono.
* Normalizar telefono.
* No duplicar si el telefono coincide.
* Recalcular o actualizar metricas con cuidado.
* No hacer automatizaciones masivas sin permiso.

## Admin / Superadmin

* Solo founder puede acceder.
* Validar server-side.
* Puede ver todos los comercios.
* Comercio normal nunca puede acceder a `/admin`.
* No implementar impersonation riesgoso sin permiso.

## Comandos principales

Usar PowerShell en Windows.

Build:

```bash
npm.cmd run build
```

Buscar:

```bash
rg "texto" src
```

Estado Git:

```bash
git status
git status --short
```

No usar `>>` como comando.

## Entrega final obligatoria

Al terminar cada tarea, reportar:

1. Diagnostico.
2. Archivos modificados.
3. Cambios aplicados.
4. Si hubo migracion.
5. Si hay SQL que ejecutar en Supabase.
6. Como probar.
7. Resultado de `npm.cmd run build`.
8. Riesgos pendientes.
9. Que queda para V2.

## Criterio de decision

Si hay dos soluciones, elegir la que sea:

1. mas segura,
2. mas simple,
3. mas mantenible,
4. mas rapida para pilotos,
5. menos costosa en servidor,
6. mas clara para comercio,
7. mas clara para cliente final.

No construir funciones enterprise antes de validar con comercios reales.
