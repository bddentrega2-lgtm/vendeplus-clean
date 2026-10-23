# Cobertura, validacion y pendientes

## Base y metodo

- Fecha 2026-10-19, zona America/Caracas. Worktree auditado:
  `.catalog-ux-preview-20261015`, rama `feature/catalog-ux-20261015`, HEAD
  `0f4c17483fe9097467fd775af71c4b8eb1b8518a`. `git status` inicial:
  `SESSION_HANDOFF.md`, `next-env.d.ts`, `scripts/cart-review.behavior.test.cjs`
  y `src/lib/cart-review.ts` modificados previamente por hotfix Shibui.
  No se revirtio nada. La raiz padre `feat/thermal-order-printing-pilot`
  estaba mucho mas sucia y **no** es la base de esta auditoria.
- Inventario con `rg --files`, busquedas focales y lectura de rutas/funciones/
  migraciones. 110 archivos API, 165 migraciones SQL y 104 archivos en
  `scripts` encontrados. Esas cifras no implican 110 handlers ni 165
  migraciones aplicadas. `src/app`, `src/lib`, `src/components`, `mobile`,
  `supabase`, `.github/workflows`, `vercel.json` y configuracion examinados.
- Excluidos del inventario propio: `node_modules`, `.next`, `.vercel`, `tmp`,
  `outputs`, binarios/APK/ZIP, imagenes, videos, dependencias externas y
  worktrees/proyectos anidados de la raiz. `src/data` se trato como datos, no
  como logica. Se revisaron nombres de variables, nunca valores de secretos.
- La matriz de impacto ampliada tiene 16 filas y 10 columnas, validada con
  `Import-Csv`; es mapa de contratos, no recuento total de rutas.

## Cobertura por area

| Carpeta/modulo | Estado | Metodo y evidencia | Limitacion siguiente |
| --- | --- | --- | --- |
| `src/app/[storeSlug]`, `src/components/public`, `src/lib/server/cart-review.ts` | Parcial profunda | Trazado de carrito/checkout/pedido; suite focal; seis rutas HTTP y carrito en QA anterior | E2E visual y combinaciones mas complejas |
| `src/app/api/orders`, `src/lib/server/create-order-atomic.ts`, inventario SQL | Parcial profunda | Lectura de validaciones, fee, RPC e idempotencia; Retiro QA anterior | Concurrencia real y otras modalidades E2E |
| `src/app/api/panel/orders`, `kitchen`, `table-orders`; SQL de estados | Parcial profunda | Lectura de RPC/contratos y suite focal | Mesa/Barra con dos operadores y cliente |
| `src/app/api/integrations/entrega2`, `src/lib/server/entrega2-*` | Parcial profunda | Traza webhook/reintento; 15 pruebas del puente | Fallos inyectados y despliegue SQL verificado |
| `src/app/api/admin/registration-requests`, Auth y admin | Parcial profunda | Guardias, cookie/token, RPC v1/v2 AAL y puerta de fundador; A-01 | MFA real y cuentas de prueba AAL1/AAL2 |
| `src/app/api/panel/products`, opciones y `src/lib/supabase/catalog.ts` | Parcial | Busqueda de escrituras y fuentes de catalogo | Auditoria de cada accion/rol y caches |
| `src/lib/billing`, resumen admin, afiliados | Parcial profunda | Lectura de snapshot fee, ruta de resumen, lista admin y demo; A-06 descartado para produccion, A-07 | Conciliacion historica y permisos SQL |
| `src/app/api/delivery`, `transport`, `src/lib/delivery.ts` | Parcial | Rutas, fuentes de tarifa y proveedor; cotizacion QA anterior; grant publico de `transport_agencies` confirmado sin leer valores A-16 | Todas las agencias/zonas/costos reales y demas grants desplegados |
| `mobile/somos-android` | Parcial | Capacitor, servidor remoto, manifiesto, callback nativo, cifrado del token de impresion, plugins Java y FCM | APK real, permisos, WebView y pruebas fisicas; no se hallo fallo nativo confirmado en esta lectura |
| `src/app/api/printing-agent`, `src/lib/printing` | Parcial | Rutas de claim/pair/config y consumidores Android | Dos dispositivos/offline/duplicados |
| `supabase/migrations` | Inventario + lectura focal | 165 archivos; orden/stock/estados/cocina/afiliados/RLS localizados | Aplicacion real, grants/policies/triggers completos |
| Marketplace, compradores, clientes, estadisticas, UI admin | Parcial | Lectura de catalogo publico, topes de conexiones/calificaciones, RPC stats/fallback, historial comprador, cuenta y Clientes; A-08/A-09/A-15 | E2E, limites reales PostgREST, cada accion UI; no declarar auditados por completo |
| Las 110 rutas API | Inventario mecanico, no auditoria manual completa | Se examinaron metodos mutantes y presencia textual de guardia/limite; solo `/api/auth/panel-session` quedo fuera del patron y autentica token Supabase | Revisar autorizacion efectiva y efectos secundarios de cada ruta; scan no demuestra seguridad |
| `.github/workflows`, cron, despliegue | Parcial | `quality.yml`, `vercel.json`, env por nombre | Ejecuciones reales y monitoreo no verificados |

## Comandos y resultados

| Comando/control | Resultado | Interpretacion |
| --- | --- | --- |
| `git status --short --branch`, `git rev-parse HEAD` | Base arriba; cambios previos intactos | Reproducibilidad de codigo local, no prueba deploy exacto |
| `npm.cmd run build` | FAIL: Turbopack no acepta junction de `node_modules` fuera de la raiz | Bloqueo de entorno local. No concluye que app desplegada no compile |
| `npx.cmd tsc --noEmit --incremental false` | FAIL: faltan `leaflet.markercluster` y `google-auth-library` en `node_modules` compartido; 4 errores derivados | Ambos estan declarados en `package.json`, no instalados en junction. No se instalaron por alcance diagnostico |
| `node --test scripts/cart-review.behavior.test.cjs scripts/basic-inventory.behavior.test.mjs scripts/critical-contracts.test.mjs scripts/entrega2-bridge.behavior.test.mjs` | 138/138 PASS | Cobertura focal, no certificacion general |
| `npm.cmd run test:billing-release` | 9/9 PASS | Paginas de 0 a 10000 y error entre paginas simulados; no conciliacion real |
| `npm.cmd run test:critical` | 90/90 PASS | Contratos focales; varios son aserciones estaticas, no E2E |
| `npm.cmd run lint` | FAIL: 8 errores en siete archivos de pruebas/documentacion y 2 advertencias de hooks | La puerta CI de este arbol falla antes del build; A-11 |
| `npm.cmd run check:document-secrets` | PASS: 0 hallazgos | Control textual, no prueba ausencia absoluta de secretos |
| `npm.cmd audit --omit=dev --audit-level=high` | FAIL: 2 avisos high (`sharp`, `source-map-js`) | Lockfile fija `sharp@0.35.4` y `source-map-js@1.2.1`; A-14 tiene camino plausible, source-map-js no tiene entrada de cliente identificada |
| `npm.cmd ls sharp source-map-js --depth=3` | FAIL `ELSPROBLEMS`: junction local tiene Sharp 0.35.3/Next 16.3.0, distintos del lockfile | El audit del lockfile no prueba versiones instaladas en produccion; comprobar deploy reproducible |
| Anon PostgREST prod, `limit=0` + HEAD conteo | `admin_notes` agencia HTTP 200; columna privada de comercio HTTP 401; 8 agencias activas, 4 con tarifas privadas | Confirma grant A-16 sin descargar filas ni valores. No prueba que un tercero haya leido datos ni que los campos esten poblados |
| Reproduccion autorizada de sesion previa | Retiro QA en Smash creado, leido y cancelado; POST incompleto sin `quote` dio 500 | Evidencia de A-02 y flujo normal; **no** se hicieron pedidos durante esta auditoria |

No se ejecutaron migraciones, exploits, cargas, mensajes, cobros ni pedidos
reales en esta fase. No hubo despliegue ni cambio de configuracion. Las
pruebas de navegador del auditor anterior fallaron por cierre de Chromium;
no atribuir eso al sitio sin reproduccion.

## Seguridad y crecimiento: que falta medir

- Comparar esquema, RLS, grants, politicas de Storage, RPC y triggers del
  Supabase activo con migraciones; inspeccion con acceso autorizado de solo
  lectura y sin copiar datos privados. Revisar roles de todas las API, no solo
  rutas representativas. Un escaner de imports no sustituye esa revision.
- Revisar avisos de seguridad contra versiones **instaladas** y alcance real;
  el arbol local compartido no esta listo para dictamen de versiones
  desplegadas. El aviso de Sharp se cruzo con un camino de SVG en imagen
  social (A-14); no se intento explotar. Source-map-js aparece por toolchain,
  sin entrada de source maps de cliente identificada. No llamar explotable a
  una libreria solo por un reporte automatico.
- Medir p50/p95/p99, errores, bytes y queries para catalogo, checkout,
  pedidos, productos, resumen y webhook; perfiles con comercio grande, varias
  sedes y 20 mesas activas. Los numeros son escenarios de ensayo, no limites
  prometidos. Realtime, FCM, cola de impresion y WebView requieren medicion
  aparte. Indices deben contrastarse con `EXPLAIN` y volumen real.
- Revisar que cron de comprobantes termina backlog; confirmar ejecucion real,
  retencion y recuperacion ante fallo entre Storage y DB.

**Para cerrar la cobertura funcional real:** levantar un entorno de
dependencias propio del worktree o copia aislada y ejecutar lint/build/types
completos. Comparar RLS/migraciones desplegadas y proyectos de entorno,
probar A-05 y A-02 con fallos inyectados y las cuatro modalidades E2E en
staging utilizable. Medir p95 y completar revision manual de cada API/RPC/UI.
No convertir produccion en staging ni equiparar inventario de rutas con
"100% de comportamientos comprobados".
