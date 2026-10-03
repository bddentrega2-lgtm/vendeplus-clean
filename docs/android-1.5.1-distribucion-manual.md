# SOMOS Android 1.5.1 - Distribucion manual

## Descarga verificada

[Descargar SOMOS 1.5.1 para Android](https://rvmtjtuztewcrmodrodb.supabase.co/storage/v1/object/public/app-releases/android/1.5.1/somos-1.5.1-android.apk?download=somos-1.5.1-android.apk)

- 4.671.120 bytes (4,7 MB). Publicacion inmutable; no reemplazar esta ruta con otro archivo.
- SHA256: `858845925B22CA29B5F4FE598168F0D3967C960968F8003A327498B74C762498`.
- Firma SHA256: `39e7305f30cea27acf2bdbd128369e847ea842fb59236a8a79e14a4f9463b72c`.
- Descarga HTTPS comprobada y hash identico al original firmado. Escritura anonima rechazada por RLS.
- APK no depurable; origen oficial; sin claves privadas ni archivos de entorno empaquetados.
- ZIP y segmentos ELF LOAD/RELRO de arm64/x86_64 verificados para paginas de16KB.
- Admite pantallas small/normal/large/xlarge; Bluetooth y ubicacion son hardware opcional.

## Cambios y validacion

- `PanelShell.tsx`: etiqueta Configuracion puede envolver sin desbordar320px.
- `android/app/build.gradle`: version1.5.1/code15 y constraint DataStore1.2.1 para corregir RELRO de la dependencia indirecta1.1.7.
- `AndroidManifest.xml`: features Bluetooth/location opcionales, sin eliminar permisos funcionales.
- `scripts/ops/build-signed-android.ps1`, `build-play-internal-aab.ps1`, `verify-android-apk.ps1`: firma externa, APK+AAB, metadatos y validacion del binario final.
- `build-firebase-pilot-apk.ps1` y `play-release-readiness.test.mjs`: identidad sincronizada y guardas7/7.
- npm.cmd run build PASS/255paginas, contratos86/86, suite movil49/49 antes de la nueva guarda, E2E movil15escenarios, checkout5/5, nueve viewports de pedidos y marketplaceweb/app. ESLint focal y diff-check PASS.
- Android release: lint, unit tests, APK y AAB PASS. Lint de app:0errores/16advertencias no bloqueantes; no equivale a una auditoria sin deuda en dependencias.
- Web productiva dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n; rollback dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC. Sin migracion ni SQL.
- AAB firmado generado localmente, no publicado. Jarsigner confirma firma, con avisos de certificado autofirmado y orden del manifiesto en JarInputStream. Pendiente validar con bundletool/Play al preparar subida, no afirmar aceptacion de Play.
- No se ha probado fisicamente esta nueva APK release. La verificacion automatizada no certifica todos los modelos de equipos o impresoras.

Para V2: ampliar matriz de equipos, mediciones reales de arranque/operacion,
actualizacion de estado de apertura sin recarga y pulido de recursos Android.
No se modifico el comportamiento de impresion para este paquete.

## Identidad y alcance

- Paquete: com.somosve.app. Version 1.5.1, codigo 15.
- Variante release, firma propia; no usar la firma Android Debug para distribuir.
- Origen: https://www.somos-ve.com. Los pedidos y configuraciones guardados son reales.
- Requiere internet y Android 7.0/API24 o superior con Android System WebView actualizado.
- Telefono y tablet, orientacion vertical y horizontal. No es una app para iOS.
- Incluye experiencia de consumidor y panel de comercio; permisos solo para funciones que los necesitan.
- Impresion: Bluetooth Classic SPP/ESC-POS, papel 58/80 mm. La prueba fisica disponible corresponde al A34 con TIII; no equivale a certificar todos los modelos.

## Instalar

1. Abrir el enlace de descarga de la APK en el telefono o tablet.
2. Abrir el archivo descargado.
3. Si Android lo solicita, permitir instalar aplicaciones desde ese navegador o gestor de archivos y volver a instalar. No desactivar Play Protect.
4. Abrir SOMOS y comprobar Marketplace. Ingresar a mi negocio para usar el panel.
5. Conceder ubicacion, avisos o Bluetooth al usar esas funciones. Se puede explorar el Marketplace sin vincular una impresora.

La APK de piloto del A34 usa otra firma. No puede actualizarse directamente con
esta APK aunque tenga el mismo nombre. No desinstalarla durante operacion:
se perderian sus datos locales, sesion y vinculacion de impresora. Planificar
esa migracion por separado; en dispositivos nuevos instalar directamente.

Las siguientes APK manuales deben conservar esta firma y subir versionCode.
Para que Google Play pueda actualizar las instalaciones manuales, configurar
Play App Signing con esta misma clave de firma de aplicacion. Despues crear
una clave de subida separada. No dejar que Google genere una firma diferente
sin evaluar la migracion de quienes ya instalaron la APK.

## Prueba de aceptacion en otro equipo

- Abrir, cerrar y reabrir; comprobar que la sesion se conserva.
- Seleccionar ciudad; abrir catalogo, variantes, extras, carrito y finalizar pedido.
- Hacer un unico pedido controlado en Smash Test; comprobar total, opciones y recepcion.
- Ver Pedidos y Productos, cambiar orientacion y probar el teclado.
- Desconectar/reconectar internet: recuperacion sin perder el carrito ni reenviar pedidos.
- Si imprime: vincular impresora, probar ticket, impresion manual y evento automatico configurado.
- Probar sin permiso de ubicacion y sin permiso de notificaciones; las otras funciones deben seguir disponibles.

## Firma y respaldo

- El material privado vive fuera de Git en LOCALAPPDATA/SOMOS/android-signing.
- La contrasena se protege con DPAPI del usuario Windows actual; no se escribe en logs ni en el repositorio.
- DPAPI no es un respaldo portable. Antes de migrar de PC o publicar en Play,
  el titular debe guardar la clave y su contrasena en un respaldo externo seguro.
- No enviar la clave privada por chat, correo ni el enlace publico de la APK.
- El certificado publico y los hashes de APK pueden compartirse.

## Generar y verificar

Desde la raiz del worktree, con Java21 y SDK instalados:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ops/build-signed-android.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ops/verify-android-apk.ps1
```

La opcion -CreateKey es exclusivamente para la primera creacion. No reemplaza
una clave existente. El build genera APK y AAB, pero no los envia a Google Play.
Artefactos y hashes: tmp/play-internal/artifact.json.

## Pendiente para publicacion general

- El titular confirmo que todavia no tiene cuenta Play Console: crear y verificar cuenta.
- Confirmar titular legal, soporte/privacidad y plazos de retencion.
- Completar ficha, Data Safety, clasificacion, acceso de revision y video del servicio de impresion.
- Guardar respaldo portable de firma y configurar Play App Signing conservando compatibilidad.
- Prueba fisica de instalacion nueva, actualizacion y recorrido con la APK release; piloto en varias marcas.
- Subir a pruebas internas, atender informe previo al lanzamiento y completar prueba cerrada si aplica a la cuenta.

No presentar esta candidata como aprobada por Google Play ni como certificada
en todos los dispositivos. La base de impresion tiene pruebas fisicas previas;
la firma de distribucion requiere su propia prueba de instalacion.

## Referencias tecnicas

- [Firma de aplicaciones y continuidad de actualizaciones](https://developer.android.com/studio/publish/app-signing).
- [Verificacion de ZIP, ELF LOAD y RELRO en Android de 16 KB](https://developer.android.com/guide/practices/page-sizes).
- [Versiones oficiales de AndroidX DataStore](https://developer.android.com/jetpack/androidx/releases/datastore).
- [Pruebas exigidas para nuevas cuentas personales](https://support.google.com/googleplay/android-developer/answer/14151465?hl=es).
