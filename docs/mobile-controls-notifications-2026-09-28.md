# Controles y avisos - Preview 1.2.1

## Diagnostico

En el catalogo visual, precio y accion compartian una fila demasiado estrecha. La regla global `font: inherit` agrandaba el texto de los botones pese a sus clases compactas. En productos, Editar tenia padding y texto mas anchos que su columna de 56px. La campana existente abria anuncios generales, no pedidos.

## Cambios y archivos

- `src/components/public/ProductCard.tsx`: precio y accion en filas independientes en vista visual; fila flexible en vista clasica, botones compactos y sin signo mas cuando esta cerrado o agotado.
- `src/app/globals.css`: tipografia de 12px acotada a acciones del catalogo y nombres visuales de hasta dos lineas. No se cambia el reset global de formularios.
- `src/app/native-polish.css`: retirado el posicionamiento flotante antiguo de anuncios y el espacio artificial reservado para una sola campana.
- `src/components/panel/ProductManager.tsx`: lapiz de 44px con nombre accesible y tooltip; editor desplegado ocupa el ancho completo.
- `src/components/panel/PanelNotifications.tsx` y `.module.css`: campana de pendientes y megafono juntos en cabecera, paneles mutuamente exclusivos, cierre exterior/Escape/Atras nativo, estados de carga/error/vacio y reintento.
- `src/components/panel/PanelAnnouncements.tsx`: megafono, estado controlado, carga/error/reintento; lectura de novedades conservada, almacenamiento protegido contra errores.
- `src/components/panel/PanelShell.tsx` y `PanelFrame.tsx`: controles compartidos web/app dentro de la cabecera, reiniciados por cuenta y sede; eliminado montaje flotante duplicado.
- `scripts/mobile-polish.e2e.mjs`: verificacion geometrica de precio/accion y editar/estado, tipografia, apertura/cierre, error/reintento, aislamiento por sede y capturas web/app.
- `mobile/somos-android/android/app/build.gradle`: versionCode 8, versionName 1.2.1-controls-preview.

## Funcionamiento de la campana

Consulta de solo lectura a la API protegida existente, con sede explicita, `status=pending`, `compact=true`, limite 10. El contador es de pendientes, no de mensajes no leidos. Si hay mas resultados se muestra 10+. Se actualiza al abrir, recuperar foco/visibilidad y cada 30 segundos mientras la pagina es visible. Las peticiones se cancelan al desmontar y no se reutilizan resultados de otra sede/cuenta.

No modifica pedidos, no marca pedidos como atendidos, no agrega sonidos ni sustituye el notificador de mesas. Ver pedidos abre la pantalla de pedidos, no un detalle especifico. No implementa push de pedidos en segundo plano ni historial de leidos.

## Validacion

- `npm.cmd run build` mediante `node scripts/mobile-local.mjs build`: PASS, TypeScript y 244 paginas. Build Vercel: PASS.
- Contratos criticos: 80/80 PASS. E2E Etapa 1 compilado: PASS.
- Pulido visual final: 25 capturas/casos app y 6 capturas web; PASS. Anchos app 320/390/768, web 390/1366. Sin errores React ni overflow horizontal. Inspeccion visual de catalogo, productos y avisos.
- Cambio de sede no muestra pedidos de otra sede; error simulado permite reintentar; paneles no se acumulan; Escape cierra. Las pantallas privadas usan fixtures y las mutaciones se bloquean.
- Cloud: 7/7 PASS. Marketplace/login 200; pedidos/admin sin credenciales 401.
- ESLint focal y git diff --check: PASS (advertencias habituales CRLF).

## Despliegue y prueba

Preview final: https://vendeplus-clean-g67mi6v8j-entrega2-s-projects.vercel.app

Deployment `dpl_9WUK7asCZrLAwEPh1AVH85QtiBu8`, READY. Excepcion publica limitada a ese Preview; excepcion del candidato intermedio `dpl_8CcoWKDVueF5CapauBAuTnHK5ipB` revocada. Produccion continua en `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`, sin promocion, commit ni push.

APK `tmp/mobile-controls/somos-1.2.1-controls-preview.apk`, 5.692.596 bytes. SHA256 `6E4C5FB0967E507CE4563BB05AA96B6EBE5925EC1FAFD292F317B80AEE62D10D`. Gradle PASS (73 tareas). Config interna verificada: Preview final HTTPS exacto, sin cleartext ni navegacion adicional. Config generado restaurado al dominio oficial despues de copiar. Instalacion `--no-streaming -r` Success en Samsung A34, version 8 / 1.2.1-controls-preview confirmada por dumpsys, arranque aceptado. Se conservaron datos y pairing; no se afirma validacion visual fisica.

Abrir el catalogo Smash Test en vista visual; revisar nombres, USD/Bs y botones. En Productos abrir/cerrar el lapiz, sin guardar cambios reales. Abrir campana y megafono, cambiar sede y comprobar contenidos. El nuevo origen Preview puede exigir iniciar sesion nuevamente. El backend es real: usar solo el comercio de prueba para operaciones manuales.

## Riesgos y V2

Sin migraciones, sin SQL y sin cambios en Java de impresion, precios, Auth o APIs. Queda confirmacion visual manual en telefono y comprobacion fisica de la comanda anterior. V2: push de pedidos en segundo plano, historial de avisos/leidos, apertura del pedido especifico y pruebas cerradas Play Store. No se presenta este Preview como lanzamiento de produccion.
