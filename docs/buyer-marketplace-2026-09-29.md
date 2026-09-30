# Cuentas de compradores y Marketplace - 2026-09-29

Preparacion de activacion: ver `buyer-preview-readiness-2026-09-29.md`.
Se corrigio la migracion pendiente para validar membresias por user_id: la
columna store_users.email no existe en la base real. SQL ya aplicado SOLO en
somos-buyer-staging (xpqmmdmixpyqruykkbkf), nuevo proyecto Free con datos
ficticios; 12 escenarios transaccionales reales PASS y revertidos. Google ya
habilitado; preview aislado READY en vendeplus-clean-azxcbptg7-entrega2-s-projects.vercel.app,
con 11 pruebas readonly cloud PASS. Usuario confirma login Google real web correcto
tras corregir el secreto; luego confirma compra/historial/rating del pedido demo.
Nueva observacion opcional500 implementada con migracion adicional SOLOstaging;
preview vigente erpb4otzj READY con 11 smokecloud y UIobservacion PASS.
Google stage ahora regresa al nuevo origen. Prueba humana de observacion y APK
nueva pendientes; usar /mi-cuenta del preview erpb4otzj, no el anterior.
Produccion intacta. Las secciones
inferiores conservan el historial previo a esta preparacion.

Actualizacion vigente: el usuario retiro el filtro de empresa delivery y pidio
seleccion inicial de ciudad una sola vez, recordada localmente. Ver
`marketplace-city-entry-2026-09-29.md`; las menciones al filtro mas abajo describen
la entrega anterior, no una funcion que siga visible.

## Alcance y estado

Implementacion local en `.fee-billing-prod`. El usuario aprobo Google, historial,
calificaciones, mapa con logos y filtro por empresa de delivery. Solo identifica
la base actual: NO se aplico SQL remoto, NO se desplego ni se modifico produccion.
La APK instalada sigue siendo 11 / 1.3.2-profile-controls-preview.

## Funcionamiento

- Marketplace: filtro de aliados activos combinado con ciudad, categoria y busqueda.
  Lista, ofertas y mapa comparten los filtros. Se conserva el respaldo Entrega2
  usado por el directorio existente, sin crear asociaciones.
- Mapa: Leaflet y mosaicos OpenStreetMap con atribucion; logos reales, iniciales
  si falta imagen, agrupacion de comercios cercanos y acceso al catalogo.
  No inventa coordenadas; informa cuantos comercios no tienen ubicacion.
- Mi cuenta: acceso Google, cierre de sesion, historial paginado de 20 pedidos,
  productos/opciones congelados, total y estado. Disponible desde Marketplace web
  y desde Mis datos en la app. Nombre, telefono, cedula y ubicacion siguen siendo
  datos locales: esta entrega NO los sincroniza entre dispositivos.
- Calificacion de 1 a 5 estrellas, una por pedido completado, editable por su comprador.
  No se permiten calificaciones del propio comercio. Promedio publico sin identidades.
- Comprar como invitado sigue permitido. Pedidos antiguos de invitados no se asignan
  por telefono, correo o cedula. Solo se vinculan nuevas compras autenticadas.

## Seguridad y persistencia

Sesion de comprador separada de la del panel: `somos_buyer_auth_v1`, OAuth PKCE.
El servidor verifica el token con Auth, correo confirmado y proveedor Google;
nunca acepta identidad enviada en el cuerpo. Historial privado sin cache,
filtrado por propietario y comercio, sin direcciones, telefonos ni comprobantes.

La nueva funcion de pedidos envuelve `create_order_atomic` y vincula al comprador
en la misma transaccion. Un reintento no puede apropiarse de pedidos de invitados
o de otro comprador. Se preservan calculos, inventario e idempotencia existentes.
Tablas nuevas con RLS y acceso solo servidor; funciones sin permisos anon/authenticated.

## Archivos

- `src/lib/buyer/*`, `src/components/buyer/*`: acceso, retorno, cuenta y promedios.
- `src/app/mi-cuenta/page.tsx`, `src/app/auth/buyer-callback/page.tsx`.
- `src/app/api/buyer/{orders,reviews}/route.ts`.
- `src/lib/marketplace-directory.ts`, `src/app/api/marketplace/{directory,ratings}/route.ts`.
- `src/components/public/{MarketplaceClient,MarketplaceMap,StoreBrandHeader}.tsx`.
- `src/components/mobile/NativeExperience.tsx`, `src/app/native-polish.css`, `src/types/index.ts`.
- `src/app/globals.css`, `package.json` y lock: Leaflet.markercluster 1.5.3 y tipos 1.5.6.
- `src/app/api/orders/route.ts`, `src/lib/server/create-order-atomic.ts`, `src/lib/supabase/orders.ts`.
- Android: `SomosBuyerAuthPlugin.java`, registro en `MainActivity.java` y retorno en `AndroidManifest.xml`.
- Pruebas: `scripts/buyer-api.test.mjs`, `scripts/buyer-accounts.db.test.mjs`,
  `scripts/buyer-marketplace.e2e.mjs`; auditoria en `scripts/api-guard-contracts.mjs`.
- SQL pendiente: `supabase/migrations/20260929193000_buyer_accounts_and_reviews.sql`.

## Activacion pendiente (NO ejecutada)

1. Revisar y aprobar el SQL aditivo y un entorno para probarlo. Preferible Supabase
   separado; si se usa la base actual, respaldo y autorizacion explicita antes de aplicar
   SOLO esta migracion, sin enviar migraciones acumuladas del worktree.
2. Google figura habilitado en la consulta de solo lectura a Auth. Falta verificar
   y configurar las URL de retorno exactas: origen de prueba `/auth/buyer-callback`,
   futuro origen oficial `/auth/buyer-callback` y `com.somosve.app://buyer-auth`.
3. Crear Preview limpio, verificar CSS compilado y datos antes de promover nada.
4. Preparar APK nueva con retorno Google e instalar sin borrar datos.
5. Probar Google real, cancelacion, retorno con app abierta/cerrada, nueva compra
   autenticada, historial, pedido completado y calificacion; verificar otra cuenta
   y compra invitada. La autenticacion real NO esta validada por los mocks.

No publicar este lote de cuentas sin SQL: el pedido autenticado requiere el nuevo
RPC y fallaria si no existe. Mapa/filtros funcionan leyendo las tablas existentes.

## Validacion reproducible

`node scripts/mobile-local.mjs build` ejecuta `npm.cmd run build` con entorno en memoria.
ESLint focal y `git diff --check`. Java21: `:app:compileDebugJavaWithJavac`.
No se construyo ni instalo una APK nueva.

Pruebas de PostgreSQL local aislado (no Supabase):

```powershell
npm.cmd install --prefix tmp/buyer-db-test --no-package-lock --no-save --ignore-scripts @electric-sql/pglite@0.5.8
node --test scripts/critical-contracts.test.mjs scripts/mobile-stage1.test.mjs scripts/mobile-city.test.mjs scripts/mobile-cloud.test.mjs scripts/mobile-buyer-alerts.test.mjs scripts/buyer-api.test.mjs scripts/buyer-accounts.db.test.mjs
```

La suite ejecuta la migracion real en PostgreSQL WASM. La funcion antigua de pedidos
esta simulada: esto verifica el nuevo envoltorio, propiedad, reviews y permisos,
NO sustituye una prueba integral de inventario en Supabase de pruebas.
Root package.json/lock no cambiaron por esta dependencia temporal de PostgreSQL;
solo se agregaron las dependencias de agrupacion de marcadores.

Agrupacion basada en la [documentacion oficial de Leaflet.markercluster](https://github.com/leaflet/leaflet.markercluster),
sin un algoritmo cartografico propio. Npm audit despues de instalar: 0 vulnerabilidades.

Pruebas visuales: `node scripts/buyer-marketplace.e2e.mjs` contra localhost:3107.
Mapa con datos publicos; historial y calificaciones con respuestas simuladas.
Mutaciones remotas bloqueadas. Capturas en `tmp/buyer-marketplace`.
Navegador integrado no disponible; se usa Playwright del repositorio.

Resultados finales: 111/111 pruebas unitarias/contratos/DB; 13/13 escenarios nuevos
de navegador, 30/30 polish y 16/16 stage1. Sin errores React. Build final: 250 paginas,
TypeScript OK, ESLint focal OK, diff check OK. Capturas revisadas en 320/390/1366px.
La prueba PKCE nativa verifica URL y desafio generados, no abre ni autentica en Google.

Servidor local disponible en http://127.0.0.1:3107/marketplace (solo esta PC).
Prueba manual segura ahora: elegir ciudad/empresa, abrir mapa, tocar grupo, tocar
comercio y volver; revisar Mi cuenta sin completar Google ni crear pedidos reales.
No hay Preview cloud nuevo ni APK de este lote.

## V2

Sincronizacion de Mis datos, flujo de eliminacion de cuenta/datos antes de Play Store,
moderacion/denuncia de calificaciones, control antifraude adicional y notificaciones
con app cerrada quedan fuera. Sin cambios a impresion ni sonido de pedidos.

## Ajuste posterior: moto y logos

Peticion: icono de moto en empresas delivery y logos mas legibles dentro del mapa.
Se uso Motorbike de Lucide en filtro y tarjetas del Marketplace, comun web/app.
Los logos originales de comercios y empresas NO se reemplazaron.

Diagnostico: marcadores de 44px, borde de 2px y margen blanco/transparente dentro
de algunos archivos. Marcadores ahora de 52px, borde de 1px; encuadre proporcional
segun margenes vacios, medido con una muestra de hasta 128px, aumento limitado a
2.5x y cache de 128 imagenes. No hay edicion ni subida de originales. Contadores
permanecen fuera del area recortada y se adapto la separacion de los grupos.

Archivos funcionales: `MarketplaceClient.tsx`, `MarketplaceMap.tsx`,
`native-polish.css`, `src/lib/marketplace-logo-fit.ts`. Pruebas:
`scripts/marketplace-logo-fit.test.mjs` y `scripts/buyer-marketplace.e2e.mjs`.

Validacion de este ajuste: 4/4 unitarias, 13/13 buyer E2E, 30/30 polish;
capturas 320/390/1366 revisadas, sin errores React; build250/TypeScript, ESLint
focal y diff check OK. Sin nueva migracion ni SQL. No publicado ni instalado.

Como probar: recargar localhost:3107/marketplace, revisar moto del filtro,
abrir Mapa, acercar grupos y tocar comercios para comparar sus logos.
Limite conocido: archivos externos que no permiten leer pixeles mantienen su
imagen completa, igualmente en el marcador mayor. No se promete normalizar
cualquier fondo/color. V2: encuadre manual al cargar un logo, solo si se necesita.
