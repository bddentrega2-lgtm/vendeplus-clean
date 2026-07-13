# Fase 3 - Paneles pesados y renders innecesarios

Fecha: 2026-07-13, America/Caracas  
Rama: `perf/fase-3-heavy-panels`  
Alcance: reducir deuda de render/arquitectura en paneles cliente pesados, sin cambiar comportamiento comercial.  
No incluye: branding, autorizacion, RLS, checkout, precios, estados de pedido, migraciones, cache cliente, lazy loading por pestana ni procesamiento asincrono.

## Resumen ejecutivo

La Fase 3 se ejecuto de forma conservadora sobre los dos paneles con mayor riesgo operativo:

- `OrdersManager.tsx`, panel frecuente de pedidos del comercio.
- `TransportAgencyPanel.tsx`, panel completo de empresas delivery.

No se hizo un refactor visual grande. El objetivo fue separar calculos y filtros derivados en hooks chicos, estabilizar callbacks criticos y reducir trabajo repetido dentro de componentes cliente grandes. Es una primera capa segura para preparar Fase 4/Fase 5 sin tocar permisos ni modelo de negocio.

## Precondiciones verificadas

- Rama base limpia antes de arrancar: si.
- Rama usada: `perf/fase-3-heavy-panels`.
- Fase 1 intacta: si; no se tocaron APIs admin ni RPCs.
- Fase 2 intacta: si; no se tocaron componentes de imagen fuera del panel delivery ya optimizado previamente.
- Branding desaprobado: no incluido.
- Stash de `product_images`: no aplicado.
- Migraciones/RLS/auth: no tocadas.
- `npm.cmd run lint` inicial: OK.
- `npx.cmd tsc --noEmit` inicial: OK.
- `npm.cmd test --if-present` inicial: OK, sin script formal de test.
- `npm.cmd run build` inicial: OK.

## Auditoria inicial de componentes

| Componente | Lineas aprox. | Estados | Efectos | `useMemo` | `.map()` | Riesgo principal |
|---|---:|---:|---:|---:|---:|---|
| `src/components/panel/OrdersManager.tsx` | 1186 | 20 | 4 | 2 | 15 | Fetch, filtros, realtime, acciones y modal de detalle en un solo cliente |
| `src/components/transport/TransportAgencyPanel.tsx` | 1914 | 24 | 6 | 2 | 13 | Resumen, pedidos, tarifas, conexiones, billing y configuracion en un solo cliente |

Lectura:

- El problema principal no era solo el peso JS inicial, sino el trabajo repetido en cada render.
- Habia calculos derivados de filtros, zonas/tarifas, solicitudes pendientes y conexiones activas dentro del cuerpo principal de los componentes.
- Sin sesion autenticada no se puede medir el render real con listas grandes; la medicion local cubre shell/guard y sirve solo como verificacion de no-regresion.

## Cambios implementados

### Pedidos comercio

Archivos:

- `src/components/panel/OrdersManager.tsx`
- `src/components/panel/orders/use-order-filters.ts`

Cambios:

- Se extrajo la construccion de filtros de pedidos a `useOrderFilters`.
- Se extrajo la serializacion de querystring a `buildOrdersQueryString`.
- `loadOrders` paso a `useCallback` con dependencias explicitas.
- Acciones frecuentes (`sendOrderToDelivery`, `changeOrderStatus`, `markPaymentVerified`) pasaron a callbacks estables.
- Los efectos de visibilidad y realtime ahora dependen de `loadOrders` y una firma estable de filtros.

No se cambio:

- Estados de pedido.
- Validaciones de API.
- Payload enviado a `/api/panel/orders`.
- Realtime como invalidacion.
- Textos visibles o UX.

### Panel delivery

Archivos:

- `src/components/transport/TransportAgencyPanel.tsx`
- `src/components/transport/use-transport-panel-derived-data.ts`

Cambios:

- Se extrajeron datos derivados del panel delivery a `useTransportPanelDerivedData`.
- Se memoizaron de forma acotada:
  - tarifa activa;
  - zonas activas ordenadas;
  - tarifas por distancia activas ordenadas;
  - solicitudes pendientes;
  - alertas de configuracion;
  - conteo de conexiones activas.
- Se mantuvo `connectionEnded` como helper existente para no duplicar reglas.

No se cambio:

- API `/api/transport/me`.
- Reglas de tarifa.
- Estados de conexion.
- Billing.
- Solicitudes/conexiones.
- Navegacion de pestanas.

## Medicion antes/despues

Entorno: local `http://127.0.0.1:3000`, Playwright headless, sin credenciales.  
Nota importante: estas rutas protegidas miden login/guard/shell sin datos reales, no el dashboard autenticado cargado con pedidos o empresas.

### Antes

| Ruta | Status | Tiempo total | DCL | Load | Scripts | JS transferido | Fetch | Errores consola |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/panel/pedidos` | 200 | 1443ms | 200ms | 448ms | 10 | 219 KB | 19 | 1* |
| `/transporte/panel` | 200 | 983ms | 55ms | 302ms | 10 | 219 KB | 2 | 1* |
| `/transporte/panel/pedidos` | 200 | 857ms | 48ms | 224ms | 10 | 219 KB | 2 | 1* |

### Despues

| Ruta | Status | Tiempo total | DCL | Load | Scripts | JS transferido | Fetch | Errores consola |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/panel/pedidos` | 200 | 1016ms | 80ms | 370ms | 10 | 219 KB | 19 | 1* |
| `/transporte/panel` | 200 | 931ms | 65ms | 294ms | 10 | 219 KB | 2 | 1* |
| `/transporte/panel/pedidos` | 200 | 931ms | 61ms | 293ms | 10 | 219 KB | 2 | 1* |

`*` El error de consola esperado corresponde a rutas protegidas sin credenciales/session real. No se uso usuario QA ni founder.

Lectura:

- El peso JS inicial no cambia, como era esperado: esta fase no metio `dynamic import` ni lazy loading por pestana.
- La mejora buscada es preparar componentes para menos render y menos trabajo repetido cuando existan datos reales.
- La medicion autenticada queda pendiente para QA con usuarios reales de comercio, delivery y founder.

## Validacion ejecutada

| Comando | Resultado |
|---|---|
| `npm.cmd run lint` | OK |
| `npx.cmd tsc --noEmit` | OK |
| `npm.cmd test --if-present` | OK, sin script formal de test |
| `npm.cmd run build` | OK |
| `npm.cmd run e2e:checkout` con `E2E_BASE_URL=http://127.0.0.1:3000` y `E2E_STORE_SLUG=armario` | OK; se omitio creacion de pedido porque `E2E_ORDER_PAYLOAD` no estaba definido |
| `git diff --check` | OK |

Nota del smoke: la primera corrida local fallo por timeout/chunk estatico del dev server recien reiniciado. Se verifico `/marketplace` con HTTP 200, se repitio el smoke y paso completo.

## Confirmaciones de seguridad y alcance

- No se modifico branding.
- No se modifico autorizacion.
- No se modifico RLS.
- No se modifico checkout.
- No se modifico logica comercial.
- No se modificaron migraciones.
- No se ejecuto SQL.
- No se aplico stash de `product_images`.
- No se hizo deploy.

## Pendiente para Fase 4

La siguiente fase recomendada es cache/fetch cliente con invalidacion segura:

1. Definir si se usa SWR o un patron interno de cache/dedupe.
2. Empezar solo por pedidos de comercio o catalogo/productos, no ambos a la vez.
3. Mantener realtime como invalidacion, no como fuente de datos sensibles.
4. Probar logout/login para evitar cache cruzado entre comercios.
5. Medir requests al navegar entre pestanas y volver.

## Pendiente para Fase 5

Lazy loading por pestana sigue siendo el gran paso para reducir carga inicial real:

1. Separar `/api/transport/me` por secciones.
2. Cargar pedidos solo al entrar a pedidos.
3. Cargar facturacion solo al entrar a facturacion.
4. Cargar solicitudes/conexiones solo al entrar a esas secciones.
5. Respetar deep links `/transporte/panel/pedidos`, `/tarifas`, `/facturacion`.

## Riesgos pendientes

- Falta medir con sesion autenticada y datos reales.
- Los componentes siguen siendo grandes; esta fase reduce deuda interna, pero no divide UI por archivo de forma profunda.
- Sin profiler de React en usuario QA no se puede cuantificar el ahorro de renders en listas grandes.
- El plan Pro de Supabase mejora capacidad disponible, pero no reemplaza optimizacion de queries, payloads y render.
