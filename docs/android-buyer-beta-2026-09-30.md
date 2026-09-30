# Beta Android de compradores

## Beta 3 instalada

- Paquete: `com.somosve.app.staging`.
- Version: `1.4.0-buyer-beta.3` (`versionCode 14`).
- Preview: `https://vendeplus-clean-elwro4ama-entrega2-s-projects.vercel.app`.
- APK: `tmp/buyer-staging/android/somos-pruebas-1.4.0-beta3.apk`.
- SHA-256: `58AF96060AABDB914BECCEA5FE61C76B670EAB7797E3876FA421B8990765F58C`.
- Instalada como actualizacion en A34, conservando datos de la beta. La app normal no fue modificada.

## Eliminacion aceptada en Android

Usuario confirma que elimino una cuenta desde Somos Pruebas beta2 y que todo
funciono correctamente. Aceptacion humana del recorrido real; no fue una prueba
simulada ni una eliminacion ejecutada por herramientas. No se recopilo identidad
de la cuenta ni se intento recuperarla. Entorno exclusivo XPQM; produccion y
Somos normal intactos. Queda cerrado el pendiente tecnico de eliminacion.

Pendientes antes de piloto/Play Store: invitado no reclamable, aislamiento al
crear/reingresar con otra cuenta, idempotencia ante reintentos, politica de
privacidad/Data Safety y version unificada con prueba de sonido/impresion.

## Beta 2: eliminacion de cuenta

Actualizacion instalada en A34: `Somos Pruebas` versionCode13,
`1.4.0-buyer-beta.2`. APK:
`tmp/buyer-staging/android/somos-pruebas-1.4.0-beta2.apk`, SHA256
`B9AEF84761C4791DE1A4BDFFEBCFC861FC7FE02E48F6943DC79AF74D2B5E4D9F`.
Instalacion `adb install -r` Success y arranque WARM Statusok. Conserva
firstInstall de beta1. Somos normal continua code11/1.3.2 con lastUpdate intacto.

Preview vigente: https://vendeplus-clean-fws9sx7wu-entrega2-s-projects.vercel.app,
deployment `dpl_BAUyZ9N9CDgSpsPZo7Xzioaa9MiS`, READY/shared y no productivo.
Produccion continua `dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1`.

Mi cuenta muestra `Eliminar cuenta`; el recurso externo publico es
`/eliminar-cuenta`. Exige sesionGoogle y escribir `ELIMINAR`. El endpoint valida
identidad server-side, limita intentos y bloquea usuarios con acceso a comercio,
delivery o solicitudcomercio activa. La eliminacion Auth borra sesiones, vinculos
de historial y reviews por cascada; conserva pedidos como registro del comercio.
No probar sobre una cuenta que se quiera conservar. Para QA destructiva usar una
tercera cuenta desechable y confirmar logout/reingreso sin historial.

QA: 15 pruebas API/PostgreSQL local PASS, incluyendo cascada y orden preservada;
build Next PASS116/TypeScript; Gradle110tasks PASS; E2E borrado local/cloud y
11 smokecloud PASS. RecursoexternoHTTP200 y DELETEanonimo401. La prueba UI simula
el DELETE para no borrar usuarios humanos. Sin migracion/SQL nuevo.

Google Play exige una ruta interna y recurso web externo para solicitar borrado,
ademas de eliminar datos asociados y explicar retenciones legitimas. Esto cubre
el mecanismo tecnico, pero aun faltan politica de privacidad final y declaraciones
Data Safety antes de afirmar cumplimiento completo:
https://support.google.com/googleplay/android-developer/answer/13327111
https://support.google.com/googleplay/android-developer/answer/10144311
Supabase: https://supabase.com/docs/guides/auth/managing-user-data

## Instalada en A34

Actualizacion humana: usuario confirma "todo ok" al recorrido inicial Android,
pero no encuentra calificar. Consulta readonly: SO-0929-465966 completed con
rating5. El historial lo muestra como "Tu calificacion", debajo del total;
solo pedidos completados propios, no ficha del comercio. Aun pendiente aclarar
en que pantalla lo busca/captura; ADB44323 ahora offline. Sin cambios de codigo
ni datos para este diagnostico.

Conexion efectiva 192.168.1.103:44323, modelo SM-A346M. Puerto36325 anterior
quedo offline antes de instalar. APK verificada por hash e instalada con Success
como com.somosve.app.staging, codigo12/1.4.0-buyer-beta.1. Arranque frio Statusok.
Somos normal conserva codigo11/1.3.2 y lastUpdateTime2026-09-29 14:53:11, igual
antes/despues; no se borro ni actualizo ese paquete ni sus datos.

Usuario llego a consentimientoGoogle del entorno XPQM. Se dejo el consentimiento
en sus manos; regreso a la app, sesion/historial y resto de pruebas fisicas aun
pendientes de confirmacion. Captura temporal no conservada para no guardar datos
de cuenta. Sin nuevo codigo/build/migracion/SQL ni cambios productivos al instalar.

## Objetivo y diagnostico

Usuario acepta observaciones y autoriza avanzar con la beta completa. La web ya
usa Supabase XPQM aislado, pero el A34 conserva APK11 /1.3.2 que imprime y suena.
Actualizar ese paquete mezclaria la vinculacion nativa anterior con otra base.
Se elige app separada `Somos Pruebas`, `com.somosve.app.staging`, version12 /
1.4.0-buyer-beta.1. La app anterior no se desinstala, actualiza ni borra.

## Cambios

- Identidad staging opt-in en server-config.ts y capacitor.config.ts.
- Gradle verifica identidad/origen; staging bloqueado para release, sin aplicar
  Google Services productivo. Version/nombre anteriores conservados en modo normal.
- Manifest usa etiqueta y esquema de retorno por applicationId.
- SomosBuyerAuthPlugin informa su callback y valida host Supabase exacto por modo,
  HTTPS, proveedor Google, callback propio y PKCE S256.
- client.ts obtiene el callback nativo y rechaza retornos de otra instalacion.
- Ops Supabase amplia SOLO allowlist staging con callback del paquete de pruebas.
- Nuevo build-buyer-staging-apk.ps1: build reproducible con Java21, preview aislado,
  APK y hash; sin instalacion automatica ni secretos en argumentos/APK.
- Tests: buyer-native-auth.test.mjs, mobile-cloud.test.mjs y mock nativo E2E.

Sin nueva migracion/SQL en esta etapa. Produccion no se publica ni se modifica.
Las migraciones buyer/observacion anteriores siguen aplicadas SOLO en staging.

## Prueba fisica pendiente

1. Abrir Somos Pruebas y confirmar ciudades/comercios Demo; Somos normal conserva
   la configuracion de impresion anterior. No vincular una impresora real a la beta.
2. Elegir ciudad, cerrar/reabrir y comprobar que se recuerda; cambiarla arriba.
3. Ver mapa, logos y promociones; probar permiso de ubicacion aceptado/rechazado.
4. Ingresar con Google desde Mi cuenta, volver a ESTA app y verificar historial
   del mismo comprador. Cancelar un intento y luego reintentar.
5. Crear pedido Retiro/Efectivo ficticio, comprobar total y una sola creacion.
   No realizar pagos ni enviar pedidos por WhatsApp a comercios reales.
6. Comprobar estrellas/observacion del pedido demo completado; guardar y recargar.
7. Cerrar sesion, entrar con segunda cuenta y confirmar que no ve pedidos ajenos.
   Comprar como invitado y comprobar que no se apropia luego de ese pedido.
8. Probar boton Atras, teclado, reapertura y recuperacion al perder internet.

No hay FCM configurado para el paquete de pruebas ni panelcomercioDemo asignado.
No afirmar notificacion en segundo plano/impresion verificadas en esta nueva APK.
La validacion operativa con pedido real va en una etapa posterior controlada.

## Antes de produccion y Play Store

- Aceptacion fisica Android y prueba manual de segunda cuenta.
- Validar eliminacion con cuenta desechable; cerrar politica de privacidad,
  retencion, permisos y formulario Data Safety antes de presentar la app.
- Release firmado, distribucion de prueba, respaldo y plan de retorno.
- Moderacion/respuestas de comercio y sincronizacion de perfil quedan para V2.

## Entrega y validacion

21 pruebas Node/PGlite PASS, incluyendo autenticacion nativa y aislamiento de callback.
Build web aislado npm.cmd run build PASS114/TypeScript. ESLint focal, sintaxisPS,
diffcheck y escaneo documental PASS. Marketplace/buyer E2E local PASS, 11 smokecloud
PASS y observacion UIcloud PASS. Sesion nativa simulada, no loginGoogleAndroid real.
Browser integrado indisponible tras bootstrap; pruebas con Playwright del repo.

Preview READY y compartido SOLOdeployment dpl_AMspT5SzTkgesnbwTjHpVT4UM6Ut:
https://vendeplus-clean-5f6wylb0i-entrega2-s-projects.vercel.app . Googlestage
regresa al nuevo origen o a callbacknativo permitido. Produccion sigue
dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1, sin modificar Google productivo.

Gradle clean assembleDebug testDebugUnitTest PASS, 110 tareas. APK debug disponible:
`tmp/buyer-staging/android/somos-pruebas-1.4.0-beta1.apk`.
SHA256: `0DDC249A6FF7D99C5B67E4D69D59E7116899FBC961FBDEC5974846EEF60C88DD`.
AAPT confirma paquete/nombre/version/callback/provider propios, minSDK24 y
target36; apksigner confirma firmaV2 valida. ZIP confirma origenHTTPS correcto
y ausencia de archivos .env/keystore/google-services.json; recursos sin proyecto
Firebase. La tarea verifyReleaseOrigin bloquea staging como se esperaba.
Assets locales quedan en modo staging; no compilar otro modo sin resync.

Servidor web local restaurado en http://127.0.0.1:3107/mi-cuenta (launcher14868,
logs tmp/buyer-staging/start-android-beta*). No usar mobile-local con este build.
ADB sin dispositivos tambien al cierre, sin AVD configurado. No instalada ni
probada fisicamente: falta USB o direccion actual, solicitados por pregunta
asincrona. No reutilizar puertos anteriores ni tocar datos de Somos normal.
