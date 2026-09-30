# Marketplace: ciudad inicial y retiro de filtro delivery

## Solicitud vigente

Antes de explorar, elegir ciudad o usar ubicacion. Pedirlo solo cuando no existe
una seleccion guardada; despues entrar directamente y cambiarla desde arriba.
El usuario retiro expresamente el selector/filtro de empresa delivery.

## Diagnostico y cambios

- Antes, web mostraba todas las ciudades por defecto; Android podia solicitar
  GPS automaticamente. Se unifico web/app/marketplaces aliados: GPS solo al tocar
  Usar mi ubicacion y seleccion manual siempre disponible.
- Sin ciudad guardada, el catalogo no se muestra detras de la ventana inicial.
  No hay cierre ni opcion Todas en ese primer paso. El acceso de comercios sigue
  disponible. Con una ciudad guardada, se restaura directamente sin mostrar
  fugazmente el selector: el render inicial es una carga neutral.
- Ciudad persistida localmente, no coordenadas GPS nuevas. Se respetan ciudades
  concretas guardadas anteriormente, comprobando que existan en el catalogo.
  El antiguo valor Todas por defecto no cuenta como haber elegido una ciudad.
- Desde la cabecera se puede cambiar ciudad o elegir explicitamente Todas las
  ciudades; esa decision tambien queda guardada y se etiqueta correctamente.
- GPS denegado, impreciso, fuera de cobertura, no disponible o agotado no inventa
  ciudad ni reintenta permisos automaticamente. Una eleccion manual invalida
  cualquier respuesta GPS pendiente. La ciudad seleccionada gobierna listado,
  productos/ofertas y mapa, tambien en la web cuando cambia desde Cerca de ti.
- Retirados selector, estado y filtro por empresa delivery en listado/mapa.
  El directorio publico ya no consulta ni devuelve asociaciones de empresas;
  conserva solo promedios de calificaciones. No se modificaron configuraciones,
  relaciones, tarifas ni operaciones de delivery existentes. Icono moto de las
  tarjetas y logos ampliados del mapa se conservan.
- QA detecto un callback tardio de zoom de Leaflet al cerrar el mapa; se desactivo
  esa transicion y se protegio el observer durante desmontaje. Pan/zoom y grupos
  siguen operativos, sin usar APIs privadas de Leaflet.

## Archivos de esta entrega

- `src/components/public/MarketplaceCityPicker.tsx` (nuevo).
- `src/components/public/MarketplaceClient.tsx`, `MarketplaceMap.tsx`.
- `src/app/native-polish.css`, `src/app/api/marketplace/directory/route.ts`.
- `scripts/mobile-city.e2e.mjs`, `buyer-marketplace.e2e.mjs`.
- Fixtures de ciudad ya elegida en `mobile-polish.e2e.mjs`, `mobile-stage1.e2e.mjs`
  y `mobile-cloud.e2e.mjs`; contratos en `critical-contracts.test.mjs` y
  `api-guard-contracts.mjs` ajustados a la nueva ubicacion del dialogo/consulta.
- Este documento, informe buyer-marketplace y `SESSION_HANDOFF.md`.

## Como probar

1. En esta PC, abrir http://127.0.0.1:3107/marketplace en una ventana privada nueva.
2. Elegir ciudad manualmente: aparecen solo sus comercios y ofertas; el mapa
   conserva esa ciudad y no ofrece empresas de delivery.
3. Recargar y volver desde un catalogo: entra directamente, sin repetir la ventana.
4. Cambiar la ciudad desde arriba y recargar: conserva la nueva seleccion.
5. En otra ventana privada nueva, Usar mi ubicacion: aceptar o denegar. Al denegar
   o no poder determinar la ciudad, debe permitir elegirla manualmente.

## Limites y publicacion

Preferencia por navegador/app y origen. Si se borran datos, se usa otra ventana
privada/origen o la ciudad deja de estar disponible, debe elegirse de nuevo.
Almacenamiento bloqueado permite navegar pero no recordar entre visitas.
No se detectan mudanzas ni viajes automaticamente: cambio desde la cabecera.

Sin migracion nueva ni SQL que ejecutar para estos ajustes. Sin deploy, commit,
push o APK nueva; produccion/A34 sin cambios. La migracion anterior de cuentas
comprador sigue pendiente, NO queda autorizada por este ajuste visual.
V2 opcional: sincronizar ciudad entre dispositivos con cuenta, separadamente.

## Validacion final

- `npm.cmd run build` mediante mobile-local: correcto, 250 paginas y TypeScript.
- ESLint focal y `git diff --check`: correctos.
- Contratos/unitarias: 96/96. Ciudad: 12/12. Buyer/mapa: 12/12. Polish: 30/30.
  Navegacion stage1: 16/16. Capturas 320/390/1366 revisadas, sin errores React finales.
- Se comprueba con observador DOM que, al volver con ciudad guardada, el selector
  obligatorio no aparece ni por un instante. GPS simulado: sin permisos reales
  concedidos a esta prueba ni datos de ubicacion del usuario.
- Se conserva bloqueo de mutaciones remotas en pruebas. APIs privadas simuladas.
  No se probo Google real, APK fisica ni despliegue remoto en este ajuste.
- La primera regresion de mapa detecto error Leaflet; se corrigio y la repeticion
  final pasa incluyendo cerrar inmediatamente despues de hacer zoom.
