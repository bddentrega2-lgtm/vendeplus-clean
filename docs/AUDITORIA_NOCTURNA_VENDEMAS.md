# Auditoria nocturna VendeMas

Fecha: 2026-07-05, America/Caracas  
Proyecto Supabase validado: `rvmtjtuztewcrmodrodb` / `vendeplus-production`  
Alcance: auditoria tecnica, UX, seguridad, delivery, suscripciones, moneda, readiness y posicionamiento comercial.  
Restricciones respetadas: no se hizo deploy, no se hizo push, no se hizo commit, no se borro data real y no se modifico `.env.local`.

## Resumen ejecutivo

VendeMas ya esta en un estado de beta comercial controlada: el build de produccion compila, lint pasa, las migraciones locales/remotas estan alineadas y los flujos principales existen en codigo. No lo calificaria todavia como lanzamiento masivo sin una ronda final de QA real en produccion, porque delivery es el flujo mas sensible y cualquier error en tarifa rompe confianza.

El modulo critico de delivery esta mejor encaminado: soporta delivery propio por zonas, rangos de km, tarifa plana, cotizacion por WhatsApp y Entrega2 separado como integracion. El checkout renderiza la seleccion de zona cuando el comercio esta configurado por zonas, calcula por ubicacion cuando corresponde y el backend recalcula antes de guardar el pedido. En pruebas HTTP locales, `/smash/checkout` respondio 200 y contiene zona/delivery; `/china-twon/checkout` respondio 200 y contiene delivery/ubicacion.

La base de datos de produccion ya tiene la configuracion esperada segun la verificacion previa: Smash tiene 4 zonas activas y China Twon tiene 3 rangos por km. Si en la URL publicada aun no aparece el selector o no calcula, la causa mas probable es que produccion no tenga desplegado el ultimo build o que el cliente este viendo cache/version vieja.

## Cambios aplicados en esta auditoria

- Se agregaron limites de uso a endpoints sensibles:
  - `/api/panel/geocode`
  - `/api/panel/uploads`
  - `/api/panel/orders/interpret`
  - `/api/panel/exchange-rate`
  - `/api/panel/customers/backfill`
  - `/api/signup` tambien limita tamano de body.
- Se endurecio `/api/cron/exchange-rates`: en produccion exige `CRON_SECRET`; sin secreto solo permite entorno local/no produccion.
- Se agregaron limites de tamano a webhooks de Entrega2.
- Se limpiaron textos corruptos/mojibake y mensajes internos que mencionaban migraciones/Supabase al cliente.
- Se cambio el lenguaje `sumar/elegir/personalizar` por `agregar` o verbos neutros donde era mas claro.
- Se fijo `supabase` CLI como devDependency exacta `2.109.0`.
- Se corrigieron errores de TypeScript generados por el nuevo rate limit y se dejo `lint` en cero.
- Se mantuvo la service role encapsulada solo en servidor: `src/lib/supabase/admin.ts`.

## Validaciones ejecutadas

Pasaron:

- `npm.cmd run lint`
- `npm.cmd run build`
- `npx.cmd supabase --version` -> `2.109.0`
- `npx.cmd supabase db push --linked --dry-run` -> remote database up to date
- `npx.cmd supabase migration list` -> 15 migraciones locales alineadas con remoto
- `npm.cmd run check:production` -> gates locales OK
- Busqueda de mojibake en `src` y `public` -> sin resultados
- Busqueda de service role -> solo `src/lib/supabase/admin.ts`
- HTTP local:
  - `GET /smash` -> 200
  - `GET /smash/checkout` -> 200, contiene zona/delivery
  - `GET /china-twon/checkout` -> 200, contiene delivery/ubicacion

No completado por conectividad del CLI:

- `supabase db advisors --linked`
- `supabase db query --linked --file supabase/production_readiness_summary.sql`

Ambos comandos quedaron esperando conexion directa hasta timeout. No se repitio en bucle. El dry-run de migraciones y migration list si respondieron.

Advertencias:

- `check:production` advierte que Entrega2 no tiene variables configuradas; debe mantenerse apagado hasta probar staging/produccion con credenciales reales.
- `check:production` advierte que `OPENAI_API_KEY` no esta configurado; el interprete usa fallback local. Guia de activacion: `docs/OPENAI_INTERPRETAR_SETUP.md`.
- `npm audit` reporta 4 vulnerabilidades: 1 low y 3 moderate. La de produccion viene por `next -> postcss`; `npm audit fix --force` propone una bajada rota a `next@9.3.3`, por eso no se aplico automaticamente.
- `next build` emite warning de Node/Next: `module.register()` deprecated. No rompe build.

## Estado por modulo

### Catalogo publico

Estado: usable.

Funciona:

- Catalogo por comercio con productos, categorias, variantes y opciones.
- Carrito local por comercio.
- Precios base en USD/EUR con Bs opcional segun tasa.
- Simbolo de euro soportado por `formatBaseCurrency`.
- Confirmacion y WhatsApp usan la moneda base del comercio.

Mejorar:

- Asegurar visualmente en produccion que el comercio configurado en EUR muestre `€` en catalogo, carrito, checkout, confirmacion y WhatsApp.
- Evitar que el usuario vea estados viejos por cache tras deploy.
- Revisar textos de landing: por cumplir el criterio de vocabulario, algunas frases quedaron menos naturales y conviene pulirlas con copywriting.

### Checkout

Estado: funcional, requiere QA final intensivo.

Funciona:

- Pickup y delivery.
- Zonas activas: el checkout muestra `select` cuando `pricingType = zones`.
- Km/rangos: el cliente comparte ubicacion o toca mapa; se calcula distancia y tarifa por rango.
- Cotizacion manual: no promete monto y usa WhatsApp.
- El backend recalcula subtotal, delivery y total antes de guardar.
- El carrito se limpia despues de guardar pedido exitosamente.

Mejorar:

- Hacer QA real con navegador en produccion despues del deploy: no basta con build.
- Para zonas, considerar que la ubicacion sea opcional; si el negocio cobra por zona, el selector debe ser el protagonista y el mapa solo referencia.
- Mostrar un resumen mas claro de "como se calculo" la tarifa: zona, rango, km, promo.

### Delivery admin

Estado: base solida, pero es el modulo que decide si se puede vender con confianza.

Funciona:

- Modalidades separadas: delivery propio, Entrega2, cotizar por WhatsApp, desactivado.
- Subconfiguraciones por tipo: tarifa plana, zonas, rangos.
- Guardado sincroniza `store_delivery_settings` y flags legacy `stores.accepts_delivery/pickup`.
- Zonas y rangos se cargan/sortear por comercio.

Mejorar antes de venta masiva:

- En Entrega2, bloquear o advertir fuerte si faltan credenciales/activacion real.
- Agregar pruebas automatizadas para `calculateDeliveryQuoteFromSettings`.
- Crear checklist visual dentro del admin: "Listo para checkout" con zonas/rangos activos, coordenadas del comercio y pickup/delivery.
- Agregar simulador interno: subtotal + zona/km -> tarifa esperada.

### Moneda y tasa

Estado: implementado, pendiente verificacion operativa en Vercel.

Funciona:

- Comercio puede tener `base_currency` USD/EUR.
- Puede mostrar u ocultar Bs.
- Existe cron diario `/api/cron/exchange-rates`.
- Existe endpoint manual autenticado `/api/panel/exchange-rate`.

Falta verificar:

- `CRON_SECRET` debe existir en Vercel Production.
- El cron de Vercel debe enviar `Authorization: Bearer <CRON_SECRET>` o ajustarse segun mecanismo usado.
- Las APIs configuradas para BCV USD/EUR deben responder de forma estable.

### Suscripciones

Estado: listo para beta operativa.

Funciona:

- Comercio puede registrar pago de suscripcion con referencia, banco y fecha.
- Admin puede aprobar/rechazar.
- Al aprobar, se extiende la suscripcion.
- Admin puede extender 30 dias o fecha manual.
- Cuenta vencida puede mostrar aviso.
- Eliminacion definitiva de comercio pide clave de admin.

Mejorar:

- Definir reglas de negocio exactas para mensual/anual: si el comercio paga antes de vencer, extender desde fecha de vencimiento, no desde hoy.
- Agregar comprobante opcional mas adelante si operacion lo necesita; hoy se pidio quitar link.
- Agregar historial claro por comercio: pagos, aprobaciones, rechazo y notas.

### Interprete de pedidos

Estado: util como asistente, no debe venderse como "igual que chatear con Codex".

Actualizacion 2026-07-06: el interprete ahora usa OpenAI con schema estricto, timeout, modelo configurable por `OPENAI_ORDER_MODEL`, metadatos visibles en panel y fallback local si la IA no esta disponible.

Actualizacion 2026-07-06 tarde: el modulo visible de `Interpretar` en pedido manual queda oculto temporalmente. La infraestructura queda en codigo, pero no se mostrara al comercio hasta convertirla en una experiencia mas madura. El siguiente uso prioritario de IA sera un modulo de creacion de catalogos: el comercio sube fotos, nombres/precios o una lista inicial, la IA propone productos/categorias/opciones, y el usuario revisa y edita antes de publicar.

Por que no se siente tan inteligente:

- Es una llamada acotada, con schema cerrado, sin conversacion continua.
- No tiene memoria del comercio ni aprendizaje por correcciones.
- Solo puede usar el catalogo que se le pasa en ese momento.
- Si el texto del cliente es ambiguo, debe adivinar y bajar confianza.

Mejoras recomendadas:

- Crear banco de 50-100 mensajes reales anonimizados y expected output.
- Agregar ejemplos por rubro: comida, ropa, postres, servicios.
- Guardar correcciones del comercio para mejorar fuzzy matching local.
- Separar en dos pasos: interpretar -> pantalla de revision -> guardar.
- Mostrar confianza por item y advertencias mas concretas.
- Diseñar nuevo modulo IA de catalogos con revision humana obligatoria antes de guardar productos.

## Seguridad y multi-tenant

Lo que esta bien:

- Service role no esta expuesta al cliente.
- Rutas de panel pasan por auth de panel.
- RLS esta habilitado segun checks previos del SQL Editor.
- Tablas privadas no tienen grants directos a anon/authenticated segun checks previos.
- Endpoints publicos clave tienen rate limit.
- Eliminacion definitiva de comercio exige reautenticacion del admin.

Riesgos residuales:

- Los deletes administrativos son potentes y manuales; conviene crear backup antes de usar en produccion real.
- Los advisors de Supabase no pudieron ejecutarse desde esta maquina por timeout.
- Hay operaciones administrativas grandes que deberian moverse a RPC/transacciones o jobs si escala el volumen.

## Performance y deuda tecnica

Riesgos:

- Componentes muy grandes: `ConfigManager`, `OrdersManager`, `OptionsManager`, `ProductManager`, `CatalogManager`, `DeliveryManager`, `CheckoutForm`.
- `admin/summary` fue limitado a 20.000 pedidos, pero lo correcto a mediano plazo es agregacion SQL/RPC.
- Falta suite de pruebas automatizadas de delivery, pagos, checkout y permisos multi-tenant.

Prioridad:

1. Tests unitarios de delivery quote.
2. Tests E2E de checkout por modo.
3. Refactor por modulos de los managers mas grandes.
4. Agregaciones SQL para dashboard/admin.

## Analisis de mercado

Fuentes consultadas:

- OlaClick: https://olaclick.com/en/orders-by-whatsapp/
- OlaClick Google Play: https://play.google.com/store/apps/details?id=panel.olaclick.app
- OlaClick YC: https://www.ycombinator.com/companies/olaclick
- PideFacil: https://pidefacil.app/
- PideFacil Instagram: https://www.instagram.com/pidefacilapp/
- Wink by Yummy: https://usawink.com/
- Yummy SuperApp: https://www.yummysuperapp.com/
- PedidosYa Venezuela: https://www.pedidosya.com.ve/
- PedidosYa Partner: https://portal-app.pedidosya.com/login

### Competidores tipo catalogo/WhatsApp

OlaClick comunica menu digital, pedidos por WhatsApp sin intermediarios, chatbot, pagos online, descuentos, fidelizacion, app de repartidor, inventario y gestor de pedidos. Tambien se posiciona con mucha escala: mas de 40.000 restaurantes segun su material publico.

PideFacil en Venezuela se posiciona como menus digitales para restaurantes y tiendas, pedidos sin comision a WhatsApp y una base de clientes grande segun su comunicacion social.

Wink by Yummy comunica bot de inteligencia artificial + tienda online, funcionando en 24 horas, pedidos y pagos automaticos por WhatsApp.

Ventaja de VendeMas:

- Mas adaptado a la realidad venezolana: Bs, USD, EUR, pago movil, referencia, WhatsApp.
- Control propio del comercio sin comisiones tipo marketplace.
- Delivery configurable por zonas/rangos, no solo "por confirmar".
- Admin de suscripciones propio para operar SaaS localmente.
- Puede servir a rubros fuera de restaurante.

Brecha:

- Chatbot/IA conversacional de Wink/OlaClick se percibe mas potente.
- OlaClick tiene ecosistema mas amplio: POS, KDS, inventario, fidelizacion.
- PideFacil ya tiene posicionamiento local.

### Competidores tipo super app

Yummy y PedidosYa venden conveniencia final: app, marketplace, variedad, logistica, tracking y descubrimiento de demanda. PedidosYa Partner comunica herramientas de rendimiento, descuentos, campanas, menu y horarios para comercios.

VendeMas no debe intentar competir frontalmente como super app V1. El angulo correcto es "tu canal propio de venta, sin comision, conectado a WhatsApp, listo para Venezuela".

No necesario para V1:

- Marketplace masivo con ranking estilo PedidosYa.
- App de conductor completa.
- POS/KDS avanzado.
- Inventario profundo.
- Campanas de ads internas.

Si falta para vender mejor:

- QR descargable por comercio.
- Dominio/link personalizado mas pulido.
- Cupones simples.
- Estado del pedido visible al cliente.
- Notificaciones WhatsApp mas estructuradas.
- Onboarding guiado: configurar comercio -> productos -> delivery -> pago -> pedido de prueba.
- Dashboard "listo para vender" con checks verdes.

## Comercializacion

Se puede vender como beta controlada a comercios cercanos si se cumplen estas condiciones:

1. Hacer deploy del build actual.
2. Confirmar `CRON_SECRET` y variables de tasa en Vercel.
3. Probar 5 comercios reales:
   - 1 por zonas
   - 1 por km
   - 1 tarifa plana
   - 1 pickup-only
   - 1 cotizar por WhatsApp
4. Hacer 2 pedidos de prueba por comercio.
5. Confirmar que el comercio recibe WhatsApp claro y el panel registra pedido correcto.
6. Confirmar que el carrito queda vacio tras pedido exitoso.
7. Confirmar que admin puede aprobar suscripcion y extender fecha.
8. Confirmar que cuenta vencida muestra aviso correcto.

No recomiendo venta masiva hasta completar esa prueba de campo.

## Checklist manual para probar despues del deploy

### Smash por zonas

1. Abrir catalogo Smash.
2. Agregar producto con y sin extras.
3. Ir a checkout.
4. Seleccionar delivery.
5. Ver selector de zonas.
6. Seleccionar cada zona y verificar que cambia el delivery.
7. Completar pago y enviar pedido.
8. Confirmar que total en WhatsApp y panel coincide.
9. Volver al catalogo y confirmar carrito vacio.

### China Twon por km

1. Abrir checkout.
2. Seleccionar delivery.
3. Compartir ubicacion o tocar mapa.
4. Confirmar que aparece distancia y tarifa.
5. Probar una ubicacion fuera de rango si aplica.
6. Enviar pedido y confirmar panel.

### Cotizar por WhatsApp

1. Configurar comercio en "Cotizar por WhatsApp".
2. El checkout no debe mostrar monto automatico.
3. El texto debe indicar que se confirma por WhatsApp.

### Suscripcion

1. Entrar como comercio.
2. Registrar pago mensual y anual con referencia, banco y fecha.
3. Entrar como admin.
4. Aprobar pago.
5. Confirmar extension de fecha.
6. Rechazar otro pago y revisar mensaje.

### Seguridad

1. Entrar con usuario de un comercio.
2. Intentar abrir datos de otro comercio cambiando URL/API.
3. Debe devolver 403/401 o no mostrar datos.

## Veredicto

VendeMas tiene una propuesta valiosa y diferenciada para comercios venezolanos: canal propio, WhatsApp, moneda local, delivery configurable y suscripciones administrables. El producto ya no esta "muy debil" a nivel estructura; esta cerca de una beta vendible.

El foco absoluto antes de vender debe ser delivery + checkout + pago + suscripcion. Lo demas puede crecer despues. La prioridad no es agregar mas features, sino que el pedido de prueba sea impecable, repetible y entendible para un comercio no tecnico.
