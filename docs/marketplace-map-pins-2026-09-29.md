# Pines con logo en Marketplace - 2026-09-29

## Ajuste vigente: pin compacto y ancho corregido

El usuario reporto Sabore, China Town, Strawberry y Kikis. Se reprodujo un
conflicto real de CSS: Leaflet impone width:auto y padding:0 en las imagenes de
marcadores. Strawberry media 72px de ancho dentro de un circulo de 48px; los
logos verticales quedaban mas estrechos y alineados a la izquierda. No era solo
un problema de margenes del archivo. La regla propia ahora tiene prioridad
acotada al logo, sin alterar mosaicos ni otros elementos de Leaflet.

- Pin44x56 en vez de56x68, circulo40, borde2 y contador20. Ancla22/56 y ficha52px
  por encima; sigue cumpliendo ancho tactil44px.
- Imagen40x40 estable, centrada y proporcional. En el pin se usa cover para
  llenar el circulo sin bandas; la ficha conserva contain para la imagen entera.
  Cover encuadra el centro y recorta bordes del fondo; no modifica los archivos
  ni garantiza mostrar contenido situado en las esquinas de cualquier logo.
- Archivos funcionales: src/components/public/MarketplaceMap.tsx y
  src/app/native-polish.css. Actualizado scripts/buyer-marketplace.e2e.mjs.
  Nuevo scripts/marketplace-map-logos.e2e.mjs; admite --native para simular app.
- Validacion FINAL: npm.cmd run build via mobile-local PASS254/TypeScript;
  ESLint focal y diffcheckPASS; buyer/mapa12/12 y logos4web+4native PASS,
  cero errores de pagina. Capturas de los cuatro originales y pines revisadas,
  mapa320/390/1366, ficha/grupos/zoom/cierre comprobados. Sin pedidos ni
  calificaciones reales; escrituras remotas bloqueadas en las pruebas.
- QA inicial encontro un error del propio selector de prueba: buscar "sabor"
  encontraba Santo Sabor, no Sabore. Corregido buscando "sabore" y prefijo
  de nombre tolerante al acento. La evidencia final corresponde a Sabore.
- Misma URL local http://127.0.0.1:3107/marketplace. Buscar cada comercio, abrir
  Mapa, tocar pin y comprobar ficha. Comparar tamano y centrado de los cuatro.
- Sin migracion, SQL, deploy, commit ni APK. Android probado en modo simulado,
  no en telefono. Produccion y app instalada sin cambios.
- Riesgo/V2: logos muy alargados o con texto en los bordes pueden necesitar
  miniatura de mapa o encuadre por comercio. No se introdujo deteccion de
  pixeles, zoom automatico ni excepciones por nombre de negocio.

El resto del documento conserva el registro de la primera entrega, sustituida
en medidas/encuadre por este ajuste.

## Diagnostico y cambio

El usuario prefiere un pin de ubicacion con el logo dentro del circulo, no un
recuadro. El encuadre automatico anterior tambien producia resultados dispares.
Se sustituye por un pin de 56x68px, logo circular de 48px y punta anclada a la
coordenada. La ficha conserva un logo simple, sin punta; abre encima del pin.
Los grupos mantienen contador naranja y acercamiento al tocar. Se conservan
iniciales si falta el logo o falla la carga. Imagen proporcional sin zoom
calculado por pixeles; no se alteran ni suben archivos originales.

## Archivos

- src/components/public/MarketplaceMap.tsx: pin separado de miniatura, ancla,
  posicion de ficha y espacio al encuadrar mapa; retirada medicion de imagen.
- src/app/native-polish.css: forma, logo circular y contador del pin.
- scripts/buyer-marketplace.e2e.mjs: dimensiones, punta, ausencia de zoom inline
  y ficha sin pin, ademas de pruebas previas.
- Retirados src/lib/marketplace-logo-fit.ts y scripts/marketplace-logo-fit.test.mjs:
  helper y pruebas exclusivos del zoom automatico sustituido.
- SESSION_HANDOFF.md y este documento: continuidad.

## Validacion

- node scripts/mobile-local.mjs build ejecuta npm.cmd run build: PASS,
  TypeScript y 254 paginas generadas.
- ESLint focal: PASS. git diff --check: PASS (avisos LF/CRLF existentes).
- buyer-marketplace.e2e.mjs: 12/12, cero errores de pagina. Mapa en 320,390,1366,
  grupos, ficha, zoom/cierre inmediato y Escape. Casos de cuenta simulados,
  solicitudes de escritura remotas bloqueadas; no se hicieron pedidos reales.
- Capturas mapa escritorio, movil, grupo y ficha inspeccionadas. Browser iab
  indisponible, se uso Playwright del repositorio.

## Probar y alcance

Abrir http://127.0.0.1:3107/marketplace en esta PC, elegir ciudad si corresponde,
entrar a Mapa y tocar un pin o contador. Acercar/alejar y cerrar/reabrir mapa.
El selector de ciudad sigue recordando la eleccion; el filtro delivery sigue retirado.

Sin migracion ni SQL por ejecutar para este ajuste. Sin commit, push, deploy
ni APK nueva. Produccion y telefono no reciben estos cambios todavia.
Codigo compartido web/app; no se reinstalo ni probo fisicamente Android.

Riesgo visual pendiente: margenes blancos y resolucion incluidos en logos
originales pueden hacer que algunos se vean mas pequenos. V2 opcional: preparar
miniaturas de mapa por comercio con encuadre revisado, sin deformar el original.
La activacion de cuentas/Google y su migracion anterior siguen pendientes aparte.
