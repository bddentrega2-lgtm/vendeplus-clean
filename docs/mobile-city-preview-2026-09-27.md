# Ciudad automatica en SOMOS Android (preview local)

## Diagnostico y alcance

La APK no declaraba los permisos de ubicacion de Android. Marketplace solicitaba
GPS solo al pulsar un boton y cambiaba exclusivamente a la vista Cerca de ti.
Ademas, el CSS nativo ocultaba todos los bloques fixed directos de Marketplace,
incluido el selector de ciudad; ahora oculta solo el encabezado compacto.

El usuario autorizo que la app reconozca la ubicacion y muestre su ciudad.
Se modifica solo el comportamiento automatico de SOMOS nativo, no el navegador
ni los marketplaces de empresas delivery. Sin despliegue, SQL o migracion.
Sin cambios al servicio, cola, permisos Bluetooth o politicas de impresion.

## Comportamiento

- Primera visita sin ciudad elegida: solicitar permiso del sistema y una posicion.
- Ciudad inferida: filtrar comercios, destacados, ofertas y recien llegados;
  permanecer en Inicio. No excluir comercios de esa ciudad que carezcan de GPS.
- Recordar la ciudad automatica durante dos horas. Al volver despues, actualizar
  la ubicacion. No solicitar seguimiento continuo ni permisos en segundo plano.
- Eleccion manual (incluida Todas las ciudades) tiene prioridad y se conserva.
  Una respuesta GPS tardia no puede sobrescribirla.
- Negacion, timeout, GPS indisponible o resultado incierto: abrir selector manual;
  no repetir automaticamente la solicitud en cada entrada. Usar mi ubicacion
  permite reintentar explicitamente.
- Preferencia nativa en `somos_mobile_v1_market_city`: modo, ciudad y fecha,
  sin almacenar nuevas coordenadas. Cache GPS anterior de navegador sin cambios.

## Limite de precision

Se reutilizan coordenadas y ciudades existentes de los comercios. No hay limites
municipales ni geocodificacion inversa. Es una estimacion, no prueba de residencia.
Se requiere candidato a no mas de20km, precision de posicion <=5km y separacion
entre ciudades mayor que max(1km, precision). En casos ambiguos se pide elegir.
Los datos GPS incorrectos del comercio pueden afectar la estimacion. V2 posible:
limites oficiales o geocodificacion inversa con proveedor/costo aprobados aparte.

## Archivos

- `src/components/public/MarketplaceClient.tsx`: permiso inicial nativo, filtro,
  prioridad manual, reintento y respuesta de GPS invalidada al cambiar ciudad.
- `src/lib/mobile/marketplace-city.ts`: criterio acotado de inferencia.
- `src/app/globals.css`: selector de ciudad visible dentro del APK.
- `mobile/somos-android/android/app/src/main/AndroidManifest.xml`: permisos
  COARSE/FINE, sin BACKGROUND_LOCATION. Capacitor maneja el permiso del sistema;
  se admite ubicacion aproximada. Sin dependencias nuevas.
- `mobile/somos-android/android/app/build.gradle`: versionCode3, 1.1.1-city-preview.
- Pruebas `scripts/mobile-city.*`, regresion stage1 y contratos actualizados.

## Artefacto y prueba

APK: `tmp/mobile-city/somos-1.1.1-city-preview-local.apk`.
SHA256: `43DC708CD0254A335D00BA88526263BD34AD1429016FC818A36D8B0DF61F4F9B`.
Mantiene origen `http://localhost:3107` y requiere servidor local + `adb reverse`.
El codigo Capacitor predeterminado sigue apuntando al dominio oficial.

Instalada en Samsung A34 por45499 con `install --no-streaming -r`: Success;
version3/1.1.1-city-preview confirmada con dumpsys. No se concedio el permiso
mediante ADB: debe responderlo el usuario en la pantalla de Android.

Para probar: abrir SOMOS, permitir ubicacion mientras se usa (aproximada basta
si permite distinguir la ciudad), comprobar ciudad superior y comercios; cambiar
manualmente a otra ciudad y volver. Con permiso negado debe aparecer el selector.
Si ya habia una ciudad elegida, pulsar ciudad > Usar mi ubicacion para actualizar.
No hacer pedidos reales salvo en el comercio de pruebas autorizado.

Rollback de APK: `adb install -r -d` sobre
`tmp/mobile-stage1/somos-1.1.0-stage1-local.apk`, sin borrar datos. La version web
de esta funcion tambien debe revertirse de manera selectiva si se deshace todo;
no restaurar el worktree completo ni el trabajo anterior de impresion.

## Verificacion final

- Build web `npm.cmd run build` mediante runner local: PASS240paginas/TypeScript.
- Android `assembleDebug`: PASS73tareas. APK3 y ambos permisos inspeccionados.
- Contratos/estado/ciudad:90/90 PASS. ESLint archivos tocados: sin errores ni avisos.
- Playwright ciudad:7/7 PASS; regresion Etapa1:16/16 PASS. Se corrigio el test de
  confirmacion para esperar hidratacion de Mesa y seleccion efectiva del pago,
  en lugar de depender de una pausa fija. No se cambio logica de pedidos.
- Capturas auto-city.png (GPS simulado), a34-city.png (telefono real) inspeccionadas;
  selector visible, Maracay seleccionada, sin desbordamiento en viewport390.
- A34: version3 instalada por45499; puerto cambio a33135, se restauro tunel3107 y
  abrio MainActivity. dumpsys confirma permisos COARSE/FINE granted=true por el
  usuario. Captura real muestra Maracay y selector; no se extrajeron coordenadas
  reales ni se simulo GPS en el telefono. Deteccion y casos de error se probaron
  con posiciones simuladas en Chromium, no equivalen a validar limites municipales.
- Sin cambios de produccion, datos de clientes, pedidos reales, migracion o SQL.

Resultados en `tmp/mobile-city/results.json` y `tmp/mobile-stage1/results.json`.
Pendiente para QA fisico: confirmar identificacion al moverse entre ciudades y
comportamiento de ubicacion aproximada/GPS apagado. No hay seguimiento en segundo
plano ni nueva politica de impresion.
