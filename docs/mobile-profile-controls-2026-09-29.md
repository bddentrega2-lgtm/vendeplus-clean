# Somos 1.3.2 - Mis datos, ubicacion y avisos revisados

Actualizacion posterior: ajustes aprobados y publicados en www.somos-ve.com
por autorizacion "procede". Deployment final dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1.
Ver production-release-1.3.2-2026-09-29.md para incidente de cache resuelto,
validaciones y rollback. La APK11 conserva su origen Preview; no Play Store.
El estado siguiente describe la entrega Preview original.

## Estado y diagnostico

Usuario confirma Promos por ciudad, sonido automatico e impresion en el recorrido
probado con 1.3.1. Reporta ubicacion dificil de guardar, mensaje duplicado,
falta de cedula en Mis datos, accion visual debajo del precio y campana roja
despues de abrirla. El editor dependia del punto/referencia del checkout y la
campana contaba pendientes, no avisos sin revisar.

Preview READY publico solo para este deployment:
https://vendeplus-clean-9f7uno4fk-entrega2-s-projects.vercel.app
ID: dpl_9dRv22Ui3nSRFkjYtKJGSmPNp636.

Produccion inspeccionada: sigue dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi.
Sin promocion, commit, push, migracion ni SQL. No se crearon pedidos de prueba
ni se cambiaron pagos, configuracion comercial o estados de pedidos.

## Cambios y archivos

- `src/components/mobile/FrequentLocation.tsx`: editor independiente y
  colapsado en Mis datos. Agregar, guardar, editar, cancelar y eliminar.
  Checkout solo ofrece usar la ubicacion ya guardada.
- `src/components/mobile/NativeExperience.tsx`: cedula opcional V/E/J en perfil.
- `src/lib/customer-browser-profile.ts`: normalizacion compartida de cedula;
  omitirla conserva el dato previo, borrarla expresamente lo elimina. Evento
  local de actualizacion del perfil.
- `src/components/public/CheckoutForm.tsx`: recupera nombre/telefono y cedula
  cuando el comercio la pide o para envio nacional. No sobrescribe campos
  ya completados. No borra la cedula al comprar donde no la requieren.
- `src/components/public/LocationPicker.tsx`: modo ubicacion personal sin
  marcador ficticio de comercio. Mensaje unico: Ajusta el pin si necesitas precisar.
- `src/components/public/ProductCard.tsx`, `src/app/globals.css`: precio a la
  izquierda y accion a la derecha en vista visual. Icono + con nombre accesible
  y tooltip para Anadir; Cerrado/Agotado siguen escritos. Precio USD sin corte
  en dos lineas en los productos probados a 320/390px.
- `src/app/native-polish.css`: editor, selector de cedula y contraste GPS.
- `src/components/panel/PanelNotifications.tsx`, `src/lib/mobile/order-alerts.ts`:
  IDs revisados locales por cuenta y comercio, acotados a 500. Abrir la campana
  marca los avisos mostrados; nuevo pedido vuelve a mostrar rojo. No cambia
  estado del pedido ni la logica de sonido/impresion. Limpieza privada al salir.
- `mobile/somos-android/android/app/build.gradle`: versionCode11,
  versionName1.3.2-profile-controls-preview. Sin cambios funcionales Java.
- Pruebas: `scripts/mobile-buyer-alerts.test.mjs`,
  `scripts/critical-contracts.test.mjs`, `scripts/mobile-polish.e2e.mjs`.
- Documentacion: este informe, SESSION_HANDOFF.md y checklist de aceptacion.

## Verificacion

- npm.cmd run build via runner privado local: PASS, TypeScript, 244 paginas.
  Build Vercel PASS244. Runner no imprime ni copia credenciales.
- Contratos80/80, unitarios comprador/avisos6/6, otros moviles14/14: PASS100.
- ESLint de archivos cambiados y git diff --check: PASS.
- E2E mobile-polish final: PASS30 casos/capturas app y 6 capturas web;
  sin errores React. Guardar/recuperar/editar/cancelar/eliminar ubicacion,
  perfil con cedula persistente, reutilizacion checkout, geometria precio/boton,
  contraste GPS, badge revisado/nuevo y aislamiento de comercio.
- Capturas finales inspeccionadas: catalog-grid-320, frequent-location-editor,
  frequent-location-profile. Sin desbordes horizontales.
- E2E Etapa1 PASS antes del ultimo ajuste de icono/contraste; no repetido luego.
- Cloud candidato final PASS7 recorridos, sin errores React; APIs privadas401,
  escrituras bloqueadas. No prueba pedidos reales ni sonido fisico nuevo.
- Navegador integrado no disponible (iab); usado Playwright existente del repo.
- Gradle assembleDebug PASS73 tareas con Java21. Firma valida e igual a 1.3.1.
- APK verificada: HTTPS exacto del nuevo Preview, cleartext false, un host
  permitido. Config generado restaurado a dominios oficiales tras copiar APK.

## APK instalada

Archivo: `tmp/mobile-profile-controls/somos-1.3.2-profile-controls-preview.apk`.
Tamano: 5692346 bytes.
SHA256: FB84007427496AC1428877CE8FFDB1D11925E35E8D9DDB4227A457BEC412CCC4.

ADB A34 SM_A346M/RFCW80HFA5K por alias mDNS reconocido: install --no-streaming -r
Success. dumpsys confirma versionCode11/versionName1.3.2-profile-controls-preview,
POST_NOTIFICATIONS granted=true; inicio MainActivity aceptado. No desinstalacion,
limpieza de datos, cambio de permisos ni nueva vinculacion de impresora.

Servidor local: http://127.0.0.1:3107, launcher17512,
logs tmp/mobile-profile-controls/start*.log. El Preview no depende de este servidor.

## Aceptacion manual

2026-09-29: usuario confirma "revise todo ok" tras revisar los ajustes1.3.2.
Aceptados Mis datos/ubicacion/cedula, disposicion de acciones y campana en el
recorrido probado. No equivale a autorizacion de produccion o Play Store ni
acredita escenarios adicionales. Checklist conservado como referencia:

1. Mis datos: guardar nombre, telefono y cedula. Agregar ubicacion, completar
   nombre/direccion, elegir punto GPS/mapa y pulsar Guardar ubicacion. Cerrar y
   volver para comprobar persistencia. Probar editar y cancelar.
2. Borrador de compra con Delivery: Usar Casa completa punto/referencia. No hay
   controles para guardar ubicacion en el checkout. Nombre y telefono recuperados;
   en comercio autorizado que pida cedula comprobar autocompletado sin confirmar.
3. Catalogo visual: + o Cerrado a la derecha del precio, sin tapar nombre/importes.
4. Campana: abrir y cerrar elimina rojo de los avisos revisados. Un pedido nuevo
   controlado en Smash(Test) debe volver a mostrarlo; panel visible y baseline20s.
   Sonido/comanda unica siguen pendientes de regresion humana de ESTA version.
5. Sin pagos reales ni repartidores externos. El Preview usa backend real.

## Limites y V2

Perfil, ubicacion y lecturas son locales por dispositivo/origen; no cuenta
sincronizada. Cambio de URL puede requerir login y guardar preferencias de nuevo.
Conservar 1.3.1 y su deployment para reversibilidad; no borrados.
Avisos siguen limitados al panel visible. Firebase/segundo plano, mapa de comercios
con logos, calificaciones e historial autenticado siguen pendientes, no incluidos.
No publicar produccion sin aceptacion manual y autorizacion expresa.
