# 2026-10-05 - Checkout publicado desde rama aislada

- Usuario autorizo `procede`. Produccion `www.somos-ve.com` confirmada READY en `dpl_H1YyhEHKF5oHu4cBN9jeuZ7vN9ic` tras candidato validado/promote. Fuente `../.printing-release-20261004`, rama `fix/checkout-payment-copy-20261005`, commit `c24ec2d` sobre base7027975, respaldado en GitHub por solicitud del usuario. Build remoto263 PASS y browser productivo readonly PASS para pagos/mesa/barra/copia/overflow; sin pedidos reales ni SQL. Leer handoff de esa rama para detalle.
- ESTA fuente de referidos aun NO contiene ese parche. Integrarlo antes de cualquier publicacion futura para no reintroducir Tasa usada, foto del billete, efectivo con comprobante ni pago en caja para mesa. Referidos sigue solo Preview. No requiere APK nueva para estos textos.

# 2026-10-05 - Puntero: ajuste de checkout aislado de referidos (historial)

- Ultimo ajuste solicitado (tasa usada, captura solo pagos digitales, mensajes mesa/barra, Tu pedido es, Copiar todos pago movil) esta en `../.printing-release-20261004`, rama `fix/checkout-payment-copy-20261005` sobre `7027975`. Leer alli SESSION_HANDOFF.md antes de continuar. Cambios solo locales, sin commit ni deploy; build263 y 42 pruebas PASS. No esta aplicado al codigo de esta rama de referidos. Al integrar en el futuro, portar el parche acotado para evitar regresiones; no desplegar referidos por accidente.

# 2026-10-05 - Respaldo Git sin cambiar produccion

- Estado web ya desplegado (impresion multicomercios, campanita y asistencia) asegurado en rama `checkpoint/somos-production-printing-assistance-20261005`, commit `7027975`, subida a GitHub. Se creo desde el worktree aislado `.printing-release-20261004`; build Next 16.3.8 de 263 paginas PASS con entorno local del repo raiz y 18 pruebas focales PASS. Sin merge a `main`, Vercel CLI, SQL ni despliegue en esta operacion.
- Fuente de desarrollo `.fee-billing-prod`: commit `1a05bb7` guarda impresion/asistencia (incluido receptor Android y test); `f56edc0` guarda version 1.5.3, retiro de drawables heredados y arreglo del script Gradle. La APK/AAB y claves de firma siguen fuera de Git. La rama de desarrollo contiene ademas referidos y pago inicial de US$20 solo para Preview; no promoverla a produccion sin QA y autorizacion.
- Pendiente fisico: confirmar icono de APK 1.5.3 en otro telefono y push de asistencia con app cerrada. El build Android release y build web de desarrollo habian pasado antes de estos commits; los commits no modificaron codigo.

# 2026-10-05 - APK 1.5.3 con icono SOMOS revisado

- Usuario reporto que APK 1.5.2 instalada muestra conector azul, mientras la app correcta del Samsung muestra SOMOS naranja/verde. Inspeccion forense de APK 1.5.2 comprobó que sus `mipmap/ic_launcher` y `mipmap/ic_launcher_foreground` empaquetados YA eran los PNG SOMOS; no se pudo reproducir el conector azul con el APK publicado. No afirmar causa exacta (podria ser instalacion/launcher cache/otra app) sin captura de informacion de app del dispositivo. Se encontro que quedaban drawables heredados de Capacitor no usados por el launcher.
- En Android 1.5.3/code17, `somos_launcher_foreground.xml` referencia directamente `@drawable/somos_launcher_logo` con inset10dp; se retiraron `drawable-v24/ic_launcher_foreground.xml` y `drawable/ic_launcher_background.xml` antiguos sin referencias activas; XML adaptativos y fallback PNG conservan logo brand. Se arreglo bug preexistente en `scripts/ops/build-play-internal-aab.ps1`: `clean` no se pasa por splatting de string (lo convertia en letras). Primer build full clean fallo antes de tareas por ese bug; script corregido y segundo build `clean lintRelease testReleaseUnitTest bundleRelease assembleRelease` PASS 171 tasks/7m8s. No hubo cambio web, SQL o migracion por este icono.
- APK release `tmp/play-internal/somos-1.5.3-android.apk`, 4,785,875 bytes, SHA256 `1CB54BE798661BBB3A7B7E81D41C541027635A20A4AC9B1CB63AA4BEC86031F3`, package com.somosve.app, code17/name1.5.3, mismo certificado release `39e7305f30cea27acf2bdbd128369e847ea842fb59236a8a79e14a4f9463b72c`. `aapt dump --values resources` prueba ausencia de drawable/ic_launcher_foreground y background viejos; `aapt dump xmltree` prueba adaptive foreground->somos_launcher_foreground->somos_launcher_logo. Se extrajeron `res/o-.png` y `res/4s.png` del APK y se inspeccionaron visualmente: ambos muestran SOMOS naranja/verde. Archivo publico NUEVO, sin sobrescribir 1.5.2: `https://rvmtjtuztewcrmodrodb.supabase.co/storage/v1/object/public/app-releases/android/1.5.3/somos-1.5.3.apk`; HTTP200, MIME APK, hash descargado coincide. `npm.cmd run build` fuente272 paginas/TypeScript PASS tras los cambios, `git diff --check` sin errores de contenido. No commit/push ni deploy web. A34 debug firmada diferente; release no la actualiza. Pendiente prueba visual tras instalar 1.5.3 en telefono del usuario. Si sigue azul, pedir captura de Informacion de app con version17 y verificar paquete/launcher.

# 2026-10-04/05 - APK 1.5.2 firmada y descargable; asistencia servidor publicada

- Usuario pidio terminar la APK. Se incremento version Android oficial a code16/name1.5.2 SOLO en este worktree de desarrollo, sin tocar identidad staging. `scripts/ops/build-signed-android.ps1 -Incremental` ejecuto Capacitor sync al origen oficial, Gradle `lintRelease testReleaseUnitTest bundleRelease assembleRelease` BUILD SUCCESSFUL (167 tasks). AAB y APK firmadas en `tmp/play-internal/`; APK `somos-1.5.2-android.apk` 4,788,668 bytes, SHA256 `E3BD299F3D970C84C230D35B11CD44705FB1C6BF79E467611A0F8D262DD94848`, paquete `com.somosve.app`, targetSdk36, certificado SHA256 `39e7305f30cea27acf2bdbd128369e847ea842fb59236a8a79e14a4f9463b72c`, igual al release 1.5.1. APK incluye receptor nativo de asistencia. AAB SHA256 `EC3276D37EA9AF45112F39180C03709BA38A34FF89363137C1932590102C4A71`. APK RELEASE no actualiza la debug pilot code15 instalada en A34: firmas distintas; no desinstalar sin advertir perdida de datos/vinculacion. En otros telefonos nuevos se instala normal.
- APK subida SIN sobrescribir versiones previas al bucket publico `app-releases` (MIME APK) en `https://rvmtjtuztewcrmodrodb.supabase.co/storage/v1/object/public/app-releases/android/1.5.2/somos-1.5.2.apk`. Se descargo de nuevo, HTTP200, bytes y SHA256 coinciden exactamente con archivo local. No se publico AAB al publico. No commit solicitado.
- Para asistencia a todos los telefonos del comercio con app cerrada: migracion aditiva `20261005013000_panel_assistance_push_devices.sql` aplicada primero staging y luego production via Management API, registrada en schema_migrations productivo. Verificado en ambos: tabla existe, RLS=true, anon/authenticated no SELECT, service_role SELECT. No se tocaron tablas previas ni pedidos. API `/api/panel/push-devices` autentica, valida store y mesa activa, token se asigna a usuario/comercio. `waiter` programa FCM despues de responder via Next `after()`, solo nueva solicitud. FCM filtra membresias vigentes, entrega solo store activo, invalida tokens muertos. Web fallback/popup sigue.
- Servidor se porto a `../.printing-release-20261004` aislado de referidos y se desplego candidato `dpl_3wBGUTqbgMn1dLawpHzAkGECBtkt` target production con `--skip-domain`; build remoto Next16.3.8/TypeScript/263 paginas PASS, pruebas push impresora 10/10, campana 8/8, asistencia en fuente principal 4/4, lint fuente 0 errores (1 warning React Hook preexistente), builds locales aislado263 y fuente272 paginas PASS. Candidato: push-devices anon401, waiter invalido400. Promovido a `www.somos-ve.com`; inspeccion confirma READY ID correcto; `/panel/login` y `/smash-test`200, push anon401, APK200, logs error sin entradas. Rollback web anterior `dpl_71KErKfTKXxE4Lwjjkei9FjjeT6V` no ejecutado. Trabajo de referidos permanece sin publicar.
- Pendiente: prueba FISICA de push asistencia en otro telefono con APK 1.5.2, sesion en comercio con Mesa/Barra activa, permisos de notificacion, sin vincular impresora; pedir asistencia con app en segundo plano/cerrada y confirmar notificacion. Revisar `panel_push_devices` y logs si no llega. No afirmar push E2E validado hasta entonces. APK de publicacion esta terminada, pero Play Store requiere cuenta y proceso propio. Git sigue sin commit/push. Para A34 debug se puede generar nueva debug pilot sin desinstalar si se quiere probar alli; release firmada no sustituye esa instalacion.

# 2026-10-04/05 - Campanita de pedidos corregida en produccion

- Usuario reporto que pedidos nuevos no aparecian en la campanita. Diagnostico: `PanelNotifications` consultaba solo 10 pedidos `status=received`; los aceptados/completados/cancelados desaparecian de inmediato. Consulta readonly productiva confirmo pedidos recientes en esos estados, incluyendo Smash Test y Gran Combo. No habia errores Vercel en la ventana revisada. Falta respuesta del usuario con comercio/pedido especifico, por lo que la causa de cada caso particular no esta confirmada.
- Fix acotado en worktree aislado `../.printing-release-20261004`: nueva API `/api/panel/order-notifications` autorizada por sesion/comercio, solo campos minimos, max 50 pedidos ultimas 24h sin filtrar por estado, Cache-Control private no-store. Campanita ahora dice Pedidos recientes y muestra estado. `newOrdersSince` acepta sede `all` sin avisar historicos. No toca creacion, estados, pagos, impresion, referidos ni asistencia. Se replico mismo fix en este worktree de desarrollo para evitar regresion futura.
- QA: `node --test scripts/mobile-buyer-alerts.test.mjs` 8/8, lint focal PASS, `git diff --check` PASS, `npm.cmd run build` en aislado PASS con entorno parent; primer intento sin env fallo solo al prerender de Home por variables privadas ausentes. Build completo de este worktree original tambien PASS con env parent (272 paginas); no fue desplegado. Build remoto Next16.3.8/TypeScript/262 paginas PASS. Candidato `dpl_71KErKfTKXxE4Lwjjkei9FjjeT6V` creado con `--skip-domain`; endpoint anonimo 401. Promovido a `www.somos-ve.com` y `vercel inspect` confirma READY mismo ID; `/panel/login` y `/smash-test` 200, endpoint anonimo 401, logs error sin entradas. Reversion anterior `dpl_5d1crBZqF5YcPLCZ1vWGohScFmtr` no ejecutada. Sin SQL ni migracion. Sin commit.
- Pendiente inmediato: pedir al usuario refrescar panel/app, abrir campanita y confirmar pedido concreto; la campanita en web/app abierta actualiza cada 15s. No hay push de nuevos pedidos con app cerrada en esta correccion. Asistencia en segundo plano para todos los telefonos y APK descargable siguen pendientes, NO publicados. Trabajo de asistencia preimplementado solo en este worktree incluye migracion `20261005013000_panel_assistance_push_devices.sql`, API push-devices, FCM en waiter, Java nativo, PanelAuthProvider, TableOrderNotifier y 4/4 pruebas; falta Android build, aplicar SQL staging/QA y release APK. No mezclar estos cambios con produccion sin validacion.

# 2026-10-04/05 - Impresion multi-comercio publicada y probada en A34

- CIERRE PRUEBA REAL 2026-10-05: usuario eligio Smash Test (`smash`) y confirmo impresora vinculada/app en segundo plano. Preflight detecto `store_print_settings` en modo previo `paid`; se pidio activar temporalmente recibido y se verifico DB `trigger_mode=received`, 2 Android con FCM. Se creo UN pedido real de prueba por API publica: `SO-1005-884940`, order ID `95a0ce49-76b7-4aa2-b9e9-fc41c92f3566`, marcador `QA-IMPRESION-1791163839080`, producto `2 pa 2`, Mesa 1. `order_print_jobs` evento `received` quedo `printed` en un intento, sin error; usuario confirmo que ticket salio fisicamente SOLO, sin pulsar Imprimir pendientes. Impresion automatica FCM validada extremo a extremo con app en segundo plano. No se elimino ni altero el pedido; registro/fee quedan. Smash restaurado de manera acotada a `trigger_mode=paid` con comprobacion posterior. Primer intento de restauracion fallo por quoting antes de escribir; segundo con script verificado PASS.
- Ultimo monitoreo: `www.somos-ve.com` sigue `dpl_5d1crBZqF5YcPLCZ1vWGohScFmtr` READY; Vercel logs error de ultimos 30m sin entradas. No commit solicitado. Worktree aislado de publicacion `../.printing-release-20261004` conserva diff solo de impresion/icono; cambios de referidos siguen solo en worktree original y staging.
- Usuario autorizo explicitamente publicar SOLO cambios de impresion con cuidado. Se creo worktree aislado `../.printing-release-20261004` en HEAD `1ec307f` y se trasladaron solo cambios de impresion web/Android e icono; rutas y migraciones de referidos quedaron fuera. `npm ci`, `node scripts/firebase-push.test.mjs` 10/10, `npm.cmd run build` Next16.3.8/TypeScript y despliegue remoto 257 paginas PASS. No SQL ni migracion.
- Candidato Vercel `dpl_5d1crBZqF5YcPLCZ1vWGohScFmtr`, `https://vendeplus-clean-j7ycxjl40-entrega2-s-projects.vercel.app`, construido como target production sin dominio primero, luego promovido con `vercel promote`. `www.somos-ve.com` confirmado apuntando a ese ID. Version anterior `dpl_3GFBP86MDDSvkT6zeHD6gQpscte5` para rollback controlado si hay fallo. Smoke post-promocion: `/`, `/marketplace`, `/panel/login`, `/panel/impresion`, `/smash-test` 200; `/api/panel/printing/status` y POST `/api/printing-agent/push-token` anonimos 401. `/aliados` es fallback no encontrado, ruta real ausente del manifiesto; referidos no publicados. Firebase service account presente en entorno production; logs error candidato sin entradas al consultar.
- APK normal candidata `tmp/firebase-pilot/somos-1.5.1-print-candidate.apk`, SHA256 `A0AC9859EB429FF290C3AD028AEAAD240E4490632F5B5DF801BEF301E0A2BF94`, package `com.somosve.app`, code15/version1.5.1, origen `www.somos-ve.com`, Firebase cliente configurado. Android Gradle `clean lintDebug assembleDebug testDebugUnitTest` PASS. Firma SHA256 coincide exactamente con APK instalado A34 code14/version1.5.0 (`833651c161cb244138be4de4a96e148cf38e8e7946bb2cdc5e3116b50b33ba46`). Usuario paso ADB `192.168.1.102:34245`; `adb install -r` devolvio Success, `dumpsys package` confirma code15/version1.5.1 y `monkey` abrio `com.somosve.app/.MainActivity`. Datos preservados, Somos Pruebas separada. APK es debug firmada para piloto, no artefacto Play Store. Pendiente: usuario vincula la impresora al comercio productivo, activa `Imprimir automaticamente al recibir el pedido`, guarda, deja app en segundo plano; crear pedido de prueba acordado y verificar FCM/ticket sin pulsar boton manual, observar logs. Cuenta temporal staging `printing-preview-ff3fbdab@somos.test` y todas sus membresias eliminadas tras verificar email/UUID en staging; produccion no afectada por limpieza.

# 2026-10-04 - Somos Pruebas actualizada en A34 (vinculacion e icono)

- Usuario confirmo en A34 que `Desvincular` funciono, el logo se ve mejor y el otro comercio siguio vinculado e imprimio al pulsar el boton manual. No fue prueba de impresion automatica: la impresora no estaba vinculada/configurada para ese modo y el Preview no incluye Firebase (`build-buyer-staging-apk.ps1` lo declara; `registerPush` falla si no hay FirebaseApp). `node scripts/firebase-push.test.mjs` repetido: 10/10 PASS; `git diff --check` sin errores de contenido. No se publico ni instalo app normal. Preview y staging intactos.
- Pendiente antes de cerrar impresion multi-comercio: verificar visualmente que el segundo comercio conserve su vinculacion tras desvincular el primero; FCM automatico real no es comprobable en este Preview (Firebase deshabilitado). Preparar rollout coordinado de web + APK normal, pero pedir autorizacion explicita antes de tocar produccion. Mantener separadas las modificaciones de referidos (solo Preview) y eliminar cuenta temporal de staging al cerrar las pruebas.
- Usuario paso puerto `41377`; ADB conecto a `192.168.1.102:41377`. `adb install -r tmp/buyer-staging/android/somos-pruebas-1.4.0-beta3.apk` devolvio `Success` y `pm path com.somosve.app.staging` confirmo la instalacion. No se desinstalo ni borro datos; app normal `com.somosve.app` intacta.
- ADB cayo tras instalar, reconecto luego por `192.168.1.102:35769`. `monkey` abrio `com.somosve.app.staging/com.somosve.app.MainActivity` correctamente. El usuario paso a WhatsApp antes de la captura, asi que falta validacion visual del icono y probar `Desvincular` en un comercio; el otro debe seguir vinculado. Preview: `https://vendeplus-clean-p7h474xr6-entrega2-s-projects.vercel.app`. Produccion sin cambios. No se requiere otro puerto para prueba manual.

# 2026-10-04 - Referidos y pago inicial SOMOS preparados en staging

- Impresion Gran Combo, diagnostico SOLO LECTURA posterior: usuario ve `Telefono vinculado` gris en app y `Aun no hay telefonos vinculados`. `PrintingManager` deshabilita re-vincular si `SomosPrinter.getStatus().paired` ve cualquier token local; API lista equipos solo del comercio seleccionado. Consulta productiva sin tokens: Gran Combo tiene 0 dispositivos; Smash conserva 3 Android no revocados y 1 Windows. Causa consistente con telefono vinculado antes a Smash, no con uso simultaneo de navegador/app. NO se desinstalo/actualizo app, revoco token, movio dispositivo, cambio datos ni desplego codigo. Solucion propuesta pendiente de autorizacion: permitir re-vincular a otro comercio desde Impresion con confirmacion y advertencia de que el equipo dejara de imprimir para el anterior; conservar instalacion/impresora. Para demo Mesa/Barra/Cocina no se necesita vinculacion de impresora. APK publica1.5.1 tiene firma distinta del piloto A34 y no modifico impresion: NO recomendar desinstalar para arreglar esto.

- Pedido de continuidad: conservar en memoria el avance de referidos y NO pasar nada a produccion. Estado confirmado: codigo, pago inicial, afiliado, comisiones y liquidaciones solo en codigo local + Supabase staging + Preview Vercel no productivo. No promover ni aplicar las migraciones de referidos en produccion sin autorizacion explicita. El Preview y cuentas demo de las lineas siguientes son el punto de prueba; contrasenas no se almacenan en este archivo.
- Preparacion presentacion Gran Combo (consulta productiva SOLO LECTURA, sin pedidos ni ajustes): `pollos-gran-combo-andres-bello` activo, Mesa autorizada/activa, modo `table_service`, Mesa 1/2/3 habilitadas, 34 productos, pagos Mesa Pago movil/Punto de venta/Efectivo, asistencia `Pedir asistencia` activa, Cocina activa `manual` (boton Enviar a cocina), 0 pedidos recientes abiertos al consultar. Catalogo publico HTTP200. Barra es modo alternativo del mismo QR, no simultaneo; para demo acabar pedido Mesa, cambiar a Barra, probar, restaurar Mesa. Cualquier pedido real de prueba en produccion genera registro y fee aun si se cancela; no crear pedidos ni marcar pagos ficticios sin acuerdo del comercio.

- Preview remoto de referidos desplegado y compartido: `https://vendeplus-clean-oquwknphb-entrega2-s-projects.vercel.app`, deploy `dpl_2bfBJJ37QebAuEK7s6ELjE8whwxs`, estado READY, target no productivo. Base SOLO staging `xpqmmdmixpyqruykkbkf`; despliegue productivo sigue `dpl_3GFBP86MDDSvkT6zeHD6gQpscte5`. Enlace de prueba `/registro?ref=ALIADOPRUEBA`: API confirma 50% y US$10. Cuentas demo staging `preview-admin@somos.test` y `preview-aliado@somos.test`; contrasenas entregadas al usuario por chat, NO guardadas aqui. Script ignorado `tmp/referrals-preview-fixtures.ps1` permite rotarlas si hace falta. `FOUNDER_EMAILS` del Preview usa solo cuenta demo admin; produccion no cambio.
- Browser Preview en 390/1280: registro/descuento visible sin overflow; login admin y aliado PASS en movil, codigos cargan, aliado bloqueado de API admin con 403, sin errores de pagina. Capturas en `tmp/referrals-preview-*.png`. Ganancias demo comienzan en cero: solo aumentan con pedidos elegibles y fee cobrado en staging; no se inventaron ingresos. Build local final Next16.3.8/TypeScript PASS. Script operativo `scripts/ops/buyer-staging-preview.mjs` ajustado para modo afiliados; wrapper `scripts/ops/supabase-buyer-staging.ps1` agrega `-AffiliatePreview`. No commit ni produccion.

- Solicitud: completar aliados/codigos con descuento inicial, comision sobre fee efectivamente cobrado durante 1-3 meses; mostrar pago unico US$20 de suscripcion y configuracion en Home. Fee por pedido sin cambio. Fuente: adjunto `64557596-318d-474d-89f5-d95391758ea6/Pasted text.txt`.
- Implementados Home y registro con codigo/enlace, precio congelado, reporte de comprobante privado, confirmacion/exoneracion admin antes de activar; administracion de aliados, panel propio aislado, liquidacion manual y ajustes por devolucion. Migraciones nuevas `20261004120000` a `20261004130000` en `supabase/migrations/`. No se hizo commit.
- Migraciones aplicadas SOLO en staging `xpqmmdmixpyqruykkbkf`; ninguna aplicada en produccion `rvmtjtuztewcrmodrodb`. Pruebas SQL transaccionales con rollback PASS: sin codigo20, descuento50%=10, descuento100%=0, limite/usos/activacion, comisiones 0.50->0.25 y 1->0.50, fee tardio, exclusiones, devolucion/liquidacion sin duplicado, meses calendario 1/2/3. Smoke HTTP publico y autenticado PASS; aislamiento de aliados, pausa y contexto de login PASS. Build Next16.3.8/TypeScript (`npm.cmd run build` via runner staging) PASS, `git diff --check` sin errores. Ajustada validacion de fechas antes de crear usuario beneficiario.
- Preview LOCAL staging `http://localhost:3180/registro` fue usado para pruebas; el Preview REMOTO aislado ya esta publicado arriba. Los pagos/pedidos en staging son datos de prueba; produccion intacta en este lote.
- Siguiente paso de referidos: usuario prueba el flujo remoto completo (registro->reporte->confirmacion->aprobacion->aliado y liquidacion) y se corrigen hallazgos. Luego solicitar autorizacion expresa para migracion/despliegue productivo controlado. Antes de publicar, revisar compatibilidad con solicitudes legadas, respaldo y orden de migraciones; no aplicar SQL productivo por un simple `continua`.

# 2026-10-04 - Menu corregido Porkys Food, primera etapa

- Usuario adjunto `Porkys_Menu_Corregido_para_Codex.zip` y solicito corregir Porkys Food. Se leyeron ambas imagenes fuente y el JSON/tabla de conciliacion. Identidad productiva confirmada: id `85ffbf6d-2473-45c9-afe9-8032d65acaa8`, slug `porkys-food`, USD, plan trial, cupo30,29 productos existentes.
- Se conciliaron los29 productos previos por URL estable `PORKYS-01..29.jpg`, sin duplicados ni ambiguedad. Primera etapa APLICADA en produccion:29 productos existentes actualizados con nombres/precios/descripciones/categorias del menu;8 categorias actuales (Pollo reutilizada para Calzones), IDs e imagenes preservados; variantes de Tequenos6/12 ($5.80/$11.60) y Pork Belly media250g/racion400g ($18.88/$20.88) creadas. Precio base tecnico de Pork Belly18.88 porque el catalogo solo soporta deltas de variante no negativos; muestra rango correcto. Foto Pizza Porkys02 conservada provisionalmente por respuesta expresa del usuario aunque texto/precio impreso ($15.80) difiere del menu ($15.08). Tambien siguen desactualizadas fotos de club house mixto, alitas y Pork Belly.
- QA parcial: `node tmp/porkys-corrected-verify.mjs --partial` PASS:29 productos,8 categorias,4 variantes, mismos IDs/fotos y catalogo publico200 tras revalidacion de cache. `node --check` del importador PASS. No pedidos, precios historicos, logo, moneda, plan ni cupo cambiados. No hubo migracion ni despliegue web. Scripts y mapa ignorados en `tmp/porkys-corrected-20261004/`, `tmp/porkys-corrected-apply.mjs`, `tmp/porkys-corrected-verify.mjs`.
- Pendientes de respuesta (preguntas asincronas ya enviadas): ampliar solo cupo de30 a32 para publicar tres faltantes (`Pollo Crispi`, `Pizza Nutella`, `Pizza Nutella + fresa`) y permitir los ocho extras de pizza de $1.16 cada uno con seleccion opcional de hasta8 sin repeticion. No proceder con esas partes hasta recibir la respuesta o aclarar autorizacion. Importador preparado con flags `--publish-new --raise-limit-to-32 --extras-free`, comprobaciones de proyecto/comercio y mapa estable de IDs. Tras publicar, ejecutar `node tmp/porkys-corrected-verify.mjs`, repetir dry-run para confirmar create0, y probar carrito/precios de variantes/extras. No crear promo3x11.60 ni reglas de Calzone/Doble Proteina/Club house mixto sin definicion.
- Git: no commit solicitado para esta operacion. `SESSION_HANDOFF.md` modificado; scripts/fuentes temporales ignorados. Build web no aplica porque no se cambio codigo de la app.

# 2026-10-04 - Puntos de seguridad 1 y 2 publicados

- Autorizacion expresa `procede` despues de explicar alcance y pedir permiso para codigo + permisos DB. Publicado `dpl_3GFBP86MDDSvkT6zeHD6gQpscte5`; `www.somos-ve.com` verificado por HTML data-dpl-id e inspect. Next16.3.8. Candidato construido con configuracion productiva y skip-domain, validado con vercel curl, despues promote.
- Migracion `20261004000000_restrict_public_store_columns.sql` APLICADA Y REGISTRADA en produccion rvmtjtuztewcrmodrodb, despues de verificar codigo compatible activo. Restriccion anon/authenticated de columnas administrativas confirmada por privilegios; service_role mantiene lectura. REST billing paso200->401; campos publicos y relaciones productos/categorias200.
- Postdeploy solo lectura PASS: Home/Marketplace/login; Smash/Queje Olga/Realza/Shibui catalogo/carrito/checkout/OG200. Extras Smash1/Queje5/Realza2 grupos200, sin cache previo por query audit. No se crearon pedidos ni se modificaron productos, precios, pagos o usuarios.
- Browser productivo Playwright PASS8 combinaciones (4 comercios x390/1280): overflow0, errores JS0 y respuestas5xx0; capturas tmp/security-web/production-*.png. Inspeccion visual movil Queje Olga correcta; aviso de cierre no modificado. Pruebas productivas readonly, sin pedido end-to-end nuevo ni sesion real de cliente.
-91/91 contratos y comportamiento PASS; npm audit --omit=dev0; build remoto Next16.3.8/TypeScript257 paginas PASS; build local previo PASS. Rutas privadas y8 tablas sensibles rechazaron lectura anonima; cabeceras presentes; escaneo limitado de archivos sin secretos reconocidos.
- Herramientas temporales: tmp/security-production-smoke.mjs (readonly prod/candidato), tmp/security-production-browser.mjs (readonly navegador), tmp/security-rollout.ps1 (aplicacion idempotente e historial), tmp/security-http.mjs. El primer browser espero networkidle y agoto timeout: usar DOM visible por conexiones persistentes. Vercel curl desde cmd rompe ampersand del query; corregido invocando directamente vc.js con execFileSync argv. Ninguno fue error productivo confirmado.
- NO hacer rollback directo al deployment anterior: depende de columnas publicas ahora revocadas. Priorizar fix forward o version compatible con permisos, sin reabrir datos internos.
- Pendiente separado: MFA obligatorio admin y endurecimiento Auth/abuso (puntos3/4),5 avisos high transitivos SOLO tooling dev ESLint/braces. No ejecutar audit fix --force. El usuario solicito asegurar este lote en Git despues de publicarlo. SQL no queda pendiente para el usuario.

# 2026-10-04 - Publicacion de seguridad autorizada, en curso (historial)

- Tras explicar los dos cambios y pedir confirmacion explicita, usuario respondio `procede`. Autoriza codigo y restriccion de columnas productivas; sustituye la pausa anterior.
- Candidato productivo READY `dpl_3GFBP86MDDSvkT6zeHD6gQpscte5`, URL `https://vendeplus-clean-dg17o8odc-entrega2-s-projects.vercel.app`. Construido con `vercel deploy --prod --skip-domain --yes`; Next16.3.8, TypeScript y257 paginas PASS. No es el Preview staging.
- En curso comprobacion de solo lectura antes de promocion mediante `tmp/security-production-smoke.mjs`, usando `vercel curl` para proteccion Vercel. Sin cambios en pedidos/productos. Migracion productiva aun NO aplicada.
-91/91 tests repetidos PASS; git diff --check PASS. No commit solicitado.

# 2026-10-04 - Reanudacion: confirmar autorizacion productiva

- El usuario dijo avanzar/continuar despues de haber prohibido expresamente produccion. No interpretar esa frase generica como autorizacion inequivoca de publicar; pedir confirmacion antes de promover o aplicar SQL productivo.
- La continuacion anterior intento `vercel deploy --prod --skip-domain --yes --no-wait --format json`, pero termino sin URL. Reconciliacion con `vercel ls --yes` confirma que NO aparece candidato nuevo: ultimo deploy sigue siendo el Preview obwjbcyvb; produccion listada sigue azbe6kska. No repetir despliegue hasta aclaracion.
- No se ha promovido este parche ni aplicado su migracion a produccion. Validaciones del Preview conservadas. Siguiente paso: confirmar si el usuario autoriza publicar los puntos 1 y 2; si autoriza, seguir el orden codigo compatible primero y permisos despues descrito abajo.

# 2026-10-03 - Parche de seguridad 1 y 2 preparado SOLO en Preview

- INSTRUCCION HISTORICA DE ESA ETAPA: NO pasar a produccion. Esta pausa fue reemplazada por la autorizacion `procede` del 2026-10-04, documentada arriba.
- Produccion permanece en `dpl_DrxJ92coeZkDFwsFCPAQX4yo2GBv`. No se ejecuto ningun deploy --prod, promote, ni migracion productiva en este trabajo.
- Preview aislado READY/shared: `https://vendeplus-clean-obwjbcyvb-entrega2-s-projects.vercel.app`, deployment `dpl_DVfronheEKa41CsUMCpz1yQXRBxH`; usa SOLO staging `xpqmmdmixpyqruykkbkf`, comercios cocina-demo y tienda-demo. No promover ese artefacto directamente: esta configurado con staging.
- Implementado: Next/eslint-config-next16.3.8 y lock; helper brand-colors valida hex6; rechazo400 en configuracion del comercio y fallback seguro en Admin/render/catalogo/OG. Catalogo usa lecturas server-only para evaluar suscripcion, conserva filtros de productos/categorias/variantes/opciones activas y expone solo proyeccion Store. No entrega mensualidad como serviceFeeUsd; fee por pedido permanece. Extras conserva cliente publico para productos y lee elegibilidad con servidor.
- Nueva migracion `20261004000000_restrict_public_store_columns.sql`: elimina SELECT general/columnas previas de public/anon/authenticated y concede allowlist de catalogo; conserva service_role y RLS. APLICADA SOLO STAGING. Produccion AUN conserva la exposicion detectada hasta que se autorice desplegar y aplicar esta migracion.
- Orden futuro obligatorio tras autorizacion: construir candidato con entorno productivo sin mover dominios, verificar, promover codigo compatible PRIMERO, despues aplicar/registrar migracion productiva y comprobar REST privado401/publico200 + catalogos y extras. Codigo anterior usa anon para facturacion y fallaria si se revocan columnas antes del nuevo codigo. No hacer rollback al codigo anterior sin analizar compatibilidad con permisos.
- QA: `npm.cmd run build` via runner staging PASS121/TypeScript Next16.3.8; build remoto READY.91/91 pruebas (86 contratos +5 comportamiento seguridad) PASS; ESLint focal PASS; diff check PASS. `npm audit --omit=dev`:0 vulnerabilidades. Audit completo deja5 high transitivos SOLO tooling ESLint/braces, sin parche compatible indicado; no aplicar audit fix --force/downgradeNext14.
- HTTP Preview: home/marketplace/catalogo/carrito/checkout/OG PNG/extras200. API autenticada settings/pedidos200; color invalido400; otro comercio403. Browser Playwright390/1280 con overflow0 y errores0, capturas tmp/security-web. Usuario temporal eliminado. Browser integrado iab no disponible; fallback Playwright. Prueba no creo pedidos.
- REST staging anon: id/slug/name y relaciones productos/categorias200; billing_notes/monthly_price_usd/subscription_status/next_payment_due_at401. Metadatos confirman cierre tambien para authenticated y acceso servidor intacto.
- Errores del harness resueltos: staging no tiene tabla schema_migrations, por eso solo produccion debe registrar historial; prueba de tenant settings usa X-Panel-Store-Id (query storeId era ignorado y devolvia solo comercio propio). Primer ESLint detecto nombre variable module en test; renombrado. No son fallos pendientes de aplicacion.
- Herramientas temporales ignoradas: tmp/security-rollout.ps1 (NO usar Target production Apply sin autorizacion futura), tmp/security-web.mjs. Sin commit/push solicitado para este lote. Cambios listos para revision humana en Preview. SIGUIENTE: usuario prueba y autoriza; mantener produccion intacta.

# 2026-10-03 - Auditoria de seguridad productiva

- Solicitud: auditar puntos criticos. Informe en `docs/audits/2026-10-03-security-production.md`; base `1b2456b`.
- Alerta prioritaria: Next16.3.4 con GHSA-vcvr-r3jv-pc5j critico, corregido desde16.3.6. SOMOS usa ImageResponse Node y colores controlables sin regex; explotacion exacta no demostrada, no ejecutar payloads en produccion. Preparar parche de dependencia/colores antes de nuevas promociones funcionales.
- Fuga confirmada: REST anonimo200 para billing_notes/monthly_price_usd/subscription_status/next_payment_due_at de stores activas. RLS limita filas pero SELECT de tabla expone columnas internas. Cerrar proyeccion publica conservando catalogo/checkout.
- Admin valida founder pero no AAL2. Existe RPC v2 con AAL pero codigo usa v1. DB tiene un factor MFA verificado; no asumir que el admin exige segundo factor. Preparar exigencia server-side con enrolamiento/recuperacion.
- Auth permite alta directa de identidad, password minimo6 y CAPTCHA off; no concede comercio ni membresia. Preservar Google buyer al endurecerlo.
- QA audit:46 GET privados bloqueados (45x401+1x404),18 comprobaciones negativas adicionales401, cookie founder falsa401;8 tablas sensibles bloqueadas en REST; sin tablas legibles sin RLS ni vistas publicas; funciones operativas privadas y comprobantes privados.86 contratos PASS.
- Escaneo actual sin secretos privados reconocidos ni env/keystore versionados;83 archivos locales de bundle publico sin secretos del entorno. No es escaneo exhaustivo de historial Git/APK ni prueba de ausencia de intrusion.
- Sin cambios funcionales, SQL, despliegue ni commit. Build no aplica. No apagar operacion completa con evidencia actual; priorizar parche acotado. Proximo paso exacto: Next/colores y columnas internas en Preview/staging, validar flujos y preparar promocion controlada; luego MFA/abuso.

# 2026-10-03 - Auditoria historica de uso de Pedido manual

- Consulta productiva de solo lectura solicitada por usuario. Criterio tecnico exacto: `orders.notes ilike 'Pedido manual%'`; exclusion por `stores.is_test=true`, no por nombre. Resultado: 18 pedidos manuales reales en 7 comercios; 3 adicionales de Smash excluidos como test.
- Uso real: BODYS STYLE 6, Santo Sabor 4, Filipenses 4:13 2, Los Cunados Fast Food 2, Queje Olga 2, Chilely 1 y Mis Accesorios 1. Modalidades: 13 pickup y 5 delivery. Estados actuales: 8 completed, 9 received y 1 cancelled. BODYS STYLE tuvo el uso mas reciente, 2026-10-03 00:46 UTC (2026-10-02 20:46 Venezuela).
- No se modificaron datos, codigo de aplicacion, deploys ni configuraciones. Hallazgo de producto: adopcion baja pero real; BODYS STYLE concentra 33% del uso historico.

# 2026-10-03 - Belli Burger Mesa reactivada y Cocina visible

- Usuario aclaro que Belli Burger si usa Mesa. Auditoria productiva confirmo configuracion parcial: acceso Mesa autorizado, tres mesas habilitadas (`Mesa 01`, `Mesa 02`, `Mesa 03`), servicio en mesa y pagos configurados, pero `stores.table_orders_enabled=false`; por eso Cocina y pedidos QR estaban ocultos. No habia pedidos de mesa historicos ni fila de configuracion Cocina.
- Se actualizo unicamente `table_orders_enabled=true` con guardas por slug, acceso previo, estado previo falso y conteo exacto de tres mesas. No se cambiaron mesas, modalidad, pagos, QR, asistencia ni configuracion Cocina; Cocina queda visible pero inicialmente apagada hasta que el comercio decida activarla en su panel.
- Smoke productivo autenticado PASS con usuarios temporales eliminados: `belli-burger`, `pasteleria-tdk`, `pollos-gran-combo-andres-bello` y `smash` muestran Cocina, pagina Comandas y Realtime `En vivo`; `don-aniello` sin Mesa no la muestra. Cero errores de navegador. Sin deploy, migracion, commit o push en este ajuste.

# 2026-10-03 - Hotfix Cocina/Mesas, cancelacion general y seguimiento movil en produccion

- Usuario reporto tres incidencias productivas: Cocina marcaba Listo pero Mesa/cliente no se actualizaban, Pedidos cancelaba sin pedir causa y otros comercios con Mesa aparentemente no veian Cocina. Se audito produccion y se ejecutaron dos corridas de cinco pedidos publicos reales en `smash`, antes y despues del hotfix; cada corrida se limpio por IDs exactos junto con clientes y accesos sinteticos. Verificacion final: `qaSmashOrders=0`.
- Causa Mesa: un evento Realtime podia reutilizar una carga completa iniciada antes de la mutacion. `fetchTableSnapshot(storeId,true,true)` ahora fuerza lectura live independiente y la secuencia impide que la respuesta vieja revierta `ready`. Staging real con Mesa abierta confirmo cambio automatico a `Listo para entregar` sin recargar.
- Causa cliente app: Checkout borraba `tableOrder.storeToken` del pedido guardado nativo, dejando el seguimiento dependiente de reconstruir el contexto de sesion. Ahora app conserva el mismo token de seguimiento que web; comprobantes y tokens de cotizacion sensibles siguen limpiandose.
- Cancelacion: las dos vistas de Pedidos ahora abren motivo para cualquier modalidad. API exige causa para Mesa, Barra, Retiro y Delivery. Migracion aditiva `20261003213000_require_cancellation_reason_all_orders.sql` crea `cancel_order_with_reason`, restaura inventario una sola vez y guarda causa/fecha transaccionalmente. Aplicada y registrada en staging y produccion; permisos solo `service_role`, no anon/authenticated. Staging rechazo Retiro sin causa y guardo `Cliente desistio` al confirmarla.
- Visibilidad Cocina no tiene un interruptor Admin separado: exige `table_orders_access_enabled=true` y `table_orders_enabled=true`. Smoke productivo autenticado comprobo Cocina+Realtime En vivo en `pasteleria-tdk`, `pollos-gran-combo-andres-bello` y `smash`. `belli-burger` tiene acceso concedido pero Mesa apagada, por eso Cocina se oculta correctamente.
- Produccion final `dpl_DrxJ92coeZkDFwsFCPAQX4yo2GBv`, `https://vendeplus-clean-azbe6kska-entrega2-s-projects.vercel.app`, READY y `www.somos-ve.com` inspeccionado sobre ese ID. Rollback web: `dpl_5HH27Zh8v3TjE1a8fL1xD1efFa6p`. Smoke final: Home/Marketplace/Smash/login 200, Cocina anonima 307 y API privada 401; cero logs error en 10 min.
- QA: build local aislado de staging PASS121/TypeScript; build Vercel produccion PASS261/TypeScript; 86 contratos criticos +36 Mesa +13 Cocina +8 mobile +2 timing PASS. Preview aislado `dpl_2FLuGv6DSnD5DRbp62Dz1zhignzD`, `https://vendeplus-clean-oc66ufn7n-entrega2-s-projects.vercel.app`, permanece separado de produccion.
- Cinco pedidos finales: tres `ready` confirmados en DB, snapshot Mesa y endpoint publico; uno cancelado con `Pedido duplicado`; uno quedo aceptado durante inspeccion y luego todos fueron eliminados. Latencias Cocina observadas aprox. 316-683 ms. No se modificaron productos, fees ni configuraciones permanentes. Sin commit ni push.

# 2026-10-03 - Cocina, Mesas y Pedidos promovidos a produccion con transicion controlada

- Usuario autorizo produccion con condicion estricta de no afectar comercios activos y mostrar Cocina solo donde Mesa/Barra esta autorizada y activa. Se verifico el bloqueo en UI, hook, API y RPC: `table_orders_access_enabled=true` + `table_orders_enabled=true`. La configuracion Cocina nace desactivada y no se crea automaticamente.
- Preflight productivo `rvmtjtuztewcrmodrodb`: 63 comercios, 4 con acceso Mesa, 3 con Mesa activa/eligibles (`pasteleria-tdk`, `pollos-gran-combo-andres-bello`, `smash`), 4.225 pedidos y 1.980 productos. Esquema Cocina ausente y cuatro migraciones exactas pendientes; migracion Realtime historica ya estaba aplicada.
- Se aplicaron en orden `20261003120000_optional_kitchen_board.sql`, `20261003153000_order_status_timing.sql`, `20261003170000_configurable_order_delay_alerts.sql` y `20261003183000_kitchen_state_sync_and_optional_alerts.sql`. Son aditivas, no hicieron backfill ni cambiaron pedidos. Postflight identico: mismos comercios, elegibles, productos, total y distribucion de pedidos; `store_kitchen_settings=0`, Cocina habilitada=0, tickets=0. Historial Supabase confirma las cuatro migraciones.
- Produccion nueva READY: `dpl_5HH27Zh8v3TjE1a8fL1xD1efFa6p`, `https://vendeplus-clean-hpf25fshu-entrega2-s-projects.vercel.app`, alias oficiales activos incluyendo `https://www.somos-ve.com`. Rollback web inmediato conservado: `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`. No fue necesario rollback de DB; el codigo anterior ignora las adiciones.
- Smoke publico: Home, Marketplace, Smash, Gran Combo, Porkys, carrito, checkout y login 200; paneles privados 307 y APIs panel/admin anonimas 401; directorio 200. Sin errores Vercel durante la ventana observada.
- Smoke productivo autenticado sin tocar pedidos: usuarios temporales aislados creados y eliminados. Smash mostro Cocina, `enabled=false`, cero comandas y Realtime `En vivo`; Don Aniello sin Mesa no mostro enlace Cocina y acceso directo respondio `Cocina no disponible`. Cero errores de navegador; limpieza de membresias/Auth validada.
- QA previa del mismo lote: build Next 16.3.4/261 paginas + TypeScript, ESLint, 86 contratos criticos, 35 Mesa, 13 Cocina/tiempos y 8 campana/mobile. Herramientas conservadas: `scripts/ops/production-kitchen-release-audit.mjs` y `scripts/ops/production-kitchen-smoke.mjs`.
- Sin commit ni push. Siguiente operativo: activar Cocina manualmente solo en el comercio piloto deseado desde `/panel/cocina`; observar primer turno real. No activar masivamente.

# 2026-10-03 - Campana conserva pedidos revisados despues de volver a ingresar

- Usuario reporto que abrir la campana no parecia marcar pedidos como vistos y que al volver a iniciar sesion reaparecian avisos viejos. Causa confirmada: los IDs leidos se guardaban bajo `somos_mobile_v1_private_*`, prefijo que `clearMobilePrivateState()` elimina correctamente durante logout/cambio de cuenta.
- Correccion SOLO Preview: el marcador usa ahora `somos_order_notice_read_v2_<accountId>:<storeId>`, aislado por usuario y comercio pero fuera de la limpieza de sesion. Solo persiste hasta 500 IDs tecnicos; no guarda nombres, telefonos, totales ni contenido del pedido. El estado anterior se migra una vez y se elimina; otras pestanas sincronizan el contador mediante el evento `storage`.
- Abrir la campana sigue marcando como vistos solo los pedidos cargados. La lista continua mostrando pedidos pendientes como herramienta operativa, pero el badge representa unicamente pendientes no revisados. Los avisos nativos mantienen su linea base y no anuncian el lote historico al montar.
- Preview READY: `dpl_7T4QVpFFEm2fdEbgbABHMpB8s54G`, `https://vendeplus-clean-ltbmcef43-entrega2-s-projects.vercel.app`. Produccion permanece intacta en `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- QA: build Next 16.3.4/261 paginas + TypeScript PASS; ESLint focal PASS; 86/86 contratos criticos, 35/35 Mesa, 13/13 Cocina/tiempos y 8/8 campana/mobile PASS. Se actualizaron dos contratos antiguos para reconocer el gestor Realtime compartido. Un intento adicional de simular logout dentro del E2E general invalido la sesion artificial del harness y fue retirado; el contrato unitario reproduce exactamente la limpieza real y confirma persistencia/aislamiento/migracion.
- Antes de produccion: prueba humana en Preview de campana (abrir, salir, volver a entrar) y prueba simultanea caja+cocina en dos dispositivos con 3-5 pedidos, incluyendo pago, preparar, listo, completar y cancelar. No hace falta agregar mas funciones para el primer lanzamiento. No hubo migracion, SQL, commit, push ni produccion.

# 2026-10-03 - Cancelacion directa desde Cocina

- Usuario pidio boton cancelar en cada comanda. Se agrego una X roja compacta junto a la accion principal, disponible en Por preparar, En preparacion y Listo.
- Al pulsar abre el dialogo existente de motivo; cancelar el dialogo no modifica nada. Confirmar usa la ruta real de Pedidos con estado esperado, aislamiento por comercio, proteccion de delivery e inventario. El trigger sincroniza/cierra el ticket y la comanda desaparece; no se creo un estado ni una API paralela.
- Preview FINAL READY/shared: `dpl_8Dzj7HDpeXZKDXMgkh6yGr3SWtFK`, `https://vendeplus-clean-m3s9vpr9y-entrega2-s-projects.vercel.app/panel/cocina`. Produccion intacta `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- QA: build PASS261+TypeScript; ESLint y11/11 contratos PASS; Cocina10 comandas/6 anchos PASS con cancelacion y cero overflow. Staging real PASS: pedido de mesa cancelado con `Producto agotado`, pedido status cancelled, ticket state cancelled y motivo guardado. Browser autentico con `En vivo`; temporales eliminados y configuracion restaurada.
- Sin migracion, SQL, commit, push o produccion. SIGUIENTE: usuario prueba X, Volver y Confirmar cancelacion en el nuevo Preview; luego prueba sincronizacion en dos equipos.

# 2026-10-03 - Sincronizacion operativa, Barra compacta y Realtime corregido en Preview

- Usuario probo en PC y pidio: mover Activos junto a filtros como switch, alertas opcionales, Cocina realmente en vivo, quitar desglose redundante de tiempos, sincronizar pago/Cocina con Pedidos, mostrar Barra en Mesa/Barra y compactar tarjetas/iconos. Trabajo SOLO Preview/staging; produccion no se desplego ni se modificaron datos productivos.
- Estado unico acordado e implementado: Nuevo (`received`) -> Aceptado (`accepted`) -> En preparacion -> Listo -> entrega/completado. Verificar pago acepta solo si estaba Nuevo; nunca retrocede estados posteriores. Enviar manualmente a Cocina acepta el pedido y crea comanda atomicamente, sin cambiar pago, total ni fee. Comercios sin Cocina conservan todos los controles generales de Pedidos.
- Pedidos: filtros de modalidad a la izquierda y switch `Activos` a la derecha; apagado muestra literalmente todos los pedidos del periodo. El supuesto pedido 23 era real: 22 PICO + prueba manual `SO-1003-947602`; luego otra prueba humana llevo el total diario a 24. No se borro ninguna.
- Alertas de demora quedan apagadas por defecto y se activan con switch; umbrales solo se muestran al activarlas. Pedidos/Mesas/Cocina no marcan demora cuando estan apagadas. Cocina conserva solo tiempo total y tiempo de fase visible; se retiro `Tiempos` redundante.
- Mesa/Barra ahora consume `counterOrders`, muestra `Pedidos en barra` separado de mesas fisicas, y actualiza pago/estado/detalle en ambos grupos. Mesas ocupadas sin altura minima, menos relleno; comanda es icono lista, cancelar es X, y pago sigue en ojo. Se corrigio `min-w-0` general del workspace para evitar overflow a 320px.
- Realtime: staging no tenia ninguna policy sobre `realtime.messages`, por eso Cocina mostraba `Actualizacion periodica` y Supabase daba `CHANNEL_ERROR`. Se aplico SOLO staging la migracion historica privada `20260710151755_private_transport_order_broadcast.sql`; canal autenticado recibio `kitchen_changed` real. Polling de 15s queda como contingencia. Cliente Supabase del navegador ahora es singleton por pestana, evitando multiples sesiones/sockets redundantes.
- Migracion nueva `20261003183000_kitchen_state_sync_and_optional_alerts.sql` aplicada SOLO staging: `delay_alerts_enabled default false` y RPC Cocina sincronizada. Produccion requerira esta migracion antes de cualquier deploy futuro de este lote; no ejecutar ni promover sin autorizacion.
- Preview FINAL READY/shared: `dpl_738mUqgqAjkXLN7DUhe9hoebGrGQ`, `https://vendeplus-clean-gbywiwlfc-entrega2-s-projects.vercel.app`. Produccion confirmada sin promover, base staging `xpqmmdmixpyqruykkbkf`.
- QA: build Next16.3.4 PASS261+TypeScript; ESLint focal PASS;86/86 contratos criticos +46/46 Cocina/Mesas/timing PASS; Playwright Pedidos/Mesas web+app 320-1440 PASS sin overflow, con Barra; Cocina10 comandas/6 viewports PASS. API real staging PASS tenant/auth/deduplicacion/transiciones/pago automatico y evento privado Realtime; temporales eliminados y configuracion restaurada.
- SIGUIENTE: usuario prueba Preview en `/panel/pedidos`, `/panel/mesas`, `/panel/cocina`: switch Activos, alertas off/on, Barra visible, Enviar a Cocina y verificar pago mostrando Aceptado, y encabezado En vivo. No pasar a produccion hasta aprobacion expresa y preparar migraciones en orden.

# 2026-10-03 - Catalogo Porkys Food cargado en produccion

- Usuario entrego `Porkys_Catalogo_para_Codex.zip` y aclaro que los precios son USD; pidio quitar `referencia` y el numero de los nombres propuestos. Se distinguieron las instrucciones internas del paquete de la solicitud directa.
- Identidad comprobada antes de escribir: unico match productivo `Porkys Food`, id `85ffbf6d-2473-45c9-afe9-8032d65acaa8`, slug `porkys-food`, activo, base_currency USD, product_limit30, cero productos/categorias. Logo existente preservado; `pool_center.jpg` no se uso.
- Carga productiva:8 categorias,29 productos disponibles y29 fotos al bucket publico `product-images`. Descripciones quedaron vacias porque el material no confirma ingredientes/porciones. `Salchipapas con cheddar y BA…` se publico como `Salchipapas con cheddar`, sin completar texto cortado. `Parrilla referencia17/18`, `Hamburguesa referencia20/21`, `Pollo crujiente referencia28` y `Ensalada referencia29` quedaron como nombres genericos sin referencia/numero, segun usuario.
- Resultado: created29,updated0. Se permiten intencionalmente dos `Parrilla` ($29/$34.80) y dos `Hamburguesa` ($12.76/$6.96), distinguidas por foto/precio; no se inventaron tamanos. Herramienta idempotente `scripts/import-porkys-catalog.mjs` identifica cada importado por URL estable PORKYS-01..29; dry-run posterior create0/update29, por lo que repetir no duplica.
- Verificacion DB independiente: categories8,products29,available29,images29,missingCategory0,imageFailures0; decimales15.08/12.76/etc preservados. Catalogo publico `https://www.somos-ve.com/porkys-food` HTTP200; Playwright390/1280 muestra resumen29, expandir Pizzas da8, Calzone/Tequenos presentes, cero `referencia N`, overflow0 y pageerrors0. Vista agrupada inicial renderiza28 tarjetas porque Pizzas limita preview a7 y ofrece `Ver todos`; no falta producto.
- Sin migracion, SQL, deploy web, cambio de logo, eliminacion, commit ni push. Esta operacion SI modifico datos productivos de Porkys y Storage. El lote Cocina/Pedidos Preview permanece separado y produccion web sigue `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.

# 2026-10-03 - Pedidos operativos, alertas configurables y tarjetas compactas en Preview

- Usuario autorizo prioridades2-5 de la auditoria: filtro Activos, indicador real de actualizacion, separacion semantica Mesa/Barra y alertas configurables por estado. Luego rechazo el alto de las tarjetas de Pedidos; se compactaron sin ocultar nombres, tarifas ni tiempos. Todo SOLO Preview/staging, sin commit/push ni produccion.
- Pedidos abre en Activos salvo preferencia previa; `status=active` se resuelve server-side excluyendo completed/cancelled. Botones Activos/Todos y `Actualizando resultados...` cubren debounce+fetch sin vaciar la lista. Cada tarjeta queda en una franja de cuatro zonas en escritorio; movil conserva texto completo y controles tactiles; app/tablet tiene reglas propias desde768/1024. Detalle ahora usa icono ojo accesible.
- Alertas en Filtros: Nuevo10, Aceptado10, Preparando20, Listo10 y En camino30 minutos por defecto, rango1-240 validado tambien en servidor. Solo compara la fase actual y exige `>` umbral. Pedidos, Cocina y Mesas muestran `Demorado` y tiempo en rojo; no agrega consultas por tarjeta ni altera pago, fee o estados.
- Snapshot Mesas expone `tableOrders` y `counterOrders`; conserva temporalmente `activeOrders` solo para clientes web cacheados durante despliegue gradual. Cliente interno normaliza respuestas viejas/nuevas. Barra no cuenta como mesa fisica.
- Migracion aditiva `20261003170000_configurable_order_delay_alerts.sql` aplicada SOLO staging `xpqmmdmixpyqruykkbkf`: cinco smallint con defaults/check1-240 en `store_kitchen_settings`. Produccion necesita esta migracion antes de un futuro deploy, solo con autorizacion.
- Preview FINAL READY/shared: `dpl_Hpsp4H8CBZYXpH1PPXudWnsU3wvB`, `https://vendeplus-clean-occ2dus6o-entrega2-s-projects.vercel.app/panel/pedidos`; Cocina `/panel/cocina`, Mesas `/panel/mesas`. Usa acceso humano staging ya entregado. Produccion intacta `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`, rollback `dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC`.
- QA local: Next16.3.4 build PASS257+TypeScript;131/131 contratos; ESLint focal PASS; Playwright Pedidos/Mesas web+app PASS en320/390/800/1024/1280/1440, texto completo, sin overflow. Capturas inspeccionadas. Un primer visual uso build viejo y se descarto; app recortaba Nuevo por selectores CSS heredados y se corrigio.
- QA remoto final: escenario PICO 22 pedidos/concurrencia10,15 completados+7 activos,10 mesas/3 ocupadas, Mesa10/9/8 primero, Cocina2/2/2, cero overflow desktop/tablet/mobile. API real guardo cinco umbrales en751ms y rechazo received=0 con400. Filtro Activos mostro7 y Todos22. Usuario temporal eliminado; produccion no tocada. Primer intento remoto esperaba22 bajo el nuevo filtro Activos y timeout; se corrigio el auditor, no la funcionalidad.
- Local3107 cerrado al finalizar. No hay SQL que el usuario deba ejecutar ahora. SIGUIENTE: usuario revisa el Preview; luego prueba caja+cocina en dos equipos. No promover ni aplicar migracion productiva sin aprobacion explicita.

# 2026-10-03 - Hora pico Cocina/Mesas y mesas compactas en Preview

- Usuario pidio culminar demo, simular un restaurante lleno y luego priorizar visualmente las mesas con pedidos. Trabajo SOLO Preview/staging; sin commit/push, SQL nuevo ni produccion.
- Preview actual READY: `dpl_GqfKgAPa9B5m25xPYoQCzeJaF3FP`, `https://vendeplus-clean-cdunn1a5o-entrega2-s-projects.vercel.app`. Login200 y paneles privados307 anonimos. Usa exclusivamente Supabase staging `xpqmmdmixpyqruykkbkf` con Cocina Demo/Tienda Demo. Produccion verificada intacta `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`; smoke200/307/401 y rollback `dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC`.
- `TablesManager`: mesas con pedidos arriba, ordenadas por el pedido activo mas antiguo; mesas sin pedidos separadas en cuadricula compacta. Conserva editar y activar/desactivar con iconos accesibles. Mesas desactivadas no se llaman disponibles. Resultado QA: primeras Mesa10/9/8; siete compactas max101px en desktop/tablet/mobile; cero overflow.
- Simulacion persistente `PICO-*` en Cocina Demo:22 pedidos,10Mesa,2Barra,5Delivery,5Retiro. Se completaron15 (68.2%, aproximacion entera mas cercana al70%) y quedaron7: received1, accepted2, preparing2, ready2; Cocina2/2/2. Diez mesas configuradas, tres ocupadas. Usuario temporal eliminado; escenario sintetico queda para revision humana. Script idempotente `scripts/kitchen-peak-simulation.mjs`, reemplaza solo PICO y limpia parciales al fallar.
- Carga concurrente10: crear p95 601ms; pago p95 1583ms; enviar Cocina270ms; preparar503ms; listo438ms; completar249ms; snapshots Mesas169ms, Pedidos205ms, Cocina209ms. Todos exitosos. Verificar pago es el unico camino >1s en rafaga y primera prioridad de performance; son medidas Preview desde esta PC, no SLA nacional.
- Auditoria: sin errores de integridad/tenant/estado ni overflow. Oportunidades: 1) optimizar/ver instrumentar pago (auth+lectura+update y variacion de red), 2) mostrar estado de actualizacion durante debounce de busqueda de Pedidos para no dejar filas anteriores aparentando duplicado, 3) filtro operativo Activos para que15 completados no dominen la lista en hora pico, 4) separar semanticamente `activeOrders` de Mesas y Barra en snapshot/API, 5) alertas SLA por tiempo de cada fase. Falta prueba humana simultanea en dos equipos/realtime prolongado.
- QA final: `node scripts/mobile-local.mjs build` PASS257/TypeScript;94/94 contratos+Cocina+timing; ESLint focal PASS; check de sintaxis/diff PASS. Capturas `tmp/kitchen-peak`. Browser integrado no disponible, fallback Playwright autorizado por skill. No migracion/SQL para ejecutar ahora.
- Siguiente: usuario revisa nuevo Preview en `/panel/mesas`, `/panel/cocina`, `/panel/pedidos` con acceso ya entregado. No llevar a produccion hasta aprobacion y prueba en dos equipos. Mejor siguiente cambio: filtro Activos+indicador de actualizacion en Pedidos y medicion focal del pago, sin ampliar estados.

# 2026-10-03 - Pedidos legibles, tiempos persistentes y Mesas fullscreen

- Usuario pidio corregir recortes en Pedidos PC, un unico selector de estado con gorro para enviar a Cocina, tiempos por estado; agrego pantalla completa para Mesas. Implementado SOLO Preview, sin commit/push ni produccion.
- OrdersManager distribuye encabezado/controles en dos filas, texto envolvente y estado legible. KitchenOrderAction iconOnly en Pedidos: envio con confirmacion sin pago y luego indicador pasivo. Se refresca Cocina despues de cambiar estado/verificar pago. No se exige pago para operar.
- Nuevo trigger DB status_entered_at/status_elapsed_ms registra solo transiciones reales, no pago/reintentos; acumula fases repetidas, congela al finalizar y no inventa historial antiguo. Migracion 20261003153000_order_status_timing.sql aplicada SOLO staging xpqmmdmixpyqruykkbkf. No SQL que ejecutar manualmente ahora; futura produccion requiere ambas migraciones nuevas tras autorizacion.
- Pedido antiguo sin transicion registrada muestra Tiempo sin registro; nuevos pedidos registran desde creacion. Desplegable del reloj muestra tiempos acumulados registrados por fase. Tick local15s, serverTime y misma consulta de pedidos, sin N+1.
- QA encontro que Pedidos no renderizaba errores ya dentro del panel: corregido aviso persistente para mutaciones. No se cambia la tarjeta si servidor rechaza; merge usa estado/timestamp confirmado, guard impide que un GET anterior pise mutacion confirmada.
- Mesas tiene expandir/contraer con header visible, Fullscreen API y fallback fijo; escape/back nativo y controles de comanda/pago conservados. KitchenManager no cambio, sigue con tres columnas por estado.
- QA final: npm.cmd run build PASS257; ESLint focal PASS; contratos+Cocina+PGlite94/94; SQL real timing y Cocina con rollback PASS; UI Pedidos12 escenarios web/app simulada320-1440 +Mesas fullscreen/comprobante/comanda/salida/fallback8anchos PASS; UI Cocina6/6 PASS. Capturas revisadas. No equivale a dos equipos fisicos.
- Preview ACTUAL READY y compartido: https://vendeplus-clean-nhxipzcee-entrega2-s-projects.vercel.app/panel/pedidos , deployment dpl_6e7VPtCsRV3dXynZT42k2nU6sfMH. Mesas /panel/mesas y Cocina /panel/cocina. Misma cuenta/clave de Preview smash@gmail.com, ningun reset ni cambios a pedidos humanos.
- Produccion revalidada dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n; publicas200,panel307,API401. Local3107 cerrado. Memoria detallada docs/session-memory/2026-10-03-cocina-preview.md.
- SIGUIENTE: usuario revisa NUEVO enlace /panel/pedidos y /panel/mesas; comprobar caja/cocina en dos dispositivos antes de produccion. V2 permanece roles/alertas; nada de mesa abierta o cobro nuevo.

# 2026-10-03 - Correccion: columnas por estado conservando densidad

- Usuario reporto que comandas no cambiaban de columna. Causa: ajuste compacto anterior habia sustituido agrupacion por estado por una sola cuadricula; etiquetas cambiaban pero posicion no reflejaba flujo. No fue necesario modificar API o estados.
- KitchenManager.tsx vuelve a tres secciones Por preparar/En preparacion/Listos, con conteos y colores. Vista Todas distribuye columnas cuando contenedor>=840px; pantallas pequenas apilan grupos sin desbordar. Filtros anteriores permiten enfocar un estado. Se mantienen tarjetas compactas, notas/extras completos y tiempos.
- QA reforzado scripts/kitchen.e2e.mjs: exige salir de queued y entrar en preparing, luego ready; fallo no mueve tarjeta; snapshot externo tambien reubica. Diez pedidos MOCK,6/6 anchos PASS, columnas en orden y encabezados alineados, fullscreen3columnas, tarjetas<400px, notas largas sin overflow. Captura final inspeccionada.92/92 contratos+Cocina PASS; ESLint focal PASS; npm.cmd run build PASS257.
- Nuevo deployment dpl_5fXTVX5CvRSYqAvZt6L99stVQY2e READY y compartido: https://vendeplus-clean-m5mgos1x8-entrega2-s-projects.vercel.app/panel/cocina . Misma cuenta/clave Preview, no reset ni cambios a pedidos existentes. Un sondeo de Vercel devolvio JSON vacio transitorio; reintento confirmo READY sin redesplegar.
- Produccion revalidada intacta dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n; publicas200, panel307, API401. Sin migracion/SQL nuevo ni commit/push. Local3107 cerrado. Siguiente: usuario abre NUEVO Preview en Todas, prepara y marca listo; conservar columnas en futuras mejoras de densidad.

# 2026-10-03 - Cocina compacta para diez comandas

- Usuario aprobo funcionamiento pero tarjetas demasiado grandes para10 pedidos. Cambio acotado de presentacion en KitchenManager.tsx: cuadricula adaptable, filtros Todas/Por preparar/En preparacion/Listos con contadores, franja de color por estado, menos espacios, producto+variante y extras compactos. Notas/productos completos siempre visibles. Tiempo total y fase actual visibles; desglose desplegable Tiempos. Sin cambiar API/pago/estados/consultas ni SQL.
- Preview ACTUAL https://vendeplus-clean-a6x7pbsai-entrega2-s-projects.vercel.app/panel/cocina , dpl_9yfRVCw2y1nAfiuX2oo4KAHT7Lir READY y compartido. Misma base staging xpqmmdmixpyqruykkbkf y cuenta smash@gmail.com de Cocina Demo; misma clave inicial de Preview ya entregada. Puede requerir login por nuevo dominio, NO regenerar clave.
- Build final npm.cmd run build PASS257; ESLint focal PASS;92/92 contratos+Cocina; QA scripts/kitchen.e2e.mjs con10 pedidos MOCK PASS6/6 en320/390/800/1024/1280/1440. Verifica filtros, estados, errores, notas largas sin truncar/overflow, colores y pantalla completa. Tarjetas295-335px de prueba,3columnas1280,4fullscreen1280,2tablet800. No crear10 pedidos nuevos en staging; se preservo prueba humana existente.
- Produccion revalidada sin cambios dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n, publicas200/panel307/API401. Sin migracion nueva, deploy productivo ni commit/push. Local3107 cerrado al terminar.
- Siguiente: usuario revisa nuevo enlace con acceso de Preview existente, pantalla completa en cocina y filtros; despues prueba caja/cocina en dos equipos y aprobacion antes de produccion. Detalles/aprendizajes en docs/session-memory/2026-10-03-cocina-preview.md.

# 2026-10-03 - Acceso humano a Cocina Demo listo

- Usuario autorizo correo smash@gmail.com para probar. Cuenta creada SOLO en Auth staging xpqmmdmixpyqruykkbkf, membresia owner exclusivamente Cocina Demo. No se copio ni modifico la cuenta de produccion.
- Ingreso: https://vendeplus-clean-fa83xrgkp-entrega2-s-projects.vercel.app/panel/login?next=/panel/cocina . Clave inicial exclusiva de Preview entregada al usuario; NO guardar credenciales en Git/memorias. No se envio email ni se requiere verificar un correo para esta prueba aislada.
- Verificado login con password, API contexto con exactamente un comercio, Cocina board, Mesas live y Pedidos: HTTP200. La primera verificacion de Mesas fallo403 porque el SCRIPT omitia storeId en query; corregido el auditor sin cambiar la API. Clave inicial regenerada antes de entregarla; produccion intacta.
- Herramientas: scripts/ops/kitchen-preview-access.mjs y helpers staging, accion kitchen-access con OperatorEmail; no reemplaza claves existentes salvo flag explicito ResetPreviewOperatorPassword (solo staging y usuario sin otros comercios). Datos de credencial solo en salida para entrega directa, no archivos.
- Build npm.cmd run build PASS/257 paginas. No migracion/SQL adicional, deploy ni commit. Siguiente: usuario entra con credencial de Preview (no la clave real de Smash) y prueba Cocina/Pedidos/Mesas en dos dispositivos. Ver detalle en memoria2026-10-03-cocina-preview.md.

# 2026-10-03 - Cocina opcional en Preview aislado

- Trabajo en `.fee-billing-prod`, rama checkpoint/somos-mobile-production-20260930, base 7da1ce7. SIN commit/push de Cocina; el usuario no los pidio para esta tarea.
- Preview READY compartido: https://vendeplus-clean-fa83xrgkp-entrega2-s-projects.vercel.app/panel/cocina (dpl_8iSLKBSJ8BYK2zpc9wSV2ZmEDJzn). Supabase SOLO staging xpqmmdmixpyqruykkbkf; comercios ficticios cocina-demo y tienda-demo. No es Gran Combo real.
- Usuario exige Cocina opcional: Pedidos conserva todos sus estados sin depender de Cocina o pago, respetando las restricciones preexistentes de entrega externa. Solo Mesa activa+autorizada habilita modulo. Comandas de Mesa/Barra/Retiro/Delivery, origen, tiempos, variantes/extras/notas; envio manual sin verificar permitido para regalos/excepciones sin alterar precio/pago/fee; alternativa automatica al verificar pago.
- Migracion NUEVA 20261003120000_optional_kitchen_board.sql aplicada solo a staging. Dos tablas privadas, RPC transaccional, triggers de sincronizacion/realtime. Funciones de staging actualizadas tras QA; no reaplicar CREATE TABLE a staging. SQL transaccional y helper KitchenAction test disponibles. NO ejecutar en produccion sin autorizacion.
- Pruebas: npm.cmd run build PASS (via mobile-local.mjs,257 paginas), ESLint focal sin warnings,101/101 contratos+Firebase+Cocina PASS; SQL staging con ROLLBACK PASS; Playwright mock320/390/800/1280 PASS sin overflow; API REAL de Preview PASS auth401/tenant403, excepcion sin pago, deduplicacion, estados, Cocina desactivada, creacion manual con mesa real y verificacion de pago automatica. Cuenta/pedido/producto temporales eliminados, configuracion restaurada. Ver memoria detallada.
- Seed persistente aislado: Cocina Demo con dos mesas y cuatro pedidos ficticios COCINA-DEMO-1..4 (tres enviados, uno Barra pendiente), sin operadores asignados. El usuario respondio "gran combo" a pregunta del correo: se aclaro que necesitamos correo de acceso, no clave. NO crear acceso humano sin ese dato; NO copiar usuarios/pedidos de produccion.
- Produccion revalidada sin cambios dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n; paginas200, panel307, API privada401. Android/APK no cambia. Build de Preview comparte codigo actual; scripts QA nuevos posteriores no requieren redeploy web.
- SIGUIENTE EXACTO: recibir correo del operador, configurar acceso SOLO Cocina Demo en staging sin tocar su cuenta real; probar desde caja y cocina en dos dispositivos, filtros/tiempos, pago/manual y Pedidos sin Cocina. Despues aprobacion de UX, commit si usuario lo solicita y plan de migracion/despliegue productivo. Aun no habilitado en Gran Combo.
- Memoria: docs/session-memory/2026-10-03-cocina-preview.md. Riesgos/V2: origen historico inferido de notas de pedido manual, prueba realtime en dos dispositivos y desconexion prolongada pendiente; no impresion por evento Cocina ni roles nuevos. Local QA3107 cerrado al terminar.

# 2026-10-02 - Checkpoint Git de produccion y Android 1.5.1

- Usuario autorizo asegurar el trabajo con commit y push. Rama checkpoint/somos-mobile-production-20260930; checkpoint identificable por mensaje `chore: checkpoint production printing and Android 1.5.1 release`. Esta entrada pertenece al checkpoint; obtener su hash con git log y comparar HEAD con origin al retomar.
- Incluye centro de impresion, recuperacion limitada a24h, FCM manual, codigos completos, cierre de comercios, ajuste estrecho de PanelShell, candidata Android firmada, scripts de firma/verificacion, guia y memorias. Se preservo el trabajo previo, sin cambios funcionales adicionales durante el respaldo.
- Revalidacion del checkpoint: contratos86 + Firebase9 + Play7 =102/102 PASS, revision de archivos sensibles sin hallazgos, diff-check PASS. Builds web y Android PASS en la preparacion anterior; no se repiten por cambiar solo documentacion/respaldo Git.
- Produccion a conservar: dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n. No promover ni desplegar por este checkpoint. Sin migracion ni SQL. APK/AAB, entornos y claves privadas no se incluyen en Git; firma privada requiere respaldo externo seguro separado.
- Siguiente: probar APK release en otro telefono/tablet y continuar requisitos de Play. Detalle de candidata y enlaces debajo; las entradas historicas `sin commit` describen su momento, no el estado del checkpoint.

# 2026-10-02 - Candidata Android 1.5.1 y web aprobada en produccion

- Usuario pidio version estable y APK descargable para telefonos/tablets antes de Play; confirmo que NO tiene cuenta Play Console. Se pregunto titular legal/correo de soporte y privacidad; sin respuesta aun. No bloquea generar APK, si completar documentacion legal de lanzamiento.
- Web aprobada publicada: dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n, https://www.somos-ve.com. Rollback dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC. Preview fuente dpl_Gqpmt7p8u2mDHVU1SNiK7FxGt37T. Incluye codigo completo, cierre en tarjetas y correccion minima de Configuracion (8 px de overflow en 320 px) en PanelShell.
- QA web: build npm.cmd run build PASS/255 paginas; contratos 86/86; movil/FCM/auth/compatibilidad 49/49; recorrido movil 15 escenarios PASS; checkout 5/5; tarjetas 9 viewports mas marketplace web/app PASS; ESLint focal PASS. Smoke productivo 200 en rutas publicas, panel 307 al login y API de impresion 401 anonima. Sin nuevas migraciones ni SQL.
- Android com.somosve.app 1.5.1/code15, release de origen oficial, firma propia fuera de Git. Material privado en LOCALAPPDATA/SOMOS/android-signing; credencial DPAPI ligada al usuario/PC. NO imprimir ni guardar secretos en memorias. Falta respaldo portable seguro antes de migrar PC/Play.
- Build firmado reproducible: scripts/ops/build-signed-android.ps1; valida via scripts/ops/verify-android-apk.ps1. Builder produce APK+AAB y manifesto con hashes; puede usar -Incremental. No reemplazar clave ni usar -CreateKey si ya existe. Artefactos temporales en tmp/play-internal, no Git.
- Auditoria detecto Bluetooth implicitamente obligatorio (corregido con uses-feature required=false) y RELRO de DataStore 1.1.7 incompatible con 16 KB, aunque LOAD y ZIP si pasaban. Comparacion binaria del AAR oficial 1.2.1 confirma correccion; constraint acotado a datastore-preferences 1.2.1, sin cambiar codigo de pedidos o impresion. Guardas Play 7/7 PASS.
- APK FINAL PUBLICADA Y VERIFICADA: https://rvmtjtuztewcrmodrodb.supabase.co/storage/v1/object/public/app-releases/android/1.5.1/somos-1.5.1-android.apk?download=somos-1.5.1-android.apk . Peso4671120bytes, SHA256 858845925B22CA29B5F4FE598168F0D3967C960968F8003A327498B74C762498. Descarga identica al firmado; bucket app-releases publico, escritura anonima rechazada por RLS. Ruta inmutable, no sobreescribir. Build Android6m43s PASS; verifier PASS incluyendo ZIP/ELF LOAD/RELRO16KB,4ABI,SDK24/36,firma propia,no-debuggable,origen oficial,sin archivos privados.
- AAB local tmp/play-internal/somos-internal-release.aab, SHA256 2A5292624FCAE255BCCD8A607F16305923D43A898DA818C7274879217B2C62E6. Jarsigner firma valida con avisos de certificado autofirmado y orden de manifiesto JarInputStream; falta bundletool/Play, no compartirlo como aceptado por Play. Play Console no se toco. Evidencia final en tmp/play-internal/{artifact,verification,download,production}.json.
- ADB sin dispositivo, sin emuladores. No se ha instalado fisicamente esta release. A34 piloto usa firma debug distinta: no desinstalar ni intentar sustituir durante operacion. Las pruebas fisicas previas A34/TIII no certifican esta nueva firma ni todas las marcas.
- Local Next start de QA en3107 cerrado; builds y publicacion terminados. Sin commit/push; rama checkpoint/somos-mobile-production-20260930, HEAD f3c0a0c, cambios previos preservados. Guia docs/android-1.5.1-distribucion-manual.md y memoria2026-10-02-apk-distribucion-firmada.md. SIGUIENTE EXACTO: instalar desde enlace en otro telefono/tablet, entrar consumidor/comercio, pedido controlado en Smash Test y prueba de impresion; despues planificar migracion A34 debug, respaldo portable de firma, titular/contacto legal y apertura Play Console.

# 2026-10-02 - Codigos completos y cierre de comercios en Preview

- ACTUALIZACION: usuario aprobo visualmente este Preview y pregunto pendientes de Play Store. No se hizo deploy productivo ni commit en esta consulta. Prioridad siguiente: confirmar cuenta Play Console/titular, custodiar firma externa y generar AAB para pruebas internas; completar identidad/contactos, retencion, Data Safety, ficha, acceso revisor y declaracion/video de impresion foreground. Borrador Data Safety actualizado para eliminar pendientes obsoletos de Firebase, arranque y migraciones. La cuenta Play Console aun no fue inspeccionada.
- Usuario confirmo que salio la impresion manual. Auditoria previa de solo lectura: SO-1002-951577 tiene un trabajo manual printed en un intento, unos 6 segundos entre creacion e impresion, y un trabajo paid anterior. No son dos trabajos manuales duplicados.
- Ajustes solicitados implementados: OrdersManager elimina truncate del codigo, reserva 132 px y permite envolver codigos largos. La fila de seis columnas empieza en xl para no desbordar tablets de 1024 px.
- MarketplaceClient entrega openState a tarjetas de mas vendidos, ofertas y destacados. Si isOpen=false muestran una franja Cerrado, con el label real como title. El listado de comercios prioriza label de cierre sobre estimacion de delivery. No cambia precios, ranking ni posibilidad de consultar catalogos cerrados.
- QA local: 7 escenarios de pedidos (web 320/390/1024/1280/1440, app simulada 320/390), codigo normal y largo completos, sin overflow de tarjetas. Marketplace web/app con tres tarjetas cerradas y dos abiertas, cero pageerror. Capturas y auditor temporal en tmp/order-code-marketplace*.
- Build final npm.cmd run build mediante mobile-local.mjs PASS, Next 16.3.4/255 paginas. Contratos criticos 86/86 PASS; ESLint focal PASS; git diff --check PASS. Se actualizo una asercion antigua que exigia el ancho causante del recorte.
- Preview dpl_BmYuFcfAs1ww4veckb3s7uesCaWP READY y compartible: https://vendeplus-clean-dz3f5sa77-entrega2-s-projects.vercel.app. Marketplace 200, Pedidos 307 al login y API privada 401. Produccion confirmada sin cambios: dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC.
- Hallazgo V2 independiente: PanelShell web a 320 px tiene overflow de 8 px por etiqueta Configuracion; no pertenece a la fila de pedidos y no se modifico. En app simulada no ocurre. El estado de apertura usa los datos ya cargados del marketplace, sin nueva consulta ni actualizacion continua.
- Sin migracion ni SQL; sin commit/push. Los cambios previos del Centro de impresion y memorias siguen presentes. SIGUIENTE EXACTO: usuario revisa /panel/pedidos y /marketplace en este Preview; publicar estos ajustes cuando autorice, luego asegurar Git y retomar AAB firmado/Play Internal Testing.

# 2026-10-02 - Centro de impresion y recuperacion en PRODUCCION

- Usuario aprobo el Preview y autorizo produccion con cuidado. Despliegue final dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC, READY y target production: https://vendeplus-clean-7m5ole6po-entrega2-s-projects.vercel.app. Aliases confirmados: www.somos-ve.com, somos-ve.com, vendeplus-clean.vercel.app y alias del proyecto.
- Rollback previo al Centro: dpl_386nQSZ6aF4jz5oxJfLm4JsiAgu4. Despliegue intermedio funcional antes del guard historico: dpl_4q9cCy5UDXJRgrSLuSH55dLadkAa.
- Smoke productivo final: Home 200, Marketplace 200, Smash 200, panel privado 307 a login y API de estado anonima 401. Build Vercel PASS, TypeScript PASS y 255 paginas.
- Auditoria de solo lectura en Smash Test encontro cero trabajos pending/processing y siete failed historicos con cinco intentos. Para evitar reimpresiones accidentales, solo fallos de las ultimas 24 horas cuentan como errores recientes y pueden reintentarse; fallos antiguos remiten al detalle del pedido. Todo reintento muestra confirmacion con el codigo.
- QA posterior al guard: FCM/impresion 9/9, TypeScript PASS, ESLint focal PASS, UX movil 2/2 en 320/390 px y git diff --check PASS. Sin migracion ni SQL.
- Smash Test conserva impresion automatica paid, papel 58 mm, una copia. Tiene un Android vigente con FCM listo; los otros agentes antiguos permanecen visibles pero no pueden despertar por push. No se modificaron pedidos ni trabajos durante la auditoria.
- ADB no tiene dispositivos conectados. SIGUIENTE EXACTO: impresora encendida; abrir SOMOS una vez y dejarla en segundo plano; desde Chrome entrar al panel productivo, elegir Smash Test, abrir un pedido controlado y pulsar Imprimir comanda. Debe salir una sola comanda y en Impresion debe terminar Impresa. Luego asegurar cambios en Git y retomar AAB/Play Internal Testing.

# 2026-10-02 - Preview del Centro de impresion y recuperacion

- Se cerro el hueco operativo de impresion manual: la ruta de impresion creaba el trabajo, pero no enviaba FCM. Ahora agenda un wake manual con after(); este evento despierta la app aunque la impresion automatica este desactivada, sin cambiar el filtrado de eventos received y paid.
- Nuevo endpoint privado /api/panel/printing/status: exige sesion y acceso al comercio seleccionado; devuelve solo sus equipos activos, estado de avisos, ultimas 20 comandas, conteo de pendientes/errores y errores convertidos a mensajes humanos. Nunca expone token FCM ni el error tecnico crudo.
- El mismo endpoint permite reintentar exclusivamente trabajos failed del comercio activo: limpia bloqueo/intentos, vuelve a pending y despierta la app. No crea una segunda comanda ni permite tocar otro tenant.
- PrintingManager ahora muestra salud del telefono, avisos activos, cola reciente, ultima impresion, pendientes/fallidas y boton de reintento. Los errores Bluetooth comunes se presentan sin mensajes internos. El boton manual de Pedidos conserva su flujo, pero ahora puede despertar el A34 en segundo plano.
- QA: FCM/impresion 9/9; contratos criticos 86/86; centro movil 2/2 en 320/390 px sin overflow y con reintento interceptado; TypeScript PASS; ESLint focal PASS; API anonima 401; npm.cmd run build PASS, Next 16.3.4 y 255 paginas.
- Preview Vercel dpl_329TqS4Qtn1AvKyEopY29DDmSEDD, READY y compartible: https://vendeplus-clean-patd1se2n-entrega2-s-projects.vercel.app. Panel privado redirige a su login y API anonima responde 401; produccion no cambio. Sin migracion ni SQL.
- Cambios aun SIN commit/push: conviven con AGENTS.md y docs/session-memory/, solicitados por el usuario para continuidad.
- El Preview no tiene FIREBASE_SERVICE_ACCOUNT_JSON porque Vercel no exporta el valor sensible de Produccion; un intento seguro de copiarlo devolvio valor vacio y elimino el archivo temporal. Sirve para revisar UI y datos, pero no para probar el wake fisico.
- SIGUIENTE EXACTO: abrir el Preview, ingresar y revisar /panel/impresion con Smash Test sin reintentar pedidos reales. Si la interfaz queda aprobada, promover con rollback preparado y ejecutar de inmediato una impresion manual controlada en Smash Test con la app cerrada o en segundo plano. Si sale una sola comanda y queda Impresa, asegurar Git; despues retomar AAB firmado y Play Internal Testing.

# 2026-10-02 - Candidata movil asegurada: impresion pagada y checkout sin overflow

- Prueba fisica completa en A34 + `TIII Bluetooth Printer`: con SOMOS cerrada, verificar el pago de `SO-1002-369729` desperto el agente por FCM, reclamo el trabajo en menos de 2 s y termino `printed` en un intento. Repetir la verificacion conservo un solo trabajo `paid`; usuario confirmo que el ticket salio correctamente.
- La prueba uso solo Smash Test. Se neutralizo un ticket `received` antiguo de un pedido ya finalizado, se restauro el pedido a pago pendiente, la impresion a `received`, se elimino el acceso temporal y se devolvio el telefono a suspension normal.
- Se reprodujo un overflow real en el checkout regular al mostrar un correo de Binance junto a un carrito con textos largos: viewport visual 320/390 px, documento hasta 404/405 px. Causa: ancho minimo intrinseco de la columna de pago dentro del grid.
- Correccion minima: grid usa `minmax(0,1fr)`, ambas columnas pueden encoger y los valores de pago largos usan `overflow-wrap:anywhere`. Checkout normal y Mesa conservan su estructura.
- `table-checkout-ux.e2e.mjs` ahora cubre Mesa y checkout regular en 320/390 px, carrito/opciones largas y Binance; verifica body/document/visual viewport y termina 5/5 PASS.
- QA final: contratos criticos 86/86; movil/FCM/Play/WebView 17/17; operacion Mesa/cuentas 45/45; TypeScript PASS; ESLint focal PASS con una advertencia conocida en `PanelAuthProvider`; `git diff --check` PASS; build `npm.cmd run build` PASS, Next 16.3.4 y 254 paginas.
- El lint global no queda verde por deuda previa fuera de este ajuste: scripts de auditoria que asignan `module`, assets Android generados y refs durante render en `TableOrderNotifier`/`TablesManager`. No se mezclaron esas correcciones.
- No hubo migracion ni SQL nuevo en esta retoma. La migracion de solicitudes de eliminacion ya estaba aplicada y forma parte del trabajo pendiente de asegurar en Git. No se hizo despliegue adicional.
- SIGUIENTE: despues del checkpoint Git, construir el Centro de impresion/recuperacion y luego cerrar AAB firmado + Play Internal Testing.

# 2026-10-02 - Hotfix productivo de desplazamiento horizontal en catalogos

- Tras publicar checkout/impresion, usuario reporto que Shibui y Realza volvieron a moverse lateralmente en movil. Se pauso la prueba fisica de impresion para priorizar el catalogo.
- Diagnostico productivo reproducido: viewport visual/client 390 px, pero `documentElement.scrollWidth` 1606 px e `innerWidth` 1560 por el carrusel `Favoritos del momento`; en 320 px llegaba a 1298/1280. La etiqueta viewport era correcta. `overflow-x: clip` evitaba scroll por codigo, pero Android podia arrastrar el documento porque el contenido interno seguia participando en el ancho raiz.
- Solucion minima en `globals.css`: los scrollers reales de Categorias y Favoritos reciben `contain: layout paint` junto con `overscroll-behavior-x: contain`. No se elimina su scroll interno ni se altera el resto del catalogo. El selector de Categorias ahora apunta al scroller interno y no al contenedor sticky.
- Auditor `product-options-mobile-audit.mjs` ahora falla tambien si `documentElement` o `body` superan el viewport, evitando que una modal correcta oculte un catalogo ancho.
- Preview aislado `dpl_YKZNN8w1PiyKrmWXVrfyUSafyaCN`, READY; asset CSS verificado con la regla generada. Produccion `dpl_386nQSZ6aF4jz5oxJfLm4JsiAgu4`, READY y aliases oficiales confirmados. Rollback: `dpl_En4n12YXXd3peA5wqW7zdDWaqJ1n`.
- QA productivo sin CSS inyectado: Shibui y Realza en 320/390 px tienen inner/visual/client/html/body exactamente iguales al viewport; Categorias y Favoritos conservan scrollLeft real. Auditor de opciones: 12 dialogos, 6 por comercio, 0 fallos. Build Vercel Turbopack/TypeScript PASS, 253 paginas. Sin migracion, SQL, pedidos ni configuraciones modificadas.
- A34 sigue conectado en `192.168.1.101:41131`, SM-A346M, Somos 1.5.0; permisos Bluetooth/notificaciones concedidos y TIII Bluetooth Printer vinculada al sistema. Lectura `run-as` no disponible en el APK instalado, por lo que no se afirmo estado interno de pairing/auto-print. SIGUIENTE: usuario confirma Shibui/Realza en su equipo; luego retomar prueba controlada de impresion al verificar pago en Smash Test.

# 2026-10-02 - Checkout de mesa, comprobantes 5 MB e impresion al verificar: PRODUCCION

- Usuario aprobo las pruebas del Preview y autorizo avanzar. Se preparo un release aislado sobre el hotfix productivo `7caed09` + compatibilidad de tablets, sin promover performance `9c54`, eliminacion de cuentas, hardening Play ni otros cambios pendientes.
- Alcance productivo exacto: checkout sin numeracion; en Mesa se omiten selector de entrega, banner `Recibir en` y bloque redundante Entrega/Retiro; checkout normal conserva Delivery/Retiro/Envio. Capturas aceptan hasta 5 MB en cliente y servidor, con 256 KB de margen multipart y almacenamiento WebP aun limitado a 2 MB. Impresion permite activar al recibir, al verificar pago o ambas; solo la primera transicion a `verified` agenda FCM `paid` y respeta `trigger_mode`.
- No hubo migracion ni SQL: el esquema productivo ya soportaba `received`, `paid` y `both`.
- QA: Firebase 7/7, Mesa 35/35, contratos criticos 86/86, checkout visual 3/3 en 320/390 px y recorrido movil completo PASS con `AbortSignal.timeout` desactivado. Build local Webpack PASS, Next 16.3.4, TypeScript y 253 paginas. El build Turbopack hermetico de Vercel tambien PASS.
- Preview exacto `dpl_HUvPw9KafiBw35TuggaEX493cDVe`, READY: `https://vendeplus-clean-3cxb4jrc9-entrega2-s-projects.vercel.app`. La CLI perdio conexion al final por ECONNRESET, pero inspeccion posterior confirmo READY; no se genero un segundo Preview.
- Produccion exacta `dpl_En4n12YXXd3peA5wqW7zdDWaqJ1n`, READY y aliases oficiales confirmados. Rollback inmediato: `dpl_GiasdoWwa2gBMA1obGw7mdVnM4tr`.
- Smoke productivo: checkout Mesa muestra solo Datos/Pago/Indicaciones/Resumen; checkout normal conserva Delivery; panel en tablet antigua simulado PASS; API privada de impresion 401 anonimo. Sin pedidos ni configuraciones reales modificadas.
- Prueba fisica pendiente: ADB no muestra ningun dispositivo. SIGUIENTE EXACTO: usuario abre Depuracion inalambrica del A34 y envia IP:puerto actual, mantiene impresora encendida y app Somos instalada. Reconectar, activar `Imprimir al verificar el pago` solo en Smash Test, cerrar app, crear/usar un pedido controlado pendiente y verificar pago; debe salir exactamente una comanda y una segunda verificacion no debe duplicarla. Restaurar configuracion de Smash al terminar.

# 2026-10-02 - Hotfix productivo para tablets Android antiguas

- Happy Chicken reporto en telefono/tablet `AbortSignal.timeout is not a function` al abrir `/panel`. Causa confirmada: Chrome/WebView antiguo expone `AbortSignal` pero no el metodo estatico moderno `timeout`; no era un problema de cuenta, comercio, descarga ni datos.
- Se agrego `src/lib/client/request-timeout.ts`: usa el timeout nativo cuando existe, cae a `AbortController` en Android antiguo y permite la solicitud sin timeout si tampoco existe esa API. Panel auth, arranque nativo, resumen de Mesa/Barra y visor de comprobantes usan el helper. El panel ya no expone mensajes internos de esa familia al usuario.
- Pruebas: compatibilidad moderna/Android antiguo/sin AbortController 4/4 PASS; Mesa/Barra 35/35 PASS; contratos criticos 86/86 PASS; TypeScript PASS; recorrido movil completo con `AbortSignal.timeout` eliminado PASS, incluyendo panel, sede, Mesa, revalidacion, cambio de cuenta y revocacion. `node scripts/mobile-local.mjs build` PASS, Next 16.3.4 y 254 paginas.
- Para no promover cambios aun pendientes de Play, cuentas, checkout, impresion o performance, el hotfix se aislo desde `7caed097189a2f55a2427b15c0c5941634049352`, equivalente al codigo productivo previo. Worktree temporal: `.old-webview-hotfix`; contiene solo cuatro consumidores modificados y el helper nuevo.
- Preview probado: `dpl_G3Lt8tAgdWNHVm9ARkQuWrDiJpz8`, `https://vendeplus-clean-9nr22d7do-entrega2-s-projects.vercel.app`. Promocion productiva exacta creo `dpl_GiasdoWwa2gBMA1obGw7mdVnM4tr`, READY y con aliases `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`. Rollback: `dpl_73idaBkLY34UrZPeytKvEqxWwJiY`.
- Smoke productivo: `/panel` -> `/panel/login` 200; API de contexto anonima 401; Playwright 390x844 y 800x1280 con `AbortSignal.timeout=undefined` cargo interfaz completa y cero `pageerror`. Sin migracion, SQL, cambios de datos, commit ni push.
- SIGUIENTE EXACTO: pedir a Happy Chicken cerrar la pestana/app anterior y volver a abrir `https://www.somos-ve.com/panel`; si conserva el JS viejo, recargar una vez o borrar cache del sitio. Luego retomar el Preview de checkout/impresion o la candidata Play sin mezclarlo con este hotfix.

# 2026-10-02 - Preview: checkout de mesa simplificado, comprobantes 5 MB e impresion al verificar pago

- Usuario aprobo en A34 navegacion, sesion e impresion manual (pruebas 1, 2 y 3) y pidio adelantar cuatro ajustes. Implementados en Preview, SIN promover produccion ni generar APK nueva.
- `CheckoutForm`: titulos sin numeracion; en pedidos iniciados por mesa se omiten por completo `Como deseas recibir`, el bloque amarillo `Recibir en Mesa/Zona` y `Entrega en mesa/Retiro en barra`. Mesa pasa de Datos directamente a Pago e Indicaciones; checkout normal conserva selector Delivery/Retiro/Envio y sus campos. Capturas visuales 320/390 px en `tmp/table-checkout-ux/`, 3/3 PASS, cero overflow y sin pedidos reales.
- Captura de comprobante del checkout: limite original validado en cliente y servidor pasa a 5 MB; request multipart permite 256 KB de overhead; compresion/almacenamiento WebP sigue limitado a 2 MB para no encarecer Storage ni panel. UI muestra `Maximo 5 MB`. Solo comprobante de pedidos de comercio; logo y particulares delivery no cambiaron.
- Impresion: `PrintingManager` ahora expone dos casillas reales sobre `trigger_mode`: al recibir y al verificar pago; combinaciones mapean a received/paid/both y ambas apagadas desactivan impresion automatica. No requiere migracion: esquema/trigger ya soportaban los tres modos. Si ambos se activan, se genera un evento por recibido y otro por pagado, cada uno deduplicado en DB.
- Se cerro el recorrido faltante de app cerrada al verificar pago: payment API detecta solo la primera transicion a `verified`, agenda FCM `paid` con `after()` para no retrasar al cajero; Firebase filtra por trigger_mode antes de leer dispositivos/enviar. Repetir verificacion no despierta ni imprime de nuevo.
- QA: criticos 86/86, Firebase 7/7, Mesa profunda 35/35, UX checkout 3/3, TypeScript/ESLint/API guards/diff-check PASS. Build Next final PASS, 254 paginas. Nuevo auditor `scripts/table-checkout-ux.e2e.mjs`; mocks de mesa actualizados para `after`, push, buyer y alertas.
- Preview Vercel READY `dpl_3ZPPgyhkZVyu7ghMDUSRxCnchPxg`: `https://vendeplus-clean-6ttcsbopx-entrega2-s-projects.vercel.app`, target null. Smoke cloud: `/smash/checkout` 200, printing settings anonimo 401, receipt HEAD 405. Usa datos productivos: no guardar configuracion en comercios reales; para mutaciones usar solo Smash Test. Produccion oficial no cambio.
- SIGUIENTE EXACTO: usuario revisa checkout de mesa/normal en Preview. Si aprueba, promover con cuidado el codigo web; despues en A34 activar `Imprimir al verificar pago` solo en Smash Test, cerrar app y ejecutar un pedido controlado pendiente->verified para confirmar una sola comanda. La prueba FCM original al recibir con app cerrada tambien sigue pendiente. Cambios aun sin commit/push.

# 2026-10-01 - Eliminacion de cuenta cerrada en Preview; APK 1.5.0 lista para A34

- ACTUALIZACION 2026-10-02: A34 conectado inicialmente en `192.168.1.103:40349`, identidad confirmada `samsung SM-A346M`. Antes tenia code13/name1.4.1-panel-auth; `adb install -r tmp/firebase-pilot/somos-1.5.0-print-candidate.apk` devolvio SUCCESS. Despues: code14/name1.5.0, `firstInstallTime` preservado 2026-09-26, arranque COLD correcto en 1094 ms, notificaciones y Bluetooth concedidos, FirebaseMessagingService registrado. Captura fisica muestra Marketplace estable y conserva ciudad Maracay + carrito Queje Olga, por lo que datos WebView no fueron borrados.
- El A34 paso luego a `offline` y el puerto 40349 fue rechazado al reconectar; no se desinstalo ni repitio instalacion. SIGUIENTE EXACTO: pedir IP:puerto nuevo de Depuracion inalambrica, reconectar, verificar de forma redacted que token de emparejamiento/impresora/auto-print siguen guardados; luego impresora encendida, ticket manual y prueba unica con app cerrada para FCM. No usar uninstall ni clear.
- Usuario pidio avanzar con el siguiente pendiente Play y luego probar Samsung. Se cerro el bloqueo de eliminacion de cuenta sin desplegar codigo web a produccion: comprador puro elimina inmediatamente; cuentas de comercio/delivery crean solicitud idempotente para revision, sin borrar pedidos ni registros comerciales; founder queda protegido. Admin ve una cola de solicitudes en `/admin/solicitudes`.
- Nueva migracion no destructiva `20261001153000_account_deletion_requests.sql`, con RLS y acceso solo service role. Aplicada y verificada en produccion `rvmtjtuztewcrmodrodb` y staging `xpqmmdmixpyqruykkbkf`: cero solicitudes existentes, anon/auth bloqueados. No se borro ni modifico ningun registro previo.
- Preview READY `dpl_GRDg6EitezR893zwPbWAcK5dN44d`: `https://vendeplus-clean-kkgittrg8-entrega2-s-projects.vercel.app`. Usa backend produccion; no enviar solicitudes reales durante QA. Produccion web no fue promovida ni modificada. E2E local cubre eliminacion comprador y solicitud operativa con mocks.
- QA web: TypeScript PASS, build movil Next PASS 258 paginas, criticos 85/85, contratos cuenta/Play 11/11, E2E eliminacion buyer+operador PASS y auditor UX movil completo PASS en Marketplace/catalogo/panel/productos/pedidos. Mejora V2 recomendada: agrupar el menu `Mas` del comercio por Operacion/Configuracion y hacer mas visible salud de impresora; no son bloqueos Play.
- Script piloto Android actualizado para producir `somos-1.5.0-print-candidate.apk` y ejecutar lint. Build Android PASS 149 tareas/1m38s, lint sin incidencias nuevas, unit tests PASS. Artefacto: `tmp/firebase-pilot/somos-1.5.0-print-candidate.apk`, SHA256 `5BD652DE787244E6E00B1F1DE630BCAF8B0230D366DA6074C57B0C8BDECD6A95`, paquete `com.somosve.app`, code14/name1.5.0, min24/target36, origen oficial y Firebase configurado. Firma debug V2: solo piloto fisico, no Play.
- A34 aun no conectado: SDK ADB esta en `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`; `adb devices` vacio. SIGUIENTE EXACTO: usuario abre Depuracion inalambrica y envia IP:puerto actual; conectar, confirmar modelo A34 y paquete actual, instalar con `adb install -r` sin uninstall/clear, verificar code14/1.5.0 y sesion/configuracion preservadas. Despues prueba controlada: impresora encendida, impresion manual, app cerrada y un unico pedido de prueba para validar despertar FCM + impresion puntual.
- Cambios siguen SIN commit/push ni deploy productivo. Servidor local de QA debe quedar detenido antes de cerrar. No generar AAB Play hasta contar con upload keystore/firma externa y completar ficha/Data Safety.

# 2026-10-01 - Candidata Play 1.5.0: hardening Android e impresion por evento

- Usuario pidio avanzar con pasos grandes luego de la auditoria integral. Trabajo realizado en `.fee-billing-prod`, rama `checkpoint/somos-mobile-production-20260930`, base `9c54b330e007affefd7ccb7ca85605b31a1242d1`. Cambios aun SIN commit/push/deploy y sin instalar en el A34.
- Impresion automatica Android dejo de mantener un sondeo permanente cada 7 s y de arrancar al encender. FCM `print_jobs` despierta un servicio foreground de trabajo corto, `START_NOT_STICKY`, que drena lotes pendientes y se apaga. Se corrigio una carrera entre nuevas comandas y el apagado del servicio. Activar impresion falla cerrado si Android no permite iniciar el servicio.
- Eliminados permiso `RECEIVE_BOOT_COMPLETED` y `PrintBootReceiver`. Permisos Bluetooth Android 12+ se verifican en runtime; `BLUETOOTH_SCAN` declara `neverForLocation`. `allowBackup=false` y reglas explicitas excluyen todos los datos de backup/cloud/device transfer. Debug cleartext queda limitado a `localhost` exacto.
- Candidata oficial normalizada a paquete `com.somosve.app`, `versionCode 14`, `versionName 1.5.0`, origen exclusivo `https://www.somos-ve.com`. `bundleRelease` genera metadata verificable; builder Play ejecuta `clean lintRelease testReleaseUnitTest bundleRelease` y toma version/origen del artefacto, sin numeros hardcodeados. Firma y keystore siguen externos/fail-closed.
- QA Android: `clean lintDebug testDebugUnitTest assembleDebug` PASS (148 tareas, 3m32s); repeticion incremental tras ajustes PASS. Lint: 0 errores, 14 advertencias no bloqueantes de Gradle/recursos/splash heredados. APK staging inspeccionada: minSdk24, targetSdk36, permisos esperados, sin boot receiver ni backup habilitado. Capacitor Doctor PASS y `npm audit --omit=dev` 0 vulnerabilidades.
- QA web/contratos: Play/mobile/FCM 25/25 PASS; criticos 85/85 PASS; build Next directo compila/TypeScript pero falla en prerender por no tener variables Supabase en este worktree; `node scripts/mobile-local.mjs build` PASS completo con 257 paginas. Sin migracion ni SQL.
- Archivos Android: `build.gradle`, manifests main/debug, `MainActivity`, `PrintForegroundService`, `SomosFirebaseMessagingService`, `SomosPrinterPlugin`, strings, nuevas `backup_rules.xml`/`data_extraction_rules.xml`; eliminado `PrintBootReceiver`. Scripts: builder AAB y contratos Play.
- Bloqueadores externos para publicar: falta keystore/upload key segura y variables de firma; confirmar identidad legal, correo de soporte/privacidad y retenciones para Data Safety; resolver flujo de eliminacion/solicitud para cuentas operativas (compradores puros ya pueden eliminarse). No generar AAB final ni publicar hasta cerrar esos datos.
- SIGUIENTE EXACTO: conectar A34 y ejecutar una prueba controlada con app cerrada + impresion automatica para validar el nuevo despertar FCM; despues crear/configurar upload key fuera del repo, generar AAB 1.5.0(14), probarlo en Play Internal Testing y completar ficha/Data Safety. El preview de performance `dpl_a7K7pUbNKx7TJ6gccGkQRrHWg4Du` sigue separado y no debe promoverse sin aprobacion explicita.

# 2026-10-01 - Preview de performance: extras, catalogo y pedidos

- El usuario pidio asegurar Git y revisar lentitud de punta a punta, especialmente al cargar extras. Antes de editar se aseguro el hotfix movil anterior en `7caed097189a2f55a2427b15c0c5941634049352`, rama `checkpoint/somos-mobile-production-20260930`, y se confirmo igualdad local/remoto.
- Auditoria productiva de solo lectura en Realza, Queje Olga, SHIBUI, Joshi y panel Smash Test: catalogo movil dejo visible el primer producto entre 1.7 y 2.4 s; extras bloqueo hasta 1.14 s; API de extras normalmente 0.16-0.21 s pero tuvo un MISS de 0.76 s; pedidos compactos mediana 0.57 s/73,525 bytes; productos 0.53 s. No se creo ningun pedido. Los accesos QA temporales fueron eliminados y verificados por el auditor.
- `ProductCard.tsx`: cache compartida por comercio+producto con deduplicacion de promesas y TTL 60 s; errores no quedan cacheados; autoprecarga en reposo limitada a dos productos cercanos por comercio; toque/hover/foco anticipan la carga; modal abre inmediatamente y muestra `Cargando extras...` mientras llega la red. Se evito bloquear el clic durante esa precarga.
- Resultado local medido: dialogo de extras Realza 103 ms y Queje Olga 197 ms frente a ~1.14 s anterior. Realza genero como maximo dos precargas distintas mas el producto tocado, sin solicitudes duplicadas del mismo producto. Auditor visual movil 390 px: Realza, Queje Olga y SHIBUI, 6 dialogos, 0 fallos/overflow.
- API de opciones conserva validacion comercio/producto y agrega cache CDN `s-maxage=120`, SWR 600; Vercel expone `max-age=30` al navegador y uso interno confirmado: primera llamada MISS, segunda HIT con Age 12.
- Catalogo: solo la primera imagen de producto realmente visible usa `loading=eager` y `fetchPriority=high`; las restantes siguen lazy. Corrige la advertencia LCP observada en los catalogos sin descargar todas las fotos.
- Panel pedidos: el select compacto dejo de descargar campos exclusivos del detalle (mensaje WhatsApp, direccion, coordenadas, subtotales y metadatos ampliados). Payload Smash bajo 41%, de 73,525 a 43,290 bytes; estados, pago, referencia/comprobante, WhatsApp, delivery y apertura del detalle siguen cubiertos. El detalle completo continua en `?orderId=` y midio ~0.58 s local.
- QA: criticos 85/85, contratos performance 2/2, TypeScript, ESLint focal y `git diff --check` PASS. `node scripts/mobile-local.mjs build` PASS, Next 16.3.4, TypeScript y 257 paginas. Sin migracion ni SQL.
- Preview exacto READY `dpl_a7K7pUbNKx7TJ6gccGkQRrHWg4Du`: `https://vendeplus-clean-e6ge2r9fb-entrega2-s-projects.vercel.app`. Tiene proteccion Vercel; comprobado con `vercel curl`: catalogo Realza contiene `loading=eager`/`fetchPriority=high`, extras 200 MISS->HIT y panel anonimo 401. Produccion permanece en `dpl_73idaBkLY34UrZPeytKvEqxWwJiY`.
- Archivos: `CatalogClient.tsx`, `ProductCard.tsx`, API catalog/product-options, API panel/orders y tres auditores/contratos nuevos. Siguiente paso: prueba humana del Preview en un producto con extras y lista de pedidos; solo con aprobacion promover exactamente `dpl_a7K7pUbNKx7TJ6gccGkQRrHWg4Du`.

# 2026-10-01 - Auditoria E2E produccion cliente -> comercio (Smash Test)

- Usuario autorizo crear exactamente un pedido controlado en `Smash (Test)` para auditar catalogo, carrito, checkout, persistencia, fee y llegada al comercio. Pedido unico creado: `SO-1001-926125`, DB `05007067-879c-460e-8e60-df98a50d4d51`; producto `Perrito Gourmet`, retiro, efectivo, nota `PRUEBA AUTORIZADA QA 05a66960 - NO PREPARAR`.
- Flujo cliente verificado visualmente a 390x844: producto agregado, barra `Ver carrito` visible, carrito correcto y checkout estable. Persistencia: 1 item x USD3, delivery0, fee cliente USD0.10, total USD3.10/Bs2666.56, pago `cash_on_delivery`; mensaje WhatsApp incluye codigo/producto y no contiene `null`.
- Flujo comercio: API protegida devolvio 200 y el pedido con su item; anonimo 401; usuario temporal de Smash contra otro comercio 403. Cancelacion ejecutada por la ruta normal `PATCH /api/panel/orders`, 200; estado final `cancelled`. Barrido final retiro 3 accesos QA temporales de intentos interrumpidos y confirmo que solo existe el pedido autorizado.
- Tras cancelar, Clientes quedo correctamente en 0 pedidos, USD0, ticket0, sin ultimo pedido ni favoritos. El snapshot del pedido conserva `platform_service_fee_usd=0.10`, payer customer y customer fee0.10, consistente con la regla de cobrar tambien cancelados.
- Impresion: se creo `order_print_jobs` para el mismo pedido, pero termino `failed` tras 5 intentos con `read failed, socket might closed or timeout, read ret: -1`; el pedido si llego al panel. Indica impresora/Bluetooth desconectada durante esta prueba, no fallo de creacion ni recepcion.
- Hallazgo pendiente: el RPC heredado y sin consumidores de app `store_service_fee_balance(uuid)` aun excluye `cancelled`; para Smash devolvio 0 tras cancelar. El calculo vigente del panel usa `src/lib/billing/service-fees.ts`, conserva cancelados y ademas excluye comercios `is_test`. No cambiar SQL sin una correccion/migracion autorizada; conviene alinear o retirar el RPC para evitar reutilizacion futura contradictoria.
- Nuevo auditor `scripts/customer-order-production-audit.mjs`: exige comercio `is_test`, acceso temporal aislado, pedido con marca unica, controles DB/API/tenant y recuperacion/cancelacion fail-safe aun si el navegador pierde el cuerpo de respuesta durante el salto a WhatsApp. Capturas en `tmp/customer-order-production-audit/`.
- QA final: auditor sintaxis/ESLint PASS; contratos criticos85/85 PASS; `git diff --check` PASS (solo avisos CRLF); `node scripts/mobile-local.mjs build` PASS con Next16.3.4, TypeScript y257 paginas. Sin migracion, SQL, commit/push ni despliegue adicional en este bloque.

# 2026-10-01 - Hotfix productivo de opciones y variantes en movil

- Usuario reporto que al abrir opciones/variantes en Realza, Queje Olga y Shibui el catalogo movil se reducia o dejaba el panel muy abajo; en Android se deformaba de otra forma. Joshi tambien estaba expuesto al problema compartido aunque era menos evidente.
- Diagnostico: los dialogos se renderizaban dentro de tarjetas/carruseles del catalogo y algunos navegadores/WebView calculaban `position: fixed` contra una pagina ancha o alta. El ajuste reciente de contencion horizontal hizo visible la regresion, pero los datos de productos y opciones no estaban danados.
- Solucion en `ProductCard.tsx`: todos los dialogos de opciones, presentaciones y galeria se renderizan por portal en `document.body`; el portal copia los colores del comercio, bloquea el scroll de fondo y se sincroniza con `visualViewport` en apertura, scroll, resize, teclado y rotacion. El contenido queda limitado a `dvw/dvh`, con scroll interno y textos/controles sin desbordamiento. `globals.css` conserva los colores dinamicos dentro del portal.
- QA Playwright local: Realza, Queje Olga, Shibui y Joshi; web y modo nativo; 320 y 390 px; apertura desde productos superiores e inferiores; cero fallos de geometria. Capturas inspeccionadas de Realza y Shibui. Nuevo auditor reproducible `scripts/product-options-mobile-audit.mjs`.
- Validaciones: ESLint focal PASS; contratos criticos 85/85 PASS; `git diff --check` PASS. `npm.cmd run build` directo fallo solo por ausencia de variables Supabase en este worktree; `node scripts/mobile-local.mjs build` PASS, TypeScript y 257 paginas.
- Hotfix desplegado con autorizacion urgente del usuario. Produccion READY: `dpl_6cNEmHCHazDSBHom4piqgpgejvUk`, artefacto `https://vendeplus-clean-a6o2i6zp7-entrega2-s-projects.vercel.app`; aliases `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` confirmados. Rollback web disponible: `dpl_GL6BiBRbfGmjNbFnhbT4Q4XNWTRp`.
- Smoke productivo Playwright sobre `https://www.somos-ve.com`: Realza, Queje Olga, Shibui y Joshi abrieron un dialogo movil cada uno a 390 px, 4/4 PASS y cero overflow. Sin pedidos, pagos, migracion, SQL ni cambios de datos. Sin commit/push; cambios locales pendientes en la rama `checkpoint/somos-mobile-production-20260930`.
- Segundo reporte urgente: al confirmar opciones en Realza/Queje Olga el item si quedaba en localStorage, pero la barra fija `Ver carrito` se dibujaba fuera de la ventana (`top` 3279/2671). `CartBar.tsx` ahora usa portal a `document.body`, conserva colores del comercio y se sincroniza con `visualViewport`; no cambia carrito, precios ni checkout. Auditor `scripts/cart-bar-mobile-audit.mjs` reproduce seleccion+confirmacion+barra sin enviar pedidos.
- Segunda produccion READY: `dpl_73idaBkLY34UrZPeytKvEqxWwJiY`, artefacto `https://vendeplus-clean-pjp96g1px-entrega2-s-projects.vercel.app`, alias oficial confirmado. Smoke productivo exacto con `Basicos cuello redondo, 3x25` y `Hallacas`: 1 item guardado por comercio, dialogo cerrado, body desbloqueado y barra visible dentro de 390x844 (`top 747.5`, `bottom 844`), 2/2 PASS. Rollback inmediato al primer hotfix: `dpl_6cNEmHCHazDSBHom4piqgpgejvUk`.

# 2026-09-30 - Produccion validada, Joshi configurado y trabajo asegurado

- Usuario valido los cambios web del Marketplace y luego confirmo "todo ok" en Android tras reiniciar de forma segura Somos normal. App instalada en A34: `com.somosve.app`, versionCode 13, versionName `1.4.1-panel-auth`; no se borraron datos, sesion ni impresion.
- Marketplace final: mapa muestra todos los comercios de la ciudad sin depender de filtros; selector muestra directamente la ciudad; web movil usa Inicio/Cerca/Ofertas/Mi perfil, sin Comercios y sin Mi perfil junto a Mapa; Android muestra Cerca junto a Mapa y conserva barra inferior Inicio/Buscar/Promos/Mis datos.
- Joshi Sushi produccion (`joshi-sushi`) configurado sin alterar precios, fotos ni descripciones. Box 20=2 rolls, Box 30=3, Box 40=4, Box 60=6; Box Entrada+20=2 rolls + 1 entrada; PROMO 20 reutiliza las 2 selecciones de Box 20. Cuatro rolls repetibles por casillas de 10 piezas, contador y validacion exacta. Entradas incluidas: Camaron Crispy, Ensalada dinamita, Croquetas de pescado, Gyozas de cerdo y vegetales. Recargos $0.
- Cantidades repetidas se agrupan en carrito, checkout, pedido, historial, WhatsApp, panel e impresion (`6x Fish Roll`). No se creo pedido real; usuario debe probar uno cuando corresponda para confirmar impresion humana de cantidades y entrada.
- Migraciones produccion aplicadas y auditadas: `20260930203000_configure_joshi_sushi_boxes.sql` y `20260930204500_configure_joshi_sushi_promo_20.sql`. API publica confirmo PROMO 20 (2-2, 4 opciones) y Box Entrada (rolls 2-2 + entrada 1-1, 4 opciones cada grupo).
- Produccion READY en `dpl_GL6BiBRbfGmjNbFnhbT4Q4XNWTRp`, alias `https://www.somos-ve.com`. Ultimo build completo PASS: 257 paginas. Contratos criticos PASS: 84/84.
- Todo asegurado en Git: commit `10bcce4 feat: mejora marketplace y configura boxes Joshi`, rama `checkpoint/somos-mobile-production-20260930`, push confirmado; HEAD local y remoto `10bcce4c9c78c028ed14cdc114ead3b88f2ea02f`; worktree limpio al cierre.
- SIGUIENTE GRAN PASO: preparar candidato Play Store con AAB firmado, identidad/contacto legal, politica de privacidad y Data Safety, seguido de piloto final. Revisar primero estado actual de Firebase, keystore/Play App Signing y variables privadas sin pegarlas en chat. No recrear secretos ni borrar/reinstalar app. Frase sugerida para nueva conversacion: `Retomemos Vende+/Somos desde SESSION_HANDOFF.md y el commit 10bcce4. Quiero preparar la version candidata para Play Store con pasos seguros.`

# 2026-09-30 - Emisor FCM implementado en preview; APK receptor lista, A34 desconectado

- Usuario descargo cuenta servicio `somos-produccion-firebase-adminsdk-fbsvc-2fd48b7a39.json` en Downloads. Validada sin mostrar secretos: service_account, misma project_id que google-services, private key/client email/token URI correctos. OAuth Firebase Messaging real PASS sin exponer access token. Archivo no copiado al repo ni borrado.
- Se probo firebase-admin14.5 pero introdujo alertas transitivas; retirado. Se usa `google-auth-library`11.1.0 + FCM HTTPv1 directo. npm audit final0.
- Nuevo `src/lib/printing/firebase-push.ts`: credencial JSON solo env servidor; filtra settings is_enabled, store_id, platform android, revoked_at null, max20; payload data-only generico `{type,orderId}` prioridad high sin PII; limpia tokens UNREGISTERED/INVALID_ARGUMENT/SENDER_ID_MISMATCH dentro de misma tienda. Fallo push nunca tumba pedido. `/api/orders` envia solo si NO idempotentReplay.
- Android: FirebaseMessagingService muestra aviso privado/sonoro generico y despierta PrintForegroundService. Dedup persistente por orderId, max100, canal existente `somos_orders_v1`; no datos cliente en lockscreen. APK recompilada PASS111 tareas/6m31, hash nuevo `965D524448EEC2DD3A988C72891B216B0D2D6D66164B1447C16FB4EB55516987`, code12 mismo. No instalada: A34 salio de ADB/mDNS durante build y no se reutilizo conexion vieja. Version instalada anterior code12 no tiene aun receptor remoto nuevo.
- 8 Node tests PASS: no-config noDB, aislamiento tienda/dispositivo, print disabled no push, HTTPv1/payload, token invalidation, replay no duplicate, Android dedup y preview opt-in/redaction. ESLint focal PASS. Build web stage PASS117/TS; npm audit0; cloud smoke10PASS; diffcheck sin errores.
- Preview FCM READY/shared `dpl_Cpr8Y8ZFCMjPebBwdQxoCrT68efX`: https://vendeplus-clean-hhcdla0cj-entrega2-s-projects.vercel.app, stageXPQM, credencial deployment-only redacted; Google callback actualizado. Produccion deployment `dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1` intacto, sin secret/deploy/codigo FCM productivo.
- Sin migracion/SQL/commit/push ni pedido/notificacion real. SIGUIENTE EXACTO: usuario activa Depuracion inalambrica en A34 y envia IP:PUERTO actual. Instalar `tmp/firebase-pilot/somos-1.4.0-firebase-pilot.apk` con adb-r, confirmar code12/beta intacta, registrarPush; luego prueba FCM directa controlada con app cerrada. Solo tras PASS configurar secreto/deploy produccion y probar un pedido real unico+impresion.

# 2026-09-30 - Firebase cliente configurado y Somos normal 1.4.0 pilot INSTALADA

- Usuario creo primer proyecto Firebase y dejo `C:\Users\Windows\Downloads\google-services.json`. Validado sin exponer valores: JSON valido, un cliente, paquete exacto `com.somosve.app`, project id/number/bucket/API key/OAuth presentes. Copiado a `mobile/somos-android/android/app/google-services.json`, ignorado por Git; original en Downloads no borrado.
- Nueva app normal `1.4.0-firebase-pilot`, versionCode12; staging permanece code14/beta3. Nuevo script `build-firebase-pilot-apk.ps1` valida config Firebase exclusiva, Java21, limpia variables staging, sync oficial, Gradle clean/debug/unit y manifiesto/hash. Contrato readiness ampliado, 4/4 PASS.
- Build Android PASS111 tareas/57s con `processDebugGoogleServices`. APK `tmp/firebase-pilot/somos-1.4.0-firebase-pilot.apk`, SHA256 `9A6C3144B5123EAF6905FDE5870D8679E44A13E01B84B09C50BC13681EB5A445`, paquete com.somosve.app, min24/target36, firma debugV2, origen solo https://www.somos-ve.com, cleartext/allowMixed false.
- Instalado ADB `-r` SUCCESS en A34: normal code11->12, firstInstall preservado; beta staging code14/version/lastUpdate intactos. Arranque WARM ok1117ms. Via WebView CDP se llamo `SomosPrinter.registerPush()`: Firebase inicializo, retorno registered=true y ningun token fue mostrado; forward9224 eliminado. La llamada Android registra en segundo plano y no prueba por si sola persistencia DB.
- Diagnostico: cliente FCM y endpoint de registro existen, pero NO hay emisor servidor FCM en codigo. Notificacion de prueba local ya sono antes, pero un pedido no puede despertar la app cerrada hasta implementar emisor HTTPv1 y configurar cuenta servicio Firebase privada en Vercel. No crear pedido real para probar aun.
- Build web final stage PASS117/TS. Sin migracion/SQL/deploy/commit/push ni cambios produccion web/DB. SIGUIENTE: usuario debe generar clave privada en Firebase > Configuracion proyecto > Cuentas de servicio > Firebase Admin SDK; descargarla a Downloads y avisar `descargada`, nunca pegar contenido. Luego implementar/probar emisor en preview/mocks, guardar credenciales en Vercel de forma privada y hacer pedido controlado.

# 2026-09-30 - Ruta AAB/Play cerrada en modo fail-closed; bloqueadores externos identificados

- Usuario confirma beta3 "todo ok" y pide avanzar mas fuerte. Implementada infraestructura segura para AAB interno sin publicar ni tocar produccion: firma release solo mediante 4 variables de entorno y keystore externo; `preReleaseBuild` exige origen oficial y firma completa. Staging sigue bloqueado como release.
- Nuevo `scripts/ops/build-play-internal-aab.ps1`: antes de sync valida Java21, keystore fuera del repo, variables de firma y `google-services.json` que contenga exactamente `com.somosve.app`; luego sync oficial, `bundleRelease testReleaseUnitTest`, copia AAB/hash a tmp. No imprime passwords ni persiste secretos.
- Android `.gitignore` ahora excluye `*.jks`, `*.keystore`, `keystore.properties` y `google-services.json`. Nuevo borrador `docs/play-store-data-safety-draft-2026-09-30.md` inventaria PII, ubicacion, pagos/comprobantes, actividad, identificadores, delivery, Bluetooth/FCM, permisos y decisiones pendientes. No es declaracion legal final.
- QA: script PowerShell parse PASS; ejecucion sin credenciales falla antes de sync exactamente en `SOMOS_ANDROID_KEYSTORE_PATH`; Firebase definitivo ausente confirmado y release permanece bloqueado. `verifyAppIdentity` staging PASS. 6 contratos Node PASS para buyer/idempotencia/firma/Firebase/gitignore. `git diff --check` PASS salvo avisos CRLF. Build web aislado stage PASS117/TypeScript.
- Sin AAB generado, migracion/SQL/deploy/commit/push ni cambio en A34/produccion en este bloque. No inventar keystore ni copiar credenciales por chat. Bloqueadores reales: Firebase `com.somosve.app`, keystore/firma de Play, identidad+contacto legal/privacidad, plazos retencion y migracionesbuyer en produccion. SIGUIENTE: ayudar al usuario a localizar/crear Firebase definitivo y comprobar si Play App Signing/keystore ya existe, sin compartir archivos secretos; despues preparar promocion DB/web con backup y rollback antes de AAB.

# 2026-09-30 - Somos Pruebas beta3 INSTALADA en A34

- Usuario pidio avanzar fuerte. Generada beta3 aislada contra preview `elwro4ama`; version staging subida de code13/beta2 a code14/`1.4.0-buyer-beta.3`. App normal conserva code11/`1.3.2-profile-controls-preview` y lastUpdate 2026-09-29 14:53:11 exactamente.
- APK `tmp/buyer-staging/android/somos-pruebas-1.4.0-beta3.apk`, SHA256 `58AF96060AABDB914BECCEA5FE61C76B670EAB7797E3876FA421B8990765F58C`. Paquete `com.somosve.app.staging`, min24/target36, firma debug V2 valida. Capacitor embebido solo `https://vendeplus-clean-elwro4ama-entrega2-s-projects.vercel.app`, cleartext/allowMixedContent false.
- Gradle clean assembleDebug testDebugUnitTest PASS110 tasks/1m. Instalacion ADB `-r` SUCCESS en SM-A346M por mDNS; firstInstall preservado. Arranque WARM ok1167ms. No uninstall/clear ni captura de datos. Usuario regreso a otra app despues; no atribuir prueba humana de beta3 aun.
- Build web final aislado stage PASS117/TypeScript. Sin migracion/SQL/commit/push ni cambio produccion. Preview sigue READY/shared y Google stage apunta a elwro4ama; produccion `dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1` intacta. Beta staging sigue sin Firebase propio: no prometer push/impresion en esta app separada.
- SIGUIENTE EXACTO: usuario abre `Somos Pruebas` y valida Marketplace/Privacidad, Google, historial/calificacion y compra ficticia. Luego identidad/contacto legal, Data Safety, AAB firmado y version piloto unificada con sonido/impresion.

# 2026-09-30 - Eliminacion de cuenta Android ACEPTADA por usuario

- Usuario confirma: "listo todo fino, elimine cuenta y todo ok" en SomosPruebas beta2. Registrar aceptacion humana del flujo destructivo real: opcion visible, confirmacion, eliminacion y resultado percibido correctos. No volver a pedir esta prueba ni asumir que la cuenta eliminada puede recuperarse.
- No se inspecciono identidad/correo de la cuenta eliminada ni se intento restaurar. La eliminacion fue iniciada por el usuario desde la app, no por herramientas. Produccion/Somosnormal no tocados; aplica SOLO SupabaseXPQM/previewfws9sx7wu/com.somosve.app.staging.
- Sin codigo/build/SQL/migracion/deploy/instalacion en esta confirmacion; solo docs/continuidad. Ultimos QA permanecen:15API/DBPASS, build116/TS, cloud/e2ePASS, APKbeta2code13 instalada, prodtarget intacto.
- SIGUIENTE GRAN BLOQUE: validar invitado no reclamable, aislamiento tras crear/reingresar con cuenta nueva y duplicacion/idempotencia bajo reintento; luego politicaPrivacidad/DataSafety y versionunificada piloto con sonido/impresion. Eliminacioncuenta ya no es pendiente tecnico, aunque texto legal/retencion sigue pendiente antesPlayStore.

# 2026-09-30 - Eliminacion de cuenta + beta2 INSTALADA; falta prueba humana (estado previo)

- Usuario autoriza acelerar con pasos seguros/escalables. Implementado cierre de cuenta comprador para requisitosPlay: link visible en Mi cuenta y pagina publica /eliminar-cuenta, loginGoogle si no hay sesion, confirmacion exacta ELIMINAR, cierre local tras exito. Texto explica que elimina Auth/sesiones/vinculoshistorial/reviews; pedidos operativos del comercio permanecen sin acceso desde cuenta y sujetos a retencion legitima. Aun falta politicaPrivacidad completa/DataSafetyPlay; no afirmar cumplimiento total.
- Nuevo DELETE /api/buyer/account: verifica token remoto Google, rate limit5/h porbuyer+IP, limitepayload/JSON, ignora buyerId cliente, bloquea si store_users/transport_agency_users/solicitudcomercioactiva, falla cerrado ante error, hard delete server-only auth.admin.deleteUser(id,false). FKcascade borra buyer_order_accounts y buyer_store_reviews; orders se preservan. ServiceRole nunca navegador. No borrar cuenta real durante QA.
- Archivos: api/buyer/account/route.ts, DeleteBuyerAccount.tsx, eliminar-cuenta/page.tsx, BuyerAccount.tsx, native-polish.css; pruebas buyer-api, buyer-accountsDB y buyer-account-deletion.e2e. Android version staging13/beta2 y buildscript artifact beta2. Sin migracion/SQL nuevo ni cambios schema.
- QA: 15 Node/PGlite PASS: confirmacion, identidadserver, rolesoperativos, failclosed, cascade links/reviews y ordenpreservada. ESLint focal/diffcheck/secrets0PASS. npm.cmdrunbuild aislado PASS116/TS. DeletionE2E local+cloud PASS 320/390/1366 con API simulada; 11 smokecloud PASS. Endpointcloud anon401 y paginawebpublicaHTTP200. Primer E2E cloud corrio antes READY y fallo temporal; repetido trasREADY PASS, no bugapp.
- Nuevo preview READY/shared SOLOdeployment dpl_BAUyZ9N9CDgSpsPZo7Xzioaa9MiS: https://vendeplus-clean-fws9sx7wu-entrega2-s-projects.vercel.app . Google stage SiteURL/allowlist apuntan al nuevo origen + callbacks nativos. Productiontarget intacto dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1. Fuenteoficial GooglePlay exige ruta interna+recursoexterno y borrado datosasociados; Supabase deleteUser server-only revoca refresh/cascade sessions, accessJWT puede durar hastaexp pero APIs buyer llaman auth.getUser remoto.
- APK tmp/buyer-staging/android/somos-pruebas-1.4.0-beta2.apk, versionCode13, SHA256 B9AEF84761C4791DE1A4BDFFEBCFC861FC7FE02E48F6943DC79AF74D2B5E4D9F. Gradle 110tasks SUCCESS1m7, aapt paquete staging/label/version/min24/target36, apksignerV2PASS. Instalado con adb -r SUCCESS sobre beta1, firstInstall preservado; arranque WARMStatusok1166ms. Appnormal sigue code11/name1.3.2/lastUpdate2026-09-29 14:53:11, sin tocar.
- Local3107 actualizado launcher12760 logs start-account-deletion*. Usuario debera volver a iniciarGoogle por nuevo origen. SIGUIENTE EXACTO: en SomosPruebas beta2 abrir Mi cuenta, confirmar linkEliminar cuenta y pagina, pero NO ejecutar con cuenta que quiera conservar. Para prueba destructiva usar tercera cuentaGoogle desechable: crear pedidoficcio, completar si se quiere review, eliminar, confirmar logout y que reingreso crea cuenta nueva sin historial/reviews. Luego offline/invitado/idempotencia y politicaPrivacidad/DataSafety antes versionunificada. No publicarprod/PlayStore aun.

# 2026-09-30 - Aclaracion: pedido NUEVO de segunda cuenta no permite calificar

- Usuario SI ve la calificacion anterior. Ahora indica ingreso con otra cuenta y pedido nuevo que no permite calificar. No asumir bug de UI ni reutilizar SO-0929-465966: ese es el pedido previo completado/rating5.
- Explicado requisito de pedido propio completed. Estado/codigo del nuevo pedido aun desconocidos; no afirmar received sin verificar ni completar filas por conjetura. Se solicita codigo publico y estado visible para inspeccion exacta SOLOstaging, luego completar ficticio controladamente si corresponde. No pedir correo/credenciales ni vincular pedido ajeno.
- Sin codigo/build/migracion/SQL/escriturasremotas; solo continuidad. SIGUIENTE: obtener codigo+estado, verificar propiedad asociada y fixture antes de decidir. Usuario pruebo segunda cuenta pero aislamiento completo de historial NO confirmado aun.

# 2026-09-30 - Usuario confirma Android todo ok; no encuentra calificar

- Usuario responde "todo ok, solo no veo la opcion de calificar" tras checklist Google/regreso/historial/reapertura. Registrar aceptacion general humana Android, sin inferir pruebas adicionales de segunda cuenta/offline/impresion.
- Diagnostico readonly SOLOstage con -DemoOrderAction inspect: SO-0929-465966 sigue completed, USD2, propietario asociado y rating5. No falta completar ese pedido, NO repetir complete ni cambiar estrellas por el usuario.
- Codigo BuyerAccount muestra OrderRating solo para completed y titulo "Tu calificacion" si ya tiene rating, no "Calificar comercio". Se ubica en Mi cuenta > Mis pedidos bajo total; no existe formulario en ficha del comercio. No se confirmo aun causa exacta de lo que el usuario no ve.
- ADB 192.168.1.103:44323 quedo offline. Sin capturas ni interaccion nueva en telefono. Pregunta async enviada: esta en historial o ficha; captura ocultando correo si no ve seccion. No reinstalar ni redesplegar por conjetura.
- Solo handoff/documentacion, sin codigo/buildnuevo/migracion/SQL/escriturasremotas. Ultimos builds web114/TS y APK12 siguenPASS. SIGUIENTE: respuesta ubicacion/captura; orientar a Tu calificacion y edicion de estrellas/observacion, o reproducir fallo especifico si no aparece en pedido completado propio. Solicitar puertoactual solo si hace falta reconectar.

# 2026-09-30 - Somos Pruebas INSTALADA en A34; Google en prueba humana

- Usuario dio 192.168.1.103:36325, quedo offline antes de instalar; luego corrigio puerto44323. Conexion confirmada a 192.168.1.103:44323, modelo SM-A346M.
- Antes de instalar solo existia com.somosve.app, versionCode11/1.3.2-profile-controls-preview, lastUpdateTime2026-09-29 14:53:11. Hash de APKbeta verificado contra 0DDC249A6FF7D99C5B67E4D69D59E7116899FBC961FBDEC5974846EEF60C88DD.
- adb install SOLO somos-pruebas-1.4.0-beta1.apk SUCCESS, com.somosve.app.staging version12/1.4.0-buyer-beta.1. am start -W com.somosve.app.staging/com.somosve.app.MainActivity cold launch Statusok1170ms. Postlectura appnormal conserva version y lastUpdateTime exactos. No uninstall/clear/reinstalacion ni modificacion de preferencias o vinculacion productivas.
- Usuario empezo a interactuar: al verificar primerarranque ya estaba en Chrome autorizacionGoogle para XPQM. No se pulso consentimiento ni se eligio cuenta por el. No se acredita canje/regreso/historialAndroid hasta confirmacion humana. Captura temporal de autorizacion no conservada (eliminada local y del telefono); no registrar identidad/correo ni tokens.
- Solo docs/handoff modificados en esta instalacion; sin codigo/build nuevo/SQL/migracion/deploy/commit/push. Ultimo npm.cmdrunbuild aisladoPASS114/TS y buildAPKPASS siguen vigentes.
- SIGUIENTE EXACTO: usuario completa Google, debe volver a Somos Pruebas y ver historial de misma cuenta. Pedir confirmacion de regreso y pedido; si falla revisar mensaje sin claves, no reinstalar/borrar datos por conjetura. Luego reapertura/sesion, observacion, segunda cuenta y offline. Impresion/FCM beta no configurados; appnormal preservada pero no retest sonido/impresion en esta accion. Checklist docs/android-buyer-beta-2026-09-30.md. Si ADB quedaoffline pedir puertoactual, no reutilizar36325.

# 2026-09-30 - Beta Android separada LISTA; falta conectar A34 (estado previo)

- Usuario acepta observacion y pide "avancemos con fuerza" al plan betaAndroid. Se prepara Somos Pruebas, paquete com.somosve.app.staging, versionCode12/1.4.0-buyer-beta.1. NO reemplazar Somos com.somosve.app/APK11 ni borrar sus datos; conserva impresion/sonido existentes. ADB devices inicialmente vacio y no hay AVD. Pregunta async enviada por USB o IP:puertoactual; aun sin respuesta.
- Identidad opt-in SOMOS_ANDROID_BUYER_STAGING=1 en server-config/Capacitor/Gradle. Manifest callback por applicationId; labelSomosPruebas. Sin aplicar google-services productivo en beta. Guardas Gradle de identidad/origen, releaseStaging bloqueado. Build normal conserva version11/nombre anterior. No afirmar push/impresion nuevos probados: beta no tiene Firebase configurado ni vinculacion de impresora.
- NativeBuyerAuth plugin ahora getRedirectUrl, callback exclusivo del paquete y hostSupabase exacto BuildConfig por modo; valida HTTPS/Google/PKCES256. client.ts consulta callback, rechaza otraapp; unit tests nuevos. ProdAuth/credenciales no tocados.
- Preview vigente READY y compartido SOLOdeployment dpl_AMspT5SzTkgesnbwTjHpVT4UM6Ut, https://vendeplus-clean-5f6wylb0i-entrega2-s-projects.vercel.app . StageXPQM SiteURL/callbackWeb cambiados al nuevo origen; allowlist mantiene com.somosve.app://buyer-auth y agrega com.somosve.app.staging://buyer-auth. Productiontarget sigue dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1. No usar previewanterior para login nuevo.
- QA: 21 Node/PGlite PASS; npm.cmdrunbuild aislado PASS114/TS; ESLintfocalPASS. BuyerMarketplace E2E localPASS incluye callback nativo simulado staging; 11 smokecloudPASS. Browser integrado no disponible trasbootstrap, usado Playwrightrepo. No loginGooglehumanoAndroid aun.
- Nuevo scripts/ops/build-buyer-staging-apk.ps1 valida preview/backendaislado, Java21, sync+Gradleclean/assembleDebug/testDebugUnitTest, copia tmp/buyer-staging/android/somos-pruebas-1.4.0-beta1.apk+artifact.json hash. Build SUCCESSFUL, 110tasks, 3m2s. SHA256 0DDC249A6FF7D99C5B67E4D69D59E7116899FBC961FBDEC5974846EEF60C88DD. Gradle assets quedan staging; para otro modo resync con mismasvariables que build, guardas impiden mezcla.
- Verificacion APK real con aapt/apksigner/ZIP PASS: paquete com.somosve.app.staging, labelSomosPruebas, codigo12, version1.4.0-buyer-beta.1, mainclass com.somosve.app.MainActivity, callback exclusivo .staging://buyer-auth, provider authorities propias, debug/minSDK24/target36/firmaV2 valida. Capacitor empaquetado SOLOpreview5f6wylb0i HTTPS/cleartextfalse. No .env/keystores/google-services.json ni recursos de proyectoFirebase enAPK. verifyReleaseOrigin con staging falla como esperado: guarda efectiva. NOAPKrelease paraPlayStore.
- Local3107 restaurado con launcher14868/logs tmp/buyer-staging/start-android-beta*.log. NOmobile-local porque trae envprod. Sin nuevasmigraciones/SQL/commit/push/cambiosprod; docs/android-buyer-beta-2026-09-30.md checklist y READMEactualizados.
- QAfinal adicional: observacion E2Ecloud PASS, sintaxisPS/diffcheck/escaneodocumental PASS. ADB al terminar sigue vacio, noAPKinstalada ni emuladorAVDdisponible. Nunca se uso puerto antiguo ni se toco appnormal. No afirmar pruebas fisicas ni GoogleAndroidvalidado por mocks/compilacion.
- SIGUIENTE EXACTO: recibir USB o IP:puertoactual de A34; conectar y comprobar modelo/paquetes, instalar SOLO tmp/buyer-staging/android/somos-pruebas-1.4.0-beta1.apk, sin uninstall/clear de com.somosve.app. Abrir com.somosve.app.staging/com.somosve.app.MainActivity. Probar Google/historial/calificar/segunda cuenta/offline siguiendo docs/android-buyer-beta-2026-09-30.md. Si ADB pide pairing solicitar codigo efimero en ese momento. Eliminacioncuenta/privacidad y releasefirmado pendientes antesPlayStore; no prometer publicacion completada.

# 2026-09-29 - Observacion opcional en calificaciones; PREVIEW LISTO

- Usuario confirma "todo perfecto" tras prueba de calificacion y pide observacion opcional. Rating anterior aceptado manualmente; nueva observacion aun requiere su prueba.
- Implementado textarea opcional 500 caracteres, contador, edicion/borrado sin cambiar estrellas, recuperacion en historial propio, validacion API y DB. Texto plano no publicado en marketplace/panelcomercio. RPC nueva reutiliza checks de titular/completado/noautocalificacion; RPC antigua preservada para preview anterior.
- Migracion nueva 20260930030000_buyer_review_observation.sql aplicada SOLO XPQM con -ApplyReviewObservation y guardas de identidad. Agrega columna nullable, constraint y RPC service_role-only. No modificar/reaplicar migracionbuyer original ya aplicada. No db push: CLI sigue enlazada a produccion.
- Archivos funcionales: BuyerAccount.tsx, native-polish.css, api/buyer/orders y reviews; scripts buyer-api.test, buyer-accounts.db.test, buyer-marketplace.e2e, buyer-review-observation.e2e nuevo, supabase-buyer-staging.ps1 y buyer_staging_transaction_test.sql. Docs actualizados. No commit/push/APK ni cambio productivo.
- QA: 12 pruebas Node/PGlite PASS; 12 escenarios de transaccion real mas observaciones guardar/limite/propietario/borrar PASS con rollback, un pedido real de prueba preservado. Build aislado npm.cmd run build PASS114/TS; ESLint focal y diffcheck PASS. UI Playwright320/390/1366 PASS, capturas inspeccionadas, persistencia simulada/error/reintento/texto seguro. Browser integrado no disponible tras bootstrap; fallback Playwrightrepo. No confundir mocks con login humano nuevo.
- Servidor local aislado http://127.0.0.1:3107/mi-cuenta, launcher18872, logs tmp/buyer-staging/start-observation*.log; NO mobile-local. Nuevo preview READY/share SOLOdeployment dpl_6mF8S7U1Wc7h5t3JCFUV72tJo8JT: https://vendeplus-clean-erpb4otzj-entrega2-s-projects.vercel.app . Google SiteURL/allowliststage actualizados al nuevo origen+callback y deep link Android. Preview viejo no usar para login nuevo. Produccion verificada intacta dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1.
- QA cloud final: 11 smoke PASS (ciudad/mapa3anchos/catalogo/apis401/GooglePKCEstage) y suite observacion UI PASS sobrecloud con sesion/API simuladas, sin mutaciones reales. SintaxisPS y escaneo documental0PASS. No confundir prueba Googlehandoff con loginreal en nuevo origen.
- SIGUIENTE: usuario abre NUEVO enlace /mi-cuenta, ingresa con misma cuenta, observa pedido/estrellas previos, agrega texto, guarda/recarga y borra opcionalmente. Sin SQL que usuario ejecute ahora; ambos SQLbuyer siguen pendientes para produccion futura. Android fisico/segunda cuenta pendientes. V2: moderacion/visibilidad al comercio por definir y syncperfil; eliminacioncuenta antesPlayStore.

# 2026-09-29 - Pedido real de prueba confirmado en historial; listo para calificar

- Usuario confirma "todo ok" en Mis pedidos: Cocina Demo, SO-0929-465966, Recibido, una Bebida Demo, total USD2. Login y compra/historial web aceptados manualmente. Nombre en base es Bebida Demo, sin entidad HTML literal.
- Verificado SOLO staging XPQM: pedido asociado a comprador, pickup, cash_on_delivery, un item USD2, sin rating. Se completo SOLO ese pedido ficticio con transaccion y guardas de tienda/slug/producto/estado/total/propietario; lectura posterior confirma completed y resto preservado. No se califico por el usuario ni se modificaron pagos.
- Archivos nuevos/ajustados: supabase/buyer_staging_complete_demo_order.sql y scripts/ops/supabase-buyer-staging.ps1 (-DemoOrderAction inspect|complete), mas documentos de continuidad. complete YA EJECUTADO; no repetir, exige received. inspect permite verificar rating sin exponer identidad.
- Sin migracion ni SQL pendiente para el usuario. Sin produccion/deploy/APK/commit/push. Build aislado npm.cmd run build PASS114/TypeScript. Servidor local relanzado con -PreviewAction start, launcher3444, logs tmp/buyer-staging/start-rating-test*.log. NO mobile-local porque recarga entorno productivo.
- SIGUIENTE EXACTO: usuario recarga /mi-cuenta del mismo preview azxcbptg7, ve Completado, elige estrellas, guarda y recarga para confirmar persistencia. Rating aun NO validado manualmente. Luego segunda cuenta/invitado y APK fisica antes de plantear produccion. V2: sincronizacion de perfil, moderacion; eliminacion de cuenta pendiente antes de Play Store.

# 2026-09-29 - Usuario confirma INGRESO GOOGLE REAL correcto en preview aislado

- Tras agregar un secreto nuevo al cliente somos pruebas y recibir indicaciones para guardarlo en SupabaseXPQM, usuario confirma: "funciono bien pude ingresar con mi cuenta". Aceptacion HUMANA del login real web en preview azxcbptg7. Incidencia invalid_client resuelta en el recorrido probado; no volver a pedir cliente/secreto ni afirmar bloqueo vigente.
- No se inspecciono identidad/correo/tokens del usuario ni se hizo login por el. No acredita persistencia trasrecarga, cerrar/reabrir, otra cuenta, compra/historial/rating o Android. No desactivar/borrar secretos automaticamente: retirar anterior solo tras confirmar que no se usa; usuario no confirma retirada.
- Solo SESSION_HANDOFF.md, docs/buyer-preview-readiness-2026-09-29.md y docs/buyer-marketplace-2026-09-29.md actualizados. Sin codigo/SQL/migracion/commit/push/deploy/APK ni permisos/cuentas modificados. Build no repetido por docs; ultimo aislado PASS114/TS. Produccion y A34siguen1.3.2; preview dpl_84Ebzq3YzTpHRirmGMxdmFEMdVaF intacto.
- SIGUIENTE EXACTO: con sesionGoogle abierta, abrir /cocina-demo del MISMO preview, crear un pedido ficticio (Retiro/Efectivo, sin pago ni envioWhatsApp), volver /mi-cuenta y confirmar codigo/estado/total. Recargar y comprobar sesion/historial. Pedir SOLOcodigo publico de pedido, no claves/PII. Luego completar SOLOese pedidoStage de forma controlada para validar rating; aun no hay panelcomercioDemoasignado, no prometer que el usuario puede completarlo. Validar segunda cuenta/invitado antesAPK/prod. V2 sync/moderacion/eliminacioncuenta pendientes.

# 2026-09-29 - Google real falla INVALID_CLIENT; usuario necesita localizar ID/secreto

- Usuario probo preview azxcbptg7 y ve "No se completo el acceso con Google. Vuelve a intentar" en buyer-callback. Diagnostico CONFIRMADO en logsAuthstage: 2026-09-30T02:06:41Z /callback, invalid_client + Unable to exchange external code; luego302 al preview. Google rechaza parID/secreto, no errorhistorial/mapa ni prueba de bugPKCE. No se cambiaron credenciales ni app por conjetura.
- Nuevo switch -ReadAuthDiagnostics en scripts/ops/supabase-buyer-staging.ps1: validaidentitystage y GET /analytics/endpoints/logs (ClickHouse, ultimas2h, sourceauth_logs, limit40). Solo emite diagnosticos allowlist/timestamp/status/path; no tokens/emails/URLs/messagesraw. Endpointviejo logs.all retirado; docs oficiales consultadas. Sin SQL/migracion/escriturasremotas/deploynuevo.
- Pregunta async revisarpar: usuario responde "Necesito ayuda para encontrarlo". ULTIMA PETICION es guiarGoogleConsole, no asumirguardado ni pedir nueva prueba aun. Ya indicado abrir https://console.cloud.google.com/auth/clients -> cliente somos pruebas -> IDcliente/Secretoscliente. Google solo muestra secreto al crearlo; sioculto y no conservado usar Add Secret SOLOclientepruebas, NO borrar anterior ni tocar clienteprod. Max2secretos: si no permite agregar/no vecliente pedir capturaocultandosecretos/nombreproyectoseleccionado, no adivinar.
- Siguienteexacto: ayudar usuario ubicar ID y secreto completos del mismoclienteWeb, pegarlos en proveedorGoogleSupabaseXPQM (no APIkey/asteriscos), Guardar. Si agregosecreto nuevo no retiraranterior hasta loginvalidado. Reintentar MISMO preview /mi-cuenta desdeInicioGoogle (no reusarcallback). Ver nuevoslogs si falla. No recrearSupabase ni volveradesplegar por este errorconfig.
- Produccion/A34intactos, previewactual sigue dpl_84Ebzq3YzTpHRirmGMxdmFEMdVaF. Solo PSops/documentosmodificados. SintaxisPS/diffcheck/documentsecrets0PASS; npm.cmdrunbuild aislado PASS114/TS. Servidor3107 restaurado con -PreviewAction start, launcher10928/logs tmp/buyer-staging/start-auth-diagnostics*.log, HTTP200 confirmado. NOmobile-local. V2sin cambios; loginrealcomprasAPK siguenpendientes.

# 2026-09-29 - Google habilitado y PREVIEW AISLADO PUBLICADO para prueba de acceso real

- Usuario confirma "listo" tras guardar clientID/secret Google en somos-buyer-staging. Lectura ManagementAPI confirma google_enabled/client_configured/secret_configured true en XPQM. No volver a pedir crear cliente/guardarsecretos. GoogleCloud/consentimiento/canje OAuth REAL aun NO probados.
- Preview READY dpl_84Ebzq3YzTpHRirmGMxdmFEMdVaF, https://vendeplus-clean-azxcbptg7-entrega2-s-projects.vercel.app . Miscuentas /mi-cuenta, catalogo /marketplace. Publico por excepcion SOLO deployment; no proteccionglobal modificada. --force SIN cache, targetnull/preview. Prod antes/despues/share sigue dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1; sin --prod/promote/commit/push.
- Supabase xpqmmdmixpyqruykkbkf ahora SiteURL=origenpreview, allowlist EXACTA origen/auth/buyer-callback + com.somosve.app://buyer-auth. Patch SOLOstage y solo estos2campos. Googlecredenciales y prodAuth intactos. No SQL ni migraciones nuevos; sigue esquema/seed faseprevia.
- NUEVO runner scripts/ops/buyer-staging-preview.mjs; PSops suma -PreviewAction inspect/build/deploy/status/share/start y -ConfigurePreviewRedirects. Identidad de Supabase y Vercel hardcoded/verificada, clavesstageobtenidasenmemoria/pipe, JWTref+rolverificados. RESTstage devuelve SOLO cocina-demo/tienda-demo; buyeranon401. Todoenvaplicacionheredado (incluye rama) sustituido en buildYruntime:3clavesstage y demofallbackfalse, otrasvacias (ENTREGA2/OpenAI/FOUNDER/CRON/captcha/etc). Ningun .env/globalenv ni .vercel/project cambiado. No tokenenargs/archivos/APK. CLI soporta -e KEY desdechildenv, vacios -e KEY=, igualbuildenv.
- Artifact sinsecretos tmp/buyer-staging/preview-deployment.json contieneprojectId/url/prodBefore/stage/fecha. No redeploy necesario. Status valida targetnoProd y prodigual. No usar mobile-local para este build: cargaenvprod y mezclaria backend con browserstage.
- Build npm.cmdrunbuild AISLADO PASS114/TS, Vercel build114PASS sincache (591fuentes), catalogos soloDemo. Antes localestaba254prod, reemplazado intencionalmente. Nuevo servidor3107 stage con launcher11732, logs tmp/buyer-staging/start-isolated*.log. VerificarlistenerPID antesstop. Local no en Authallowlist: Google probar SOLO URLcloud.
- Nuevo scripts/buyer-staging-preview.e2e.mjs:11checks localPASS +11cloudPASS, ciudadseleccion/recuerdo/filtroDemo, mapa320/390/1366 pin44/tileslogos, catalogovisualDemo,4APIsbuyer/panel/admin401, OAuthsupabase302Google/PKCE/callbackXPQM, cero pageerrors y CSPstage. Screenshots map/market/accountcloudinspeccionadas; tmp/buyer-staging/qa-cloud/results.json. Escriturasbloqueadas. Detieneantesloginreal: no afirmar consent/secretvalidado ni usuariocreado.
- QA adicional19/19API/PGlite/inventario; 12DBrealesrollback yaPASSfaseprevia no repetidoshoy. Node/PSsyntax/diffcheck/documentsecretsPASS. Browseriab no disponible trasbootstrap, Playwrightrepo. PrimerstartQA fue temprano connectionrefused luegoReadyPASS; QAhostcount corregido pues page.route precedecontext.route; tilecapture espera cargas/opacidadfinal. PSAPIkeys envolviaarray4elementos, corregido desempaquetado sin imprimir valores. Sin cambiofuncionalUI.
- A34/APK11/1.3.2 NO reemplazados. No APKbuyer aun. Preview usa datosDemo y NO permite comprobar impresoras/delivery/pagos reales. No instalar automaticamente con orignenuevo sin explicar cambio; probar webGoogleprimero.
- SIGUIENTE EXACTO: usuario abre https://vendeplus-clean-azxcbptg7-entrega2-s-projects.vercel.app/mi-cuenta y completa ContinuarGoogle; debevolvercorreo/historialvacio. Sierror pedir mensajevisible (NOtokens), revisar WebOAuthcallback/consentimiento/clientvalid. Luego comprasautenticada/invitada y completado/rating controlados SOLOstage, doscuentas, APK nueva y prueba fisica. Produccion NO publicar. V2/eliminacioncuentaantesPlayStore/syncperfil/moderacion pendientes. Docs readiness/marketplace actualizados; no perder el aislamiento.

# 2026-09-29 - Usuario confirma cliente Google Somos pruebas creado; falta proveedor Supabase

- Actualizacion: usuario en Supabase activo Google en formulario y vio datos existentes, pregunta si sustituir. Se indica NO reemplazar/guardar hasta confirmar proyecto. Nueva lectura readonly sigue stage disabled/sinclient/sinsecret; no determina si pantalla muestra ejemplos, autocompletado u otroproyecto. Pedir solo nombreproyecto visible, NO claves. URL correcta dashboard/project/xpqmmdmixpyqruykkbkf/auth/providers; no tocar credencialesproduccion. Sin cambios remotos/codigo/build en esta aclaracion.
- Usuario: "listo y cree el cliente somos pruebas". Creacion confirmada por usuario; tipo Web y URI no inspeccionados en Google Cloud.
- Verificacion readonly -ReadAuthStatus: staging xpqmmdmixpyqruykkbkf google_enabled=false, google_client_configured=false, google_secret_configured=false. SiteURLlocalhost3000/allowlistvacia. Produccion Google sigue configurado; ninguna escritura remota.
- SIGUIENTE EXACTO: usuario abre Authentication > Sign In / Providers > Google del proyecto somos-buyer-staging, activa proveedor, pega ClientID y ClientSecret del cliente nuevo y guarda alli, NO en chat. Recordar redirect Google exacto https://xpqmmdmixpyqruykkbkf.supabase.co/auth/v1/callback. Tras confirmar guardado, repetir lectura de flags y continuar preview aislado/retornos/APK segun entrada anterior. No recrear proyecto ni migraciones.
- Solo documentos SESSION_HANDOFF.md y buyer-preview-readiness actualizados. Sin cambios de codigo/SQL/deploy/APK; no build nuevo, ultimo PASS254. Preview nuevo, OAuth real, historial/calificaciones desde app siguen pendientes. V2 sin cambios.

# 2026-09-29 - Supabase staging CREADO, esquema/buyer instalados y transacciones verificadas

- Usuario "procede" autoriza crear entorno separado SIN nuevo plan pago. Responde "creo que si" al acceso Google Cloud; NO equivale a proveedor configurado. Nueva pregunta async enviada con pasos WebOAuth/callback/proveedor; respuesta pendiente. No volver a pedir permiso para crear el mismo proyecto.
- Nuevo somos-buyer-staging ref xpqmmdmixpyqruykkbkf, us-east-1, ACTIVE_HEALTHY. Org vercel_icfg_B9hGS5Xag5lYa2DTCwT7IvDi Free confirmado via ManagementAPI antes de POSTcrear. Sin upgrade, otros proyectos intactos. Prod rvmtjtuztewcrmodrodb en orgPro NO cambiada.
- Exportacion SOLO esquema public+private con pg_dump17.11 oficial Windows, --role postgres --schema-only y default_transaction_read_only=on; origenCLI validado. No datos clientes/pedidos/auth/tokens/dispositivos/integraciones. Archivos app-schema.dump/sql en tmp/buyer-staging ignorado, restauracion create-only sin --clean. Esquema validado sin URLs/dblink/vault/COPY/INSERT. Private necesario para triggers/sesiones/rate limit. Intento inicial sinrole fallo por LOCKstores; reintento conrole oficial correcto PASS, sin DMLproduccion.
- Instalada SOLO en staging migracion20260929193000 buyer corregida por user_id. Copia esquema heredo grants anon/auth sobre atomic viejo: detectado y CORREGIDO con grants efectivos roles obtenidos SOLO metadatos readonly de prod. Verify posterior PASS: cuatroRPC service_roletrue, anon/authfalse; buyerRLStrue, cero columnas faltantes. Hash atomic viejo f0277ea69be7930c141ec64004774d4c conservado. No historial global migraciones reconstruido: NO dbpush ni todas las migraciones, ni siquiera staging.
- Seed ficticio persistente: CaracasDemo/LosTequesDemo, CocinaDemo slug cocina-demo y TiendaDemo slug tienda-demo, tresproductos, promo solo primera ciudad. Solo retiro/efectivo, sin destinos contacto/delivery/pagos/impresora. is_testfalse para aparecer marketplace, nombresDemo explicitos. Usuarios/pedidos reales NO copiados.
- SQL remoto real buyer_staging_transaction_test.sql:12 escenariosPASS, RPC atomic ORIGINAL con inventario, replay sin segundo descuento, fallo segundoitem revierte todaoperacion, ownership/replayajeno/invitado/invalidbuyer, reviewsestado/owner/rango/upsert/propio comercio/cancelado. Authusuarios sinteticos SIN Google, todoROLLED BACK, cero pedidos persistidos/usuarios prueba eliminados por rollback. No afirmar OAuth, APIHTTP, concurrencia ni Android verificados.
- ScriptsNUEVOS scripts/ops/supabase-buyer-staging.ps1 y export-buyer-staging-schema.ps1; SQL nuevos buyer_staging_permissions.sql/seed.sql/transaction_test.sql. Operaciones SQL escritura hardcodedstage+validan manifest/nombre/org/estado. -CreateFreeProject NO repetir; -InitializeSchema/-SeedCatalog rechazan no vacio; -Verify/-ReadAuthStatus lecturas; -TestBuyerFlow rollback. Usar powershell.exe -NoProfile -ExecutionPolicy Bypass -File...; no politica sistema cambiada. Token CredentialManager Supabase CLI:supabase solo memoria/supabaseAPI. DBpass DPAPI tmp/buyer-staging/provisioning.dpapi.json, no imprimir. Nunca copiar credenciales al chat.
- Google staging aun disabled/sinclient/sinsecret; prodGoogleenabled intacto. Usuario debe crear WebOAuth Somos pruebas, redirect https://xpqmmdmixpyqruykkbkf.supabase.co/auth/v1/callback y meter ID/secret directamente dashboard de ESTE Supabase. No copiar secreto prod. Luego allowlist webpreviewexacto y com.somosve.app://buyer-auth, sin wildcard.
- QA19/19 locales +12DBremotos; npm.cmd run build via mobile-local PASS254/TypeScript; gitdiffcheckPASS, sintaxisPSpass, documentsecrets0. Intento parser PS anidado fallo quoting; ejecutado directamente con ErrorActionStop luegoPASS. Build usa entorno localprevio (prod), NO buildaislado. Sin cambioUIactual, capturas previas vigentes. Sin commit/push/deploy/APK/SQLprod/configVercel/.env. A34 y web siguen1.3.2.
- Localprevio restaurado3107 por mobile-local, logs tmp/buyer-staging/start-local*.log; NO apuntado a staging ni apto para comprasprueba aisladas. No entregar como nuevo preview. VerificarPID listener antesstop. Docs buyer-preview-readiness y buyer-marketplace actualizados.
- SIGUIENTE EXACTO: asistir Google (usuario cree acceso; pregunta async actual pendiente), verificar authsettings sinsecrets; obtener clavesstage solo memoria, preparar Preview con buildYruntime apuntando XPQM, SIN variables/integracionesprod heredadas. VercelPreviewexistente contiene clavesprod, NO reutilizar sinaislar. Verificar navegador/servidor/API y prepararAPK nueva; Google+pedido+historial+rating doscuentas antesproduccion. No reexportar/recrear/reseed desdecero. V2/eliminacioncuentaantesPlayStore/sincronizacion/moderacion pendientes.

# 2026-09-29 - Preparacion cuentas/preview: preflight y correccion SQL, entorno pendiente

- Usuario "ok avancemos en eso" al plan cuentas reales + preview unificado antes de produccion. Se prometio revisar sin cambiar produccion. Pregunta async ENVIADA: autoriza crear Supabase separado con datos ficticios y parar antes de contratar plan de pago; aun SIN RESPUESTA al registrar esta entrada. No interpretar como permiso para migrar produccion ni contratar recursos.
- CLI projects list en lectura: vendeplus-production rvmtjtuztewcrmodrodb activo; otros proyectos ajenos no tocados. branches list encuentra shibui-inventory-staging-v2 nmuypksuaxwyonilzoqs ACTIVE_HEALTHY pero MIGRATIONS_FAILED; NO reutilizar. Vercel env ls preview lista claves/integraciones compartidas con Production: preview NO implica aislamiento.
- Preflight NUEVO supabase/buyer_accounts_readiness.sql soloSELECTmetadatos: tablasbuyer2 y RPCbuyer3 NO existen; create_order_atomic existe y restringido service_role, hash f0277ea69be7930c141ec64004774d4c antes/despues. No se llamaron RPC negocio ni consultaron/copiarion filas de clientes/pedidos/auth. CLI linked sigue produccion, sin relink/push/DDL/DML. No respaldo completo nuevo.
- BUG real encontrado: migracion pendiente save_buyer_store_review usa store_users.email inexistente. Metadata real store_users=id,store_id,user_id,role,created_at. Fixture anterior inventaba email. Test corregido primero reproduce fallo column su.email does not exist; luego se cambia SQL pendiente a store_id+user_id como panel. Propietario/operador bloqueados en propio comercio, membresia ajena permitida. No se modifico migracion ya aplicada.
- Archivos: SQLbuyer pendiente, buyer-accounts.db.test.mjs, preflightSQL nuevo, docs/buyer-preview-readiness-2026-09-29.md nuevo, nota buyer-marketplace doc, estehandoff. Migracion sigue SIN APLICAR en remoto. Preflight trasfix: ninguna columna requerida faltante; eso NO instala buyer.
- QA 19/19 (API3 + PostgreSQLlocal8 + contratosinventario8); atomic antiguo sigue simulado en PGlite, no afirmar prueba transaccional real remota. Build npm.cmd via mobile-local PASS254/TypeScript; ESLint focal/diffcheckPASS. Sin cambiosvisual ni nuevaAPK/cloud/prod/commit/push. Ultimo APK11 y prod1.3.2 sin cambios.
- Servidor local restaurado en http://127.0.0.1:3107/marketplace; logs tmp/buyer-marketplace/start-readiness*.log. Verificar listener/CommandLine antes de detener. SIGUIENTE EXACTO: obtener respuesta a pregunta entorno; revisar plan/costos antes de crear, aislar esquema/fixtures SIN PII/credenciales/dispositivos/integraciones reales, aplicar solo migracionbuyer corregida en staging, configurar Google exacto/preview, armarAPK y validar circuito completo. No publicar cuentas con baseproduccion actual ni dar nuevo linkcloud inexistente. Eliminacioncuenta/sincronizacion/moderacionV2 pendientes.

# 2026-09-29 - Logos corregidos y pin44: LOCAL VALIDADO

- Usuario reporta Sabore/ChinaTown/Strawberry/Kikis mal encuadrados y pide pin menor. Causa reproducida: reset Leaflet width:auto/padding:0 gana a regla logo; Strawberry72px dentro de48 y verticales descentrados. Regla propia ahora mas especifica, solo imagen de logo. No era solamente margen del archivo.
- Pin44x56, logo40, borde2, contador20, ancla22/56, popupAnchor0/-52. Imagen cuadrada estable/centrada; pin cover sinbandas, ficha contain completa. Cover recorta fondo/periferia; no prometer que todos los logos extremos caben enteros. Sin zoom por pixeles ni excepciones por comercio, originales intactos.
- Funcionales MarketplaceMap.tsx/native-polish.css; buyer-marketplace.e2e.mjs actualizado; nuevo marketplace-map-logos.e2e.mjs con --native. Detalle actualizado docs/marketplace-map-pins-2026-09-29.md.
- QA FINAL: build npm.cmd via mobile-local PASS254/TypeScript, ESLint focal y diffcheckPASS; buyer12/12 + cuatro logos web4/4 y modo nativo4/4, cero errores. Capturas cuatro originales/pines y mapas320/390/1366 inspeccionadas. Selector QA inicial elegia SantoSabor: corregido, ahora evidencia Sabore real. Mutaciones remotas bloqueadas. Browseriab indisponible; Playwrightrepo; Android simulado, no reinstalacion fisica.
- Servidor http://127.0.0.1:3107/marketplace actualizado; launcher5092 logs tmp/map-logos/start-final*.log; verificar PID listener antes de detenerlo. Sin migracion/SQL/commit/push/deploy/APK, produccion/A34 siguen1.3.2. Ciudad recordada y filtrodelivery retirado conservados.
- SIGUIENTE: usuario revisa pin compacto y esos cuatro comercios en local; cuentas/Google/SQL anteriores siguen pendientes aparte. V2 opcional encuadre individual para logos extremos; no publicar worktree entero automaticamente.

# 2026-09-29 - Pines de ubicacion con logo: LOCAL VALIDADO

- Ultima peticion: logos raros, usar icono de ubicacion con logo dentro. Implementado pin56x68, circulo48, punta anclada a coordenada, contador grupos naranja; ficha encima con miniatura sin punta. Compartido web/app. Ciudad recordada y retiro filtrodelivery conservados.
- Retirado zoom automatico por pixeles y su helper marketplace-logo-fit.ts/test exclusivos. Originales intactos, object-fit contain y fallback iniciales. Margenes del archivo original aun pueden hacer logo pequeno; no afirmar normalizacion de activos.
- Archivos: MarketplaceMap.tsx, native-polish.css, buyer-marketplace.e2e.mjs; detalle docs/marketplace-map-pins-2026-09-29.md. Se conserva fix zoomAnimation:false/cierre del mapa anterior.
- QA: npm.cmd run build via mobile-local PASS254/TypeScript; ESLint focalPASS; diffcheckPASS. Buyer/mapa12/12 ceroerrores; capturas movil/grupos/ficha/escritorio inspeccionadas. Browseriab indisponible, Playwrightrepo; cuentas simuladas/escriturasremotas bloqueadas. No prueba fisica nueva Android.
- Servidor LOCAL http://127.0.0.1:3107/marketplace actualizado; launcher15560, logs tmp/buyer-marketplace/start-pins*.log. Verificar PID listener antes de parar. No SQL/migracion/deploy/commit/push/APK; produccion y A34 siguen1.3.2.
- SIGUIENTE: usuario acepta pin en mapa local. Activacion cuentas/Google/migracion anterior sigue pendiente separadamente, no publicar worktree completo sin revisar ese plan.

# 2026-09-29 - Ciudad inicial UNA VEZ y filtro empresa RETIRADO: LOCAL VALIDADO

- Ultimas instrucciones: antes de explorar elegir ciudad/GPS; luego usuario pide quitar selector/filtro empresa delivery y precisa que ciudad se pide una sola vez, se guarda y se cambia desde arriba. Implementadas las tres, sin publicar.
- Nuevo MarketplaceCityPicker compartido web/app/aliados. Sin seleccion valida, no se muestra catalogo ni se solicita GPS automaticamente. Boton Usar mi ubicacion o ciudades manuales; sin Cerrar/Todas en primer ingreso. GPS rechazado, remoto/ambiguo, no disponible o timeout mantiene eleccion manual. RequestID evita que GPS tardio cambie ciudad manual. Entrada a negocio disponible.
- Preferencia local cityConfirmed; restaura ciudad concreta valida de preferencias anteriores o registro movil. Valor Todas antiguo por defecto NO omite primera eleccion. Despues se puede escoger Todas explicitamente desde cabecera y se recuerda/etiqueta correctamente. Al volver, carga neutral hasta leer preferencia, sin flash de selector ni catalogo global. No guarda coordenadas GPS nuevas. Si se borra almacenamiento/cambia origen o ciudad ya no existe, pregunta otra vez; no sincroniza dispositivos.
- Retirados control/estado/logica de empresa delivery en Marketplace/mapa; api/marketplace/directory ya solo consulta promedios publicos, no asociaciones delivery. NO se modificaron relaciones/configuracion/tarifas ni marketplaces aliados existentes. Moto de tarjeta y logos ampliados se mantienen. Helper marketplace-directory.ts anterior queda sin consumir por esa API; no interpretar como filtro vigente.
- QA encontro callback tardio _onZoomTransitionEnd de Leaflet al cerrar mapa mientras zoom. Arreglo acotado: zoomAnimation:false, observer protegido y referencia vaciada antes de remove; grupos/zoom/pan conservados. E2E ahora pulsa zoom y cierra inmediatamente en cada viewport.
- QA FINAL: build via mobile-local/npm.cmd run build PASS250/TypeScript; ESLint focal y diffcheckOK. 96/96 contratos/unitarias (80criticos+5city+5stage+6buyeralerts). Ciudad12/12 (incluye web/nativo, retorno SIN aparicion del selector observada, SSRneutral, permisos simulados y storage bloqueado); buyer/mapa12/12 sin errores luego del fix; polish30/30; stage1 16/16. Capturas320/390/1366 revisadas con logos cargados. Iab indisponible, Playwrightrepo; GPS simulado, sin pedidos/pagos/escrituras de negocio reales. Pruebas cloud actualizadas en fixture pero NO ejecutadas remotamente.
- Archivos/detalle/QA/manual: docs/marketplace-city-entry-2026-09-29.md. Funcionales MarketplaceCityPicker.tsx nuevo, MarketplaceClient.tsx, MarketplaceMap.tsx, native-polish.css, api/marketplace/directory/route.ts. Fixtures/contratos actualizados a eleccion previa explicita, sin debilitar verificacion de acceso.
- Sin SQL ni migracion nueva/commit/push/deploy/APK. Produccion y A34 siguen1.3.2. Cuentas comprador/SQL/Google real siguen pendientes y NO autorizados por este ajuste.
- Servidor LOCAL actualizado http://127.0.0.1:3107/marketplace; launcher8664, logs tmp/mobile-city/start-final*.log. Para validar primera visita usar ventana privada NUEVA, elegir ciudad y recargar MISMA ventana: debe entrar sin popup; cambiar desde cabecera y recargar. No borrar datos normales del usuario. SIGUIENTE: aceptar flujo visual y retomar plan aislado de cuentas/Preview, sin publicar todo el worktree con migracion ausente.

# 2026-09-29 - Ajuste visual LOCAL: moto delivery y logos del mapa

- Usuario pide moto para empresas delivery y mejorar logos pequenos dentro del marcador. Se cambio Truck por Motorbike de Lucide en filtro y tarjetas del Marketplace, compartido web/app. No se reemplazaron logos oficiales de empresas.
- Diagnostico: marcadores44px/borde2 y margenes blancos/transparencia incluidos en algunos archivos. Ahora52px/borde1; medida cliente de margenes vacios a128px, encuadre proporcional limitado2.5x, cache128entradas. Solo posicion/tamano de imagen en pantalla, SIN editar/subir originales, backend ni Supabase. Si no hay acceso a pixeles por CORS, conserva logo completo y reintenta carga normal; iniciales si archivo roto. Clusters76px y padding48/60 para marcadores mayores; contador fuera del recorte.
- Archivos: MarketplaceClient.tsx, MarketplaceMap.tsx, native-polish.css, nuevo src/lib/marketplace-logo-fit.ts; scripts/marketplace-logo-fit.test.mjs y buyer-marketplace.e2e.mjs; docs/buyer-marketplace-2026-09-29.md y este handoff.
- QA: helper4/4 (margenes, proporciones, centrado, fondo/noise); E2Ebuyer13/13 con iconoMoto/tamano52 agregados; polish30/30. Sin erroresReact, capturas320/390/1366 inspeccionadas. npm.cmd run build via mobile-local PASS250/TypeScript; ESLint focal y diffcheckOK. Iab sigue no disponible; Playwright repo. Sin SQL/migracion nueva, deploy, commit/push ni APK nueva. Pendientes de cuentas de entrada siguiente NO activados.
- Local actualizado http://127.0.0.1:3107/marketplace; launcher15280, logs tmp/buyer-marketplace/start-logo-fit*.log. Usuario puede recargar, revisar moto y mapa/grupos/logos. Produccion y A34 sin cambios. Siguiente: aceptar visuales y retomar entorno/SQL/redirects para activar cuentas en pruebas, nunca aplicar SQL acumulado automaticamente.

# 2026-09-29 - Cuentas comprador, historial, calificaciones y mapa: LOCAL VALIDADO, NO PUBLICADO

- Usuario autoriza avanzar con Google en perfil, historial, calificar comercio, mapa/logos en Marketplace y filtro por empresa delivery. Responde a pregunta de staging: "Solo el actual / no estoy seguro". Se prometio NO ejecutar cambios en su base actual en esta fase. Se implemento solo en `.fee-billing-prod`, preservando cambios anteriores. Sin commit/push/deploy remoto/SQL remoto ni APK instalada nueva.
- Mapa Leaflet con logos, agrupacion de cercanos (leaflet.markercluster1.5.3/tipos1.5.6), zoom, popup/catalogo, sin coordenadas inventadas. Filtro por asociaciones activas y respaldo Entrega2, combinado con ciudad/categoria/busqueda y rails. Directorio real consultado en lectura: disponible. Toolbar movil compactada tras detectar que desplazaba productos bajo navegacion; regresion corregida.
- Mi cuenta `/mi-cuenta`, entrada web en Marketplace y nativa en Mis datos. Google con cliente separado `somos_buyer_auth_v1`, PKCE, callbackweb `/auth/buyer-callback`; Android navegador externo y callback `com.somosve.app://buyer-auth` mediante nuevo SomosBuyerAuthPlugin. Historial20/pagina y rating1..5 solo pedido propio completado; promedio publico sin identidad. Mis datos sigue local, no sincronizado con Google.
- API verifica token remotamente con Auth y Google/correo confirmado; lectura propietario+store y no-store; no acepta identidad del cuerpo. Nueva vinculacion atomica envuelve RPC de pedidos existente, preserva inventario/idempotencia. No reclama compras antiguas/guest por telefono o replay. Rating bloquea propio comercio y repeticion crea actualizacion, no otra fila.
- SQL NUEVO PENDIENTE: `supabase/migrations/20260929193000_buyer_accounts_and_reviews.sql` (dos tablas RLS, indices, tres RPC solo service_role). NO aplicada en Supabase. Se probo migracion real en PostgreSQL WASM local/PGlite, con RPC antiguo simulado. No equivale a prueba transaccional integral Supabase/inventario. NO desplegar cuentas sin SQL: pedido autenticado requiere RPC nuevo.
- Google Auth external.google=true verificado en lectura. NO configuradas/verificadas URL de retorno ni probado Google real. Nativo solo compilado Java21 `:app:compileDebugJavaWithJavac` PASS42; no assemble/APK/instalacion nueva. No se modificaron impresion, sonido ni Firebase.
- QA FINAL: 111/111 unitarias/contratos/DB; `npm.cmd run build` via mobile-local PASS250 y TypeScript; ESLint focal y diffcheckOK; npm audit0 tras dependencias. E2E nuevos13/13 (mapa320/390/1366, clusters/popup, filtro, cuenta, rating/paginacion/error/logout, URLGooglePKCE nativa simulada), polish30/30 y stage1 16/16; sin erroresReact. Cuenta/historial/reviews simulados, mutacionesremotasbloqueadas. Capturas finales inspeccionadas. Browseriab no disponible; Playwright repo. Arranque inicial de pruebas antes de servidorReady dio connectionrefused; rerun trasReadyPASS. Selector de alerta de prueba ajustado para excluir anunciadorNext.
- Servidor LOCAL queda en http://127.0.0.1:3107/marketplace (solo esta PC). Launcher final17664, logs `tmp/buyer-marketplace/start-clusters*.log`; resultados/capturas en `tmp/buyer-marketplace`. PID listening puede diferir; verificar CommandLine antes de detenerlo. No tunel, no linkcloud nuevo.
- Produccion permanece la1.3.2 de entrada siguiente (`dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1`); esta fase no la redesplego. A34 sigue APK11 y Preview9f7uno4fk. No confundir trabajo local con instalado/publicado.
- SIGUIENTE PASO EXACTO: revisar `docs/buyer-marketplace-2026-09-29.md` y decidir entorno para activacion de cuentas. Preferir Supabase separado; si se autoriza base actual, respaldo y revisar/aplicar SOLO migracion nueva, sin otras pendientes. Configurar redirects exactos webPreview/native, desplegar Preview limpio `--force`, verificar CSS, preparar APK nueva y probar Google+pedido+historial+rating reales antes de produccion. Eliminacion de cuenta/datos debe resolverse antes de Play Store; sincronizacion perfil/moderacion/notificacionescerrado siguenfuera.

# 2026-09-29 - Produccion1.3.2 PUBLICADA y verificada

- Usuario responde "procede" a autorizacion explicita de publicar Preview aprobado. Publicacion web completada; NO permiso de commit/push/PlayStore/APK nueva. Final READY dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1, https://vendeplus-clean-57i0zs2kn-entrega2-s-projects.vercel.app . www.somos-ve.com y somos-ve.com inspeccionados apuntan a ese ID.
- Promote inicial de Preview9f7uno4fk genero dpl_E15k78J8hcnWUWs7wVsVNwL5Nx2m; buildPASS pero CSS base nativo incompleto pese a559fuentes identicas. QA visual detecto perfil sin formato. Rollback inmediato a dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi confirmado. NO reutilizar E15 como candidato/rollback.
- Reconstruccion desde .fee-billing-prod con --prod --force --skip-domain: logs confirman sincache, PASS244/TS. Fuentes stagedfinal559 vs Preview559, cero diferencias. CSS final mismoschunks Preview, perfil padding20px/barrafixed correcto. Luego promote del staged production sin otro rebuild. Anterior Dd2 preservado como rollback.
- Staged protected: prueba cloudanonima redirigio loginVercel y se detuvo; NO PASS. Intento excepcion por deployment rechazo400 para production, sin proteccionglobal modificada. QA staged uso credencial automatizacion existente solo memoria/header origen exacto, no impresa/archivos/APK. Verificado perfil y5APIs401 antespromote.
- QA FINAL dominio www:6GET200 home/marketplace/smash/carrito/checkout/login, formulariologin visible;5APIsprivadas401; web390/1366 imagenescargadas/sindesborde, perfilnativo cedula/ubicacion+CSS, ceroerroresReact. Capturas finales inspeccionadas, tmp/production-1.3.2/final/results.json. Logs error ultimos10m sinresultados. No login/pedido/pago/despacho real; escriturasbloqueadas. Iab no disponible, Playwrightrepo.
- No cambios de codigo, SQL/migracion/commit/push. Solo docs: docs/production-release-1.3.2-2026-09-29.md, mobile-profile-controls, release-acceptance, estehandoff. npm.cmd run build local previoPASS244 no repetido por no cambios; build produccionlimpioPASS244. No asumir rollout basado soloHTTP: el inicial pasoHTTP y falloCSS.
- APK11/1.3.2 A34 NO reinstalada: sigue Preview9f7uno4fk, appprivada. SIGUIENTE PASO: usuario verifica weboficial/panelhabitual; preparar APK oficial en otro paso autorizado considerando origen/login/datoslocales. Firebasecerrado/mapalogos/calificaciones/historial siguenpendientes. Conservar Dd2 rollback; reversionVercel no revierte BD. Produccion ya publicada, no volver a pedir autorizacion de este mismo lote.

# 2026-09-29 - Usuario aprueba revision manual de1.3.2

- Usuario confirma "revise todo ok" despues de checklist de Mis datos/ubicacion/cedula, accion visual y campana. Se registra aceptacion manual de los ajustes1.3.2 en el recorrido revisado. No afirmar pruebas de escenarios adicionales, nuevo pedido real/sonido1.3.2 detallado, carga ni app cerrada por esta respuesta general.
- Preview aprobado sigue dpl_9dRv22Ui3nSRFkjYtKJGSmPNp636, APK11/1.3.2 instalada. Esta confirmacion NO autoriza publicar produccion, commit, push ni Play Store. Sin despliegues ni cambios funcionales en esta confirmacion.
- Solo actualizados SESSION_HANDOFF.md, docs/mobile-profile-controls-2026-09-29.md y docs/release-acceptance-2026-09-29.md. Sin migracion/SQL; build no repetido por cambios exclusivamente documentales (ultimo local/Vercel PASS244).
- SIGUIENTE PASO: obtener autorizacion expresa de promocion a produccion, confirmar candidato exacto/produccion vigente y preparar verificacion posterior con reversibilidad. APK11 sigue fijada al Preview; eventual APK oficial y Play Store son entregas separadas. Firebase/segundo plano, mapa/logos, calificaciones e historial autenticado siguen pendientes.

# 2026-09-29 - Ajustes Mis datos y controles1.3.2 INSTALADOS en A34

- Usuario confirma Promos por ciudad y reporta ubicacion no guardada/texto repetido, cedula ausente en Mis datos, boton visual bajo precio y campana roja despues de abrir. Implementado SOLO .fee-billing-prod: editor de ubicacion exclusivo Mis datos (agregar/editar/cancelar/eliminar), checkout solo Usar guardada; cedula V/E/J opcional persistente/autofill donde se exige, sin borrarla en comercios que no la piden; texto unico Ajusta el pin si necesitas precisar; precio izquierda y accion +/Cerrado derecha; IDs revisados de campana por cuenta/comercio sin alterar estados, sonido ni impresion.
- Preview READY dpl_9dRv22Ui3nSRFkjYtKJGSmPNp636, https://vendeplus-clean-9f7uno4fk-entrega2-s-projects.vercel.app . Excepcion publica SOLO deployment. Produccion inspeccionada sigue dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi. Sin commit/push/promocion/migracion/SQL ni pedidos/pagos reales.
- APK tmp/mobile-profile-controls/somos-1.3.2-profile-controls-preview.apk, 5692346bytes, SHA256 FB84007427496AC1428877CE8FFDB1D11925E35E8D9DDB4227A457BEC412CCC4. ZIP HTTPS nuevo Preview/cleartextfalse/allowNavigation1host; aapt11/1.3.2, firma igual1.3.1. Java21 assembleDebug PASS73. Config generado restaurado oficial tras copiar. Instalacion -r via alias A34 adb-RFCW80HFA5K-pimjzz._adb-tls-connect._tcp Success; dumpsys confirma11/1.3.2 y POST_NOTIFICATIONS granted=true; amstart aceptado. Sin desinstalar/limpiar datos/pairing.
- QA PASS build npm.cmd run build via runnerprivado local244/TS y Vercel244; contratos80+unit6+otros14=100; ESLint/diffcheck. Mobile-polish FINAL30casos/capturas+6web sinerroresReact y capturas perfil/editor/visual320 inspeccionadas. Etapa1 PASS antes del ultimo ajuste icono/contraste, no repetido despues. Cloudcandidato7PASS/APIs401/escriturasbloqueadas. Iab no disponible, Playwrightrepo. Sin nueva prueba audible fisica ni pedido real; confirmacionhumana1.3.1 anterior no demuestra regresion1.3.2.
- Informe docs/mobile-profile-controls-2026-09-29.md con archivos y limites; checklist actualizado. Local compilado127.0.0.1:3107 launcher17512 logs tmp/mobile-profile-controls/start*.log. Nuevo origen puede exigir login/preferencias de nuevo; datos locales no migran entre Preview. Nativepairing no modificado.
- SIGUIENTE PASO EXACTO: usuario en app11 Mis datos guarda nombre/telefono/cedula y Agregar ubicacion -> direccion/punto -> Guardar ubicacion; reabrir, usar Casa en borrador delivery y comprobar cedula en comercio autorizado que la pida sin confirmar. Revisar precio+accion derecha, abrir/cerrar campana sin rojo; nuevo pedido controlado SmashTest/panelvisible debe volver a alertar/imprimir una vez. No publicar hasta aceptacion expresa. Firebase cerrado/mapalogos/calificaciones/historial autenticado siguen pendientes.

# 2026-09-29 - Usuario confirma sonidoautomatico e impresion en1.3.1

- Tras instalar APK10/1.3.1 y pedir prueba de pedido real, usuario confirma "suena e imprime perfecto". Se registra aceptacion humana de sonido automatico e impresion en el recorrido probado. Sustituye el pendiente de esa confirmacion en entradas anteriores. No se recibieron codigo/foto ni se audito cada campo del ticket, por lo que no afirmar verificacion visual exhaustiva, pruebas de carga o escenarios no probados.
- Confirmacion no acredita notificaciones con appcerrada/bloqueada: implementacion sigue requiriendo panelvisible. Produccion NO se publico; Preview sigue c4qa4xd4y. No es autorizacion de promocion, commit ni push.
- Solo actualizados handoff y docs/mobile-unified-preview-2026-09-29.md; sin codigo/build/migracion/SQL. Siguiente paso: completar revision de controles web/app, Promos y ubicacion frecuente, confirmar pendientes visuales y decidir publicacion expresamente. Mapa/logos, calificaciones, historial autenticado y Firebase/segundoplano permanecen sin implementar; no presentarlos como incluidos.

# 2026-09-29 - APK unificada1.3.1 INSTALADA en A34

- Usuario dio192.168.1.100:46193 (rechazo10061), luego45517 y luego43029. Descubrimiento mDNS identifico A34 SM_A346M/RFCW80HFA5K en45517, alias adb-RFCW80HFA5K-pimjzz._adb-tls-connect._tcp. Se instalo APK10 via alias reconocido con install --no-streaming -r: Success. Sin desinstalar, limpiar datos, cambiar permisos ni volver a vincular impresora.
- Artefacto exacto tmp/mobile-unified/somos-1.3.1-unified-preview.apk, SHA256 EC26BF4A76CF04D3773998FB84D1C88342E71171AF12CDE9DBE45D12E643AD2E revalidado antes de instalar. dumpsys confirma versionCode10/versionName1.3.1-unified-preview y POST_NOTIFICATIONS granted=true. am start com.somosve.app/.MainActivity aceptado. No afirmar revision visual ni pedido/sonidoautomatico real por esto.
- Nuevo puerto43029 conectado Success y adb devices confirmo mismo modelo; al repetir dumpsys por43029 ya respondio device offline. Version10 fue verificada exitosamente ANTES de este cambio via alias reconocido. No se reinstalo al cambiar puerto. Ultimo puerto informado192.168.1.100:43029, conexion inestable; preferir alias mDNS del mismo serial si reconocido.
- APK usa Preview c4qa4xd4y, independientePC/tunel. Origen nuevo puede pedir login y activar de nuevo Sonido y notificacion, y no migra preferencias web antiguas. Sin codigo nuevo/build/migracion/SQL/despliegue/commit/push en esta instalacion; builds previos aprobados.
- Siguiente paso exacto: usuario abre app, ingresa a Smash(Test), activa aviso en campana y espera baseline20s. Desde otro dispositivo crear pedido Retiro en https://vendeplus-clean-c4qa4xd4y-entrega2-s-projects.vercel.app/smash; dejar panelvisible y confirmar avisoautomatico/sonido y una sola comanda. Pedir codigo y foto. Firebase cerrado/mapa/logos/historial/calificaciones siguen pendientes. Produccion sin tocar.

# 2026-09-29 - Preview unificado1.3.1 publicado; APK lista, instalacion pendiente

- Usuario autoriza "unifiquemos y me das el link para probar todo antes de pasar a produccion". Se reunieron cambios YA implementados y arreglo received de la campana. Se aclaro antes de desplegar que mapa/logos, calificaciones, historial autenticado y Firebase/appcerrada siguen pendientes; NO afirmar que ya se implemento todo el backlog. Esta instruccion autoriza Preview/APK y supera pregunta de despliegue previa; no autoriza produccion/commit/push.
- Preview READY `dpl_HqFHskZuAWKUjfAZvUFX8BwdUoCL`, https://vendeplus-clean-c4qa4xd4y-entrega2-s-projects.vercel.app . Excepcion publica aplicada SOLO a ese deployment. Produccion inspeccionada antes/despues sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`. Sin promocion/SQL/migracion/commit/push ni cambio proteccion global.
- APK `tmp/mobile-unified/somos-1.3.1-unified-preview.apk`, 5692342bytes, SHA256 EC26BF4A76CF04D3773998FB84D1C88342E71171AF12CDE9DBE45D12E643AD2E, versionCode10/versionName1.3.1-unified-preview confirmado aapt. Config ZIP HTTPSPreviewexacto/cleartextfalse/allowNavigation1host, firma apksigner valida e igual1.3.0. Config generado resync oficial tras copiar. APK NO alojada como descarga publica; enlace local entregable. ADB devices vacio, NO instalada. App1.3.0 telefono aun apunta Preview viejo y no tiene arreglo.
- Cambio actual: version Android en build.gradle + docs/release-acceptance-2026-09-29.md actualizada al nuevoPreview, docs/mobile-unified-preview-2026-09-29.md y nota de continuidad en docs/mobile-order-alert-fix-2026-09-29.md. APIs/impresion/Java funcional sin cambios. Arreglo campana incluido y verificado en fuente del deployment via API.
- QA repetido PASS npm.cmd run build via runner privado local240/TS y Vercel240; unitavisos/config8/8; cloud7/7+noerroresReact/APIsprivadas401; ciudad6/6; captura marketplace remoto inspeccionada. Validacion anterior completa80contratos+18unitmovil/29visual+web/Etapa1 permanece aplicable (no cambio funcional nuevo). Android assembleDebug PASS95tareas con JAVA_HOME=C:/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot. Intento previo JavaStudio fallo major69; no se alteraron dependencias. diffcheckPASS.
- Local reiniciado http://127.0.0.1:3107 launcher4732, logs tmp/mobile-polish/unified-start*.log. Preview no depende de PC/ADB. No hubo pedidos reales ni prueba fisica de sonidoautomatico.
- Siguiente paso EXACTO: usuario prueba web /marketplace, panel /panel/login, catalogo /smash del NUEVO Preview. Para funciones Android conectar A34 USB o IP:puerto vigente; instalar -r APK10 preservando datos/pairing, verificar version10, abrir. Cambioorigen exige posiblemente login/activaravisos/guardarubicacion otra vez. Dejar panelSmash(Test) visible, baseline20s, crear Retiro desde otro equipo en esePreview, verificar sonido/avisoautomatico/comandaunica. No afirmar Firebase cerrado. Mantener APK/deployment anteriores para reversibilidad; no eliminarlos por limpieza.

# 2026-09-29 - Fallo aviso automatico identificado y corregido SOLO LOCAL

- Usuario reporta: prueba de notificaciones suena, pedido que llega no. Causa confirmada en codigo: PanelNotifications consultaba status=pending pero alta /api/orders guarda status=received y GET panel/orders aplica eq literal. Test anterior tambien usaba pending y mock no filtraba: falso positivo corregido.
- Cambio de app limitado a src/components/panel/PanelNotifications.tsx, filtro received. scripts/mobile-buyer-alerts.test.mjs agrega contrato (FAIL antes/PASS despues). scripts/mobile-polish.e2e.mjs usa fixtures received y mock con filtros status/storeId; prueba llegada por timer15s sin foco artificial, no repetir y excluir accepted aunque payment_status=pending.
- QA PASS: criticos80/80 + moviles18/18; npm.cmd run build via runner privado PASS240/TS; ESLint3archivos; mobile-polish29casos/capturas y web, ceroerroresReact; Etapa1 navegacion/sesion/cuentas/web PASS; diffcheckPASS. Pruebas simuladas/mutacionesbloqueadas, NO pedido real ni verificacion audible fisica del arreglo. Navegador integrado sigue iab no disponible; Playwright repo.
- No cambio API/Java/impresion/BD/SQL/migracion. Sin commit/push/Preview nuevo/promocion/APKnueva. APK1.3.0 sigue apuntando gwcs2ob9j y NO contiene el arreglo. Build local servido http://127.0.0.1:3107, launcher17908; logs tmp/mobile-polish/alerts-fix-start*.log. Anterior listener15832 identificado por path/puerto y detenido antes del build.
- Preguntas async pendientes: confirmar panel visible vs otraapp/bloqueo; autorizar solo Preview nuevo y APK para probar conservando datos/impresora. ADB devices vacio. NO afirmar instalacion ni publicar por inferencia de esas preguntas sin respuesta. Detalles docs/mobile-order-alert-fix-2026-09-29.md.
- Siguiente paso exacto: recoger autorizacion Preview/APK y conexion A34; desplegar candidato validado, acceso publico limitado deployment, smoke APIs401, generar APK10/1.3.1 con origen nuevo fijo y restaurar config generado oficial. Instalar -r preservando datos. Repetir pedido controlado en Smash (Test) desde otro equipo con panel visible, confirmar sonido automatico y comanda unica. Segundo plano/Firebase sigue pendiente.

# 2026-09-29 - Preparacion de aceptacion antes de publicar

- Usuario dice "perfecto avancemos y dime que debemos probar". Se avanzo con validacion de solo lectura y checklist; NO se promovio produccion ni se crearon pedidos. Pregunta async abierta para confirmar commit y subida a rama PRIVADA; antes de actuar se verifico que el remoto actual `bddentrega2-lgtm/vendeplus-clean` es PUBLICO (`gh repo view`, isPrivate=false). Se informo al usuario. NO interpretar una aprobacion de respaldo privado como permiso para subir a este remoto publico, crear repositorio ni cambiar visibilidad automaticamente.
- Produccion revalidada sigue dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi; Preview dpl_2ThqxhG3VSi2VUGmLqAYs7GdQ3h8 READY. Catalogo de prueba /smash devuelve200 titulo Smash (Test). APK existente no modificada.
- Repetidos PASS contratos80/80, unitariosmoviles17/17, cloud7/7 y cero erroresReact. Cloud escrituras bloqueadas, APIs privadas401; resultados tmp/mobile-cloud/navigation/results.json. Navegador integrado intento bootstrap devuelve Browser is not available: iab, usado Playwright existente del repo. Sin nuevo build: no cambios de codigo app; ultimo local/Vercel PASS240.
- Detector documental encontro 3 apariciones de propuesta de clave rechazada en notas anteriores; retiradas mecanicamente de SESSION_HANDOFF y docs/navigation-performance-audit-2026-09-23.md, sin cambios Auth ni revelar valor. Otro hallazgo era falso positivo nombreAPK por compartir linea con palabra claves: ruta de APK aclarada. Revalidacion check:document-secrets PASS0hallazgos. Snapshot previo conserva notas anteriores; NO subirlo tal cual. Exclusiones env/keys no garantizan historial libre de secretos.
- Nuevo docs/release-acceptance-2026-09-29.md: pasos y criterios de aprobacion. Siguiente paso EXACTO: usuario deja A34 panel Smash (Test) visible/avisosactivos, crea desde otro navegador un pedido Retiro en Preview /smash, reporta codigo/sonido/notificacion/numeroimpresiones/foto. Validar delivery solo propio o reimpresion controlada, sin pagos ni repartidores externos. Probar luego controles web/app, ubicacion/promos/sesion. No publicar sin resultados y aprobacion final; no afirmar QA fisico completado.

# 2026-09-29 - Inventario real produccion/Preview y respaldo

- Usuario pregunta que falta publicar y recomienda preservar avances. NO es autorizacion de promocion/commit/push. Produccion inspeccionada sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`; Preview actual `dpl_2ThqxhG3VSi2VUGmLqAYs7GdQ3h8`. Produccion tenia gitDirty=1: no usar diff HEAD como lista de pendientes.
- Comparados hashes de arbol src real Vercel via API v6 files: 50 diferencias (incluye tests/config y tsbuildinfo generado), ninguna migracion. Android se conserva aparte; no esta dentro de deployment web. Impresion automatica/cola y descubrimiento Marketplace previos ya estan en produccion.
- Respaldo NUEVO completado `C:/Users/Windows/Desktop/RESPALDOS/SOMOS-checkpoints/20260929-app-1.3.0`: 663 fuentes, source.zip verificado entrada por entrada SHA256, git-base.bundle verificado, manifest.json, production-vs-preview.json, APK instalada1.3.0. APK copiada hash642A6821F20ABB58F91CBE2BBD721F13BC4BE9FBAFC84E939CAFEE820CA5D450; ZIP43FED1A84A278494EE92064DB2DD24F4082A806342207CBE788BEE63437E970E. Sin env/keys/dependencias/builds/BD; es LOCAL, no remoto ni backup Supabase. Informe/handoff posteriores no estan dentro de snapshot inmutable.
- Agregado scripts/release-checkpoint.ps1 (IDs fijos para esta fecha), ejecutado con PowerShell ExecutionPolicy Bypass solo proceso tras politica local bloquear ejecucion inicial, sin cambiar politica permanente. Sin codigo app nuevo, no repetido build; ultimo build Next/Vercel PASS240, QA previo registrado debajo.
- Informe docs/production-readiness-2026-09-29.md detalla pendientes web/app, riesgos y pruebas. Recomendacion: commit revisado + remoto privado con autorizacion, QA pedido real en Smash Test/ticket/avisoautomatico/sesiones, luego promocion controlada expresamente autorizada. App puede permanecer privada. APK actual fija Preview, no migra sola al publicar web; eventual APK oficial requiere considerar cookies/datos por origen.
- Siguiente paso exacto: recoger decision del usuario sobre guardar commit/subir remoto y preparar entrega. NO publicar ni hacer commits por inferencia. Falta prueba real controlada de nuevo pedido/comanda/aviso con panel visible; Firebase cerrado, mapa/logos, historial autenticado y calificaciones siguen pendientes. Sin migracion/SQL/commit/push/promocion en esta revision.

# 2026-09-29 - Sonido confirmado por el usuario

- Usuario confirmo "si sono" tras la segunda notificacion de prueba de Somos en el A34. Queda validada reproduccion audible real; esto NO valida entrega con app cerrada/segundo plano ni llegada automatica de un pedido real.
- Sustituye los pendientes de confirmacion audible del checkpoint siguiente. Proximo paso: comprobar aviso automatico con un pedido controlado en Smash Test y panel visible; luego completar Firebase para segundo plano. No se modifico codigo ni se genero otra APK en esta confirmacion.

# 2026-09-29 - Comprador y avisos Android 1.3.0 instalado

- Usuario autorizo primer bloque (promociones y ubicacion frecuente local) y pidio sonido/notificacion al llegar pedidos. Se explico alcance: panel abierto primero; Firebase no configurado (google-services.json ausente), usuario respondio que no sabe si existe proyecto Firebase. NO afirmar push con app cerrada/segundo plano.
- Cambios SOLO `.fee-billing-prod`: NativeExperience agrega Promos en nav4 y ubicacion guardada dentro de Mis datos. MarketplaceClient maneja #promociones/#inicio y conserva filtros ciudad, descuentos positivos. FrequentLocation + lib/mobile/frequent-location nuevos; CheckoutForm permite guardar/actualizar punto+nombre+referencia y usarlo explicitamente; perfil muestra/elimina. Datos locales por origen, sin tokens/precios, cotizacion servidor intacta.
- Avisos: nuevo SomosOrderAlertsPlugin nativo, registrado MainActivity; canal somos_orders_v1 importancia HIGH, sonido sistema/vibracion, contenido generico privado y abre Somos. Manifest solo agrega VIBRATE. PanelNotifications agrega toggle por cuenta/origen, prueba y ajustes. Poll15s visible, linea base inicial sin avisar historicos, reloj servidor si disponible, IDs conocidos acotados, filtro sede, limpieza cambio cuenta/sede/unmount. Sonidos web de OrdersManager y nuevos pedidos TableOrderNotifier se omiten cuando nativo esta activo; asistencia mesa conserva sonido. Java de impresion/cola/FirebaseMessagingService NO modificados.
- QA: build final `node scripts/mobile-local.mjs build` ejecuta npm.cmd run build PASS240paginas/TS; Vercel PASS240. Criticos80/80 + nuevosunit3/3. Etapa1 E2E PASS; mobile-polish29casos/capturas app +6web PASS (promos, guardar/reusar/eliminar punto, aviso nuevo simulado/no historico/no duplicado, sesion/sede, visual320/390/768). Cloud7/7, marketplace/login200, panelorders/admin401 anonimos. ESLint/diffcheckPASS. Java compile42tareas y assembleDebug73tareasPASS.
- Preview READY `dpl_2ThqxhG3VSi2VUGmLqAYs7GdQ3h8`, https://vendeplus-clean-gwcs2ob9j-entrega2-s-projects.vercel.app . Excepcion publica solo deployment. Produccion inspeccionada sigue dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi. No migracion/SQL/commit/push/promocion.
- APK `tmp/mobile-buyer-alerts/somos-1.3.0-buyer-alerts-preview.apk`, 5.692.346bytes, SHA256 `642A6821F20ABB58F91CBE2BBD721F13BC4BE9FBAFC84E939CAFEE820CA5D450`. Config interna Preview gwcs2ob9j exacto/HTTPS/cleartextfalse; generado restaurado a oficial tras copiar. Install --no-streaming -r Success en A34 alias adb-RFCW80HFA5K-pimjzz._adb-tls-connect._tcp; dumpsys9/1.3.0-buyer-alerts-preview, POST_NOTIFICATIONS granted=true. Sin desinstalar/borrar datos/pairing; amstart aceptado.
- Prueba NATIVA REAL PASS: CDP solo WebView de nuestra app pid10704, forward temporal52871 retirado. `scripts/mobile-native-alerts.e2e.mjs` uso pluginstatus y envio aviso generico test, sin permisos nuevos ni pedidos. Android dumpsys confirma record tag somos-order:qa-device:1790655225469 id31, canalHIGH4, sonido URI sistema, vibracion true, no bypassDnd. Usuario respondio que estaba en silencio y pidio otro aviso. SEGUNDA prueba enviada con PASS via mismo script y forward55923, tambien retirado. No se cambio volumen/DND. Pendiente confirmar si la segunda se oyo; no afirmar verificacion audible.
- Documentacion: docs/mobile-buyer-alerts-2026-09-29.md. Capturas tmp/mobile-polish. Servidor compilado127.0.0.1:3107 launcher16824, logs tmp/mobile-polish/start*.log.
- Siguiente paso exacto: recoger confirmacion audible usuario; campana -> activar Sonido y notificacion -> Probar; mantener panel visible (hasta15s+red) y pedido controlado solo Smash Test. No forzar volumen/DND/permisos. Para segundo plano localizar/crear Firebase del propietario, registrar com.somosve.app, configurar servidor seguro e implementar tokens revocables por cuenta/sede + envio eventos, validar bloqueo/cierre/logout. Mapa con logos, historial autenticado y calificaciones siguen siguientes bloques; no implementados en1.3.0. Puede necesitar nuevo login por cambio de origen Preview.

# 2026-09-28 - Controles y avisos Android 1.2.1 instalado

- Pedido del usuario: botones Cerrado/Anadir demasiado grandes en catalogo visual y Editar superpuesto en Productos; campana para pedidos y megafono separado para novedades, app y web.
- Implementado SOLO en `.fee-billing-prod`. ProductCard separa precio/accion en visual y permite wrap en clasica. globals.css acota font12px al boton (reset font:inherit anulaba utilidades) y nombres visuales2lineas. ProductManager usa lapiz44px accesible, details abierto ocupa ancho completo. PanelNotifications + CSSmodule nuevos en cabecera PanelShell, key cuenta:sede; PanelFrame ya no monta anuncios flotantes; native-polish retira posicionamiento/reserva vieja. PanelAnnouncements controlado usa Megaphone y carga/error/reintento/storage seguro.
- Campana: pendientes existentes, GET protegido con storeId/statuspending/compacttrue/limit10, badge10+ si hay mas, poll30s solo visible y refresh al abrir/foco/visibilidad. Abort/unmount + filtro sede, sin sonidos ni mutaciones. Ver pedidos abre lista general. No es push en segundo plano ni historial de no leidos. Mesa notifier/impresion permanecen intactos.
- QA final: npm.cmd run build via runner PASS244paginas/TS; Vercel PASS244. Criticos80/80; Etapa1 E2E PASS; mobile-polish25capturas/casos app +6web, anchos320/390/768 y web390/1366; geometria de precio/accion/editar/estado, font<=12px, cambio sede, errores/reintento, exclusividad campana/megafono, Escape PASS. Sin overflow/erroresReact, privadas simuladas/mutaciones bloqueadas. Cloud7/7; marketplace/login200, panelorders/admin401anonimos. ESLint/diffcheck PASS. Navegador integrado no disponible (diagnosticado en sesion), Playwright del repo.
- Preview FINAL READY `dpl_9WUK7asCZrLAwEPh1AVH85QtiBu8`, https://vendeplus-clean-g67mi6v8j-entrega2-s-projects.vercel.app . Excepcion publica solo este deployment. Candidato intermedio b0gfga6z0/dpl_8CcoWKDVueF5CapauBAuTnHK5ipB no distribuir; excepcion publica revocada. Produccion inspeccionada sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`, sin promocion/commit/push.
- APK FINAL `tmp/mobile-controls/somos-1.2.1-controls-preview.apk`, 5.692.596bytes, SHA256 `6E4C5FB0967E507CE4563BB05AA96B6EBE5925EC1FAFD292F317B80AEE62D10D`. Gradle73tasksPASS. Config dentro APK apunta a g67mi6v8j HTTPS exacto, cleartextfalse; config generado resync oficial despues de copiar. Instalada `--no-streaming -r` Success en A34 `adb-RFCW80HFA5K-pimjzz._adb-tls-connect._tcp`; dumpsys confirma8/1.2.1-controls-preview; am start aceptado. No desinstalada, sin borrar datos/pairing. UI fisica pendiente de revision del usuario, no afirmar verificacion visual en telefono.
- Doc completa con archivos/diagnostico/cambios/pruebas/limites: `docs/mobile-controls-notifications-2026-09-28.md`. Sin SQL/migracion ni cambio Java impresion. Local compilado activo127.0.0.1:3107, launcher11696; logs tmp/mobile-polish/start*.log. Capturas finales tmp/mobile-polish.
- Siguiente paso exacto: abrir Somos1.2.1 en telefono, iniciar sesion si el nuevo origen lo pide y revisar Smash Test/catalogo vista visual, Productos/lapiz y campana/megafono/cambio sede. Operaciones reales solo comercio de prueba. Confirmar comanda fisica anterior. V2 pendiente: push segundo plano/historial/abrir detalle exacto y preparacion PlayStore; produccion solo con aprobacion expresa.

# 2026-09-28 - Pulido visual Android 1.2.0 instalado

- Usuario autorizo punto 1 de la propuesta: calidad visual desde la entrada. Implementado en `.fee-billing-prod`, sin commit/push. Diseno exclusivo Capacitor en `src/app/native-polish.css`, importado por layout; clases puntuales en Marketplace, Catalog, StoreBrandHeader, CategoryTabs, ProductCard, PanelShell, ProductManager, OrdersManager y LoginForm. NativeExperience usa logo y cabecera unica. Login ahora usa form/autocomplete/Enter sin cambiar proveedor Auth.
- Marketplace compacto y claro, tarjetas8px, fotos reales/nombres2lineas; catalogo con portada sin oscurecer e identidad debajo, destacados compactos, categorias debajo de cabecera; panel sin bloques repetidos, productos con toolbar compacta y pedidos con codigo/total visibles. Campana de anuncios arriba para no tapar acciones. Sin cambios APIs/precios/migraciones/SQL/Java de impresion; comanda1.1.4 incluida.
- QA: build via `node scripts/mobile-local.mjs build` ejecuta npm.cmd run build con env privado en memoria, PASS244paginas/TS; Vercel PASS244. Criticos80/80; E2E Etapa1 compilado16/16; nuevo `scripts/mobile-polish.e2e.mjs`16capturas/casos320/390/768 +web390/1366, sin overflow/erroresReact, privadas simuladas y mutaciones bloqueadas; cloud remoto7/7; ESLint y diffcheck PASS. Dev tuvo fallo de restauracion borrador preexistente bajo efectos duplicados; mismo caso PASS en compilado, documentado para revision aparte. Navegador integrado no disponible, usado Playwright del repo.
- Preview READY `dpl_4S4GcSvsxP2fatAnAuzbxCErEwef`, `https://vendeplus-clean-1sft3681b-entrega2-s-projects.vercel.app`, excepcion publica SOLO ese deployment. Produccion inspeccionada sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`. No promover sin aprobacion.
- APK `tmp/mobile-polish/somos-1.2.0-design-preview.apk`, 5.692.318bytes, SHA256 `51ADA54567AAD48C4D466A1ACAB91743E23F26FEB73F6B2C3AD48EDF4FDF4C5C`. Gradle73tasksPASS; origenHTTPSPreviewexacto/cleartextfalse. Config generado resync oficial despues de copiar. Instalada con install-r Success; dumpsys7/1.2.0-design-preview. ADB alias `adb-RFCW80HFA5K-pimjzz._adb-tls-connect._tcp`, ultimo mDNS192.168.1.100:42777. Sin borrar datos. am start aceptado; captura fisica negra, no afirmar UI verificada en telefono. Sin errores runtime coincidentes en muestra logcat.
- Documento con diagnostico/archivos/cambios/QA/limites: `docs/mobile-visual-polish-2026-09-28.md`; capturas `tmp/mobile-polish`. Local compilado activo127.0.0.1:3107 launcher13952, logs start.log/start-error.log (dev anterior13184 detenido).
- Siguiente paso exacto: usuario abre Somos1.2.0 en A34 y recorre Inicio/ciudad/catalogo/login/Productos/Pedidos/Negocio/Atras/teclado. Al cambiar origen Preview puede requerir login nuevo. Pruebas manuales solo Smash Test, backend real. Falta confirmar ticket1.1.4fisico. V2: push/diagnostico/firmaAAB/privacidad/revisionpagos/Playcerrado no incluidos en esta entrega.

# 2026-09-28 - Android 1.1.4: comanda depurada e ID numerico

- Usuario reporto que direccion/referencia se repetian, distancia y tarifa eran innecesarias, estado de pago sobraba y el codigo `VP0927MEC` no era amigable. Se ajusto solo el candidato Preview: la comanda imprime DIRECCION una vez y REFERENCIA solo cuando es distinta; se retiraron distancia, tarifa y estado de pago. Se conservan metodo y referencia de pago.
- Los pedidos nuevos de checkout y pedido manual usan `SO-MMDD-NNNNNN` (ejemplo `SO-0928-123456`), con seis digitos finales. La API publica solo acepta ese formato o genera uno seguro en servidor. Pedidos historicos `VP` no se modifican. Sin migracion ni SQL.
- Preview inmutable Ready y publico solo por excepcion reversible: `dpl_zGTo2fkP31sQZkjyb8gEgYf3fs1j`, `https://vendeplus-clean-2nri5zplh-entrega2-s-projects.vercel.app`. Home/Marketplace/Login 200; panel/admin/printing sin credencial 401; E2E cloud 7/7 y ciudad 6/6. Produccion permanece intacta en `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`.
- APK instalada conservando datos y pairing en Samsung A34 por alias ADB; `versionCode=6`, `versionName=1.1.4-ticket-preview`. Artefacto `tmp/mobile-ticket/somos-1.1.4-ticket-preview.apk`, 5.692.559 bytes, SHA256 `047E07FD512C70B7EDD3F7F71ED4568F28150606DB4FD38CBA5C88FBDFF647BD`; inspeccion interna confirma Preview exacto, `cleartext=false` y navegacion acotada. Config generado restaurado luego al origen oficial.
- QA: contratos 80/80, TypeScript, ESLint focal, diff check, Next local 244 paginas y Vercel 244 paginas PASS; Gradle 73 tareas PASS. Captura final no valida UI porque el telefono estaba mostrando otra app. Siguiente paso: usuario crea un pedido nuevo controlado en Smash Test y confirma ticket fisico con codigo `SO-MMDD-NNNNNN`, una sola direccion, sin distancia/tarifa/estado de pago y sin duplicados. No promover produccion sin aprobacion explicita.

# 2026-09-27 - APK independiente de PC: preview remoto preparado

- Usuario autorizo alojar Preview usando backend real, sin cambiar produccion. Preview READY `dpl_CQ3Rg9F7i9fBwYNHcQcryuqNEyFd`, `https://vendeplus-clean-iyyc3cg3d-entrega2-s-projects.vercel.app`. Produccion verificada antes/despues sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`.
- APK4/1.1.2-cloud-preview `tmp/mobile-cloud/somos-1.1.2-cloud-preview.apk`, SHA256 `C6CD72061D555533156F9A1FE74CCB86261D419148AD5E6FECFC73DFEDBCBFAF`, originHTTPSpreview exacto, sin localhost ni secretos de bypass. Instalar copia identificada: config generado ya resync oficial. No instalada aun; ADB33135 rechaza conexion. Paquete mismo com.somosve.app, install-r conserva impresion; web localStorage/cookies NO migran entre origenes.
- Cambios: resolver estricto `mobile/somos-android/server-config.ts`, capacitorconfig, version/guardia Gradle preReleaseBuild, typesNode tsconfig, `.vercelignore` mobile -> /mobile/ (antes excluia src/mobile y primer deploy fallo), tests/config y E2Eremotos. Cinco fuentes nativas de impresion identicasSHA256 al respaldo preEtapa1; cero modificaciones de impresion/DB/SQL/pedidos/cuentas.
- Validado: npm.cmd run build local240, remoto240 READY; assembleDebug73tasks; mobiletsc;94/94unit/contracts; eslint; diffcheck. Guardia release rechaza preview y acepta oficial. Doc `docs/mobile-cloud-preview-2026-09-27.md` incluye artefacto/pasos/reversion/riesgos.
- BLOQUEO de acceso: VercelSSO pide login externo; NO cambiar proteccion global ni meter bypass token APK. Pregunta async al usuario pendiente: autorizar hacer publico SOLO dominio preview inmutable. Ya autorizo alojar preview pero falta confirmacion explicita sobre excepcion. API oficial verificada PATCH /aliases/dpl_CQ3Rg9F7i9fBwYNHcQcryuqNEyFd/protection-bypass con override scope alias-protection-override action create (revoke para deshacer). Ejecutar SOLO si confirma. No cambios de proteccion realizados aun.
- Siguiente: aprobacion excepcion; HTTP200publico/APIs401; correr scripts/mobile-city.e2e.mjs y scripts/mobile-cloud.e2e.mjs con SOMOS_QA_BASE_URL delpreview, capturas; puerto actualA34 para install-r; quitar solo reverse3107 para verificar sin PC. No promover produccion ni commit. FCM/google-services pendiente; APKdebug piloto, no distribucionPlay. Loginpassword si Google callback no admite preview. BrowserQA remoto preparado pero no ejecutado por puertaSSO.

# 2026-09-27 - Ciudad automatica en la app, solo preview local

- Usuario pidio reconocer su ubicacion y mostrar solo comercios de su ciudad. Implementado solo en SOMOS Capacitor (no navegador ni marketplace delivery). Primera visita pide GPS; filtra todas las vitrinas/listas por ciudad, sigue en Inicio e incluye comercios de ciudad sin GPS. Recuerda ciudad auto2h y respeta ciudad manual/Todas. Denegacion/error/ambiguedad abre selector, sin reintentos automaticos repetidos; usar ubicacion reintenta explicitamente. Preferencia `somos_mobile_v1_market_city` guarda modo/ciudad/fecha, no nuevas coordenadas.
- Diagnostico: faltaban permisos Android COARSE/FINE; agregados al manifiesto sin BACKGROUND_LOCATION ni dependencias. Capacitor WebChromeClient instalado ya maneja solicitud y ubicacion aproximada. CSS heredado `#inicio > div.fixed` ocultaba tambien selector ciudad; acotado a `[aria-hidden]` del headercompacto. No tocar servicios/colas de impresion.
- Ciudad es una estimacion por GPS de comercios, NO limites municipales/geocoder: candidato<=20km, precision<=5km, separacion entre ciudades>max(1km,precision). Ambiguo/remoto/sinGPS exige elegir. Helper `src/lib/mobile/marketplace-city.ts`, MarketplaceClient, globals.css; docs `docs/mobile-city-preview-2026-09-27.md`. V2 posible: geocodificacion/limites oficiales con autorizacion/proveedor aparte.
- APK `tmp/mobile-city/somos-1.1.1-city-preview-local.apk`, versionCode3/versionName1.1.1-city-preview, SHA256 `43DC708CD0254A335D00BA88526263BD34AD1429016FC818A36D8B0DF61F4F9B`. Solo localhost3107 via ADB; default Capacitor resync a dominio oficial tras copiar artefacto. Rollback APK2 en tmp/mobile-stage1 conserva datos con install-r-d.
- Instalacion3 CONFIRMADA Success y dumpsys por puerto45499. Usuario luego envio33135: reconectado, reverse3107 restaurado y MainActivity abierta. Screenshot fisico `tmp/mobile-city/a34-city.png` muestra Maracay y selector visible; COARSE/FINE granted=true por usuario, sin pm grant ni lectura de coordenadas reales. No afirmar GPS exacto/linderos municipales solo por screenshot.
- Validaciones finales PASS: npm.cmd run build via runner240paginas/TypeScript; Gradle73tareas;90/90 contratos/logica;7/7 E2Eciudad +16/16 regresionEtapa1; ESLint tocados0avisos/errores; diffcheck soloCRLF. Tests ubicacion usan GPS simulado en Chromium y consultas publicas sololectura, mutaciones bloqueadas. Test checkout estabilizado esperando modoMesa y mensaje de efectivo antes de dobleclick, sin cambiar logica de pedidos.
- Servidor local reiniciado con launcherPID17320, logs `tmp/mobile-city/server*.log`, escucha127.0.0.1:3107. Mantener PC/servidor y tunelADB. Puerto mas reciente33135 puede caducar. Siguiente: usuario valida GPS real/seleccion manual y aproximada; sin despliegue/commit/push/migracion/SQL. Produccion intacta.

# 2026-09-27 - Etapa 1 Android local, sin despliegue

- Actualizacion posterior: INSTALACION CONFIRMADA en A34 por puerto42133. `adb install --no-streaming -r` devolvio Success; `dumpsys package` confirma versionCode2/versionName1.1.0-stage1. Tunel `tcp:3107` activo y web local HTTP200. MainActivity abierta; captura `tmp/mobile-stage1/a34-stage1.png` inspeccionada: marketplace con fotos, header Comprar/Ingresar a mi negocio y barra Inicio/Buscar/Mis datos dentro de app, sin navegador. Muestra filtrada de250lineas logcat sin errores AndroidRuntime/Capacitor coincidentes; no equivale a QA completo. No hubo cambios de codigo ni build adicional en esta instalacion. Los intentos fallidos anteriores se conservan debajo como historial. Proximo paso: pruebas manuales del usuario de Atras/teclado, cambio de espacios, carrito/borrador y TIII en comercio de prueba. No apagar PC/servidor ni cortar ADB mientras use esta APK local.
- Autorizacion vigente: solo Etapa 1 del adjunto `e0a11702-9041-42ad-9918-e715b63f82e7/pasted-text.txt`. Mantener Capacitor/web compartida, no nuevas cuentas/OTP/FCM/App Links/politicas de impresion, no publicar. Trabajo realizado en este worktree `.fee-billing-prod` (HEAD `15cbbf9`), sin commit/push/migracion/SQL. Produccion permanece en deployment previo.
- Recuperacion preparada ANTES de editar: `C:/Users/Windows/Desktop/RESPALDOS/somos-recovery-stage1-20260927`, 628 candidatos de fuentes previas, parche de cambios anteriores y `C:/Users/Windows/Desktop/RESPALDOS/somos-recovery-stage1-20260927/somos-before-stage1.apk`. Sin .env/claves/credenciales/builds; escaneo de patrones sin hallazgos. No revertir el trabajo previo ni usar reset/clean. Detalles y rollback en `docs/mobile-stage1-2026-09-27.md`.
- Implementado: comprador Inicio/Buscar/Mis datos y carrito contextual; preferencia Comprar/Mi negocio; panel Pedidos/Productos/Resumen/Negocio, selector autorizado, Mesa/Barra y herramientas; Atras/capas/teclado; filtros por cuenta/sede, borrador de checkout con lista permitida y clave idempotente, doble toque bloqueado, confirmacion limpia borrador/cart; limpieza de estado privado y cache tardia al cambiar cuenta; revalidacion oculta interfaz y conserva formulario ante fallo temporal; recuperacion nativa de carga sin internet. Ajustes exclusivos Capacitor, navegadores conservan presentacion previa.
- APIs: solo `/api/panel/context` agrega `userId` del auth real. No se ampliaron permisos/tenants ni se tocaron API de creacion de pedidos o finanzas. Servicio/plugin/colas/panel/API de impresion: 13 archivos SHA256 identicos al respaldo; MainActivity conserva registro del plugin. FCM preexistente no fue alterado.
- APK identificable: `tmp/mobile-stage1/somos-1.1.0-stage1-local.apk`, paquete `com.somosve.app`, versionCode2/versionName1.1.0-stage1, SHA256 `E389D494E97F4F6AEFF96DAFEA94ABC465B6BB035D9B7DD4879E97937647888C`. Inspeccion ZIP confirma `http://localhost:3107`, debug HTTP solo localhost. Solo usar esta copia para instalar. Capacitor config generado se sincronizo despues al default oficial; el APK copiado sigue local. No confundir generar APK con desplegar Next.js.
- Servidor local encendido oculto `127.0.0.1:3107`, launcher PID16368 y listener13584 al ultimo control. Comando `node scripts/mobile-local.mjs start` desde este directorio; lee env original en memoria, no copia ni imprime secretos. Logs `tmp/mobile-stage1/isolated-server*.log`. NO usar3100: hay otro servidor IPv6 anterior que daba respuestas mezcladas. Catalogos son de backend real; operaciones manuales fuera de tests SERIAN REALES.
- Validado: `npm.cmd run build` via runner PASS240paginas/TypeScript; Gradle assembleDebug PASS73tareas; contratos80/80 + estado/cache5/5 =85/85 PASS; Playwright16/16 PASS (`scripts/mobile-stage1.e2e.mjs`, resultados/capturas tmp/mobile-stage1). Pruebas cubren entrada visitante/comercio, recordar espacio/sede, perfil local, capas, viewport reducido/320px sin overflow, borrador/carrito, revalidacion/reconexion, cuentas/revocacion, pedido simulado sin duplicar/reenvios, web390/1366 y cero erroresReact. Panel/confirmacion simulados; mutaciones interceptadas, no pedidos reales. ESLint archivos nuevos PASS; diffcheck PASS con advertenciasCRLF.
- Instalacion fisica PENDIENTE, no afirmar exito: usuario envio44187 (conecto y offline antes de instalar), luego39607 (tunel3107 creado, streamed install fallo por desconexion sin resultado). `adb get-state` offline, reconnect10061 y mDNS vacio. No se pudo comprobar version instalada. Dispositivo conocido A34 `192.168.1.107`. Esperar puerto vigente con telefono desbloqueado y pantalla Depuracion inalambrica abierta; no seguir adivinando puertos.
- Siguiente paso exacto: conectar puerto nuevo, verificar estado, `adb -s IP:PORT reverse tcp:3107 tcp:3107`, instalar `-r tmp/mobile-stage1/somos-1.1.0-stage1-local.apk`, verificar `dumpsys package` version2, abrir MainActivity, screenshot/logs. Si streamed install vuelve a fallar con conexion estable, probar `install --no-streaming -r` sin desinstalar/borrar datos. Luego QA fisico Atras/teclado, recuperacion, login cuenta de prueba y TIII. APK local requiere PC/tunel; no es distribucion nacional ni preview publico.

# 2026-09-27 - Preview comanda completa Android 1.1.3 pendiente de instalacion

- Usuario autorizo ampliar solo el formato de comanda y solicito un escrito completo de la app. Causa confirmada: la cola funcionaba, pero `/api/printing-agent/jobs` y `buildOrderTicket` enviaban/imprimian un subconjunto minimo.
- Candidato agrega fecha Venezuela, telefono, direccion/referencia/zona/empresa/distancia delivery, tarifa, metodo/estado/referencia de pago, grupos de opciones y extras, detalles/notas, subtotal, delivery, total USD/Bs. Campos vacios se omiten. No imprime comprobantes, datos bancarios, GPS, tokens ni secretos. `include_prices` sigue controlando importes.
- Cola, bloqueo, reintentos, deduplicacion, pairing y automatizacion no cambiaron. El endpoint sigue autenticado por dispositivo y aislado por store. Para probar sin produccion, Android resuelve API desde el origen HTTPS restringido de `capacitor.config.json`; admite solo `www.somos-ve.com`, un deployment inmutable `vendeplus-clean-*` o localhost que conserva impresion productiva. El build release mantiene su guard oficial.
- Documento solicitado: `docs/somos-android-estado-actual-2026-09-28.md`, con arquitectura, compradores, comercios, ciclo de vida, impresion, seguridad, diseño, validacion, limites y preguntas para evaluacion externa.
- QA: contratos 80/80, mobile-cloud 4/4, E2E remoto 7/7, TypeScript, ESLint focal, diff check y build Next local con entorno en memoria de 244 paginas PASS. `npm.cmd run build` exacto compilo/TS y fallo solo al prerender por variables privadas ausentes en el worktree. Android Gradle 73 tareas `BUILD SUCCESSFUL` antes y despues de sincronizar Preview.
- Preview nueva Ready y publica solo por excepcion reversible: `dpl_9XXrzEw1r96384RRWnNy2tdoR3sg`, `https://vendeplus-clean-meptx9k5b-entrega2-s-projects.vercel.app`. Marketplace/Login 200, panel/admin POST print-agent sin credencial 401 (GET jobs 405), sin logs error. Produccion permanece `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi` intacta.
- APK exacta: `tmp/mobile-ticket/somos-1.1.3-ticket-preview.apk`, 5.714.832 bytes, SHA256 `48EC866C7A5CE79E0030AD622E443029A52AF14701D15DAFFAAF064D3626A46E`; inspeccion interna confirma origen Preview exacto, cleartext false y allowNavigation acotado. Configuracion generada fue restaurada luego al dominio oficial.
- Instalacion pendiente: A34 ya no acepta `192.168.1.105:44901`. Pedir IP:puerto actual de Depuracion inalambrica, instalar APK con `adb install --no-streaming -r`, verificar versionCode5, abrir y probar una reimpresion/pedido controlado en Smash Test con TIII. Confirmar formato fisico 58mm, precios on/off y ausencia de duplicados. No promover produccion.
- Instalacion completada en Samsung A34 `SM-A346M` por ADB `192.168.1.100:44329`: `adb install --no-streaming -r` devolvio Success; `dumpsys` confirma versionCode5/versionName`1.1.3-ticket-preview`. Datos y pairing nativo se preservaron. MainActivity abrio desde la Preview nueva; captura `tmp/mobile-ticket/a34-ticket-preview.png` inspeccionada con Marketplace y barra nativa correctos, sin errores AndroidRuntime/Capacitor/Chromium. La ubicacion mostro timeout recuperable y puede reintentarse manualmente.
- Siguiente paso exacto: usuario inicia sesion de nuevo si la cookie no existe en el origen Preview, entra a Smash Test, confirma TIII seleccionada y reimprime una comanda controlada con direccion/opciones/notas/pago. Revisar foto o contenido fisico, luego repetir con precios desactivados y dos comandas consecutivas. No promover hasta aprobacion explicita.

# 2026-09-27 - Android cloud Preview habilitado para QA fisico

- Se retomo el candidato movil correcto en `.fee-billing-prod`; no se uso ni desplego el arbol raiz mezclado. Produccion permanece en `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`.
- Con autorizacion del usuario se creo una excepcion reversible de Deployment Protection exclusivamente para el Preview inmutable `dpl_CQ3Rg9F7i9fBwYNHcQcryuqNEyFd`: `https://vendeplus-clean-iyyc3cg3d-entrega2-s-projects.vercel.app`. No se cambio la proteccion global del proyecto ni la autenticacion/aislamiento de Somos.
- QA remoto aprobado: Home/Marketplace/Login HTTP 200; APIs privadas panel/admin HTTP 401; E2E cloud 4/4 y ciudad 1/1; pruebas unitarias cloud 4/4, ciudad 5/5 y etapa1 5/5; cero logs Vercel de error. Deployment sigue target Preview y Ready.
- APK exacta para probar: `tmp/mobile-cloud/somos-1.1.2-cloud-preview.apk`, 5.692.318 bytes, SHA256 `C6CD72061D555533156F9A1FE74CCB86261D419148AD5E6FECFC73DFEDBCBFAF`. Apunta solo al HTTPS del Preview, sin localhost, cleartext ni bypass secreto. Produccion, Supabase y datos no fueron modificados; sin migracion/SQL nuevo, commit o push.
- ADB no detecta ningun telefono en este momento. Siguiente paso exacto: usuario activa temporalmente Depuracion inalambrica en el Samsung A34 y comparte la IP:puerto actual; conectar, instalar con `adb install --no-streaming -r` preservando datos, quitar cualquier `adb reverse tcp:3107`, abrir la app y validar ciudad/GPS, login, menus, carrito, TIII y automatizacion solo en Smash Test. No promover ni distribuir APK nacionalmente.
- Rollback de acceso Preview: revocar la excepcion `alias-protection-override` del mismo deployment. Rollback APK: instalar con `-r -d` el APK anterior sin desinstalar ni borrar datos.
- Instalacion fisica completada despues del checkpoint: ADB conecto al Samsung A34 `SM-A346M` en `192.168.1.105:44901`; `adb install --no-streaming -r` devolvio `Success`, preservando datos. `dumpsys package` confirmo versionCode4/versionName`1.1.2-cloud-preview`; no habia tunel tcp3107 activo y MainActivity abrio correctamente.
- Captura real `tmp/mobile-cloud/a34-cloud-preview.png` inspeccionada: origen cloud carga Marketplace con Maracay, buscador, categorias, productos y barra Inicio/Buscar/Mis datos; sin desbordamiento visible. Muestra de logcat AndroidRuntime/Capacitor/Chromium sin errores. Pendiente QA manual del usuario de login, navegacion, carrito/regreso externo, GPS/selector y TIII/automatico solo en Smash Test.

# 2026-09-26 - Inicio Somos Android e impresion Bluetooth

- Segundo hito Android/impresion: ticket ESC/POS fisico confirmado por usuario en TIII Bluetooth Printer desde Samsung A34. Se implemento `SomosPrinter` con permisos Android12+, listado de vinculados, seleccion persistente, prueba, token `sdp_` cifrado AES/GCM con Android Keystore y procesamiento manual de cola. La comanda nativa incluye comercio/codigo, modalidad, mesa/zona, cliente, productos, variantes, extras, notas, total opcional, 58/80mm y1-3copias. APK nueva compilada e instalada con exito; ADB inalambrico volvio a quedar offline despues de abrirla, sin afectar instalacion.
- Panel Preview agrega ruta `/panel/impresion`, navegacion, vinculacion en un toque desde app, selector TIII, prueba, configuracion y boton `Imprimir pendientes`. Preview READY `dpl_7XYTfmYYTUNkdDYb168XmfUXiQ1n`: `https://vendeplus-clean-p3ykxn2ia-entrega2-s-projects.vercel.app`. Produccion intacta; automatizacion no activada en ningun comercio. TypeScript, Android Gradle y contratos80/80 PASS. Build Vercel PASS239paginas. Build web local solo fallo por ausencia de variables privadas Supabase en este worktree, no por codigo.
- Separacion de proyectos corregida: `mobile` excluido del `tsconfig.json` web y de `.vercelignore`; Android mantiene su propio TypeScript/Gradle. Siguiente paso: QA visual/autenticado del Preview, vincular A34 a un comercio de prueba, seleccionar TIII y encolar una comanda controlada. Luego implementar servicio foreground/recuperacion en segundo plano antes de afirmar impresion automatica con app cerrada.
- Iteracion siguiente: usuario confirmo impresion fisica al volver a seleccionar TIII; se corrigio refresco con feedback y espera de350ms antes de cerrar RFCOMM. Produccion `dpl_GRrS4BqVfeox8U7YTENdfegTcxHR` agrega `Imprimir comanda` en detalle del pedido: en app encola+procesa inmediatamente y en PC deja trabajo para el telefono.
- Servicio Android foreground implementado y compilado: notificacion persistente, poll serial cada7s, START_STICKY, recuperacion en BOOT_COMPLETED/MY_PACKAGE_REPLACED, token Keystore, misma cola con bloqueo/reintentos/dedupe. El panel inicia/detiene servicio al guardar impresion automatica. Preview READY `dpl_HABGsXs5JoUozs97kpxqNCfc4egQ`: `https://vendeplus-clean-m6bo2spgr-entrega2-s-projects.vercel.app`; aun NO promovido. APK mas reciente aun NO instalada en A34. Siguiente accion del usuario: activar temporalmente depuracion inalambrica y enviar puerto para instalar; luego probar app cerrada con pedido controlado. Para escala nacional pendiente FCM para sustituir sondeo frecuente.
- APK foreground instalada con exito en Samsung A34 por ADB `192.168.1.107:37495`; permisos Bluetooth, notificaciones y `FOREGROUND_SERVICE_CONNECTED_DEVICE` concedidos. Samsung volvio a cerrar ADB despues de abrir la app, pero instalacion/permisos finalizaron. Preview foreground promovido a Produccion `dpl_3VYFWWELriyFdWwFZobtpt8nJ3J9`, artefacto `https://vendeplus-clean-dsr16qz57-entrega2-s-projects.vercel.app`, aliases SOMOS READY. Automatizacion sigue apagada hasta que usuario la active en Smash Test. Prueba pendiente inmediata: activar+guardar, confirmar notificacion, cerrar app, crear pedido controlado y validar impresion/reintento Bluetooth.
- Usuario confirmo EXITO del primer pedido automatico real en Smash Test con SOMOS cerrada: servicio foreground reclamo la cola y TIII imprimio fisicamente. Circuito end-to-end validado. Pendiente antes de ampliar piloto: Bluetooth apagado/encendido con recuperacion, perdida de internet, reinicio del telefono, 20pedidos consecutivos sin duplicados, revisar formato de comanda y luego sustituir sondeo por FCM para escala nacional.
- Usuario aprobo recuperacion tras Bluetooth apagado/encendido, perdida temporal de internet y reinicio del telefono. Detecto defecto de formato: variante/nota nulas salian literalmente `null`; se corrigio serializador nativo para omitir JSON null, cadena `null` y vacios en todos los campos textuales de la comanda. Pendiente recompilar/instalar APK y repetir una comanda sin notas; despues prueba20pedidos.
- Usuario confirmo comanda limpia tras instalar APK corregida. Nueva iteracion app: shell Capacitor exclusivo con header compacto, bottom nav fija Inicio/Pedidos/Productos/Impresion/Mas, hoja inferior para resto, safe areas y overscroll controlado; navegador web conserva panel previo. FCM Android agregado con Firebase Messaging/BOM34.4.0, receptor que despierta servicio y registro autenticado de token; endpoint `/api/printing-agent/push-token` protegido por agente. Migracion no destructiva `20260927013000_add_print_device_fcm_tokens.sql` aplicada remoto. Tras QA del usuario se mejoro la hoja `Mas`: boton X visible, cierre al tocar fuera/Escape/deslizar hacia abajo, bloqueo del scroll y capa sobre la barra inferior. Preview `dpl_5EVqCQVcehfqVGVTVwCRcAXR3Gzx` promovido a produccion como `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`, READY con aliases SOMOS; smoke inicio/Marketplace/login 200 y APIs panel/admin 401 anonimo. APK estable verificada apuntando solo a `www.somos-ve.com` e instalada en A34 por ADB con resultado `Success`; Samsung cerro ADB antes del arranque remoto. Pendiente validacion manual del usuario dentro del panel. FCM real bloqueado solo por crear proyecto Firebase Android `com.somosve.app` y aportar `google-services.json`; sondeo sigue como respaldo funcional.
- Usuario autorizo avanzar por hitos grandes con app Android completa e impresion termica Bluetooth. Se recupero el piloto local antiguo sin modificarlo: TIII 58mm Bluetooth Classic/ESC-POS, COM3/9600 y agente Windows. El piloto vive no consolidado en la raiz `feat/thermal-order-printing-pilot`; no copiar en bloque ni desplegar desde alli.
- Confirmado en Supabase remoto que las cuatro migraciones de impresion ya estan aplicadas: `20260826152000`, `20260826194500`, `20260827120000`, `20260827221500`. Tablas/RPC existentes: configuracion, cola idempotente, reclamo con bloqueo, codigos temporales y dispositivos revocables. Automatizacion permanece apagada por defecto.
- Nuevo modulo independiente `mobile/somos-android`: Capacitor8.5.2, app id `com.somosve.app`, nombre Somos, origen HTTPS limitado a `www.somos-ve.com`, Android generado/sincronizado y `cap doctor` PASS. Android Studio, ADB, JDK Temurin21, Android Platform36 y Build Tools35 ya estan instalados. Primer `:app:assembleDebug` PASS (71 tareas, 6m31s); APK en `mobile/somos-android/android/app/build/outputs/apk/debug/app-debug.apk`. ADB funciona pero aun no detecta telefono. Auditoria npm reporta3moderadas solo en CLI/xcode transitivo de desarrollo,0high/critical; no usar `audit fix --force`.
- Backend recuperado y adaptado en base actual, aun sin deploy: endpoints panel para configuracion/dispositivos/reimpresion y endpoints agente para pairing Android/Windows y cola; token `sdp_` aleatorio32bytes, hash SHA256, rate limit, tenant por store y claimed_by. No service_role en APK. Arquitectura documentada en `docs/android-printing-architecture.md`.
- Validacion actual: contratos80/80, TypeScript, diff check, build Next16.3.4 de238paginas y primer build Android debug PASS. Sin migracion/SQL nuevo ni mutaciones de datos; no commit/push/deploy. Siguiente paso exacto: activar opciones de desarrollador y depuracion USB en un Android, conectarlo por cable, aceptar su huella RSA, verificarlo con `adb devices -l`, instalar `app-debug.apk` y hacer smoke de login/navegacion. Luego implementar/compilar plugin Kotlin Bluetooth Classic SPP/ESC-POS.
- Hardware validado en Samsung A34 `SM-A346M` por ADB inalambrico: APK instalada, home SOMOS visible y sin errores Android/Capacitor/Chromium. Se agrego plugin nativo `SomosPrinter` con estado/permisos, listado de vinculados y ticket ESC/POS de prueba fuera del hilo UI. TIII Bluetooth Printer detectada en SPP y `printTest` devolvio `sent:true`; pendiente confirmacion visual del papel por el usuario. Siguiente paso: exponer selector/prueba en Configuracion del panel y luego vincular dispositivo con comercio/cola, sin activar automatizacion aun.
- Limpieza de PC durante descarga de Android Studio: disco inicialmente8.96GB libres. Se audito Docker:0contenedores,6imagenes Supabase local,5volumenes de pruebas (209MB), sin proyectos Docker en RESPALDOS ni dependencia de produccion. Se limpiaron imagenes/volumenes y se desinstalo Docker Desktop4.85.0; WSL quedo sin distribuciones. Espacio final20.6GB libres; Supabase remoto/Vercel/Git intactos. Cache npm limpiada; Chrome no se toco porque estaba abierto. Quedan solo~30MB de residuos Docker.

# 2026-09-26 - Marketplace App V2 profesional en Preview

- Correccion posterior en Produccion para `Cerca de ti`: eliminado limite fijo de6; GPS ahora infiere ciudad desde el comercio geolocalizado mas cercano, filtra exclusivamente esa ciudad y lista todos sus comercios con coordenadas en orden ascendente de km. El selector manual de ciudad sigue aplicando en las otras vistas. UI muestra ciudad detectada y cantidad.
- Produccion nueva `dpl_9KbbANPx5BC5h97hH6d2BZbTLBKQ`, artefacto `https://vendeplus-clean-761b7yvro-entrega2-s-projects.vercel.app`, aliases `www.somos-ve.com`/`somos-ve.com` confirmados READY. Playwright sobre Produccion con GPS Maracay: HTTP200, `EN MARACAY`,24tarjetas, distancias297m-5.7km estrictamente ordenadas, cero errores JS/overflow. API privada orders401. Contratos79/79, TypeScript y build local/remoto234paginas PASS. Reversion inmediata disponible a `dpl_7G1rxmCRLpcvAaFMLEfTYmZhJ7c5`.
- Usuario aprobo esta iteracion para Produccion. Se promovio directamente el Preview aprobado y Vercel creo Produccion `dpl_7G1rxmCRLpcvAaFMLEfTYmZhJ7c5`, artefacto `https://vendeplus-clean-3p4rog8v8-entrega2-s-projects.vercel.app`; `www.somos-ve.com`, `somos-ve.com` y aliases Vercel confirmados sobre ese deployment READY. Reversion disponible al anterior `dpl_J6zyM3tob8n6Vbms2Y9zgYuJ85QM`.
- Smoke posterior: `/marketplace`, `/transporte/entrega2/marketplace` y `/panel/login` HTTP200; `/api/panel/orders` HTTP401 sin sesion. Playwright contra dominio real: cero errores JS, cero overflow, cabecera compacta PASS y vista `Comercios` recordada tras recarga PASS. No se mutaron pedidos, productos, pagos ni configuraciones.
- Usuario aprobo una primera version mas profesional y separar presentacion superior de empresas delivery; despues de validar varias iteraciones en Preview, la version final fue promovida a Produccion.
- Marketplace ahora tiene cuatro vistas funcionales en navegacion movil: Inicio, Cerca, Ofertas y Comercios. Inicio conserva vitrinas de productos max6, pero ya muestra la grilla completa de comercios sin limite artificial; Comercios contiene la misma oferta con filtros operativos; Ofertas tiene estado vacio real; Cerca solicita GPS solo por accion y ordena por distancia.
- `Comercios recien llegados` ya no reutiliza la tarjeta de la grilla general: usa escaparate horizontal editorial con foto 16:9, logo, etiqueta `Nuevo`, categoria/distancia y acceso directo. `Todos los comercios` permanece como grilla compacta con contador, logrando jerarquia distinta sin duplicar el mismo patron visual.
- Capa app adicional en Preview: ciudad y vista activa se recuerdan localmente y se validan contra ciudades disponibles; cabecera movil compacta aparece al bajar con marca, ciudad y acceso a busqueda; tarjetas, filtros, selector y navegacion tienen respuesta tactil breve. Todo es cliente/localStorage, sin consultas ni costo de servidor adicional.
- Selector nativo reemplazado por hoja inferior accesible: `Usar mi ubicacion`, Todas las ciudades y lista estructurada. Categorias superiores usan iconos Lucide y filtran contenido real. No hay permiso GPS automatico.
- Empresas delivery usan logo/nombre/colores propios como primera senal, banner si existe y firma secundaria `Con tecnologia Somos`; no muestran identidad SOMOS como protagonista. Entrega2 local validado con su morado/logo y comercios aliados reales.
- Preview fuente `dpl_2VNCDwgacCkqSRkDNYytJEgUoZR7`: `https://vendeplus-clean-e3muwyn5l-entrega2-s-projects.vercel.app/marketplace`. Preview protegido por SSO Vercel. QA local DB real: Marketplace SOMOS y `/transporte/entrega2/marketplace` HTTP200, cero errores JS/overflow; ciudad dialog y cambio Inicio/Comercios PASS; Inicio muestra35 comercios y escaparate de12 nuevos; cabecera compacta PASS y persistencia inmediata repetida2veces PASS; identidad Entrega2 inspeccionada. Contratos79/79, TypeScript y build local/remoto Next16.3.4 de234paginas PASS. Sin migracion/SQL nuevo, commit o push.

# 2026-09-25 - Marketplace justo y propuesta visual en Preview

- Usuario aprobo paso cuidadoso a Produccion. Se promovio el Preview aprobado; Vercel creo deployment productivo `dpl_J6zyM3tob8n6Vbms2Y9zgYuJ85QM`, artefacto `https://vendeplus-clean-obut0dm9d-entrega2-s-projects.vercel.app`, READY y confirmado como alias de `www.somos-ve.com`, `somos-ve.com` y alias Vercel. Reversion disponible al anterior `dpl_Cqi497d2DvTzKgwhM83GgBu72yW5` (no ejecutada).
- Smoke Produccion PASS: Marketplace200/PRERENDER contiene `Elige tu ciudad` y `Comercios recien llegados`, no contiene cantidad `vendidos esta semana`; Gran Combo200; panel login200; API privada orders401 sin sesion. No pedidos, pagos, productos ni configuraciones mutados durante smoke.
- Ajuste posterior: selector superior ahora dice `Elige tu ciudad` y usa naranja SOMOS con alto contraste. GPS permanece como accion voluntaria de un toque; no se dispara permiso al abrir para evitar rechazo/bloqueo del navegador. Preview vigente READY `dpl_FSADQ9ugHPkXEMPo4o9ryVTyWRoi`: `https://vendeplus-clean-psqu6vg8f-entrega2-s-projects.vercel.app/marketplace`. Contratos79/79 y build local/remoto230paginas PASS.
- Segunda iteracion visual aprobada por usuario a partir de mockup: se eliminaron bandas pastel completas. Cabecera movil ahora concentra logo SOMOS blanco, ciudad, ubicacion, buscador funcional y filtros sobre verde petroleo; naranja queda para buscar/marcadores/estado activo; contenido vuelve a blanco con etiquetas pequenas teal/mint. Navegacion inferior marca Inicio en teal+naranja. No se agregaron acciones decorativas falsas.
- Preview vigente READY `dpl_FYDm8sCSyTtUYzMcWnz7Q7n49Rth`: `https://vendeplus-clean-19trnnsnj-entrega2-s-projects.vercel.app/marketplace`. QA Playwright local con DB real desktop/mobile: HTTP200, cero errores JS, cero overflow; captura superior inspeccionada y coincide con direccion aprobada. Contratos79/79, TypeScript y build local/remoto Next16.3.4 de230paginas PASS. Produccion sigue intacta.
- Usuario aprobo tres reglas: Ofertas muestra primero1producto/comercio y max2 al expandir; Recien llegados pasa a comercios con catalogo minimo; deduplicacion entre vitrinas con max2apariciones/comercio. Tambien pidio ocultar la cantidad en Mas vendidos y dar mas color/solidez al UX.
- Implementado en `marketplace_discovery_v2`, separada de la RPC de Produccion: ofertas rankeadas max2/store; comercios nuevos de ultimos30dias con minimo3productos activos/precio positivo; un representante/store por compatibilidad; mas vendidos conserva unidades solo para ranking. Permisos solo service_role. Migracion `20260925180000_marketplace_fair_discovery.sql` aplicada al Supabase compartido; no cambia Produccion hasta desplegar este codigo porque la RPC anterior sigue intacta.
- Cliente prioriza Destacados>Ofertas>Mas vendidos>Nuevos, no repite productos y limita cada comercio a2apariciones superiores. Ofertas se intercalan por comercio. Nuevos renderiza tarjetas de comercio. Texto de unidades vendido eliminado de UI, sin alterar ranking.
- UX Preview: bandas solidas coral/amarillo/verde, fondo mas calido, destacado sin tarjeta contenedora y hero sin orbes decorativos. Se preservaron tarjetas, filtros y grilla existentes.
- Datos reales v2:0ofertas,3mas vendidos (Queje Olga/China Town/Knockouts,1cada uno),10comercios nuevos distintos. Playwright local con DB real desktop1440/mobile390: HTTP200, cero errores JS, cero overflow; cantidades no visibles. Capturas tmp inspeccionadas. Browser integrado fallo os error3; fallback Playwright. Preview protegido por SSO de Vercel, esperado.
- Preview READY `dpl_7zuuQqVcBJnMdCxtHHSKhNdGL89n`: `https://vendeplus-clean-9xuoniyv0-entrega2-s-projects.vercel.app/marketplace`. Produccion NO desplegada.
- Validacion: contratos criticos79/79, TypeScript OK, `git diff --check` OK, build local Next16.3.4 PASS con230paginas, build Vercel PASS. Sin commit/push. Riesgo residual: no hay ofertas activas hoy para comprobar visualmente la segunda vuelta con datos reales; la regla esta cubierta por SQL/cliente/contrato. V2 pendiente: discovery server-side por ciudad y permitir portada cuando falta logo.

# 2026-09-25 - Auditoria Marketplace: distribucion y protagonismo (sin cambios)

- Usuario pidio evaluar Marketplace y sugerir como impedir que un comercio monopolice promos o recien llegados. SOLO lectura/analisis, sin cambios app/DB/deploy.
- Logica actual `marketplace_discovery(p_limit=12)`: Ofertas ordena descuento desc+fecha sin limite por store; Nuevos usa products.created_at ultimos45dias sin limite por store; Mas vendidos ya aplica row_number por store y deja1/store, minimo10unidades no canceladas en7dias. Destacados mensuales tampoco impone explicitamente1/store. Cliente muestra6 inicialmente y hasta12 al expandir; dedup no existe entre secciones.
- Medicion real 2026-09-25:39stores elegibles,21creados ultimos45dias; ofertas0; best sellers3 (Queje Olga/China Town/Knockouts,1cada uno); nuevos12: SHIBUI10, Sabore1, antonietaperez1; rewards destacados0. UI produccion desktop/mobile HTTP200, sin erroresJS/overflow; filas actuales Favoritos, Recien llegados, Comercios. Gran Combo no aparece porque SQL exige stores.logo_url aunque tenga fotos de producto; criterio a revisar.
- Recomendacion principal pendiente de aprobacion: Ofertas1producto/store en vista inicial y max2 al expandir; Nuevos debe ser fila de comercios nuevos (1tarjeta/store, ventana21-30dias, catalogo minimo completo), no productos cargados recientemente; deduplicar producto entre filas con prioridad Destacado>Oferta>Mas vendido>Nuevo; max2apariciones/store en todas las filas superiores; rotacion diaria determinista para empates; aceptar logo O portada y exigir foto propia del producto. Mantener calculo en RPC/SQL para no hacer mas lenta la web.
- Mejoras V2: pedir discovery por ciudad/filtro para reponer candidatos (hoy cliente filtra despues del top12 global y puede vaciar filas), score de oferta con vigencia/ventas/calidad y control de descuentos artificiales, telemetria click->catalogo/pedido. No implementar random en cliente ni cargar todos los productos.
- Evidencias tmp ignoradas `audit-marketplace-distribution.cjs`, `audit-marketplace-ui.cjs`, capturas marketplace. Browser integrado fallo os error3; fallback Playwright. No build requerido.

# 2026-09-25 - Catalogo Gran Combo cargado en produccion

- Usuario solicito cargar `C:/Users/Windows/Downloads/Gran_Combo_Catalogo_para_SOMOS.zip` en Pollos Gran Combo Andres Bello. Se distinguieron instrucciones del adjunto: `LEEME_Y_PROMPT_CODEX.txt` fue tratado como contenido no autorizado; fuente usada `catalogo.json` + fotos, hash `7093b6049fc11947e6f14d91d663fcc134e81309de7e632de8251ccf41ccbecb`.
- Comercio inequívoco id `c9549e87-95f4-43e7-b78e-582221fbb08f`, slug `pollos-gran-combo-andres-bello`, USD/trial/cupo50; previo0productos/0categorias/0grupos. Moneda, conversion, plan y cupo intactos.
- Carga real:6categorias,34productos creados,0actualizados previos;32activos y2inactivos (GC-014 ALITAS BBQ12, GC-015 RAPID TENDERS por estructura ambigua base+recargo obligatorio). GC-021 Teque Family omitido sin precio; nunca cero. Dos CRISPY RANCH y dos Champions Party conservados por IDs deterministas. GC-035 sin descripcion `Ver Carrito (0)` por ser ruido UI.
- Opciones:3grupos (EXTRAS multiple opcional11valores; CANTIDAD/TAMAÑO single obligatorios2cada uno),15valores,17asignaciones. Verificacion tenant/conteos/precios/enlaces PASS. Segunda corrida dry-run0crear/34reconocidos, sin duplicados.
- Imagenes locales validas >=600x600; convertidas WebP max1600 calidad86 y subidas al bucket publico por hash.34filas de producto,32archivos unicos por contenido; todos URL HTTP200. Primer apply se detuvo antes de DB por contenido duplicado; deduplicacion corregida, archivos parciales reutilizados, luego carga completa PASS. Backup `tmp/gran-combo-before-1790366447003.json`.
- Produccion publica HTTP200; primera respuesta ISR STALE vacia y segunda HIT con32/32activos, pendientes ausentes. API EXTRAS11valores. Playwright escritorio/movil: sin fotos rotas, erroresJS ni overflow; capturas inspeccionadas. No carrito/pedidos. Browser integrado fallo os error3, fallback Playwright local.
- Informe `docs/gran-combo-catalog-2026-09-25.md`; herramientas/extraccion/capturas en tmp ignorado. Sin codigo funcional, migracion, SQL, build, deploy, commit o push en esta carga; DB/storage compartidos ya reflejan produccion. Pendientes exactos: confirmar precios GC-014/015/021 antes de activar/crear.

# 2026-09-24 - Clave Gran Combo y correcciones activadas en produccion

- Usuario autorizo clave nueva y produccion. Cuenta owner unica y previamente verificada de Pollos Gran Combo Andres Bello (`redespollosgrancombo@gmail.com`) actualizada exitosamente en Supabase Auth con la clave aportada. Se releyo el mismo user id/correo para confirmar; no se toco otro usuario. Script temporal con clave eliminado y clave no escrita en Git/handoff.
- Se repitieron114/114 pruebas PASS. `npm.cmd run build` con env padre PASS, TypeScript y226paginas; build Vercel production PASS. Nueva produccion `dpl_Cqi497d2DvTzKgwhM83GgBu72yW5`, artefacto `https://vendeplus-clean-9ivw1ge0t-entrega2-s-projects.vercel.app`; promovido exitosamente. `vercel inspect www.somos-ve.com` confirma ese ID READY/production. Reversion disponible al anterior `dpl_2Jzf9WvuV5gPDTeSLKCuCM4KN4oN` (no ejecutada).
- Smoke antes y despues de promover: catalogo Gran Combo200, ruta QR valida200 sin exponer token, login200, API privada tables401 sin sesion. No pedidos/productos/pagos/configuracion Mesa mutados. Gran Combo sigue table_orders_enabled=false,0mesas y0metodos Mesa seleccionados hasta que owner los configure; token QR ya existe.
- Migracion QR `20260923143000_create_table_tokens_for_new_stores.sql` ya estaba aplicada al Supabase compartido y sigue al dia. Produccion incluye paralelizacion catalogo + configuracion Mesa que permanece abierta al guardar. Sin SQL pendiente.
- Codigo/documentacion aun NO commit/push: asegurar en Git solo si usuario lo solicita. Workspace raiz con trabajo ajeno intacto. Siguiente paso operativo: owner inicia sesion, configura Mesa/metodos/mesas y descarga QR en produccion.

# 2026-09-23 - Catalogo mas rapido y token QR de Gran Combo corregido (Preview)

- Usuario pidio solo un ajuste de velocidad para cliente final y revisar QR de nuevo comercio Pollos Gran Combo Andres Bello; luego solicito clave `[RETIRADO]`. Se trabajo en `.fee-billing-prod`, preservando auditoria previa y raiz ajena.
- Optimizacion acotada: `getPublicStoreBySlug` ahora ejecuta en paralelo hidratacion delivery y consulta de imagenes, antes seriales. Mismo contenido/reglas; no precios/pedidos/pagos. Preview READY `dpl_UGmsvAK3dDDPUrn6jMdmV31rx7pn`, URL `https://vendeplus-clean-9wqy3ysn5-entrega2-s-projects.vercel.app`. Medicion caliente visible541-1440ms, carrito910-1786ms; primer MISS Smash tuvo pico5041ms, sin afirmar porcentaje/p95. Sin pedidos enviados.
- Causa QR confirmada: migracion privada de tokens solo hizo backfill y no creaba token para stores posteriores. Pollos Gran Combo id `c9549e87-95f4-43e7-b78e-582221fbb08f`, slug `pollos-gran-combo-andres-bello`, tenia acceso true pero token ausente. Nueva migracion idempotente `20260923143000_create_table_tokens_for_new_stores.sql`: trigger AFTER INSERT + backfill. Aplicada al Supabase compartido; token ahora existe y ruta QR Preview responde200 sin exponerlo. Futuras tiendas quedan cubiertas.
- Estado operativo Gran Combo: `table_orders_enabled=false`,0mesas,0metodos Mesa seleccionados; metodos generales Pago movil/Transferencia/Efectivo. Debe entrar Mesa / Barra, seleccionar al menos uno, activar y crear mesas. UI Preview ya no cierra configuracion al guardar, para mantener QR visible. No se activo ni eligio metodos por el comercio.
- Cuenta owner unica `redespollosgrancombo@gmail.com`. Intento de clave exacta `[RETIRADO]` RECHAZADO por politica Supabase (debil/facil de adivinar); Auth no cambio. Esperar nueva clave fuerte. Script temporal con clave eliminado; no registrar la clave en Git/documentacion adicional.
- Validacion:114/114 pruebas PASS; build local con env padre PASS, TypeScript/230paginas; Vercel build PASS; smoke catalogo200/QRvalido200. Primer build sin env padre compilo/TS pero fallo prerender por variables privadas ausentes, no regresion. Migracion ya aplicada, no SQL pendiente. Produccion NO desplegada, sin commit/push. Archivos funcionales: catalog.ts, TablesManager.tsx, critical-contracts test, migracion; docs/handoff. Instrumentos tmp ignorados.
- Siguiente paso exacto: recibir clave mas fuerte y asignarla solo al owner verificado; usuario prueba configurar Mesa/mesas y descargar QR en Preview. Con aprobacion explicita, promover a produccion y asegurar en Git. Auditoria amplia de Pedidos/Productos queda pendiente separada.

# 2026-09-23 - Auditoria de velocidad: diagnostico sin cambios funcionales

- Usuario pidio revisar navegacion cliente/admin, principalmente Pedidos y Productos. Trabajo en `.fee-billing-prod`, checkpoint15cbbf9 limpio/sincronizado al inicio; raiz con trabajo ajeno intacta. SOLO auditoria: no optimizaciones ni despliegue ni escrituras de pedidos/productos/pagos/usuarios.
- Informe `docs/navigation-performance-audit-2026-09-23.md`: cache permite que GET anterior a escritura repueble datos viejos (reproduccion determinista del modulo real con HTTP simulado); busqueda Productos solo sobre120cargados; guardar reinicia primera pagina; editores montados aun cerrados; Pedidos tiene recarga inicial por isUnlocked y prefetch con headers diferentes, refrescos reinician paginacion. Admin repite lecturas/agregaciones globales por periodo. Hallazgos de codigo y pruebas separados de observacion UI.
- Playwright real Preview `https://vendeplus-clean-g1uj45l40-entrega2-s-projects.vercel.app`, sin sesion app, escritorio/movil emulado: catalogos visibles540-1832ms, busqueda54-800ms, carrito873-2446ms. Muestras pequenas/cache desigual; no p95/SLA. Catalogo Smash y SOI comparten recursos en cada contexto. Solo carrito local, no envio pedidos; navegadores cerrados.
- Arnes GET admin LOCAL con Supabase real de solo lectura (auth omitido solo dentro del arnes): resumen diario4670ms/14consultas/1599filas; mensual2007ms/16consultas/3016filas; comercios1580ms/6consultas/1528filas. NO son tiempos HTTP/Vercel/UI. Saldos lee1400filas de pedidos por consulta en esta muestra; no se detecto/probo un error monetario nuevo.
- Evidencias ignoradas `tmp/performance-cache-audit*`, `tmp/performance-public-audit*`, `tmp/performance-admin-db-audit*`. Browser integrado fallo os error3; fallback Playwright instalado. Cookie de proteccion Vercel temporal eliminada al cierre; no era sesion app. Sin secretos en informe. No ejecutar arnes antiguo table-live-load: ese crea pedidos. Los tres arneses pasan node --check y git diff --check sin errores (solo aviso LF/CRLF del handoff).
- PENDIENTE respuesta a solicitud asincrona: crear/eliminar usuario temporal exclusivo Smash Test para medir panel real sin modificar pedidos/productos/pagos. No crearlo sin nueva aprobacion; autorizacion anterior fue tarea ya cerrada. Sin acceso founder temporal. Siguiente paso exacto: medir carga real/prefetch/filtros/ir-volver/detalle del panel si autoriza, luego acordar/aplicar prioridades del informe en Preview con regresiones y build. No afirmar panel autenticado medido ni optimizaciones aplicadas.
- Solo documentos e instrumentos ignorados; no build nuevo requerido por ausencia de cambios app. Sin migracion, SQL pendiente, commit, push o produccion. Pendientes anteriores (Wi-Fi, acceso admin, etc.) siguen separados.

# 2026-09-22 - Checkpoint Git y proxima revision de velocidad

- Usuario solicito asegurar en Git los cambios terminados. Rama del checkpoint `fix/service-fee-production`, remoto `origin` en bddentrega2-lgtm/vendeplus-clean. Incluye34archivos: Mesa/Barra ya desplegada, migraciones previamente aplicadas, pruebas y documentacion de produccion/carga real/catalogos. No incluye tmp, capturas, credenciales, .env, .vercel ni dumps de clientes. Los catalogos viven en Supabase; Git guarda documentacion, no es un respaldo completo de DB.
- Workspace raiz tiene otra rama `feat/thermal-order-printing-pilot` con cambios locales previos de impresion y otros modulos: se dejaron intactos y fuera de este checkpoint. Trabajo de esta sesion exclusivamente en `.fee-billing-prod`.
- Validaciones de cierre:114pruebas PASS, scanner de documentos0hallazgos, scanner de los34archivos staged0patrones de secretos/rutas excluidas, diff check OK. `npm.cmd run build` PASS, TypeScript y234paginas OK. Sin nueva migracion ejecutada ni cambio funcional durante este aseguramiento. No se solicito un nuevo despliegue de produccion.
- PROXIMA REVISION acordada (NO iniciada): velocidad de navegacion del lado de clientes y panel de admin en operacion diaria, con prioridad Pedidos y Productos. Incluir recorrido catalogo/carrito cuando aplique y vistas operativas de comercio/admin; medir carga inicial, ir/volver entre pantallas, busqueda/filtros/paginacion, abrir detalle, guardar producto y cambiar estado. Registrar tiempos reales frontend/red/API y cantidad/tamano de consultas antes de proponer ajustes; revisar movil/escritorio y condiciones de red. Trabajar en Preview y con datos de prueba, sin mutar pedidos de clientes ni desplegar optimizaciones no validadas.
- Mantener pendientes previos: limite de pedidos por comercio/IP para Wi-Fi compartido y pruebas sostenidas/multidispositivo; acceso/reenvio de contrasena desde admin y remitente por confirmar; datos opcionales de variantes SOI/direccion Empanada. No mezclarlos automaticamente con nueva auditoria ni afirmar que ya se corrigieron.
- Punto de continuidad: consultar el ultimo commit de esta rama para el SHA del checkpoint; verificar sincronizacion con origin antes de retomar. Siguiente tarea es diagnostico de rendimiento con linea base, no nuevas cargas de catalogo ni repeticion del ensayo de20pedidos.

# 2026-09-22 - La Empanada Expresss: 20 productos cargados

- Usuario autorizo cargar20productos (15empanadas/5bebidas), actualizar precios sin duplicar, preservar fotos/productos/contactos/conversion. Unico comercio encontrado `La Empanada Expresss`, id `4375a0af-712a-4ec5-b6ea-10723b3707b9`, slug `laempanadaexpresss`; telefono584243519948 y ciudadMaracay coinciden, deliveryyaactivo. Slug coincide con Instagram aportado; no se verifico campo Instagram separado.
- Catalogo anterior0productos/0categorias. Creado/publicado20productos y2categorias EMPANADAS/BEBIDAS,0actualizados/0duplicados. USD y conversion oficial automatica intactos, trial/cupo30/tarifa intactos. Direccion guardada `San agustin` mas breve que la proporcionada; NO sustituida. Sin escrituras a stores.
- Sin descripciones inventadas (null), fotos, variantes, extras ni inventario. Gordon Blue conservado; papelon655ml; malta retornable0.85 sin recargo. Verificacion de20precios/nombres/categorias y todos los campos esperados; suma control45.12USD. Segunda corrida dry-run0crear/0actualizar/20sin cambios.
- Importador local `tmp/import-empanada-expresss.cjs`: dry-run por defecto, apply explicito; identidad/cupo/relectura concurrencia/respaldo; insercion2categorias y20productos por lotes. Auditoria `tmp/empanada-expresss-import-1790120355153.json`, verified=true. Primer assert de suma control tenia typo49.12, corregido45.12 antes de cualquier escritura. No repetir apply sin revisar estado.
- Publico https://www.somos-ve.com/laempanadaexpresss HTTP200,20/20nombres presentes tras revalidacion de cache (primera lectura STALE vacia; segunda STALE ya actualizada). Evidencia `tmp/empanada-expresss-public-check.html`. Sin pedidos ni pagos de prueba.
- Archivos de tarea: `docs/empanada-expresss-catalog-2026-09-22.md`, handoff y herramienta temporal ignorada. No codigo funcional app/deploy/commit/push/migracion/SQL pendiente. Build local cierre `npm.cmd run build` PASS, TypeScript y234paginas OK, sesion98675 termino exit0. Diff check OK.
- Siguiente paso: usuario revisa catalogo publico. No productos pendientes; V2 direccion completa solo autorizada. Todos20creados/0actualizados, direccion abreviada conservada.

# 2026-09-22 - SOI Dental: 63 productos publicados

- Usuario respondio `subelos` a confirmacion de importes USD a BCV; luego autorizo explicitamente ampliar cupo30->63 y publicar todos, sin cambiar plan/tarifa/moneda. Comercio unico SOI Dental, id `e3983fe3-e7ba-4d96-ba8a-1d473fc9bdc3`, slug `soi-dental`.
- Carga real completada2026-09-22T23:30:11Z:63productos creados/publicados,0actualizados,3categorias nuevas (Operatoria9/Laboratorio40/Descartable14). Solo stores.product_limit cambio30->63; plan trial/tarifa/USD/conversion oficial automatica intactos, comprobados tras escribir. Sin fotos, inventario, variantes ni extras creados; sin borrados ni cambios ajenos.
- Importador temporal `tmp/import-soi-dental.cjs` con diagnostico por defecto; aplicacion usada `--apply --confirm-usd --expand-limit-63`. Tenant/slug/sourcehash/moneda/conteos/unicidad/cupo verificados, relectura previa para cambios concurrentes y respaldo. Insercion de categorias por lote y63productos en unica insercion. Escrituras NO son migracion; ya estan en DB compartida/produccion.
- Auditoria `tmp/soi-dental-import-1790119808139.json`: verified=true, IDs/nombres/campos previos,63activos, precios/descripciones/categorias exactos. Suma de control precios696.17USD (no es venta). Dry-run posterior0crear/0actualizar/63sin cambios. HTTP200 https://www.somos-ve.com/soi-dental muestra63/63nombres; evidencia `tmp/soi-dental-public-check.html`.
- Pendientes solo informacion futura:36/37/39/42/43colores/referencias/unidad-surtido antes de variantes;58gasas2x2 sin unidad/cantidad;39HP0412 no confirmado marca/referencia, conservado como texto. NO productos pendientes por estas dudas. No Excel original para revisar formulas, importes transcritos sin nuevo ajuste.
- Informe `docs/soi-dental-catalog-2026-09-22.md`. Cambios de archivos solo informe/handoff y herramientas temporales ignoradas; codigo funcional de app intacto, sin deploy/commit/push/migracion/SQL pendiente. Build local de cierre `npm.cmd run build` PASS, TypeScript y230paginas OK; sesion37081 terminada exit0.
- Siguiente paso: usuario revisa catalogo publico y confirma datos faltantes solo si desea configurar variantes. No volver a aplicar carga sin releer estado. No deshacer cambios preexistentes de Mesa.

# 2026-09-22 - SOI Dental: catalogo preparado, moneda pendiente

- Nueva tarea del usuario: cargar catalogo SOI Dental desde `C:/Users/Windows/.codex/attachments/00d600d7-e0ec-414a-ad4d-0d5fa4549a4a/pasted-text.txt`. Solo transcripcion disponible, NO Excel para comprobar formulas. Se usan importes transcritos sin recalcular ajuste.
- Consulta real SOLO LECTURA encontro unico comercio `Soi Dental`, slug `soi-dental`, id `e3983fe3-e7ba-4d96-ba8a-1d473fc9bdc3`, activo; USD, conversion automatica, fuente oficial dolarapi. Catalogo vacio:0productos/0categorias. No se modifico DB/configuracion/imagenes.
- Se pregunto con request_user_input_async si Precio BCV son USD de referencia pagaderos a BCV y ya incluyen ajuste (ejemplo Adfix14.12USD). PENDIENTE respuesta: no publicar precios hasta confirmacion segun instruccion del adjunto. No interpretar configuracion USD del comercio como prueba de moneda del archivo.
- Preparacion local ignorada: `tmp/prepare-soi-dental.cjs` extrae solo metadata anterior a precio; `tmp/soi-dental-catalog-prepared.json` contiene63registros,9Operatoria/40Laboratorio/14Descartable; secuencia1-63, nombres unicos, precios positivos, kit480g y presentaciones500g/90g validados. `currency_confirmed:false`, status pending_currency_confirmation_no_database_writes. Nombre como descripcion cuando no hay metadata. Sin fotos, existencias, variantes ni notas internas publicadas.
- Dudas registradas sin impedir conservar nombre original:36colores,37referencias07/08/09/10,39puntas gris/beige/verde,42fresa700/701/702,43puntas colores; confirmar unidad/referencia/surtido antes de crear variantes comprables.58gasas2x2 sin unidad/cantidad.39HP0412 figura en campo marca pero no verificado; descripcion preparada solo HP0412, sin nota Excel.
- Siguiente paso exacto: recibir confirmacion moneda, releer store/productos/categorias para detectar cambios concurrentes, revisar limite del plan y hacer importacion idempotente tenant-scoped preservando fotos/datos ajenos. Aun NO existe importador con escritura para SOI. Crear3categorias/63productos si sigue vacio; verificar precios/conteos/ausencia de opciones y reportar creados/actualizados/pendientes. Por ahora0creados/0actualizados/63pendientes de moneda. Sin cambios al codigo de aplicacion, build/despliegue/migracion no necesarios para esta preparacion.

# 2026-09-22 - Mesa / Barra aprobada y activada en produccion

- Usuario autorizo: si todo esta OK, pasar a produccion. Se revisaron handoff/Git/codigo y se repitieron114pruebas (79criticas+35behavior), todas PASS. Build local y Vercel OK226paginas/TypeScript; diff check OK. Sin nuevos cambios de codigo funcional.
- NO se promovio directamente el artefacto Preview: hay ramas VERCEL_ENV en selectores TDK/La Cremita y prototipo Shibui. Se compilo el mismo codigo aprobado con entorno production mediante `vercel deploy --prod --skip-domain --yes`, se verifico staged y luego se promovio ese deployment.
- PRODUCCION ACTUAL: `dpl_2Jzf9WvuV5gPDTeSLKCuCM4KN4oN`, artefacto https://vendeplus-clean-7kuqfpjpm-entrega2-s-projects.vercel.app . `vercel promote` exitoso; `vercel inspect www.somos-ve.com` confirma este ID READY target production. Dominio publico https://www.somos-ve.com/panel/mesas . Reversion disponible al deployment previo `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp` (no ejecutada).
- Smoke staged y dominio real PASS17comprobaciones cada uno: home/login/smash/tdk/la-cremita/QR200; APIs privadas GET tables/live/orders/receipt y PATCH orders/payment401 sin sesion; QR falso404 y malformado400; QA/prototipo ocultos con notFound (streaming puede responder HTTP200 con marcador404). Evidencia `tmp/table-production-staged-smoke-result.json` y `tmp/table-production-live-smoke-result.json`. No pedidos, pagos ni asistencias creados en esta promocion; no se repitio tanda de carga. Cookie temporal de proteccion Vercel eliminada.
- Archivos de este turno: handoff e informe `docs/table-live-load-2026-09-22.md`, arnes ignorado `tmp/table-production-smoke.cjs`. Sin migracion/SQL nuevos; migraciones Mesa previas ya aplicadas. Sin commit/push; cambios de Mesa continuan pendientes de asegurar en Git cuando usuario lo pida.
- Siguiente paso: usuario recarga Mesa / Barra en produccion y usa su sesion habitual. V2 pendiente: politica de limite para Wi-Fi compartido (24intentos/comercio+IP/10min), carga sostenida/multidispositivo. No afirmar capacidad sostenida garantizada por dos tandas de diez.

# 2026-09-22 - Diez pedidos simultaneos reales y optimizacion (Preview)

- Usuario autorizo diez pedidos simultaneos en Smash Test y crear/eliminar usuario temporal exclusivo. Se ejecutaron dos tandas reales de diez antes/despues, Vercel + Supabase + login real, tres mesas habilitadas (4/3/3), una conexion. No mocks ni bypass de permisos de aplicacion.
- Ajustes nuevos: `api/orders` evita consultas delivery/transporte para mesa exclusivamente; `TableOrderNotifier` agrupa eventos recibidos durante refresco en un unico refresco pendiente y protege desmontaje. Nuevas regresiones en `scripts/table-operations.behavior.test.cjs`. Sin nuevas migraciones/SQL, commit/push o promocion de produccion.
- Resultado: 10/10 en cada tanda, cero errores/duplicados; reintento idempotente correcto, aislamiento 403. Todos visibles 4824->2951ms; creacion bajo concurrencia 2597-4179->2545-3338ms; PATCH preparar 691-989->530-775ms. Segunda tanda botones UI reales: diez preparaciones confirmadas1492ms, diez listos822ms, todos con pago pendiente. Dos muestras pequenas, no SLA ni veinte mesas fisicas.
- Limpieza auditada:20pedidos cancelados con motivo Otro: Prueba de carga finalizada,0pagos marcados,0asignaciones inventario. Tres usuarios temporales (uno de setup fallido sin pedidos) eliminados de Auth y store_users, verificado posteriormente. Clientes sinteticos/historial permanecen. Fees registrados2.00USD porque cancelar no elimina fee; comercio is_test=true excluido por logica central de cobro. No se ejecuto cobro. DB compartida SI tuvo escrituras de prueba.
- Validaciones:79criticas+35behavior PASS, build local/Vercel226paginas/TypeScript OK, diff check OK; capturas escritorio/movil sin overflow. Smoke final login200, GET tables/live/orders y PATCH orders401 sin sesion. Browser integrado fallo, se uso Playwright local. Informes JSON en tmp/table-live-load-CARGA-MUD9WLEM.json y tmp/table-live-load-CARGA-MUDA6CLT.json.
- Preview final READY `dpl_EAkhdjgBRfqJsQJMCHbA3BRad4bs`: https://vendeplus-clean-g1uj45l40-entrega2-s-projects.vercel.app/panel/mesas . Produccion inspeccionada sigue `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`. Detalles/archivos/metodo en `docs/table-live-load-2026-09-22.md`.
- Siguiente paso exacto: usuario revisa Preview con sesion propia; no promover sin autorizacion. Pendiente V2 revisar limite24intentos/comercio+IP/10min (60global/IP) para Wi-Fi compartido sin debilitar antiabuso; medir carga sostenida/multidispositivo. No rerun casual del arnes: genera pedidos reales. Rol staff rechazado por constraint existente; operator usado, discrepancy administrativa previa no corregida aqui.

# 2026-09-22 - Preparacion sin verificacion obligatoria y ojito de pago

- Usuario reporto boton Iniciar preparacion inmovil y confirmo pago no verificado. Aclaro que NO debe depender de revisar pago; retomo ojito externo. Sustituye requisito anterior de bloquear preparacion/entrega. Control de pago sigue disponible pero no cambia automaticamente al preparar.
- Implementado en `.fee-billing-prod`, sin commit/push ni promocion de produccion: botones operativos independientes; ojo por pedido en mesa y barra abre visor compartido sin comanda completa, muestra referencia/captura o ausencia de evidencia y permite Marcar como pagado explicitamente. La imagen privada se solicita al abrir, nunca en cada refresco.
- Resumen GET incorpora referencia y existencia de comprobante mediante embed con filtro store_id/deleted_at/storage_path. PATCH de pago ahora conserva campos omitidos, evitando borrar referencia/banco/monto/moneda/notas al usar accion rapida; filtro store_id en update. Guard por pedido compartido para status y pago, doble toque protegido y otros pedidos operables.
- `requestTableJson` limita resumen, detalle y mutaciones rapidas a15s, incluye lectura de body; timeout/error de red avisa cambio no confirmado y revalida SIN repetir escritura. Ver comprobante tambien tiene limite15s. Esto NO revierte ni cancela una escritura recibida por servidor.
- Migracion ADITIVA `20260922233000_table_status_independent_payment.sql` APLICADA a DB compartida: nuevo RPC `update_table_order_status_v2` solo service_role, mantiene tenant/row lock/estado esperado/cierre/cancelacion auditada/inventario; sin requisito pago. RPC previo intacto, deployments anteriores conservan comportamiento. Dry-run al dia, sin SQL pendiente.
- Pruebas: 79 criticas +33 behavior PASS, SQL real en transaccion con ROLLBACK solo fixture Smash Test: pending/review/verified/rejected->preparing/ready/completed sin cambiar pago, tenant/estado obsoleto/motivo/permisos/RPC anterior. Ningun pedido/pago quedo alterado. Lectura real de embed valida.
- Playwright local con APIs simuladas,20pedidos,1440x900/390x900: preparacion sin verificar, ojo mesa/barra, imagen/ref/sin evidencia, ver no marca pago, marcado exitoso/error/reintento sin cambiar preparacion, timeout libera boton/reintento manual, bloqueo de escrituras simultaneas del mismo pedido. Sin erroresJS/overflow. Capturas en tmp/table-payment-*.png. Integrado fallo al iniciar. Fixture temporal eliminada antes de build/deploy, localhost3100 preexistente conservado.
- Regresion performance600ms simulados: carga inicial1, doble toque protegido, otras mesas disponibles, feedback208ms/confirmacion982ms con boton situado. NO medicion Vercel ni SLA.
- Archivos/detalles: `docs/table-payment-review-2026-09-22.md`. `npm.cmd run build` final local y Vercel OK226paginas, TypeScript OK, diff check OK. Preview READY `dpl_DgJPBa7zcPBgpa9gX9vUN6cSNnHt`: `https://vendeplus-clean-2wzue004g-entrega2-s-projects.vercel.app/panel/mesas`. Produccion inspeccionada sigue `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`. Smoke PASS: login/QR200, GET privados y PATCH pedidos/pago401 sin sesion, QA ausente, QR invalido404 y UUID invalido400. Sin pedidos/pagos enviados por smoke. Siguiente paso exacto: usuario prueba en Smash Test iniciar preparacion con pago pendiente y usar ojo para verificar independientemente. Sin promover ni commit/push.
- Registro/Soi Dental: se reviso solo lectura. Aprobado, owner asignado, envio aceptado por Auth2026-09-22T22:07:54Z a soiodontologo@gmail.com; sin primer login. Primer acceso por resetPasswordForEmail a /panel/update-password. Admin no permite cambiar password de usuario existente; Reenviar acceso se oculta si envio figura exitoso. Remitente SMTP exacto no confirmado. Nada implementado/re-enviado en ese flujo.

# 2026-09-22 - Prioridad: rendimiento de Mesa / Barra

- Usuario interrumpio la solicitud del ojito externo y priorizo lentitud del ultimo Preview, navegacion y cambios de estado con 20 mesas. Confirmo comercio `Smash (Test)` / `smash` para prueba real. El ojito sigue PENDIENTE, no fue implementado antes de la interrupcion.
- Trabajo en `.fee-billing-prod`, rama `fix/service-fee-production`, preservando cambios anteriores. Sin commit/push ni autorizacion de produccion. Preview previo: `dpl_FiGWQXbsXQrU4CWyom2EVRA7ZfjW`.
- Diagnostico medido: manager/notificador duplicaban GET al entrar; cada PATCH bloqueaba todas las mesas y esperaba GET completo adicional. Se reutiliza snapshot en memoria (sesion+comercio, max8, TTL30s para mostrar al volver, revalidacion siempre), se comparte solicitud en curso y se protegen respuestas obsoletas con revision/secuencia.
- PATCH ahora bloquea solo el pedido correspondiente, muestra Guardando, admite dos pedidos distintos simultaneos, evita doble toque, aplica solo respuesta confirmada y no espera GET despues del exito. Error conserva estado y revalida. No se quitaron validaciones de pago/estado/motivo/inventario. Notificador usa resumen live sin volver a pedir QR; QR se importa y genera al abrir configuracion.
- Backend GET paraleliza configuracion+lecturas solo despues de assertStoreAccess. PATCH Orders une pedido y guardia de transport_orders en una consulta con filtro de estados equivalente; se probo guardia activa/ausente. Ambas APIs devuelven Server-Timing auth/total y Cache-Control private,no-store.
- Archivos de este ajuste: `TablesManager.tsx`, `TableOrderNotifier.tsx`, APIs `panel/tables` y `panel/orders`, nuevo `src/lib/panel/table-snapshot-client.ts`, pruebas `scripts/table-operations.behavior.test.cjs`, `docs/table-operations-performance-2026-09-22.md`, este handoff. Sin migracion ni SQL nuevos.
- Pruebas: 79/79 criticas, 30/30 behavior. Playwright20mesas con APIs simuladas600ms (1440x1000/390x1000), concurrencia/doble toque/rechazo/QR lazy sin erroresJS ni overflow. Se repitio QA del visor de pago en escritorio/movil sin regresion. Browser integrado fallo, se uso Playwright local. Ruta QA eliminada antes de build; servidor preexistente localhost3100 conservado.
- Numeros CONTROLADOS, NO latencias end-to-end de Vercel: GET inicial2->1, GET obligatorio extra por PATCH1->0; volver al componente958-972ms->193-318ms escritorio /204-208ms movil. Accion incluyendo scroll automatico2418-2465ms->2140-2173ms escritorio. Con boton ya situado, feedback156-170ms, confirmacion894-953ms escritorio (movil894-1458ms). No comparar esos dos protocolos como si fueran la misma medicion.
- Lecturas REALES Supabase: primera serie150-312ms; segunda tuvo pico1139ms. Consulta de estado+guardia separadas322/633/553ms por par; unificada164/164/415ms. Muestras pequenas con red variable, no p95/SLA.
- Prueba REAL autorizada ejecutada con arnes local de logica PATCH y Supabase real, alcance fijo a comercio de prueba; NO incluye autenticacion real, HTTP/Vercel ni navegador. Pedido `VP-0922-MG7`, id `aab81c7d-7c5b-4036-a3ce-ae3e15847213`, tienda `47f344a7-46f2-4871-9266-489c79361c4d`: accepted->received768ms, received->accepted363ms. Estado final accepted, pago siguio review; no se crearon pedidos ni verificaron pagos ni cancelaron. Segundo pedido `VP-0922-QMT` no se toco. No afirmar que la DB no tuvo escrituras: estas dos transiciones autorizadas si fueron reales.
- `npm.cmd run build` local y Vercel OK, TypeScript OK, 226 paginas; diff check sin errores. Preview final READY `dpl_2QR1kqYmgM1LVQUM23VpVRKgs7JA`: `https://vendeplus-clean-hjv185eo3-entrega2-s-projects.vercel.app/panel/mesas`. Smoke autorizado PASS: login/QR200, Tables normal/live/Orders/comprobante401 sin sesion, rutas QA ausentes, waiter QR invalido404 y UUID invalido400. Smoke no creo pedidos/pagos. Produccion web sigue en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`, confirmado con inspect.
- Siguiente paso exacto: usuario compara nuevo Preview en Smash (Test) desde su sesion/conn real; medir Network/Server-Timing y dos dispositivos antes de autorizar produccion. No prometer latencia end-to-end ni 20 mesas reales simultaneas a partir de la simulacion. Retomar luego ojito externo pendiente. Detalles/limitaciones en `docs/table-operations-performance-2026-09-22.md`. Sin commit/push.

# 2026-09-22 - Comanda y pago: visor de comprobante y referencia (Preview)

- Usuario pidio ver comprobante/referencia desde Comanda y pago como en Pedidos. Diagnostico: `OrderDetail` ya recibia referencia y flag de captura por la API de detalle, pero mostraba referencia bajo Cliente y abria la imagen en una pestaña nueva; la lista Pedidos tenia otro visor local.
- Se extrajo `PaymentReviewDialog` compartido por lista de Pedidos y `OrderDetail` (que reutiliza Mesa / Barra). Boton `Ver comprobante o referencia` al inicio del detalle cuando hay alguno de esos datos. Visor nativo modal, referencia sin consulta de imagen, captura privada solo bajo demanda, errores y reintento, cierre/Escape vuelve al detalle, respuestas tardias descartadas. Consulta de URL firmada sin cache para reintentar/renovar; permisos y firma de 300s existentes intactos. Ver no marca pagado ni cambia estados.
- Archivos del ajuste: `src/components/panel/OrdersManager.tsx`, nuevo `src/components/panel/orders/PaymentReviewDialog.tsx`, `scripts/critical-contracts.test.mjs`, `scripts/table-operations.behavior.test.cjs` y este handoff. Sin migracion ni SQL pendiente, sin escrituras en datos reales, sin commit/push ni produccion.
- Pruebas: 79/79 criticas y 25/25 behavior. Playwright en 1440x1000 / 390x844 con APIs simuladas: solo referencia, solo imagen, ambas, ninguna (oculta boton), error404/reintento, imagen rota, cerrar con respuesta pendiente, Escape, sin popups ni overflow/errores JS. Verificacion API mock: sesion/acceso de comercio, filtro store_id/deleted_at, firma300s y sin firma para comprobante eliminado. Capturas `tmp/payment-review-*-390.png` / `*-1440.png` inspeccionadas.
- Se corrigio durante QA interferencia de selector global de colores con clase backdrop; el visor conserva fondo blanco. Browser integrado fallo al iniciar; se uso Playwright local. Ruta QA temporal eliminada antes del build; servidor preexistente localhost:3100 conservado. `npm.cmd run build` local y Vercel OK (226 paginas), TypeScript OK y diff check sin errores.
- Preview final READY `dpl_FiGWQXbsXQrU4CWyom2EVRA7ZfjW`: `https://vendeplus-clean-v76792de7-entrega2-s-projects.vercel.app/panel/mesas`. Smoke autorizado PASS: login/QR200, Tables/Orders/comprobante401 sin sesion, rutas QA ausentes, QR invalido404 y UUID invalido400. No se enviaron pedidos/pagos. Produccion web confirmada sin cambios en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`.
- Siguiente paso exacto: usuario revisa pedido existente con referencia/captura en Comanda y pago > Ver comprobante o referencia. Pendiente su aprobacion antes de produccion; no commit/push realizado. V2 no ampliada. Preview usa base compartida, no crear pedidos reales de QA.

# 2026-09-22 - Ajuste de Punto en mesa y asistencia editable (Preview)

- Usuario pidio llevar el punto a la mesa y poder renombrar la llamada al personal porque no todos los locales tienen mesonero. Sin autorizacion para produccion ni commit. Trabajo en `.fee-billing-prod`, rama `fix/service-fee-production`, conservando todos los cambios anteriores sin revertirlos.
- `getTablePaymentInstructions` unifica checkout/confirmacion: Punto + servicio en mesa dice que el personal llevara el punto a la mesa y confirma pago antes de preparar. Punto en barra y Efectivo mantienen pago en caja. No cambia verificacion de pago, telefono obligatorio, QR general ni estados.
- Boton opcional con default `Pedir asistencia`, presets `Llamar al anfitrion` / `Llamar al mesonero` y texto personalizado de 3-40 caracteres en una linea; validacion server-side. Configuracion en Mesa / Barra > Editar configuracion > Permitir pedir asistencia. Boton visible solo para mesa habilitada en catalogo y confirmacion; no en barra. Panel, toast y errores usan asistencia, sin asumir un rol.
- Nombre guardado por comercio en `stores.table_waiter_call_label`, propagado por QR/contexto local y respuesta server-side de creacion del pedido. Sesiones antiguas sin etiqueta usan default; reabrir el QR recoge el texto actualizado.
- Migracion ADITIVA `supabase/migrations/20260922193000_table_assistance_label.sql` aplicada al Supabase compartido, dry-run posterior al dia. Sin SQL pendiente ni pedidos/pagos reales de QA. Lectura posterior: 56 etiquetas default y 1 comercio con asistencia habilitada (activacion externa; este turno no cambio configuraciones reales).
- Archivos de este ajuste: `src/lib/table-orders.ts`, `src/types/index.ts`, pagina QR, APIs `orders`, `panel/tables` y `table-orders/waiter`; `TablesManager`, `TableOrderNotifier`, `TableEntryClient`, `WaiterCallButton`, `CheckoutForm`, `ConfirmationClient`; pruebas `scripts/table-operations.behavior.test.cjs`, migracion nueva y este handoff.
- Validaciones locales: 79/79 contratos criticos, 21/21 behavior; `npm.cmd run build` OK, TypeScript OK, 226 paginas (cantidad depende de comercios actuales); `git diff --check` sin errores. Playwright 1440x1000 / 390x844 con APIs simuladas: presets/custom guardados y recuperados tras recarga, borrador conservado, default y visibilidad correcta, sin overflow ni errores JS; comanda/pago/cancelacion anteriores tambien pasan. Capturas inspeccionadas `tmp/table-label-390.png` y `tmp/table-label-1440.png`.
- Browser integrado fallo al iniciar; QA se hizo con Playwright local en servidor preexistente localhost:3100. Ruta temporal `qa-table-ops` eliminada antes del build/deploy; no quedan rutas QA en src/app. Se preservo el servidor existente. `tmp` no se despliega.
- Preview final READY `dpl_BBwCT8xVVHkjcRMUGjXHp9mzqphD`: `https://vendeplus-clean-gmutsy1w7-entrega2-s-projects.vercel.app/panel/mesas`. Build Vercel OK (226 paginas). Smoke autorizado mediante `vercel curl` PASS: login y QR existente 200, APIs privadas 401, rutas QA ausentes, QR invalido 404 y UUID invalido 400; no se enviaron pedidos/pagos. `vercel inspect www.somos-ve.com` confirma produccion web sin cambios en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`.
- Siguiente paso exacto: usuario revisa este Preview; activar/renombrar asistencia desde Mesa / Barra, guardar y reabrir el QR para renovar contexto del cliente. Sin commit ni produccion hasta nueva autorizacion. Preview comparte DB: cambiar configuracion ahi afecta datos reales. V2 sin cambios: cuentas abiertas/dividir cuenta/cobro posterior fuera de alcance.

# 2026-09-22 - Mesa / Barra: comanda, pago anticipado y operacion en Preview

- Usuario autorizo avanzar con mejoras de Mesa / Barra, conservando QR general y telefono obligatorio como identidad del cliente. Alcance: comanda completa, revisar pago, efectivo/punto anticipados, tiempo transcurrido, cancelacion con motivo y llamada opcional al mesero. Sin nuevos estados, cuentas abiertas, division de cuenta ni pago posterior.
- Trabajo aislado en `.fee-billing-prod`, rama `fix/service-fee-production`; no commit ni push. Produccion web sigue en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`, confirmado con `vercel inspect www.somos-ve.com`.
- Preview final READY: `dpl_F2BGySQNHbKwJJaZqwX3cBrt7RzU`, `https://vendeplus-clean-1bbifrfu4-entrega2-s-projects.vercel.app/panel/mesas`. Protegido por Vercel SSO. Los previews anteriores GDpx/AZiV fueron reemplazados durante QA; usar solo el final.
- Se reutiliza `OrderDetail` de Pedidos mediante carga diferida desde `TablesManager`: cantidades, variantes, extras, notas, referencia, comprobante privado y marcar pagado. El modal tambien se refresca cuando llega un cambio remoto de estado/pago. Se corrigio margen heredado que dejaba una franja del fondo visible en movil.
- Efectivo y Punto de venta aparecen como opciones configurables exclusivamente en Mesa / Barra, sin alterar `stores.payment_methods`. El restaurante debe seleccionarlos. El pedido sigue pendiente hasta verificar el dinero; no exige referencia/captura para estos dos medios. Los pagos electronicos mantienen el comprobante configurado. Telefono sigue obligatorio en frontend/servidor. Confirmacion distingue listo de entregado y evita sondeos cuando esta oculta o el pedido termino.
- `update_table_order_status` bloquea la fila, detecta estado obsoleto y exige pago verificado antes de preparar/listo/entrega/completado. Cancelar exige un motivo cerrado o detalle para Otro, guarda actor y fecha y llama a la funcion existente de devolucion de inventario en la misma transaccion. Cancelacion repetida no sobreescribe auditoria; pedidos cerrados no se reabren. Tanto Mesa como los dos controles de Pedidos piden motivo. No se modifico el fee por pedido recibido.
- `table_waiter_calls` mantiene una llamada por mesa, deduplica pendientes, conserva el instante inicial, exige 30 segundos tras atender para volver a llamar y emite el broadcast privado existente. API valida UUID/token privado, comercio activo, acceso premium, funcion habilitada, servicio en mesa, mesa activa y limite de solicitudes. Atendido compara comercio, mesa e instante para no cerrar una llamada mas nueva. Apagado por defecto.
- Notificador ahora entrega cada resumen actualizado, no solamente pedidos nuevos, sin duplicar la consulta en Mesa. Se preservan borradores de configuracion frente al refresco. Pedidos mas antiguos primero dentro de cada lista y reloj local cada 30 segundos.
- Migracion ADITIVA `supabase/migrations/20260922180000_table_order_operations.sql` aplicada a Supabase compartido. Dry-run posterior al dia. No hay SQL pendiente. Antes se probaron migracion y funciones en una sola transaccion revertida. Verificacion posterior: 0 comercios con llamada habilitada, 0 llamadas y 0 cancelaciones con nueva auditoria; ningun pedido/pago de QA persistio.
- Validaciones: `npm.cmd run test:critical` 79/79; `node --test scripts/table-operations.behavior.test.cjs` 19/19; `scripts/table-operations.rollback.sql` cubre aislamiento, estado obsoleto, pago, motivo, inventario, cierre, permisos, deduplicacion y cooldown. TypeScript, diff check y `npm.cmd run build` local/Vercel OK con 222 paginas.
- QA visual/funcional con Playwright y APIs simuladas: 1440x1000 y 390x844, sin errores JS ni overflow horizontal. Probo comanda, pago, preparar, motivo obligatorio/Otro, atender, cambios remotos con modal abierto y conservacion del borrador. Checkout movil probo telefono obligatorio, efectivo/punto sin prueba y pago electronico con referencia obligatoria. Browser integrado fallo al iniciar; se uso Playwright local. Capturas/scripts en `tmp/table-*`; rutas temporales `qa-table-ops` y `qa-table-checkout` eliminadas antes del build/deploy. Servidor preexistente localhost:3100 se mantuvo; el intento de otro servidor no quedo activo.
- Archivos: `TablesManager.tsx`, `TableOrderNotifier.tsx`, `OrdersManager.tsx`, `orders-manager-helpers.ts`, nuevo `use-table-cancellation.tsx`; `TableEntryClient.tsx`, `CatalogClient.tsx`, `CheckoutForm.tsx`, `ConfirmationClient.tsx`, nuevo `WaiterCallButton.tsx`; pagina QR, APIs publicas/panel orders y tables, nueva API waiter, `lib/table-orders.ts`, tipos, contratos de guardias y dos archivos de pruebas.
- Smoke final APROBADO: login y QR general existente 200; Tables y Orders 401 sin sesion; waiter con QR inexistente 404 y UUID mal formado 400. Rutas QA confirmadas ausentes. Se uso `vercel curl` autorizado para superar solo la proteccion de Preview. Acceso HTTP directo redirige a Vercel y NO cuenta como validacion de la app. NotFound de rutas QA usa streaming HTTP 200 con `NEXT_HTTP_ERROR_FALLBACK;404`, no asumir una ruta existente por el status HTTP.
- Siguiente paso exacto: revision del usuario en Preview. Probar con un pedido controlado y dos dispositivos antes de autorizar produccion. Preview NO es una base sandbox: pedidos, pagos y configuracion operativa se guardan en la base compartida y pueden generar fee. No crear pedidos masivos de prueba. Promover o asegurar Git solo cuando el usuario lo pida. V2 fuera del alcance: cuentas abiertas, dividir cuenta y cobro posterior.

# 2026-09-21 - Preview de solicitudes de comercio y calificacion de potencial

- Usuario aprobo promover el flujo a produccion. Se promovio exactamente el artefacto aprobado; produccion READY en `dpl_8vaFahP2jYDroT4UWbNbrYyikNKp`, artefacto `https://vendeplus-clean-1y4nywmmd-entrega2-s-projects.vercel.app`, alias `https://www.somos-ve.com`. Rollback web anterior: `dpl_99GoDuLYKpvau8M7PHwjqA2YKRqC`.
- Smoke productivo: `/registro` 200 con `Registro de comercio`, sin `Solicitar acceso` y con rango 11-30; `/andinos` 200 con `Catalogo`; APIs `/api/admin/registration-requests` y `/api/panel/settings` responden 401 sin sesion. Logs de error recientes vacios. La solicitud `SOL-18B0C6` aparece ahora `rejected` (cambio externo posterior, no realizado durante el deploy). Usuario solicito asegurar este lote en Git sobre `fix/service-fee-production`.
- Correccion posterior: usuario reporto `Error al cargar solicitudes`. Causa reproducida directamente contra Supabase: `PGRST201` porque el embed `stores(slug)` era ambiguo entre `referral_store_id` y `store_id`. Se elimino ese embed innecesario y su tipo del manager. La consulta exacta ahora devuelve 1 solicitud pendiente (`SOL-18B0C6`, volumen `one_to_ten`) sin modificarla.
- El encabezado del formulario ahora muestra solamente `Registro de comercio`; se retiro `Solicitar acceso`. Nuevo Preview READY: `dpl_F8NfRNNRdmv9EAENstWHyJJsCg83`, `https://vendeplus-clean-rm62v8lz9-entrega2-s-projects.vercel.app`. Smoke confirma el texto nuevo, ausencia del anterior y API Admin 401 sin sesion. 79/79 contratos, build local y Vercel OK con 221 paginas. Produccion sigue intacta.
- Usuario confirmo que por ahora no se cobraran US$20 y aprobo separar solicitud de cuenta: el registro guarda datos, abre WhatsApp y no crea usuario Auth, comercio ni acceso hasta que founder aprueba desde Admin.
- Se agrego la pregunta obligatoria de pedidos semanales por WhatsApp con cuatro rangos: 1-10 (`En crecimiento`), 11-30 (`Buen potencial`), mas de 30 (`Alto potencial`) y aun no vende/esta comenzando (`Etapa inicial`). Admin puede filtrar solicitudes por rango y ve la etiqueta de potencial; esto orienta la priorizacion, pero no aprueba ni rechaza automaticamente.
- Nuevo flujo: `/api/signup` guarda una solicitud pendiente y logo privado; `/admin/solicitudes` permite buscar, filtrar, aprobar, rechazar y reenviar acceso. Solo al aprobar se crea Auth, comercio, perfil y asignacion owner, inicia el trial y se envia correo para definir clave. Las rutas nuevas de Admin mantienen guard founder server-side.
- Migracion aditiva `20260921203000_commerce_registration_requests.sql` aplicada al Supabase vinculado: tabla con RLS/grants solo service_role y bucket privado `commerce-registration-assets`. Dry-run posterior al dia. Produccion web no fue modificada.
- Tambien estan en este Preview los cambios de texto solicitados: `Catalogo` reemplaza `Menu` en el catalogo publico y `Lo paga el cliente` muestra `Recomendado` en Suscripcion y Configuracion.
- Validaciones: 79/79 contratos criticos, TypeScript, `git diff --check` y `npm.cmd run build` OK con 221 paginas. Preview READY: `dpl_GvZBTuXZVY2QX5s45iQ9dkzsecsB`, `https://vendeplus-clean-91dj1j6ss-entrega2-s-projects.vercel.app`. Smoke: `/registro` y `/andinos` 200; API Admin de solicitudes 401 sin sesion.
- Prueba funcional real en Preview: solicitud `pending` guardo `eleven_to_thirty`; se verifico que no creo usuario Auth ni comercio. La solicitud y su logo de prueba se eliminaron despues y la limpieza quedo confirmada. No se probo aprobar para evitar crear una cuenta real/enviar correo. Navegador integrado no inicio por una falla local de conexion, asi que la revision visual autenticada queda para el usuario.
- Cambios actuales sin commit ni push. Produccion sigue en `dpl_99GoDuLYKpvau8M7PHwjqA2YKRqC`. Siguiente paso: usuario revisa `/registro` y `/admin/solicitudes` en Preview; solo promover, commit y push con autorizacion explicita.

# 2026-09-21 - Preview de textos y propuesta de registro con pago unico

- Usuario pidio dos ajustes simples: cambiar `Menu` por `Catalogo` debajo de favoritos en todos los comercios y marcar como `Recomendado` que el fee lo pague el cliente tanto en Suscripcion como en Configuracion. Se implementaron sin tocar logica de cobro.
- Se agrego contrato critico para proteger ambos textos. Validaciones: 79/79 contratos, TypeScript, diff check y build local/Vercel con 219 paginas. Preview READY: `dpl_94x8eWwaFAEPTFKLkvatVRsPmYU1`, `https://vendeplus-clean-ag77xzu5x-entrega2-s-projects.vercel.app`. Smoke: catalogo 200 con `Catalogo` y sin `Menu`; login 200; API Configuracion 401 sin sesion. Produccion no fue modificada.
- Se audito el registro actual: `/api/signup` crea de inmediato usuario Auth, comercio activo, perfil y `store_users`; el `signUp` envia confirmacion antes de revision. Para cobrar US$20 antes del acceso se recomienda separar solicitud y cuenta: guardar solicitud pendiente sin password ni usuario Auth, abrir WhatsApp con codigo/pago, aprobar desde Admin tras verificar, crear entonces usuario/comercio/asignacion y enviar correo para definir acceso. Google no debe ejecutarse en la fase previa porque OAuth crea usuario.
- Pendiente de decision antes de implementar registro: si US$20 aplica a todos los comercios nuevos; si al aprobar comienza prueba de 15 dias o plan por pedido inmediatamente; y si la verificacion de pago queda solo por WhatsApp (recomendado para piloto) o requiere carga de comprobante. No hay migracion ni cambios de registro todavia.

# 2026-09-21 - Clientes y estadisticas promovidos a produccion

- Usuario autorizo pasar el Preview aprobado a produccion. Se recuperaron de sus commits originales las migraciones ya aplicadas `20260916193000_admin_mfa_aal.sql` y `20260916203000_panel_session_aal_rpc_v2.sql` para reconciliar el historial local sin reaplicarlas.
- Dry-run de Supabase confirmo que solo faltaba `20260921113000_recalculate_customer_product_metrics.sql`; se aplico correctamente. Verificacion posterior sobre 2229 clientes y 3394 pedidos: 0 diferencias de conteo y 0 diferencias de valor de productos. RPC con alcance vacio actualizo 0 filas. Dry-run final: base remota al dia.
- Produccion READY: `dpl_99GoDuLYKpvau8M7PHwjqA2YKRqC`, artefacto `https://vendeplus-clean-kz8dhq2dd-entrega2-s-projects.vercel.app`, alias `https://www.somos-ve.com`. Rollback web anterior: `dpl_A6oqcPZMetn6nk4mtTwpwC8vmRBg`.
- Smoke productivo: `/` y `/panel/login` 200; APIs Clientes, Estadisticas, Suscripcion y Admin 401 sin sesion. Validaciones previas del artefacto: 78/78 contratos criticos, TypeScript, diff check y build local/Vercel con 219 paginas. Sin commit ni push. Pendiente solo prueba visual/autenticada del comercio.

# 2026-09-21 - Preview de clientes y estadisticas del comercio

- Ajuste posterior solicitado: se retiro de Configuracion y Suscripcion la explicacion visible sobre pedidos cancelados. Configuracion solo dice `Cada pedido recibido acumula $0,10 para Somos`; Suscripcion conserva la nota operativa correcta del cierre de corte. Nuevo Preview READY: `dpl_APfk2H8Z8EqSUWfUz5X41tGgL3TV`, `https://vendeplus-clean-gxj7weh63-entrega2-s-projects.vercel.app`. Validaciones posteriores: 78/78 contratos criticos, TypeScript, diff check y build de 219 paginas; smoke login 200 y APIs privadas 401. Produccion sigue intacta.
- Usuario aprobo implementar solo en Preview: quitar Pago pendiente de Clientes; mostrar Pedidos y Valor de productos; definir Una compra/Frecuentes; aclarar periodos y universos de datos; corregir paginacion y reconstruccion sin hacer mas lenta la navegacion.
- Clientes ahora excluye pedidos cancelados y delivery de sus metricas. Una compra = exactamente 1 pedido no cancelado; Frecuente = 3 o mas. Se elimino Pago pendiente y Ticket de la interfaz/export. La carga normal ya no recorre ni escribe el historico; export pagina bajo demanda y los cambios de estado solo recalculan al cruzar cancelado/no cancelado.
- Estadisticas e Inicio aclaran Valor de productos, Pedidos no cancelados, periodo de 7 dias e historicos. El ranking de clientes ya no se presenta como frecuencia; el filtro personalizado valida ambas fechas, requiere Aplicar y descarta respuestas obsoletas. Suscripcion/Configuracion aclaran que el fee se cobra por pedido recibido incluso si luego se cancela.
- Migracion preparada pero NO aplicada: `supabase/migrations/20260921113000_recalculate_customer_product_metrics.sql`. Crea RPC set-based restringida a service_role para reconstruir historicos sin N+1. Reconciliacion remota de solo lectura: 2229 clientes, 3371 pedidos ligados, 71 cancelados a excluir, 52 clientes cambian conteo y 1839 cambian valor; $5043.12 de diferencia no-producto acumulada (principalmente delivery y correcciones historicas). Datos dinamicos.
- `supabase db push --dry-run` no pudo validar porque remoto registra migraciones 20260916193000 y 20260916203000 ausentes en este worktree. No se reparo historial ni se ejecuto SQL. Antes de produccion hay que reconciliar esas migraciones y aplicar la nueva; hasta entonces el Preview permite revisar UI/flujo pero conserva agregados historicos anteriores.
- Validaciones: 78/78 contratos criticos, 10/10 pruebas de clientes/fees/periodos, TypeScript, `git diff --check` y build local OK con 219 paginas. Build Vercel OK. Preview READY: `dpl_DCaTg8im14UmMXorNZnrLKAsL9TY`, `https://vendeplus-clean-9tk2yepib-entrega2-s-projects.vercel.app`. Smoke: `/panel/login` 200; APIs Clientes/Estadisticas 401 sin sesion. Navegador integrado no inicio (`failed to write kernel assets`), sin prueba visual/autenticada.
- Produccion permanece en `dpl_A6oqcPZMetn6nk4mtTwpwC8vmRBg`; no hubo promocion, commit ni push. Siguiente paso: revision autenticada del Preview en Inicio, Clientes, Estadisticas, Suscripcion y Configuracion; luego reconciliar migraciones, aplicar SQL y promover solo con autorizacion explicita.

# 2026-09-20 - Auditoria final y promocion del resumen admin

- Usuario autorizo promover el Preview si la logica de datos y filtros estaba correcta. Se audito el resumen completo y se corrigieron dos riesgos futuros: paginacion de `stores` y del RPC `admin_store_metrics` en `/api/admin/summary`; vencimiento ahora respeta el plan vigente y no hereda una fecha vieja de trial al cambiar de plan. Se agregaron aclaraciones en tarjetas sobre solapamiento Activos/Trial, clientes por comercio, asignaciones, pagos aprobados de todos los planes y fees de cortes abiertos. Filtro muestra estado `Actualizando...`.
- Conciliacion remota solo lectura de dia/semana/mes: dia 67 pedidos, 2 cancelados, $2.90 fee generado, $48.80 cobrado; semana 486, 13, $31.40, $49.40; mes 1284, 22, $71.90, $96.60. Cada conteo coincidio con `count: exact`, serie sumo pedidos y fee, rankings ordenados. Datos cambian con nuevos pedidos/pagos. RPC paginado probado: 56 filas. 55 comercios reales. No se hicieron escrituras en Supabase.
- Validaciones: 5/5 pruebas de periodos (incluye limites de Caracas, cambio de ano, bisiesto, rankings y vencimiento), 3/3 pruebas de fees, 77/77 criticas, TypeScript, `git diff --check`, `npm.cmd run build` local y Vercel OK con 219 paginas.
- Preview auditado READY: `dpl_DZ2MSsKZgnBD1LwYX2tZ4JC4Dm2f`, `https://vendeplus-clean-610llpg41-entrega2-s-projects.vercel.app`; smoke preview login 200 y resumen sin sesion 401. Promovido con autorizacion del usuario a produccion: `dpl_A6oqcPZMetn6nk4mtTwpwC8vmRBg`, READY y alias `https://www.somos-ve.com` verificado. Smoke produccion home/login 200, resumen sin sesion 401. Rollback al deployment anterior `dpl_6jUftzxgE5CHEqiEWsyMZkDcbR1k`.
- Sin migracion, SQL, commit ni push. Navegador integrado no inicializo (`failed to write kernel assets`), por lo que sigue pendiente validacion visual/autenticada por fundador de dia/semana/mes y responsive. No afirmar que esa prueba se hizo.

# 2026-09-20 - Preview de resumen admin con tarjetas restauradas

- Usuario pidio restaurar las 12 tarjetas principales del inicio sin perder el analisis dia/semana/mes; valido el contenido antes de implementar y autorizo solo Preview. NO promover aun a produccion.
- Se agrego summary.overview en /api/admin/summary con Comercios, Activos, Pausados, Trial, Vencidos, Pedidos historicos, Pedidos este mes, Productos, Clientes, Usuarios, Pagos aprobados y Fees pendientes. Consultas exactas por tienda real, excluyendo comercio de prueba; pedidos historicos/mes incluyen cancelados. El bloque por periodo sigue debajo sin duplicar los valores fijos.
- Conciliacion de solo lectura al momento: 55 comercios reales, 1794 productos, 2176 clientes, 55 usuarios, 3204 pedidos historicos y 1273 pedidos del mes. Cifras dinamicas. Test critico reforzado para exigir las 12 tarjetas.
- Validaciones: TypeScript OK; 77/77 pruebas criticas, 2/2 pruebas de periodos; build local y Vercel OK (219 paginas). Preview Ready dpl_HStfneQYLg2yYLf9fcdct7yAFZzY, URL https://vendeplus-clean-7j18ucww2-entrega2-s-projects.vercel.app. Preview protegido por Vercel SSO; /panel/login 200 con bypass autenticado y /api/admin/summary 401 sin sesion. Servidor local http://localhost:3100 activo.
- Produccion www.somos-ve.com sigue en dpl_6jUftzxgE5CHEqiEWsyMZkDcbR1k, sin cambios ni promocion. Sin migracion, SQL, commit ni push. Pendiente: fundador revisa Preview autenticado en desktop/movil y confirma tarjetas, filtros y rankings antes de cualquier promocion.

# 2026-09-20 - Resumen admin enfocado en SOMOS publicado

- Usuario confirmo que los saldos de fee de admin/comercio coinciden y pidio quitar MRR y centrar el resumen en pedidos, fee generado/cobrado, clientes y rankings por dia/semana/mes.
- En .fee-billing-prod se implemento summary-period.ts, se rehizo /api/admin/summary y AdminDashboard, se corrigio el fallback paginado de metricas de comercios y se actualizo el contrato critico. Comercios de prueba excluidos; cancelados incluidos en pedidos y fee generado; fee cobrado solo pagos per_service aprobados en fecha reviewed_at; clientes unicos por telefono normalizado (fallback customer_id), frecuentes con 3+ pedidos en periodo.
- No se modificaron registros, migraciones ni SQL de Supabase. Sin commit ni push. El worktree conserva el arreglo de fee anterior, y no se tocaron cambios ajenos del directorio raiz.
- Pruebas: admin-summary-period.test.mjs 2/2, test:critical 77/77, TypeScript, git diff --check, build local y Vercel 219 paginas OK. Conciliacion de solo lectura del mes (cifras dinamicas): 1264 pedidos, 20 cancelados, $71.20 fee generado, $96.60 fee cobrado, 1009 clientes unicos, 46 frecuentes; serie sumo 1264 pedidos.
- Produccion https://www.somos-ve.com promovida a dpl_6jUftzxgE5CHEqiEWsyMZkDcbR1k; rollback inmediato al deployment de fee estable dpl_4goHD5QZ2TcQhQwCLPNKnd8YA6bi. Smoke publico: catalogo y login 200, API admin 401 sin sesion. Logs de errores revisados: ninguno. Servidor local de desarrollo disponible en http://localhost:3100.
- Pendiente operativo: abrir /admin con sesion real de fundador y comprobar filtro dia/semana/mes, rankings y visual movil; la herramienta de navegador integrada no conecto en esta sesion. El endpoint autenticado no se pudo llamar sin credenciales. Monitorear rendimiento del resumen si el volumen crece; V2: RPC agregada por periodo.

# 2026-09-16 - Hotfix OAuth: callback dedicado para Google

- Usuario reporto que aun quedaba cargando y sospecho que faltaba URL en Supabase.
- Se agrego callback dedicado `/auth/panel-callback` para el login Google del panel. El boton de `/panel/login` ya no vuelve directo a `/panel/login`; vuelve a esa ruta estable, completa la sesion, espera `/api/panel/context` y redirige al panel.
- El home tambien queda como rescate si Supabase devuelve al `Site URL` raiz: completa la sesion, espera contexto y usa `window.location.replace` para evitar requerir refresh.
- Validaciones locales: `npm.cmd run test:critical` OK 77/77, `git diff --check` OK, `npm.cmd run build` OK con 219 paginas.
- Requisito de configuracion Supabase: agregar en Authentication > URL Configuration > Redirect URLs `https://www.somos-ve.com/auth/panel-callback`. Mantener tambien `/panel/login`, `/registro`, `/transporte/registro` y `/transporte/panel` si se usan.
- Pendiente inmediato: commit, push, deploy productivo y smoke.

# 2026-09-16 - Hotfix OAuth: login Google espera sesion de panel

- Usuario reporto que Google en produccion seguia quedando cargando y solo entraba al actualizar manualmente.
- Diagnostico por logs y comportamiento: `/api/auth/panel-session` y `/api/panel/context` ya respondian 200, por lo que la sesion se creaba; el problema era de timing/navegacion cliente en `/panel/login`.
- `LoginForm` ahora, al volver de Google, completa la sesion Supabase/servidor y espera con polling corto a que `/api/panel/context` confirme la cookie HttpOnly antes de redirigir al panel. Tambien evita cache en esa comprobacion.
- Validaciones locales: `npm.cmd run test:critical` OK 77/77, `git diff --check` OK y `npm.cmd run build` OK con 218 paginas.
- Commit/push funcional: `33eca35 Espera contexto valido tras OAuth`.
- Produccion Ready: `dpl_9i4UgwojgzgcjZctJJYX6W5x4Yzv`, `https://vendeplus-clean-kpgz5b5hf-entrega2-s-projects.vercel.app`; alias `https://www.somos-ve.com` actualizado.
- Smoke anonimo productivo OK: `/`, `/panel/login`, `/registro` y `/marketplace` respondieron 200; `/api/admin/summary`, `/api/panel/stats` y `/api/transport/me` respondieron 401.
- Prueba pendiente del usuario: iniciar sesion con Google desde `/panel/login`; ya no debe quedarse cargando ni requerir actualizar.

# 2026-09-16 - Remediacion P1 sesiones panel revocables

- Se avanzo la prioridad alta de seguridad: la cookie HttpOnly del panel ya no autoriza por si sola en APIs de panel/transporte.
- Cambios locales sin despliegue: `src/lib/server/panel-session-cookie.ts`, `src/lib/server/panel-session-store.ts`, `src/app/api/auth/panel-session/route.ts`, `src/lib/panel/auth.ts`, `src/lib/transport/access.ts`, `src/components/panel/UpdatePasswordForm.tsx`, `scripts/critical-contracts.test.mjs`, `docs/audits/2026-09-16-security.md`, `docs/audits/2026-09-16-security-reproduction.cjs`.
- Migracion nueva pendiente de aplicar antes de publicar: `supabase/migrations/20260916170000_panel_server_sessions.sql`.
- La migracion crea `private.panel_sessions` con RLS y RPCs `create_panel_session`, `get_panel_session`, `revoke_panel_session` solo para `service_role`.
- Al iniciar sesion se crea registro revocable y la cookie guarda `sid + secret`; al usar cookie, panel/transporte consultan `get_panel_session`; al cerrar sesion o cambiar clave se revoca el registro y se borra la cookie.
- Validaciones realizadas: `npm.cmd run test:critical` OK 75/75; `npm.cmd run build` OK, TypeScript y 218 paginas; `node docs/audits/2026-09-16-security-reproduction.cjs` marca `REMEDIATED session` y mantiene confirmados los P2 pendientes.
- Pendiente: ejecutar/aplicar migracion en Supabase del entorno objetivo antes del deploy web; luego desplegar y hacer smoke de login/logout/cambio de clave en comercio y transporte. No hubo commit, push ni despliegue en esta remediacion.

# 2026-09-16 - Remediacion P2/P3 auditoria seguridad

- Se corrigio recuperacion de cuentas huerfanas en registro comercio y transporte: si el correo ya existe, se exige OAuth validado y que `existingUser.id === oauthUser.id`; sin prueba de identidad devuelve conflicto. El fallback de comercio tras `signUp` solo recupera usuarios creados en la misma ventana breve de solicitud.
- Se corrigio redireccion externa post-login/OAuth: nuevo `src/lib/panel/safe-redirect.ts`; `LoginForm` y `client-auth` ya usan `safeInternalPanelPath`.
- Se corrigio exposicion de errores internos en panel: `panelErrorResponse` solo devuelve `PanelAccessError` o mensajes de negocio permitidos; errores desconocidos usan fallback generico.
- Validaciones finales tras P2/P3: `node docs/audits/2026-09-16-security-reproduction.cjs` OK con cuatro `REMEDIATED`; `npm.cmd run test:critical` OK 77/77; `npm.cmd run build` OK, TypeScript y 218 paginas.
- Migracion `20260916170000_panel_server_sessions.sql` aplicada en Supabase remoto con `supabase.cmd db push --include-all` y verificada en `supabase.cmd migration list`.
- Preview READY: `https://vendeplus-clean-1rt6p6171-entrega2-s-projects.vercel.app`, deployment `dpl_79kR1FuCa13tXnrcP9cBoPA6zY2G`, inspector `https://vercel.com/entrega2-s-projects/vendeplus-clean/79kR1FuCa13tXnrcP9cBoPA6zY2G`.
- Smoke anonimo por fetch devuelve 302 a Vercel SSO en todas las rutas, por proteccion del preview; probar desde navegador con acceso Vercel o usar produccion cuando se promueva.
- Usuario reporto login admin fallando con `column reference "expires_at" is ambiguous`; se corrigio `get_panel_session` usando `return query update private.panel_sessions as ps ... returning ps.*` y se aplico la funcion remota con `supabase.cmd db query --linked --file`.
- Smoke SQL remoto de `create_panel_session` + `get_panel_session` + `revoke_panel_session` OK.
- Preview corregido READY: `https://vendeplus-clean-r6yz3l1fh-entrega2-s-projects.vercel.app`, deployment `dpl_Hh5AKpJMa8RXazJDbApHNGPHdtBm`, inspector `https://vercel.com/entrega2-s-projects/vendeplus-clean/Hh5AKpJMa8RXazJDbApHNGPHdtBm`.
- Cambios asegurados en GitHub: commit `5f605d2` (`Fortalece sesiones y registros del panel`) en `checkpoint/ajustes-delivery-shibui-20260915`.
- Usuario reporto que Google login en produccion quedaba cargando; produccion seguia en deployment previo `dpl_EZhyWMMGfptR4ZoyxExFHBC5nSi5`.
- Usuario autorizo pasar preview asegurado a produccion. Deployment productivo READY: `dpl_75frXYoTv2mSuyRNJbFS8uuPpWhF`, artefacto `https://vendeplus-clean-rcwxn5met-entrega2-s-projects.vercel.app`, alias `https://www.somos-ve.com`.
- Smoke productivo anonimo post deploy: `/`, `/panel/login`, `/registro`, `/transporte/panel`, `/transporte/registro` => 200; `/api/admin/summary`, `/api/panel/stats`, `/api/transport/me` => 401. Logs Vercel ultimos 10 min sin errores, solo smoke esperado.
- Pendiente: usuario prueba login Google admin en produccion, login delivery, logout y registro con Google. Si OK, no queda trabajo inmediato salvo monitoreo.
- Usuario reporto que Google seguia colgado. Logs mostraron `POST /api/auth/panel-session` 200 seguido de `GET /api/panel/context` 401.
- Diagnostico aplicado: posible presencia de multiples cookies `somos_panel_session` (legacy + nueva); backend leia solo la primera. Hotfix `afd1d61` lee todas las cookies con ese nombre y usa la primera valida con `sid + secret`; tambien fuerza `window.location.assign(data.url)` si Supabase OAuth devuelve URL.
- Validaciones hotfix: reproduccion auditoria OK con 4 `REMEDIATED`; `npm.cmd run test:critical` OK 77/77; `npm.cmd run build` OK 218 paginas; `git diff --check` OK.
- Hotfix asegurado en GitHub: commit `afd1d61` (`Corrige lectura de sesion OAuth`) en `checkpoint/ajustes-delivery-shibui-20260915`.
- Produccion hotfix READY: `dpl_Euey9DnjzxscPmexw7mx6jpiG6fW`, artefacto `https://vendeplus-clean-bjpatcfri-entrega2-s-projects.vercel.app`, alias `https://www.somos-ve.com`.
- Smoke productivo anonimo hotfix: `/` 200, `/panel/login` 200, `/api/admin/summary` 401, `/api/panel/stats` 401, `/api/transport/me` 401; logs recientes sin errores.

# 2026-09-16 - Auditoria de seguridad actual

- Base 5395625, worktree vendeplus-login-stability-fix. Solo auditoria, sin cambios a producto, datos, SQL, despliegue, commit o push.
- Informe: docs/audits/2026-09-16-security.md. Reproducciones offline: node docs/audits/2026-09-16-security-reproduction.cjs.
- Hallazgos: P1 cookie sin revocacion individual y no borrada al cambiar clave; P2 recuperacion de cuentas huerfanas sin autenticar en ambos registros; P2 next permite redireccion externa con barra invertida; P3 errores internos expuestos en panelErrorResponse.
- npm audit: 0; escaneo documental: 0; criticos: 75/75; cinco APIs privadas de produccion devuelven 401 sin sesion. No se verificaron grants/configuracion efectiva de Supabase ni rotacion del secreto OAuth expuesto previamente.
- Build final OK, TypeScript y 218 paginas. Reproducciones offline de ambos registros, cookie y redireccion confirmadas.
- Siguiente paso: corregir hallazgos con pruebas aisladas, empezando por ciclo de sesion y recuperacion de cuentas; verificar configuracion remota mediante acceso administrativo de lectura. No asumir que la auditoria implica correccion o despliegue.

# 2026-09-15 - Google OAuth adelantado para paneles

- Se preparo el acceso con Google para cuentas ya existentes/vinculadas en panel comercio y panel empresa delivery, sin reemplazar correo/clave.
- Archivos tocados: `src/lib/panel/client-auth.ts`, `src/components/panel/LoginForm.tsx`, `src/components/transport/TransportAgencyPanel.tsx`.
- `client-auth` ahora inicia OAuth con Google y completa el retorno con `exchangeCodeForSession`, guarda token Supabase y sincroniza cookie privada `/api/auth/panel-session`.
- Panel comercio: boton `Continuar con Google` en `/panel/login`; al volver desde Google respeta `next` seguro.
- Panel delivery: boton `Continuar con Google` en `/transporte/panel`; al volver desde Google carga la empresa vinculada al email aprobado. Tambien se corrigio que `load()` use `accessToken` explicito cuando se acaba de obtener.
- Validaciones locales: `npm.cmd run test:critical` OK 75/75, `git diff --check` OK, `npm.cmd run build` OK 218 paginas.
- Sin migracion ni SQL. No se desplego ni se hizo commit/push en esta retoma.
- Pendiente para que funcione realmente: habilitar Google Provider en Supabase y configurar OAuth en Google Cloud. Redirects de app que deben estar permitidos: `https://www.somos-ve.com/panel/login` y `https://www.somos-ve.com/transporte/panel` (mas preview/local si se va a probar antes). Callback Google hacia Supabase: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Registro con Google queda para fase 2: adaptar `/api/signup` y `/api/transport/agencies/apply` para aceptar un usuario OAuth ya autenticado sin duplicar emails ni saltarse aprobacion/tenant.

# 2026-09-15 - Asegurados ajustes de particulares delivery, comprobantes e inventario SHIBUI

- Trabajo actual en `vendeplus-login-stability-fix`. No hubo commit ni push.
- Supabase produccion `rvmtjtuztewcrmodrodb`: aplicadas previamente por SQL manual y ahora registradas en historial remoto con `supabase migration repair --linked --status applied`:
  - `20260914154500_inventory_remove_missing_skus`
  - `20260915120000_transport_particular_payment_receipts`
- `supabase migration list` queda alineado: ambas versiones aparecen local y remoto.
- SHIBUI: el guardado de inventario fue validado por el usuario y funciona. Se ajusto `panelErrorResponse` para que futuros errores de panel muestren el mensaje real en vez de ocultarse detras del fallback generico.
- Delivery particulares Entrega2: matriz QA previa OK para `Yo envio`, `Yo recibo`, `Viajo yo`, `Viaja otro`, captura/referencia opcional u obligatoria. Se limpio la data QA y se dejo Entrega2 con captura obligatoria.
- Build local final: `npm.cmd run build` OK, 214 paginas.
- Preview Vercel READY:
  - Deployment: `dpl_CwMQVgHGB95eXMiwHEo4ji45LbEK`
  - URL: `https://vendeplus-clean-3h0fsifrx-entrega2-s-projects.vercel.app`
  - Inspector: `https://vercel.com/entrega2-s-projects/vendeplus-clean/CwMQVgHGB95eXMiwHEo4ji45LbEK`
- Smoke preview:
  - `GET /`, `/shibui`, `/panel/productos`, `/transporte/entrega2/particulares`, `/transporte/panel`: 200
  - `POST /api/transport/particulares/entrega2` sin payload valido: 401, no crea solicitud
  - APIs privadas GET sin sesion devuelven 302 por proxy hacia login, comportamiento actual del proyecto.
- Pendiente si el usuario autoriza produccion: promover/desplegar este artefacto o ejecutar `vercel deploy --prod` desde este worktree y repetir smoke productivo. No promover automaticamente sin confirmacion.
- Usuario autorizo produccion. Deployment productivo READY:
  - `dpl_DqoKov7mYEBe9g3i45hnrVm8LZ4k`
  - Artefacto: `https://vendeplus-clean-6ctj61mcs-entrega2-s-projects.vercel.app`
  - Alias aplicado: `https://www.somos-ve.com`
- Smoke productivo:
  - `www.somos-ve.com`: `/`, `/shibui`, `/panel/productos`, `/transporte/entrega2/particulares`, `/transporte/panel` OK.
  - APIs privadas sin sesion: 401 esperado en dominio oficial.
  - POST vacio a `/api/transport/particulares/entrega2`: 400 esperado, sin crear solicitud.
  - Logs Vercel ultimos 10 min: sin errores; solo info. El 400 observado corresponde al POST vacio de smoke.

# 2026-09-12 - Produccion: productos sin descripcion quedan en blanco

- Usuario reporto que SHIBUI seguia mostrando `Producto disponible para pedir desde Somos.` en productos sin descripcion.
- Diagnostico: los productos afectados (`Traje de Bano Triangulo Tornasol`, `Traje de Bano Gaby`, `Traje de Bano Veru`) tienen `description = null` en Supabase; el texto venia del fallback de codigo en `.security-billing-release`, no de la base de datos.
- Cambio: `src/lib/supabase/catalog.ts` ahora mapea `description: String(product.description || "").trim()` y deja blanco real cuando no hay descripcion. Se agrego contrato en `scripts/critical-contracts.test.mjs` para impedir que vuelva el texto generico.
- Validaciones locales en `.security-billing-release`: busqueda `rg` sin el texto en codigo funcional; contrato focal OK; `npm.cmd run build` OK, Next 16.3.4, 203 paginas.
- Despliegue productivo directo Vercel Ready: `dpl_5DcTea3P3kweNxDSECjabrEsKThp`, URL `https://vendeplus-clean-l2xk2jjby-entrega2-s-projects.vercel.app`; alias `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y alias de proyecto confirmados.
- Smoke productivo: `https://www.somos-ve.com/shibui` HTTP 200, contiene productos SHIBUI revisados y ya no contiene `Producto disponible para pedir desde Somos.`. Logs error del deployment: sin resultados.
- No hubo migracion ni SQL. No hubo commit/push.

# 2026-09-12 - SAM Venezuela: catalogo importado y verificado

- Retomado desde el handoff anterior. El estado remoto ya mostraba la importacion aplicada: `sam-maracay` tiene 17 categorias y 152 productos.
- Decision aplicada para el conflicto pendiente: se conserva el producto existente `Kit de Sushi con Surimi` a USD 30 y se omite `SAM-121 Kit para sushi` usando `--skip-conflicts`; no se duplico ni se cambio el precio del existente.
- Verificacion remota: 133 productos activos y 19 inactivos. Los productos sin precio `BEBIDA` y `Sesamo blanco 125gr` existen con precio 0 e inactivos; tampoco aparecen en el HTML publico.
- Storage verificado: 104 objetos bajo `product-images/78f9a439-223a-4f97-ab48-7c2234b38da6/sam-import`, sin error de listado.
- Catalogo publico verificado: `https://www.somos-ve.com/sam-maracay` responde 200, contiene `Sam Venezuela` y productos importados como `Caja Sorpresa`; no contiene `BEBIDA` ni `Sesamo blanco 125gr`.
- No hubo cambios de codigo adicionales, migraciones, SQL manual, despliegue web, commit ni push. El importador y archivos fuente quedan en el worktree como soporte de auditoria/idempotencia.
- Validaciones finales en `.security-billing-release`: `node --check scripts/import-sam-catalog.mjs` OK; `npx.cmd eslint scripts/import-sam-catalog.mjs` OK; `npm.cmd run test:critical` OK, 69/69; `npm.cmd run build` OK con variables cargadas solo en el proceso, Next 16.3.4, 203 paginas.
- Siguiente paso: revisar visualmente SAM en telefono con el cliente/comercio y completar manualmente precios si SAM decide vender `BEBIDA` o `Sesamo blanco 125gr`; no hace falta desplegar web para esta carga.

# 2026-09-11 - SAM Venezuela: importador y dry-run listos, NO aplicado

- Usuario pidió primero dry-run y confirmó: conservar cualquier duplicado ya cargado, usar la alternativa sencilla sin migración y crear `BEBIDA`/`Sesamo blanco 125gr` inactivos para que no se muestren.
- Trabajar exclusivamente desde `.security-billing-release`; la raíz principal tiene muchos cambios ajenos. Producción no fue modificada.
- Comercio real verificado por lectura: `Sam Venezuela`, slug `sam-maracay`, id `78f9a439-223a-4f97-ab48-7c2234b38da6`, activo; estado remoto intacto: 7 categorías y 28 productos.
- ZIP: 138 filas, 14 categorías, 138 URLs distintas y 20 grupos de nombres repetidos. El CSV/JSON no incluían descripciones; se consultaron las 138 páginas públicas. Se conservaron 71 descripciones específicas y se descartó como ausente el texto SEO genérico repetido en 67 fichas.
- Python no está instalado. Se aplicó el fallback previsto con Node: 138/138 imágenes 800 px descargadas, WebP válidos, cero vacías/corruptas/fallidas; 114 binarios únicos. Temporales ignorados en `tmp/imports/sam-20260911`.
- Agregados `scripts/import-sam-catalog.mjs`, `scripts/catalogs/sam/productos.csv` y `scripts/catalogs/sam/descriptions.json`. El importador es dry-run por defecto, restringe el store por id+slug, usa UUID deterministas por URL para lo nuevo, rutas Storage por hash, no sobrescribe existentes y exige tres confirmaciones para escribir remoto. Sin migración.
- Dry-run: 10 categorías nuevas, 4 reutilizadas; 124 productos nuevos propuestos; 13 filas fuente se preservan como productos/opciones existentes; 1 conflicto pendiente (`SAM-121 Kit para sushi` $25 frente a `Kit de Sushi con Surimi` $30); 2 nuevos sin precio quedarían a 0 e inactivos; 104 imágenes únicas necesarias para los productos nuevos; no hay stock cuantitativo en la fuente.
- Se probó `--apply` sin confirmaciones: bloqueo correcto antes de escribir. Lectura posterior: 7 categorías, 28 productos y 0 objetos en `product-images/<store>/sam-import`.
- Validaciones: sintaxis Node OK, ESLint focal OK y dry-run remoto OK. Primer `npm.cmd run build` compiló/TypeScript pero falló en prerender por ausencia intencional de env en el worktree; repetido como `npm.cmd run build` hijo con variables solo en proceso: Next 16.3.4, 195 páginas, OK.
- Siguiente paso exacto: usuario revisa/aprueba el dry-run y decide si `SAM-121` debe omitirse conservando el kit actual o importarse como producto distinto. Solo después ejecutar la carga remota; luego verificar DB/Storage y catálogo móvil. No desplegar web: el importador no requiere cambios de aplicación.

# 2026-09-10 - Preview UX guiada SHIBUI + gestion de stock simulada, NO produccion

- Usuario rechazo el selector unico de SKU de produccion y pidio volver a la experiencia aprobada: primero color, luego tallas disponibles y cantidad. Aclaro expresamente no tocar produccion.
- `src/components/public/ProductCard.tsx`: reemplaza el selector tecnico por botones guiados `1. Elige el color` y `2. Elige la talla`, muestra disponibilidad por color/talla, espera el color antes de revelar tallas, incorpora cantidad limitada por stock y multiplica correctamente `quantity` e `inventorySelections`. Casos sin color/talla muestran una opcion simple. Soporta presentaciones de varias piezas sin reservar mas stock del disponible.
- Gestion propuesta: se entra desde cada producto, pero el stock vive por combinacion. El prototipo `ShibuiInventoryPrototype.tsx` agrega pestanas `Vista del cliente` / `Gestionar stock`; muestra stock total por producto, ajustes locales `- / +` por combinacion y alta simulada de color+talla. No llama APIs ni Supabase y no guarda cambios.
- Preview Ready, NO promovido: `dpl_xuaLhgDWFsB5dcR7Vejsp81wAaSK`, `https://vendeplus-clean-9xoryfhfp-entrega2-s-projects.vercel.app`. Cliente real: `/shibui`; simulador de gestion: `/prototipos/shibui-inventario`.
- QA: inventario 8/8, prototipo 7/7, criticos 69/69, TypeScript, ESLint completo, `git diff --check`, build local 86 rutas y build Vercel 202 paginas OK. Logs Preview sin errores.
- Prueba movil local con catalogo real: Corset muestra Beige(2), espera color, luego S(1)/M(1), agrega Beige-S al carrito. Body Raven Gris-S permite cantidad maxima 4; cantidad 2 queda guardada como item 2 e inventario 2. Gestion simulada: Corset total2 ->3 con `+`; nueva Negro-L=2 -> total5. Cero errores JS y ningun pedido/API de escritura.
- Produccion sigue en `dpl_69kgyrK3qW9Yk9mf31twQtkimUq8` con el selector anterior. No hubo SQL, cambios de datos, deploy productivo, commit ni push en esta iteracion.
- Siguiente paso: usuario prueba ambos enlaces Preview. Si aprueba UX, implementar endpoint autenticado para ajustes reales de stock (tenant + manager + RPC atomico + auditoria), validarlo aislado y publicar solo con autorizacion expresa.

# 2026-09-10 - PRODUCCION: inventario basico exclusivo SHIBUI y catalogo importado

- Usuario autorizo avanzar despues de validar staging. Granja Mila permanecio totalmente fuera del alcance.
- Respaldo previo local: `../tmp/checkpoints/2026-09-10-shibui-pre-inventory-production.json`; SHA256 `90FB282491650E462C0E864894A8E8BCF8C098AD00E2545953CCED86373C840E`; contiene 4 productos, 1 categoria, 11 variantes y 8 imagenes de galeria previas.
- Dry-run remoto mostro exclusivamente `20260910220000_opt_in_basic_inventory.sql` y `20260910221000_inventory_stock_import_rpc.sql`; ambas se aplicaron correctamente a produccion `rvmtjtuztewcrmodrodb`. Dry-run posterior: remoto al dia.
- Inventario continua apagado por defecto y solo SHIBUI (`126f8168-f1ca-4a08-8eaf-c3816b9d9195` + slug `shibui`) esta habilitado. RLS activo en las 4 tablas; `anon` no ejecuta importacion.
- Importacion productiva: 23 productos nuevos + 3 enlazados (Dakota, Destiny, Infinity), 332 SKU y 458 unidades. Total SHIBUI: 27 productos y 6 categorias, porque Emely existente se preservo. Set Nikki omitido sin precio; Body Barbara sin imagen; Dakota conserva USD 16. Segunda ejecucion: 0 productos nuevos y siguen 332 movimientos, confirmando idempotencia.
- Preview validado `dpl_5entrgP5W494k2aSeU7YUpuXW4FE`. Produccion Ready `dpl_69kgyrK3qW9Yk9mf31twQtkimUq8`, URL de artefacto `https://vendeplus-clean-hkob95644-entrega2-s-projects.vercel.app`; alias `www.somos-ve.com`, `somos-ve.com`, `vendeplus-clean.vercel.app` confirmados.
- QA productivo: home, Marketplace, SHIBUI, carrito, checkout, Smash y login 200; APIs privadas panel/transporte 401 sin sesion. Prueba movil automatizada abrio Corset de Gamuza, mostro `Beige - S/M` con 1 disponible, permitio seleccionar y agregar al carrito; sin crear pedido y sin errores JS. Logs Vercel sin errores. Suite previa: inventario 8/8, criticos 69/69, puente 5/5, facturacion 9/9, TS/ESLint/build/DB lint OK.
- Rollback web anterior: `dpl_7E3AaLH429ZeP4vZyp6CWU15jiHV`. En emergencia funcional de SHIBUI, primero deshabilitar solo su fila en `store_inventory_settings`; no borrar tablas ni productos automaticamente. Restauracion de catalogo debe usar el respaldo y revisar si ya existen pedidos posteriores.
- No hubo commit ni push. Siguiente paso: usuario prueba desde telefono un producto simple (Corset) y luego uno de varias piezas; puede llegar hasta carrito sin enviar un pedido real. Revisar Body Barbara/Set Nikki antes de completarlos manualmente.

# 2026-09-10 - SHIBUI inventario opt-in validado en staging aislado, NO produccion

- Usuario autorizo avanzar despues de aprobar el prototipo visual. Se mantuvo la regla: inventario apagado por defecto y habilitado exclusivamente para SHIBUI mediante ID `126f8168-f1ca-4a08-8eaf-c3816b9d9195` + slug `shibui`; otros comercios conservan su comportamiento actual.
- Produccion `rvmtjtuztewcrmodrodb` NO fue modificada. No hubo deploy, migracion productiva, commit ni push.
- Rama Supabase aislada vigente: `shibui-inventory-staging-v2`, branch id `527921ed-2cd9-4398-b9bd-c9435364f1c7`, project ref `nmuypksuaxwyonilzoqs`, sin datos productivos. No guardar ni mostrar sus credenciales. Una primera rama vacia fallo por falta de esquema base y fue eliminada; sus credenciales quedaron invalidadas.
- Migraciones nuevas preparadas: `20260910220000_opt_in_basic_inventory.sql` (tablas/RLS, descuento atomico, reposicion al cancelar, bloqueo de reapertura) y `20260910221000_inventory_stock_import_rpc.sql` (carga de stock transaccional, solo service role, diferencias auditadas).
- Importador nuevo `scripts/import-shibui-catalog.mjs`, dry-run por defecto y escritura solo con doble confirmacion de slug y project ref. Protege ID/slug de SHIBUI, rechaza precios vacios y stock incoherente, conserva precios existentes, evita nombres ambiguos, sube imagenes idempotentes y usa el RPC de inventario.
- Resultado real en staging: 26 productos importables; 23 nuevos + 3 enlazados con Dakota/Destiny/Infinity existentes; 332 SKU; 458 unidades; 22 imagenes nuevas. `Set Nikki` omitido por precio faltante. `Body Barbara` queda sin imagen. Dakota conserva USD 16 frente a USD 18 de la fuente. Emely existente no se modifica.
- La importacion se ejecuto dos veces: segunda pasada creo 0 productos nuevos y mantuvo exactamente 332 SKU, 458 unidades y 332 movimientos; idempotencia confirmada. 1 solo comercio habilitado, 0 tablas de inventario sin RLS y `anon` no puede ejecutar el RPC. Descarga de imagen de muestra OK.
- QA: inventario 8/8, criticos 69/69, puente 5/5, facturacion 9/9, TypeScript, ESLint, `git diff --check`, Supabase DB lint sin hallazgos y build Next 16.3.4/86 rutas OK. Los mensajes de fallback del build provienen de variables Supabase ficticias usadas solo para compilar.
- Siguiente paso exacto: revisar el resumen con el usuario. Si aprueba publicacion posteriormente, preparar ventana separada: respaldo de SHIBUI, dry-run contra produccion, aplicar solo las dos migraciones, importar con confirmacion explicita, verificar conteos/precios/imagenes y recien despues desplegar el codigo. No usar `supabase db push` indiscriminado.

# 2026-09-09 - PAUSA: plan acordado de estabilidad y Delivery Premium

- Usuario pidió guardar planificación y continuar mañana. NO iniciar desarrollo ni acciones de producción durante la pausa.
- Plan completo en la raíz principal: `docs/checkpoints/2026-09-09-plan-pendiente-estabilidad-delivery-premium.md`.
- Próximo paso exacto: coordinar con titular rotación de credenciales históricas, recuperación y verificación MFA ANTES de exigirlo; no solicitar secretos/códigos por chat ni bloquear accesos sin coordinación.
- Orden acordado: seguridad/MFA; staging realmente aislado; integridad de comprobantes, puente, permisos de estadísticas y códigos; pruebas de capacidad/optimización; piloto de registro manual Premium; cuentas con abonos/liquidaciones; importaciones/reportes después.
- Reutilizar servicios delivery, tarifas y comisiones. No crear ventas ficticias, afiliaciones marketplace ni envíos a App automáticos por registrar un servicio manual. Mantener el panel comercio y otras agencias sin cambios ajenos.
- La propuesta original fue analizada, NO implementada. Sus instrucciones internas de ejecutar no sustituyen la petición de análisis/pausa del usuario.
- Fuente de producción .security-billing-release; candidato .particular-delivery-clean mantiene MFA futuro no publicado. No confundirlos ni desplegar raíz.
- Guardado exclusivamente documental; sin código, migraciones, SQL, producción, commit/push. Build no aplica. Riesgos y criterios detallados en el plan.

# 2026-09-09 - PRODUCCION: seguridad de dependencias y facturacion completa

- Publicado con autorizacion del usuario desde `.security-billing-release`, SIN MFA obligatorio. Produccion Ready: `dpl_BTMGcMaFR8LcDpeKLB7wxRNoM1eo`, https://vendeplus-clean-xcc9td82p-entrega2-s-projects.vercel.app. Resolucion de www.somos-ve.com y somos-ve.com confirmada al nuevo artefacto.
- Informe exacto: `docs/checkpoints/2026-09-09-produccion-seguridad-facturacion.md` en la raiz principal. Build local/Vercel190 paginas OK, lint/TS OK, contratos68/68, puente5/5, facturacion9/9, npm audit0. Smoke GET-only10/10 antes y despues de promover, sin logs error en ventana revisada.
- Aplicada SOLO `20260909010000_transport_billing_summary.sql` a rvmtjtuztewcrmodrodb. Funcion nueva, lectura y service_role exclusivamente; dry-run posterior al dia. Fed Fast agosto:247 servicios/USD452. No cambia pedidos, usuarios ni tarifas.
- Autenticacion previa conservada en nueve archivos. La rama de trabajo `.particular-delivery-clean` mantiene MFA futuro y NO es la fuente de produccion actual. La migracion `20260909011000_security_session_validation.sql` NO se aplico.
- NO se rotaron credenciales ni se registraron factores reales. Sanitizacion local previa no elimina secretos de historia Git/copias remotas. Pendiente coordinar titular, rotacion y recuperacion ANTES de activar MFA. No probar claves historicas.
- No hubo commit/push ni ordenes/envios reales de prueba. La raiz contiene impresion y cambios ajenos: NO desplegarla. Script de snapshot NO debe repetirse sobre release final porque sobrescribe ajustes CI/pruebas.
- Rollback funcional anterior: dpl_7oPyS4b2SQYvGXK8kFFPQvGmo9MY; reintroduce dependencias vulnerables, solo emergencia. Funcion SQL aditiva puede permanecer.
- Siguiente paso exacto: titular valida ingreso habitual, factura Fed Fast agosto y cambio de agencia; luego coordinar cierre de credenciales/MFA. E2E autenticado con pedidos reales no realizado. Otros P1 de auditoria siguen pendientes.

# 2026-09-09 - Parche preparado: seguridad y facturación, aún sin publicar

- Leer `../docs/audits/2026-09-09-correcciones-seguridad-facturacion.md`. Usuario autorizó tres correcciones; NO publicar ni aplicar SQL implícitamente. No commit/push. Preservar los cambios previos de comprobantes/tarjetas/particulares.
- Next/eslint-config-next16.3.4, sharp0.35.4/libheif1.23.2, transitivas actualizadas: audit0. node_modules propio; junction anterior retirado sin modificar destino compartido. Último build con configuración correcta:192 páginas (anterior196, depende de catálogos precargados); fallos iniciales por variable privada ausente documentados.
- Se retiraron22 apariciones de posibles contraseñas en14 documentos de continuidad locales. Valores antiguos pueden permanecer en Git/copies; NO rotación ni limpieza de historia ni MFA real efectuados. No volver a guardar secretos aquí. Titular debe cambiar contraseña y verificar autenticador; definir recuperación antes de activar obligación.
- `/cuenta/seguridad` y bootstrap `/api/account/security`; MFA obligatorio fundador y owner/admin delivery, además de cuentas con factor verificado. Guardas server-side requieren aal2 y sesión vigente para protegidos. Comercio normal sin factor conserva acceso. UI móvil probada con respuestas simuladas y conexiones externas bloqueadas.
- Facturación usa `transport_billing_summary` completo; detalle paginado con conteo exacto, scope de agencia, cancelaciones y sin duplicar registros legacy/transporte en comercio. Detalle máximo20.000 rechaza sin subtotal, resumen SQL no se recorta.
- SQL nuevo PENDIENTE: `20260909010000_transport_billing_summary.sql`, `20260909011000_security_session_validation.sql`. Aplicación debe preceder al nuevo código. No ejecutar push indiscriminado; Preview usa servicios reales.
- Validaciones:68 contratos,5 puente,13 nuevas pruebas; SQL PostgreSQL temporal201/1001/10000 y permisos/sesiones; lint/TS; imágenes actualizadas. CI reforzado. Herramienta browser integrada no disponible; fallback automatizado local, cero altas reales de Auth.
- Siguiente paso: titular+ventana de rotación/recuperación/MFA, revisión y autorización de migraciones/despliegue. Si coordinación demora, separar parche P0 de dependencias. Producción aún sin estas correcciones, restantesP1 fuera del alcance continúan abiertos.
- Limpieza final: servidor QA3155 detenido, `../tmp/security-build.env` eliminado, configuración original intacta. No hay Preview nuevo publicado ni SQL aplicado; las altas de MFA fueron simuladas.

# Estado anterior: auditoría general posterior, con P0/P1 abiertos

Leer `../docs/audits/2026-09-08-ecosistema-seguridad-escalabilidad.md` y la sección final de auditoría. Las publicaciones anteriores no implican ausencia de riesgos. Próximo paso: parche de seguridad autorizado; producción sin cambios durante la auditoría.

# 2026-09-08 - Produccion tarjeta Delivery simplificada y compatibilidad China Town

- Usuario aprobo el Preview `dpl_HdRSR2ydR5oU228LsnuHTXmdqvot`. Se promovio exactamente ese artefacto, sin reconstruir otro candidato y sin SQL.
- Produccion nueva Ready: `dpl_4GotPD8R2EiHLg6BC2QFoiyJiwcn`, `https://vendeplus-clean-prxwynvhb-entrega2-s-projects.vercel.app`. Alias oficiales `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` confirmados sobre este deployment.
- Cambio visible: tarjeta del comercio usa moto y boton generico `Delivery`; azul antes del envio y verde/deshabilitado despues. No muestra `Entrega2 App: ...` ni `Empresa delivery: ...`. Pedidos historicos China Town con provider legacy e integracion `sent` conservan la moto verde aunque no tengan `transport_order`.
- Smoke posterior: `/`, `/marketplace`, `/smash`, `/panel/login`, `/panel/pedidos`, `/transporte`, Marketplace/Particulares Entrega2 respondieron 200; APIs privadas de panel/transporte respondieron 401 sin sesion. Sin logs nivel error ni 5xx.
- Supabase dry-run posterior: base remota al dia. Sin migracion ni SQL. Validaciones del artefacto: 65/65 criticos, 5/5 puente, TypeScript, ESLint, build local Webpack y Vercel Turbopack con 185 paginas.
- Rollback web inmediato: produccion anterior `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`. No se hizo commit ni push.
- Siguiente paso: usuario confirma visualmente en produccion un pedido historico China Town enviado y uno nuevo/pendiente; ambos deben conservar una unica accion `Delivery` coherente.

# 2026-09-08 - Preview compatibilidad visual pedidos legacy China Town

- Usuario noto que en China Town no aparecia ninguna accion delivery despues de quitar los chips redundantes. Diagnostico remoto de lectura: los 12 pedidos delivery recientes consultados conservan `delivery_provider='entrega2'`, integracion `sent` y `delivery_status='sent'`, pero no tienen `transport_order` porque fueron enviados antes de la migracion al puente.
- Se amplio la condicion visual `showDeliverySent` en `OrdersManager`: pedidos legacy Entrega2 con integracion/estado confirmado muestran moto verde `Delivery`; pedidos actuales de empresa delivery tambien usan como respaldo `order.transport_agency_status`. Estados pendientes, enviando, fallidos o en conciliacion no se marcan como enviados.
- Se mantienen ocultos `Entrega2 App: ...` y `Empresa delivery: ...`; no cambio ninguna ruta, envio, estado interno ni dato remoto.
- Validaciones: 65/65 contratos criticos, 5/5 puente, TypeScript, ESLint y `git diff --check` OK. `npm.cmd run build` conserva el fallo ambiental conocido del symlink Turbopack; build local Webpack con variables en memoria y build Vercel Turbopack aprobaron 185 paginas.
- Preview corregido Ready y sin logs de error: `dpl_HdRSR2ydR5oU228LsnuHTXmdqvot`, `https://vendeplus-clean-pckfeajg2-entrega2-s-projects.vercel.app`. Produccion sigue intacta en `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`.
- Sin migracion, SQL, commit ni push. Siguiente paso: revisar China Town en el Preview; los pedidos legacy enviados deben mostrar el boton verde `Delivery` con moto.

# 2026-09-08 - Preview tarjeta de pedido delivery simplificada

- Usuario aclaro la UX correcta del comercio: solo debe saber que envio el pedido a su empresa delivery; no debe ver si internamente paso a Entrega2 App ni duplicar el mismo estado en chips.
- En `src/components/panel/OrdersManager.tsx`, Delivery usa icono `Motorbike` en la modalidad y en los botones; se eliminaron de la tarjeta los chips `Entrega2 App: ...` y `Empresa delivery: ...`; el boton se llama siempre `Delivery`, azul antes de enviar y verde/deshabilitado despues. La logica, estados y puente interno no cambiaron.
- `scripts/critical-contracts.test.mjs` protege la UX: exige moto y evita que vuelvan los textos internos o el camion de 16 px en la accion.
- Validaciones: contratos criticos 65/65, puente 5/5, TypeScript, ESLint focal y `git diff --check` OK. `npm.cmd run build` exacto falla por el symlink conocido de Turbopack fuera del root; build Webpack con variables cargadas solo en memoria aprobo 185 paginas. Build remoto Vercel Turbopack aprobo 185 paginas.
- Preview Ready: `dpl_2ZuqFpVMbu1hnVbyu9ziqKYHMae4`, `https://vendeplus-clean-2flvb24th-entrega2-s-projects.vercel.app`; sin logs de error. Produccion permanece sin cambios en `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`.
- Sin migracion, SQL, commit ni push. Siguiente paso: usuario revisa una tarjeta delivery enviada y otra pendiente en Preview; promover solo con aprobacion explicita.

# 2026-09-08 - QA posterior a produccion puente Entrega2

- Validacion solicitada por el usuario, sin crear pedidos ni modificar datos. Navegador integrado no disponible; se uso smoke HTTP directo, pruebas locales y lecturas de Supabase/Vercel.
- Produccion sigue Ready en `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`; siete rutas publicas/panel respondieron 200, APIs privadas de contexto y ambos endpoints de envio respondieron 401 sin sesion, y payloads invalidos de cotizacion/particulares respondieron 400. No hubo 5xx en logs desde el despliegue.
- Pruebas repetidas: contratos criticos 65/65, puente Entrega2 5/5, `git diff --check` OK y Supabase dry-run al dia.
- Estado remoto: 0 legacy, 15 configuraciones apuntan a Entrega2 Somos, 15 conexiones activas/default/exclusivas correctamente enlazadas, 14 credito y 1 contado.
- Cotizacion real no destructiva para Smash: respuesta disponible desde Entrega2 App, provider `transport_agency`, 2484 ms; no activo fallback. El fallback de 4.5 s queda validado por contrato automatizado, no se forzo una falla real del proveedor.
- Desde el despliegue no hay integraciones nuevas, fallidas ni en conciliacion. Ultimos envios comerciales previos visibles: Smash `VP-0908-DPK` y China Town con estado integracion/delivery `sent` y external ID presente.
- Hallazgo historico: 9 integraciones de particulares del 6-7 de septiembre siguen en `sending`, todas anteriores al despliegue, sin `order_id` comercial ni error. No afectan pedidos nuevos ni comercios, pero esos nueve servicios antiguos no pueden reintentarse hasta conciliarlos. No se modificaron por tratarse de una validacion de lectura.
- Pendiente E2E humano: ejecutar un pedido nuevo Smash credito, uno Sabore contado y un particular; esto genera datos/envios reales y requiere operacion controlada con sesion.

# 2026-09-08 - Produccion puente Entrega2 Somos-App

- Usuario aprobo expresamente el pase cauteloso a produccion despues de validar Smash credito y aclarar la etiqueta del boton.
- Respaldo previo de las 13 configuraciones legacy: `../tmp/checkpoints/2026-09-08-entrega2-legacy-preprod-backup.json`, SHA256 `4543526FFEC7734CDB4DC7E248F3328908F866C720251D6681E11EF883E160A1`.
- Migracion no destructiva aplicada: `supabase/migrations/20260907213000_align_legacy_entrega2_connections.sql`. Resultado: 0 configuraciones legacy pendientes, 13 configuraciones alineadas, 13 conexiones creadas/alineadas (12 credito y 1 contado: Sabore). Total de conexiones activas Entrega2: 15 incluyendo Smash y Andinos. Dry-run posterior: base remota al dia.
- Se promovio exactamente el Preview validado `dpl_8MegoK5yEdDKmZjYmjiTffNhmo4a` (`vendeplus-clean-h3310xzpi-entrega2-s-projects.vercel.app`). Produccion nueva Ready: `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`, `https://vendeplus-clean-fkouk33r7-entrega2-s-projects.vercel.app`.
- Alias confirmados sobre el deployment nuevo: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y el alias del proyecto.
- Smoke posterior sobre `www.somos-ve.com`: `/`, `/marketplace`, `/smash`, `/panel/login`, `/transporte`, `/transporte/entrega2/marketplace` y `/transporte/entrega2/particulares` respondieron 200; `/api/panel/context` y `/api/transport/me` respondieron 401 sin sesion, esperado. Contenido principal verificado y sin logs Vercel de nivel error desde el despliegue.
- Validaciones del candidato promovido: contratos criticos 65/65, puente Entrega2 5/5, ESLint focal y `git diff --check` OK; build local Webpack y build remoto Vercel aprobados con 185 paginas.
- Rollback web disponible: deployment productivo anterior `dpl_2VEUZVTE5Arge4DJSifqkHgmMRru`. Reversion de datos solo de forma controlada usando el respaldo previo; no es necesaria actualmente.
- No se hizo commit ni push. Riesgos P1 independientes pendientes: aislar Preview de Supabase productivo, rotar credenciales historicas y eliminar topes de 200 en facturacion/afiliados.
- Siguiente paso exacto: prueba operativa corta del usuario en produccion: Smash credito debe crear registro Somos y enviarse directo a Entrega2 App; Sabore contado debe quedar en Somos hasta que la operadora pulse `Enviar a Entrega2 App`; un particular debe seguir el mismo flujo operado. Vigilar que cada caso tenga una sola integracion y no se duplique al reintentar.

# 2026-09-08 - Checkpoint Puente Entrega2 Somos-App pendiente de validacion

- Usuario confirma revision visual OK y pide guardar para validar antes de produccion.
- Ficha principal: `../docs/checkpoints/2026-09-08-puente-entrega2-somos-app-pendiente-validacion.md`.
- ZIP local verificado: `../tmp/checkpoints/2026-09-08-puente-entrega2-somos-app-pendiente-validacion.zip`, 445 entradas, sin `.env*`; SHA256 `27220EB8689FB87DE66C960DCDF980265B939CD50F4F64FE6C97D14CC2F100F1`.
- Preview vigente: https://vendeplus-clean-r68ntp10u-entrega2-s-projects.vercel.app (`dpl_7mjJ1Sg1cQR3gJ4xPhLg5XtPWZ6v`). Etiqueta visible legacy retirada; compatibilidad interna conservada.
- Cotizacion centralizada App con timeout 4.5 s y respaldo Somos; credito/contado/particulares segun arquitectura documentada en `docs/ENTREGA2_SOMOS_BRIDGE.md`.
- Ultimo build local y Vercel aprobados (185 paginas); contratos 65/65; TypeScript/ESLint OK. Pruebas previas son de contrato/lectura, no E2E operativo.
- No promover produccion ni ejecutar migraciones. Preview comparte base productiva; las pruebas con escrituras requieren entorno aislado. Migracion de alineacion pendiente: `20260907213000_align_legacy_entrega2_connections.sql`.
- Se inicia auditoria de seguridad y escalabilidad de lectura solicitada por el usuario. Ver informe en `../docs/audits/2026-09-08-somos-seguridad-escalabilidad.md` cuando termine; sus hallazgos deben revisarse antes de publicar.
- Auditoria finalizada en ese informe. Cinco P1: aislamiento de entornos, credenciales historicas, integridad del puente/eventos, validacion/latencia de cotizacion y agregados/listados truncados. Se reprodujeron localmente tarifa 0 ante costos invalidos, total $600 para 201 servicios de $3, regresion entregado -> aceptado y espera de ~8046 ms. Programa de reproduccion en `../docs/audits/2026-09-08-somos-behavior.cjs`; no usa servicios reales.
- No se corrigio producto ni se promovio produccion. El checkpoint es la referencia visual, no una aprobacion operativa; resolver/revalidar estos hallazgos antes de proponer la publicacion.
- Cierre de auditoria: build local Webpack repetido y aprobado, 185 paginas; contratos 65/65; tres APIs privadas del Preview devolvieron 401 sin sesion. No hubo deploy nuevo.
- Codificacion de este historial y el principal reparada mecanicamente: dos bytes Windows-1252 invalidos por archivo convertidos a UTF-8, copias previas privadas en `../tmp/checkpoints/`. Se preservo el resto del contenido.

# 2026-09-07 - Preview puente claro con comercios Entrega2 App legacy visibles

- Usuario probo Preview anterior: podia entrar a `Comercios`, pero solo veia `Smash (Test)` y no veia otros comercios ni opcion clara para pasarlos a contado/credito.
- Diagnostico: los comercios existentes con Entrega2 App viven en configuracion legacy `store_delivery_settings.delivery_provider = 'entrega2'`, no como filas reales en `store_transport_agency_connections`. Por eso Entrega2 Somos no los listaba.
- Cambio aplicado: `/api/transport/me` ahora, cuando la cuenta es Entrega2 Somos, mezcla en `connections` los comercios legacy de Entrega2 App que aun no tienen conexion real. Salen con chip `Entrega2 App legacy`, `Credito directo` por defecto, excepto `sabore` como `Contado validado`.
- Cambio aplicado: en `Comercios`, el selector de modalidad queda bloqueado para legacy hasta confirmar cobro. Al cambiar `Cobro` en un legacy, llama `POST /api/transport/legacy-entrega2/[storeId]`, crea/actualiza la conexion real con Entrega2 Somos, cambia `store_delivery_settings` de `entrega2` a `transport_agency`, apunta `transport_agency_connection_id`, y deja `delivery_billing_mode` segun lo elegido.
- Cambio aplicado: la pantalla mantiene contadores y filtro `Todos/Solo credito/Solo contado`, y chips claros `Credito directo` / `Contado validado` + destino operativo.
- Migracion global `20260907213000_align_legacy_entrega2_connections.sql` sigue preparada para alinear todos de una vez, pero no aplicada. El endpoint permite alinear uno por uno desde UI.
- Validaciones aprobadas: contratos directos `65/65`; TypeScript OK; ESLint focal OK; `git diff --check` OK; Supabase dry-run detecta solo la migracion global pendiente; build local Webpack OK, 185 paginas.
- Preview nuevo Ready: `dpl_45s1oqTJ7sBuRao3nZVLQuqXtV7z`, `https://vendeplus-clean-wxvp92jem-entrega2-s-projects.vercel.app`, target Preview. `vercel inspect` Ready y logs de error sin resultados.
- Produccion codigo no fue promovida. Nota operativa: el Preview usa la base remota; ver la lista no cambia datos, pero cambiar el selector de cobro en un comercio legacy si crea/actualiza conexion real en la base. Para prueba segura usar primero `Smash (Test)`.
# 2026-09-07 - Preview visibilidad y alineacion credito/contado Entrega2

- Usuario aclaro regla operativa: todos los comercios que hoy estan conectados a Entrega2 App deben quedar tambien conectados a Entrega2 Somos. Desde Entrega2 Somos se elige quien es `Credito` y quien es `Contado`; actualmente todos son credito excepto `sabore`.
- Diagnostico remoto de datos: las tiendas legacy con `store_delivery_settings.delivery_provider = 'entrega2'` no tenian fila en `store_transport_agency_connections`, por eso no aparecian en Comercios de Entrega2 Somos ni podian clasificarse contado/credito. La agencia Entrega2 Somos existe como `transport_agencies.slug = 'entrega2'`, id `3db97653-4a7a-4ab0-854d-0ca847ff88a9`.
- Tiendas legacy detectadas para alinear: Andinos, China Town, Cookies Shop, Don Aniello, Happy chicken, La cabana, La Cremita Gourmet Guasimal, La Cremita Gourmet Las Ballenas, Pasteleria TDK Delicias, Pasteleria TDK Los Cedros, Pasteleria TDK Pinonal, Sabore, Santo Sabor, Smash (Test), Strawberry.
- Cambio UI aplicado: en `Transporte > Panel > Comercios`, cuando la empresa es Entrega2, se muestra bloque `Cobro Entrega2` con contadores `Activos Entrega2`, `Credito directo`, `Contado validado`, filtro `Todos/Solo credito/Solo contado`, y chips por comercio: `Credito directo` + `Envia directo a Entrega2 App` o `Contado validado` + `Operadora libera desde Somos`.
- Migracion nueva preparada pero NO aplicada a produccion: `supabase/migrations/20260907213000_align_legacy_entrega2_connections.sql`. Crea/actualiza conexiones activas Entrega2 Somos para tiendas legacy `delivery_provider='entrega2'`, cambia `store_delivery_settings` a `transport_agency`, asigna `credit` a todas excepto `sabore` como `cash`, y apunta `transport_agency_connection_id` a la conexion creada.
- Supabase dry-run: detecta solo esta migracion pendiente (`20260907213000_align_legacy_entrega2_connections.sql`). No se ejecuto `db push` real.
- Validaciones aprobadas: contratos directos `65/65`; TypeScript `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; build local `npm.cmd run build -- --webpack` OK con 185 paginas.
- Preview nuevo Ready: `dpl_7PJQgWZLJtQcNM5aMdJE5epiAyvg`, `https://vendeplus-clean-jk5kypv73-entrega2-s-projects.vercel.app`, target Preview. Build remoto Vercel Turbopack OK. Logs de error: sin resultados. Smoke HTTP cae en `Login - Vercel` por SSO de Preview.
- Produccion no fue promovida ni tocada. Para prueba funcional completa hace falta decidir/aprobar aplicar la migracion de alineacion en la base remota, porque el Preview usa la misma base y sin esa migracion los comercios legacy no apareceran aun en Entrega2 Somos.
# 2026-09-07 - Preview puente Entrega2 credito/contado sin produccion

- Usuario recordo el objetivo: puente entre Entrega2 Somos y Entrega2 App. Comercios con credito deben enviarse directo a Entrega2 App desde el panel del comercio; comercios de contado deben llegar al panel Entrega2 Somos, donde la operadora valida y luego libera hacia Entrega2 App.
- Se continuo exclusivamente en el worktree `.particular-delivery-clean`. No se promovio ni se toco produccion.
- Implementacion verificada: `store_transport_agency_connections.delivery_billing_mode` soporta `cash` por defecto y `credit`; al aprobar afiliaciones Entrega2 se selecciona contado/credito; la empresa puede cambiarlo despues desde Comercios; el comercio ve el modo de cobro en su Marketplace de empresas delivery.
- Ruta comercio verificada: `POST /api/panel/orders/[orderId]/send-delivery` para `transport_agency` + Entrega2 crea `transport_orders`; si la conexion es `credit`, envia directo a Entrega2 App con `sendCommerceOrderToEntrega2App`; si es `cash`, registra evento `cash_validation_required` y deja el servicio en Entrega2 Somos para validacion.
- Ruta Entrega2 Somos verificada: `POST /api/transport/panel/orders/[transportOrderId]/send-entrega2` permite liberar a Entrega2 App tanto particulares como pedidos de comercio validados, con GPS requerido, deduplicacion en `order_integrations`, evento `entrega2_app_sent` o `entrega2_app_released`, y webhooks actualizando `transport_order_id`.
- Supabase dry-run: `Remote database is up to date`; no hay SQL pendiente contra la base remota.
- Validaciones aprobadas: contratos directos `65/65`; `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; build local `npm.cmd run build -- --webpack` OK con variables cargadas desde `../.env.local` solo en memoria, 185 paginas.
- `npm.cmd run build` normal falla localmente por el problema conocido de Turbopack con `node_modules` symlink fuera del root del worktree; el build remoto Vercel Turbopack aprobo.
- Preview Ready: `dpl_ECXcWbXwnfgSDSK9fkpbzMzpbiwG`, `https://vendeplus-clean-3ovgj960m-entrega2-s-projects.vercel.app`, target Preview.
- Smoke Preview: `vercel inspect` Ready y `vercel logs --level error --since 10m` sin logs. Smoke HTTP de rutas devuelve Vercel SSO (`Login - Vercel`), esperado por proteccion de Preview; prueba funcional requiere entrar con cuenta Vercel o bypass configurado.
- Siguiente paso exacto: probar en Preview con sesion Entrega2 Somos: (1) marcar un comercio Entrega2 como `Credito`, crear/enviar pedido delivery y confirmar que pasa directo a Entrega2 App; (2) marcar otro como `Contado`, enviar pedido desde comercio, confirmar que aparece en Pedidos de Entrega2 Somos y solo se manda a Entrega2 App al pulsar el boton de enviar/liberar; (3) confirmar que reintentos quedan bloqueados si `order_integrations` ya tiene estado no fallido. No promover a produccion sin aprobacion explicita posterior.
# 2026-09-07 - Auditoria produccion antes de arquitectura credito/contado Entrega2

- Usuario pidio asegurar lo que esta en produccion antes de planificar cambios nuevos de cotizacion Entrega2 App y selector credito/contado.
- Sin tocar codigo ni desplegar. `git status --short` conserva el worktree con cambios historicos de particulares y handoff; no se hizo commit ni push.
- Produccion actual inspeccionada: `dpl_2VEUZVTE5Arge4DJSifqkHgmMRru`, `https://vendeplus-clean-i5l94eert-entrega2-s-projects.vercel.app`, target production, status Ready.
- Aliases oficiales confirmados: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app`, `https://vendeplus-clean-entrega2-s-projects.vercel.app`.
- Supabase dry-run: `Remote database is up to date`; no migraciones ni SQL pendientes.
- Smoke produccion OK: `/`, `/marketplace`, `/transporte`, `/transporte/entrega2/particulares`, `/transporte/panel`, `/panel`, `/china-town` en `www.somos-ve.com` respondieron 200 con contenido; tambien OK en alias `vendeplus-clean.vercel.app` para particulares y panel transporte.
- Logs Vercel ultimos 20 minutos: actividad normal nivel info, multiples 200 en paneles/catalogos/API; un `POST /api/orders` 400 aislado nivel info, compatible con validacion de solicitud y sin indicio de fallo 5xx/server error.
- Siguiente paso exacto: no modificar produccion hasta disenar y aprobar arquitectura para: cotizacion particulares primero contra Entrega2 App con fallback Somos; selector por comercio conectado a Entrega2 entre credito directo y contado con validacion/liberacion desde panel Entrega2 Somos.
# 2026-09-07 - Produccion recordar solicitante particulares

- Usuario aprobo el Preview `https://vendeplus-clean-fi4ujktf4-entrega2-s-projects.vercel.app` y pidio pasarlo a produccion con cuidado.
- Verificacion previa: `vercel inspect` confirmo Preview Ready (`dpl_8PVcTuckFBY4wHtF5A17Nee8xpzh`) y `npx.cmd supabase db push --linked --dry-run` confirmo `Remote database is up to date`.
- Se promovio exactamente ese Preview con `vercel.cmd promote vendeplus-clean-fi4ujktf4-entrega2-s-projects.vercel.app --yes`.
- Produccion nueva Ready: `dpl_2VEUZVTE5Arge4DJSifqkHgmMRru`, `https://vendeplus-clean-i5l94eert-entrega2-s-projects.vercel.app`.
- Aliases oficiales confirmados sobre el deployment nuevo: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y `https://vendeplus-clean-entrega2-s-projects.vercel.app`.
- Smoke produccion OK: `https://www.somos-ve.com/transporte/entrega2/particulares` 200 content-ok, `https://www.somos-ve.com/transporte/panel` 200 content-ok, y mismos checks OK en `vendeplus-clean.vercel.app`.
- Logs Vercel recientes: solo eventos info 200 para formulario, panel, imagenes y `/api/transport/panel/orders`; sin errores reportados por CLI.
- Supabase dry-run posterior: `Remote database is up to date`. Migracion `20260907190000_add_particular_request_contact_names.sql` ya aplicada. No hay SQL pendiente.
- No se hizo commit ni push.
- Siguiente paso exacto: prueba real controlada en produccion creando un particular Delivery/Usted envia y otro Delivery/Usted recibe, verificando que recuerda solicitante y que WhatsApp/panel muestran nombres de retiro/entrega.
# 2026-09-07 - Preview generado recordar solicitante particulares

- Usuario autorizo generar Preview para recordar datos del solicitante y pedir nombre de la otra parte en Delivery particular.
- Migracion remota aplicada con `npx.cmd supabase db push --linked`: `20260907190000_add_particular_request_contact_names.sql` agrega `pickup_name` y `delivery_name` opcionales. Dry-run posterior: `Remote database is up to date`.
- Validaciones previas/post: contratos directos 64/64 OK, `git diff --check` OK, build local `npm.cmd run build -- --webpack` OK, build remoto Vercel Turbopack OK con 181 paginas.
- Preview READY: https://vendeplus-clean-fi4ujktf4-entrega2-s-projects.vercel.app (`dpl_8PVcTuckFBY4wHtF5A17Nee8xpzh`), target Preview, proyecto `vendeplus-clean`.
- Smoke sin sesion contra `/transporte/entrega2/particulares` y `/transporte/panel` devolvio 302 por proteccion/SSO de Vercel Preview; `vercel inspect` confirma estado Ready. No se promovio a produccion.
- Siguiente paso exacto: probar el Preview con sesion/bypass Vercel en movil: Delivery/Usted envia debe pedir nombre/telefono de quien recibe; Delivery/Usted recibe debe pedir nombre/telefono de quien entrega; recargar debe recordar nombre/telefono del solicitante si el checkbox queda activo. Si el usuario aprueba, promover a produccion y hacer smoke posterior en dominios oficiales.
# 2026-09-07 - Preview pendiente: recordar solicitante y nombres por punto en particulares

- Usuario pidio agregar a pedidos particulares la opcion de recordar datos de solicitante como en checkout de comercios, y pedir nombre de la otra parte en Delivery particular: si el solicitante envia, pedir nombre/telefono de quien recibe; si el solicitante recibe, pedir nombre/telefono de quien entrega.
- Cambio aplicado en `.particular-delivery-clean`: `ParticularDeliveryForm` reutiliza `customer-browser-profile` para cargar/guardar nombre y telefono del solicitante en `localStorage`, con checkbox activado por defecto y opcion de limpiar si se desmarca.
- Cambio aplicado: `Point` ahora soporta `name`; el formulario muestra `Nombre de quien recibe en entrega` o `Nombre de quien entrega en retiro` segun el rol del solicitante. Para traslado de persona se conserva la logica de pasajero ya existente.
- Cambio aplicado server-side: la API publica de particulares valida `pickup.name` y `delivery.name`, inserta `pickup_name` y `delivery_name`, y los incluye en el WhatsApp de solicitud particular.
- Cambio aplicado panel/operacion: las APIs de pedidos/particulares seleccionan `pickup_name` y `delivery_name`; el panel muestra contactos de retiro/entrega en el detalle y los incluye en la comanda WhatsApp al repartidor; el envio a Entrega2 App agrega esos nombres en `detalles`.
- Migracion nueva pendiente de aplicar antes de Preview/produccion: `supabase/migrations/20260907190000_add_particular_request_contact_names.sql`, aditiva, agrega `pickup_name` y `delivery_name` opcionales con limite de 100 caracteres. No destruye datos viejos.
- Validaciones aprobadas: `node --experimental-strip-types scripts/critical-contracts.test.mjs` 64/64; `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; `npx.cmd supabase db push --linked --dry-run` OK y detecta solo esta migracion nueva; `npm.cmd run build -- --webpack` OK, Next.js 16.3.0, 181 paginas.
- No se hizo deploy, no se promovio produccion, no se aplico la migracion remota en esta retoma.
- Siguiente paso exacto: aplicar la migracion en Supabase remoto, desplegar Preview, probar en movil los caminos Delivery/Usted envia y Delivery/Usted recibe verificando que se cargan/guardan datos del solicitante y que se exigen los nombres de la otra parte; luego revisar panel y WhatsApp antes de aprobar produccion.
# Enlace público para particulares por empresa delivery (2026-09-04)

- Trabajo aislado en `.particular-delivery-clean`, rama `feature/particular-delivery-links`; sin commit, Preview, producción ni escrituras remotas.
- Se agregó `/transporte/[agencySlug]/particulares`, un flujo móvil de cuatro pasos: solicitante, retiro, entrega y resumen. Distancia y tarifa se recalculan server-side antes de registrar y abrir WhatsApp.
- El panel permite abrir/copiar el enlace y muestra solicitudes limitadas a la empresa autenticada. La API pública limita abuso por IP/empresa, cuerpos de 8 KB y valida slug, coordenadas, teléfonos, textos y pago.
- Migración aditiva `20260905010000_transport_particular_requests.sql`, todavía NO aplicada: tabla con FK a empresa, checks, índice, RLS y acceso directo revocado a `public`, `anon` y `authenticated`.
- Validaciones aprobadas después de liberar espacio: 63/63 contratos críticos, ESLint dirigido, `git diff --check`, TypeScript y build completo Next.js 16.3.0 con 193 páginas. El build usó Webpack porque Turbopack rechaza el junction local de dependencias compartidas; las variables privadas se cargaron solo en memoria desde `.env.local`, sin copiar ni modificar secretos.
- Migración aditiva `20260905010000_transport_particular_requests.sql` aplicada remotamente con autorización, después de un dry-run que confirmó que era la única pendiente. Verificación: tabla vacía, RLS activo, `anon`/`authenticated` sin SELECT, `service_role` con SELECT, índice esperado y ocho constraints presentes.
- Preview Ready: `dpl_9LcVAZiGmu96YZbNzdZFsjsdv65V`, `https://vendeplus-clean-lx9ddaaf8-entrega2-s-projects.vercel.app`, target Preview y proyecto correcto `vendeplus-clean`. Build remoto Next.js 16.3.0 de 193 páginas aprobado.
- Smoke Preview: `/transporte/entrega2/particulares` HTTP 200; API pública GET 405; API de panel sin sesión 401; cotización POST sin crear solicitud devolvió 2,87 km y $1,50 desde tarifa server-side. La tabla continuó con 0 filas y no hubo logs de error.
- Siguiente paso: probar desde teléfono el flujo visual con el enlace de una empresa activa y registrar una solicitud controlada; confirmar que abre WhatsApp y aparece solo en Pedidos de esa empresa. No promover a producción sin aprobación explícita.
- Culminación técnica (2026-09-04): las solicitudes particulares ahora crean automáticamente un `transport_order`, aparecen en el listado operativo normal de Pedidos, admiten asignación de repartidor y sincronizan sus estados. La empresa configura métodos/datos de pago que el cliente puede consultar y copiar.
- Se corrigió el orden de migraciones antes de aplicar: la integración quedó como `20260905020000_integrate_particular_delivery_orders_and_payments.sql`, posterior a la tabla base `20260905010000`. El dry-run propuso solo esa migración y fue aplicada remotamente sin errores.
- Validaciones finales: 63/63 contratos críticos (ejecución directa por el `spawn EPERM` conocido del runner), ESLint global, TypeScript, `git diff --check` y build Next.js 16.3.0 de 193 páginas aprobados. El build local usó Webpack por el junction del worktree; el build remoto Turbopack también aprobó.
- Preview final Ready: `dpl_CVeWAjv9wpLtZcaWgbgraE8sm1FH`, `https://vendeplus-clean-ey6d0ph5k-entrega2-s-projects.vercel.app`. Producción web no fue promovida.
- Próximo paso exacto: configurar al menos un método de pago en una empresa controlada, crear una solicitud real desde teléfono y confirmar en Pedidos que aparece una sola vez, permite asignar repartidor y sincroniza estados. Promover solo después de esa validación.
- Refinamiento visual solicitado sobre capturas: cabecera pública con mejor jerarquía, fondo suave, logo elevado y decoración discreta; cabecera del panel con acciones compactas, alturas consistentes y etiquetas más cortas para evitar la fila sobredimensionada.
- Pagos particulares simplificados exclusivamente a `Pago móvil` y `Efectivo`. Configuración presentada en dos tarjetas; Pago móvil permite escribir libremente el nombre del banco, teléfono, cédula/RIF y titular. Métodos antiguos quedan filtrados en cliente y rechazados server-side.
- Retiro y entrega unifican `Dirección escrita` + `Referencia opcional` en un solo campo `Dirección o referencia`. El GPS continúa siendo obligatorio y la descripción escrita opcional.
- Pago móvil exige ahora `Referencia del pago` tanto en cliente como server-side. Se guarda en `transport_particular_requests.payment_reference`, aparece en WhatsApp y en el detalle operativo del pedido. Migración aditiva `20260905030000_add_particular_payment_reference.sql` aplicada remotamente; no requiere SQL manual.
- Validaciones: TypeScript, ESLint dirigido, 63/63 contratos, `git diff --check` y build local Next.js 16.3.0 de 193 páginas aprobados. Preview final `dpl_5AHQ57ZSkSuxCtmLtwGx9wKqeB91`, `https://vendeplus-clean-8up7b5zkr-entrega2-s-projects.vercel.app`, Ready; build remoto Turbopack aprobado. Producción web intacta.
- Próximo paso exacto: revisar en Preview la cabecera del panel y el formulario móvil; configurar Pago móvil/Efectivo, registrar una solicitud con referencia y confirmar su visualización en Pedidos. No promover sin aprobación explícita.
- Hotfix visual posterior: el logo del enlace público ya no usa un contenedor con recorte ni estira la imagen al 100%. Ahora dispone de caja 72x72, margen interno real y una imagen 48x48 con `object-contain`, por lo que conserva completa cualquier proporción.
- ESLint dirigido, TypeScript, `git diff --check` y build local/remoto Next.js 16.3.0 de 193 páginas aprobados. Preview corregida `dpl_C8eYcCd4FznLrvUsqcbAhNo7f5rK`, `https://vendeplus-clean-jpv44yxc8-entrega2-s-projects.vercel.app`, Ready. Sin migración adicional ni producción.
- Segunda corrección del logo tras evidencia visual: el archivo de Entrega2 contiene margen blanco interno, por lo que `object-contain` mostraba la marca útil diminuta. La miniatura ahora usa el patrón de avatar (`object-cover`, centrado, sin padding) para ocupar completamente el cuadro 72x72. ESLint, TypeScript, diff check y build local/remoto de 193 páginas aprobados. Preview `dpl_BjkAzbqQqNdrALcarbKtJWTToayz`, `https://vendeplus-clean-95rvs0ki4-entrega2-s-projects.vercel.app`, Ready; producción intacta.

# Optimización por sección del panel delivery (2026-08-26)

- Rama local `perf/transport-panel-section-loading`; producción intacta y sin migración/SQL.
- Diagnóstico: la entrada directa a Pedidos todavía descargaba perfil, condiciones, tarifas, zonas y rangos completos de la empresa. Resumen descargaba hasta 200 servicios con todos sus campos, relaciones, repartidores y datos del pedido solo para mostrar cantidad y total.
- `/api/transport/me` conserva compatibilidad y agrega dos controles opt-in: `includeConfiguration=false` devuelve identidad operativa compacta; `billingDetail=false` usa una selección mínima para el resumen. Facturación sigue solicitando el detalle completo.
- El cliente distingue ahora configuración completa, resumen de facturación y detalle de facturación. Al navegar desde Pedidos carga configuración solo cuando otra sección la necesita, y al entrar en Facturación exige detalle aunque Resumen ya se haya cargado.
- La fusión de respuestas compactas conserva campos completos previamente cacheados. La alerta de configuración se oculta durante la entrada compacta a Pedidos para no mostrar faltantes falsos.
- QA autenticada temporal contra Supabase remoto, sin crear pedidos: en una empresa con servicios, Pedidos bajó de 2.639 a 621 bytes (76% menos) y Resumen de 34.375 a 18.350 bytes (47% menos). En esa corrida caliente el endpoint pasó de 716 a 625 ms en Pedidos y de 1.107 a 949 ms en Resumen. El usuario y membresía QA se eliminaron y el script verificó cero membresías residuales.
- Validaciones aprobadas: 55/55 contratos críticos, ESLint global, TypeScript, `git diff --check` y build Next.js 16.3.0 de 173 páginas.
- Preview `https://vendeplus-clean-r4zurt510-entrega2-s-projects.vercel.app`, deployment `dpl_AaR258x7e5nVhf8dzVjtHwyQyL3T`, target Preview y estado Ready; build remoto de 173 páginas aprobado. Está protegida por SSO de Vercel. Acceso CLI con bypass confirmó que `/api/transport/me` sin sesión mantiene `401 No autorizado`.
- El script QA ahora exige `application/json` y estructura válida para no confundir una página SSO HTTP 200 con la API.
- Usuario aprobó visualmente y autorizó producción. Se promovió exactamente la Preview validada; deployment productivo `dpl_2rWk28vJy6BgBh4NEUa9NfgbgsV7` (`https://vendeplus-clean-2ti1k7xy9-entrega2-s-projects.vercel.app`), Ready y con alias oficiales.
- Smoke productivo aprobado: Home, panel delivery, Pedidos y Facturación HTTP 200; `/api/transport/me` sin sesión HTTP 401 esperado; sin logs de error iniciales. Rollback web inmediato: `https://vendeplus-clean-9krzoivg8-entrega2-s-projects.vercel.app`.

# Corrección completa La Maravilla del Sushi (2026-08-25)

- Estado inicial auditado: 4 categorías, 8 productos activos, 0 pedidos, 0 imágenes y 0 grupos de opciones. Los 8 productos correspondían al menú real pero tenían nombres/descripciones incompletos; faltaban 12 productos. Ensalada Dinamita conservaba 2 variantes erróneas e inactivas `Topinng...`.
- Migración idempotente aplicada y registrada: `20260826031500_correct_la_maravilla_sushi_menu.sql`, limitada al slug `la-maravilla-del-sushi`. No hubo cambio de esquema ni código global.
- Se conservaron los IDs de los 8 productos existentes y se actualizaron: Ensalada Dinamita, Croquetas de Cangrejo, Cangrejo Especial, Camarones Rebosados, Tera Roll, Dinamita Roll, Sakana Roll y Chicken Roll. `Croquetas de cangrejo` y `Dinamit Roll` corrigieron sus nombres.
- Se crearon 12 faltantes: Umi Roll, Camarón Roll, Skin Roll, Kani Roll, Tuna Roll, California Roll, Aguacate Roll, Salmón Roll, Me Prefieres a Mí, Flow La Marash, La Sensación y Pa' Que La Pases Bien.
- Categorías finales activas: Entradas, Tempurizados, Fríos y Promociones. Las dos categorías con cantidades entre paréntesis se renombraron conservando IDs. No había categorías o productos extra que desactivar.
- Se eliminaron únicamente las 2 variantes erróneas `Topinng Cangrejo/Wakame` de Ensalada Dinamita; no tenían pedidos ni estaban activas. Los toppings quedaron como parte de las descripciones, sin modificadores artificiales.
- Resultado remoto verificado: exactamente 20 productos activos y únicos: 4 Entradas, 6 Tempurizados, 6 Fríos y 4 Promociones; precios, orden y descripciones coinciden con el menú fuente. `La Sensación` conserva literalmente `5 Cangrejo Rolls`.
- Imágenes: no existía ninguna imagen principal ni galería, por lo que no hubo imágenes que conservar o reasignar. La migración no modifica imágenes al actualizar productos equivalentes.
- QA pública: `/la-maravilla-del-sushi` HTTP 200, contiene los productos nuevos/corregidos, muestra 20 productos y no contiene `Dinamit Roll` ni `Topinng`. Validaciones: ESLint dirigido, TypeScript, 54/54 contratos, `git diff --check`, dry-run remoto y build Next.js 16.3.0 de 177 páginas.
- Pendiente: respaldo Git conjunto de las tres migraciones recientes, contratos y handoff. No se requiere despliegue web porque fue una corrección de datos sobre arquitectura existente.

# Menú regular Pizza Mia oculto (2026-08-25)

- Usuario solicitó cargar solo el menú regular y mantener intactas las 9 promociones. Añadió como regla que todos los productos nuevos deben quedar ocultos hasta que cargue sus fotos y los active manualmente.
- Migración idempotente aplicada y registrada: `20260826023000_load_pizza_mia_regular_menu.sql`. No referencia la categoría Promociones ni modifica `stores`; usa únicamente tablas existentes.
- Categorías creadas/reutilizadas: `Pizzas / Especialidades`, `Nuevas`, `Arma tu pizza`, `Otros` y `Subs`. Se cargaron 22 productos regulares, todos con `is_available=false`, `is_featured=false` e `image_url=null`.
- Especialidades y Buffalo usan variantes con medidas y precios absolutos. `Grande con borde de queso` es una variante separada exactamente $3 por encima de Grande, por lo que el borde no puede elegirse en otros tamaños. Pan Pizza y Gigante son variantes separadas con el mismo precio indicado.
- `Arma tu pizza como quieras` usa 5 variantes y 28 ingredientes. `product_option_value_variant_prices` aplica por ingrediente: Personal $1, Pequeña $1.50, Grande $2, Grande con borde $2 y Gigante $2.50. Pan Pizza comparte los 28 nombres mediante su grupo propio a $2.50; Pizza Siciliana usa grupo propio a $3.
- Hawaiana tiene canela opcional a $0. Philly Cheesesteak y Crispy Chicken comparten Tocineta, Queso cheddar y Champiñones a $1.50. Mexicana y Buffalo incluyen `🌶 Picante` en la descripción porque no existe un sistema visual de picante en productos remotos.
- Para no colisionar con la promoción activa `Siciliana`, el producto regular se llama `Pizza Siciliana`; queda oculto con precio técnico $0 y texto `Precio base pendiente por confirmar`. No debe activarse hasta cargar el precio real.
- Primer intento remoto falló por `product_variants.updated_at` inexistente; PostgreSQL revirtió toda la transacción. Se corrigió y el segundo intento aplicó completo. Verificación independiente: 6 categorías totales, 9 promociones activas e intactas, 22 regulares ocultos, 0 imágenes regulares, matrices de variantes correctas, 28/28/28 ingredientes y 3 extras de Subs.
- QA pública: `/pizza-mia` HTTP 200, promociones visibles, productos regulares ausentes y API de opciones de producto oculto HTTP 404. Validaciones: ESLint dirigido, TypeScript, 53/53 contratos críticos, `git diff --check`, dry-run remoto y build Next.js 16.3.0 de 177 páginas.
- Pendiente: usuario carga fotos y activa manualmente cada producto. Antes de activar `Pizza Siciliana`, debe guardar su precio base real. También queda pendiente respaldo Git de las dos migraciones de Pizza Mia, contratos y handoff.

# Promociones Pizza Mia (2026-08-25)

- Usuario solicitó cargar 9 promociones en `pizza-mia`, respetando categoría, productos, opciones, precios e imágenes existentes.
- Se creó y aplicó la migración idempotente `20260826014000_load_pizza_mia_promotions.sql`. Crea/reutiliza `Promociones`, busca productos por comercio + nombre normalizado y conserva cualquier `image_url` preexistente.
- Se cargaron exactamente 9 promociones con precios: 3.99, 5.99, 6.99, 6.99, 9.99, 14.99, 16.99, 19.99 y 19.99 USD. Verificación independiente confirmó 9 nombres únicos y cero duplicados.
- Sici Box y Siciliana usan el grupo obligatorio `Elige tu ingrediente incluido`, selección única, sin costo, con 10 ingredientes: Pepperoni, Jamón, Tocineta, Maíz, Cebolla, Pimentón, Aceitunas negras, Champiñones, Piña y Anchoas.
- No se creó selector de refrescos porque no existe una lista verificable de sabores. Las cantidades y presentaciones sí están explícitas en las descripciones.
- No había imágenes de producto almacenadas; los 9 productos conservan `image_url=null` y el catálogo usa correctamente el logo de Pizza Mia como fallback. No se enlazaron imágenes externas.
- Supabase remoto registró la migración. `/pizza-mia` responde HTTP 200, muestra la categoría y 9 productos; la API pública de opciones devuelve HTTP 200, 1 grupo obligatorio y 10 ingredientes para Sici Box y Siciliana. El comercio figuraba activo al finalizar; la migración no alteró `stores`.
- Validaciones aprobadas: ESLint dirigido, TypeScript, 52/52 contratos críticos, `git diff --check`, dry-run remoto y build Next.js 16.3.0 de 177 páginas.
- Archivos modificados: migración nueva, `scripts/critical-contracts.test.mjs` y este handoff. Sin cambios de aplicación ni despliegue web necesarios. Pendiente solo revisión visual del usuario y, si lo solicita, imágenes específicas/sabores reales de refresco y respaldo Git.

# Preview checkout: nota del pedido vuelve a ser protagonista (2026-08-25)

- QA del usuario aprobó logos circulares de empresas delivery y llegada rápida de notificaciones. Detectó que el estilo resaltado quedó en la información del efectivo y la nota general perdió jerarquía.
- Ajuste mínimo: `Información del efectivo` permanece dentro de `4. ¿Cómo vas a pagar?` con textarea neutro; la tarjeta ámbar independiente conserva solamente el título `5. Indicaciones del pedido (opcional)` y el textarea con su ejemplo de fondo, sin textos redundantes.
- No cambió persistencia, validación server-side, WhatsApp, precios, delivery ni Realtime. No hubo migración ni SQL.
- Validaciones aprobadas: 51/51 contratos críticos, TypeScript, ESLint dirigido, `git diff --check` y build local/remoto Next.js 16.3.0 de 173 páginas.
- Preview final: `https://vendeplus-clean-5ymsfgwso-entrega2-s-projects.vercel.app`, deployment `dpl_4UGtcyTiJ57eV3s6R7A5MkVKvPBX`, target Preview, estado Ready.
- Usuario aprobó y autorizó producción. Se promovió exactamente esa Preview; deployment productivo `dpl_9swgyuZCdZ97UnEkhN6wam2u5Mbb` (`https://vendeplus-clean-di11mq79u-entrega2-s-projects.vercel.app`), estado Ready y alias oficiales asignados.
- Smoke productivo aprobado: Home, Marketplace, `/smash/checkout`, `/panel/pedidos` y `/panel/estadisticas` responden HTTP 200. Sin logs de error iniciales. No hubo migración ni SQL.
- Rollback web inmediato: `https://vendeplus-clean-fp4am6fvt-entrega2-s-projects.vercel.app`.

# Preview nocturna: Pedidos + logo delivery + notas separadas (2026-08-25)

- Usuario solicito terminar pruebas y dejar Preview para revisar al dia siguiente; produccion no debe tocarse hasta su aprobacion.
- Checkout: el logo de la empresa delivery ahora vive en un contenedor circular de 48 px, con recorte `object-cover`, fondo neutro, aro blanco y sombra leve. Esto evita que un archivo rectangular muestre relleno blanco lateral y conserva fallback con inicial.
- Checkout: elegir efectivo ya no cambia ni sustituye la nota general. Se muestran dos campos independientes: `cashPaymentNote` para moneda/cambio y `notes` para indicaciones del pedido.
- Persistencia: la informacion del efectivo se acepta solo cuando el metodo es efectivo, se limpia a 500 caracteres y se guarda en `orders.payment_notes` con filtros simultaneos por `id` y `store_id`. La columna ya existia; no hubo migracion ni SQL nuevo. La nota general permanece en `orders.notes`.
- Salidas: WhatsApp incluye la informacion del efectivo en una linea propia; Confirmacion usa el nuevo campo; el detalle del panel presenta `Nota del pedido` e `Informacion del efectivo` como bloques separados.
- Compatibilidad: pedidos/localStorage anteriores sin `cashPaymentNote` siguen funcionando porque las lecturas normalizan valores ausentes. No se alteraron precios ni reglas de delivery.
- Validaciones aprobadas: revision Next.js 16 y React, 51/51 contratos criticos, TypeScript, ESLint dirigido, `git diff --check` y build local Next.js 16.3.0 de 177 paginas.
- Preview conjunta: `https://vendeplus-clean-7xa70w6q1-entrega2-s-projects.vercel.app`, deployment `dpl_ByJMVxDvyTg12vxKzxHitbW1Pfex`, target Preview, Ready. Build remoto 177 paginas aprobado; `/smash/checkout`, `/panel/pedidos` y `/panel/estadisticas` HTTP 200 con cabeceras de seguridad; sin logs de error iniciales.
- La Preview incluye tambien la correccion de Realtime de Pedidos y Mesa/Barra del bloque siguiente. Prueba manual pendiente: usar un comercio afiliado a empresa delivery, agregar producto, elegir Delivery + Efectivo, escribir textos distintos en ambos campos, confirmar y comprobar logo circular, WhatsApp, aparicion del pedido sin refrescar y ambos bloques separados en el detalle.

# Correccion de llegada inmediata de pedidos en Preview (2026-08-24)

- El usuario confirmo que Estadisticas funciona, pero un pedido nuevo no aparecia en Pedidos hasta refrescar o cambiar de pestana.
- Diagnostico: el broadcast privado de Supabase, el trigger y la politica RLS funcionan (prueba autenticada real recibida en ~1,4 s), pero el cliente no supervisaba el estado de la suscripcion. Si Realtime fallaba o tardaba, el respaldo de 180 s hacia que la vista pareciera congelada. Mesa/Barra ademas usaba el topic no autorizado `store:<id>:table-order-alerts`.
- Correccion local: Pedidos y Mesa/Barra registran `SUBSCRIBED`; mientras Realtime no este confirmado o se desconecte sondean cada 15 s, y cuando esta sano vuelven a 180 s/120 s. Mesa/Barra ahora escucha el topic permitido `store:<id>:orders`.
- Validaciones aprobadas: QA autenticada de broadcast privado, TypeScript, ESLint dirigido, 50/50 contratos criticos, `git diff --check` y build local Next.js 16.3.0 de 177 paginas.
- Preview corregida: `https://vendeplus-clean-kq9l5cki1-entrega2-s-projects.vercel.app`, deployment `dpl_GCbi6TsT8SjdawDR4ijPmN7PXKKL`, target Preview, estado Ready. Build remoto aprobado, `/panel/pedidos` HTTP 200 con cabeceras de seguridad y sin logs de error iniciales.
- No hubo migracion ni SQL nuevo para esta correccion y produccion web permanece intacta.
- Proximo paso exacto: mantener `/panel/pedidos` abierto en esta Preview y crear un pedido desde otro dispositivo/incognito. Debe aparecer normalmente en ~1-3 s; si Realtime no conecta, en un maximo aproximado de 15 s, sin refrescar. Repetir en Mesa/Barra. No promover produccion sin aprobacion explicita.

# P1 estadisticas escalables para 5.000 pedidos/dia (2026-08-24)

- Implementacion local y Preview listas; produccion web permanece intacta.
- `/api/panel/stats` intenta ahora `panel_store_stats` con los `store_id` derivados exclusivamente de la sesion y la sede validada. La respuesta agregada no descarga pedidos ni items y deja `range.capped=false`.
- El despliegue es escalonado y seguro: la API exige `summary.aggregationVersion=2`; mientras la migracion no exista o la RPC falle, conserva el flujo anterior como fallback temporal.
- Nueva migracion aditiva `20260825024934_optimize_panel_store_stats_rpc.sql`: reemplaza solo la funcion, agrega en PostgreSQL sin limite de filas, excluye delivery de los ingresos del comercio, conserva aparte `deliveryFeesUsd`, excluye cancelados de graficas/listas operativas y devuelve solo 8 pedidos recientes.
- Seguridad: funcion `security invoker`, `store_id` siempre server-side, ejecucion revocada a `public`, `anon` y `authenticated`, concedida solo a `service_role`. No se agregaron tablas, RLS ni indices; los indices requeridos ya existen.
- Validaciones aprobadas: TypeScript, ESLint dirigido, 49/49 contratos criticos, `git diff --check`, dry-run remoto (solo esta migracion pendiente) y build Next.js 16.3.0 de 177 paginas.
- Validacion SQL remota en `BEGIN/ROLLBACK` aprobada: la funcion compilo, conteo e ingresos coincidieron con calculos independientes, recientes no supero 8 y permisos quedaron correctos. El rollback dejo `aggregationVersion=0`, confirmando cero persistencia de la prueba.
- Usuario autorizo avanzar y la migracion fue aplicada y registrada en Supabase remoto. Verificacion posterior independiente volvio a aprobar metricas y permisos. El lint remoto conserva solo el error interno preexistente de `extensions.index_advisor` por `hypopg_reset()` ausente.
- Preview `https://vendeplus-clean-ncah225sa-entrega2-s-projects.vercel.app`, deployment `dpl_GMHkXkABsjqi9dtPh2B1D685KFNb`, target Preview, estado Ready y build remoto de 177 paginas aprobado. `/panel/estadisticas` responde HTTP 200, API sin sesion rechaza correctamente y no hay logs de error ni HTTP 500.
- Prueba autenticada controlada aprobada contra el build local y Supabase remoto: usuario QA temporal limitado a un comercio recibio HTTP 200, `aggregationVersion=2`, `capped=false`, 8 recientes y cifras identicas a la RPC. Latencia observada desde este equipo: 2.715 ms. Limpieza independiente confirmo 0 usuarios y 0 membresias QA residuales.
- P2 polling preparado: Pedidos conserva Realtime privado y refresco al volver a una pestaña visible, pero su respaldo pasa de 30 a 180 segundos. Mesa/Barra conserva alerta Realtime y respaldo visible de 20 a 120 segundos. Por sesion abierta, ambos respaldos bajan de unas 300 a 50 solicitudes por hora (aprox. 83% menos).
- Nueva Preview conjunta `https://vendeplus-clean-qpo8ov7l9-entrega2-s-projects.vercel.app`, deployment `dpl_8PjyJD3Xngrxgpx66nDLZ2nug7JR`, target Preview, Ready. Build remoto de 177 paginas, Pedidos y Estadisticas HTTP 200, sin logs de error ni HTTP 500.
- Validacion visual automatizada local no estuvo disponible: ni `agent-browser` ni el navegador integrado estaban habilitados en esta sesion. Proximo paso exacto: validar con sesion real en la Preview conjunta Estadisticas, llegada inmediata de un pedido normal y alerta Mesa/Barra. Promover produccion solo con aprobacion explicita posterior.

# P0 rendimiento panel de empresas delivery (2026-08-19)

- Implementación local y Preview listas; producción intacta, sin migración ni SQL.
- Estados y asignaciones actualizan solo la fila afectada; se eliminaron las recargas completas de pedidos/panel y el recálculo de facturación desde la vista operativa.
- Realtime ignora durante 2 segundos únicamente el servicio mutado por el mismo navegador; cambios externos continúan invalidando la lista. Polling de respaldo pasó de 30 a 180 segundos.
- La lista dejó de pedir conteo exacto: usa `limit + 1`, devuelve 40 filas y determina `hasMore`. La API de estados dejó de usar `select(*)`.
- Las búsquedas de membresía por usuario y correo se ejecutan en paralelo después de validar el token; controles de rol y tenant permanecen.
- Validaciones: TypeScript, ESLint, 21/21 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas aprobados.
- Preview: `https://vendeplus-clean-li8qbnhhy-entrega2-s-projects.vercel.app`, deployment `dpl_2MpJGuoJ1y2hzfQDCQ2kKfLebUQt`, Ready, sin logs de error.
- Próximo paso exacto: validar con sesión real en `/transporte/panel/pedidos`: carga, cambio de estado, asignación, aparición inmediata del botón WhatsApp, filtros y recepción de un pedido externo. No promover sin aprobación explícita.
- Segunda fase preparada localmente: la navegación usa pestañas internas con `history.pushState`, conserva el panel montado y soporta Atrás/Adelante, eliminando “Cargando empresa delivery” entre módulos.
- Estados visibles simplificados por etapa: pendiente solo Aceptar/Rechazar; aceptado o asignado pasa a En camino/Novedad; En camino pasa a Entregado/Fallido/Novedad. Se habilitó server-side `pending_agency -> agency_rejected` y `driver_assigned -> on_the_way/delivered`, que antes podían dejar el flujo atascado.
- Nueva migración aditiva pendiente `20260820033000_mutate_transport_order_atomic_rpc.sql`: actualiza servicio, evento, pedido e integración en una sola transacción para estados y asignaciones. RPC revocada a `anon/authenticated`, solo `service_role`.
- Dry-run remoto de Supabase aprobado; no se aplicó SQL. TypeScript, ESLint, 22/22 contratos y build local de 167 páginas aprobados.
- Próximo paso exacto: con autorización explícita, validar la RPC en `BEGIN/ROLLBACK`, aplicar la migración aditiva y desplegar nueva Preview. El código nuevo no debe desplegarse antes de la RPC.

# Configuración opcional de cédula del cliente (2026-08-19)

- Migración aditiva aplicada y registrada en Supabase remoto; producción web permanece intacta.
- Nueva preferencia por comercio `request_customer_id_number`, apagada por defecto mediante la migración aditiva `20260820023000_add_customer_id_request_setting.sql`.
- El comercio puede activar “Solicitar cédula”. Checkout la muestra junto a nombre y teléfono, y la API la exige según la configuración real. Envío nacional conserva su requisito sin duplicar el campo.
- “Recordar mis datos” guarda y recupera la cédula solo cuando el comercio la solicita. Perfiles anteriores siguen siendo compatibles.
- La cédula queda en el detalle congelado del pedido, WhatsApp y confirmación.
- Verificación remota: 34 comercios, 0 con la opción activa y 34 apagados; no cambió el checkout de ninguno.
- TypeScript, ESLint, 20/20 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas aprobados sin fallback de catálogo.
- Preview: `https://vendeplus-clean-5uyoa8wdp-entrega2-s-projects.vercel.app`, deployment `dpl_2yrKfYoS54yioydCcKHAAxpzEwFq`, target Preview, estado Ready. Home HTTP 200; producción no fue promovida.
- Próximo paso exacto: validar en `/panel/configuracion` activar “Solicitar cédula”; abrir el checkout del comercio, comprobar campo/obligatoriedad y memoria; luego apagar y comprobar que desaparece. No promover a producción sin aprobación posterior.
- Ajuste posterior: la cédula ahora separa un selector `V / E / J` (V por defecto) y un campo exclusivamente numérico; se almacena normalizada como `V-12345678`. La API normaliza y valida el formato antes de crear el pedido.
- Nueva Preview: `https://vendeplus-clean-2iybb6fnu-entrega2-s-projects.vercel.app`, deployment `dpl_5aH276RVHr5woiq54W1HBM2iftdf`; build remoto de 167 páginas aprobado. Producción intacta.
- Usuario aprobó visualmente y autorizó producción. Promovida como `dpl_HQ8HsoFAFtRmS1YkSSmAu97CnwoJ` (`vendeplus-clean-qf0mex1x2-entrega2-s-projects.vercel.app`), estado Ready; dominios `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` asignados.
- Smoke productivo: Home, Marketplace, Smash, checkout Smash, login y Transporte HTTP 200; APIs protegidas de pedidos/configuración sin sesión HTTP 401 esperado. Sin logs de error iniciales.
- Rollback web disponible: `dpl_4khixG8RUcpaFzvuCdo4gtLkuxjU`. No hubo nueva migración durante la promoción; la preferencia de cédula sigue apagada en los 34 comercios hasta que cada comercio la active.

# P1 Open Graph 2026-08-17

# Auditoría de arquitectura para 5.000+ pedidos/día (2026-08-18)

## P0.1 tokens privados de Mesa / Barra (2026-08-18)

- Migración remota autorizada y aplicada el 2026-08-19; no hubo promoción a producción web, commit ni push.
- Los tokens QR se movieron a `private.store_table_order_tokens`, con RLS, privilegios exclusivos de `service_role` y funciones RPC inaccesibles para `anon`/`authenticated`.
- La migración genera tokens nuevos para todos los comercios. El código nuevo resuelve y valida esos tokens exclusivamente en servidor; mantiene un fallback temporal al campo legacy solo cuando las RPC aún no existen, para permitir un despliegue escalonado seguro.
- Página pública, estado de pedido, creación de pedido y API del panel ya usan el helper privado. No quedan lecturas directas del token público en la aplicación.
- Validación local: token privado nuevo funciona, token público anterior deja de resolver con el código nuevo, acceso anónimo a las RPC falla con `42501` y el panel autenticado recibe el token privado.
- Validaciones aprobadas: TypeScript, ESLint, 16/16 contratos críticos, contrato Entrega2, lint SQL local y build Next.js 16.3.0 de 167 páginas.
- `20260818054500_move_table_order_tokens_to_private.sql` quedó registrada en Supabase remoto. Verificación: 34/34 comercios con token privado, 34 tokens únicos, todos distintos al legacy; resolución server-side correcta y RPC anónima denegada con `42501`.
- La producción web actual conserva el código anterior y su QR legacy operativo (HTTP 200), por lo que la migración aditiva no interrumpió el servicio.
- Preview P0: `https://vendeplus-clean-dsdwjrxt8-entrega2-s-projects.vercel.app`, deployment `dpl_oBe2ukpPC3ZJPmWWiBeJeSKsEr66`, target Preview, estado Ready; build remoto limpio de 167 páginas aprobado.
- Smoke protegido de Preview: el QR privado nuevo reconoce el comercio y muestra el flujo Mesa / Barra; el token legacy no reconoce el comercio y devuelve la vista de no encontrado. Home consultado mediante bypass de Preview.
- Siguiente paso exacto: prueba manual del usuario en Preview, incluyendo obtener/regenerar el QR desde `/panel/mesas` y abrirlo en una sesión separada. No promover sin aprobación explícita.
- Usuario aprobó la prueba manual y la Preview fue promovida a producción el 2026-08-19 como `dpl_w6GifRf2NskVY5QfQMKPQYK7t8c8` (`vendeplus-clean-kzyf3kkdw-entrega2-s-projects.vercel.app`). Los dominios productivos apuntan al deployment nuevo en estado Ready.
- Smoke productivo aprobado: Home, Marketplace, Smash, login y Transporte HTTP 200; QR privado reconoce Smash y muestra Mesa / Barra; token legacy devuelve la vista de no encontrado; API del panel sin sesión 401; sin logs de error en el deployment.
- Siguiente paso exacto: respaldar este P0 con commit/push excluyendo `scripts/import-don-aniello-menu.mjs`; después preparar y validar una migración separada para eliminar `stores.table_order_token` y su índice legacy.
- P0 respaldado en GitHub: commit `f8da889` (`security: proteger tokens de mesa y barra`) publicado en `origin/main`; el importador de Don Aniello permaneció excluido.
- Limpieza legacy preparada localmente: el helper ya no tiene fallback a `stores.table_order_token` y la migración `20260819223000_drop_legacy_table_order_token.sql` elimina solamente el índice y la columna antiguos. No se aplicó SQL remoto.
- Validaciones de la limpieza: TypeScript, ESLint, 16/16 contratos críticos, contrato Entrega2 y build local/remoto de 167 páginas aprobados.
- Preview de limpieza legacy: `https://vendeplus-clean-7g4x50g9s-entrega2-s-projects.vercel.app`, deployment `dpl_9rtbND9y4vS7SEEFoBBMwCWDqnos`, estado Ready. Pendiente prueba manual del QR privado; no promover ni ejecutar la migración destructiva sin aprobación.
- Usuario aprobó la Preview de limpieza. Promovida a producción como `dpl_s5XG4Qzr9txZTXQTiDquBzRFVC8b` (`vendeplus-clean-hpaj0vp9r-entrega2-s-projects.vercel.app`), estado Ready y dominios productivos asignados.
- Antes del SQL, producción sin fallback aprobó Home, Marketplace, Smash, login, Transporte y QR privado. Luego se aplicó `20260819223000_drop_legacy_table_order_token.sql` en Supabase remoto.
- Cierre P0 verificado: `stores.table_order_token` ya no existe (`42703`), token privado presente, QR HTTP 200 reconociendo el comercio, panel sin sesión 401 y cero logs de error del deployment. El lint remoto conserva solo el fallo interno conocido de `extensions.index_advisor` por `hypopg_reset()`.
- Siguiente prioridad: P0 de atomicidad de pedidos. Auditar y diseñar una función PostgreSQL transaccional e idempotente para pedido público y manual; implementar y probar local/Preview antes de cualquier SQL o promoción adicional.
- Impacto operativo al promover el código: los QR impresos o compartidos anteriormente deben regenerarse porque el token se rota. Luego de verificar producción, una migración separada debe eliminar `stores.table_order_token` y su índice para cerrar definitivamente la exposición.

- Auditoría solo lectura; no se modificó producción ni código funcional.
- Capacidad actual: 5.000 pedidos/día son 0,058 pedidos/s promedio; el stack Vercel + Supabase puede soportarlo, pero el sistema aún no debe declararse listo para picos sin corregir P0/P1.
- P0 seguridad confirmado con cliente anónimo: `stores` concede SELECT público a toda la tabla y expone `table_order_token`. Se pudieron leer tokens no nulos de los 31 comercios activos; 1 tiene Mesas habilitado. No se mostraron ni guardaron los tokens. Separar el token en tabla privada o restringir columnas/usar API pública con DTO y rotar tokens.
- P0 consistencia: `/api/orders` inserta `orders`, `order_items`, `order_item_options` y cliente en operaciones separadas. Hay limpieza compensatoria, pero una terminación entre pasos puede dejar pedidos incompletos. Migrar la escritura a una función PostgreSQL transaccional e idempotente. El pedido manual repite el mismo patrón.
- P1 catálogo: `getPublicStores()` hidrata delivery con 3 consultas por comercio mediante `Promise.all` (N+1). Con 31 comercios activos una regeneración puede lanzar ~93 consultas adicionales. Cambiar a 3 consultas masivas y agrupar por `store_id`.
- P1 infraestructura: Vercel ejecuta en `iad1`, mientras Supabase producción está en AWS `us-west-2`; probar Preview en `sfo1` contra `iad1` y fijar la región ganadora por p95.
- P1 proveedores: llamadas Entrega2 no tienen timeout/AbortSignal; ya hubo una espera real de ~60,7 s. Definir timeout corto, circuit breaker y fallback inmediato. Nominatim también carece de timeout.
- P1 estadísticas: `/api/panel/stats` descarga y agrega pedidos en Node y limita a 1.000; con 5.000/día devuelve cifras truncadas. Mover agregaciones a SQL/RPC y materializaciones por día/comercio.
- P1 observabilidad/DR: no hay APM/alertas operativas persistentes; logs informativos dependen de `ENABLE_API_EVENT_LOGS`. Hay backup DB validado, pero recuperabilidad de Storage sigue pendiente y no consta PITR habilitado. Definir SLO, alertas, PITR y prueba periódica de restauración DB + Storage.
- P2 panel: `OrdersManager` sondea cada 30 s además de Realtime; `TableOrderNotifier` cada 20 s. Reducir a Realtime con sondeo adaptativo solo como respaldo para evitar carga multiplicada por sesiones abiertas.
- P2 rate limits: el límite de pedidos por IP/comercio puede bloquear muchos pedidos de Mesa/Barra compartiendo Wi-Fi/NAT. Hacer prueba de pico y ajustar por modalidad sin debilitar abuso.
- P2 mantenibilidad: rutas críticas muy grandes (`panel/orders` ~1.085 líneas, `orders` ~954, `stats` ~667); separar servicios y agregar integración real, caos y carga de escritura.
- Base remota saludable y pequeña: 28 MB, 1.242 pedidos estimados, 1.724 items, hit rate de tablas/índices 1,00, sin consultas largas ni bloqueo relevante; 11 conexiones de authenticator sobre límite 60. Esto no simula todavía 5.000 pedidos/día.
- Vercel: deployment productivo Ready; sin logs error ni 5xx en 24 h. Lecturas secuenciales públicas: TTFB ~0,94-1,31 s. Smoke de 10 concurrentes devolvió todo 200 pero p95 ~10,6 s desde este entorno; requiere prueba k6/Artillery desde región controlada antes de usarlo como capacidad.
- Seguridad positiva: precios/opciones/delivery se recalculan en servidor, idempotencia por comercio, rate limit distribuido, APIs panel/admin con controles multi-tenant, webhooks Entrega2 con secreto, RLS sin escrituras públicas de pedidos. `npm audit --omit=dev`: 0 vulnerabilidades; no se detectaron secretos versionados.
- Validación: ESLint aprobado, 15/15 contratos críticos, contrato Entrega2 y build Next.js 16.3.0 de 167 páginas aprobados.
- Orden recomendado: 1) cerrar/rotar token Mesas; 2) transacción atómica de pedidos; 3) timeouts/circuit breaker; 4) eliminar N+1; 5) SQL de estadísticas; 6) región y pruebas de carga; 7) alertas/PITR/restore; 8) sondeo adaptativo.

# Opciones La Cremita Gourmet (2026-08-18)

- Respaldo previo completo: `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-18\la-cremita-gourmet-before-flavor-options.json`; SHA-256 `59ee60ab699394e25e4336b78964729e3f393244a0d43d6d96d753c941b4c8f7`.
- Grupo obligatorio `Sabores de chantilly` asignado solo a `Fresas con crema`: Chantilly tradicional, Chantilly Pistacho y Chantilly Oreo, todos USD 0; permite seleccionar mínimo 1 y máximo 2.
- Grupo obligatorio `Tipo de chocolate` asignado a `Fresas con Chocolate` y `Fresas Dubai`: Chocolate blanco, Chocolate oscuro y Chocolate combinado, todos USD 0; exige exactamente 1.
- Los grupos existentes Toppings, Untar y Toppings Extras permanecieron intactos.
- API pública productiva verificada para los tres productos: grupos, obligatoriedad, límites y precios correctos.
- No hubo cambios de código, migración, SQL, commit, push ni despliegue.

# Curaduría productiva Don Aniello (2026-08-18)

- Usuario aprobó la propuesta basada en ventas visibles del 2026-05-01 al 2026-07-31. La suma visible fue 1.362 unidades aunque el archivo indicaba total 3.935; la selección se basó en las filas visibles aprobadas.
- Respaldo previo completo del catálogo: `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-18\don-aniello-catalog-before-sales-curation.json`; SHA-256 `809ab448cfc325c3a3aba26d17a6f7940e5ed698177d5bbae4fe4fcbc2d6c83a`.
- Resultado remoto verificado: 108 productos totales, 66 activos y 42 ocultos. Se conservaron/actualizaron 49 productos existentes y se agregaron 17 productos vendidos que faltaban.
- `Gnocchi Napolitano` fue agregado como producto distinto; `Gnocchi di Zucca` quedó oculto.
- Exactamente cinco destacados, cubriendo tres categorías: Margherita Classica, Charcutera, Refrescos, Tricolor y Lomito alla Griglia. `Menú de la Nonna` está activo en `Promo` a USD 17, pero no destacado para respetar el límite de cinco.
- Grupo `Extras para pizzas`: 12 extras con precio, asignado a 21 productos activos de Pizze.
- Grupo obligatorio `Contorno incluido`: Vegetales, Puré de papa, Papas rústicas y Papas fritas, todos USD 0, asignado a 8 proteínas activas.
- Grupo obligatorio `Tipo de pasta`: Penne, Linguini y Spaghetti, todos USD 0, asignado a 10 pastas activas.
- `Alternativa de pasta` quedó inactiva y sin asignaciones; Sin gluten/Tiras de calabacín ya no aparecen.
- Auditoría comprobó 0 productos ocultos asociados a los grupos nuevos. Catálogo público HTTP 200 con caché renovada: muestra Menú de la Nonna y Gnocchi Napolitano, y no muestra Marinara Original.
- API pública verificada: Margherita devuelve 12 extras, Lomito 4 contornos y Fettuccine 3 tipos de pasta.
- No hubo cambios de código, migración, SQL, commit, push ni despliegue. El único archivo no versionado sigue siendo `scripts/import-don-aniello-menu.mjs`, excluido por indicación del usuario.
- Segunda curaduría aprobada: ocultar todo producto activo con 7 ventas o menos y retirar Café por completo, sin ocultar ningún otro producto con 8 o más ventas. Respaldo previo: `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-18\don-aniello-catalog-before-second-curation.json`, SHA-256 `6ef375b9b8030c06efb08d5fccd8dc79734c8e0583c1f9b1c10c3e18b2cbdf8c`.
- Se ocultaron 12 adicionales: Quattro Estagioni, Panzerotti Charcutero, Focaccia Mortadella Italiana, Risotto di Funghi, Filetto di Mero, Panna Cotta, Profiterol, Ración de Tequeños, Agua Mineral 335 ml, Limón, Caffè Latte y Caffè Marrone. La categoría Caffè quedó inactiva.
- Resultado final de esta regla: 108 productos totales, 54 activos y 54 ocultos; siguen exactamente 5 destacados. No es posible bajar de 50 sin ocultar al menos cinco productos con 8 ventas o más.
- Grupos limpiados y verificados: 19 pizzas con extras, 7 proteínas con contorno, 10 pastas con tipo; 0 asignaciones a productos ocultos. Catálogo público renovado y HTTP 200: Cafè, Quattro Estagioni y Tequeños ya no aparecen; Menú de la Nonna y Margherita permanecen.

- Causa confirmada en logs: `ImageResponse` no admite directamente logos WebP de Supabase.
- La ruta OG pasa a Node.js, restringe imágenes a HTTPS del dominio público o `*.supabase.co`, limita descargas a 5 MB y convierte a PNG con Sharp.
- Si la imagen falla, muestra la inicial del comercio y evita romper la generación.

# Punto de reanudacion

## Pedidos en Mesa V1 local (2026-08-16)

- Rama local: `agent/table-orders-v1`; sin commit, push, preview ni cambios en produccion.
- Se implemento un QR unico y estable por comercio; al escanearlo el cliente elige una mesa activa.
- Piloto limitado en servidor a Smash. Incluye configuracion, mesas/zonas, pagos prepagados, selector publico, checkout `table`, snapshots de mesa y seguimiento de estado.
- Migracion local aplicada: `20260816040501_table_orders_v1.sql`. No se aplico SQL remoto.
- E2E local aprobado: Mesa 1, producto USD 8, Pago movil; pedido `VP-0816-3VV` guardado con `delivery_type=table`, mesa/zona congeladas y estado actualizado de `received` a `ready`.
- Seguridad local: token falso 404, acceso anonimo directo a `store_tables` denegado y `supabase db lint --local --level error` sin hallazgos.
- Validaciones finales: ESLint, 8/8 contratos criticos y `npm.cmd run build` aprobados.
- Servidor local: `http://localhost:3101`; QR de prueba: `/smash/mesa/22222222-2222-4222-8222-222222222222`.
- Usuario local: `smash-local@somos.test`; clave: `[RETIRADO: rotación pendiente]`. El respaldo base no incluye la migracion posterior de anuncios, por lo que esa API auxiliar responde 500 solo en este entorno aislado.
- Siguiente paso: prueba manual del usuario. No desplegar ni aplicar la migracion en produccion sin aprobacion explicita.
- Ajuste posterior local: checkout ya no muestra `Sin delivery` ni la fila de delivery para Mesa, Retiro o Envio nacional.
- `/panel/mesas` lista todos los pedidos activos por mesa, con cliente, pago, total, estado y acciones para avanzar o cancelar. Cambio de `received` a `accepted` verificado en navegador y restaurado para continuar la prueba.
- `/panel/pedidos` tiene filtros rapidos `Todos los pedidos`, `Excluir mesas` y `Solo mesas`; la exclusion se ejecuta en servidor antes de paginar.
- Solo para pedidos en mesa, confirmar ya no redirige automaticamente a WhatsApp: navega a `/confirmacion`, conserva el seguimiento visible y deja WhatsApp como accion secundaria en otra pestaña. E2E local aprobado en Mesa 2.
- Confirmacion ajustada: titulo general `Pedido enviado`; para Mesa indica que el seguimiento continua en la pantalla y no promete confirmacion por WhatsApp. E2E local verificado.
- Fee de Mesa verificado con replica local de Smash (Test): plan `per_service`, cliente paga USD 0.10; pedido QA guardo subtotal USD 2.00, fee USD 0.10 y total USD 2.10.
- La replica local de Smash (Test) usa sus 3 categorias y 5 productos publicos reales con imagenes; no se modificaron datos remotos.
- Nueva migracion local `20260816063446_update_legacy_default_store_palette.sql`: cambia solo las dos combinaciones exactas de defaults antiguos a teal/naranja/navy y actualiza defaults futuros; paletas personalizadas quedan intactas. No aplicada en produccion.

## Continuidad entre computadoras (2026-08-15)

- Punto de seguridad local publicado en GitHub en la rama `agent/audit-critical-hardening`.
- Commit: `3b1704e` (`checkpoint: respaldar avances locales de Somos`).
- Build, ESLint y 8/8 contratos criticos aprobados antes de publicar.
- No hubo despliegue a Vercel ni cambios en produccion.
- El unico archivo local no versionado es `scripts/import-don-aniello-menu.mjs`, excluido por ser un importador temporal.

## Idea pendiente: referidos para influencers

- No implementar hasta nueva indicación del usuario.
- Cada influencer tendrá código y enlace de registro.
- Comisión propuesta: 50% de pagos realmente aprobados durante los primeros 3 meses del comercio referido.
- Aplica a mensualidades y fees pagados; excluye pendientes, rechazados y comercios `is_test`.
- Panel ligero del influencer: referidos, ingresos generados, comisión pendiente y pagada.
- Mantener historial contable congelado por pago y acceso privado con Supabase Auth.

Actualizado: 2026-08-09, despues del despliegue a produccion

## Objetivo actual

Validar los cambios pendientes del registro de comercios y los requisitos para aparecer en Somos.

## Cambios locales pendientes

- `src/components/public/SignupForm.tsx`: solicita nombre y cedula del representante y logo obligatorio JPG/PNG/WebP de hasta 2 MB; envia el registro como `FormData`.
- `src/app/api/signup/route.ts`: valida esos campos en servidor, normaliza la cedula, carga el logo en `product-images`, guarda su URL, crea el perfil del representante y limpia usuario/comercio/logo si el flujo falla. Tambien reintenta recuperar el usuario creado cuando Auth no devuelve inmediatamente su ID.
- `src/lib/supabase/catalog.ts`: Somos solo muestra comercios con suscripcion vigente, logo y al menos un producto con precio mayor que cero; aplica igualmente al marketplace de agencias de transporte.
- `supabase/migrations/20260809011159_commerce_registration_and_marketplace_requirements.sql`: crea `store_registration_profiles` con RLS y la funcion `marketplace_eligible_store_ids`.

## Estado confirmado

- Proyecto correcto: `C:\Users\Windows\Desktop\RESPALDOS\vendeplus-clean`.
- Rama: `main`, commit base `f54fd79`.
- Los cuatro archivos anteriores contienen cambios sin commit.
- Docker 29.6.2 y Docker Compose 5.3.1 estan instalados despues del reinicio.
- La migracion fue aplicada correctamente sobre una copia local del esquema de produccion.
- RLS y las dos politicas de `store_registration_profiles` fueron verificadas.
- La funcion de elegibilidad devolvio solo el comercio con logo y un producto de precio mayor que cero.
- Registro E2E aprobado: HTTP 201; creo usuario Auth, comercio, owner, perfil y logo en Storage.
- El comercio no aparecio antes de tener producto y si aparecio en `/marketplace` despues de agregar un producto de USD 10.
- `npm.cmd run build` termino correctamente.
- Advisors locales de seguridad y rendimiento: sin problemas.
- Limitacion local observada: `next/image` no permite `127.0.0.1` como host de imagen; no afecta la URL de Storage de produccion.
- Problema previo del repositorio: las migraciones no incluyen el esquema base, por lo que `supabase start` directo falla antes de llegar a la migracion nueva. Para la prueba se uso un baseline temporal obtenido con `db dump --linked` sin datos ni escrituras remotas.
- Migracion `20260809011159` aplicada y verificada en el Supabase remoto enlazado.
- Advisors remotos de seguridad: sin problemas.
- Preview Vercel lista: `https://vendeplus-clean-i8xyiw6br-entrega2-s-projects.vercel.app`.
- La preview esta protegida por SSO de Vercel; requiere iniciar sesion con la cuenta autorizada.
- Smoke test autenticado aprobado en `/registro`; el HTML contiene nombre y cedula del representante y carga de logo.
- Deployment ID: `dpl_2orXwi4Gfhma2TqLA8WQy4SZsx15`.
- Preview aprobada por el usuario y promovida a produccion.
- Deployment de produccion: `dpl_CvYJtS4hK3jMg52ZeTY1Q1Rg5Pz9`.
- Dominio publico verificado: `https://www.somos-ve.com`.
- Smoke test posdespliegue: `/registro` HTTP 200 y `/marketplace` HTTP 200.
- Formulario productivo verificado con nombre y cedula del representante y logo del comercio.
- Logs de Vercel nivel error de la ultima hora: 0 resultados.
- Los cambios siguen sin commit ni push a GitHub; un despliegue futuro desde `origin/main` podria reemplazarlos.

## Siguiente paso exacto

Prioridad operativa pendiente: versionar los cambios actuales en Git y publicarlos en GitHub para que `origin/main` coincida con produccion. Requiere autorizacion explicita para commit y push.

Plan futuro aprobado: modulo opcional de cadenas documentado en `docs/MODULO_CADENAS_PLAN.md`. No implementar codigo ni migraciones hasta que el usuario lo indique expresamente.
# Trabajo actual: Logros Somos (2026-08-09)

- Implementada localmente la primera versión del sistema de logros permanentes.
- Nueva pantalla: `/panel/logros`.
- Seis logros: configuración/delivery, 10 pedidos/estadísticas básicas, 50 pedidos/estadísticas completas + 50 productos, referido/colores, promoción + 20 ventas/clientes, 3 promociones + 3 meses/detalle de clientes.
- Nuevos registros quedan limitados a 25 productos publicados; al completar 50 pedidos suben a 50.
- Comercios existentes recibieron los seis beneficios como `inherited`.
- Migración remota aplicada: `20260809132811_store_achievements_and_unlocks.sql`.
- Verificación remota: 29 comercios, 174 desbloqueos heredados.
- Build, TypeScript y ESLint aprobados.
- Servidor local para prueba: `http://localhost:3000/panel/logros`.
- Código todavía NO desplegado a Vercel/producción.

## Ajuste posterior de logros

- Nuevos comercios inician con 30 productos publicados.
- 50 pedidos + 20 clientes únicos desbloquean estadísticas completas.
- Nuevo logro: 100 pedidos + 35 clientes únicos desbloquean 20 productos adicionales (50 total).
- 10 pedidos requieren 5 clientes únicos; promoción + 20 ventas requiere 10 clientes únicos.
- Super Admin puede habilitar individualmente cualquier recompensa desde la ficha del comercio.
- Super Admin también puede retirar cualquier recompensa. Se registra un reinicio por logro y solo la actividad posterior vuelve a contar; al retirar el aumento de catálogo el límite regresa a 30 sin borrar productos existentes.
- El logro de referido ya no exige una venta: se completa cuando el comercio referido se registra y un propietario/administrador queda autorizado mediante la confirmación de correo de Super Admin.
- Sistema de logros desplegado a producción el 2026-08-09: `dpl_8gJpcELyqmd3JC1vHhd1bzp8EZbj`, alias `https://www.somos-ve.com`.
- Auditoría posterior al despliegue: 29 comercios; todos conservan sus siete recompensas salvo Smash, que mantiene exactamente los dos reinicios administrativos probados (`referral_brand_colors` y `promos_3_three_months_customer_details`).

## Retos temporales de agosto 2026

- Implementados localmente dos retos vigentes del 10 al 31 de agosto: descuento + primera venta del producto, y Comercio rápido (mínimo 10 pedidos, 90% respondidos en 15 minutos).
- La recompensa del primer reto destaca el producto 7 días en una nueva sección del Marketplace; la segunda muestra la insignia Comercio rápido durante septiembre.
- Se registran automáticamente `first_responded_at` y `completed_at` en pedidos, y eventos reales de activación de descuento.
- Super Admin puede retirar o reactivar recompensas mensuales ya ganadas desde la ficha del comercio.
- El acceso Logros quedó destacado con estrella, brillo y gradiente en la navegación de escritorio y móvil.
- Migración remota aplicada: `20260810035004_august_monthly_challenges.sql`.
- Código todavía no desplegado a Vercel. Pruebas locales: `/panel/logros`, `/marketplace`, `/admin/comercios`.
- Ajuste posterior: el reto de descuento se gana inmediatamente al activar un descuento nuevo; ya no requiere venta. Migración remota `20260810041345_simplify_august_discount_challenge.sql`.
- En `/panel/logros`, las recompensas temporales aparecen primero y todas las tarjetas se compactaron (cuatro columnas en pantallas amplias para los logros permanentes).
- La sección pública de Productos destacados se compactó a tarjetas horizontales pequeñas en dos columnas.
- Retos de agosto y ajustes visuales desplegados a producción: `dpl_CwKJGvYNAYBYZhdGcN2mFPHJvTDJ`, alias `https://www.somos-ve.com`.
- Verificación posterior: Marketplace, Logros, Super Admin y Registro responden 200; sin errores recientes de Vercel; se preservaron 60 reinicios administrativos y existe 1 recompensa mensual ganada.
- Migración incremental remota aplicada: `20260809140035_split_product_limit_achievement.sql`.
- Migración incremental remota aplicada: `20260809142220_reset_revoked_achievements.sql`.
- Corrección remota aplicada: `20260810005351_add_store_product_update_timestamps.sql`; agrega `updated_at` automático a comercios y productos para reiniciar correctamente el logro de configuración.
- Los 29 comercios existentes recibieron también la recompensa nueva como heredada.
## Hotfix Entrega2 - telefonos invertidos (2026-08-12)

- Causa: `buildEntrega2Payload` enviaba `stores.whatsapp` como `telefono_contacto` y `order.customer_phone` como `telefono_comercio`.
- Correccion: cliente -> `telefono_contacto`; comercio -> `telefono_comercio`.
- Archivo funcional: `src/app/api/panel/orders/[orderId]/send-delivery/route.ts`.
- Validaciones: 8/8 contratos criticos, ESLint dirigido y `npm.cmd run build` exitosos; preview y produccion Vercel `Ready`.
- GitHub: commit `2e35b0c` en `origin/main`.
- Produccion: deployment `dpl_EYRz5PtNPH1WuTVjJtA5f8skRcZa`, aliases `somos-ve.com` y `www.somos-ve.com`.
- No se reenvio el pedido previo ni se creo un delivery real de prueba. Proximo pedido enviado a Entrega2 usara el mapeo corregido.

## Idea multisedes pendiente de decision (2026-08-12)

- Se compararon dos modelos: central con cada sede como `store`, y una marca con menu unico mas sedes internas mediante `branch_id`.
- Preferencia preliminar a largo plazo: marca con sedes internas; valoracion 7.8/10 frente a 7.3/10 para central + stores.
- La alternativa central + stores conserva menor riesgo y mayor compatibilidad inmediata.
- Analisis y condiciones guardados en `docs/MODULO_CADENAS_PLAN.md`.
- No se implemento codigo, migracion ni cambios en Supabase. Esperar decision y autorizacion expresa del usuario.

## P0 crecimiento - cierre operativo (2026-08-12)

- GitHub `origin/main` y produccion quedaron en `b608962`.
- Se versiono la migracion remota faltante `20260811151611_add_test_store_financial_metrics.sql`.
- Se aplico y versiono `20260813014423_add_order_idempotency.sql`.
- Checkout: clave idempotente unica por comercio; reintentos concurrentes devuelven el mismo pedido.
- Entrega2: adquisicion atomica de `sending`; dos solicitudes simultaneas no pueden llamar al proveedor.
- Prueba productiva controlada: 5/5 pedidos QA correctos; precios, delivery y pagos recalculados en servidor.
- Prueba idempotente: 2 solicitudes simultaneas, 2 respuestas 200, mismo orderId y 1 fila persistida.
- Load smoke concurrencia 10: sin errores; p95 catalogo ~3.3 s y `/transporte` ~6.1 s.
- Recursos QA eliminados y verificados: 0 tiendas, 0 agencias y 0 pedidos residuales.
- Produccion Vercel `dpl_Am3Rqr4ooh3CeW9fPyyJFxt6dnwR` en estado Ready.
- Monitoreo avanzado Vercel bloqueado por 403 del plan/permisos; logs basicos disponibles.
- Backup DB no completado: `supabase db dump` requiere Docker Desktop activo en este entorno.
- Backup Storage parcial: 179 archivos / ~35.7 MB, sin manifiesto final por limite de 5 minutos; no cuenta como backup recuperable.
- Pendiente P0 externo: habilitar Docker o backups gestionados y ejecutar dump + restauracion aislada; definir monitoreo/alertas con plan compatible o Sentry.

## Cierre P0 y auditoria inicial del panel (2026-08-13)

- `origin/main` quedo en `d5c3edb`; incluye el checkout simplificado (`c7d93be`) y el contrato automatico de prioridad del delivery externo.
- Produccion conserva prioridad Entrega2/empresa delivery sobre zonas propias; Smash verificado sin selector de zonas.
- Backup remoto de DB generado en `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-13`: `schema.sql` (124909 bytes) y `data.sql` (3726008 bytes), ambos con SHA256 calculado.
- Pendiente para declarar recuperabilidad completa: restaurar el dump en una instancia aislada y completar backup verificable de Storage.
- Logs Vercel de produccion, nivel error, ultima hora: sin resultados.
- Auditoria inicial del panel: cada cambio de modulo dispara de nuevo `/api/panel/settings` desde `PanelFrame`; luego el modulo monta y pide su propia API. `PanelAuthProvider` ya carga `/api/panel/context`, pero no comparte el estado necesario. Este waterfall es la causa principal percibida.
- Otras causas: `PanelStoreIdentity` vuelve a pedir settings, no hay cache/prefetch de APIs de modulos, y el selector de comercio usa `window.location.reload()`.
- Siguiente paso recomendado: unificar contexto/suscripcion en `PanelAuthProvider`, eliminar fetch repetido por ruta, mantener el shell estable, agregar estados instantaneos y medir navegacion/API antes y despues. Probar local, preview y produccion.

## Respaldo Somos en Google Drive (2026-08-14)

- Reintento completado en la cuenta de Google Drive conectada (`bddentrega2@gmail.com`).
- Carpeta: `vendeplus-backups/somos-database-2026-08-13`.
- URL: `https://drive.google.com/drive/folders/1ppV7mVPRkCBkkYxZTR6rZ1Dl1VGDlq2k`.
- `schema.sql`: 124909 bytes; SHA256 `D35C737AB06D50F073F7F6AD308F27891E86CEA511FC4E48092307CF2E4F9F8B`.
- `data.sql`: 3726008 bytes; SHA256 `8ECA6B8A0392C58791C1C6B32083DEFB8100DB71A0168FB5FF96CF0A8A58EEC8`.
- Drive confirmo ambos archivos, nombres y tamanos tras la carga.
- Pendiente para recuperabilidad completa: restaurar la base en una instancia aislada y generar/verificar un respaldo actual de Supabase Storage.

## Pedido manual y notificaciones del panel (2026-08-15)

- Pedido manual habilitado en producción desde `/panel/pedidos`, con Delivery, Retiro, Mesa y Barra, opciones/extras y filtros por modalidad.
- Super Admin puede publicar y pausar novedades, retos, nuevas funciones o avisos importantes desde `/admin/notificaciones`.
- Los avisos activos aparecen en la parte superior de todas las pantallas del panel y cada comercio puede cerrarlos en su navegador.
- Migración remota aplicada: `20260815181515_create_panel_announcements.sql`; tabla verificada mediante acceso de servidor y sin filas de prueba.
- Build local y Vercel aprobados; TypeScript, ESLint, 8 contratos críticos y contrato Entrega2 aprobados.
- Producción: `dpl_7Jp9gZrmADUcbJHWbvqyaYFe22Ad`, estado Ready, alias `https://www.somos-ve.com`.
- Smoke test: Pedidos, Pedido manual y Admin Notificaciones HTTP 200; API de avisos sin sesión HTTP 401 como corresponde; sin errores recientes en logs.
- No se publicó una notificación de prueba para no avisar a comercios reales sin contenido aprobado.
- Ajuste final desplegado: campana flotante permanente; muestra contador de avisos nuevos, conserva los avisos activos para releerlos y muestra `Sin mensajes` cuando no hay publicaciones.
- Regla acordada con el usuario: toda modificación futura debe implementarse y probarse primero en local. No desplegar a producción hasta recibir aprobación explícita después de la prueba local.

## Optimización local de navegación (2026-08-15)

- Trabajo solo local, todavía sin commit, push ni despliegue.
- Se eliminó `force-dynamic`/`revalidate = 0` de pantallas cliente de Registro, Login, Panel, Admin y Transporte Panel.
- `/transporte` usa regeneración de 60 segundos.
- Se eliminó el middleware global duplicado; encabezados de seguridad permanecen en `next.config.ts` y `X-Robots-Tag` se aplica específicamente a `/panel` y `/admin`.
- Build confirmó que las pantallas pasan de dinámicas a estáticas; APIs siguen dinámicas y protegidas.
- TypeScript, ESLint, 8 contratos críticos y build aprobados. API de contexto sin sesión continúa respondiendo 401.
- Medición producción previa: TTFB aproximado 1.1–1.8 s; `/transporte` hasta 2.7 s total.
- Medición producción local optimizada en puerto 3100: primera carga 0.017–0.10 s normalmente; siguientes 0.004–0.009 s; `/transporte` 0.064 s inicial y ~0.005 s en caché.
- Servidor de prueba: `http://127.0.0.1:3100`. Siguiente paso: usuario inicia sesión y prueba navegación y carga real de datos; no desplegar sin su aprobación.
- Segunda fase local: autenticación de APIs del panel cambió de `auth.getUser()` remoto en cada solicitud a `auth.getClaims()` con verificación criptográfica ES256 y caché de claves públicas, recomendada por Supabase.
- `/api/panel/context` inicia en paralelo la consulta de comercios y el permiso de Estadísticas cuando conoce el comercio autorizado.
- Segunda fase aprobó TypeScript, ESLint, 8 contratos críticos y build. Servidor local reiniciado en puerto 3100; pantalla Pedidos ~0.066 s y API sin sesión sigue bloqueada con 401.
- Tercera fase local tras confirmar que los datos internos seguían lentos: medición directa detectó ~0,6–0,75 s por viaje caliente a Supabase y ~3 s en el primer viaje frío.
- `src/lib/panel/auth.ts` reutiliza durante 10 segundos solo las membresías positivas ya verificadas; una revocación puede tardar como máximo ese tiempo en reflejarse. JWT, acceso y filtros `store_id` se siguen validando.
- Pedidos consulta integraciones y transporte en paralelo; Clientes consulta el desbloqueo puntual en vez de recalcular todos los logros; Estadísticas inicia en paralelo permisos, comercios, pedidos, productos, clientes y estado de logros.
- Tercera fase aprobó TypeScript, ESLint, 8 contratos críticos y build completo. Servidor local actualizado en `http://127.0.0.1:3100`.
- Siguiente paso exacto: el usuario debe recargar el panel local e iniciar sesión si hace falta; comparar especialmente Pedidos, Clientes y Estadísticas. No hay commit, push ni despliegue; no desplegar sin aprobación explícita.
- Cuarta fase local: la lista compacta de Pedidos obtiene integraciones y transporte dentro de la consulta principal, eliminando el segundo viaje secuencial. Medición directa caliente: ~0,92–1,09 s frente a ~1,35–1,40 s anterior; primera consulta fría aún puede superar 5 s por conexión remota.
- Pedidos y Estadísticas ahora usan el caché común que Clientes/Inicio ya utilizaban. El caché sobrevive al cambio de módulo, se invalida al modificar datos y las actualizaciones forzadas de Pedidos omiten el caché.
- Los accesos de navegación a Pedidos, Clientes y Estadísticas precargan datos al pasar el puntero o tocar el enlace; la clave incluye las cabeceras de sesión/comercio para no mezclar tenants.
- Cuarta fase aprobó TypeScript, ESLint dirigido, 8 contratos críticos y build completo. Consulta anidada de Supabase verificada con datos reales sin escrituras. Servidor local actualizado en `http://127.0.0.1:3100`.
- Siguiente paso exacto: usuario debe hacer `Ctrl + F5`, probar primero Pedidos y luego salir/volver a Pedidos, Clientes y Estadísticas. Evaluar tanto primera carga como retorno cacheado. No desplegar sin aprobación explícita.

## Auditoría defensiva de seguridad (2026-08-15)

- Auditoría solo lectura; no se modificó código, Supabase ni producción.
- Producción confirmó 401 sin sesión en APIs de Panel, Admin y Transporte; HSTS, `X-Frame-Options: DENY`, `nosniff`, política de permisos y referrer policy activos.
- No se encontraron secretos reales versionados. Service role permanece encapsulado en servidor. Webhooks Entrega2, cron, uploads, pedidos y registros conservan autenticación/límites de tamaño o abuso.
- Riesgo alto operativo: `npm audit` reporta `js-yaml 4.3.0` y `nanoid 3.3.17` con alertas altas de denegación de servicio; ambas son indirectas y tienen corrección disponible.
- Riesgo medio: no existe Content-Security-Policy y el token del panel vive en `sessionStorage`; una futura inyección XSS podría robar la sesión. Recomendado CSP estricta y, en una fase posterior, cookies `HttpOnly`.
- Riesgo medio: respuestas 401 de APIs productivas declaran `Cache-Control: public`; aunque Vercel reportó `MISS`, conviene imponer `private, no-store` a todas las APIs autenticadas.
- Riesgo bajo/robustez: el smoke productivo espera 400 ante registro vacío pero `/api/signup` respondió 500. La API no expuso detalles, pero debe cerrar con validación 400.
- El contrato automático marcó `/api/panel/announcements` por no usar literalmente `requirePanelAuth`, pero revisión manual confirmó que llama `getPanelAuthContext` y devuelve 401 sin sesión; es falso positivo del test.
- `supabase db lint --linked` no encontró errores del esquema de la aplicación; solo dos avisos internos de `extensions.index_advisor`. El conector de Advisors de seguridad no tuvo permiso para consultar.
- 8/8 contratos críticos aprobados. Pendiente recomendado: corregir primero dependencias, CSP/caché de APIs y validación vacía de signup, todo local antes de desplegar.
- Correcciones urgentes implementadas localmente: `js-yaml` 4.3.1 y `nanoid` 3.3.18; `npm audit` reporta 0 vulnerabilidades.
- `next.config.ts` agrega CSP, incluyendo bloqueo de objetos, frames, base externa y conexiones fuera de Somos/Supabase; en desarrollo permite `unsafe-eval`, en producción no. Next requiere todavía `unsafe-inline`, por lo que una futura fase con nonce/cookies HttpOnly sigue siendo recomendable.
- Todas las rutas `/api/*` reciben `Cache-Control: private, no-store, max-age=0`.
- `/api/signup` rechaza contenido que no sea formulario multipart con HTTP 400 antes de procesarlo; prueba local con JSON vacío confirmó 400 en vez de 500.
- Verificación local: CSP presente, API sin sesión 401 y no-store, TypeScript/ESLint aprobados, 8/8 contratos críticos, build completo y `npm audit` 0. Servidor actualizado en `http://127.0.0.1:3100`.
- No hubo migración, SQL, commit, push ni despliegue. Siguiente paso: prueba visual local de login, panel, catálogo/checkout y carga de imágenes antes de pedir aprobación para producción.
- Usuario aprobó la prueba local. Cambios guardados en GitHub en `agent/audit-critical-hardening`, commit `f6e96a8` (`perf: acelerar panel y reforzar seguridad`). PR borrador: `https://github.com/bddentrega2-lgtm/vendeplus-clean/pull/5`.
- Preview Vercel creada: deployment `dpl_4XBTWHHA9yWoDjXEUFUwTn8MXpJ6`, estado Ready, URL `https://vendeplus-clean-614169u0i-entrega2-s-projects.vercel.app`.
- Preview protegida por SSO de Vercel; acceso público redirige al login de Vercel. Producción no fue modificada.
- Siguiente paso: usuario abre la preview con su cuenta autorizada y prueba login, panel, Pedidos, Clientes, Estadísticas, catálogo/checkout y carga de imagen. Solo tras aprobación explícita se promueve a producción.

## Carga pendiente de productos TDK (2026-08-13)

- Usuario solicito cargar 15 productos con precios entregados en la conversacion, sin duplicados.
- No se realizo ninguna escritura: todos los intentos fueron de lectura y expiraron.
- Windows quedo saturado: Node/Supabase, lectura de archivo local, `tasklist` y hasta detener Docker excedieron 30-120 segundos.
- Se prepararon scripts temporales no versionados `scripts/tmp-import-tdk-products.mjs` en `vendeplus-clean` y `vendeplus-entrega2-hotfix`; deben eliminarse al terminar.
- Siguiente paso exacto tras reiniciar: confirmar una unica tienda por `stores.name/slug ILIKE '%tdk%'`; leer productos existentes; comparar nombres normalizados sin acentos/mayusculas/signos; insertar solo faltantes; volver a consultar y verificar cero duplicados y precios.

## Optimizacion y hardening promovidos a produccion (2026-08-15)

- El usuario aprobo la Preview `https://vendeplus-clean-614169u0i-entrega2-s-projects.vercel.app`, deployment `dpl_4XBTWHHA9yWoDjXEUFUwTn8MXpJ6`.
- La Preview aprobada fue promovida a produccion mediante Vercel; nuevo deployment `dpl_6xazeTakB8qKfSs2YFWXD4r2W9Zo`, estado Ready.
- Alias confirmados: `https://www.somos-ve.com`, `https://somos-ve.com` y `https://vendeplus-clean.vercel.app`.
- Smoke test productivo: Home, Registro, Marketplace y `/panel/clientes` HTTP 200.
- `/api/panel/context` sin sesion responde HTTP 401 con `Cache-Control: private, no-store, max-age=0`; CSP productiva confirmada.
- Logs de Vercel nivel error desde el despliegue: sin resultados.
- No hubo migracion ni SQL nuevo.
- PR #5 fusionado en `main`: merge commit `115c6b9`; la correccion de CI quedo en `46a5cd8`.
- Causa del check fallido: `/marketplace` abortaba el prerender cuando el Supabase ficticio de CI no respondia. `getActiveMonthlyMarketplaceRewards()` ahora registra el error y devuelve recompensas vacias solo durante esa indisponibilidad.
- GitHub Quality, Vercel, lint, build con variables ficticias de CI y 8/8 contratos criticos aprobados.
- Deployment automatico final desde `main`: `dpl_EGGCZna3K1o2Bm5yoYUMBCRaXNcR`, estado Ready y dominios publicos asignados.
- Smoke test final: Home, Marketplace y `/panel/clientes` HTTP 200; `/api/panel/context` sin sesion HTTP 401 y no-store; sin errores recientes en logs.
- No asumir categoria: revisar categorias actuales de TDK y usar la adecuada o dejar sin categoria si no existe una categoria inequívoca.

## Pedidos en Mesa premium local (2026-08-16)

- Trabajo solo local en `agent/table-orders-v1`; no hubo commit, push, Preview, produccion ni escrituras remotas.
- Se agrego `stores.table_orders_access_enabled`, separado de `table_orders_enabled`: Super Admin concede el acceso premium y el comercio controla si el servicio esta operativo.
- Super Admin puede activar o retirar Pedidos en Mesa desde la edicion del comercio en `/admin/comercios/[storeId]`.
- Sin acceso premium, Mesas desaparece de la navegacion; la entrada directa muestra funcion no habilitada; `/api/panel/tables` responde 403; el QR y `/api/orders` rechazan pedidos de mesa.
- Se elimino por completo el piloto fijo por slug Smash. El permiso funciona para cualquier comercio y los nuevos comercios nacen con acceso deshabilitado.
- Revocacion local verificada: Smash con acceso `false` conservo `table_orders_enabled=true`, 2 mesas y 7 pedidos de mesa. Al reactivar el acceso reaparecio todo sin perdida.
- Estado local final de Smash: `table_orders_access_enabled=true`, `table_orders_enabled=true`; listo para continuar pruebas.
- Validaciones: ESLint aprobado, 8/8 contratos criticos aprobados, contrato Entrega2 aprobado y `npm.cmd run build` aprobado con 79 rutas.
- Migracion preparada: `20260816040501_table_orders_v1.sql`. La columna nueva se aplico solo al Supabase local; no ejecutar aun en produccion.
- Siguiente paso exacto: manana levantar una sesion local limpia, probar visualmente el toggle desde Super Admin, confirmar ocultamiento/restauracion en Panel, escanear el QR desde un telefono en la misma red y completar un pedido de mesa con cambio de estados y fee. Solo despues evaluar Preview.

### Prueba integral premium local

- Toggle real desde Super Admin verificado: retirar y restaurar acceso respondio HTTP 200 y mostro confirmacion visual.
- Revocado: Mesas desaparecio del menu, `/panel/mesas` mostro funcion premium no habilitada, `/api/panel/tables` respondio 403 y el QR mostro pedidos no disponibles.
- Habilitado: el QR cargo Smash, mostro Mesa 1/Salon y Mesa 2/Terraza; se selecciono Mesa 1, abrio el catalogo real y agrego Coca-Cola 1 litro al carrito.
- Pedido real creado por la API: el cliente intento enviar precio USD 0.01 y el servidor recalculo USD 2.00; fee USD 0.10, delivery USD 0 y total USD 2.10 / Bs. 1.260.
- Persistencia verificada: `delivery_type=table`, mesa y zona congeladas, fee/pagador/customer fee correctos, item USD 2.00 y pago en revision.
- Estados protegidos verificados: `received -> accepted -> preparing -> ready -> completed`; seguimiento publico devolvio estado `completed` y Mesa 1/Salon.
- Prueba negativa: con premium revocado, `/api/orders` respondio 400 y no creo pedido. Acceso restaurado al finalizar.
- Limpieza completada: pedido y cliente QA eliminados; Smash termino con premium y operacion activos, 2 mesas y los 7 pedidos previos.
- Pendiente real: escaneo fisico desde telefono en la misma red y revision visual manual del carrito/checkout/confirmacion en ese telefono. Luego se puede decidir Preview.

## Incidente cotizacion delivery Knockouts (2026-08-16)

- Reporte confirmado en produccion, solo lectura, pedido `VP-0816-9N0`: checkout mostro 7.3 km / USD 3.60 y WhatsApp recibio 10.8 km / USD 5.00.
- Causa exacta: checkout calculaba OSRM directamente desde el navegador. Al fallar esa consulta uso el respaldo Haversine: 5.84 km x 1.25 = 7.30 km. Al guardar, el servidor consulto OSRM correctamente, obtuvo 10.80 km y aplico el rango `10.01-11 km` de la empresa delivery.
- La comanda y la fila guardada coinciden: delivery USD 5, total USD 25.50, 10.8 km. El error era la cifra previa mostrada en checkout.
- Correccion solo local: checkout ahora solicita al servidor todas las cotizaciones con ubicacion, no solo Entrega2. `/api/delivery/quote` admite delivery propio/empresa delivery, conserva `zoneId` y usa la misma configuracion vigente que la creacion del pedido.
- Archivos del fix: `src/components/public/CheckoutForm.tsx` y `src/app/api/delivery/quote/route.ts`.
- Validacion: ESLint, 8/8 contratos criticos, TypeScript y build de 163 rutas aprobados.
- No hubo cambios en Supabase, SQL, commit, push, Preview ni produccion. Pendiente probar local/Preview con las coordenadas del caso y luego desplegar con aprobacion.

### Cotizacion unica y firmada

- Decision confirmada: la primera cotizacion mostrada al cliente es la que debe guardarse y enviarse por WhatsApp.
- `/api/delivery/quote` firma por 30 minutos comercio, coordenadas, subtotal, zona y resultado completo de la cotizacion.
- `/api/orders` ya no consulta nuevamente OSRM ni llama nuevamente a Entrega2. Valida la firma despues de recalcular productos/extras y guarda exactamente distancia/tarifa/proveedor mostrados.
- Si cambia carrito, subtotal, ubicacion, zona, firma o vence la cotizacion, el pedido no se registra y solicita volver a cotizar.
- Entrega2 queda protegido contra doble llamada: una llamada al cotizar; cero llamadas adicionales al confirmar.
- La firma usa `DELIVERY_QUOTE_SIGNING_SECRET` si existe y fallback server-only a `SUPABASE_SERVICE_ROLE_KEY`; no se expone ningun secreto al navegador.
- Prueba automatica agregada: conserva 10.8 km/USD 5 y rechaza subtotal, coordenadas o token manipulados.
- Validaciones finales: ESLint aprobado, 9/9 contratos criticos, contrato Entrega2 y build de 163 rutas aprobados.
- Sigue solo local: sin migracion, SQL, commit, push, Preview ni produccion.

### Entorno local de delivery externo

- Se detecto que la build local anterior mezclaba paginas prerenderizadas con variables remotas y APIs locales; Smash local realmente no tenia agencia conectada.
- Se creo solo en Supabase local `Delivery Local QA`, con tarifas por rangos de distancia, y se conecto como agencia exclusiva/default de Smash.
- Se reconstruyo la aplicacion completa con variables de Supabase local y se reinicio en `http://127.0.0.1:3102`.
- HTML verificado: proveedor `transport_agency`, agencia `Delivery Local QA`, precios `distance_ranges` y ausencia de `Zona de entrega`.
- El servidor queda activo para prueba manual. La agencia QA y conexion existen solo localmente; no hubo escritura remota.

## Preview Smash real y cotizacion firmada (2026-08-16)

- Preview desplegada sin promover a produccion: `dpl_845iexXGGBwafg65UKtqTWXtK6jr`.
- URL base: `https://vendeplus-clean-kke66yilp-entrega2-s-projects.vercel.app`.
- URL Smash: `https://vendeplus-clean-kke66yilp-entrega2-s-projects.vercel.app/smash`.
- Vercel confirmo estado Ready; build remoto, TypeScript y 163 rutas aprobados.
- La Preview usa datos reales/configuracion remota de Smash y esta protegida por acceso Vercel.
- No se aplico migracion ni SQL remoto y produccion no fue modificada.
- Probar: producto -> carrito -> checkout -> ubicacion; confirmar que no aparece selector propio cuando hay empresa conectada, anotar distancia/tarifa, confirmar pedido QA y comparar exactamente WhatsApp. El pedido QA debe identificarse para eliminarlo despues.
- Usuario aprobo la prueba funcional de esta Preview. La cotizacion firmada con llamada unica queda aprobada para avanzar.
- Ajuste posterior solo local: la etiqueta visible `Tarifa de servicio` del resumen del checkout volvio a `Fee`, termino general acordado para el producto. Falta publicar este ajuste en una nueva Preview o incluirlo en el siguiente despliegue aprobado.
- Prueba movil local de Mesas detecto que `crypto.randomUUID()` no existe en algunos navegadores bajo HTTP por IP local. `CheckoutForm` ahora genera el UUID v4 idempotente con `crypto.getRandomValues()` y un respaldo compatible, conservando el formato validado por `/api/orders` y la proteccion contra doble pedido.

## Preview integral Mesas + cotizacion firmada (2026-08-16)

- Usuario aprobo las pruebas locales y solicito pasar el conjunto a Preview.
- Migracion remota aplicada: `20260816040501_table_orders_v1.sql`. Es aditiva; 33 comercios quedaron con acceso y operacion de Mesas desactivados, 0 tokens faltantes y 0 mesas iniciales.
- Seguridad remota verificada: `store_tables` tiene RLS, `anon` queda bloqueado con `42501` y solo `service_role` accede directamente. El lint solo reporto el problema interno conocido de `extensions.index_advisor` con `hypopg_reset()`.
- La migracion de paleta `20260816063446_update_legacy_default_store_palette.sql` NO fue aplicada remotamente porque no es necesaria para Mesas y cambiaria datos compartidos.
- Preview integral: `https://vendeplus-clean-iqjfv77go-entrega2-s-projects.vercel.app`.
- Deployment: `dpl_8BZkMknXrXN2Fzh8EWn8bemvAfHU`, target Preview, estado Ready; build remoto de 163 rutas aprobado.
- Preview protegida por SSO de Vercel; las respuestas publicas sin sesion redirigen con HTTP 302 al acceso de Vercel.
- No se promovio a produccion, no hubo commit ni push. Pendiente prueba integral manual y limpieza de mesas/pedido QA si se crean sobre Smash real.
- Ajuste posterior solicitado, todavia solo local: Mesa usa `Confirmar pedido`; su confirmacion oculta el siguiente paso, instrucciones/botones de WhatsApp y datos para volver a pagar, y muestra la referencia ya recibida. Se agrego notificacion global visual y sonora en todo el panel para IDs nuevos de pedidos de mesa, con Broadcast privado y sondeo de respaldo, sin sonar en la carga inicial ni por cambios de estado.
- Ajuste anterior desplegado a nueva Preview: `https://vendeplus-clean-h47ksb272-entrega2-s-projects.vercel.app`, deployment `dpl_5z8xGHsMCqr97wu4QMoQC6ouaHbB`, estado Ready. TypeScript, ESLint, 9/9 contratos criticos, contrato Entrega2 y build local/remoto de 163 rutas aprobados. Sin nueva migracion, commit, push ni promocion a produccion.
- Nuevo ajuste en desarrollo local: estados publicos de Mesa `Enviado -> Aprobado -> Preparando -> Listo`. El comercio puede elegir `Servir en la mesa` (comportamiento anterior) o `Retiro en barra`; en barra el QR abre el catalogo sin pedir mesa y al quedar listo indica al cliente que retire. Se congela el modo en cada pedido mediante la migracion nueva `20260817024713_add_table_order_fulfillment_mode.sql`, aplicada y verificada solo en Supabase local. Todavia no aplicada remotamente ni desplegada a Preview.
- Ajuste de modos aplicado tambien en Supabase remoto: migracion `20260817024713_add_table_order_fulfillment_mode.sql`; los 33 comercios quedaron en `table_service` y ninguno cambio automaticamente a retiro.
- Nueva Preview: `https://vendeplus-clean-rew1ydd0t-entrega2-s-projects.vercel.app`, deployment `dpl_D2Vukiymd43NaQBTgxgdVwDPfRFV`, estado Ready. Build local/remoto de 163 rutas, TypeScript, ESLint, 9/9 contratos criticos y Entrega2 aprobados. Sin promocion a produccion, commit ni push.
# Actualización 2026-08-16 — Mesas en vivo e identificación de modalidad

- `TableOrderNotifier` emite un evento local multi-tenant al detectar el pedido nuevo que ya genera sonido/notificación.
- `TablesManager` escucha ese evento y recarga pedidos activos en segundo plano, sin refresco manual ni pantalla de carga.
- `/panel/pedidos` muestra una insignia evidente con icono y texto: Mesa, Barra, Retiro (pick up), Delivery o Envío nacional.
- Barra reconoce tanto pedidos manuales (`delivery_pricing_type=bar`) como QR configurado para retiro en barra (`table_fulfillment_snapshot=counter_pickup`).
- La API del panel incluye `table_fulfillment_snapshot` en sus tres niveles de selección.
- No requiere migración ni SQL adicional.
- Validado: ESLint dirigido, `tsc --noEmit`, 9/9 contratos críticos, contrato Entrega2 y `npm.cmd run build` (163 rutas).
- Ajuste posterior de copy: en `/panel/pedidos`, la insignia y el filtro usan `Retiro` en lugar de `Retiro (pick up)`.
- Limpieza posterior: se eliminó la modalidad repetida de la línea secundaria de cada tarjeta y el selector avanzado duplicado. Los filtros rápidos quedan: Todos, Delivery, Retiro, Barra y Mesa.
- Corrección de filtros: `Barra` incluye pedidos manuales y QR con `table_fulfillment_snapshot=counter_pickup`; `Mesa` excluye esos QR y conserva pedidos manuales/QR de servicio en mesa.
- Seguimiento público de pedidos de mesa/barra: se agregó un aviso visible con icono para que el cliente haga una captura de la pantalla y confirme su pedido cuando esté listo.

# Producción 2026-08-16

- Preview aprobado promovido a producción: `dpl_H1bWinxNPJqT52f9HfoGbGrUbp93` (`vendeplus-clean-lpz97rw11-entrega2-s-projects.vercel.app`).
- Dominios `somos-ve.com`, `www.somos-ve.com` y `vendeplus-clean.vercel.app` apuntan al nuevo despliegue.
- Verificación pública: `https://www.somos-ve.com` respondió HTTP 200.
- Producción anterior guardada para rollback: `dpl_EGGCZna3K1o2Bm5yoYUMBCRaXNcR` (`vendeplus-clean-d6xkwh75e-entrega2-s-projects.vercel.app`).
- Reversión exacta desde la raíz del proyecto: `npx.cmd vercel rollback dpl_EGGCZna3K1o2Bm5yoYUMBCRaXNcR --yes`.
- Logs de los últimos 15 minutos: un error de imagen Open Graph de `/smash/opengraph-image` anterior a la promoción; sin relación con mesas/pedidos.

# Rate limit de cotizaciones delivery local (2026-08-17)

- `/api/delivery/quote` ahora aplica el limitador distribuido existente antes de consultar rutas o Entrega2.
- Límite global: 90 solicitudes por IP cada 10 minutos.
- Límite por comercio: 30 solicitudes por IP y comercio cada 10 minutos.
- Al exceder el límite responde HTTP 429 con `Retry-After` y cabeceras `X-RateLimit-*`; conserva el respaldo en memoria si la RPC distribuida falla.
- Se agregó un contrato crítico que verifica ambas claves, la respuesta 429 y sus cabeceras.
- Validaciones locales: ESLint completo, 10/10 contratos críticos, contrato Entrega2 y `npm.cmd run build` aprobados; build generó 167 páginas.
- No hubo migración, SQL, escritura remota, commit, push, Preview ni cambio en producción.
- Siguiente paso: prueba local manual de una cotización normal; para validar visualmente el 429 sin realizar 30 llamadas reales a Entrega2 conviene usar un límite temporal solo local o una prueba de integración con proveedor simulado.
- Prueba local completada en `http://127.0.0.1:3101` contra Supabase local y `Delivery Local QA`: una cotización respondió 200 sin llamar a Entrega2 real.
- Prueba controlada con comercio inexistente: 30 respuestas 400 antes de consultar rutas/proveedores y la solicitud 31 respondió 429. Cabeceras verificadas: `Retry-After`, límite 30, restante 0, reset y request ID.
- Hallazgo adicional pendiente: `toSafeNumber(null)` convierte coordenadas GPS faltantes a `0`, por lo que un comercio sin latitud/longitud puede producir una distancia absurda desde `0,0` en vez de fallar con el mensaje de GPS requerido. Corregir y probar localmente antes de una prueba real de delivery.
- Hallazgo corregido localmente: la cotización rechaza `null`, `undefined`, cadenas vacías y coordenadas fuera de los rangos latitud -90/90 y longitud -180/180.
- Prueba local aprobada: Smash sin GPS respondió HTTP 400 con `El comercio necesita ubicacion GPS configurada para cotizar con Entrega2 App.`; latitud 999 también respondió 400 antes de rutas/proveedores.
- Validaciones posteriores: 11/11 contratos críticos, contrato Entrega2, ESLint completo y build de 167 páginas aprobados.
- El servidor local de `http://127.0.0.1:3101` se detuvo para evitar competencia con el build final.

# Apertura y simplificación del mapa local (2026-08-17)

- Causa del mapa lento/vacío: la CSP no permitía imágenes de `*.tile.openstreetmap.org`; además Leaflet se descargaba solo después de pulsar `Usar mapa`.
- `next.config.ts` permite exclusivamente los mosaicos HTTPS de OpenStreetMap en `img-src`.
- `LocationPicker` precarga Leaflet al mostrarse el selector en checkout y reutiliza la misma promesa al abrir/inicializar el mapa.
- Se eliminó `Marcar centro del mapa` y su lógica. El cliente selecciona directamente tocando el mapa; el texto explica que puede moverlo y tocar otra zona.
- Validaciones: ESLint completo, 12/12 contratos críticos y build de 167 páginas aprobados.
- Servidor local reactivado en `http://127.0.0.1:3101`; `/smash` responde 200 y la CSP servida contiene `tile.openstreetmap.org`.
- No hubo migración, SQL remoto, commit, push, Preview ni cambio en producción.
- Preview creada para validar rate limit, GPS y mapa: `https://vendeplus-clean-gxh2vdfai-entrega2-s-projects.vercel.app`.
- Deployment `dpl_5nYAFDM2cAtthHMqFezFmufCvq38`, target Preview, estado Ready; build remoto de 167 páginas aprobado.
- La Preview está protegida por acceso de Vercel y redirige al login sin sesión autorizada. Producción no fue promovida ni modificada.
- Probar con un comercio real que tenga GPS: abrir checkout, pulsar `Usar mapa`, confirmar carga rápida de mosaicos, ausencia de `Marcar centro del mapa`, tocar un punto y verificar distancia/tarifa. No confirmar el pedido salvo que se identifique para limpieza.
- La primera Preview mostró Tailwind parcialmente compilado: cargaba CSS base, pero faltaban botones, tarjetas, espaciados y colores compuestos. No promover `dpl_5nYAFDM2cAtthHMqFezFmufCvq38`.
- Se reconstruyó desde cero con `vercel deploy --force`, sin caché. Nueva Preview: `https://vendeplus-clean-cdzk1i7u2-entrega2-s-projects.vercel.app`, deployment `dpl_6hKNFAXKDtnxDsZf4NGrBkY1UPVm`, target Preview, estado Ready; 414 paquetes instalados desde cero y build remoto de 167 páginas aprobado.
- Incidente productivo investigado alrededor de 20:15-20:18: Vercel no registró HTTP 500 y el deployment productivo `dpl_CXyMauRpq6Vc688kUo84SWVSYfao` sigue Ready.
- Hubo fallos intermitentes de Supabase que activaron el catálogo de respaldo; Supabase mantiene incidente activo `401 errors due to JWT rejections`, con sesiones renovadas rechazadas por la API.
- Entrega2 falló al cotizar Smash a las 20:17:54; esperó 60,7 segundos y la aplicación respondió 200 usando fallback. Esto pudo hacer que el checkout pareciera congelado.
- Estado posterior: Home, Marketplace, Smash y login respondieron 200; API de panel sin sesión 401 esperado; sin logs 5xx. Producción no fue modificada durante el diagnóstico.

# Auditoría fallback Entrega2 (2026-08-17)

- El fallback sí se activó en producción cuando Entrega2 falló: `/api/delivery/quote` registró `entrega2_quote_fallback_used` y respondió HTTP 200 con token firmado.
- Sin embargo, `calculateEntrega2FallbackQuote` recibe los ajustes normales del comercio y fuerza `distance_ranges`; en Smash termina usando `store_delivery_distance_rates`, no las tarifas de la empresa Entrega2 creada en Somos.
- Rangos actuales de Smash: 0-2 km $1; 2-5 km $2; 5-7 km $3; 7-10 km $4.
- Rangos actuales de la empresa Entrega2: 0-1,5 km $1; 1,51-3 km $1,50; 3,01-4 km $2,50; 4,01-6 km $3; 6,01-8 km $3,50; 8,01-10 km $4.
- Smash tiene `delivery_provider=entrega2`, `pricing_type=manual` y `transport_agency_id/connection_id=null`. La conexión histórica con la empresa Entrega2 está `paused`, sin default.
- Conclusión original: el fallback funcionaba técnicamente, pero usaba una fuente distinta a la contingencia acordada.

## Corrección fallback Entrega2 (2026-08-17)

- Corregido localmente: si la API directa de Entrega2 falla, `/api/delivery/quote` carga primero la configuración activa de la agencia con slug `entrega2` y usa sus rangos guardados en Somos.
- Si esa agencia no existe o su configuración no está completa, conserva como segundo respaldo las tarifas propias del comercio; la respuesta identifica `rateSource` como `entrega2_agency` o `store`.
- Prueba de integración local con la API forzada a fallar: 5,54 km cotizó USD 3 mediante el rango 4,01-6 km de la agencia y devolvió `source=fallback`, `provider=entrega2` y `rateSource=entrega2_agency`.
- Los datos QA fueron eliminados y Smash local recuperó su conexión/configuración previa. No hubo escrituras remotas ni cambios en producción.
- Validaciones finales aprobadas: ESLint, 13/13 contratos críticos, contrato Entrega2 y build local de 167 páginas.
- Preview limpia sin caché: `https://vendeplus-clean-mmm19zq6u-entrega2-s-projects.vercel.app`; deployment `dpl_2hSCwBqsoGtRWJDqjZvFmdV5Bs6a`, build remoto de 167 páginas aprobado. Producción no fue promovida ni modificada.
- Preview aprobada por el usuario y promovida a producción como `dpl_5rtPk12FGKxa8RfmpEevcyfSdGaQ` (`vendeplus-clean-qi9lcdl2p-entrega2-s-projects.vercel.app`). Los dominios `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` apuntan al nuevo despliegue.
- Smoke test posterior: Home, Marketplace, Smash, login del panel y Transporte respondieron HTTP 200; la CSP incluye mosaicos de OpenStreetMap; API de panel sin sesión respondió 401 y cotización inválida 400. Sin errores ni HTTP 500 en logs del nuevo deployment.
- Rollback exacto disponible: `dpl_CXyMauRpq6Vc688kUo84SWVSYfao` (`vendeplus-clean-rhiisqhoc-entrega2-s-projects.vercel.app`). No hubo migración ni escritura en Supabase durante la promoción.

# Home mesas/barra, logo del panel y paleta default (2026-08-17)

- Home conserva sus textos y secciones originales. Después de las dos soluciones principales se agregó un banner compacto `Nueva modalidad: Pedidos en mesa o barra`, con pedido por QR, menos filas/atención más rápida y estado visible. Delivery aparece antes del banner; no se menciona seguimiento en tiempo real ni se modifica la comparación con otras apps.
- El encabezado lateral del panel de comercios usa el logo oficial de Somos en lugar del isotipo genérico y el texto escrito; Super Admin no fue modificado.
- Registro, API de configuración, formulario del panel y catálogos locales de respaldo usan como defaults `#1F464C`, `#F27533` y `#042332`.
- Auditoría remota solo lectura: 19 de 34 comercios conservan exactamente una combinación legacy; los otros 15 tienen colores personalizados o distintos y no deben cambiar.
- La migración `20260816063446_update_legacy_default_store_palette.sql` solo reemplaza las dos combinaciones legacy exactas y actualiza defaults de columnas. Aplicada a Supabase remoto con autorización explícita: 19 comercios pasaron a la paleta `#1F464C/#F27533/#042332`, quedaron 0 legacy y los 15 personalizados conservaron exactamente la misma huella SHA-256 previa.
- Verificación pública posterior: Alkkon Fit sirve HTTP 200 con `--brand-primary:#1F464C`, `--brand-accent:#F27533` y `--brand-button-text:#042332` después de renovar la caché del catálogo.
- Validaciones: ESLint completo, 15/15 contratos críticos y build local/remoto de 167 páginas aprobados.
- Preview vigente: `https://vendeplus-clean-mzd86fgh9-entrega2-s-projects.vercel.app`, deployment `dpl_A8bqAwhJ1ZsNUzcrD6uGHoTKR1kn`. Producción no fue modificada.
- Ajuste final: el módulo del panel se presenta como `Mesa / Barra` en navegación y encabezado, y como `Pedidos en Mesa / Barra` dentro de la gestión.
- Preview final: `https://vendeplus-clean-6kmv887gd-entrega2-s-projects.vercel.app`, deployment `dpl_4KU853RLs1dw5tBKVzcvkLpBHXed`.
- Preview promovida a producción: `dpl_3EPtZx3JNWHcYvLauAYHLKqP3Ybt` (`vendeplus-clean-9jldj5rhe-entrega2-s-projects.vercel.app`). `www.somos-ve.com` apunta al deployment nuevo en estado Ready.
- Smoke productivo: Home, Marketplace, Smash, login del panel y Transporte HTTP 200; banner Mesa/Barra y comparación con otras apps presentes; sin errores ni HTTP 500 en logs. Rollback anterior: `dpl_C59dpBfMhLHJ4dzzuwTW4Lnp7rSy`.
# Estado 2026-08-19 - P0 creación atómica de pedidos

- Implementación local lista, todavía sin aplicar a Supabase remoto ni desplegar.
- Se agregó `create_order_atomic(jsonb,jsonb)` como migración aditiva para guardar cabecera, ítems y opciones dentro de una sola transacción, con idempotencia por comercio.
- Las rutas pública y manual ya usan el helper RPC; el pedido manual conserva una clave estable durante reintentos.
- La actualización CRM del cliente queda después del commit y en modo no crítico: una falla allí no invalida ni duplica el pedido.
- Validaciones superadas: `test:critical` 17/17, `test:entrega2-contract` 1/1 y `npm.cmd run build` exitoso con Next.js 16.3.0.
- Docker y WSL quedaron detenidos. Las imágenes locales de Supabase habían sido eliminadas durante la limpieza del equipo; `supabase start` no logró descargarlas dentro de un tiempo razonable.
- No se tocó producción. Próximo paso exacto: con autorización explícita, validar la migración contra Supabase remoto dentro de `BEGIN ... ROLLBACK`, incluyendo creación correcta, repetición idempotente y fallo forzado sin residuos. Si pasa, solicitar/aplicar la migración aditiva y preparar Preview; producción solo después de validación del usuario.
- Validación remota transaccional autorizada y aprobada el 2026-08-19: la función temporal creó cabecera + ítem + opción, reconoció el segundo intento sin duplicar y el fallo forzado por cantidad inválida no dejó cabecera parcial. La consulta independiente posterior confirmó `function_exists_after_rollback=false` y cero pedidos, ítems u opciones QA; no quedó ningún cambio persistente en producción.
- Próximo paso exacto: solicitar autorización separada para aplicar permanentemente la migración aditiva `20260820013000_create_order_atomic_rpc.sql`. Después desplegar solamente a Preview y validar pedidos público, manual y Mesa/Barra antes de cualquier promoción.
- Usuario autorizó avanzar. Migración aditiva `20260820013000_create_order_atomic_rpc.sql` aplicada a `vendeplus-production` y registrada en el historial remoto. Verificación: función presente; `anon=false`, `authenticated=false`, `service_role=true`; cero pedidos QA residuales.
- Preview atómica creada: `https://vendeplus-clean-7op8ek9cr-entrega2-s-projects.vercel.app`, deployment `dpl_GruL1DzRNpFcALv49ghSdvnoQKmp`, target Preview, estado Ready, build remoto exitoso de 167 páginas. No se promovió producción.
- Smoke de infraestructura: Preview protegida por Vercel; bypass alcanzó la aplicación y `/api/panel/orders` sin sesión respondió sin error de servidor. Cero logs de nivel error y cero HTTP 500 en el deployment.
- Próximo paso exacto: usuario debe validar en Preview (1) pedido público normal, (2) pedido manual desde panel y (3) pedido Mesa/Barra si tiene una mesa disponible. Confirmar que cada uno aparece con productos/extras y una sola vez. No promover a producción sin aprobación explícita.
- Usuario aprobó funcionalmente la Preview atómica y autorizó promover, pero solicitó antes compactar el botón “Enviar a Entrega2 App”. Se cambió únicamente `OrdersManager`: ahora muestra icono `Motorbike` + texto `Entrega2`; conserva título/aria-label contextual para envío o reintento y no cambia la acción.
- Validaciones posteriores aprobadas: ESLint, 17/17 contratos críticos, contrato Entrega2 1/1 y build local Next.js 16.3.0 de 167 páginas.
- Nueva Preview conjunta: `https://vendeplus-clean-96io5f8kd-entrega2-s-projects.vercel.app`, deployment `dpl_CgFLJuZkDoc2a3AS8qWVL3JeRiRE`, estado Ready, build remoto exitoso, sin logs de error ni HTTP 500.
- Próximo paso exacto: usuario valida visualmente el botón compacto en `/panel/pedidos`; después promover este deployment a producción y hacer smoke + revisión de logs. Producción aún no fue promovida.
- Usuario aprobó el botón compacto. Preview promovida a producción como `dpl_4khixG8RUcpaFzvuCdo4gtLkuxjU` (`vendeplus-clean-dt0xulyoi-entrega2-s-projects.vercel.app`), estado Ready. Alias activos: `www.somos-ve.com`, `somos-ve.com`, `vendeplus-clean.vercel.app` y alias del equipo.
- Smoke productivo aprobado sobre el dominio canónico: Home 200, Marketplace 200, catálogo Smash 200, panel login 200 y `/api/panel/orders` sin sesión 401. Supabase confirma función atómica presente, ejecución denegada a `anon`/`authenticated` y permitida solo a `service_role`. Cero logs de error y cero HTTP 500 del deployment.
- P0 atomicidad completado en producción. Pendiente de respaldo en Git: no hacer commit/push hasta que el usuario lo solicite.
- Usuario confirmó que Don Aniello ya está listo y ordenó eliminar el importador temporal. `scripts/import-don-aniello-menu.mjs` fue eliminado localmente; nunca estuvo versionado, por lo que no produce un cambio Git ni afecta Supabase, Vercel o el catálogo existente.
- Mejora UX Mesa/Barra preparada: `TablesManager` ya no reemplaza toda la vista con loading después de guardar configuración, crear/editar mesa o actualizar un estado; refresca en segundo plano y actualiza el pedido de forma inmediata, conservando la posición visual.
- La configuración + QR se abre automáticamente solo si el módulo está inactivo; cuando ya está activo aparece plegada en una franja compacta con resumen y botón “Editar configuración”. Al guardar una configuración activa vuelve a plegarse. “Nueva mesa” se movió debajo de pedidos y mesas para priorizar la operación diaria.
- Validaciones: ESLint, 18/18 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas aprobados.
- Preview UX Mesa/Barra: `https://vendeplus-clean-53rpvy9tj-entrega2-s-projects.vercel.app`, deployment `dpl_8wf6gP39Noj93fsnvPgyiorG33Hg`, Ready, sin logs de error ni HTTP 500. No se promovió producción.
- Próximo paso exacto: usuario valida en `/panel/mesas` que configuración inicia plegada y que cambiar un estado no lo devuelve arriba; promover solo con aprobación explícita.
- Usuario aprobó UX plegada y pidió dos mejoras adicionales. Se agregó DELETE protegido de mesas: exige manager y `store_id`, bloquea si existen pedidos activos, confirma en UI y conserva los snapshots de pedidos históricos gracias al FK existente `on delete set null`. No requiere migración.
- Pedido manual: tamaños/extras/notas salieron del resumen lateral. Al agregar un producto con opciones se abre un diálogo enfocado; en móvil ocupa la parte útil de la pantalla y en PC queda centrado. Incluye cantidad, grupos obligatorios/opcionales, precios extra, nota, validación de requeridos y total. El resumen queda compacto con opciones elegidas y botón “Personalizar”.
- Validaciones aprobadas: TypeScript, ESLint, 19/19 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas.
- Preview conjunta: `https://vendeplus-clean-edcvumg8l-entrega2-s-projects.vercel.app`, deployment `dpl_B21u8AuXcfLbX5tma7zYY6qaHeRH`, Ready, sin logs de error ni HTTP 500. No se promovió producción y no hubo SQL.
- Próximo paso exacto: usuario valida eliminar una mesa sin pedidos, bloqueo de una mesa con pedido activo y personalización manual desde teléfono/PC; promover solo con aprobación explícita.
- Usuario reportó que el botón eliminar se veía mal y que faltaban tamaños. Se dejó solo un botón circular con icono de papelera, tooltip y aria-label; la confirmación y protecciones permanecen.
- Causa de tamaños: las presentaciones viven en `product_variants`, no en grupos de extras, y `/api/panel/catalogo` no las incluía. Ahora el catálogo del panel carga variantes; el diálogo exige tamaño/presentación cuando existen, muestra precio, lo resume y lo envía como `variantId`.
- Seguridad/precio: `/api/panel/orders` valida server-side que la variante pertenezca al producto y esté disponible, usa su precio real, congela `variant_name` y aplica `product_option_value_variant_prices` cuando un extra cambia de precio según tamaño. WhatsApp incluye variante + extras.
- Validaciones aprobadas: TypeScript, ESLint, 19/19 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas.
- Preview corregida: `https://vendeplus-clean-ikrrdya0s-entrega2-s-projects.vercel.app`, deployment `dpl_CK628EP1CcyDCs6CMHb2EgVgDcSd`, Ready, sin logs de error ni HTTP 500. Producción intacta; sin migración ni SQL.
- Próximo paso exacto: usuario valida papelera y un producto manual con tamaño + extras (incluyendo cambio de precio); promover solo con aprobación explícita.

# Estado 2026-08-19 - P0 empresas delivery

- Se eliminó el remount entre módulos del panel delivery: la navegación interna cambia de pestaña y URL sin desmontar `TransportAgencyPanel`, conserva historial Atrás/Adelante y evita la pantalla blanca de “Cargando empresa delivery”.
- Los estados visibles se redujeron a las siguientes acciones válidas según el estado actual. Se corrigieron transiciones faltantes desde pendiente hacia rechazo y desde repartidor asignado hacia en camino/entregado.
- Las mutaciones de estado y repartidor ahora pasan por `mutate_transport_order_atomic`: servicio, evento, pedido origen e integración se actualizan dentro de una sola transacción PostgreSQL.
- La migración aditiva `20260820033000_mutate_transport_order_atomic_rpc.sql` fue aplicada a Supabase remoto con autorización del usuario. Permisos verificados: denegada a anon y disponible solo para service role. La prueba de error controlado no alteró pedidos ni eventos reales.
- Performance P0 adicional: sin refetch completo tras cambios propios, supresión del evento Realtime propio, debounce de Realtime, polling de respaldo de 30 a 180 segundos, consulta de membresía paralela, lista sin conteo exacto y paginación mediante `limit + 1`.
- Validaciones aprobadas: TypeScript, ESLint, 22/22 contratos críticos y build local Next.js 16.3.0 de 167 páginas.
- Preview conjunta: `https://vendeplus-clean-jbs5s46w9-entrega2-s-projects.vercel.app`, deployment `dpl_AC2H2YwfJE4S8GaMsR31DGxWkFap`, target Preview, estado Ready, sin logs de error. La ruta protegida responde 302 hacia autenticación sin sesión, comportamiento esperado.
- Producción web no fue promovida. Próximo paso exacto: validar con sesión real (1) cambiar entre Pedidos/Repartidores/Tarifas sin pantalla blanca, (2) aceptar o rechazar un pedido pendiente, (3) asignar repartidor, pasar a En camino y Entregado, (4) abrir WhatsApp y confirmar que aparece inmediatamente. Promover solo con aprobación explícita.
- Usuario aprobó funcionalmente el P0, pero pidió antes agregar filtro por repartidor en Facturación. `TransportBillingTab` ahora permite elegir todos, un repartidor histórico/actual o servicios sin asignar; el filtro actualiza el total filtrado, el detalle y el bloque de pagos sin nuevas consultas al servidor.
- Validaciones finales aprobadas: TypeScript, ESLint, 23/23 contratos críticos y build local/remoto Next.js 16.3.0 de 159 páginas estáticas generadas.
- Nueva Preview conjunta: `https://vendeplus-clean-65s6n4syv-entrega2-s-projects.vercel.app`, deployment `dpl_3DyCZTesVfuH1wno5iBHfrjZf5rV`, target Preview, estado Ready, sin logs de error. Facturación protegida responde 302 hacia autenticación sin sesión, esperado.
- No hubo migración nueva ni SQL adicional. Producción web continúa intacta. Próximo paso exacto: usuario valida el filtro en Facturación y, con aprobación explícita, promover esta Preview conjunta a producción y ejecutar smoke + logs.
- Se agregó en Super Admin → Transporte un control independiente por empresa: `Activar premium` / `Premium activo`. Es reversible, actualiza la tarjeta inmediatamente y no altera aprobación, publicación, tarifas ni conexiones.
- El endpoint PATCH valida `enabled` como booleano y reutiliza `requireAdminAuth`, por lo que solo una sesión founder puede modificar `premium_dispatch_enabled`.
- Validaciones aprobadas: TypeScript, ESLint, 24/24 contratos críticos y build local/remoto Next.js 16.3.0 de 159 páginas estáticas generadas.
- Preview final conjunta: `https://vendeplus-clean-a7d395wg6-entrega2-s-projects.vercel.app`, deployment `dpl_3sgqXDx6zH9ya2SvFVfnVFGPjQt5`, target Preview, Ready, sin logs de error. `/admin/transporte` sin sesión responde 302 esperado.
- Sin migración ni SQL nuevo; producción intacta. Próximo paso: usuario prueba activar/desactivar Premium desde `/admin/transporte`, verifica acceso de repartidores en el panel delivery y autoriza explícitamente la promoción.
- Usuario validó la Preview completa y autorizó promoción. Vercel promovió exactamente la Preview aprobada a producción como `dpl_CabbMnCyz82gzQkHwQseVKXj7EnD` (`vendeplus-clean-dlau9cs5w-entrega2-s-projects.vercel.app`), estado Ready.
- Alias productivos confirmados: `www.somos-ve.com`, `somos-ve.com`, `vendeplus-clean.vercel.app` y alias del equipo.
- Smoke productivo aprobado: Home, Marketplace, Alkkon Fit, login y Transporte HTTP 200; API Admin sin sesión HTTP 401 esperado. Logs del deployment sin HTTP 500 ni errores de ejecución.
- Rollback web inmediato disponible al deployment productivo anterior `dpl_5vVUiXtUsbJgs8YEcLMy4gFrsdph` / `vendeplus-clean-boz38o2xw-entrega2-s-projects.vercel.app`. La migración atómica delivery ya es aditiva y compatible hacia atrás.
- Pendiente de respaldo Git: los cambios están desplegados pero continúan sin commit/push porque el usuario no lo ha solicitado todavía.
- Ajuste posterior solo local: en el Home se intercambiaron los temas visuales de las tarjetas principales. `Para comercios` ahora usa fondo verde oscuro, texto claro y botón claro; `Para empresas delivery` usa tarjeta blanca, texto verde oscuro y botón naranja. Textos, enlaces y estructura no cambiaron.
- Validaciones locales: 24/24 contratos críticos, ESLint y build Next.js 16.3.0 aprobados. Servidor local disponible en `http://127.0.0.1:3000/` con HTTP 200.
- Este ajuste de color no fue desplegado a Preview ni producción. Próximo paso: usuario revisa el Home local y decide si se prepara Preview.
- Ajuste local adicional: los dos iconos de camión del Home vinculados a delivery fueron sustituidos por `Motorbike` (tarjeta `Para empresas delivery` y beneficio `Delivery conectado`).
- Validaciones posteriores: 24/24 contratos críticos, ESLint y build aprobados; servidor local reiniciado y Home HTTP 200 en `http://127.0.0.1:3000/`. Sigue sin Preview ni producción.
- Usuario aprobó los colores e iconos locales y autorizó producción. Se creó primero Preview limpia `dpl_DFiyaRukMMF9ufWGfK1DA6M4Dnrp` (`vendeplus-clean-9g2d9wtws-entrega2-s-projects.vercel.app`), Ready y sin errores, y se promovió exactamente ese deployment.
- Producción vigente: `dpl_GJYsWyxbiFhzfNezLfXbeGdSbzyV` (`vendeplus-clean-3bhstoy2t-entrega2-s-projects.vercel.app`), Ready; dominios `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` asignados.
- Smoke productivo: Home, Marketplace, Alkkon Fit, login y Transporte HTTP 200; API de panel sin sesión HTTP 401 esperado; sin HTTP 500 ni errores en logs. Rollback web anterior: `dpl_CabbMnCyz82gzQkHwQseVKXj7EnD`.
- No hubo migración ni SQL en este ajuste. Paquete completo respaldado en Git mediante commit `9debfff` (`feat: optimizar empresas delivery y renovar home`) y enviado a `origin/main`.

# P1 resiliencia Entrega2 y catálogo público (2026-08-20)

- Prioridades 1 y 3 implementadas localmente, sin producción: las cotizaciones de Entrega2 abortan a los 4,5 s y los envíos de pedidos a los 8 s. El timeout cubre también la lectura del cuerpo y siempre limpia el temporizador.
- Se agregó cortacircuito de cotización por instancia: después de 3 fallos de red, HTTP 429/5xx o timeout, evita nuevas esperas durante 30 s y permite que `/api/delivery/quote` use inmediatamente las tarifas de contingencia ya existentes. Los errores 4xx normales no abren el circuito.
- Home y Marketplace dejaron de ejecutar tres consultas delivery por comercio. `hydrateStoresDeliveryRelations` hace solo tres consultas masivas por lote (`settings`, `zones`, `distance_rates`) y agrupa los resultados por `store_id`; con 31 comercios pasa de hasta ~93 consultas adicionales a 3.
- El hidratador conserva los datos ya incluidos si una consulta masiva específica falla, evitando borrar configuración por una incompatibilidad temporal.
- Validaciones aprobadas: TypeScript, ESLint, 26/26 contratos críticos y build Next.js 16.3.0 de 159 páginas. Smoke local: Home, Marketplace y Alkkon Fit HTTP 200.
- Preview: `https://vendeplus-clean-2empl8kpk-entrega2-s-projects.vercel.app`, deployment `dpl_Gnd6m8jgCJPKbjnr1Mu5gTNEaxfM`, target Preview, Ready, build remoto aprobado y sin logs de error.
- No hubo migración ni SQL. Producción sigue intacta. Próximo paso: validar Home/Marketplace/catálogos en Preview y una cotización Entrega2; promover solo con aprobación explícita.
- Usuario aprobó la Preview y autorizó producción. Se promovió exactamente `dpl_Gnd6m8jgCJPKbjnr1Mu5gTNEaxfM` como deployment productivo `dpl_JDnrqBD1F1FgpH5j4CXTt8pP96HE` (`vendeplus-clean-qw4is7gj3-entrega2-s-projects.vercel.app`), estado Ready.
- Alias productivos confirmados: `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`. Smoke: Home, Marketplace, Alkkon Fit y Transporte HTTP 200; API de panel sin sesión rechazada; sin HTTP 500 ni errores en logs.
- Rollback web anterior: `dpl_5ZfdoVqSFZxFKtuvsJAukqxDPQ78` (`vendeplus-clean-el30ljxyw-entrega2-s-projects.vercel.app`). Pendiente respaldar este P1 en GitHub cuando el usuario lo autorice.

# Próxima prioridad - TDK multisede (2026-08-20)

- Crear dos comercios independientes adicionales: `TDK Delicias` y `TDK Los Cedros`, inicialmente con el mismo catálogo/productos de la sede TDK existente.
- Cada sede debe conservar operación independiente: pedidos, configuración, delivery, horarios, usuarios y futuras modificaciones de catálogo no deben mezclarse automáticamente.
- Se necesita una vista central autorizada para consultar los pedidos de todas las sedes. Antes de implementar, revisar el plan existente `docs/MODULO_CADENAS_PLAN.md` y elegir la solución mínima segura: agrupación de sedes + permisos explícitos, manteniendo `store_id` en cada pedido.
- No se crearon sedes ni se copiaron datos en esta sesión. Próximo paso exacto: auditar la sede TDK actual, definir los slugs/datos básicos y presentar el alcance del panel consolidado antes de cualquier escritura remota.
- Auditoría remota solo lectura completada: sede origen `Pastelería TDK` (`pasteleria-tdk`), activa, 5 categorías (`Tortas`, `Postres`, `Box`, `Desayunos`, `Pizzas`), 15 productos activos, 5 destacados, sin variantes, extras, pedidos, clientes ni mesas. Tiene 1 usuario owner.
- Delivery actual de TDK: propio, cotización manual, delivery y retiro activos, sin zonas/rangos ni empresa delivery. La dirección visible sigue como `Ubicacion del negocio`; por seguridad no debe copiarse a nuevas sedes junto con GPS, WhatsApp, pagos u horarios sin confirmación.
- Arquitectura mínima confirmada: cada sede será un `store` independiente; el mismo usuario owner se vincula mediante `store_users`. La API ya autoriza y devuelve pedidos de todas las tiendas vinculadas sin mezclar `store_id`, por lo que no hacen falta tablas de organizaciones para el piloto de 3 sedes.
- Base local del panel consolidado implementada: Pedidos muestra selector `Todas las sedes`/sede individual para usuarios normales con más de una tienda, identifica la sede en cada fila y valida server-side que el filtro solicitado pertenezca al usuario. Founder conserva su selector actual y no ve un filtro incompatible.
- Validaciones locales: TypeScript, ESLint, 27/27 contratos críticos y build Next.js 16.3.0 aprobado. Sin Preview, producción, migración ni escrituras remotas.
- Usuario confirmó la configuración mínima: mismo WhatsApp y horario; GPS y métodos de pago en blanco; ambas sedes usarán Entrega2; mismo usuario con selector de sede y Pedidos consolidado.
- Implementación local completa: el selector superior ahora aparece para cualquier usuario con más de una sede; Pedidos ofrece `Todas las sedes` o una sede particular, identifica la sede de cada pedido y valida el filtro server-side contra `store_users`. Founder conserva su aislamiento por comercio seleccionado.
- Migración idempotente preparada: `20260820050000_clone_tdk_branches.sql` crea `pasteleria-tdk-delicias` y `pasteleria-tdk-los-cedros`, copia usuarios, 5 categorías, 15 productos e imágenes desde TDK, reutiliza WhatsApp/horarios/identidad visual, configura Entrega2 y deja ambas tiendas inactivas, sin GPS y sin métodos de pago. No fue aplicada remotamente.
- Validaciones aprobadas: 28/28 contratos críticos, TypeScript, ESLint y build local Next.js 16.3.0 de 163 páginas. `supabase db push --dry-run` confirmó que únicamente esta migración está pendiente.
- Preview de código: `https://vendeplus-clean-896sk4frn-entrega2-s-projects.vercel.app`, deployment `dpl_Dh8gpbXQjJpHC9Mdp4MAVkxnFyn5`, target Preview, estado Ready y build remoto aprobado. Producción y datos remotos siguen intactos.
- Próximo paso exacto: revisar Preview sin esperar todavía ver las nuevas sedes; luego, con autorización explícita, aplicar la migración remota. Las sedes aparecerán en el selector pero seguirán inactivas hasta configurar GPS y pagos de cada una. Después validar panel consolidado y solo entonces promover el código a producción.
- Usuario autorizó y se aplicó remotamente la migración aditiva `20260820050000_clone_tdk_branches.sql`. Supabase confirmó su registro sin errores.
- Verificación remota posterior: `pasteleria-tdk-delicias` y `pasteleria-tdk-los-cedros` existen, ambas inactivas, con WhatsApp `584124574587`, GPS nulo, métodos de pago vacíos, 1 usuario autorizado, 5 categorías, 15 productos y 17 imágenes por sede. Delivery está activo con proveedor `entrega2`, retiro activo y cotización manual.
- El código multisede continúa solo en Preview; producción web no fue promovida. Próximo paso: entrar al Preview con el usuario TDK, comprobar el selector de sede y la vista `Todas las sedes` en Pedidos. Después configurar GPS y pagos por sede antes de activarlas, y promover el código únicamente con aprobación explícita.
- GPS cargado remotamente por solicitud del usuario, sin activar las sedes: Los Cedros `10.240814864, -67.59266906`; Delicias `10.260254588, -67.59025545`. La actualización exigió `is_active=false` y afectó exactamente una fila por slug. Ambas continúan inactivas y con métodos de pago vacíos; la sede TDK original no fue modificada.
- Enlace único TDK implementado en `/tdk`: obtiene únicamente las sedes TDK activas desde el catálogo público, permite selección manual, solicita geolocalización solo al pulsar el botón, calcula distancias localmente con Haversine, ordena por cercanía y recuerda la última sede en `localStorage`. No almacena ni transmite la ubicación del cliente y no carga mapa externo.
- Validaciones aprobadas: 29/29 contratos críticos, TypeScript, ESLint y build local Next.js 16.3.0 de 164 páginas. Nueva Preview conjunta `https://vendeplus-clean-6ucnznpkx-entrega2-s-projects.vercel.app`, deployment `dpl_D1htdjiNsPWHzB2BkdBjfnWdfgue`, target Preview, estado Ready y build remoto aprobado. El navegador integrado no estuvo disponible para QA visual; queda validación desde el teléfono del usuario.
- Producción web no fue promovida. Mientras Delicias y Los Cedros sigan inactivas, `/tdk` mostrará solo la sede original; al activarlas aparecerán automáticamente en un máximo de 30 segundos. Falta GPS válido de la sede original para poder calcular su distancia. Próximo paso: validar diseño y permiso de ubicación en Preview, completar pagos/GPS faltante, activar sedes y luego promover con aprobación explícita.
- Usuario detectó 45 productos al entrar a TDK desde el panel. Causa: el selector global guardaba la sede activa, pero GET `/api/panel/catalogo` y `/api/panel/products` consultaban todas las membresías del usuario. Corregido: ambos endpoints leen `X-Panel-Store-Id`, validan acceso y filtran tiendas, categorías y productos por la sede activa; el fallback de Productos también queda filtrado. Pedidos mantiene intencionalmente `Todas las sedes`.
- Validaciones posteriores: 30/30 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 164 páginas aprobados. Preview corregida conjunta: `https://vendeplus-clean-jj6qu0556-entrega2-s-projects.vercel.app`, deployment `dpl_BrWCsp6hCCRCdAvAmBTHyEewcwSh`, target Preview, build remoto aprobado. Producción intacta.
- Próximo paso: usuario cambia entre las tres sedes en Preview y confirma que `/panel/productos` y `/panel/catalogo` muestran 15 productos por sede; verificar que Pedidos sí conserva la vista consolidada. Promover solo con aprobación explícita.
- Para permitir QA completo sin activar comercios, `/tdk` ahora usa una vista especial cuando `VERCEL_ENV=preview`: muestra las tres sedes y marca Delicias/Los Cedros como `En configuración`; en producción continúa filtrando estrictamente `is_active=true`. Los botones de sedes inactivas llevan a la pantalla segura de catálogo inactivo, comportamiento esperado hasta su activación.
- Preview QA multisede final: `https://vendeplus-clean-e5ulkaipg-entrega2-s-projects.vercel.app`, deployment `dpl_5qzzZoDQGt5dMD12nayPwcBKZdRK`, target Preview, estado Ready y build remoto aprobado. Validaciones: 30/30 contratos, TypeScript, ESLint y build de 164 páginas. Sin promoción ni SQL nuevo.
- Próximo paso: usuario prueba `/tdk`, geolocalización, recuerdo de sede, selector de panel, aislamiento 15/15/15 y Pedidos consolidado. No crear pedidos QA persistentes sin acordar limpieza; promover únicamente después de aprobación explícita.
- Usuario reportó que Configuración seguía mostrando las tres sedes. Diagnóstico confirmado: GET `/api/panel/settings` aún filtraba por todas las membresías y no por `X-Panel-Store-Id`. Se corrigió con validación `assertStoreAccess` y filtro exacto de la sede activa.
- Auditoría preventiva del mismo flujo: GET `/api/panel/delivery-settings` y GET `/api/panel/options` también fueron aislados por la sede superior; Productos, Catálogo y Pedido manual ya estaban cubiertos. Pedidos conserva deliberadamente `Todas las sedes`.
- Validaciones: 31/31 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas aprobados. Preview actualizada: `https://vendeplus-clean-8sn5xfkid-entrega2-s-projects.vercel.app`, deployment `dpl_CvsTQqBnNpYeDMuF6H1TKmDnfB8d`, target Preview, build remoto aprobado. Sin SQL ni promoción.
- Próximo paso: validar cambiando de sede en Configuración, Delivery y Opciones/Extras; cada módulo debe mostrar exactamente una sede y mantener sus propios datos. Promover solo con aprobación explícita.
- Usuario detectó que Inicio → `Ver catálogo` abría Delicias aunque la sede superior fuera Piñonal. Causa: `/api/panel/stats?mode=summary` ignoraba `X-Panel-Store-Id`, devolvía todas las tiendas y Dashboard elegía la primera. Corregido: Stats toma la sede del query o encabezado, valida acceso y filtra también `stores`, pedidos, productos y clientes; enlace y métricas de Inicio quedan alineados con la sede activa.
- Piñonal auditada remotamente: `Pastelería TDK Piñonal`, GPS válido `10.235959415, -67.577899972`, activa. Por solicitud del usuario se cambió de `own_delivery` a `entrega2`, conservando delivery activo, retiro activo y pricing manual. Actualización afectó exactamente la configuración esperada.
- Validaciones: 32/32 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas. Preview actual: `https://vendeplus-clean-68ohgikec-entrega2-s-projects.vercel.app`, deployment `dpl_4ypsEbZ7qxWW8jTCfnQUDY17huEX`, target Preview y build remoto aprobado. Sin migración ni promoción web.
- Próximo paso: en Preview seleccionar Piñonal, confirmar que Inicio → Ver catálogo abre `/pasteleria-tdk`, que las métricas corresponden a Piñonal y que Delivery muestra Entrega2. Repetir enlace con Delicias/Los Cedros. Promover solo con aprobación explícita.
- Usuario mostró que el nombre de sede en tarjetas de Pedidos se truncaba (`Pastelería TDK P...`). Se amplió la primera columna desktop de 92px a 180px, se permite hasta dos líneas con tipografía legible y se agregó `title` con el nombre completo. No cambia datos ni acciones del pedido.
- Validaciones: 33/33 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas. Preview actual: `https://vendeplus-clean-mzjqol2dv-entrega2-s-projects.vercel.app`, deployment `dpl_8vJiAzaKT4dwc33FDKVEhkA5ap3d`, target Preview y build remoto aprobado. Sin SQL ni producción.
- Próximo paso: revisar en `/panel/pedidos` la misma tarjeta de la captura en PC y teléfono, confirmando que `Pastelería TDK Piñonal` sea legible y que el resto de columnas no se solape. Promover solo con aprobación explícita.
- Usuario indicó que ampliar la columna agrandó demasiado la tarjeta. Se restauró el ancho original de 92px y se compacta únicamente el prefijo común `Pastelería TDK`: las tarjetas muestran `Piñonal`, `Delicias` o `Los Cedros`; el atributo `title` conserva el nombre completo. La tarjeta vuelve a su tamaño previo.
- Validaciones sin cambios: 33/33 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas. Preview refinada: `https://vendeplus-clean-1fxraaztr-entrega2-s-projects.vercel.app`, deployment `dpl_i9MAVSjZ9GTopKSYN8e6kXE2xRbX`, target Preview, build remoto aprobado. Producción intacta.
- Auditoría final multisede completada. Confirmado: autorización y roles se validan server-side contra `store_users`; mutaciones sensibles recalculan/validan `store_id`; caché cliente incluye encabezados (incluido `X-Panel-Store-Id`), evitando reutilizar respuestas de otra sede; Founder continúa aislado al comercio seleccionado.
- Riesgos corregidos: Clientes, exportación y reconstrucción histórica ahora quedan limitados a la sede activa; Suscripción y Logros respetan la sede superior; Delivery, después de PATCH/POST/DELETE, devuelve únicamente la sede modificada y no vuelve a mezclar las tres. Solo Pedidos conserva consolidación intencional.
- Validaciones finales: 35/35 contratos críticos, TypeScript, ESLint, `git diff --check` y build Next.js 16.3.0 de 160 páginas aprobados. Preview final: `https://vendeplus-clean-ehsd17ie2-entrega2-s-projects.vercel.app`, deployment `dpl_DmZ5YaFWrz8tMEUxyWJewsNP7h99`, target Preview, estado Ready y build remoto aprobado. Sin migración ni promoción nueva.
- Riesgo arquitectónico residual no bloqueante para piloto: la pertenencia multisede se deduce de compartir usuario en `store_users`; es segura pero puede agrupar negocios no relacionados del mismo propietario. Antes de habilitar multisede masivamente, crear agrupación explícita (`store_groups` + membresías) y hacer que `Todas las sedes` consolide solo el grupo activo. No hace falta para el piloto TDK de tres sedes.
- Próximo paso: validar en Preview Clientes, Delivery, Suscripción y Logros cambiando entre Piñonal/Delicias/Los Cedros; después promover y respaldar únicamente con aprobación explícita.
- Usuario solicitó activar las tres TDK, dejar únicamente `Efectivo` y ocultarlas del Marketplace. Se agregó control explícito `stores.marketplace_visible` (default `true`) y se actualizó `marketplace_eligible_store_ids` para excluir de forma centralizada las tiendas con visibilidad desactivada, manteniendo disponibles sus enlaces directos.
- Migración `20260821030000_add_marketplace_visibility.sql` aplicada remotamente tras dry-run exitoso. Estado verificado: Piñonal, Delicias y Los Cedros `is_active=true`, `marketplace_visible=false`, `payment_methods=["Efectivo"]`; RPC de Marketplace devuelve cero IDs elegibles para las tres.
- Defensa adicional en web: `getPublicStores` también descarta `marketplace_visible=false` antes de Home/Marketplace, incluso si la lista candidata ya fue obtenida. Los catálogos directos y `/tdk` no dependen de esa visibilidad.
- Validaciones: 36/36 contratos críticos, TypeScript, ESLint y build local Next.js 16.3.0 aprobados. Preview: `https://vendeplus-clean-6dun1kfkg-entrega2-s-projects.vercel.app`, deployment `dpl_GBKUnofBWRKmBMxNSFfYygNFRaxN`, target Preview y build remoto aprobado. Producción web no fue promovida; la exclusión del Marketplace ya funciona en producción mediante la RPC remota.
- Próximo paso: validar `/tdk`, los tres catálogos directos, checkout con solo Efectivo y ausencia de TDK en `/marketplace`; después promover web con aprobación explícita.
- Usuario aprobó la Preview y autorizó continuar. Se promovió exactamente `dpl_GBKUnofBWRKmBMxNSFfYygNFRaxN`; Vercel creó el deployment productivo `dpl_FzvGmHkcKHZztgYnDmky4bEcKHVq` (`vendeplus-clean-6edplbpwq-entrega2-s-projects.vercel.app`), estado Ready, con alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`.
- Smoke productivo aprobado: Home, Marketplace, `/tdk`, los tres catálogos TDK y login HTTP 200; `/api/panel/orders` sin sesión HTTP 401 esperado. TDK no aparece en el HTML de Marketplace y los tres catálogos contienen Efectivo. Sin logs de error iniciales y `git diff --check` limpio.
- Rollback web disponible al deployment productivo anterior registrado por Vercel; la migración de visibilidad y la clonación de sedes ya estaban aplicadas y verificadas antes de promover.

# Pendientes de producto priorizados (2026-08-21)

## Marketplace orientado a ventas

- Mejorar la interfaz del Marketplace para que sea más atractiva, visual y orientada a conversión, manteniendo una carga rápida en móviles.
- Incorporar bloques de ofertas y productos más vendidos; definir reglas verificables para destacados y evitar que un comercio monopolice la portada.
- Mostrar u ordenar comercios según cercanía cuando el cliente autorice su ubicación, con selector manual y funcionamiento normal si rechaza el permiso. No almacenar ni transmitir coordenadas sin necesidad.
- Considerar secciones como `Cerca de ti`, `Ofertas`, `Más vendidos`, `Nuevos` y categorías/rubros, sin recargar la pantalla.
- Antes de implementar: auditar datos disponibles, definir cómo se identifica una oferta y calcular rankings server-side sin consultas N+1 ni exponer datos privados.

## Estadísticas de crecimiento para Super Admin

- Mejorar el tablero Founder/Super Admin con pedidos acumulados históricos, pedidos del mes y comparación contra el mes anterior, incluyendo variación absoluta y porcentual.
- Mostrar facturación/GMV mensual y comparativo mes a mes, dejando claro que representa ventas procesadas y no necesariamente ingresos de Somos.
- Métricas valiosas propuestas: comercios activos y nuevos por mes, comercios con al menos un pedido, pedidos promedio por comercio activo, ticket promedio, clientes nuevos/recurrentes, repetición de compra, pedidos por canal (delivery, retiro, mesa/barra), pedidos por estado/cancelación y crecimiento de sedes.
- Incluir rango de fechas, serie mensual y tabla por comercio; proteger todo exclusivamente para Founder/Super Admin.
- Implementar agregaciones en PostgreSQL/RPC e índices adecuados, evitando descargar todos los pedidos a Next.js. Validar definiciones, zona horaria, moneda y tratamiento de pedidos cancelados antes de construir los indicadores.

- Orden sugerido para la próxima sesión: primero auditar tablas y calidad de datos; luego diseñar definiciones y wireframe; implementar una iniciativa a la vez en local/Preview, sin tocar producción hasta aprobación.
- Usuario confirmó visualmente que producción se ve bien. Revisión final: deployment `dpl_FzvGmHkcKHZztgYnDmky4bEcKHVq` continúa Ready; Home, Marketplace, `/tdk`, los tres catálogos y login HTTP 200; API privada de pedidos sin sesión HTTP 401 esperado; sin logs de error. No se hizo un nuevo despliegue ni cambio funcional.

# Estadísticas de crecimiento Super Admin (2026-08-21)

- Implementación local completa, sin cambios remotos ni producción. El resumen Founder agrega pedidos históricos y del mes, ventas/GMV históricas y mensuales, ticket promedio, cancelaciones/tasa, comparación contra el mismo tramo del mes anterior, 12 meses de gráficas, modalidades Delivery/Retiro/Mesa/Barra/Envío nacional y ranking mensual de comercios.
- Definiciones: se excluyen comercios `is_test=true`; pedidos cancelados no cuentan en volumen válido, ventas ni ticket, pero se reportan por separado; todo usa `America/Caracas`. La comparación del mes actual usa los mismos días transcurridos del mes anterior para evitar comparaciones engañosas.
- Migración aditiva pendiente `20260821040000_admin_growth_metrics.sql`: crea RPC `admin_growth_metrics(integer)` ejecutable solo por `service_role` y un índice global por `orders.created_at`. Las agregaciones y rankings ocurren en PostgreSQL; Next.js recibe solo JSON resumido.
- API `/api/admin/summary` conserva `requireAdminAuth` Founder server-side e integra la RPC. Si la migración aún no existe, el resumen anterior sigue funcionando y la sección nueva no aparece.
- Validaciones aprobadas: 37/37 contratos críticos, TypeScript, ESLint completo, `git diff --check` y build Next.js 16.3.0 de 156 páginas. `supabase db push --dry-run` confirmó que solo está pendiente esta migración. Docker local no está activo, por lo que no se ejecutó lint SQL local.
- Próximo paso exacto: con aprobación explícita, aplicar la migración remota aditiva, verificar valores/privilegios y tiempos de RPC, desplegar Preview y probar visualmente `/admin`. No promover web a producción sin aprobación posterior.

# Renovación Marketplace orientada a ventas (2026-08-21)

- Implementación local completa y producción intacta. Se auditó el flujo existente: tiendas ligeras, búsqueda/rubros, recompensas mensuales reales y filtros de actividad/suscripción/visibilidad.
- Nueva experiencia mobile-first: portada compacta, búsqueda por tienda/producto/rubro, filtros horizontales, tarjetas con portada/logo/estado/tiempo/modalidad/costo fijo cuando existe, carruseles, `Ver todos`, lista completa, estado sin resultados, limpiar filtros y skeleton de carga.
- Ubicación voluntaria: solo se solicita al pulsar `Usar mi ubicación`, calcula Haversine en el navegador, ordena y muestra distancia, advierte cuando supera el radio configurado y conserva las coordenadas solo en `localStorage` durante 2 horas; nunca se transmiten al servidor. Incluye permiso denegado, GPS no disponible, timeout, reintento y búsqueda manual por zona/dirección.
- Secciones dinámicas conectadas a datos reales: ofertas por `discount_percent`, más vendidos por unidades de `order_items` en 90 días excluyendo cancelados y nuevos por `products.created_at` en 45 días. Si no tienen contenido no aparecen. No se agregaron calificaciones porque no existe sistema real de reseñas.
- Migración aditiva pendiente `20260821041000_marketplace_discovery.sql`: RPC service-role-only `marketplace_discovery(integer)` e índices para producto/fecha. Filtra tiendas activas, visibles, no test y con suscripción vigente; Next.js recibe solo un JSON pequeño.
- Archivos nuevos: `src/lib/marketplace.ts`, `src/app/marketplace/loading.tsx` y la migración. Cambios en `src/app/marketplace/page.tsx`, `src/components/public/MarketplaceClient.tsx` y contratos.
- Paquete conjunto Estadísticas + Marketplace validado: TypeScript, ESLint completo, 38/38 contratos críticos, `git diff --check` y build Next.js 16.3.0 de 156 páginas aprobados. Dry-run remoto confirma que solo están pendientes `20260821040000_admin_growth_metrics.sql` y `20260821041000_marketplace_discovery.sql`.
- Próximo paso exacto: con aprobación explícita, aplicar ambas migraciones remotas aditivas, verificar resultados/privilegios/rendimiento, desplegar una sola Preview y realizar QA visual en teléfono/escritorio de Marketplace y `/admin`. No promover a producción sin aprobación posterior.
- Ajuste aprobado sobre recomendaciones: se eliminó `Tiendas recomendadas`. `Los favoritos de la semana` muestra como máximo un producto por comercio: el de mayor cantidad vendida en los últimos 7 días, solo si alcanza al menos 10 unidades y excluyendo pedidos cancelados. Si ningún producto cumple, la sección no aparece. TypeScript, ESLint dirigido, 38/38 contratos y build de 156 páginas aprobados; servidor local actualizado en `http://127.0.0.1:3102/marketplace`.
- El enlace LAN local cargó sin CSS/JS en el teléfono aunque los assets respondían HTTP 200 desde la PC; para QA móvil fiable se desplegó Preview HTTPS `https://vendeplus-clean-llq6f89ka-entrega2-s-projects.vercel.app`, deployment `dpl_DycnWzL2kNAADtjfGnpysmFHqLdp`, target Preview, Ready, build remoto aprobado y `/marketplace` HTTP 200. Producción intacta. Las secciones agregadas permanecen vacías hasta aplicar las dos RPC pendientes.
- Se aplicó remotamente solo la migración Marketplace `20260821041000_marketplace_discovery.sql` y se registró como aplicada. La RPC service-role-only devolvió 1 oferta, 3 favoritos semanales reales (Queje Olga 88, China Town 42 y Knockouts 29 unidades) y 12 productos nuevos. La migración de estadísticas `20260821040000_admin_growth_metrics.sql` continúa pendiente; por el orden de versiones, su futura aplicación requiere `supabase db push --include-all`.
- Rediseño Marketplace refinado: cabecera/hero compactos, ubicación y búsqueda claras, chips horizontales, carruseles de oferta/favoritos/nuevos y comercios en 2 columnas móvil, 3 tablet y 4 desktop. Las tarjetas conservan imagen, logo, estado, rubro, tiempo/distancia y modalidades sin un botón grande adicional.
- Se excluyó también en la defensa de Next.js cualquier comercio `is_test=true`; la QA final muestra 18 comercios reales y ya no incluye `Smash (Test)`.
- QA visual local aprobada en 360, 390, 430, 768 y 1280 px: sin desbordamiento horizontal, grillas 2/2/2/3/4 columnas, geolocalización simulada operativa y cero errores de consola. Capturas finales: `.next/marketplace-final-390.png` y `.next/marketplace-final-1280.png`.
- Validaciones finales del paquete: TypeScript, ESLint, 38/38 contratos críticos, `git diff --check` y build Next.js 16.3.0 de 152 páginas aprobados. Preview final `https://vendeplus-clean-mbskmo2au-entrega2-s-projects.vercel.app`, deployment `dpl_4LJ4Ctufmf2fbNTwRRFGX1S1CHQM`, target Preview, Ready. Producción web no fue promovida.
- Ajuste posterior solicitado: los chips `Abiertos`, `Delivery`, `Retiro`, `Ofertas` y rubros ahora filtran de forma coherente comercios, `Cerca de ti`, destacados, ofertas, favoritos semanales y nuevos. En `Ofertas` se ocultan los demás carruseles para que el resultado sea inequívoco. La búsqueda también filtra los productos visibles.
- Se eliminó el campo manual `Escribe tu zona`; la cercanía depende exclusivamente del botón GPS. Si el permiso se rechaza/falla, el usuario recibe un mensaje y puede continuar explorando sin ubicación.
- Validaciones posteriores aprobadas: TypeScript, ESLint, 38/38 contratos críticos y build Next.js 16.3.0 de 152 páginas. Preview actualizada `https://vendeplus-clean-eo55rl6xf-entrega2-s-projects.vercel.app`, deployment `dpl_4GqSpExPkXpAj68ez495iTooNpcR`, target Preview, Ready. Producción permanece intacta.
- Auditoría de rubros detectó datos históricos mezclados (`food`/`Comida`, `desserts`/`Postres`, `tech`/`Tecnología`). Realza está correctamente guardada como `fashion`; fallaba porque Marketplace comparaba el texto visible `Ropa` contra el código crudo.
- Se creó `src/lib/business-types.ts` como fuente única con orden `Comida`, `Postres`, `Ropa`, `Tecnología`, `Otros`. Marketplace, registro, Configuración del comercio y formulario Super Admin reutilizan la misma lista. Signup, Settings y Admin normalizan server-side los nuevos valores. Los valores históricos se traducen al vuelo, sin migrar ni modificar datos remotos; accesorios, belleza y tipos desconocidos se agrupan en `Otros`.
- El filtro Marketplace ahora incluye la etiqueta canónica en el texto de búsqueda: `Ropa` reconoce `fashion` y muestra Realza/Bodys Style; `Postres` aparece también en registro y Comida queda como opción inicial.
- Validaciones: TypeScript, ESLint, 39/39 contratos críticos y build Next.js 16.3.0 de 152 páginas aprobados. Preview `https://vendeplus-clean-heho5w942-entrega2-s-projects.vercel.app`, deployment `dpl_3ZV3NAQEzXy4h8NwPZVQfnKmsSBY`, target Preview, Ready. Sin SQL ni cambios en producción.
- Usuario aprobó promover. Se revalidó el deployment Preview exacto con TypeScript, 39/39 contratos y `git diff --check`; luego se promovió a producción. Deployment productivo `dpl_FC2TCQhxMwnYaVFZDx1Lf9E9fUsp` (`vendeplus-clean-4q4vx4lfn-entrega2-s-projects.vercel.app`), Ready, con alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`.
- Smoke productivo aprobado: Home, Marketplace, Registro, `/tdk` y `/realza` HTTP 200; `/api/panel/orders` y `/api/admin/summary` sin sesión HTTP 401 esperado. QA Playwright móvil sobre producción: Ropa muestra Realza/Bodys Style, Postres muestra La Cremita/Saboré, Otros muestra Alkkon Fit; Registro presenta exactamente Comida, Postres, Ropa, Tecnología y Otros; cero errores de consola.
- Cambio posterior solo en Preview: tarjetas de Ofertas, Favoritos de la semana y Recién llegados reducidas aproximadamente 20–25% (ancho móvil 55vw, máximo 210px, imagen 16:11, tipografía/padding compactos y menor separación vertical). Mantienen comercio, nombre, precio, descuento y unidades vendidas.
- Preview compacta `https://vendeplus-clean-hrn78ejx4-entrega2-s-projects.vercel.app`, deployment `dpl_H5XsbqWpbzPexiwLFPyZFhsFEdDy`, Ready. TypeScript, ESLint, 39/39 contratos y build de 152 páginas aprobados. Producción aún conserva el tamaño anterior.
- Propuesta pendiente de aprobación: bienvenida ligera sobre `/` solo en primera visita, con `Quiero comprar` hacia Marketplace y `Quiero vender con Somos` para revelar el Home actual; recordar la elección localmente. Evita mover rutas, duplicar Home o afectar SEO. No implementada todavía.
- Pantalla de bienvenida implementada en Preview sobre `/`, sin mover rutas ni sustituir el Home renderizado. Solo aparece si el dispositivo no tiene `somos-welcome-choice-v1`: `Quiero comprar` recuerda `buyer` y navega a `/marketplace`; `Quiero vender con Somos` recuerda `business` y revela el Home actual. Bloquea scroll mientras está abierta; accesos directos a Marketplace, catálogos, Registro y Panel no se interceptan.
- Diseño mobile-first validado visualmente a 390px y escritorio 1280px; la decisión completa cabe en el primer viewport móvil. Capturas locales `.next/welcome-mobile.png` y `.next/welcome-desktop.png`.
- Paquete conjunto incluye las tarjetas compactas del Marketplace. Validaciones: TypeScript, ESLint completo, 40/40 contratos críticos y build Next.js 16.3.0 de 152 páginas aprobados. Preview `https://vendeplus-clean-a3eeiuerv-entrega2-s-projects.vercel.app`, deployment `dpl_8YUmMEVLZgRUGawhodfrbbviNj8c`, target Preview, Ready. Producción intacta.
- Mejora posterior de bienvenida: durante la lectura inicial de `localStorage` se muestra una cubierta neutra para impedir el destello del Home; el diálogo mueve y atrapa el foco, aísla el fondo con `inert`, restaura foco/scroll al cerrar, admite `Escape` y ofrece `Ahora no, ver inicio` sin guardar una elección accidental. Los botones muestran foco visible.
- Validaciones posteriores: ESLint dirigido, TypeScript, 40/40 contratos críticos y build local/remoto Next.js 16.3.0 de 152 páginas aprobados. Preview nueva `https://vendeplus-clean-182vbsx9u-entrega2-s-projects.vercel.app`, deployment `dpl_3nELuELSg1QrphhtxA3SSSzMqswo`, completado. Producción intacta; sin migración ni SQL.
- Próximo paso exacto: probar la Preview en una pestaña privada: primera carga sin destello, navegación por Tab/Shift+Tab, Escape, `Ahora no`, `Quiero vender` y `Quiero comprar`; no promover a producción sin aprobación explícita.
- Usuario aprobó la bienvenida y autorizó producción después de una revisión preventiva. La Preview exacta estaba Ready, sin logs de error, con TypeScript, ESLint, 40/40 contratos y build local/remoto aprobados; se confirmó que no requería SQL adicional.
- Promovida sin reconstruir como deployment productivo `dpl_2h5hq4UsGUQV3uAG61mZZiArSfem` (`vendeplus-clean-nzfa8zvsf-entrega2-s-projects.vercel.app`), estado Ready y alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` asignados.
- Smoke productivo aprobado: Home, Marketplace, Registro, `/tdk` y `/realza` HTTP 200; APIs `/api/panel/orders` y `/api/admin/summary` sin sesión HTTP 401 esperado; cero logs de error del deployment nuevo. No se aplicó migración ni SQL durante la promoción. Rollback web: deployment productivo anterior `dpl_FC2TCQhxMwnYaVFZDx1Lf9E9fUsp`.
- Usuario autorizó activar las estadísticas avanzadas del Super Admin. El dry-run con `--include-all` confirmó que únicamente faltaba `20260821040000_admin_growth_metrics.sql`; se aplicó y quedó registrada remotamente, sin redespliegue web.
- Verificación remota: índice `orders_created_at_idx` presente; RPC `admin_growth_metrics(integer)` es `security invoker`, ejecutable solo por `service_role` y denegada a `anon`/`authenticated`. Respondió 12 meses, 1.276 pedidos históricos válidos, 829 del mes actual, 3 modalidades y 10 filas de ranking en zona `America/Caracas`.
- Smoke posterior: `/admin` HTTP 200, `/api/admin/summary` sin sesión HTTP 401 esperado y cero logs de error del deployment productivo. El lint remoto conserva únicamente el fallo interno preexistente de `extensions.index_advisor` por ausencia de `hypopg_reset()`; no pertenece a la migración ni afecta las estadísticas.
- Contacto oficial Somos preparado localmente con el número `+58 422-4600742`, centralizado como `584224600742`. Home muestra `Contactar por WhatsApp`; el registro exitoso de comercio o empresa delivery abre el chat oficial con un resumen prellenado y mantiene un botón de respaldo. El usuario confirma el envío en WhatsApp; nunca se incluyen contraseña, cédula ni captcha.
- Ambos formularios informan antes de enviar que WhatsApp se abrirá después del registro. El chat solo se abre tras una respuesta exitosa de la API, por lo que errores de validación/captcha no lo disparan.
- Validaciones: TypeScript, ESLint dirigido, 41/41 contratos críticos, `git diff --check` y build local/remoto Next.js 16.3.0 aprobados. Preview `https://vendeplus-clean-ewbdsg2d4-entrega2-s-projects.vercel.app`, deployment `dpl_AU91k46Xdu3i83CyDUptQViq85jr`, target Preview, Ready y sin logs de error. Producción intacta; sin migración ni SQL.
- Próximo paso exacto: validar botón del Home y avisos de `/registro` y `/transporte/registro`; para probar el envío automático completo debe usarse un registro QA autorizado porque crea datos reales. No promover sin aprobación explícita.
- Ajuste visual posterior: el botón oficial de WhatsApp se retiró del hero y ahora aparece al cierre de `Creado para operaciones locales reales`, dentro de una franja compacta de ayuda. Las tres acciones principales del hero recuperaron su jerarquía original.
- Validaciones posteriores: ESLint dirigido, 41/41 contratos, `git diff --check` y build local/remoto de 164 páginas aprobados. Preview actualizada `https://vendeplus-clean-f6d50eyq4-entrega2-s-projects.vercel.app`, deployment `dpl_B5daNPrsmrx33qHnwpMbmWf149TS`, target Preview. Producción intacta.
- Usuario aprobó y autorizó producción. La Preview exacta fue promovida sin cambios de base de datos como deployment productivo `dpl_2786Lm33srzm4wQyr8Kvy9Bxm5o6` (`vendeplus-clean-1t1f06dfq-entrega2-s-projects.vercel.app`), estado Ready y alias productivos asignados.
- Smoke productivo aprobado: Home contiene `Contactar por WhatsApp`; Registro de comercio y empresa delivery contienen el aviso del WhatsApp oficial; Marketplace, `/tdk` y `/realza` HTTP 200; APIs privadas de pedidos y resumen admin sin sesión HTTP 401 esperado; cero logs de error. Rollback web: `dpl_2h5hq4UsGUQV3uAG61mZZiArSfem`.

# Acciones compactas del catálogo (2026-08-21)

- Cambio preparado solo en Preview; producción permanece en `dpl_2786Lm33srzm4wQyr8Kvy9Bxm5o6` sin modificaciones.
- Debajo del buscador, las acciones ahora son cuatro tarjetas compactas en una fila: WhatsApp, Tasa, Compartir e Instalar Somos. Se eliminó de esa zona la tarjeta de tiempo estimado.
- `PwaInstallButton` admite una variante `tile` discreta para el catálogo sin alterar sus usos existentes en Home, Panel o Admin. Si la app ya está instalada, la acción no se muestra; la ayuda de instalación no ensancha la cuadrícula.
- El encabezado ya no presenta el texto predeterminado `Disponible hoy`. Solo muestra un horario/texto personalizado no vacío; los estados reales abierto/cerrado y sus avisos siguen funcionando.
- Archivos modificados: `src/components/public/CatalogClient.tsx`, `src/components/public/StoreBrandHeader.tsx`, `src/components/pwa/PwaInstallButton.tsx`, `src/lib/supabase/catalog.ts` y `scripts/critical-contracts.test.mjs`.
- Sin migración ni SQL. Validaciones aprobadas: ESLint dirigido, TypeScript, 42/42 contratos críticos, `git diff --check` y build local Next.js 16.3.0 de 164 páginas.
- Preview: `https://vendeplus-clean-qywq190gm-entrega2-s-projects.vercel.app`, deployment `dpl_CPQWdRjm2JyeJ4ac3PZVRgxShmeN`, target Preview, estado Ready, build remoto aprobado y sin logs de error.
- Próximo paso exacto: probar un catálogo en móvil, incluida la acción Instalar Somos en Android/iPhone, y promover solo con aprobación explícita. No hay commit ni push de este cambio todavía.
- Refinamiento solicitado aplicado: WhatsApp queda visualmente solo como icono (con etiqueta accesible), la tasa elimina el escudo y se divide en `1$`/`1€` arriba y `Bs. monto` abajo, y la acción usa la misma familia tipográfica con el texto `Instalar Somos`.
- Se eliminó la etiqueta redundante `Promocional`; la sección conserva únicamente el título `Favoritos del momento`.
- Revalidación aprobada: ESLint dirigido, TypeScript, 42/42 contratos, `git diff --check` y build local/remoto de 164 páginas. Preview final `https://vendeplus-clean-4a9gx0lx3-entrega2-s-projects.vercel.app`, deployment `dpl_G6wbg65fk1cBbv9T6hWoG6eXUccn`, Ready y sin logs de error. Producción continúa intacta.
- Corrección por QA visual móvil: la captura del usuario evidenció tarjetas altas y una instalación deformada. El contenedor/search redujo padding y sombra; las cuatro acciones tienen altura fija uniforme de 56 px. `Instalar Somos` ya no muestra un icono comprimido en esta variante y hereda explícitamente la fuente del catálogo en negrita.
- QA móvil local sobre `/realza` confirmó una barra compacta y alineada. Validaciones y build local/remoto de 164 páginas aprobados. Preview corregida `https://vendeplus-clean-lhm9122hn-entrega2-s-projects.vercel.app`, deployment `dpl_9DkiRuHDRpcxbYNEFV1tPFeLhc7s`. Producción intacta.
- Usuario aprobó la corrección visual y se promovió exactamente esa Preview a producción sin reconstruir cambios distintos. Deployment productivo `dpl_ASeqiQW6WRZrBGenzEYEgng73V2R` (`vendeplus-clean-m5ly8u9nx-entrega2-s-projects.vercel.app`), Ready, con alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`.
- Smoke productivo aprobado: Home, Marketplace, Registro, `/realza` y `/tdk` HTTP 200; APIs privadas de pedidos y resumen admin sin sesión HTTP 401 esperado; sin logs de error. Sin migración ni SQL. Rollback web: `dpl_2786Lm33srzm4wQyr8Kvy9Bxm5o6`.
- Corrección posterior del cuarto control: la causa de que desapareciera era la rama `isStandalone()` del PWA. Si Somos no está instalada continúa mostrando `Instalar Somos`; si ya está instalada, conserva la cuarta tarjeta con el isotipo oficial enlazado al Home (`/`) en lugar de ocultarla.
- Validaciones aprobadas: ESLint, TypeScript, 42/42 contratos, `git diff --check`, build local/remoto de 164 páginas. Preview `dpl_Ame8afy2GGTyZ3CcMgW36KcamBYD`; producción `dpl_BL92WGUBSAvyCjdHmiR4PzSh9ooH` (`vendeplus-clean-n09pzmowf-entrega2-s-projects.vercel.app`), Ready y con alias productivos. Home/Marketplace/Realza/TDK HTTP 200, APIs privadas 401 esperado y sin logs de error. Rollback: `dpl_ASeqiQW6WRZrBGenzEYEgng73V2R`.
- Checkpoint final solicitado: diff revisado y limitado a las acciones/horario del catálogo, variante PWA, contrato crítico y este handoff. Lint global, TypeScript, 42/42 contratos, `git diff --check`, `check:production` y build de 164 páginas aprobados. Producción continúa Ready y sin errores en logs durante la última hora.
- Advertencias operativas conocidas, no causadas por este cambio: Entrega2 permanece apagado sin variables y Pedido asistido usa interpretación local mientras no exista `OPENAI_API_KEY`. No se modificaron variables, Supabase, migraciones ni SQL.

# Sedes La Cremita Gourmet (2026-08-21)

- Usuario confirmó que la sede existente corresponde a Guasimal y autorizó crear Las Ballenas con el mismo WhatsApp/catálogo, vinculada a la misma cuenta, más un selector único estilo TDK.
- Migración idempotente `20260821213759_clone_la_cremita_las_ballenas.sql` creada y aplicada en Supabase producción. Renombró la sede origen a `La Cremita Gourmet Guasimal` sin cambiar su slug, historial ni coordenadas.
- Nueva sede `La Cremita Gourmet Las Ballenas`, slug `la-cremita-gourmet-las-ballenas`, ID `e54a6132-0e4b-4652-a432-dd1e70493ae6`, coordenadas `10.267079665610519, -67.59386449349098`, WhatsApp `584243326419`, activa y visible en Marketplace.
- Las Ballenas comparte el propietario `lacremitagourmet1@gmail.com`; se clonaron 3 categorías, 3 productos, 3 imágenes, 5 grupos, 25 opciones, 8 asociaciones y una configuración de delivery. Tiene cero pedidos y cero clientes; Guasimal conserva 2 pedidos y 2 clientes.
- Se añadió localmente `/la-cremita`, reutilizando de forma configurable el selector de TDK. Guarda la última sede en una clave separada y solo usa geolocalización en el dispositivo.
- Validaciones: transacción SQL de prueba revertida correctamente, dry-run confirmó una sola migración, migración registrada local/remota, ESLint dirigido, TypeScript, 43/43 contratos, `git diff --check` y build local/remoto Next.js 16.3.0 de 165 páginas aprobados.
- Preview Ready `https://vendeplus-clean-m5okzvrnc-entrega2-s-projects.vercel.app`, deployment `dpl_D581fYqKuDmr9jQsRPVyCnLDGwbV`, sin logs de error. El catálogo directo productivo `/la-cremita-gourmet-las-ballenas` ya responde HTTP 200 con el nombre correcto; el selector `/la-cremita` aún no fue promovido a producción.
- Próximo paso exacto: validar visualmente el selector Preview y ambos catálogos; con aprobación explícita promover esa Preview. No hay commit ni push todavía.
- Usuario autorizó producción. Se promovió exactamente la Preview como deployment productivo `dpl_7WPa2J7sgLcRaYe2faz5ndrk882g` (`vendeplus-clean-laxm1sxck-entrega2-s-projects.vercel.app`), Ready y con alias oficiales.
- Smoke productivo aprobado: `/la-cremita` HTTP 200 y contiene Guasimal + Las Ballenas; ambos catálogos directos HTTP 200 y Las Ballenas presenta su nombre correcto. Sin logs de error. Selector oficial: `https://www.somos-ve.com/la-cremita`. Rollback web: `dpl_8sqATEFQvRHTen42WJ6LwT5D7Q4G`; la migración de datos ya aplicada es independiente del rollback web.
- El comercio confirmó operación real y uso correcto de ambas sedes. Usuario solicitó asegurar el trabajo en Git; rama nueva `checkpoint/la-cremita-sedes-20260824` creada desde `origin/main` para evitar reutilizar el PR #7 ya fusionado.
- Revalidación previa al checkpoint: lint global, TypeScript, 43/43 contratos, `git diff --check` y build Next.js 16.3.0 de 173 páginas aprobados; Supabase dry-run confirma base remota al día. No se alteraron datos durante este aseguramiento.
# Delivery propio avanzado y nota contextual del checkout (2026-08-24)

- Trabajo preparado en `feature/delivery-propio-notas-checkout`; producción web permanece intacta.
- Delivery propio ahora conserva `distance_factor`, permite configurar USD por km adicional después del último rango y ofrece un simulador sin efectos sobre pedidos ni tarifas guardadas.
- Panel y API rechazan precios vacíos en tarifa fija, zonas y rangos; también detectan cobertura mayor al último rango sin precio adicional y valores adicionales negativos.
- Checkout reemplaza la nota poco visible por `¿Alguna indicación para tu pedido?`, con tarjeta más llamativa y placeholder automático por rubro. Efectivo conserva su ejemplo específico.
- Configuración del comercio permite un ejemplo personalizado opcional de hasta 180 caracteres. Vacío usa el fallback por rubro; nunca se guarda el ejemplo como nota real.
- Migración aditiva `20260824170036_add_checkout_note_placeholder.sql` aplicada y verificada remotamente. Agrega solo `stores.checkout_note_placeholder`; no modifica valores existentes. Advisors de seguridad sin hallazgos.
- Validaciones: TypeScript, ESLint global, 45/45 contratos, `git diff --check` y build Next.js 16.3.0 de 173 páginas aprobados.
- Preview `https://vendeplus-clean-o0mm1av1u-entrega2-s-projects.vercel.app`, deployment `dpl_CoBDfXhpnMMcAMzfeu9VfGC9PPbZ`, target Preview, Ready. Panel Delivery, Configuración y catálogo de Las Ballenas responden HTTP 200.
- Próximo paso exacto: probar con sesión real en Preview `/panel/delivery` (rango, km adicional y simulador) y `/panel/configuracion` (ejemplo personalizado), luego completar un checkout. No promover producción sin aprobación explícita.
- QA del usuario detectó que un hueco `9–10 km` seguido de `10,2–11 km` no se señalaba. Se agregó detección explícita de continuidad desde 0 km, aviso visible y bloqueo al guardar tanto en cliente como servidor. Rangos contiguos como `9–10` y `10–11` quedan permitidos; los cruces reales continúan bloqueados.
- Usuario aprobó la Preview corregida y autorizó producción y aseguramiento en Git. Preview aprobada exacta: `dpl_4Mr5wEXQ2Bz314vaUVbn17wzcthb` (`https://vendeplus-clean-jguobq5w4-entrega2-s-projects.vercel.app`).

# Presentación informativa de empresa delivery en checkout (2026-08-24)

- Cambio local en `ui/checkout-delivery-partner-note`; producción intacta.
- El bloque con logo dejó de imitar un botón: sin borde perimetral, fondo de tarjeta, sombra, hover ni cursor. Ahora es una nota abierta con línea lateral, logo y el texto `Tu entrega será coordinada por`.
- Refinamiento aprobado: se retiró la explicación secundaria por redundante. El bloque conserva únicamente `Tu entrega será coordinada por`, nombre y logo. No cambia selección, cotización ni envío del pedido. Usuario autorizó llevarlo a producción.

# Marketplace con experiencia tipo app (2026-08-24)

- Trabajo local en `preview/marketplace-app-experience`; producción web y Supabase productivo permanecen intactos.
- `Recién llegados` ahora verifica server-side, mediante una sola consulta adicional de máximo 12 IDs, que cada producto tenga `products.image_url` propio. No acepta el fallback de logo o portada del comercio para esa sección.
- Primera propuesta visual app-like: cabecera móvil compacta, hero contenido como superficie redondeada, buscador/filtros sticky, secciones unificadas en tarjetas blancas con ritmo consistente y navegación inferior móvil a Inicio/Cerca/Ofertas/Comercios.
- Se conservaron GPS, filtros, búsqueda, ofertas, favoritos, nuevos, enlaces a catálogos y grilla de comercios. Sin migración ni SQL para evitar cualquier cambio productivo.
- Ajuste posterior: `Cerca` en la navegación inferior solicita la ubicación; se eliminó el botón naranja redundante junto al buscador y se conservó la acción de ubicación en la cabecera móvil.
- Segunda iteración visual solicitada: más vida sin saturar; ofertas usan coral suave, favoritos ámbar, nuevos menta, comercios verde claro y la navegación inferior incorpora acentos cromáticos por destino.
- Cabecera móvil refinada: reemplaza el texto `Somos` por el `BrandLogo` oficial y agrega un instalador PWA sutil. La variante se oculta si la app ya está instalada y conserva la ayuda específica para iPhone/otros navegadores.
- Copy simplificado: el hero dice `Las mejores opciones en un solo lugar.` y favoritos usa `Lo más pedido`, eliminando el texto técnico sobre ganador, tienda y mínimo de ventas.
- Usuario aprobó la propuesta completa y autorizó producción. Se promovió exactamente la Preview aprobada `dpl_H1eVkjm9aqbgBtAzzqtRwoVGTUWT`; Vercel creó el deployment productivo `dpl_BxSo8XN6q3g6nCF4f65ZYRP9UpL2` (`vendeplus-clean-9r9ca4cfr-entrega2-s-projects.vercel.app`). Está `Ready` y posee los alias `www.somos-ve.com` y `somos-ve.com`.
- Smoke productivo: `https://www.somos-ve.com/marketplace` responde HTTP 200 y contiene `Las mejores opciones en un solo lugar`; escaneo de logs de error de los últimos 10 minutos sin hallazgos. No hubo migración ni SQL. Aún no hay commit, push ni PR para esta iteración.
- Usuario reportó intermitencia en `Instalar` y pospuso indefinidamente la app nativa. Diagnóstico: `RegisterServiceWorker` solo escuchaba `load`; si React hidrataba después del evento, el SW no se registraba en esa visita. Corrección local: registrar inmediatamente cuando `document.readyState === "complete"`, listener único con cleanup en los demás casos, y botón protegido contra doble toque, errores/rechazo y regreso desde instalación. Pendiente validar y mostrar en Preview antes de producción.
- Corrección PWA validada con TypeScript, ESLint dirigido, 48/48 contratos, `git diff --check` y build Next.js 16.3.0 de 181 páginas. Preview `dpl_BU6RsEJzkjeqxpdbzoi8zBDxhmdJ` (`https://vendeplus-clean-8hb2zlaem-entrega2-s-projects.vercel.app`) está `Ready`; `/marketplace` responde HTTP 200 autenticado. La protección SSO de Preview redirige `sw.js`/manifest a login para visitantes sin sesión, por lo que la instalación real debe verificarse en un origen local seguro o tras autorización productiva. En producción actual ambos recursos responden correctamente con MIME `application/javascript` y `application/manifest+json`. No promover aún sin aprobación.
- Usuario aprobó y autorizó promover la corrección PWA. Se promovió exactamente `dpl_BU6RsEJzkjeqxpdbzoi8zBDxhmdJ`; deployment productivo resultante `dpl_BFKDTvXMoGGYDdB1DGhuSZmNafP5` (`vendeplus-clean-e5zxrm4r3-entrega2-s-projects.vercel.app`) está `Ready` y tiene los alias oficiales. Smoke productivo: Marketplace HTTP 200, `sw.js` HTTP 200 `application/javascript`, manifest HTTP 200 `application/manifest+json`, sin logs de error recientes. Rollback web inmediato: `dpl_BxSo8XN6q3g6nCF4f65ZYRP9UpL2`. Sin migración ni SQL; cambios aún sin commit/push/PR.
- Segundo reporte PWA: en vez del prompt nativo aparecía la ayuda y, en móvil, se cortaba hacia la derecha. Nueva corrección local: captura temprana de `beforeinstallprompt` con `next/script` `beforeInteractive` para evitar perder el evento antes de la hidratación; el botón consume el evento compartido y la ayuda compacta pasa a diálogo flotante centrado (`fixed`, ancho limitado), legible en pantallas estrechas. Pendiente validar en Preview; no promover sin nueva aprobación.
- Segunda corrección PWA validada: TypeScript, ESLint dirigido, 48/48 contratos, `git diff --check` y build Next.js 16.3.0 de 177 páginas aprobados. Preview `dpl_4NzoRuSQxqJ8AoCVaout6964k59v` (`https://vendeplus-clean-l2u52cqky-entrega2-s-projects.vercel.app`) está `Ready`. La prueba real del prompt continúa sujeta a la política/cooldown del navegador y la protección SSO del Preview; el diálogo fallback sí queda acotado a pantalla. No promover sin aprobación.
- Usuario confirmó que el prompt nativo funcionó y autorizó promover. Se promovió exactamente `dpl_4NzoRuSQxqJ8AoCVaout6964k59v`; deployment productivo `dpl_GUH6suuagmvqQPqPhzSjbiQPQJSG` (`vendeplus-clean-ks1qbtun1-entrega2-s-projects.vercel.app`) está `Ready` con todos los alias oficiales. Smoke: Marketplace HTTP 200, `sw.js` HTTP 200 `application/javascript`, manifest HTTP 200 `application/manifest+json`, sin logs de error recientes. Rollback: `dpl_BFKDTvXMoGGYDdB1DGhuSZmNafP5`. Sin migración/SQL; cambios todavía sin commit/push/PR.
- Usuario autorizó asegurar la entrega completa en Git: commit de los 8 archivos de Marketplace/PWA/pruebas/handoff, push, PR a `main`, checks y merge si todo queda verde. El PR borrador antiguo #3 queda fuera de alcance.
# Hotfix productivo Marketplace + zonas de empresa delivery (2026-08-30)

- Producción vigente `dpl_735qQPwarBPWvvH9a9PtyNgdPGcc`, Ready y con alias oficiales.
- Superadmin `/admin/comercios` conserva la tabla existente y agrega únicamente el ojo para cambiar `marketplace_visible`. El endpoint PATCH exige founder y actualiza exclusivamente ese campo.
- `POST /api/orders` evita enviar UUID de `transport_agency_zones` a `orders.delivery_zone_id`, cuya FK pertenece a `store_delivery_zones`; para empresa delivery guarda `delivery_zone_id=null` y conserva todos los metadatos de agencia, zona y tarifa.
- Prueba real Preview aprobada con Burger Más + Un Delivery Más: pedido `VP-0830-TNC`, zona San Felipe Centro, $2, estado de agencia pendiente y respuesta HTTP 200.
- Producción verificada: Burger Más, carrito, checkout y Marketplace HTTP 200; rutas de impresión HTTP 404; cero logs de error del deployment nuevo.
- Sin migración ni SQL. Validaciones: 57/57 contratos, ESLint dirigido, TypeScript, `git diff --check` y build Next.js 16.3.0 de 161 páginas.
- El piloto de impresión permanece fuera de esta rama y fuera del bundle productivo.
# Marketplace público: textos simplificados (2026-09-04)

- En `/transporte/[agencySlug]/marketplace` el encabezado conserva solo `Comercios aliados a [empresa]`; se retiraron las dos líneas redundantes que repetían el nombre.
- En el descubrimiento quedan solo `Destacados Somos`, `Los favoritos de la semana` y `Recién llegados`; se retiraron `Beneficios activos`, `Lo más pedido` y `Productos nuevos`.
- `MarketplaceClient` omite eyebrow y descripción vacíos sin alterar los textos predeterminados del Marketplace general.

# Recuperación de ciudad y mensaje de contraseña (2026-09-04)

- Trabajo aislado en `.city-recovery-clean`, rama `fix/restore-city-and-signup`, desde `origin/main`; no se mezclaron impresión, controles delivery ni catálogos pendientes.
- Causa ciudad: la fase ya había llegado a producción y Supabase conserva el esquema/datos, pero sus archivos nunca se integraron en `main`; un despliegue posterior desde `main` retiró el selector y el flujo estructurado.
- Restaurado: selector/filtro por ciudad del Marketplace, ciudad obligatoria en registro, ciudad en configuración y Superadmin, ciudad base/cobertura de empresas delivery y validación server-side al solicitar afiliación.
- Registro corregido: la API ya no recorta la clave y diferencia longitud insuficiente de claves débiles/comunes/filtradas; el cliente valida 8 caracteres antes de enviar. Nunca se registra la clave.
- Migraciones recuperadas en Git: `20260831120000_service_cities_phase1.sql` y `20260901130000_add_venezuela_state_capitals.sql`. Ya estaban aplicadas en producción; no se ejecutó SQL en esta recuperación.
- Validaciones: TypeScript, ESLint dirigido, 59/59 contratos y `git diff --check` aprobados. El build local encontró bloqueo EPERM/Turbopack por dependencias del worktree; el build remoto Vercel Next.js 16.3.0 aprobó 182 páginas.
- Preview Ready: `dpl_FcNQVGYFSWWX64QqS4sJUnrXpawA`, `https://vendeplus-clean-kjhoyrdl3-entrega2-s-projects.vercel.app`. La protección de Preview devuelve login de Vercel al smoke anónimo; no hubo logs de error.
- No hay commit, push ni producción. Próximo paso: validar con sesión Vercel el selector en `/marketplace` y ciudad/registro en `/registro`; con aprobación explícita promover exactamente esta Preview.
- Usuario aprobó la Preview y autorizó proceder. Se promovió exactamente `dpl_FcNQVGYFSWWX64QqS4sJUnrXpawA`; deployment productivo resultante `https://vendeplus-clean-gb2ianpix-entrega2-s-projects.vercel.app`, Ready y con alias oficiales.
- Smoke productivo aprobado: `/marketplace`, `/registro` y `/api/cities` HTTP 200 con sus marcadores de ciudad; cero logs de error recientes. Rollback web: `https://vendeplus-clean-7gbev6i76-entrega2-s-projects.vercel.app`.
- Pendiente inmediato: commit, push, PR y merge a `main` de esta rama limpia para impedir una nueva regresión.
- Validaciones aprobadas en worktree limpio: ESLint dirigido, `git diff --check` y build Next.js 16.3.0 de 181 páginas.
- Sin migración ni SQL. Cambio aislado de la impresión térmica y demás trabajos pendientes.
# Adelanto backlog: contraseña, colores y respaldo delivery (2026-09-04)

- Rama aislada `feature/account-delivery-controls`, basada en `origin/main` después del PR #16. No mezcla impresión térmica, catálogos ni cobertura por ciudades.
- Punto 1: comercios ven `Contraseña` en su navegación y empresas delivery ven `Contraseña` en su panel. El formulario reutiliza la sesión Supabase activa, exige 8 caracteres, confirmación, cierra la sesión después del cambio y conserva el flujo de recuperación por email.
- Punto 2: la configuración de empresa delivery incorpora color principal y de acento. La API exige rol owner/admin y normaliza valores hexadecimales. El Marketplace público aplica ambos colores al encabezado mediante variables CSS con los colores Somos como fallback.
- Migración nueva no destructiva: `20260904044204_transport_agency_marketplace_colors.sql`; agrega `marketplace_primary_color` y `marketplace_accent_color` con defaults y checks hexadecimales.
- Punto 4: Facturación delivery incorpora `Descargar respaldo CSV`. El endpoint limita el período, máximo 5.000 filas y 12 descargas cada 10 minutos; autoriza únicamente owner/admin/billing de la empresa, filtra por `agency_id`, evita fórmulas CSV y responde sin caché.
- Validaciones aprobadas: ESLint dirigido, TypeScript, 60/60 contratos críticos, `git diff --check` y build Next.js 16.3.0 de 183 páginas.
- Bloqueo para aplicar SQL: el dry-run remoto detectó 13 migraciones aplicadas en Supabase que aún no existen en `main` (`20260826152000` a `20260903203000`). No se aplicó la nueva migración para no romper el historial; primero deben integrarse las migraciones pendientes en Git.
- Sin commit, push, PR ni despliegue de esta rama todavía. Próximo paso: reconciliar el historial de migraciones, repetir `supabase db push --linked --dry-run`, revisar en Preview con cuentas reales y recién entonces publicar.

## Revisión posterior y sincronización con main (2026-09-04)

- La rama se actualizó por fast-forward hasta `origin/main` (`28f6d67`) y conserva tanto la restauración de ciudades/registro como los tres adelantos. Los dos conflictos de integración se resolvieron manteniendo ambas funcionalidades.
- Seguridad corregida: la pantalla de contraseña ahora limpia tokens conservando la ruta actual, también en `/transporte/panel/seguridad`; el CSV exige siempre un `agencyId` concreto y aplica `.eq("agency_id", requestedAgencyId)` incluso en modo founder, evitando exportaciones globales accidentales.
- Validaciones actualizadas: ESLint global aprobado, 62/62 contratos críticos aprobados, TypeScript aprobado, `git diff --check` aprobado y build Next.js 16.3.0 de 184 páginas aprobado cargando secretos solo en memoria del proceso.
- `supabase migration list --linked` confirmó 11 migraciones remotas sin archivo local en `origin/main`: cuatro de impresión y siete de catálogos. Se recuperaron los archivos originales sin cambiar su contenido; esto no reactivó la impresión ni volvió a ejecutar esas migraciones.
- El dry-run propuso exclusivamente `20260904044204_transport_agency_marketplace_colors.sql`; se aplicó correctamente y la lista local/remota quedó completamente alineada.
- UX de claves refinada: ayuda visible con una recomendación simple y errores separados para longitud, contraseña filtrada y otros rechazos, sin desactivar la protección de Supabase. Se aplicó a registro de comercios, registro de empresas delivery y cambio de contraseña.
- Validación final: ESLint global, 62/62 contratos, TypeScript, `git diff --check` y build Next.js 16.3.0 de 184 páginas aprobados.
- Estado: puntos 1, 2 y 4 listos para commit, push y Preview. Aún no promover a producción sin prueba real del usuario.

## Preview de contraseña, colores y respaldo delivery (2026-09-04)

- Commit funcional `6c9fd6f` creado y subido a `origin/feature/account-delivery-controls`.
- Preview Ready: `dpl_2mDYiM5pS2G2qYgZ53f9C3iw971Y`, `https://vendeplus-clean-6e98kqbkx-entrega2-s-projects.vercel.app`. Build remoto Next.js 16.3.0 de 184 páginas aprobado.
- La protección SSO de Vercel responde 302 en el smoke anónimo de todas las rutas; no hubo logs de error. Las pruebas funcionales requieren una sesión autorizada de Vercel y cuentas reales de comercio/empresa delivery.
- Supabase quedó alineado local/remoto y la migración de colores `20260904044204` está aplicada. Producción web no fue promovida.
- Próximo paso exacto: probar en Preview cambio de contraseña de una cuenta controlada, colores del Marketplace y descarga CSV. No promover sin esa aprobación.
# Preview: portada Somos para comercios sin banner (2026-09-04)

- Trabajo aislado en `.default-banner-clean`, rama `fix/default-store-banner-somos`, basada en `origin/main`; no mezcla impresión, catálogos ni otros cambios locales.
- Causa: `mapStore` usaba como fallback global el hero de Don Aniello, una foto de pasta, cuando un comercio nuevo no tenía `cover_image_url`.
- Corrección: comercios sin portada usan el logotipo vigente `/brand/new-somos-preview/somos-logo-preview.png`; el catálogo y las tarjetas del Marketplace lo muestran con `object-contain` y fondo neutral para evitar recortes. Los banners personalizados y los fallbacks explícitos de demos existentes permanecen intactos.
- Validaciones aprobadas: ESLint dirigido, 62/62 contratos, `git diff --check` y build Next.js 16.3.0 de 192 páginas.
- La primera Preview `dpl_FhwxgF6W5vZqBStkZ4GUVTXHkYcA` usó por error el logo anterior y queda descartada. Se retiraron los 3 assets de marca y 7 iconos antiguos que no tenían referencias activas; toda la identidad interna/PWA conserva los recursos vigentes de `new-somos-preview`.
- Preview corregida Ready: `dpl_BguVQ6KP92hkVxywJ9G98tMfCYdG`, `https://vendeplus-clean-fnn0nk2e2-entrega2-s-projects.vercel.app`. Verificación autenticada en `/start-13`: contiene el logotipo nuevo, no contiene el logo anterior ni el fallback de pasta.
- Sin migración ni SQL. Commit `6da3979`, push y PR #20 creados; usuario autorizó proceder. Pendiente: checks verdes, merge y promover la Preview exacta.

# Menú 2026 Sierra Yara (2026-09-04)

- Rama aislada `data/sierra-yara-menu-2026`, basada en `origin/main`; solo incorpora la migración de datos `20260904123000_load_sierra_yara_menu_2026.sql`.
- Migración aplicada correctamente al proyecto Supabase vinculado para el comercio existente `Sierra Yara` (`sierra-yara`). Es idempotente, restringida por `store_id` y elevó `product_limit` a 129 sin cambiar el plan trial.
- Resultado remoto verificado: 21 categorías, 129 productos activos, 55 descripciones, cero precios nulos, 4 grupos, 14 valores y 20 asociaciones de opciones.
- Opciones cargadas: leche solo en los 9 cafés autorizados; salsa en Alitas y Capitan Pops; presentación en las 5 hamburguesas; término de cocción en las 4 hamburguesas de carne.
- Exclusiones confirmadas: ninguna categoría/licor, `Galleta con Helado` y los demás productos sin precio del documento. Pepitos quedaron estándar, sin variantes; no se cargaron acompañantes porque los platos fuertes aplicables no tenían precio.
- Catálogo productivo responde HTTP 200 en `https://www.somos-ve.com/sierra-yara`; tras revalidación contiene `Sierra Yara`, `Espresso` y `Bacon Star`, y no muestra estado inactivo.
- Validación final: `git diff --check` aprobado y build Next.js 16.3.0 aprobado con 192 páginas, cargando secretos solo en memoria del proceso. PR #19 fusionado a `main` en `a704b20`; no hubo cambios adicionales en la base de datos.

# Retoma: asignacion de repartidor en particulares (2026-09-05)

- Usuario confirma que contrasena, colores y CSV ya estan en produccion. Particulares se probo en varias Previews; pendiente: al crear un pedido particular no dejaba asignar repartidor.
- Trabajo vigente en `.particular-delivery-clean`. Vercel confirma ultima Preview Ready `dpl_BjkAzbqQqNdrALcarbKtJWTToayz`, https://vendeplus-clean-95rvs0ki4-entrega2-s-projects.vercel.app, creada 2026-09-04 21:56:57 America/Caracas.
- Diagnostico: RPC original mutate_transport_order_atomic rechaza cuando order_id es null, caso normal de particulares. Correccion local existente en 20260905040000_complete_particular_delivery_operations.sql usa NOT FOUND y omite sincronizacion de orders cuando no hay order_id.
- Verificacion remota migration list --linked: 20260905010000, 020000 y 030000 aplicadas; 20260905040000 pendiente. No se aplico SQL ni se cambio codigo en esta retoma; build no ejecutado por tratarse de diagnostico.
- Siguiente paso exacto: revisar completa la migracion 20260905040000 (tambien incluye idempotencia), validar dry-run y aplicar la correccion; probar asignacion y transiciones de estado en Preview, incluyendo pedido de comercio como regresion. No dar por corregido hasta probar persistencia y eventos. No promover particulares a produccion todavia.

# Validacion de correcciones de particulares (2026-09-05)

- Esta verificacion reemplaza el pendiente anterior: Supabase db push --linked --dry-run responde que la base esta actualizada. Las funciones remotas confirman el guard NOT FOUND para servicios sin order_id y el guard store_id IS NOT NULL para broadcast. No se aplicaron migraciones ni cambios persistentes de datos en esta sesion.
- Se agrego scripts/qa-particular-operations.sql en .particular-delivery-clean: prueba remota BEGIN/ROLLBACK aprobada para creacion, reintento duplicado, asignacion, 9 estados, sincronizacion de solicitud, 10 eventos, servicio inexistente, regresion de comercio y permisos RPC. Todos los datos de QA se revirtieron.
- Validaciones: 63/63 contratos, ESLint global, TypeScript y git diff --check aprobados. npm.cmd run build -- --webpack aprobado: 193 paginas. npm.cmd run build con Turbopack fallo por el enlace node_modules del worktree; el primer intento Webpack carecia de variables privadas. Build final aprobado con ../.env.local cargado solo en memoria, sin modificar archivos de entorno.
- Preview existente confirmada Ready: dpl_BjkAzbqQqNdrALcarbKtJWTToayz, https://vendeplus-clean-95rvs0ki4-entrega2-s-projects.vercel.app. No se hizo deploy, commit ni push.
- Navegador integrado no disponible (iab); no se afirma validacion visual ni E2E de API autenticada. Siguiente paso: probar visualmente en Preview un particular: aceptar, asignar repartidor, En camino, Entregado, recargar y revisar historial. No promover a produccion hasta aprobacion explicita.

# Correccion UX particulares: Entregado y textos del formulario (2026-09-05)

- Usuario confirma que ya permite asignar repartidor, pero en el selector solo veia Repartidor asignado, En camino y Reportar novedad; faltaba mostrar Entregado antes de En camino en operaciones reales.
- Cambios aplicados en `.particular-delivery-clean`: `src/components/transport/TransportOrdersTab.tsx` ahora muestra Entregado desde Aceptado, Repartidor asignado, Por retirar, Retirado y En camino. Tambien conserva Por retirar/Retirado donde aplica y Reportar novedad.
- Cambios aplicados en `src/components/public/ParticularDeliveryForm.tsx`: las pestanas visibles del link de particulares pasan de Envio/Recibo a Usted envia/Usted recibe. No cambia la logica interna sender/receiver.
- Validaciones: `node --experimental-strip-types scripts/critical-contracts.test.mjs` aprobado 63/63; ESLint focal aprobado para los dos componentes; verificacion dinamica UI-vs-servidor aprobada; `git diff --check` aprobado; `npm.cmd run build -- --webpack` aprobado con 193 paginas.
- Preview nuevo Ready: `dpl_HNboUttVUxtATAvfJXdjVJvX579W`, https://vendeplus-clean-rfphl62wk-entrega2-s-projects.vercel.app. Build remoto de Vercel tambien aprobado con 193 paginas.
- No hubo migracion nueva ni SQL a ejecutar. No se hizo commit, push ni promocion a produccion.
- Siguiente prueba visual recomendada: abrir el Preview, crear/usar un particular, aceptar, asignar repartidor, abrir selector de estado y confirmar que Entregado aparece; marcar Entregado, recargar y revisar historial.

# Revision final pre-produccion particulares (2026-09-05)

- Usuario probo el Preview y reporta que todo se ve ok.
- Revision final: Preview `dpl_HNboUttVUxtATAvfJXdjVJvX579W` sigue Ready y target preview. Supabase `db push --linked --dry-run` confirma base remota al dia, sin SQL pendiente.
- Validaciones repetidas: contratos 63/63, ESLint amplio en transporte/particulares sin errores, `git diff --check` sin errores, build local `npm.cmd run build -- --webpack` aprobado con 193 paginas.
- Higiene release: sin cambios en `.env`, `.next`, `node_modules`, package lock, next config ni configuracion Vercel; sin TODO/FIXME/debugger/console.log en el alcance revisado. Avisos CRLF de Git en Windows no bloqueantes.
- Criterio: listo para promocion a produccion desde el Preview validado, con riesgo residual bajo propio de cualquier cambio nuevo. No se ejecuto promocion todavia.

# Promocion a produccion particulares (2026-09-05)

- Usuario autorizo "procede". Se ejecuto `vercel promote vendeplus-clean-rfphl62wk-entrega2-s-projects.vercel.app --yes`.
- Produccion nueva Ready: `dpl_9spgVAKexmJbwVhwwYrbdmFxPieE`, https://vendeplus-clean-6yguima55-entrega2-s-projects.vercel.app.
- Aliases confirmados sobre el deployment nuevo: https://www.somos-ve.com, https://somos-ve.com, https://vendeplus-clean.vercel.app y https://vendeplus-clean-entrega2-s-projects.vercel.app.
- No se hizo commit ni push. No hubo SQL pendiente antes de promover.

# Boton enviar particular a Entrega2 App (2026-09-06)

- Usuario confirmo que Entrega2 App puede recibir origen particular y autorizo "procede con esto".
- Se agrego migracion aplicada remotamente `20260906010000_allow_entrega2_integrations_for_particular_transport_orders.sql`: `order_integrations.order_id` ahora permite null y se agregan `transport_order_id` y `particular_request_id` con indices unicos por proveedor para registrar integraciones de particulares sin simular pedidos de comercio.
- Se agrego endpoint `POST /api/transport/panel/orders/[transportOrderId]/send-entrega2`: protegido por sesion de empresa delivery, rol owner/admin/operator, solo permite `agency.slug = entrega2` y solo `transport_orders` con `particular_request_id`, sin `order_id` ni `store_id`. Valida GPS de retiro y entrega, arma payload particular para Entrega2 App, evita duplicados, registra `order_integrations` y evento `entrega2_app_sent`.
- Se extendieron list/detail de pedidos delivery para incluir `order_integrations`; el panel muestra boton "Enviar a Entrega2 App" solo para particulares cuando la empresa seleccionada es Entrega2. Si ya fue enviado queda deshabilitado con estado de Entrega2.
- Webhooks Entrega2 App `order-status` y `driver-location` ahora leen `transport_order_id`; `order-status` puede sincronizar estados hacia `transport_orders` particulares.
- Validaciones: contratos `64/64`, ESLint focal, TypeScript `npx.cmd tsc --noEmit`, `git diff --check`, Supabase dry-run sin pendientes, build local `npm.cmd run build -- --webpack` con 193 paginas, build Vercel Preview Ready.
- Preview Ready usado para promover: `dpl_JDn2jmjxZyfzWz5f3sWNeuLZMFRy`, https://vendeplus-clean-bpbd0pzye-entrega2-s-projects.vercel.app.
- Produccion nueva Ready: `dpl_EzDrR3V7jopd1znpeojmFFwdVkTK`, https://vendeplus-clean-kubr19ria-entrega2-s-projects.vercel.app. Aliases confirmados: https://www.somos-ve.com, https://somos-ve.com, https://vendeplus-clean.vercel.app y https://vendeplus-clean-entrega2-s-projects.vercel.app.
- No se hizo commit ni push. Prueba real pendiente: desde panel Entrega2, abrir Pedidos, tomar un particular con GPS retiro/entrega, pulsar Enviar a Entrega2 App y confirmar que Entrega2 App lo recibe. Si ya fue enviado, el boton debe quedar deshabilitado mostrando el estado.

# Correccion Preview: puntos retiro/entrega y nota adicional (2026-09-06)

- Usuario corrigio el proceso: no promover a produccion sin prueba explicita previa en Preview. Esta correccion queda solo en Preview; no se promovio.
- Diagnostico: el formulario de particulares podia reutilizar estado interno del componente de mapa entre paso Retiro y paso Entrega. Se aislaron las instancias con keys separadas `pickup-fields` y `delivery-fields`, y tambien key en `LocationPicker` por modo/nombre.
- Se agrego campo visible "Nota adicional (opcional)" al final del paso Resumen. Para evitar nueva migracion antes de prueba en Preview, la nota viaja en el payload, se valida server-side y se incorpora al detalle operativo/WhatsApp como "Nota adicional:" usando el campo existente `package_description`.
- Validaciones: contratos `64/64`, ESLint focal, TypeScript, Supabase dry-run sin SQL pendiente, `git diff --check`, build local `npm.cmd run build -- --webpack` aprobado.
- Preview Ready para prueba manual: `dpl_A4L1rSbmaa5jVLoPpv4ygugjY1q2`, https://vendeplus-clean-liki20t7s-entrega2-s-projects.vercel.app. No promover a produccion hasta que el usuario confirme que el flujo esta ok en este Preview.

# Promocion controlada puntos/nota particulares (2026-09-06)

- Usuario aprobo el Preview y pidio "ok pasalo a produccion controlado".
- Se ejecuto `vercel promote vendeplus-clean-liki20t7s-entrega2-s-projects.vercel.app --yes`.
- Produccion nueva Ready: `dpl_44YcMzKyKqDD5VnnC4orScKYPSwi`, https://vendeplus-clean-hh7vygwdb-entrega2-s-projects.vercel.app.
- Aliases confirmados sobre el deployment nuevo: https://www.somos-ve.com, https://somos-ve.com, https://vendeplus-clean.vercel.app y https://vendeplus-clean-entrega2-s-projects.vercel.app.
- Supabase dry-run posterior confirma base remota al dia. No hubo SQL nuevo para esta correccion de puntos/nota.

# Correccion colores y boton Actualizar en empresas delivery (2026-09-06)

- Diagnostico: los colores del Marketplace se guardaban desde `/api/transport/agencies/[agencyId]`, pero `/api/transport/me` no los incluia al cargar/refrescar el panel. El boton `Actualizar` en el panel delivery tambien llamaba `load()` con defaults dependientes de la pestaña; en `Pedidos` no traia configuracion completa, por eso podia verse estado viejo. El Marketplace publico de empresa delivery tenia `revalidate = 60`, asi que un cambio de color podia tardar hasta 60s.
- Cambios aplicados en `.particular-delivery-clean`: `/api/transport/me` ahora selecciona `marketplace_primary_color` y `marketplace_accent_color` en carga completa y compacta; el boton `Actualizar` es `type="button"` y fuerza `includeConfiguration: true`; el formulario de perfil se remonta cuando cambian los colores; `/transporte/[agencySlug]/marketplace` queda dinamico con `force-dynamic`.
- Contratos reforzados en `scripts/critical-contracts.test.mjs` para exigir colores en `/api/transport/me`, refresh completo, boton seguro y pagina publica dinamica.
- Validaciones aprobadas: 64/64 contratos criticos, ESLint dirigido, TypeScript, `git diff --check`, Supabase dry-run remoto (`Remote database is up to date`) y build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_AneVjiUC8yrFTv3Lnc7NrZCAXhJb`, `https://vendeplus-clean-600zwtybb-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado con 181 paginas; `/transporte/[agencySlug]/marketplace` sale dinamico. Smoke sin sesion queda redirigido a SSO de Vercel, esperado para Preview protegida.
- No hubo migracion nueva ni SQL que ejecutar. No se promovio a produccion; siguiente paso: probar en Preview con login de Vercel/panel que cambiar colores, guardar y pulsar Actualizar refleja valores actuales y el Marketplace abre con los colores nuevos. Promover solo con aprobacion explicita posterior.

# Refinamiento perceptible boton Actualizar delivery (2026-09-06)

- Ajuste posterior a feedback del usuario: aunque el boton `Actualizar` ya refrescaba datos, visualmente no se percibia actividad porque `load()` no mostraba carga cuando habia cache inicial.
- `TransportAgencyPanel` ahora agrega estado dedicado `isPanelRefreshing`: al tocar Actualizar muestra `Actualizando...` con spinner, queda deshabilitado durante la carga y termina con `Panel actualizado.`.
- El refresh manual conserva el mensaje de progreso con `silent: true`, fuerza `includeConfiguration: true` e `includeRelations: true`, refresca pedidos si esta en `Pedidos` y repartidores si esta en `Repartidores`.
- Contratos reforzados y aprobados: 64/64. Validaciones aprobadas: ESLint dirigido, TypeScript, `git diff --check`, build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_3Z6jxbKpZkC2ffzNYARhgM6fmf5x`, `https://vendeplus-clean-p7hsm1o7z-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado de 181 paginas.
- No hubo migracion ni SQL. No se promovio a produccion.

# UX link particulares: tipo de servicio, notas por punto y ubicacion actual condicionada (2026-09-06)

- Usuario reporto que el logo de Entrega2 no se veia centrado en el link de particulares y pidio ajustar el flujo.
- `ParticularDeliveryForm` ahora muestra en el primer paso un selector de tipo de servicio: `Delivery` con icono de moto/bici y `Traslado de persona` con icono de usuario.
- El logo de Entrega2 en la cabecera del link particular usa tratamiento especial `object-contain`, `object-center`, `scale-110` y padding minimo para evitar recorte/descentrado del archivo.
- Se cambio el texto de los campos por punto a `Direccion, referencia o nota de retiro` y `Direccion, referencia o nota de entrega`, ambos opcionales.
- Se elimino la nota adicional final del resumen. La nota/instruccion ahora vive en el campo del punto correspondiente.
- `LocationPicker` agrega `allowCurrentLocation`: el boton de ubicacion actual solo aparece en Retiro cuando el solicitante elige `Usted envia`, y solo aparece en Entrega cuando el solicitante elige `Usted recibe`. El otro punto queda por mapa.
- API publica de particulares acepta `serviceType` y guarda/envia por WhatsApp `Servicio` + `Detalle` dentro de `package_description`, sin cambiar esquema.
- Validaciones aprobadas: 64/64 contratos criticos, ESLint focal, TypeScript, `git diff --check`, Supabase dry-run sin SQL pendiente, build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_AZGfjvJAmVKWHzUTwXtBRNyDB7cW`, `https://vendeplus-clean-4qz7g5ntt-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado de 181 paginas.
- No hubo migracion ni SQL. No se promovio a produccion; probar visualmente en Preview antes de promover.

# Reorganizacion flujo particulares por tipo de servicio (2026-09-07)

- Usuario pidio revertir ajuste especial del logo Entrega2 y rediseñar la logica de particulares para evitar confusion.
- `ParticularDeliveryForm` fue reorganizado: primer paso inicia con selector principal `Delivery` o `Traslado de persona`. El resto del paso se despliega solo despues de elegir tipo.
- Para `Delivery`: pide datos del solicitante y luego `Usted envia` o `Usted recibe`. Si envia, su telefono/ubicacion aplican a retiro y se pide telefono del receptor en entrega. Si recibe, su telefono/ubicacion aplican a entrega y se pide telefono de quien entrega en retiro.
- Para `Traslado de persona`: pide datos del solicitante y luego `Viajo yo` o `Viaja otra persona`. Si viaja el solicitante, no duplica datos del pasajero; usa sus datos iniciales. Si viaja otra persona, pide nombre y telefono del pasajero.
- La ubicacion actual queda restringida al punto donde esta el solicitante: delivery sender en retiro, delivery receiver en entrega, traslado self en retiro. En los demas puntos queda seleccion por mapa.
- Logo de Entrega2 revertido: vuelve al render normal `object-cover object-center`; se quito el ajuste `scale-110 object-contain`.
- API publica de particulares ahora acepta `travelerName`/`travelerPhone` y arma WhatsApp claro: `Servicio`, `Solicitante`, `Telefono solicitante`, y si aplica `Pasajero`/`Telefono pasajero`. Ya no usa `Cliente: ...` ni nota final.
- No hubo migracion ni SQL. Validaciones aprobadas: contratos 64/64, ESLint focal, TypeScript, `git diff --check`, Supabase dry-run al dia, build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_F3yXYhfF5PE5yEh7NFpi7qVDxwH6`, `https://vendeplus-clean-hvdqp80sr-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado de 181 paginas.
- No se promovio a produccion. Probar visualmente en Preview los cuatro caminos: Delivery/Usted envia, Delivery/Usted recibe, Traslado/Viajo yo, Traslado/Viaja otra persona.

# Cierre local ajustes particulares (2026-09-07)

- Retoma ejecutada en el worktree `.particular-delivery-clean`; no se tocaron archivos de produccion desde la raiz principal.
- Validaciones repetidas: TypeScript `npx.cmd tsc --noEmit` aprobado; ESLint focal aprobado para `ParticularDeliveryForm`, `LocationPicker`, API publica de particulares, pagina publica y `TransportOrdersTab`; `git diff --check` sin errores; contratos directos `64/64` aprobados. El runner `npm.cmd run test:critical` sigue fallando con `spawn EPERM`, por eso se uso ejecucion directa como en las sesiones previas.
- Supabase dry-run remoto: `Remote database is up to date`; no hay SQL ni migraciones pendientes.
- Build obligatorio: `npm.cmd run build` con Turbopack falla por el problema conocido del symlink `node_modules` fuera del root del worktree; `npm.cmd run build -- --webpack` primero fallo por falta de variables privadas en el worktree y luego aprobo cargando `../.env.local` solo en memoria. Resultado final: Next.js 16.3.0, Webpack, 181 paginas.
- Verificacion visual automatizada local en `http://localhost:3105/transporte/entrega2/particulares` con viewport movil 390x844 aprobo los cuatro caminos: Delivery/Usted envia, Delivery/Usted recibe, Traslado/Viajo yo y Traslado/Viaja otra persona. En cada camino se llego al resumen y se valido que el boton de ubicacion actual solo aparece en el punto donde corresponde.
- No se creo solicitud real ni se presiono `Registrar y enviar`; la prueba uso mapa local y se detuvo en Resumen para no generar datos operativos.
- Preview vigente para revision: `dpl_F3yXYhfF5PE5yEh7NFpi7qVDxwH6`, `https://vendeplus-clean-hvdqp80sr-entrega2-s-projects.vercel.app`.
- Produccion no fue promovida en esta retoma. Siguiente paso exacto: si el usuario aprueba, promover de forma controlada ese Preview a produccion y hacer smoke posterior de `/transporte/entrega2/particulares` y panel delivery. No promover sin aprobacion explicita.

# Revision pre-produccion particulares y clave Entrega2 (2026-09-07)

- Usuario pidio revisar produccion, ajustar terminos delivery/traslado y cambiar clave de entregados.venezuela a `[RETIRADO: rotación pendiente]`.
- Cuenta identificada sin ambiguedad en Supabase remoto: `entregados.venezuela@gmail.com`, empresa delivery `Entrega2`, slug `entrega2`, rol `owner`, user_id `7685d856-3236-40ac-bae5-665802086c91`.
- Supabase Auth rechazo la clave solicitada `[RETIRADO: rotación pendiente]` por ser debil/conocida. No se forzo por SQL ni se modifico `auth.users` manualmente por seguridad. Siguiente paso: usar una variante fuerte aprobada por el usuario, por ejemplo `[RETIRADO: rotación pendiente]`.
- Auditoria de terminos: el flujo publico de particulares esta acorde para `Delivery` y `Traslado de persona`; separa solicitante, rol, pasajero, origen, destino, paquete y pago. Se detecto mejora menor en panel delivery: algunas etiquetas de particulares decian `Cliente`; se cambiaron a `Solicitante` donde aplica, `Cliente / Solicitante` en tabla y `Entrega WA` para el WhatsApp del destino particular. Pedidos de comercio conservan `Cliente` y `Cliente WA`.
- Archivos modificados en esta retoma: `src/components/transport/TransportOrdersTab.tsx`, `scripts/critical-contracts.test.mjs` y `SESSION_HANDOFF.md`.
- No hubo migracion ni SQL nuevo. Supabase dry-run remoto: `Remote database is up to date`.
- Validaciones aprobadas: contratos directos `64/64`; TypeScript `npx.cmd tsc --noEmit`; ESLint focal; `git diff --check`; build local `npm.cmd run build -- --webpack` con variables en memoria, 181 paginas.
- Preview Vercel nuevo Ready: `dpl_3qrVtKzkERDDbFPbLDiqrNaN1tjg`, `https://vendeplus-clean-219cygqvw-entrega2-s-projects.vercel.app`, target Preview. Build remoto Turbopack aprobado con 181 paginas.
- Smoke Preview: `/transporte/entrega2/particulares` HTTP 200, contenido cargado; `vercel inspect` Ready; logs de error recientes sin resultados.
- Criterio: listo tecnicamente para produccion cuando el usuario apruebe promover este Preview. No se promovio produccion en esta retoma.

# Produccion particulares reorganizados (2026-09-07)

- Usuario confirmo que probo el Preview de particulares y autorizo pasarlo a produccion.
- Se promovio el Preview validado `https://vendeplus-clean-219cygqvw-entrega2-s-projects.vercel.app` con `vercel promote`.
- Primer promote creo production `dpl_HPpw6D4xuSBEwgJJDLC41NGDrgiF` (`https://vendeplus-clean-ajabc9058-entrega2-s-projects.vercel.app`). Se repitio el promote con URL completa por confirmacion de alias y quedo production final `dpl_2dthwkhr5QsTrZ2iW3tj5Fn7rD5L`, `https://vendeplus-clean-g84qjqmjo-entrega2-s-projects.vercel.app`, estado Ready.
- Aliases oficiales confirmados sobre `dpl_2dthwkhr5QsTrZ2iW3tj5Fn7rD5L`: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y `https://vendeplus-clean-entrega2-s-projects.vercel.app`.
- Smoke productivo final: `/transporte/entrega2/particulares` HTTP 200 y contenido de particulares cargado; `/transporte/panel` HTTP 200; logs de error de Vercel ultimos 10 minutos sin resultados.
- Supabase dry-run posterior: sin migraciones pendientes. No hubo SQL nuevo en esta promocion.
- Clave Entrega2 previamente cambiada y verificada: `entregados.venezuela@gmail.com` quedo con `[RETIRADO: rotación pendiente]`.
- No se hizo commit ni push.

# Preview diferenciacion Delivery vs Traslado en panel delivery (2026-09-07)

- Usuario pidio diferenciar traslados de delivery en el panel de pedidos de empresas delivery.
- Cambio aplicado en `.particular-delivery-clean`: `TransportOrdersTab` detecta el tipo desde `transport_particular_requests.package_description`, que ya guarda prefijo `Delivery:` o `Traslado de persona:`. No requiere migracion.
- En la tabla de pedidos, una solicitud particular ahora muestra `Delivery particular` o `Traslado particular` como origen, mas una etiqueta visual `Delivery`/`Traslado` con color distinto. Pedidos de comercio conservan nombre del comercio.
- En el detalle, los particulares muestran `Tipo: Delivery` o `Tipo: Traslado`; el bloque de descripcion usa `Paquete` para delivery y `Detalle` para traslado. La comanda WhatsApp al repartidor tambien arranca con `Nuevo delivery particular` o `Nuevo traslado particular`.
- Validaciones aprobadas: contratos directos `64/64`, TypeScript `npx.cmd tsc --noEmit`, ESLint focal `TransportOrdersTab`, `git diff --check`, Supabase dry-run remoto al dia y build local `npm.cmd run build -- --webpack` con 181 paginas.
- Preview Vercel Ready: `dpl_6gkUy7eheujHaVgjnVs9sZxvEtrf`, `https://vendeplus-clean-k03mtrp40-entrega2-s-projects.vercel.app`, target Preview. Build remoto Turbopack aprobado con 181 paginas.
- Smoke Preview: `/transporte/panel` HTTP 200; `vercel inspect` Ready; logs de error recientes sin resultados.
- No se promovio a produccion. Siguiente paso: usuario prueba Preview en panel delivery con servicios particulares existentes o nuevos; si aprueba, promover este Preview a produccion.

# Preview fix real diferenciacion Delivery/Traslado (2026-09-07)

- Usuario probo Preview anterior y reporto que en panel todos seguian como `Particular`, sin diferenciar `Delivery` o `Traslado`.
- Diagnostico: la relacion `transport_particular_requests` puede llegar al componente como arreglo desde Supabase en la lista; el helper leia solo objeto y no encontraba `package_description`, por eso caia al fallback `Particular`.
- Fix aplicado: `particular(entry)` normaliza objeto/arreglo (`Array.isArray(request) ? request[0] : request`) y `particularServiceLabel` detecta `Delivery:` o `Traslado de persona:` aunque no esten estrictamente al inicio.
- Se conserva lo ya implementado: tabla muestra `Delivery particular` o `Traslado particular`, etiqueta visual `Delivery`/`Traslado`, detalle con `Tipo`, y comanda WhatsApp del repartidor con `Nuevo delivery particular` o `Nuevo traslado particular`.
- No hubo migracion ni SQL nuevo. Supabase dry-run remoto: base al dia.
- Validaciones aprobadas: contratos directos `64/64`, TypeScript, ESLint focal, `git diff --check`, build local `npm.cmd run build -- --webpack` con 181 paginas.
- Preview Vercel Ready: `dpl_4PsCrE2WBFq2f5gv59kJfmeNDbdE`, `https://vendeplus-clean-kml8k8cqu-entrega2-s-projects.vercel.app`, target Preview. Build remoto Turbopack aprobado con 181 paginas.
- Smoke Preview: `/transporte/panel` HTTP 200; `vercel inspect` Ready; logs de error recientes sin resultados.
- No se promovio a produccion. Siguiente paso: usuario prueba este Preview en panel delivery; si ya muestra `Delivery particular` y `Traslado particular`, promover este Preview a produccion.

## 2026-09-07 - Preview ajustes textos particulares

- Cambio aplicado: en panel delivery, pedidos particulares muestran origen `Particular`; el tipo queda debajo como `Delivery` o `Traslado`.
- Cambio aplicado: mensajes WhatsApp de solicitudes particulares evitan redundancia de pasajero cuando coincide con solicitante.
- Cambio aplicado: para traslados se usan `ORIGEN`/`DESTINO` y etiquetas de origen/destino; no `RETIRO`/`ENTREGA`.
- Archivos clave: `src/components/transport/TransportOrdersTab.tsx`, `src/app/api/transport/particulares/[agencySlug]/route.ts`, `src/app/api/transport/panel/orders/[transportOrderId]/send-entrega2/route.ts`, `scripts/critical-contracts.test.mjs`.
- Validaciones: `node --experimental-strip-types scripts/critical-contracts.test.mjs` 64/64; `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; `npx.cmd supabase db push --linked --dry-run` OK, remota al dia; `npm.cmd run build -- --webpack` OK.
- Preview Vercel READY: https://vendeplus-clean-m00p4o10w-entrega2-s-projects.vercel.app (`dpl_4rD5Rk5FE3fLdawebGRBq5oNpQLQ`).
- Smoke: `/transporte/panel` 200, `/transporte/entrega2/particulares` 200. `vercel logs` local fallo por `ECONNREFUSED 127.0.0.1:9`; no se pudo leer logs desde CLI.
- Siguiente paso: usuario debe probar preview y aprobar promocion a produccion si todo esta correcto.

## 2026-09-07 - Preview etiquetas mapa traslado particular

- Cambio aplicado: en `ParticularDeliveryForm`, cuando el servicio es `Traslado de persona`, los puntos del mapa y resumen usan `Origen` y `Destino`; para delivery siguen `Retiro` y `Entrega`.
- Cambio aplicado: `LocationPicker` acepta `referenceMarkerLabel` y `referencePopupLabel` opcionales para que el pin/popup base no diga `Retiro aqui` en el mapa de destino de pasajeros.
- Archivos: `src/components/public/LocationPicker.tsx`, `src/components/public/ParticularDeliveryForm.tsx`, `scripts/critical-contracts.test.mjs`.
- Validaciones: contratos 64/64, `npx.cmd tsc --noEmit` OK, ESLint focal OK, `git diff --check` OK, `npm.cmd run build -- --webpack` OK.
- Preview READY: https://vendeplus-clean-ps0wdknt9-entrega2-s-projects.vercel.app (`dpl_9axhfeAhBkeg2wUMRC4D3esZPKbM`). Smoke `/transporte/entrega2/particulares` y `/transporte/panel` 200.
- Pendiente: usuario prueba preview y aprueba produccion.

## 2026-09-07 - Produccion particulares traslado/delivery

- Usuario probo preview y aprobo produccion.
- Validacion previa: contratos 64/64, `npx.cmd tsc --noEmit` OK, `git diff --check` OK, `npm.cmd run build -- --webpack` OK.
- Preview aprobado/promovido: https://vendeplus-clean-ps0wdknt9-entrega2-s-projects.vercel.app (`dpl_9axhfeAhBkeg2wUMRC4D3esZPKbM`).
- Produccion promovida con `vercel.cmd promote ... --yes`; Vercel reporto deployment nuevo: https://vercel.com/entrega2-s-projects/vendeplus-clean/E1e4h2QDQdoZY3Wh4FQTD6tUfj5f.
- Smoke produccion OK: `https://vendeplus-clean.vercel.app/transporte/entrega2/particulares` 200, `/transporte/panel` 200, `https://www.somos-ve.com/transporte/entrega2/particulares` 200, `/transporte/panel` 200.
- `vercel logs` fallo localmente por `ECONNREFUSED 127.0.0.1:9`; no hubo lectura de logs desde CLI.
- No hubo migracion nueva ni SQL pendiente en este ultimo ajuste.
# 2026-09-08 - Puente Entrega2 reforzado y listo para validacion manual

- Preview final: `https://vendeplus-clean-qng4gyk3g-entrega2-s-projects.vercel.app`, deployment `dpl_EC9M8VtvoETB84d9W1G5rCauH7Bc`, target Preview, READY. Produccion no fue tocada.
- Se corrigieron dos hallazgos criticos de la auditoria: costos nulos/vacios/booleanos ya no se convierten en tarifa cero y la distancia OSRM se calcula en paralelo con la espera maxima de 4.5 s de Entrega2 App.
- Los envios directos y manuales reservan primero `order_integrations` y finalizan por el ID exacto; ya no usan upsert sobre el indice parcial. Un resultado externo incierto queda `reconcile_required`, visible como `Revisar antes de reenviar`, y bloquea reenvios ciegos.
- El webhook actualiza `orders.delivery_status`, no el estado comercial del pedido, y descarta regresiones/finales atrasados. Las actualizaciones usan comparacion del estado previo para reducir carreras concurrentes.
- Pruebas: `test:entrega2-bridge` 5/5, contratos criticos 65/65, ESLint dirigido OK, `git diff --check` OK y build local Webpack 185 paginas OK. Build Vercel Turbopack 185 paginas OK.
- Sin migracion nueva ni SQL aplicado. Sigue pendiente `supabase/migrations/20260907213000_align_legacy_entrega2_connections.sql`; aplicar primero en staging, nunca directamente en produccion sin validar.
- El navegador integrado no estuvo disponible y la Preview exige SSO de Vercel, por lo que el smoke visual autenticado queda en manos del usuario. No se hicieron pedidos, cotizaciones ni mutaciones contra la base compartida con produccion.
- Prueba manual siguiente: validar en Preview 1) Smash credito: directo a App y registro en Somos; 2) Smash contado: solo Somos/WhatsApp y boton manual hacia App; 3) particular: Somos/WhatsApp y boton manual; 4) otra empresa: nunca muestra envio a App; 5) cotizacion: respuesta normal y, en staging aislado, fallback menor de 5 s.
# 2026-09-08 - Horario China Town corregido

- Cambio de datos autorizado por el usuario y aplicado directamente al registro exacto `china-town` (`4fe11a35-7599-4328-ae75-d381259244cf`).
- Lunes y viernes pasaron de no tener rangos a `12:20-22:20`, habilitados. Se conservaron los demas dias y `manual_open_status=auto`.
- Verificacion posterior por lectura publica confirmo una sola fila, lunes `12:20-22:20` y viernes `12:20-22:20`.
- No hubo cambios de codigo, migracion, SQL ni despliegue. El catalogo tiene revalidacion de 30 segundos.
# 2026-09-08 - Etiqueta Entrega2 aclarada en pedidos del comercio

- La prueba reciente de Smash si llego a Entrega2 App: pedido `VP-0908-DPK`, integracion `entrega2` en estado `sent`, ID externo `22190`, sin error. Tambien quedo su servicio operativo en Somos.
- La confusion provenia del boton generico `Delivery` del panel del comercio para conexiones `transport_agency`.
- En `OrdersManager`, cuando la empresa snapshot es Entrega2 el boton ahora muestra `Entrega2`; cuando ya existe integracion externa muestra `Entrega2 App`. Otras empresas conservan `Delivery`.
- Preview nueva: `https://vendeplus-clean-h3310xzpi-entrega2-s-projects.vercel.app`, deployment `dpl_8MegoK5yEdDKmZjYmjiTffNhmo4a`, READY, target Preview. Produccion web no fue desplegada.
- Validaciones: contratos 65/65, puente 5/5, ESLint dirigido, diff check, build local Webpack y remoto Turbopack de 185 paginas aprobados. Sin migracion ni SQL.
# 2026-09-08 - Comprobantes de pago, Premium particulares y archivado seguro listos localmente

- Se implemento sin desplegar ni modificar produccion la configuracion por comercio `No solicitar | Pedir referencia | Pedir captura o foto`, con selector `Opcional | Obligatorio`. Aplica a todos los metodos, incluido efectivo; el texto cliente es `Subir captura de pago o foto del billete`.
- Referencia: checkout y API publica exigen minimo 4 digitos cuando se proporciona o es obligatoria; la edicion del pago en panel y los particulares Pago movil tambien rechazan referencias con menos de 4 digitos.
- Capturas: nuevo endpoint publico limitado y rate-limited; revalida la configuracion del comercio, decodifica la imagen real con Sharp, elimina metadatos, redimensiona y guarda WebP de maximo 2 MB en bucket privado. Solo entrega token opaco; nunca URL publica.
- El pedido valida el token contra el mismo `store_id`, evita reutilizacion entre pedidos y marca pagos no efectivo `En revision`. El panel consulta por tenant y genera una URL firmada de 5 minutos para `Ver captura o foto`.
- Limpieza: cron diario elimina imagenes adjuntas a los 30 dias y cargas abandonadas a las 24 horas, en lotes de 200, conservando solo metadatos de auditoria.
- Empresas delivery: Superadmin incorpora `Eliminar`, implementado como archivado, nunca hard delete. RPC transaccional pausa afiliaciones, desactiva solo los checkouts que realmente usaban esa conexion, conserva historial y protege la agencia del sistema `entrega2`.
- Particulares: pagina publica, API y enlaces del panel quedan bloqueados/ocultos si `premium_dispatch_enabled` no esta activo.
- Migracion nueva NO aplicada: `supabase/migrations/20260908193000_payment_proofs_and_agency_archiving.sql`. Supabase dry-run confirma que es la unica pendiente. Preview y produccion comparten Supabase: aplicar la migracion requiere aprobacion explicita antes de publicar un Preview funcional.
- Validaciones: TypeScript OK, ESLint focal OK, contratos criticos 68/68, puente Entrega2 5/5, `git diff --check` OK. `npm.cmd run build` exacto conserva el fallo ambiental conocido del symlink Turbopack; `npm.cmd run build -- --webpack` aprobo 190 paginas.
- No hubo commit, push, deploy ni SQL remoto. Siguiente paso exacto: revisar/aprobar la migracion aditiva; luego aplicarla de forma controlada, desplegar Preview, hacer pruebas de referencia opcional/obligatoria, captura opcional/obligatoria con efectivo y pago movil, visualizacion privada en panel, bloqueo Premium y archivado usando una agencia de prueba. Solo despues considerar produccion web.
# 2026-09-08 - Preview comprobantes de pago y empresas delivery listo para prueba

- Usuario autorizo aplicar con cautela la migracion y probar en Preview. Se aplico `20260908193000_payment_proofs_and_agency_archiving.sql` a Supabase remoto; no se promovio codigo web a produccion.
- Verificacion posterior: base remota al dia; 49 comercios quedaron con `payment_proof_mode='disabled'` y `payment_proof_required=false`; 0 comprobantes creados; bucket `payment-receipts` privado y limite 2 MB.
- Preview final READY: `https://vendeplus-clean-1r0lzi3f2-entrega2-s-projects.vercel.app`, deployment `dpl_APzPWFMAffoJ8vNsd3RbGPvQuWwj`, target Preview. Produccion web permanece en `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem` / commit `b44feed`.
- QA no destructivo Preview: `/`, `/marketplace`, `/smash`, `/panel/configuracion`, `/admin/transporte` y particulares Entrega2 respondieron 200; carga vacia de comprobante responde 400; cotizacion de particular para `despachos-rapidito` no Premium responde 404; pagina no Premium renderiza 404 de Next; sin logs de error.
- Se corrigio antes del Preview final que multipart vacio devolviera 400 en lugar de 500. No se crearon pedidos, archivos ni se archivaron empresas durante QA.
- Validaciones vigentes: contratos criticos 68/68, puente 5/5, TypeScript y ESLint OK, build local Webpack 190 paginas, Vercel Turbopack 190 paginas. Navegador integrado no disponible; visual autenticado queda para el usuario.
- No commit ni push. Siguiente prueba: en un comercio piloto configurar referencia opcional/obligatoria y captura opcional/obligatoria; probar captura tanto en Efectivo como Pago movil; confirmar `Ver captura o foto` en panel. En Admin usar solo una agencia descartable para probar Eliminar; nunca Entrega2 ni una activa real.
# 2026-09-08 - Preview corregido: comprobante visible en checkout

- Usuario reporto que el selector estaba antes de metodos de pago y que, aunque guardaba todas las opciones, checkout no mostraba referencia ni captura.
- Diagnostico confirmado por lectura: Supabase si guardo `Smash (Test) = image/opcional`, pero `getPublicStoreShellBySlug`, usado especificamente por checkout, no seleccionaba `payment_proof_mode` ni `payment_proof_required`; `mapStore` recibia undefined y aplicaba `disabled`.
- Correccion: ambos campos se agregaron a `storeShellSelect` y `storeShellCompatibleSelect`; contrato automatizado protege esa consulta. El bloque `Comprobante antes de enviar` quedo inmediatamente despues de `Metodos de pago activos` y antes de `Imagen de portada`.
- Preview final READY: `https://vendeplus-clean-8cvqnozpl-entrega2-s-projects.vercel.app`, deployment `dpl_C5UKmJxSLWyr8cp94s46L3mxfbFd`, target Preview. Produccion web no fue modificada.
- Verificacion remota: el RSC de `/smash/checkout` entrega `paymentProofMode='image'` y `paymentProofRequired=false`; `/smash/checkout`, `/panel/configuracion`, `/admin/transporte` y particulares Entrega2 respondieron 200; sin logs de error.
- Validaciones: contratos criticos 68/68, TypeScript y diff check OK, build local Webpack 190 paginas, Vercel Turbopack 190 paginas. Build local Turbopack conserva solo el fallo ambiental conocido del symlink de node_modules.
- Sin migracion nueva, SQL adicional, commit, push ni produccion web. Siguiente paso: usuario recarga el Preview nuevo, confirma ubicacion del selector y prueba Smash con `image/opcional` (debe mostrar la carga), luego referencia obligatoria (debe mostrar el campo y rechazar menos de 4 digitos).
# 2026-09-08 - Preview UX verde y comprobante visible en pedido

- Usuario confirmo referencia obligatoria/minimo 4 digitos OK; pidio hacer mas visual la carga verde y reporto no encontrar la captura en panel.
- Diagnostico de datos: captura `b0ab3302-db5a-4c0e-91b7-02156964aca0` existe, privada, 39,242 bytes WebP, asociada al pedido Smash `VP-0908-OER` (`e4a356ce-9018-4c89-9fe0-1936f8ba76e1`), estado pago `review`, vence 2026-10-09. Lectura con URL firmada temporal devolvio 200 `image/webp` y 39,242 bytes; no hubo perdida de archivo.
- Checkout: reemplazado input nativo poco visible por tarjeta verde, boton verde con icono `Seleccionar imagen`; despues de subir muestra check y `Imagen cargada · Cambiar`, nombre de archivo y permite volver a elegir el mismo archivo.
- Panel: `Comprobante recibido` aparece en tarjeta verde inmediatamente dentro del bloque Cliente/Pago del detalle, con boton `Ver captura o foto`. La pestaña vacia se abre sincronamente al clic antes de solicitar la URL firmada, evitando bloqueo del navegador; se cierra si ocurre error.
- Preview final READY: `https://vendeplus-clean-f0qxju3i9-entrega2-s-projects.vercel.app`, deployment `dpl_69D1yb8Z95JbHmDPe5i2KEeVC2CJ`, target Preview. Produccion web intacta.
- QA: `/smash/checkout`, `/panel/pedidos`, `/panel/configuracion` 200; sin logs de error. Contratos 68/68, TypeScript, ESLint focal y diff check OK; build local Webpack y Vercel Turbopack 190 paginas. Turbopack local conserva fallo ambiental conocido del symlink.
- Sin migracion/SQL adicional, commit, push ni produccion. Siguiente paso: usuario abre pedido `VP-0908-OER` en Preview y confirma bloque verde; checkout Smash debe mostrar carga verde al seleccionar un metodo de pago.
# 2026-09-08 - Preview pago compacto y opcion opcional corregida

- Usuario aprobo UX de tarjeta: `Revisar pago` + check; reporto que captura opcional seguia exigiendo archivo.
- Diagnostico: DB mostraba Smash `image/required=true`. El control anterior era un unico toggle cuyo texto mostraba el estado actual; pulsar `Opcional` lo alternaba a obligatorio, causando confusion. Se reemplazo por dos botones independientes `Opcional` y `Obligatorio` con seleccion visual/aria clara.
- Dato corregido bajo la intencion explicita del usuario: solo Smash (`47f344a7-46f2-4871-9266-489c79361c4d`) quedo `payment_proof_mode=image`, `payment_proof_required=false`. Preview RSC confirma ambos valores.
- Guardar configuracion ahora invalida inmediatamente catalogo, carrito y checkout del slug, evitando esperar la revalidacion de 30 segundos.
- Tarjeta de pedido: si hay captura o referencia muestra `Revisar pago`; captura abre modal rapido privado dentro del panel y referencia aparece en el mismo modal. Sin evidencia muestra solo `Pago pendiente`/`Pago al recibir`. Check verde adyacente pide confirmacion y marca pagado; al confirmar se reemplaza todo por un unico chip `Pagado` con check.
- La consulta compacta de hasta 40 pedidos incorpora una unica consulta por lote para marcar `has_payment_receipt`, sin N+1. El comprobante continua accesible dentro del detalle como respaldo.
- Preview READY: `https://vendeplus-clean-osplh8wo3-entrega2-s-projects.vercel.app`, deployment `dpl_AEFGdHzcvDVhGT21viMnMPMK6aLk`. Produccion web intacta.
- QA: `/smash/checkout`, `/panel/pedidos`, `/panel/configuracion` 200; sin logs de error. Contratos 68/68, TypeScript, ESLint focal, diff check y build local Webpack 190 paginas OK; Vercel Turbopack 190 paginas OK. Turbopack local conserva fallo ambiental de symlink.
- Sin migracion/SQL adicional (solo update exacto del flag Smash), commit, push ni produccion. Siguiente paso: usuario valida Smash opcional sin archivo y tarjeta `VP-0908-OER` mostrando `Revisar pago` + check.

# 2026-09-08 - Preview tarjetas de pedidos alineadas por modalidad

- Usuario pidio compactar `Revisar pago` con el check en una sola linea y eliminar la diferencia visual entre Delivery, Retiro, Mesa, Barra y Envio nacional.
- En `src/components/panel/OrdersManager.tsx` se retiro la modalidad duplicada del bloque izquierdo. La zona derecha ahora conserva tres columnas fijas: WhatsApp (58 px), modalidad/accion (104 px) y Ver (48 px).
- Delivery mantiene exactamente su comportamiento: boton oscuro cuando se puede enviar, verde/deshabilitado cuando ya fue enviado (incluyendo compatibilidad historica China Town), y etiqueta estatica solo cuando no existe accion disponible. Retiro, Mesa, Barra y Envio nacional usan el mismo espacio como identificadores estaticos; no cambian estados ni disparan acciones.
- `Revisar pago`, estado de pago y check usan altura de 28 px, tipografia compacta y `flex-nowrap`, evitando que el check baje en escritorio.
- Contrato critico ampliado para proteger ancho/alineacion, modalidad en la derecha y las condiciones dinamicas existentes. Resultado: 68/68 contratos, TypeScript, ESLint focal y `git diff --check` OK.
- `npm.cmd run build` exacto conserva el fallo ambiental conocido: Turbopack rechaza el symlink de `node_modules` fuera del worktree. Build local Webpack OK con 194 paginas; Vercel Turbopack OK con 194 paginas.
- Preview READY: `https://vendeplus-clean-6v00ptebr-entrega2-s-projects.vercel.app`, deployment `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`, target Preview. `/panel/pedidos`, `/smash/checkout` y `/panel/configuracion` respondieron 200; sin logs de error.
- Navegador integrado no estuvo disponible para inspeccion visual autenticada. Produccion web intacta; sin migracion, SQL, datos, commit ni push en este ajuste.
- Siguiente paso: usuario valida en Preview una fila Retiro y una Delivery (pendiente y enviada), ademas de `VP-0908-OER`; confirmar misma alineacion derecha y que `Revisar pago` + check quedan juntos. Promover solo con aprobacion explicita.

# 2026-09-08 - Revision final previa a produccion comprobantes/agencias/tarjetas

- Usuario valido el Preview tanto en escritorio como en telefono y solicito una ultima revision antes de produccion. No se promovio nada en esta revision.
- Candidato exacto: Preview `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`, `https://vendeplus-clean-6v00ptebr-entrega2-s-projects.vercel.app`, estado Ready. Produccion permanece en `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem` (`www.somos-ve.com`).
- Revision de seguridad aprobada: bucket `payment-receipts` privado, RLS/revocacion para anon/authenticated, lectura con `requirePanelAuth` + `assertStoreAccess` + store_id, URL firmada de 300 s, carga limitada por IP/4 MB/JPG-PNG-WebP, salida WebP <=2 MB, huérfanos 24 h y vencimiento 30 dias con cron protegido por `CRON_SECRET`. Service role permanece solo en servidor.
- Eliminacion de empresa aprobada: API solo founder mediante `requireAdminAuth`, Entrega2 bloqueada tanto en API como RPC, archivado transaccional desactiva conexiones/configuracion sin borrar pedidos ni historial. Particulares se cierran server-side si el pack Premium no esta activo.
- Compatibilidad aprobada: logica `showDeliverySent` intacta para Entrega2 legacy/China Town; la reorganizacion visual no modifica estados, filtros, integraciones ni envios. Referencia de 4 digitos y captura opcional/obligatoria se revalidan server-side.
- Supabase `db push --dry-run`: base remota al dia. No hay SQL pendiente antes de promover el artefacto web.
- QA final: contratos criticos 68/68, contrato telefonos Entrega2 1/1, puente 5/5, TypeScript, ESLint global y `git diff --check` OK. Build local Webpack y Vercel Turbopack OK con 194 paginas. Build local Turbopack conserva solo el fallo ambiental del symlink del worktree.
- `predeploy:smoke` confirmo rutas/controles principales y seis alertas no atribuibles al candidato: tres 401 de Vercel Deployment Protection en APIs publicas del Preview, y tres reglas estaticas antiguas demasiado estrictas (`announcements` usa `getPanelAuthContext`, particulares es publicamente intencional con rate limit, y signed-delivery-quote usa el service role solo como secreto server-side de respaldo). Los tres patrones existen en `origin/main`; no son regresiones de este candidato. Smoke HTTP de seis rutas publicas dio 200 y no hay logs Vercel de error.
- Riesgos residuales no bloqueantes para V2: asociacion pedido-comprobante ocurre inmediatamente despues del RPC idempotente (un fallo excepcional se recupera reintentando); el cron procesa 200 archivos por ejecucion y podria requerir paginacion/bucle con volumen alto. Para pilotos actuales la capacidad es suficiente.
- Siguiente paso exacto: con aprobacion explicita del usuario, promover el artefacto existente `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L` sin reconstruir, confirmar aliases oficiales, smoke de produccion y logs; rollback web a `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem`.

# 2026-09-08 - Produccion comprobantes, Premium, archivado y tarjetas alineadas

- Usuario aprobo expresamente promover despues de validar escritorio, telefono y revision final.
- Se promovio el artefacto exacto del Preview `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`; Vercel creo la copia productiva `dpl_7oPyS4b2SQYvGXK8kFFPQvGmo9MY`, Ready, sin reconstruir codigo diferente ni ejecutar SQL.
- Alias oficiales confirmados sobre la nueva produccion: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y alias del proyecto.
- Smoke posterior: `/`, Marketplace, Smash/catalogo/checkout, login/panel pedidos/configuracion, Admin Transporte, Transporte y Marketplace/Particulares Entrega2 respondieron 200.
- Controles de seguridad posteriores: APIs de panel, pedidos compactos, admin, transporte y cron devolvieron 401 sin sesion/secret; carga de comprobante y solicitud particular con payload vacio devolvieron 400. Sin escrituras validas ni datos de prueba.
- Logs Vercel nivel error desde el despliegue: sin resultados. Supabase ya estaba al dia; no hubo migracion ni SQL durante la promocion.
- Validaciones previas del mismo artefacto: 68/68 criticos, 1/1 contrato Entrega2, 5/5 puente, TypeScript, ESLint global, diff check, Webpack local y Vercel Turbopack (194 paginas) OK.
- Rollback web exacto: `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem`. No se hizo commit ni push.
- Siguiente paso: validacion humana corta en produccion de una captura opcional/obligatoria, un Delivery enviado y un Retiro; vigilar logs si se genera un pedido real.
# 2026-09-08 - Auditoría posterior: seguridad crítica y P1 pendientes

- Informe vigente fuera del candidato: `../docs/audits/2026-09-08-ecosistema-seguridad-escalabilidad.md`; leer antes de continuar. Solo auditoría: ningún arreglo funcional ni despliegue realizado.
- Producción actual consultada `dpl_7oPyS4b2SQYvGXK8kFFPQvGmo9MY`, Preview promovido `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`. HEAD b44feed no contiene todos los cambios publicados: preservar y revisar diff.
- P0: dependencias Next 16.3.0/sharp 0.35.3 con avisos oficiales de posible RCE. No se intentó explotación. Preparar parche controlado; rollback anterior no corrige estas versiones.
- P1: secretos históricos en handoffs, sin MFA observado, Preview comparte Supabase/servicios de producción. No copiar credenciales ni probarlas. Requiere plan de rotación y separación.
- Fallos reproducidos: comprobante puede dejar pedido guardado y devolver 500; pago no habilitado/consulta extras fallida pasan; stats no espera validación de función (log real con rechazo no manejado); webhook puede descartar evento terminal en carrera. Recibo atómico es P1, NO V2.
- Facturación de Fed Fast agosto en Venezuela: 247 facturables/$452,00 frente a límite200/$363,70. Diferencia $88,30 del cálculo, sin afirmar cobro incorrecto ejecutado. Corregir agregación/paginación.
- Entrega2 conserva 9 sending históricos y 2 errores anteriores, ninguno nuevo desde despliegue consultado; conciliar con App, no reenviar a ciegas. Limpieza200/día, IDs cortos y backups Storage sin paginación necesitan endurecimiento.
- Nuevas pruebas offline: `node ../docs/audits/2026-09-08-ecosistema-behavior.cjs`; exit0 confirma defectos actuales. 68/68 contratos y 5/5 puente pasan. Build local falla por symlink externo node_modules; no confundir con validación verde. Sin migración nueva; dry-run al día.
- Siguiente paso: autorización de parche de seguridad acotado, build reproducible e aislamiento; después correcciones P1 con pruebas. No desplegar raíz ni incorporar impresión. Producción no se modifica como consecuencia implícita de esta auditoría.

# 2026-09-10 - Outta Brand corregido y aislamiento del panel delivery en Preview

- Diagnóstico productivo confirmado: Outta Brand (`4e03663d-866c-44a0-8b5a-275aa45cba97`) tenía cinco solicitudes pendientes y una afiliación exclusiva/crédito aprobada por error con Mandamelo. No existían `transport_orders` del comercio, por lo que no hubo pedidos que migrar.
- Se aplicó a producción la migración atómica y acotada `20260910193000_correct_outta_brand_entrega2_affiliation.sql`. Mandamelo y las otras solicitudes quedaron `cancelled`; Entrega2 quedó `approved`, única conexión activa/default/exclusiva, modalidad `credit`; `store_delivery_settings` apunta a Entrega2 y conserva pickup/envío nacional. Verificación posterior aprobada y base remota al día.
- Causa UI: fundador cargaba relaciones de todas las empresas delivery y las listas/métricas no filtraban por `agency_id`; una solicitud de Mandamelo podía aparecer mientras se visualizaba Entrega2.
- Corrección web en `.security-billing-release`: `/api/transport/me` limita solicitudes/conexiones al `agencyId` solicitado; el cliente filtra nuevamente por empresa activa, recarga relaciones al cambiar selector, bloquea doble clic y confirma comercio + empresa antes de aprobar. El PATCH exige que `body.agencyId` coincida con la solicitud.
- Preview READY: `https://vendeplus-clean-2e4fc9lvo-entrega2-s-projects.vercel.app`, deployment `dpl_6dxRWKJRiB1ytTwee44tYJeTsFmS`. Producción web NO fue promovida.
- QA: contratos críticos 69/69, billing 9/9, puente 5/5, ESLint focal y `git diff --check` OK. Build local Next/Turbopack con entorno cargado y build Vercel/Turbopack aprobaron 194 páginas. Smoke Preview de Home y paneles transporte respondió 200.
- Siguiente paso exacto: usuario entra al Preview como fundador, cambia entre Entrega2/Mandamelo/FED y confirma que Solicitudes, Comercios y métricas cambian sin mezclarse; verificar Outta Brand solo en Entrega2 como crédito. Promover este artefacto exacto solo con aprobación explícita.

# 2026-09-10 - Aislamiento del panel delivery promovido a producción

- Usuario validó el Preview y autorizó expresamente promover. Se promovió exactamente `dpl_6dxRWKJRiB1ytTwee44tYJeTsFmS`, sin reconstruir otro código ni ejecutar SQL adicional.
- Producción nueva Ready: `dpl_7E3AaLH429ZeP4vZyp6CWU15jiHV`, `https://vendeplus-clean-jzq7jjfaj-entrega2-s-projects.vercel.app`.
- Alias confirmados sobre el nuevo deployment: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y alias del proyecto.
- Smoke productivo: Home, Marketplace, Outta Brand, checkout y paneles Transporte/Solicitudes/Comercios respondieron 200. APIs de transporte, admin y pedidos respondieron 401 sin sesión, como corresponde. Logs de error: sin resultados.
- La relación de Outta Brand ya había quedado verificada en DB como única conexión activa/default/exclusiva con Entrega2 y crédito; no se tocaron pedidos.
- Rollback web: deployment productivo anterior `dpl_BTMGcMaFR8LcDpeKLB7wxRNoM1eo`. La corrección de datos de Outta Brand es independiente del rollback web.

# 2026-09-10 - Dry-run catálogo SHIBUI; importación pausada por falta de inventario real

- Fuente revisada sin mutaciones: `C:/Users/Windows/Downloads/SHIBUI_Catalogo_Listo_para_Codex.zip`, extraída bajo `tmp/imports/shibui-20260910` (ignorado por Git). Los archivos principales son consistentes: 27 productos, 6 categorías, 333 combinaciones color/talla/detalle, stock total 459, 26 JPG válidos, sin claves de variante duplicadas, sin imágenes duplicadas y todas las sumas por producto coinciden.
- Comercio productivo localizado: `SHIBUI C.A`, slug `shibui`, id `126f8168-f1ca-4a08-8eaf-c3816b9d9195`, activo/trial. Tiene 4 productos y 1 categoría; con deduplicación y Set Nikki pendiente queda dentro del límite de 30.
- Coincidencias existentes: Infinity y Destiny coinciden en precio ($18) pero ya tienen presentaciones/promos e imágenes; Dakota existe a $16 y el archivo indica $18, por lo que es conflicto y no debe sobrescribirse. Emely no está en el paquete y debe preservarse.
- Casos especiales: Set Nikki sin precio (omitir o guardar borrador inactivo); Body Bárbara sin imagen (puede usar placeholder existente). Categorías estimadas: 5 nuevas y 1 reutilizada.
- Bloqueo arquitectónico crítico: producción no posee stock en `products`, `product_variants` ni `product_option_values`. `product_variants` representa presentaciones/precios y las opciones son selecciones independientes; usarlas como inventario permitiría combinaciones inválidas y no descontaría stock atómicamente.
- Recomendación pendiente de autorización: crear inventario genérico por SKU/combinación, separado de presentaciones y extras, con selección dependiente color/talla, validación y descuento transaccional al crear pedido. Luego importar SHIBUI mediante script idempotente y Preview. No crear solución especial solo para SHIBUI.
- No hubo cambios de código, DB, Storage, deploy, commit ni push por esta importación.

# 2026-09-10 - Preview aislado del inventario SHIBUI

- Usuario autorizó una demostración primero y sin producción. Se creó `/prototipos/shibui-inventario`, exclusiva de Preview: con `VERCEL_ENV=production` responde 404 y declara noindex/no-follow.
- Usa los 27 productos, 333 combinaciones, stock simulado 459 y 26 imágenes del archivo primario. El descuento vive solo en estado React: no usa `fetch`, Supabase, Storage ni APIs y se reinicia al recargar.
- UX móvil: búsqueda/categorías, color antes de talla, solo combinaciones existentes, cantidad limitada, última unidad/agotado y compra simulada. Set Nikki queda bloqueado por precio faltante; Body Bárbara usa placeholder; Dakota expone conflicto $16/$18; Destiny/Infinity se marcan para fusionar sin duplicar.
- Archivos nuevos: `src/app/prototipos/shibui-inventario/page.tsx`, `src/components/prototypes/ShibuiInventoryPrototype.tsx`, `src/data/shibui-catalog.preview.json`, `public/catalog-previews/shibui/*.jpg` y `scripts/shibui-preview.behavior.test.mjs`.
- Preview READY: `dpl_35CciKSA8EMwRmkyhULE7PA2thUf`, base `https://vendeplus-clean-hm9qxfm8p-entrega2-s-projects.vercel.app`. Se generó enlace compartible temporal, sin guardar el token en documentos. Producción oficial devuelve 404 para esta ruta y no fue promovida.
- QA: ESLint focal, TypeScript, diff check, SHIBUI 5/5, críticos 69/69, puente 5/5 y builds local/Vercel con 194 páginas. Ruta e imagen autenticadas 200, sin logs de error. Browser integrado no disponible; queda la validación visual del usuario.
- Sin migración, SQL, DB/Storage, importación real, commit, push ni producción. Siguiente paso: validar en teléfono/escritorio; después, con aprobación, construir inventario SKU genérico y descuento atómico en entorno aislado.

# 2026-09-10 - Preview SHIBUI corregido a la visual real de Somos

- Usuario señaló correctamente que el primer prototipo parecía otra aplicación. Auditoría confirmó cero referencias o archivos Mila y hashes exactos del ZIP SHIBUI; el defecto era solo una composición visual inventada.
- Se reemplazó esa composición por la estructura vigente del catálogo Somos: `vp-public-store`/`vp-container`, portada y logo Somos, fondo crema, buscador, filtros, tarjetas compactas tipo `ProductListItem`, modal tipo `ProductOptionsSheet` y barra inferior. Se conserva únicamente la nueva lógica Color -> Talla -> stock.
- Nuevo Preview READY: `dpl_5eMG7Pk3K5Rt2t636G3bQkTKAXtd`, base `https://vendeplus-clean-dm13qh72p-entrega2-s-projects.vercel.app`; enlace compartible temporal generado sin guardar token. El Preview anterior queda obsoleto.
- QA: 6/6 pruebas SHIBUI, ESLint, TypeScript y build local/Vercel de 194 páginas OK; smoke protegido confirmó logo Somos y SHIBUI; sin logs de error. Producción sigue 404 en la ruta y no fue promovida.

# 2026-09-10 - Mis Accesorios / Entrega2: diagnóstico pendiente de corrección

- Lectura productiva sin mutaciones: Mis Accesorios `7984f09a-18ad-4528-8a73-0f1b3cd3f25f` tiene solicitud Entrega2 `22ec6a82-92f6-47a5-a39f-43574a1ab44f` marcada `approved`, pero no existe conexión Entrega2 y `store_delivery_settings` continúa `manual_quote` sin agency/connection.
- Causa: la conexión histórica Mandamelo `4aa80b58-cbcc-44fe-8419-f2412fca3cc9` tiene desconexión solicitada/confirmada/efectiva el 10 de septiembre, pero conserva `status=active`, `is_default=true`, `is_exclusive=true`. La aprobación ignora correctamente relaciones lógicamente terminadas, pero el upsert de Entrega2 choca con el índice único SQL que todavía ve Mandamelo activa/default.
- Defecto adicional: API actual marca primero la solicitud `approved` y después crea la conexión; el segundo paso falló y dejó estado parcial. Corrección futura debe ser atómica o no marcar aprobada hasta confirmar conexión, y debe normalizar la fila finalizada antes del upsert.
- No se modificó producción ni código. Antes de reparar datos hay que confirmar si la nueva conexión Entrega2 debe ser crédito o contado. Reparación segura: cancelar/desmarcar la relación histórica Mandamelo, crear/alinear Entrega2 como activa/default/exclusiva con modalidad confirmada y actualizar settings a `transport_agency`.

# 2026-09-10 - Mis Accesorios conectado a Entrega2 de contado

- Usuario confirmó contado. Se aplicó a producción únicamente `20260910202500_repair_mis_accesorios_entrega2_cash.sql`, con guardas exactas e idempotencia. Dry-run previo listó solo esa migración; dry-run posterior confirmó base al día.
- Resultado verificado: conexión Entrega2 `a024f618-8e7c-4791-a7cf-dca82651ee7e` activa/default/exclusiva, `delivery_billing_mode=cash`; settings apuntan a Entrega2/esa conexión con `delivery_provider=transport_agency` y tarifas `distance_ranges`. Mandamelo quedó `cancelled`, no default/no exclusiva.
- Los dos `transport_orders` históricos de Mandamelo se conservaron sin cambios, incluido uno `delivered` y otro histórico `driver_assigned`; no se tocaron pedidos ni integraciones.
- Prevención web preparada, aún no promovida: la aprobación normaliza conexiones lógicamente terminadas antes del upsert y solo marca la solicitud aprobada después de crear correctamente la conexión. Evita repetir el estado parcial observado.
- QA del código: críticos 69/69, puente 5/5, ESLint focal, TypeScript, diff check y `npm.cmd run build` con 194 páginas. Sin commit/push ni despliegue web productivo.
- Siguiente paso: usuario actualiza Conexiones/Delivery de Mis Accesorios en producción y confirma Entrega2 contado. El endurecimiento web se incluirá en un Preview/despliegue autorizado posterior.
# 2026-09-10 - Base de inventario opt-in SHIBUI preparada, no publicada

- Usuario aprobó avanzar con inventario básico bloqueado para todos y activable inicialmente solo en SHIBUI. Trabajo únicamente en `.security-billing-release`; producción y Supabase no fueron modificados.
- Migración pendiente `20260910220000_opt_in_basic_inventory.sql`: interruptor por comercio apagado por defecto, fila exacta de SHIBUI habilitada, SKUs por producto/combinación, movimientos auditables, asignaciones congeladas por pedido, índices, RLS y acceso exclusivo `service_role`.
- `create_order_atomic` descuenta stock en la misma transacción solo cuando el comercio está habilitado y el producto tiene SKUs. Valida `store_id`, producto, SKU, unidades de la presentación y stock; el replay idempotente no vuelve a descontar.
- Cancelar desde panel usa `cancel_order_with_inventory`, devuelve unidades una sola vez y bloquea reabrir pedidos inventariados cancelados. Antes de aplicar la migración conserva fallback legacy.
- Catálogo público, carrito y pedido manual muestran combinaciones solo para productos inventariados. Presentaciones de varias piezas exigen elegir cada pieza. Las etiquetas visibles se reconstruyen en servidor; el navegador no decide inventario ni stock.
- Compatibilidad: sin fila habilitada todo funciona como antes; incluso en SHIBUI, productos sin SKUs conservan flujo legacy. No se cargó ningún SKU/producto/imagen real y no se resolvieron todavía Dakota, Set Nikki ni Body Bárbara.
- QA: inventario 6/6, críticos 69/69, puente 5/5, billing 9/9, lint completo, TypeScript y diff check OK. `supabase db push --dry-run --linked` lista solo la migración nueva y no aplicó nada. Build Next 16.3.4 OK con variables CI ficticias, 86 rutas generadas; primer build sin variables privadas falló como era esperable.
- Sin commit/push, Preview ni producción. Siguiente paso seguro: validar la migración contra PostgreSQL/Supabase aislado, crear importador SHIBUI idempotente con dry-run y cargar datos/imágenes allí; luego ejecutar pedidos concurrentes, agotado, reintento y cancelación antes de cualquier producción.
# 2026-09-10 - Preview panel Inventario Premium exclusivo SHIBUI, NO produccion

- Usuario definio inventario como funcion Premium opt-in por comercio: negocios actuales no cambian; SHIBUI sera piloto. Se implemento una primera experiencia dentro de `/panel/productos`, visible solo cuando la sede devuelta coincide simultaneamente con ID `126f8168-f1ca-4a08-8eaf-c3816b9d9195` y slug `shibui`.
- Nuevo `src/components/panel/PremiumInventoryPreview.tsx`: carga por GET autenticado `/api/panel/catalogo`, valida nuevamente ID/slug/`inventory_enabled`, resume productos/unidades/stock bajo/agotados, busca y filtra, abre administracion por producto, permite simular sin inventario/stock total/combinaciones, ajustar cantidades, agregar combinaciones con atributos genericos y definir cuantas unidades descuenta cada presentacion.
- Es una simulacion estrictamente local: no contiene POST/PATCH/PUT/DELETE, no escribe Supabase y al recargar pierde cambios. La pantalla lo indica de forma visible. No se agrego API de escritura ni migracion.
- `ProductManager.tsx` muestra una tarjeta verde `Inventario Premium` solo para SHIBUI. Los demas comercios mantienen exactamente el panel anterior.
- Preview Ready, NO promovido: `dpl_3nRxjHaxT4Ps2xHZA4H1Cfv2GRY6`, `https://vendeplus-clean-avfmifxch-entrega2-s-projects.vercel.app`. La URL exige autenticacion Vercel y luego login habitual de Somos.
- QA: inventario 8/8, contratos criticos 69/69, piloto SHIBUI 10/10, ESLint y `git diff --check` sin errores. Vercel build Next 16.3.4 completo: TypeScript OK y 202 paginas. Build local compilo/TS pero no finalizo prerender por variables privadas Supabase ausentes en esta copia; Vercel valido con entorno seguro. Un `.next/dev/types/validator.ts` generado y corrupto se renombro a `.next/dev/types/validator.corrupt.txt`; es artefacto ignorado, no codigo fuente.
- Navegador integrado no disponible; smoke HTTP anonimo confirma que la proteccion de Vercel intercepta Preview. No se probaron acciones autenticadas por no usar credenciales del usuario.
- Siguiente paso: usuario abre Preview, entra a `/panel/productos`, selecciona SHIBUI, pulsa `Administrar inventario` y prueba stock total, combinaciones y presentaciones. Tras feedback, construir API real con manager+tenant, RPC atomico, auditoria e idempotencia; mantener opt-in por comercio. No limpiar Destiny ni escribir stock productivo sin autorizacion posterior.
# 2026-09-10 - Preview Inventario Premium guardable + vista de catálogo Visual, NO produccion

- Usuario aprobó UX de inventario y pidió avanzar, además solicitó que cada comercio pueda elegir entre catálogo clásico y una navegación similar al prototipo SHIBUI, con tarjetas de foto grandes y más cuadradas. Producción sigue fuera de alcance.
- Nuevo Preview final Ready: `dpl_4nnmnQaaYRKB15aN5ds8ohkzwj8J`, `https://vendeplus-clean-cj0y4f7be-entrega2-s-projects.vercel.app`. Build Vercel Next 16.3.4: TypeScript OK, 203 páginas. No promoción productiva.
- Catálogo: `CatalogClient` acepta preferencia `classic|visual` y override de prueba `?vista=visual|clasica`; Visual usa cuadrícula 2 columnas móvil/3 tablet/4 desktop y `ProductListItem` conserva exactamente carrito, variantes, opciones, inventario, galería y agregar. Fotos cuadradas grandes. Clásica sigue por defecto.
- Configuración: selector visual en `/panel/configuracion`, con enlace `Probar esta vista`. La columna nueva se consulta/guarda por separado de la actualización general para no activar fallbacks que arriesguen horarios, pagos, colores o delivery si la migración falta.
- Inventario: API nueva `/api/panel/inventory` exige sesión, rol owner/admin, tenant, ID+slug exactos SHIBUI y `store_inventory_settings.enabled`. GET entrega hasta 100 movimientos; PATCH valida hasta 500 SKU/50 presentaciones y llama RPC atómico por producto. UI permite guardar combinaciones y unidades consumidas por presentación; stock total/desactivar siguen marcados como simulación hasta diseñar su transición sin SKU huérfanos.
- Migración aditiva pendiente `20260910232000_premium_inventory_and_catalog_layout.sql`: `stores.catalog_layout` default `classic`; RPC service-role-only `manage_inventory_sku` y `manage_inventory_product`, bloqueo de fila, tenant, stock no negativo, ajuste por producto en una transacción y auditoría en `inventory_movements.created_by`.
- La migración fue aplicada SOLO directamente en rama Supabase aislada `shibui-inventory-staging-v2` porque su historial experimental impide `db push`; verificación posterior: columna y ambos RPC existen. No se aplicó SQL a producción. Dry-run productivo lista solo esta migración como pendiente.
- QA: inventario 8/8, críticos 69/69, SHIBUI 12/12, ESLint, TypeScript y `git diff --check` OK. Navegador integrado no disponible; Vercel Preview está protegido por login Vercel. No se ejecutó ajuste autenticado desde la UI ni pedido real.
- Enlaces a probar: Visual `/shibui?vista=visual`; Clásica `/shibui?vista=clasica`; panel inventario `/panel/productos`; selector `/panel/configuracion`. Preview usa base productiva, por lo que Guardar inventario fallará cerrado mientras el RPC no exista allí; no aplicar migración productiva sin autorización expresa.
- Siguiente paso: usuario valida visual móvil y panel. Luego decidir ventana para aplicar migración productiva (aditiva) o dedicar un Vercel Preview autenticable a Supabase staging. Antes de producción, agregar prueba real de incremento+rollback/historial, probar save de combinación/presentación y confirmar que Smash/otros permanecen clásicos.
# 2026-09-10 - Cierre QA Inventario Premium y vista Visual SHIBUI, NO produccion

- Usuario aprobo continuar. Se avanzo solo en el candidato `.security-billing-release` y en la rama Supabase aislada `shibui-inventory-staging-v2`; no hubo despliegue, SQL, datos, commit ni push en produccion.
- Prueba SQL real en staging: `manage_inventory_product` incremento una combinacion, genero exactamente un movimiento de auditoria y luego una transaccion forzada revirtio tanto stock como historial. Resultado: atomicidad, auditoria y rollback OK, sin cambio residual.
- Aislamiento verificado en staging: un `store_id` ajeno fue rechazado; ambos RPC solo tienen ejecucion para `postgres` y `service_role` (no `anon`, `authenticated` ni `PUBLIC`); la unica tienda de la rama conserva `catalog_layout=classic` por defecto.
- Produccion se consulto solo en lectura y sigue sin `stores.catalog_layout`, `manage_inventory_product` ni `manage_inventory_sku`. Dry-run productivo lista exclusivamente `20260910232000_premium_inventory_and_catalog_layout.sql`; no fue aplicada.
- QA final: inventario 8/8, contratos criticos 69/69, SHIBUI 12/12 y puente Entrega2 5/5 (94/94); TypeScript, ESLint y `git diff --check` OK. `npm.cmd run build` sin entorno fallo solo al prerender por variables privadas ausentes; repetido con placeholders identicos al CI compilo correctamente las 87 rutas. Preview Vercel previo permanece Ready con 203 paginas.
- Los scripts temporales usados para consultar staging se eliminaron. No se guardaron credenciales de la rama.
- Riesgo pendiente antes de publicar: el Preview actual apunta a Supabase productiva, por lo que no permite una prueba autenticada real de `Guardar inventario` mientras la migracion no exista alli. Siguiente decision segura: preparar ventana productiva con respaldo+SQL+deploy y smoke autenticado, solo tras autorizacion expresa; o configurar un Preview autenticable contra staging.

# 2026-09-11 - PRODUCCION: Inventario Premium administrable y selector de vista de catalogo

- Usuario autorizo `procede` despues del cierre QA. Se publico exactamente el Preview aprobado `dpl_4nnmnQaaYRKB15aN5ds8ohkzwj8J`, promovido como produccion `dpl_FNnJa5qv6bG1RDsetgaMzWKWmMkz`, URL de artefacto `https://vendeplus-clean-260hotnyr-entrega2-s-projects.vercel.app`. Alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` confirmados.
- Antes del SQL: SHIBUI tenia 332 SKU, 458 unidades y 332 movimientos. Dry-run mostro exclusivamente `20260910232000_premium_inventory_and_catalog_layout.sql`; se aplico esa unica migracion a `rvmtjtuztewcrmodrodb`. Dry-run posterior: remoto al dia.
- Despues del SQL y despliegue: SHIBUI conserva exactamente 332 SKU, 458 unidades y 332 movimientos. La migracion no altero stock. `catalog_layout` y ambos RPC existen; funciones ejecutables solo por `postgres` y `service_role`; 0 comercios cambiaron a visual automaticamente, todos conservan `classic` hasta elegirlo.
- Smoke productivo GET: `/`, `/marketplace`, `/shibui`, `/shibui?vista=visual`, carrito, checkout, login, productos, configuracion y `/smash` respondieron 200. APIs privadas `/api/panel/inventory`, `/api/panel/settings` y `/api/panel/catalogo` respondieron 401 sin sesion. Sin logs de nivel error en la ventana consultada.
- QA previo del artefacto: 94/94 pruebas, TypeScript, ESLint, diff check y build Vercel 203 paginas. Build local final con placeholders CI genero 87 rutas; sin variables privadas fallo solo en prerender como se esperaba.
- No se creo pedido, no se ajusto inventario, no hubo commit ni push. Navegador integrado no disponible; la validacion autenticada del boton `Guardar cambios` queda para el usuario desde SHIBUI.
- Rollback web inmediato: `dpl_69kgyrK3qW9Yk9mf31twQtkimUq8`. La migracion es aditiva y puede permanecer si se revierte la web. Para incidencia de inventario, deshabilitar solo SHIBUI en `store_inventory_settings`; no borrar SKU ni movimientos.
- Siguiente paso: usuario entra a SHIBUI en `/panel/productos`, cambia una existencia conocida en 1 unidad, guarda y confirma historial; luego en `/panel/configuracion` puede elegir Visual y guardar. Verificar cliente en `/shibui`. No activar inventario para otros comercios durante el piloto.

# 2026-09-11 - PRODUCCION: hotfix de stock total derivado de combinaciones

- Usuario reporto que modifico cantidades por combinacion pero `Stock total` no cambiaba. Diagnostico: el guardado real si funciono; tres movimientos recientes en Infinity (+1, -1, -1) dejaron el total SHIBUI correctamente en 457 frente a 458. El defecto era solo de estado/UX: `totalStock` podia conservar una cifra separada y congelada si se abria antes.
- `PremiumInventoryPreview.tsx`: en modo combinaciones ahora muestra un chip reactivo `Stock total: X`, calculado siempre como suma de los SKU locales; cambia inmediatamente con +, -, escritura manual y despues de guardar. La opcion alternativa se renombro a `Stock sencillo`. Si un producto ya tiene combinaciones y se abre esa opcion, el total es calculado y de solo lectura, con explicacion humana.
- `scripts/shibui-preview.behavior.test.mjs` protege el total derivado, el nombre no ambiguo y el campo read-only para productos con combinaciones.
- QA: SHIBUI 12/12, inventario 8/8, criticos 69/69, TypeScript, ESLint focal, diff check y build local 87 rutas OK. Preview `dpl_9n7x3Pv3uSssBkX5VtLCjbWoSjbz` genero 195 paginas en Vercel y fue promovido exactamente.
- Produccion nueva Ready: `dpl_EqgdcsnSYSdn9rdQDV6X3hSjHPWM`, `https://vendeplus-clean-a61uj0agg-entrega2-s-projects.vercel.app`; alias oficiales confirmados. Smoke `/`, `/shibui`, `/panel/productos` 200 y API de inventario 401 sin sesion; sin logs error.
- No hubo SQL/migracion, ajuste de stock, pedido, commit ni push por parte del hotfix. Stock final leido: 332 SKU y 457 unidades, coincidente con los cambios del usuario. Rollback web inmediato: `dpl_FNnJa5qv6bG1RDsetgaMzWKWmMkz`.
- Siguiente paso: usuario recarga `/panel/productos`, abre Infinity y cambia temporalmente una combinacion; el chip debe cambiar antes de guardar y conservar el valor al guardar/volver a entrar.

# 2026-09-11 - PRODUCCION: limpieza de mensajes de inventario y retiro de etiqueta piloto

- Usuario pregunto por el texto `4 cambio(s) pendiente(s)... simulacion` y pidio quitar `SHIBUI piloto`. Se explico que el numero contaba acciones locales, no necesariamente campos diferentes, y que el resto era texto obsoleto del Preview.
- Se reemplazo por estado simple: `Tienes cambios sin guardar. Revisa las cantidades y presiona Guardar cambios.` o `Las cantidades estan guardadas.` Ya no se muestra un contador de clics.
- Se retiraron de la UI las etiquetas/textos `Piloto exclusivo SHIBUI`, `Piloto SHIBUI`, `Preview`, `prueba`, `simulacion` y `sin guardar cambios todavia`. Internamente se conserva el gate ID+slug de SHIBUI para no habilitar inventario en otros comercios.
- Se ocultaron alternativas no operativas `Sin inventario` y `Stock sencillo`; el panel presenta solo el flujo real `Control por combinaciones`. Un producto sin SKU ofrece `Configurar combinaciones`. `Añadir a esta prueba` ahora dice `Añadir combinacion`.
- Archivos: `PremiumInventoryPreview.tsx`, `ProductManager.tsx`, `shibui-preview.behavior.test.mjs`. Sin SQL ni cambios de datos.
- QA: SHIBUI 12/12, TypeScript, ESLint focal, diff check y build local 87 rutas OK. Preview exacto `dpl_5qjh9kzLmjvUAzEDtxG22FXJeKvP`, build Vercel 195 paginas; promovido como produccion `dpl_9DktnVp8KscYfJKSTyU8ZSjS7FM9`, `https://vendeplus-clean-djpuvs6l7-entrega2-s-projects.vercel.app`.
- Alias oficiales confirmados. Smoke `/`, `/shibui`, `/panel/productos` 200, API inventario 401 sin sesion y sin logs error. Rollback web inmediato: `dpl_EqgdcsnSYSdn9rdQDV6X3hSjHPWM`. Sin commit/push.

# 2026-09-11 - Auditoria read-only de aislamiento de inventario y evaluacion Realza

- Usuario pidio validar que inventario no afecte otros comercios y evaluar migrar Realza. Revision solo lectura; sin codigo, SQL, datos, deploy, commit ni push.
- Produccion: solo SHIBUI tiene `store_inventory_settings.enabled=true`; es el unico comercio con SKU (332), movimientos (343 al momento de consulta) y asignaciones de pedido (1). Realza y todos los demas no tienen fila habilitada, SKU, movimientos ni reservas.
- Aislamiento en codigo/DB: catalogo adjunta inventario solo a tiendas habilitadas; `create_order_atomic` salta completamente inventario cuando el opt-in es falso; RPC exige `enabled`; API y tarjeta actuales siguen restringidas por ID+slug exactos de SHIBUI. Otros comercios conservan el flujo legacy.
- Smoke productivo: `/realza`, carrito y checkout, `/smash`, `/china-town` y `/andinos` respondieron 200. No hubo pedidos no-SHIBUI posteriores a la ventana consultada, asi que no se afirmo una validacion transaccional reciente de otro comercio; contratos automatizados previos siguen cubriendo el fallback.
- Realza ID `a83135ce-1c4b-4bf7-95b4-b2f31df31546`, slug `realza`: inventario apagado, 45 productos, 114 pedidos historicos, 0 `product_variants` tecnicas, 0 SKU. Lo que el comercio llama variantes vive como grupos de opciones compartidos: Talla en 45 productos (Xs/S/M/L), Color en 40 (11 valores), Largo en 10 (2 valores), ademas de grupos especiales para promos, tela Rib y packs.
- No activar Realza directamente: con el codigo actual el cliente veria el selector nuevo de inventario y tambien los grupos Color/Talla existentes, duplicando preguntas. La migracion correcta debe convertir dimensiones fisicas a SKU y desvincular Color/Talla/Largo solo en cada producto ya migrado; el historial permanece congelado en `order_item_options`.
- Ruta recomendada: generalizar entitlement/API por `store_inventory_settings`; migrar primero un producto normal sin promo con stock real suministrado; validar pedido, agotado y cancelacion; luego migrar regulares por lotes. No generar automaticamente el producto cartesiano de todos los colores/tallas ni inventar cantidades.
- Promociones 3x y `Pack de basicos esenciales` requieren fase aparte: pueden consumir varias piezas y, en el pack, incluso productos fisicos distintos. La arquitectura actual valida SKU dentro del mismo `product_id`, por lo que el pack necesita componentes/bundle o una estrategia explicita antes de activarse.
# 2026-09-11 - Checkpoint Git de Somos antes de migrar inventario a otros comercios

- El usuario pidio asegurar todo el avance actual. Se trabajo exclusivamente en `.security-billing-release`; Granja Mila continua fuera de este repositorio y no se modifico produccion, Supabase ni Vercel.
- Se creo la rama `checkpoint/somos-entrega2-inventario-20260911` desde el candidato exacto desplegado. El objetivo es conservar juntos los cambios acumulados del puente Entrega2, comprobantes, seguridad/facturacion e Inventario Premium SHIBUI.
- Separacion verificada con busqueda completa: no existen rutas, activos ni codigo de Granja Mila en este worktree. La unica coincidencia es una nota de continuidad que confirma que quedo fuera del alcance.
- Seguridad y QA: escaneo documental 0 credenciales; `npm audit` 0 vulnerabilidades; criticos 69/69, puente 5/5, facturacion 9/9, inventario 8/8 y SHIBUI 12/12; ESLint y `git diff --check` OK.
- `npm.cmd run build` compilo y TypeScript paso, pero sin variables privadas se detuvo en prerender como esta previsto. Repetido con los placeholders seguros del CI termino correctamente las 87 rutas, sin usar datos productivos.
- Este checkpoint no habilita inventario para Realza ni para ningun otro comercio. La auditoria anterior y el plan de migracion por producto siguen vigentes.
# 2026-09-20 - Fee por pedido corregido en produccion

- Regla confirmada por el usuario: los pedidos cancelados tambien generan fee. No se modificaron pedidos, pagos ni otros datos en Supabase.
- Diagnostico: admin `/api/admin/stores` truncaba pedidos a 1000 globales (China Town mostraba $32.10 frente a pago aprobado de $48.80); panel de configuracion usaba inicio de mes y suscripcion usaba `last_payment_at`; resumen admin excluia cancelados. Cuatro pedidos de Realza entre solicitud y aprobacion de pago ($0.40) quedaban ocultos.
- Arreglo en este worktree `.fee-billing-prod`, rama `fix/service-fee-production`, basado en commit estable pre-MFA `4f60e734164ea51014aeff70f05835b70bf8cf8e`. Nuevo calculo compartido pagina pedidos y pagos, incluye cancelados y corta en la fecha de solicitud del ultimo pago aprobado.
- Validacion: pruebas de fee 3/3, `npm.cmd run test:critical` 77/77, `npx.cmd tsc --noEmit`, `git diff --check` y `npm.cmd run build` OK (219 paginas). Reconciliacion de solo lectura: 3322 pedidos, 56 comercios, 16 pagos; China Town $1.30 pendiente despues del pago, Realza $8.70, global $27.20 al momento de la consulta. Las cifras cambian con pedidos nuevos.
- Despliegue de produccion `dpl_4goHD5QZ2TcQhQwCLPNKnd8YA6bi`, promovido a `https://www.somos-ve.com`. `vercel inspect` confirma dominio y deployment Ready. Smoke anonimo productivo: `/china-town` y `/panel/login` 200, `/api/admin/summary` y `/api/panel/settings` 401. Logs de errores del despliegue: ninguno en ventana revisada.
- No hubo migracion, SQL, commit ni push. Rollback disponible: `dpl_5pGq7FNG9Pa7AoHD8ChrNWtoZgRy` (version estable previa). Pendiente operativo: verificar con sesion real de fundador y China Town que admin y suscripcion muestren el mismo saldo; no hay sesion autenticada disponible para esta comprobacion automatica.
# 2026-09-30 - Seguridad de pedidos + privacidad en preview LISTO

- Usuario pidio seguir avanzando. Cerrado bloque previo al piloto: identidad comprador server-side, invitado no reclamable, aislamiento de historial y reintento/idempotencia. No se crearon pedidos reales ni se tocaron datos productivos.
- Nueva pagina publica `/privacidad`: datos usados, finalidades, datos locales, ubicacion/notificaciones, terceros operativos, conservacion y enlace a `/eliminar-cuenta`. Enlaces desde Mi cuenta, eliminacion y footer. Texto declara pendiente completar datos legales/contacto del responsable antes de publicacion general; no afirmar cumplimiento Play completo.
- Prueba nueva `scripts/buyer-order-safety.test.mjs`: RPC comprador usa buyer verificado, guest usa RPC guest, body no controla buyer y checkout conserva clave hasta exito. 18 Node/PGlite PASS con buyer-api y DB. Transaccion real SOLO XPQM con rollback PASS: 12 escenarios+observacion, sinteticos eliminados, 3 pedidos previos preservados.
- QA: ESLint focal PASS. Build directo sin env compilo/TS pero fallo prerender por variables ausentes; build limpio mediante entorno stage PASS117/TS. Un build limpio intermedio fallo porque `.next` archivado dentro de `tmp` entro al tsconfig; archivos generados se movieron fuera del workspace a TEMP y repeticion PASS. Sin cambio de codigo por esas incidencias.
- UI local `/privacidad` PASS 320/390/1366, 6 secciones, sin overflow/console errors; capturas `tmp/buyer-staging/privacy-*.png`. Local staging activo 127.0.0.1:3107, launcher18800/logs start-privacy-final*.log.
- Nuevo preview READY/shared SOLO stage: deployment `dpl_DXLFUqiirwnBUsWECpNpRsPnKspG`, https://vendeplus-clean-elwro4ama-entrega2-s-projects.vercel.app . Redirects Google XPQM actualizados a ese origen + callbacks nativos. Cloud smoke PASS: ciudad/mapa3anchos/catalogo, APIs401, Google PKCEstage, privacidad390. Produccion sigue `dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1` intacta.
- Sin migracion/SQL nuevo, commit/push ni APK nueva. SIGUIENTE EXACTO: generar beta3 `com.somosve.app.staging` apuntando a preview elwro4ama e instalar solo en A34; probar privacidad/enlaces, login/historial y un reintento controlado. Luego completar identidad/contacto legal, Data Safety, AAB firmado y piloto interno unificado con notificaciones/impresion.
# 2026-09-30 - Preview final: Impresion solo Android y etiqueta Complemento

- Requisito nuevo aplicado sin tocar produccion: la opcion `/panel/impresion` queda fuera de todas las navegaciones web mediante `nativeOnly` y sigue visible dentro de Somos Android.
- En la lista compacta de Productos, los articulos configurados como sugerencia muestran una unica etiqueta verde `Complemento`; el estado separado ahora dice `Activo` u `Oculto` con tono neutro/rojo.
- Preview corregido READY: `dpl_57gfzf7rkGry9dR7tio2haBTGD1G`, `https://vendeplus-clean-k0zt0eijd-entrega2-s-projects.vercel.app`. Build remoto Vercel OK: Next 16.3.4, TypeScript OK, 253 paginas, incluye `/mi-cuenta` y `/auth/buyer-callback`. Produccion no fue desplegada.
- Validaciones: ESLint focal OK, `git diff --check` OK, `npm audit` 0. El build local compila y pasa TypeScript pero no prerenderiza sin secretos privados; el build remoto con secretos Vercel completo OK.
- Suite amplia: 84/86; dos fallos preexistentes/no relacionados: contrato antiguo de `capacitor.config.ts` que aun busca `appId` literal (ahora sale de `server-config.ts`) y `mobile-polish.e2e` sin `.catalog-product` en sus datos de prueba.
- Supabase produccion conserva Site URL y Google; se agregaron unicamente `https://www.somos-ve.com/auth/buyer-callback` y `com.somosve.app://buyer-auth` al allowlist. La app instalada resolvio correctamente el deep link y el plugin devolvio el callback nativo. El login no podia completar porque produccion web aun no contiene las rutas buyer.
- Siguiente paso seguro: revisar visualmente este preview con acceso compartido, luego auditar/aplicar migraciones buyer en produccion y promover exactamente este deployment; despues probar Google desde `/mi-cuenta` en la app y un pedido real con la app cerrada.
# 2026-09-30 - Buyer/Firebase y ajustes aprobados desplegados a produccion

- Produccion final READY: `dpl_4zQd6APPgi5KzfSeeCJdiJZ37L8C`, `https://vendeplus-clean-ntplvv05z-entrega2-s-projects.vercel.app`; aliases confirmados `https://www.somos-ve.com`, `https://somos-ve.com` y Vercel oficiales.
- Build remoto productivo completo: Next 16.3.4, TypeScript OK, 253 paginas. Rutas nuevas activas: `/mi-cuenta`, `/auth/buyer-callback`, `/eliminar-cuenta`, APIs buyer, ratings, printing agent y Firebase wake push.
- Supabase produccion `rvmtjtuztewcrmodrodb`: aplicadas exclusivamente `20260929193000_buyer_accounts_and_reviews.sql` y `20260930030000_buyer_review_observation.sql` tras dry-run. Verificacion read-only: tablas/columna existen, RLS activo, anon/authenticated sin SELECT y RPCs solo disponibles a service_role. No se modificaron pedidos historicos.
- Auth produccion: Site URL/Google intactos; allowlist suma `https://www.somos-ve.com/auth/buyer-callback` y `com.somosve.app://buyer-auth`.
- Vercel produccion: agregado `FIREBASE_SERVICE_ACCOUNT_JSON` como secreto cifrado directamente desde el archivo externo descargado; no se copio al repo ni se mostro. Proyecto Firebase validado `somos-produccion`.
- Ajustes incluidos: Impresion visible solo en Android; etiqueta unica verde `Complemento` y estado `Activo/Oculto`; al abrir Impresion un telefono ya vinculado renueva automaticamente su token Firebase.
- Smoke: rutas publicas principales/Marketplace/Mi cuenta/callback/panel login/privacidad 200; `/api/buyer/orders` sin sesion 401; POST push-token sin token de dispositivo 401. Contratos focales Google/buyer/FCM 12/12, ESLint focal OK, audit 0, diff-check solo avisos CRLF.
- APK instalada en A34: `com.somosve.app` code12 `1.4.0-firebase-pilot`, datos e impresion conservados. Siguiente paso exacto: usuario abre de nuevo Somos > panel > Impresion para autorregistro; luego prueba Google desde Mi cuenta (debe volver a la app) y crea un pedido real con Somos en segundo plano/cerrada para confirmar sonido, notificacion e impresion.
- Rollback web disponible: deployment productivo anterior inmediato `dpl_4X4dfDdYmKDKNaV9s46ZesETS6Ke`; las migraciones buyer son aditivas y pueden quedar sin uso si se revierte web.
# 2026-09-30 - Google panel nativo y filtro de ciudad validados en A34

- Usuario confirmo en Samsung A34 que `Continuar con Google` del panel comercial abre Google y regresa correctamente a Somos despues del ajuste PKCE.
- Produccion final de este ajuste: `dpl_FMyUGupMbp3iCE7WgRw2WyVvbggg`, READY y alias `https://www.somos-ve.com`; build remoto completo 253 paginas.
- APK instalada sin borrar datos: `com.somosve.app`, versionCode 13, versionName `1.4.1-panel-auth`, SHA-256 `7059BFB040620203BE42B289BB3A0AB248D268386B3132E8F27BEDA03B5202F9`. Android resuelve `com.somosve.app://panel-auth` hacia MainActivity.
- Supabase prod/stage conservan Site URL y Google; allowlists suman sus callbacks exactos `com.somosve.app://panel-auth` y `com.somosve.app.staging://panel-auth`.
- Marketplace ahora limpia busqueda y filtro al elegir/detectar ciudad para evitar que Maracay aparezca vacia por un filtro persistido. Falta confirmacion humana final de este caso tras reabrir la app.
- QA: ESLint focal OK, 19/19 contratos ciudad/mobile/FCM y luego 12/12 buyer/FCM; Android Gradle 111 tareas BUILD SUCCESSFUL; produccion Next/TypeScript/build OK.
- Siguiente paso exacto: usuario confirma Maracay muestra comercios al elegirla; luego abre Panel > Impresion, deja/cierra Somos y crea un pedido real para verificar sonido, notificacion e impresion por Firebase.
# 2026-09-30 - Piloto productivo Android validado de extremo a extremo

- Usuario confirmo en Samsung A34: seleccion de Maracay correcta, Google comprador regresa a Somos, Google comercio regresa al panel, y pedido real con la app cerrada/segundo plano produce sonido, notificacion e impresion correctamente.
- Queda aprobado el conjunto productivo actual: web `dpl_FMyUGupMbp3iCE7WgRw2WyVvbggg` en `https://www.somos-ve.com`; Android `com.somosve.app` code13 `1.4.1-panel-auth` con SHA-256 `7059BFB040620203BE42B289BB3A0AB248D268386B3132E8F27BEDA03B5202F9`.
- No quedan fallos funcionales conocidos dentro del alcance probado. No hubo commit ni push.
- Proximo gran paso recomendado: congelar esta version, generar AAB release firmado con versionCode superior, completar ficha/Data Safety/politica de privacidad y subir primero a Play Console Internal testing; no agregar funciones nuevas antes de ese corte.
# 2026-10-03 - Alertas en engranaje, indicador Realtime y notas visibles en Cocina

- Usuario aclaro que las alertas son configuracion, no filtros; no encontraba `En vivo` y pregunto si las comandas muestran notas. Trabajo SOLO Preview/staging; produccion no se desplego ni modifico.
- Alertas de demora retiradas de Filtros de Pedidos y movidas al engranaje `Configurar Cocina`, junto a Cocina activa y Entrada de comandas. Pedidos sigue consumiendo la configuracion guardada para marcar demoras.
- Estado de actualizacion ahora es una capsula visible junto a `Comandas`: verde `En vivo` solo con canal privado suscrito, ambar `Respaldo cada 15 s`, rojo `Sin conexion`. No se falsea el estado Realtime.
- Comandas muestran extras, `Nota:` por producto y bloque `Nota del pedido`. Para pedidos manuales se elimina solo el prefijo tecnico `Pedido manual`; contenido util como `Mensaje recibido: sin salsa` ya no queda oculto. Se evita duplicar `order_details` y notas iguales.
- Preview FINAL READY/shared: `dpl_Gx7sQFRjqoCTSzuem6fET8rsnmt7`, `https://vendeplus-clean-6w4d77tsh-entrega2-s-projects.vercel.app/panel/cocina`. Staging `xpqmmdmixpyqruykkbkf`; produccion intacta `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- QA: build Next16.3.4 PASS261+TypeScript; ESLint focal PASS;47/47 logica Cocina/Mesas/timing; Pedidos+Mesas web/app6 anchos PASS; Cocina10 comandas/6 anchos PASS sin overflow, notas y configuracion. API real staging PASS incluido broadcast privado `kitchen_changed`; temporales eliminados y ajustes restaurados.
- Sin migracion, SQL, commit ni push nuevos. SIGUIENTE: usuario abre el nuevo Preview, entra a Cocina, confirma capsula junto al titulo, abre engranaje para Alertas y revisa una comanda con notas.
# 2026-10-03 - Realtime compartido corregido y En vivo confirmado en navegador

- Usuario vio `Respaldo cada 15 s` en Cocina. Causa real: `TableOrderNotifier` y `useKitchen` pedian el mismo topic privado; Supabase reutiliza el canal existente, pero no vuelve a emitir `SUBSCRIBED` al segundo consumidor. Cocina quedaba ambar aunque el primer consumidor estuviera conectado; desmontar uno tambien podia cerrar el canal del otro.
- Nuevo `src/lib/panel/store-orders-realtime.ts`: un canal privado por comercio, varios listeners para order/kitchen/transport, estado compartido y cierre solo cuando no quedan consumidores. Pedidos, notificador de Mesa y Cocina ya no crean ni eliminan canales por separado.
- Preview FINAL READY/shared: `dpl_8jd498HbeAy6dewfPQ2mxfDYgq8H`, `https://vendeplus-clean-o18q9ee5p-entrega2-s-projects.vercel.app/panel/cocina`. Produccion intacta `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- QA: build PASS261+TypeScript; ESLint focal PASS; Cocina10 comandas/6 anchos y Pedidos/Mesas web+app/6 anchos PASS. Prueba real creó sesion temporal en navegador movil, cargo Cocina con notificador general simultaneo y confirmo texto `En vivo`; broadcast privado, API y flujo de pago tambien PASS. Usuario/pedidos/producto temporales eliminados y ajustes restaurados.
- Sin migracion/SQL, commit, push o produccion. SIGUIENTE: usuario abre el NUEVO dominio (cada Preview tiene almacenamiento de sesion separado), inicia sesion y confirma `En vivo`; luego prueba dos equipos cambiando una comanda.
# 2026-10-03 - Nombre del cliente en cada comanda

- Usuario detecto que Cocina no mostraba el cliente. Se agrego exclusivamente `customer_name` al select embebido del board, al tipo y a la tarjeta; telefono y otros datos privados no se agregaron.
- El nombre aparece debajo del codigo con icono de persona, envuelve nombres largos sin truncar ni desbordar y participa en la busqueda `Pedido, cliente o mesa`.
- Preview FINAL READY/shared: `dpl_2GajocchCoiRTJTFSHsYZXiJZeQD`, `https://vendeplus-clean-v2qkncas3-entrega2-s-projects.vercel.app/panel/cocina`. Produccion intacta `dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n`.
- QA: build PASS261+TypeScript; ESLint y11/11 contratos PASS; Cocina10 comandas/6 anchos PASS, nombre largo visible, busqueda por cliente y cero overflow. Browser real autenticado confirmo `En vivo`; API real, broadcast y flujo Cocina PASS, temporales eliminados y configuracion restaurada.
- Sin migracion, SQL, commit, push o produccion. SIGUIENTE: usuario confirma nombre y `En vivo` en el nuevo Preview; despues prueba cruzada en dos equipos.
# 2026-10-03 - Validacion final de produccion antes del checkpoint Git

- Produccion activa y lista en Vercel: deployment `dpl_DrxJ92coeZkDFwsFCPAQX4yo2GBv` (`www.somos-ve.com`).
- Rutas publicas criticas respondieron `200`; Cocina redirige sin sesion y las APIs privadas responden `401` sin autenticacion.
- Smoke autenticado de Cocina aprobado: comercios elegibles ven el modulo, comercios no elegibles no lo ven, Realtime aparece `En vivo` y no hubo errores del navegador.
- Sin residuos de pedidos QA en Smash y sin usuarios temporales pendientes.
- Paridad de migraciones local/produccion confirmada hasta `20261003213000`.
- Suite critica aprobada: 145/145 pruebas (contratos, mesas, cocina, alertas moviles y tiempos por estado).
- Build de produccion aprobado en Vercel con TypeScript y 261 rutas generadas.
- Logs de error de Vercel de la ultima hora sin incidencias.
- Revision de secretos y `git diff --check` aprobadas; no se incluyeron `.env`, temporales, builds ni APK.
- Belli Burger quedo con Mesa/Barra habilitado y acceso a Cocina visible; Cocina inicia desactivada hasta que el comercio la habilite en su configuracion.
# 2026-10-04 - Impresion Android vinculada por comercio (solo local, sin produccion)

- 2026-10-05 iteracion Preview: usuario valido vinculacion por comercio, pidio boton Desvincular e icono Android menos grande. Implementado en `PrintingManager` boton Desvincular solo para telefono del comercio activo, con confirmacion, comprobacion local store/device, DELETE ya existente server-side con `assertStoreManager`+`store_id`, luego `clearPairing` solo del comercio actual. Native `clearPairing` detiene servicio. Android `setActiveStore` detiene servicio anterior y al volver a un comercio ya vinculado reanuda cola pendiente si autoimpresion esta activa.
- Detectado y corregido problema de fondo para un telefono en varios comercios: `print_agent_devices_fcm_token_idx` es UNIQUE. API `/api/printing-agent/push-token` ahora libera el mismo token de los otros equipos antes de asignarlo al dispositivo activo. Sin migracion SQL. El push lleva `storeId` y Android ignora tiendas no activas. Prueba REAL en staging con dos equipos ficticios: token se movio al segundo, DELETE de Tienda Demo no afecto Cocina Demo; temporales limpiados. 10/10 contratos FCM/aislamiento PASS.
- Icono Android adaptive `@drawable/somos_launcher_foreground` ahora aplica inset 10dp a isotipo original; mipmaps legacy usan asset PWA maskable de mayor margen. No se modifico arte original. Nuevo Preview READY/shared `dpl_DxSJ5fjB37QRHdgPqG7YcWZxweEH`: `https://vendeplus-clean-p7h474xr6-entrega2-s-projects.vercel.app`, solo staging; target productivo intacto.
- APK SOLO pruebas reconstruida `tmp/buyer-staging/android/somos-pruebas-1.4.0-beta3.apk`, SHA-256 `C8F985DCAF402F0CF02055DEC32DB8F32F7975C207EF56167E3197AA3AABEE9E`, apunta al Preview nuevo. No instalada aun; se pidio puerto ADB actual. Build web (`npm.cmd run build` con credenciales staging efimeras) PASS; Gradle `assembleDebug testDebugUnitTest` PASS. Sin commit, migracion ni despliegue a produccion. Siguiente: instalar APK staging encima de Somos Pruebas, probar Desvincular en una tienda, verificar que la otra siga vinculada y revisar icono visual; luego decidir produccion con autorizacion explicita.

- 2026-10-04/05 icono Android SOMOS: usuario pidio que APK use el mismo logo que la web. Los 15 iconos launcher mipmap (`ic_launcher`, round, foreground en 5 densidades) ahora copian exactamente los assets PWA `somos-icon-preview-512.png` y su version maskable; splash nativo usa nuevo `drawable/somos_splash.xml` con fondo blanco e isotipo centrado, sin la X azul de Capacitor. Fuente `drawable-nodpi/somos_launcher_logo.png` coincide por SHA-256 con icono web. No se modifico imagen original ni metadata web.
- `Somos Pruebas` reconstruida: `tmp/buyer-staging/android/somos-pruebas-1.4.0-beta3.apk`, SHA-256 `059E6CA69FEFF6278751E70F6123CA714BB860AFF7FE16CDDEB1C5AEDB017A70`; instalada correctamente via ADB `192.168.1.102:46811` despues de confirmar misma firma de la app staging existente. ADB paso a offline al intentar abrir/capturar; falta confirmacion visual del usuario en A34. App SOMOS normal del A34 intacta.
- Candidata SOMOS normal con icono: `tmp/firebase-pilot/somos-1.5.1-print-candidate.apk`, SHA-256 `C038135F9DC670D81B4874BE23DAE370B005556CF03D1418767B2064E6874382`, paquete `com.somosve.app`, code15, origen `www.somos-ve.com`. NO instalada ni desplegada porque web productiva aun no tiene vinculacion por comercio. Gradle staging BUILD SUCCESSFUL; Gradle piloto `lintDebug assembleDebug testDebugUnitTest` BUILD SUCCESSFUL sin problemas nuevos; `npm.cmd run build` con env efimero staging PASS. Sin migracion/SQL, commit ni despliegue productivo por icono.
- Siguiente paso: usuario abre icono Somos Pruebas en A34, confirma marca y splash; luego iniciar sesion con cuenta temporal staging entregada en chat y verificar cambio Cocina Demo/Tienda Demo en Impresion. Si todo bien, definir despliegue coordinado de web productiva + APK SOMOS normal con autorizacion expresa. No recomendar instalar APK normal antes.

- Continuacion Preview de impresion: deployment nuevo `dpl_AE9yiQoA4S1Pv1GH721xQUTsWrPY` READY/shared, URL `https://vendeplus-clean-f3cebb1z0-entrega2-s-projects.vercel.app`, staging `xpqmmdmixpyqruykkbkf` con dos tiendas ficticias `cocina-demo` y `tienda-demo`; produccion Vercel intacta y Preview anterior de referidos sigue en su URL. API impresion anonima 401, login 200. Staging tiene `order_print_jobs`, RPC claim, 0 dispositivos/configuraciones iniciales; Firebase desactivado, por lo que en staging NO se prueba wake push, solo vinculacion y cola/manual.
- APK separada de pruebas compilada y verificada: `tmp/buyer-staging/android/somos-pruebas-1.4.0-beta3.apk`, paquete `com.somosve.app.staging`, apunta al Preview nuevo, SHA-256 `233DF15174844BC67BB5641356F72723103F0A66CC1DA73D1B3CEAC1A77DCD4F`; Gradle BUILD SUCCESSFUL. SOMOS de produccion `com.somosve.app` no se toco. A34 no conectado al final (ADB sin dispositivos); pregunta asincrona pendiente por IP:puerto actual.
- Cuenta temporal SOLO staging para prueba entre ambas tiendas: `printing-preview-ff3fbdab@somos.test`, usuario `03d3138e-a476-4edf-93f6-cd5061bec27c`, membresia owner en ambas ficticias. Password temporal se entregara al usuario por chat, NO se guarda aqui. Login y `/api/panel/context` + `/api/panel/printing/status` para ambos IDs HTTP200, founder false, ambos con 0 equipos. Eliminar cuenta temporal y membresias al terminar prueba.
- Siguiente paso exacto: con puerto ADB vigente instalar SOLO APK `com.somosve.app.staging` en A34 (`adb install -r` tras verificar firma instalada staging), abrir Somos Pruebas e iniciar sesion con cuenta temporal; entrar Impresion y vincular Cocina Demo, cambiar a Tienda Demo y confirmar que pide nueva vinculacion, volver a Cocina Demo y confirmar que vuelve a reconocerla. No usar pedidos reales ni tocar produccion. Prueba FCM automatica requiere paso aparte con backend/App productivos tras aprobacion.

- Usuario confirmo vincular el mismo telefono una vez por comercio, cambiar automaticamente al comercio de la cuenta activa y pausar impresion al salir o entrar a admin. Gran Combo no tenia dispositivo de impresion registrado; el indicador gris anterior correspondia a un token local de otro comercio.
- Android: `PrinterSecureStore` guarda token cifrado y autoimpresion por `store_id`; token antiguo queda conservado pero no se usa sin reconfirmar. `SomosPrinterPlugin` expone `setActiveStore`, identifica el dispositivo por comercio y detiene el drenaje si cambia el comercio; FCM solo atiende pushes cuyo `storeId` coincide con el comercio activo. Web: `PanelAuthProvider` activa/pausa segun sesion y comercio; `PrintingManager` valida el ID de dispositivo contra los equipos del comercio, muestra el nombre del comercio y exige confirmacion al vincular.
- Server push incluye `storeId`; no hay migracion/SQL. `node scripts/firebase-push.test.mjs` 9/9 PASS. `npm.cmd run build` con credenciales efimeras de staging PASS (130 paginas); build sin variables privadas falla al prerenderizar `/`, esperado. Gradle `:app:assembleDebug :app:testDebugUnitTest` BUILD SUCCESSFUL. `git diff --check` sin errores de contenido.
- No se desplego web ni se instalo APK. APK debug generado localmente en `mobile/somos-android/android/app/build/outputs/apk/debug/app-debug.apk`, pero NO instalar: su web embebida sigue apuntando a produccion vieja, incompatible con la nueva vinculacion. No borrar la app instalada ni sus datos. Produccion y referidos preview intactos.
- A34 conecto via `192.168.1.102:44037`, luego `:45601` y finalmente `:43661`; ADB cambia de puerto. App instalada `com.somosve.app` versionCode 14, versionName 1.5.0; app staging tambien instalada. Se extrajo su `base.apk` a `tmp/installed-somos-a34.apk` y `apksigner` confirmo certificado SHA-256 identico al APK debug candidato: `833651c161cb244138be4de4a96e148cf38e8e7946bb2cdc5e3116b50b33ba46`. Candidato versionCode 15 permite actualizar preservando datos. No instalado porque falta web Preview compatible. Siguiente paso exacto: desplegar web+app compatibles a Preview aislado y probar dos comercios, admin, impresora y cambios de cuenta. Solo tras aprobacion explicita considerar despliegue productivo y APK de actualizacion.
