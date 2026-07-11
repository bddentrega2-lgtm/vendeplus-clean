# Validacion Pre-Piloto 3 Comercios - Vende+ / VendeMas

Fecha: 2026-07-06, America/Caracas  
Proyecto validado: `vendeplus-clean`  
Supabase esperado: `rvmtjtuztewcrmodrodb`  
Restricciones respetadas: no deploy, no push, no commit, no borrado de datos, no cambios a `.env.local`, no cambios a migraciones antiguas aplicadas.

## 1. Veredicto final

Estado: **LISTO CON RIESGOS CONTROLADOS**

- Esta listo para iniciar manana: si, como beta controlada con vigilancia cercana.
- Esta listo para 3 comercios: si, con configuracion revisada comercio por comercio antes de abrir.
- Esta listo para 60-90 pedidos diarios: si, el volumen esperado es bajo para Next.js/Vercel/Supabase si las consultas actuales se mantienen en ese rango.
- Riesgo principal: la prueba automatica no creo pedidos reales para no ensuciar produccion; el ultimo bloqueo posible esta en el pedido real completo: guardar pedido, abrir WhatsApp y verlo en panel.
- Revision manual obligatoria: hacer 1 pedido real por comercio antes de iniciar ventas, validando checkout, delivery, pago, WhatsApp y panel.

## 2. Build

Resultado inicial:

- `npm.cmd run build`: pasa.
- Warning no bloqueante: Node/Next muestra `DEP0205 module.register() is deprecated`.

Resultado adicional:

- `npm.cmd run lint`: pasa.
- `npm.cmd run check:production`: gates locales OK.
- `npm.cmd audit --omit=dev`: 2 vulnerabilidades moderadas por `next -> postcss`; `npm audit fix --force` propone downgrade roto a `next@9.3.3`, no se aplica.

## 3. Flujo cliente

Validado localmente en modo produccion con `next start -p 3001`:

- `/`: 200.
- `/smash`: 200.
- `/smash/carrito`: 200.
- `/smash/checkout`: 200, contiene Delivery, Retiro y selector de zona.
- `/smash/confirmacion`: 200.
- `/china-twon`: 200.
- `/china-twon/checkout`: 200, contiene Delivery y Retiro.

Validado por codigo:

- Catalogo filtra productos inactivos.
- Carrito conserva productos y opciones.
- Checkout limpia carrito despues de guardar pedido exitosamente.
- Confirmacion usa ultimo pedido guardado en localStorage.
- No se detectaron patrones de mojibake con `rg`.

Pendiente manual:

- Crear un pedido real por comercio, porque hacerlo automaticamente insertaria data real en Supabase.

## 4. Delivery

Estado: apto para piloto controlado.

Fuente de configuracion:

- El codigo usa `store_delivery_settings` cuando existe.
- Si no existe o no se puede leer, cae a `stores.accepts_delivery` y `stores.accepts_pickup`.
- Al guardar en `/panel/delivery`, sincroniza `stores.accepts_delivery` y `stores.accepts_pickup`.

Checkout:

- Si delivery y retiro estan activos, muestra ambos.
- Si solo delivery esta activo, fuerza delivery.
- Si solo retiro esta activo, fuerza retiro.
- Zonas: muestra selector de zona.
- Distancia/rangos: pide ubicacion y calcula tarifa.
- Manual/cotizar: muestra mensaje de confirmacion por WhatsApp.

Pedido:

- `/api/orders` recalcula delivery en servidor.
- Si falta zona o ubicacion requerida, devuelve error humano.
- Si delivery no esta disponible, bloquea el pedido.

Datos leidos de Supabase con anon key:

- `smash`: activo, delivery y retiro activos, 4 zonas activas, base EUR, productos activos.
- `china-twon`: activo, delivery y retiro activos, 3 rangos de distancia activos, base USD, productos activos.

Riesgo:

- Entrega2 no debe activarse en piloto si faltan credenciales reales.

## 5. Pagos

Estado: apto para piloto.

Validado por codigo:

- Checkout muestra metodos activos desde `payment_methods`.
- Datos de pago salen desde `payment_details`.
- Soporta Pago movil, Transferencia, Efectivo, Zelle y Binance si estan configurados.
- Pedido guarda referencia, moneda sugerida y estado inicial.
- Panel tiene endpoint para actualizar/verificar pagos.

Pendiente manual:

- Enviar pedido con metodo principal de cada comercio.
- Confirmar que la referencia/monto aparece correctamente en panel.

## 6. Opciones y extras

Estado: apto para piloto.

Validado por codigo:

- Producto con opcion obligatoria no se agrega sin seleccion.
- Extras opcionales permiten continuar.
- Precio extra suma al total.
- Carrito, checkout, WhatsApp y panel incluyen opciones.
- `/api/orders` valida opciones reales desde Supabase y no confia en precio del frontend.

Pendiente manual:

- Probar al menos un producto con extra obligatorio en cada comercio que lo use.

## 7. Pedidos

Estado: apto para piloto con prueba real final.

Validado por codigo:

- `/api/orders` no confia en precios del frontend.
- Relee productos, variantes y opciones desde Supabase.
- Valida productos disponibles.
- Valida opciones activas y min/max.
- Recalcula subtotal, delivery y total.
- Guarda `orders`, `order_items` y `order_item_options`.
- Crea o actualiza cliente con `safeUpsertCustomerFromOrder`.
- Devuelve WhatsApp generado desde datos recalculados.

No ejecutado automaticamente:

- Insercion real de pedido, para no crear data falsa en produccion.

## 8. Panel comercio

Rutas validadas HTTP local:

- `/panel/login`: 200.
- `/panel/inicio`: 200.
- `/panel/pedidos`: 200.
- `/panel/pedidos/nuevo`: 200.
- `/panel/productos`: 200.
- `/panel/opciones`: 200.
- `/panel/clientes`: 200.
- `/panel/delivery`: 200.
- `/panel/configuracion`: 200.
- `/panel/catalogo`: 200.
- `/panel/estadisticas`: 200.

Seguridad:

- APIs de panel sin token devuelven 401.
- El modulo Interpretar esta oculto en `/panel/pedidos/nuevo`.

Pendiente manual:

- Login real con usuario de comercio.
- Crear/editar producto real solo si el comercio necesita ajuste antes de abrir.
- Configurar pago y delivery desde panel y guardar.

## 9. Admin fundador

Rutas validadas HTTP local:

- `/admin`: 200.
- `/admin/comercios`: 200.
- `/admin/comercios/nuevo`: 200.
- `/admin/asignaciones`: 200.

Seguridad:

- APIs admin sin token devuelven 401.
- Las rutas admin usan `requireAdminAuth`.
- `requireAdminAuth` exige founder mode basado en `FOUNDER_EMAILS`.

Pendiente manual:

- Login real con founder.
- Confirmar que un usuario no founder no puede entrar al admin.

## 10. Seguridad

Validado:

- `SUPABASE_SERVICE_ROLE_KEY` solo aparece en `src/lib/supabase/admin.ts`.
- No se detectaron `console.log` en `src`.
- APIs de panel requieren token.
- APIs admin requieren founder auth.
- Pedido publico recalcula precios y delivery en servidor.
- Rate limit existe en endpoints sensibles ya revisados previamente.

Riesgos pendientes:

- `select("*")` existe en endpoints server-side y selects anidados de delivery. No es bloqueo para piloto, pero conviene reducirlos despues.
- `npm audit --omit=dev` reporta moderados por PostCSS transitorio en Next. No aplicar `--force` porque rompe version.
- No se ejecuto advisor de Supabase por timeout de conexion directa en sesiones previas.

## 11. Performance

Veredicto: suficiente para 3 comercios y 60-90 pedidos diarios.

Razones:

- Volumen bajo.
- Panel y admin tienen limites en consultas grandes.
- Catalogo inicial por comercio carga productos/categorias/opciones en una lectura amplia, aceptable para 10-20 productos por comercio.
- Checkout no hace loops pesados; calcula delivery en cliente y servidor.
- Admin summary tiene limites, aunque a futuro deberia moverse a agregaciones SQL/RPC.

Vigilar durante piloto:

- Tiempo de carga en celulares con red movil.
- Imagenes pesadas.
- Panel de pedidos con muchos pedidos acumulados.
- Errores de geolocalizacion o router externo.

## 12. Checklist para manana

Por cada comercio:

1. Abrir catalogo publico en celular.
2. Confirmar nombre, moneda, tasa y productos.
3. Agregar producto simple.
4. Agregar producto con extras si existe.
5. Entrar a carrito.
6. Entrar a checkout.
7. Probar Delivery.
8. Probar Retiro si esta activo.
9. Confirmar que el delivery suma precio correcto.
10. Confirmar metodo de pago principal.
11. Enviar pedido real.
12. Confirmar que WhatsApp abre con total correcto.
13. Confirmar pedido en `/panel/pedidos`.
14. Confirmar referencia/pago en panel.
15. Confirmar carrito vacio al volver al catalogo.

## 13. Bugs encontrados

| Bug | Severidad | Estado | Archivo | Solucion aplicada o pendiente |
| --- | --- | --- | --- | --- |
| No se puede validar insercion real sin crear data de produccion | Media operativa | Pendiente manual | `/api/orders` | Hacer 1 pedido real por comercio antes de abrir ventas |
| Entrega2 sin variables reales | Media operativa | Controlado | `src/lib/integrations/entrega2.ts` | Mantener Entrega2 apagado durante piloto |
| `npm audit` reporta PostCSS transitorio via Next | Media tecnica | Pendiente upstream | `package-lock.json` | No aplicar `--force`; vigilar parche de Next |
| `supabase migration list` no respondio dentro del timeout | Baja operativa | Controlado | Supabase CLI | `db push --dry-run` si confirmo remoto al dia |

## 14. Cambios realizados

| Archivo | Cambio | Motivo | Riesgo |
| --- | --- | --- | --- |
| `docs/PILOTO_3_COMERCIOS_CHECKLIST.md` | Creado checklist operativo | Guiar prueba real de manana | Bajo |
| `docs/VALIDACION_PRE_PILOTO_3_COMERCIOS.md` | Creado informe de validacion | Dejar veredicto y evidencias | Bajo |

No se aplicaron cambios de logica durante esta validacion porque no aparecio un bug critico corregible de bajo riesgo.

## 15. SQL pendiente

No hay SQL pendiente para iniciar el piloto.

Confirmaciones disponibles:

- `npx.cmd supabase db push --linked --dry-run`: remoto al dia.
- Migraciones locales contienen columnas criticas de delivery, pagos, clientes, moneda y suscripciones.

## 16. Recomendacion final

Iniciar manana como beta controlada, no como lanzamiento abierto.

Antes de aceptar pedidos reales de clientes, hacer un pedido real por cada comercio piloto. Si los 3 pedidos pasan de punta a punta, abrir ventas con vigilancia durante el primer dia.

No activar Entrega2 hasta tener credenciales reales probadas. No reactivar el modulo Interpretar hasta resolver cuota/modelo y redisenar el flujo de IA.

