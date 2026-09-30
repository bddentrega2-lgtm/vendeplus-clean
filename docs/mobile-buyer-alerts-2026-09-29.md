# Comprador y avisos Android 1.3.0

## Actualizacion Firebase cliente 2026-09-30

Firebase Android quedo configurado localmente para `com.somosve.app` y se
instalo Somos `1.4.0-firebase-pilot` (`versionCode 12`) conservando datos e
impresion. El plugin obtuvo un token sin exponerlo y acepto el registro. Esto no
completa el flujo: aun falta el emisor FCM HTTP v1 del servidor y su cuenta de
servicio privada antes de afirmar que un pedido despierta la app cerrada.

El emisor HTTP v1 ya fue implementado y validado en preview con credencial de
deployment aislada. Envia solo un tipo de evento y `orderId`, sin datos del
cliente, a dispositivos Android activos de la misma tienda; limpia tokens
invalidos y no repite al reutilizar la clave idempotente. Falta instalar en el
A34 el APK recompilado con receptor remoto y hacer la prueba fisica cerrada.

## Alcance

Primer bloque aprobado: promociones y una ubicacion frecuente local. Adicional: sonido y notificacion de pedidos en Android con el panel abierto. Firebase no esta configurado en el proyecto (`google-services.json` ausente), y el usuario no sabe si existe un proyecto externo. No se afirma funcionamiento con la app cerrada o en segundo plano.

## Cambios

- `NativeExperience.tsx`: acceso Promos y estado seleccionado en barra nativa; ubicacion guardada visible y eliminable dentro de Mis datos.
- `MarketplaceClient.tsx`: navegación a ofertas/inicio por hash sin perder el filtro de ciudad; ofertas con descuento positivo y datos existentes. No hay promociones inventadas.
- `FrequentLocation.tsx`, `frequent-location.ts`, `CheckoutForm.tsx`, `native-polish.css`: guardar/actualizar nombre, referencia y punto escogido en checkout; usarlo explicitamente en otro pedido. Validacion de coordenadas y limites de texto. Solo una ubicacion por dispositivo/origen. No se guardan precios, cotizaciones, claves ni datos bancarios. La cotizacion sigue siendo del servidor.
- `PanelNotifications.tsx`, `.module.css`, `order-alerts.ts`: permiso/toggle, prueba y acceso a ajustes de Android en la campana. Avisos de nuevos pendientes de la sede activa, consulta cada 15 segundos mientras el panel es visible. Primera respuesta establece linea base sin sonar por pendientes historicos; reloj del servidor cuando existe; deduplicacion acotada y limpieza al salir/cambiar cuenta/sede. Interruptor guardado por cuenta y origen.
- `OrdersManager.tsx` y `TableOrderNotifier.tsx`: evitar sonido web duplicado cuando los avisos nativos estan habilitados. La asistencia de mesas conserva su sonido.
- `SomosOrderAlertsPlugin.java`, registro en `MainActivity.java`, permiso VIBRATE y version Android: canal independiente `somos_orders_v1`, importancia alta, sonido de notificacion, vibracion y contenido generico privado. Tocar el aviso abre Somos; no abre un pedido concreto. El usuario controla permisos, canal, volumen y No molestar.
- Impresion: no se cambio SomosPrinterPlugin, la cola, PrintForegroundService, los tokens de dispositivos ni FirebaseMessagingService.

## Validacion

Pruebas unitarias focales (3): coordenadas incompletas/invalidas, copia sin precios/tokens, nuevos pedidos sin conocidos/historicos/otras sedes. Contratos criticos 80/80 PASS. E2E Etapa1 PASS. E2E visual ampliado prueba promociones, guardar/reutilizar/eliminar ubicacion, permiso/prueba y nueva llegada simulada sin duplicado; mutaciones reales bloqueadas. Build local via `node scripts/mobile-local.mjs build` ejecuta npm.cmd run build: PASS240paginas/TypeScript. Java compileDebugJavaWithJavac PASS42tareas. ESLint focal y diffcheck PASS.

## Como probar

Confirmacion del usuario (2026-09-29): la segunda notificacion de prueba SI sono en el A34. La primera se envio mientras el telefono estaba en silencio. Reproduccion audible validada; entrega automatica con pedido real y segundo plano no se dan por probados por esta confirmacion.

Preview READY: https://vendeplus-clean-gwcs2ob9j-entrega2-s-projects.vercel.app (`dpl_2ThqxhG3VSi2VUGmLqAYs7GdQ3h8`). Solo este deployment tiene la excepcion publica. Produccion sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`.

APK `tmp/mobile-buyer-alerts/somos-1.3.0-buyer-alerts-preview.apk`, 5.692.346bytes, SHA256 `642A6821F20ABB58F91CBE2BBD721F13BC4BE9FBAFC84E939CAFEE820CA5D450`. Gradle assembleDebug73tareasPASS, config dentro APK verificada Preview exacto/HTTPS/cleartextfalse; generado resync oficial. Instalada en A34 con `-r` Success, versionCode9/versionName1.3.0-buyer-alerts-preview y permiso existente confirmados. Datos e impresion preservados.

Cloud7/7PASS y APIs privadas401anonimos. QA visual final29casos/capturas app +6web. Prueba nativa real con script `mobile-native-alerts.e2e.mjs`: plugin disponible, permiso ya concedido, aviso de prueba aceptado. Android confirma record del aviso y canalHIGH4, sonido del sistema/vibracion, sin bypassDnd. Forward temporal de depuracion eliminado. La reproduccion audible queda pendiente de confirmacion humana; no se crearon pedidos ni se alteraron permisos para probar.

1. En la app abrir Promos, cambiar ciudad y volver a Inicio.
2. En Smash Test, agregar un producto sin confirmar pedido. En delivery elegir punto y escribir direccion/referencia; Guardar ubicacion con nombre Casa o Trabajo. Recargar y elegir Usar Casa. Mis datos permite revisar y eliminarla.
3. En el comercio abrir campana, activar Sonido y notificacion, conceder permiso si Android lo solicita y pulsar Probar. Mantener panel abierto para recibir nuevos pendientes; demora posible de hasta 15 segundos mas red. Usar solo pedidos controlados del comercio de prueba.
4. No silenciar ni alterar No molestar automaticamente. Ajustes abre la configuracion del canal si el sonido esta desactivado.

## Limites y siguiente bloque

Sin migraciones ni SQL, sin promocion a produccion ni commit/push. Ubicacion no sincronizada entre dispositivos ni origenes Preview; puede perderse al borrar datos/desinstalar. Guardado y actualizacion se hacen desde checkout; Mis datos muestra y elimina. Avisos dependen del panel visible, conexion y pendientes presentes en la lista limitada a diez; no son una garantia de entrega push.

Para segundo plano: localizar o crear proyecto Firebase bajo la cuenta del propietario, registrar `com.somosve.app`, incorporar configuracion Android y configurar credenciales servidor de forma privada. Falta implementar registro/revocacion de dispositivos de avisos por cuenta/comercio y envio desde eventos de pedido. No reutilizar credenciales de impresora como autenticacion de comprador/comerciante. Validar pantalla bloqueada, cierre, reconexion, logout/cambio de cuenta y no duplicados antes de anunciarlo como disponible.

Mapa con logos, cuentas verificadas/historial y calificaciones siguen en los bloques posteriores, sin interfaces ficticias.

Referencias primarias verificadas: [Canales Android](https://developer.android.com/develop/ui/compose/notifications/channels) y [Permiso de notificaciones](https://developer.android.com/develop/ui/compose/notifications/notification-permission).
