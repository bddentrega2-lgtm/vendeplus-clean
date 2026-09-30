# Somos 1.3.1: Preview unificado

Actualizacion de instalacion: APK1.3.1 INSTALADA en A34 con install -r Success,
versionCode10 confirmada con dumpsys y permiso de notificaciones concedido.
MainActivity iniciada. Puerto vigente192.168.1.100:43029; anterior45517 usado
durante instalacion via alias mDNS. Sin desinstalar ni limpiar datos. Esto
sustituye los pendientes de instalacion historicos de las secciones siguientes.
Confirmacion posterior del usuario: "suena e imprime perfecto". Quedan
confirmados sonido automatico e impresion en el recorrido probado con1.3.1.
No se recibio foto/codigo para auditar cada campo; no implica validacion de
notificaciones en segundo plano ni de todos los escenarios. Esta confirmacion
sustituye los pendientes historicos de sonido/impresion del documento.

## Alcance

Usuario autoriza unificar y recibir un enlace para probar antes de produccion.
Esta entrega reune lo YA implementado: entrada/diseno/navegacion Android,
ciudad/GPS, controles compactos web/app, campana y megafono, sesiones,
Promos, ubicacion frecuente local, codigos nuevos y formato de comanda.
Incluye la correccion status=received para el aviso automatico de pedidos.

No se implementaron en esta entrega mapa con logos, calificaciones, historial
autenticado ni avisos con la app cerrada. Se informo esta distincion antes del
despliegue. No presentar este Preview como implementacion de todos los deseos
pendientes del producto.

## Enlaces

- Preview: https://vendeplus-clean-c4qa4xd4y-entrega2-s-projects.vercel.app
- Comprador web: https://vendeplus-clean-c4qa4xd4y-entrega2-s-projects.vercel.app/marketplace
- Panel: https://vendeplus-clean-c4qa4xd4y-entrega2-s-projects.vercel.app/panel/login
- Comercio de prueba: https://vendeplus-clean-c4qa4xd4y-entrega2-s-projects.vercel.app/smash
- Deployment READY: `dpl_HqFHskZuAWKUjfAZvUFX8BwdUoCL`.

Excepcion de acceso publico SOLO para este deployment; no cambio de proteccion
global ni de autenticacion Somos. APIs privadas anonimas401 comprobadas.
Produccion inspeccionada antes/despues: `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`,
sin mover dominios oficiales. No se hicieron commits ni push; remoto publico
actual no se uso como supuesto respaldo privado.

## Archivos y configuracion

- `mobile/somos-android/android/app/build.gradle`: versionCode10,
  versionName1.3.1-unified-preview.
- Config Capacitor generada para el origen HTTPS exacto de este Preview, sin
  cleartext ni tokens de bypass. Se restaura al oficial tras copiar artefacto.
- `docs/release-acceptance-2026-09-29.md`: checklist actualizado al nuevo origen.
- Este informe y `SESSION_HANDOFF.md`: continuidad.

La correccion de la campana y sus pruebas provienen del paso anterior documentado
en `docs/mobile-order-alert-fix-2026-09-29.md`. Se verifico por la API de Vercel
que el archivo desplegado usa received y ya no pending.

## Validaciones

- `npm.cmd run build` mediante runner de entorno privado: PASS240/TypeScript.
- Build Vercel: PASS240, READY.
- Unitarios de avisos/config remota repetidos8/8 PASS. Previo a este despliegue:
  contratos80/80, totalunitmoviles18/18, visual29casos + web y Etapa1 PASS.
- Cloud remoto7/7 y cero erroresReact; escrituras bloqueadas. Rutas publicas
  accesibles sin SSO; APIs panel/admin rechazan consultas anonimas.
- Captura marketplace remoto revisada: fotos, cabecera y navegacion renderizan.
- Android: primer intento con Java de Android Studio fallo (major version69).
  Reintento usa Java21 ya instalado, sin modificar dependencias ni Java de app.
- Android assembleDebug PASS95tareas; version/paquete confirmados con aapt.
- City E2E remoto6/6 PASS. `git diff --check` PASS.

## APK verificada

`tmp/mobile-unified/somos-1.3.1-unified-preview.apk`, 5.692.342 bytes.
SHA256: `EC26BF4A76CF04D3773998FB84D1C88342E71171AF12CDE9DBE45D12E643AD2E`.
Paquete com.somosve.app, versionCode10, versionName1.3.1-unified-preview.
ZIP inspeccionado: origen c4qa4xd4y exacto, HTTPS, cleartextfalse y navegacion
limitada a ese hostname. Firma verificada con apksigner, identica a APK1.3.0.
Configuracion generada resync al dominio oficial despues de copiar el APK.
Instalar el artefacto nombrado, no volver a tomar cualquier app-debug.apk.

Instalacion PENDIENTE en A34. El artefacto esta disponible localmente; no fue
subido como descarga publica. Este es APK debug para piloto, no AAB Play Store.
Servidor local auxiliar reiniciado en http://127.0.0.1:3107, launcher4732,
logs tmp/mobile-polish/unified-start*.log; el Preview remoto no depende de el.

## Prueba pendiente y limites

Seguir `docs/release-acceptance-2026-09-29.md`. El navegador permite probar la web;
Promos/ubicacion y experiencia nativa se comprueban en la APK correspondiente.
Sonido Android e impresion no se validan por abrir el enlace en Chrome.

ADB no detecto A34 al revisar. No afirmar APK instalada ni confirmacion audible
del aviso automatico. Actualizar mediante -r, no desinstalar/borrar datos. El
cambio de origen puede exigir login y volver a guardar preferencias locales;
no prometer migracion de cookies/carrito/ubicacion entre Previews.

Usar SOLO Smash (Test) para mutaciones. Preview comparte backend real: pedidos,
pagos y cambios de comercio no son ficticios. No pagar ni solicitar repartidores
externos. No hay migracion ni SQL para esta entrega.

Firebase/segundo plano y cuentas verificadas/calificaciones/historial requieren
un bloque adicional; mapa con logos sigue pendiente. No publicar produccion ni
Play Store hasta cerrar aceptacion manual y aprobar esa publicacion.
