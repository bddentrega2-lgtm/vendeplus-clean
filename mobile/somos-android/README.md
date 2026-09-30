# Somos Android

Aplicacion Android de Somos. La interfaz reutiliza la plataforma web y las capacidades operativas se agregan mediante plugins nativos Java.

## Identidad

- App ID: `com.somosve.app`
- Nombre: `Somos`
- Origen permitido: `https://www.somos-ve.com`

## Requisitos locales

- Android Studio estable.
- Android SDK instalado desde Android Studio.
- JDK 21 (la instalacion local de Android Studio usa Java25, no compatible con este build).
- Un telefono Android con depuracion USB.

## Preparacion

```powershell
npm.cmd install
npm.cmd run android:add
npm.cmd run android:sync
npm.cmd run android:open
```

No guardar claves de Supabase, Firebase, firmas ni tokens de dispositivos dentro del repositorio.

## Impresion

El plugin Java usa Bluetooth Classic SPP/ESC-POS y la cola segura `order_print_jobs`. Nunca se incluye `service_role` dentro de la APK.

## Beta aislada de compradores

- App separada: `com.somosve.app.staging`, nombre `Somos Pruebas`.
- No reemplaza `com.somosve.app`, no comparte almacenamiento ni vinculacion de impresion.
- Callback Google propio: `com.somosve.app.staging://buyer-auth`.
- Sin Google Services/Firebase productivo. Esta beta no valida push de pedidos con la app cerrada.
- Solo debug y URL inmutable del preview aislado. El build release queda bloqueado.

Desde la raiz del workspace, despues de publicar/verificar el preview aislado:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ops/build-buyer-staging-apk.ps1
```

El script lee `tmp/buyer-staging/preview-deployment.json`, valida el origen/backend,
sincroniza Capacitor con `SOMOS_ANDROID_BUYER_STAGING=1`, compila con Java21 y deja
APK mas hash en `tmp/buyer-staging/android`. No instala en el telefono.
No compilar otro modo sin sincronizar nuevamente Capacitor: las identidades deben
coincidir y Android lo comprueba. Para un futuro release, quitar variables de
prueba, sincronizar al origen oficial y seguir la validacion de publicacion.
