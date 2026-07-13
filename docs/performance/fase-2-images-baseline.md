# Fase 2 - Optimizacion tecnica de imagenes

Fecha: 2026-07-13, America/Caracas  
Rama: `perf/fase-2-images`  
Alcance: optimizacion tecnica de carga, renderizado y entrega de imagenes.  
No incluye: branding, colores, logotipo, tipografia, composicion, auth, RLS, checkout, modelo de datos de productos ni stash de galeria `product_images`.

## Resumen ejecutivo

Se migraron los usos de `<img>` en componentes React a `next/image` mediante un wrapper con fallback seguro. El foco principal fue catalogo publico, marketplace, miniaturas de producto, logos/portadas de comercios y miniaturas en paneles.

La mejora mas visible esta en `/armario`: antes el LCP era una imagen remota directa de Unsplash y el navegador descargaba cerca de `777 KB` de imagenes en la medicion Playwright contra produccion. En local con `next/image`, la portada pasa por `/_next/image` y el peso de imagenes medido baja a `75 KB`. La medicion exacta en produccion debe repetirse en preview/deploy porque el optimizador de imagenes depende del runtime de Next/Vercel.

## Precondiciones verificadas

- Rama base limpia antes de arrancar: si.
- Fase 1 intacta: si; no se tocaron archivos de APIs admin de Fase 1.
- Branding desaprobado: no incluido; permanece en stash y no se aplico.
- `npm.cmd run lint` inicial: OK.
- `npx.cmd tsc --noEmit` inicial: OK.
- `npm.cmd run build` inicial: OK.

## Inventario inicial de imagenes

| Archivo | Ruta/uso | Tipo de imagen | Problema | Impacto | Solucion aplicada | Riesgo |
|---|---|---|---|---|---|---|
| `src/components/public/StoreBrandHeader.tsx` | `/{storeSlug}` | Portada y logo comercio | `<img>` sin `sizes`; portada LCP | Alto | `next/image` con `fill`, `priority` solo portada, fallback | Bajo/medio |
| `src/components/public/ProductCard.tsx` | `/{storeSlug}` | Miniatura producto | Miniatura podia descargar imagen completa | Alto | `next/image` 76x112, `sizes=76px`, fallback inicial | Bajo |
| `src/components/public/MarketplaceClient.tsx` | `/marketplace` | Imagen comercio | `<img>` remoto sin resize controlado | Medio/alto | `next/image` con `fill` y `sizes` responsive | Bajo |
| `src/components/public/HomeClient.tsx` | `/` | Logos afiliados e imagen delivery | `<img>` sin optimizador | Medio | `next/image` para logo 44px e imagen seccion delivery | Bajo |
| `src/components/public/CartPageClient.tsx` | `/{storeSlug}/carrito` | Miniatura carrito | `<img>` 96px sin optimizador/fallback | Medio | `next/image` 96x96 con fallback | Bajo |
| `src/components/public/StoreHeader.tsx` | Header legacy/public | Portada comercio | `<img>` con `fetchPriority` manual | Medio | `next/image` con `priority`, `sizes=100vw` | Bajo |
| `src/components/panel/ProductManager.tsx` | `/panel/productos` | Previews y miniaturas | Imagenes grandes como preview chico | Medio | `next/image` 56/124/144px segun uso | Bajo |
| `src/components/panel/CatalogManager.tsx` | `/panel/catalogo` | Preview producto | `<img>` sin sizes | Medio | `next/image` con dimensiones declaradas | Bajo |
| `src/components/panel/ConfigManager.tsx` | `/panel/configuracion` | Logo/portada comercio | `<img>` sin fallback | Medio | `next/image` con fallback | Bajo |
| `src/components/panel/PanelStoreIdentity.tsx` | Panel comercio | Logo/cover sidebar | `<img>` sin resize | Bajo/medio | `next/image` con dimensiones | Bajo |
| `src/components/panel/TransportMarketplaceSection.tsx` | Delivery en panel comercio | Logo agencia | Miniatura sin optimizador | Bajo/medio | `next/image` 48px | Bajo |
| `src/components/transport/TransportAgencyPanel.tsx` | Panel delivery | Logo agencia | Logo grande/mini sin optimizador | Bajo/medio | `next/image` 56/144px | Bajo |
| `src/app/api/panel/uploads/route.ts` | Upload producto | Storage object | Sin `cacheControl` explicito | Medio futuro | `cacheControl: "31536000"` para nuevos uploads con path unico | Bajo |
| `src/app/api/transport/agencies/[agencyId]/logo/route.ts` | Upload logo delivery | Storage object | Sin `cacheControl` explicito | Bajo/medio | `cacheControl: "31536000"` para nuevos logos con path timestamp | Bajo |

Resultado de busqueda posterior:

- `rg "<img" src/components src/app`: sin resultados.

## Linea base antes de optimizar

Medicion Playwright contra produccion `https://vendeplus-clean.vercel.app`, mobile Pixel 5, sin credenciales.

| Ruta | Status | FCP | LCP | LCP tag | Imagenes | KB imagen | KB JS | Errores consola |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| `/` | 200 | 5244ms | 5244ms | H1 | 4 | 0* | 159 | 0 |
| `/marketplace` | 200 | 952ms | 952ms | H1 | 4 | 0* | 170 | 0 |
| `/armario` | 200 | 844ms | 940ms | IMG | 7 | 777 | 152 | 0 |
| `/armario/carrito` | 200 | 1336ms | 1336ms | P | 0 | 0 | 158 | 0 |
| `/armario/checkout` | 200 | 1560ms | 1560ms | P | 0 | 0 | 160 | 0 |
| `/panel/login` | 200 | 828ms | 828ms | P | 0 | 0 | 207 | 0 |
| `/admin` | 200 | 768ms | 768ms | P | 0 | 0 | 210 | 0 |
| `/transporte/panel` | 200 | 848ms | 1148ms | P | 0 | 0 | 219 | 0 |

`*` Algunas imagenes remotas no reportan `transferSize` por cabeceras cross-origin; se mantiene el conteo de requests como referencia.

Lighthouse mobile contra produccion:

| Ruta | Performance | FCP | LCP | TBT | CLS | Speed Index | Peso total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 92 | 1228ms | 2668ms | 243ms | 0 | 2326ms | 1145 KB |
| `/marketplace` | 75 | 1187ms | 5776ms | 194ms | 0 | 2500ms | 1122 KB |
| `/armario` | 61 | 1729ms | 8860ms | 435ms | 0.00065 | 4637ms | 1706 KB |

Nota: Lighthouse en Windows emitio warnings `EPERM` al limpiar directorios temporales de Chrome, pero genero JSON y metricas.

## Cambios implementados

### Configuracion `next/image`

Archivo: `next.config.ts`

- Agregado `images.remotePatterns`.
- Supabase Storage se permite solo desde `NEXT_PUBLIC_SUPABASE_URL` y solo bajo `/storage/v1/object/public/**`.
- Unsplash se permite porque el proyecto usa fallbacks remotos existentes.
- No se uso `hostname: "*"` ni `unoptimized` global.
- Formatos habilitados: AVIF y WebP.
- `minimumCacheTTL`: 7 dias.

### Wrapper de fallback

Archivo: `src/components/shared/OptimizedImage.tsx`

- Componente cliente pequeño sobre `next/image`.
- Maneja URL nula/vacia y error de carga.
- Evita loops de error porque al fallar cambia a fallback local.
- Mantiene `alt`, `sizes`, `priority`, `fill`, `width` y `height` del `next/image`.

### Migracion de imagenes

| Archivo | Imagenes migradas | Estrategia |
|---|---:|---|
| `StoreBrandHeader.tsx` | 2 | Portada `fill+priority`, logo 80px |
| `ProductCard.tsx` | 1 | Miniatura 76x112 |
| `MarketplaceClient.tsx` | 1 | Card comercio `fill`, sizes responsive |
| `HomeClient.tsx` | 2 | Logo 44px, imagen delivery `fill` |
| `CartPageClient.tsx` | 1 | Miniatura carrito 96px |
| `StoreHeader.tsx` | 1 | Hero legacy `fill+priority` |
| `ProductManager.tsx` | 3 | Previews 124/144/56px |
| `CatalogManager.tsx` | 1 | Preview catalogo panel |
| `ConfigManager.tsx` | 2 | Logo/portada configuracion |
| `PanelStoreIdentity.tsx` | 2 | Cover/logo panel |
| `TransportMarketplaceSection.tsx` | 1 | Logo agencia 48px |
| `TransportAgencyPanel.tsx` | 2 | Logo agencia 56/144px |

## Tabla de `sizes`, priority y lazy

| Uso | Sizes | Priority | Motivo |
|---|---|---:|---|
| Portada catalogo `StoreBrandHeader` | `(max-width: 768px) 100vw, 1152px` | Si | Candidata real a LCP en `/{storeSlug}` |
| Header legacy `StoreHeader` | `100vw` | Si | Hero above-the-fold si se usa |
| Logo comercio catalogo | `80px` | No | Visible pero no debe competir con portada |
| Miniatura producto catalogo | `76px` | No | Lista; lazy por defecto |
| Marketplace card | `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw` | No | Cards en grid |
| Logo landing | `44px` | No | Miniatura |
| Imagen delivery landing | `(max-width: 640px) 100vw, 45vw` | No | Seccion baja, fuera de primer viewport |
| Carrito | `96px` | No | Miniatura |
| Panel producto/listas | `56px`, `124px`, `144px` | No | Previews internas |
| Panel configuracion | `112px`, `(max-width: 768px) 100vw, 360px` | No | Preview |

## Resultados despues

Validacion local con `next start` en `http://127.0.0.1:3000`, mobile Pixel 5.

| Ruta | Status | FCP | LCP | LCP tag | Imagenes | KB imagen | KB JS | Errores consola |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| `/` | 200 | 304ms | 304ms | H1 | 4 | 5 | 166 | 0 |
| `/marketplace` | 200 | 316ms | 316ms | H1 | 4 | 37 | 180 | 0 |
| `/armario` | 200 | 236ms | 2192ms | IMG | 8 | 75 | 152 | 0 |
| `/armario/carrito` | 200 | 840ms | 840ms | P | 0 | 0 | 164 | 0 |
| `/armario/checkout` | 200 | 1032ms | 1032ms | P | 0 | 0 | 155 | 0 |
| `/panel/login` | 200 | 388ms | 388ms | P | 0 | 0 | 203 | 0 |
| `/admin` | 200 | 316ms | 316ms | P | 0 | 0 | 205 | 0 |
| `/transporte/panel` | 200 | 172ms | 380ms | P | 0 | 0 | 219 | 0 |

Lighthouse mobile local:

| Ruta | Performance | FCP | LCP | TBT | CLS | Speed Index | Peso total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 89 | 1257ms | 3092ms | 162ms | 0 | 4258ms | 260 KB |
| `/marketplace` | 88 | 976ms | 2948ms | 254ms | 0 | 4141ms | 288 KB |
| `/armario` | 86 | 968ms | 3105ms | 244ms | 0 | 4621ms | 282 KB |

Lectura importante:

- La comparacion Playwright de `/armario` muestra reduccion fuerte de bytes de imagen: `777 KB` antes en produccion vs `75 KB` despues en local optimizado.
- Lighthouse de `/armario` mejora de `61` a `86` y LCP de `8860ms` a `3105ms`, pero la comparacion exacta debe repetirse en preview/produccion porque los entornos no son identicos.
- CLS queda en `0` local posterior.

## Uploads y Supabase Storage

Se auditaron uploads actuales:

- Productos: maximo `2 MB`, MIME permitido `image/jpeg`, `image/png`, `image/webp`, path unico con timestamp + UUID.
- Logo delivery: maximo `2 MB`, MIME permitido `image/jpeg`, `image/png`, `image/webp`, path con timestamp.

Cambio aplicado:

- `cacheControl: "31536000"` en nuevos uploads de productos y logos delivery.

No se cambio:

- Buckets.
- RLS.
- Visibilidad publica/privada.
- Estructura de Storage.
- Modelo de datos.

Pendiente V2:

- Evaluar compresion/redimensionamiento cliente antes de subir en todos los flujos.
- Revisar si conviene usar transformaciones de Supabase Storage segun plan/costo.
- Definir limpieza de imagenes antiguas no referenciadas.

## Comandos ejecutados

```powershell
git status --short --branch
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
rg "<img" src\components src\app
npx.cmd lighthouse@13.4.0 ...
node <script Playwright inline>
```

## Validacion

- `npm.cmd run lint`: OK.
- `npx.cmd tsc --noEmit`: OK.
- `npm.cmd test --if-present`: OK. No existe script formal `test`; npm no ejecuto suite adicional.
- `E2E_BASE_URL=http://127.0.0.1:3000 npm.cmd run e2e:checkout`: OK. Sin `E2E_ORDER_PAYLOAD`, no creo pedidos y solo ejecuto smoke de navegacion.
- `npm.cmd run build`: OK.
- Smoke local Playwright:
  - `/`
  - `/marketplace`
  - `/armario`
  - `/armario/carrito`
  - `/armario/checkout`
  - `/panel/login`
  - `/admin`
  - `/transporte/panel`
- Errores de consola en smoke local: `0`.
- `rg "<img" src/components src/app`: sin resultados.

## Archivos modificados

- `next.config.ts`
- `src/components/shared/OptimizedImage.tsx`
- `src/components/public/StoreHeader.tsx`
- `src/components/public/StoreBrandHeader.tsx`
- `src/components/public/ProductCard.tsx`
- `src/components/public/MarketplaceClient.tsx`
- `src/components/public/HomeClient.tsx`
- `src/components/public/CartPageClient.tsx`
- `src/components/panel/ProductManager.tsx`
- `src/components/panel/CatalogManager.tsx`
- `src/components/panel/ConfigManager.tsx`
- `src/components/panel/PanelStoreIdentity.tsx`
- `src/components/panel/TransportMarketplaceSection.tsx`
- `src/components/transport/TransportAgencyPanel.tsx`
- `src/app/api/panel/uploads/route.ts`
- `src/app/api/transport/agencies/[agencyId]/logo/route.ts`
- `docs/performance/fase-2-images-baseline.md`

## Riesgos y pendientes

- La mejora exacta en produccion debe validarse con preview/deploy porque `next/image` depende del optimizador del runtime.
- Rutas autenticadas reales no fueron medidas sin credenciales de comercio/delivery/founder.
- Si existen URLs de imagen fuera de Supabase Storage o Unsplash en datos reales, Next podria bloquearlas hasta agregarlas explicitamente a `remotePatterns`.
- No se aplico el stash de galeria `product_images`; sigue fuera de esta fase.
- No se sustituyo branding ni assets visuales actuales.

## Plan de rollback

1. Revertir los cambios de esta rama o restaurar desde `main`.
2. Si solo falla una fuente remota, ajustar `images.remotePatterns` con el hostname exacto.
3. Si un componente especifico falla, volver temporalmente ese componente a `<img>` mientras se identifica la URL o dimension conflictiva.
4. No requiere rollback de base de datos; no hubo migraciones.

## Recomendacion de commit

```text
perf(images): optimize responsive image delivery
```
