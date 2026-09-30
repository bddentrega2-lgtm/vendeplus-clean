# SOMOS Android: Etapa 1 (prueba local)

## Alcance y estado

Se mantiene Capacitor y Next.js compartido. Sin publicacion, commit, push,
migracion ni SQL nuevo. Produccion no fue modificada por esta entrega.
El trabajo anterior de impresion/FCM y del Marketplace se conservo.

Diagnostico: el APK carga una web remota; compilar Android no incorpora los
cambios React. La navegacion web necesitaba una capa exclusiva para Capacitor,
recuperacion de estado y una salida nativa cuando falla la carga inicial.

## Artefacto

- APK: `tmp/mobile-stage1/somos-1.1.0-stage1-local.apk`.
- Paquete: `com.somosve.app`; version: `1.1.0-stage1`, versionCode 2, debug.
- SHA256: `E389D494E97F4F6AEFF96DAFEA94ABC465B6BB035D9B7DD4879E97937647888C`.
- Origen dentro de este APK: `http://localhost:3107`, verificado dentro del ZIP.
- Es solo para esta PC y telefono, mediante `adb reverse`. No distribuir.
- El valor predeterminado del codigo sigue siendo `https://www.somos-ve.com`.
  La URL local requiere `SOMOS_ANDROID_LOCAL=1` al sincronizar Android.
- La excepcion HTTP solo existe en el manifiesto debug y para localhost.
  No se desactiva TLS para otros destinos.

En el APK: controlador Android Atras/teclado, vista nativa de carga y reintento,
version y URL. En Next.js: espacios, barras, selectores, perfil local, filtros,
borrador, revalidacion de permisos y estados de conectividad. La configuracion
local sirve estos cambios sin publicar una web accesible a terceros.

## Cambios principales

- `NativeExperience.tsx`, `use-native-app.ts`, `lib/mobile/state.ts`, layout y CSS:
  entrada al Marketplace para nuevos visitantes, preferencia de espacio,
  navegacion Comprar/Buscar/Mis datos, carrito contextual, capas y Atras.
- `PanelShell`, `PanelFrame`, `PanelAuthProvider`, `PanelStoreSelector`:
  Pedidos/Productos/Resumen/Negocio, selector de sede autorizado, Mesa/Barra,
  impresion y herramientas existentes. Revalidacion al volver a primer plano.
  Un fallo temporal tapa la interfaz sin desmontar los formularios; revocacion
  o cambio de cuenta descarta datos privados. No cambia permisos por rol.
- `api/panel/context`: agrega el identificador del usuario autenticado, sin
  ampliar los comercios autorizados ni sustituir la validacion del servidor.
- `client-auth` y `client-fetch-cache`: limpieza privada y proteccion contra
  respuestas tardias que intenten repoblar cache tras cierre/cambio de cuenta.
- `MarketplaceClient`, `CatalogClient`, `OrdersManager`, `ProductManager`:
  filtros locales exclusivos de la app, separados por usuario/sede si privados.
  Productos y Configuracion avisan antes de abandonar cambios sin guardar.
- `CheckoutForm` y `ConfirmationClient`: borrador de 24 horas con campos
  permitidos y la misma clave idempotente; no restaura precios ni pagos como
  autoridad. Borra borrador al confirmar, bloquea doble toque y limpia carrito.
  La copia nativa del ultimo pedido no guarda tokens de comprobante, mesa o
  cotizacion. El contexto temporal de mesa preexistente sigue en sessionStorage.
- `PwaInstallButton` y `OnboardingTour`: no ofrecer instalar una PWA dentro
  del APK; tutorial elevado para no tapar la barra de navegacion.
- `MainActivity.java`: usa el cliente de Capacitor y conserva el registro del
  plugin de impresion; no cambia servicio, cola, recuperacion ni deduplicacion.

## Verificacion

- Build web ejecutado mediante `node scripts/mobile-local.mjs build`, que llama
  a `npm.cmd run build`: PASS, 240 paginas y TypeScript.
- Gradle `:app:assembleDebug`: PASS, 73 tareas.
- Contratos existentes: 80/80 PASS. Pruebas especificas de estado/cache: 5/5 PASS.
- ESLint de componentes/helpers nuevos y pruebas: PASS. No se afirma lint
  completo del repositorio, que contiene trabajo anterior.
- `git diff --check`: PASS, solo advertencias de finales de linea Windows.
- Impresion: 13 archivos del plugin/servicio/APIs/cola/panel comparados por SHA256
  con el respaldo previo: identicos. Contrato de impresion y build Android PASS.
- Playwright local: 16/16 PASS, resultados en `tmp/mobile-stage1/results.json` y
  capturas en el mismo directorio. Capacitor se simula en Chromium: no equivale
  a probar el teclado, Bluetooth, ciclo de vida o gesto Atras de Android real.
  Todas las mutaciones se interceptan; panel y confirmacion se simulan.
  Catalogos publicos se consultan solo en lectura. No se crearon pedidos reales.
  Incluye entrada visitante/comercio, espacio y sede recordados, limpieza entre
  cuentas y revocacion, capas, carrito, borrador, reconexion, confirmacion sin
  reenvio, doble toque y web movil/escritorio. Reduccion de viewport simula el
  espacio del teclado, no el IME real. Cero errores de React capturados.
- No se usa el navegador integrado: fallo al iniciar su runtime (os error 3).
  Se uso Playwright ya instalado, sin instalar dependencias nuevas.

## Probar en el A34

1. Mantener PC encendida, servidor local y depuracion conectados. El servidor se
   inicia con `node scripts/mobile-local.mjs start` desde este worktree y escucha
   solo en `127.0.0.1:3107`. Para revisar en PC: http://127.0.0.1:3107.
2. Conectar el puerto actual que muestre Depuracion inalambrica:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb connect 192.168.1.107:PUERTO
& $adb -s 192.168.1.107:PUERTO reverse tcp:3107 tcp:3107
& $adb -s 192.168.1.107:PUERTO install -r tmp/mobile-stage1/somos-1.1.0-stage1-local.apk
& $adb -s 192.168.1.107:PUERTO shell am start -n com.somosve.app/.MainActivity
```

3. Abrir, buscar, elegir ciudad y usar Mis datos. Atras debe cerrar la capa antes
   de volver. Revisar teclado y barras. Agregar a carrito, ir a WhatsApp/banco y
   volver: carrito y borrador deben permanecer.
4. Ingresar con una cuenta de prueba, cambiar sede autorizada, alternar Comprar
   y Mi negocio; cerrar/abrir, probar cambios sin guardar y cerrar sesion.
5. Probar reintento tras perdida de conexion. Sin servidor local/ADB, la pantalla
   nativa debe ofrecer Reintentar. Esta APK local depende de PC y del tunel ADB.
6. Probar un pedido controlado y un ticket TIII solo en el comercio de pruebas.
   El backend es el existente: fuera del script Playwright, los pedidos y cambios
   SI SON REALES. No operar sobre un comercio de clientes para probar.

El origen local tiene almacenamiento/sesion web separados del dominio oficial;
puede requerir ingresar de nuevo. La configuracion nativa de la impresora se
conserva al instalar con `-r`. No borrar los datos de la app.

## Recuperacion

Respaldo anterior a la Etapa 1:
`C:/Users/Windows/Desktop/RESPALDOS/somos-recovery-stage1-20260927`.
Contiene fuentes previas (incluido trabajo sin commit), `prior-work.patch` y
`somos-before-stage1.apk`. Se excluyeron .env, configuracion privada, secretos,
claves de firma y carpetas generadas; escaneo de patrones conocidos sin hallazgos.
No sustituye los originales de credenciales, que permanecen intactos.

APK anterior SHA256:
`1CB0C0327A7625E3CE1E6566EE51577B44699577E029859B891F5A79B9D3CF2C`.

Para volver a la app previa, usar `adb install -r -d` sobre esa APK debug, con
el telefono conectado. No desinstalar ni borrar datos. Quitar solo el tunel
de pruebas con `adb reverse --remove tcp:3107`. No hace falta revertir Vercel.

Para deshacer codigo: comparar los archivos de esta entrega contra el respaldo
y restaurar solamente los cambios de Etapa 1, preservando modificaciones
posteriores. No usar `git reset --hard`, `git clean` ni aplicar el parche de
trabajo previo sobre este arbol sin revisar: el arbol ya contenia esos cambios.

## Pendientes y V2

Instalacion completada en A34 por el puerto42133: `install --no-streaming -r`
devolvio Success y `dumpsys package` confirmo versionCode2/version1.1.0-stage1.
Tunel3107 activo, web local HTTP200 y MainActivity abierta. Captura fisica
`tmp/mobile-stage1/a34-stage1.png` inspeccionada: marketplace, fotos y barra
Inicio/Buscar/Mis datos correctamente dentro de la app. Muestra filtrada de
250lineas de logcat sin errores AndroidRuntime/Capacitor coincidentes.
Esto valida instalacion y primera carga, no todos los flujos reales.

Historial de intentos: el puerto 44187
conecto y paso a offline antes de instalar. El puerto siguiente 39607 permitio
crear el tunel pero se desconecto durante la instalacion transmitida; ADB no
confirmo instalacion y no permitio verificar version. El descubrimiento mDNS
no encontro servicios. Se resolvio luego con42133 y la instalacion no transmitida.
Pendientes: Atras/teclado reales, arranque sin internet real,
regreso desde WhatsApp/banco, login real de cuenta de prueba y ticket TIII.

Una URL de pruebas remota y cualquier despliegue necesitan autorizacion aparte.
Quedan fuera: cuentas de comprador, OTP, FCM, favoritos, historial sincronizado,
App Links y politicas nuevas de impresion. Ninguno se implemento en esta etapa.
