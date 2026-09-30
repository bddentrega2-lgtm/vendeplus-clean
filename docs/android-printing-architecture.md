# Somos Android e impresion Bluetooth

## Estado recuperado

El piloto Windows dejo aplicadas en Supabase las migraciones `20260826152000`, `20260826194500`, `20260827120000` y `20260827221500`.

Se reutilizan estos conceptos:

- configuracion por comercio en `store_print_settings`;
- cola idempotente en `order_print_jobs`;
- codigos de vinculacion de un solo uso y diez minutos;
- tokens de dispositivo almacenados solo como hash en servidor;
- bloqueo temporal, reintentos y revocacion de dispositivos;
- plantilla ESC/POS de 58/80 mm.

El codigo local antiguo no se copia en bloque porque vive sin consolidar sobre una rama atrasada y mezclada. Cada pieza debe adaptarse a la base actual y validarse nuevamente.

## Arquitectura Android

- App ID definitivo: `com.somosve.app`.
- Capacitor carga `https://www.somos-ve.com` para mantener todas las funciones web.
- Plugin Kotlin propio para Bluetooth Classic SPP/RFCOMM y ESC/POS.
- Ninguna clave `service_role` dentro de la APK.
- Token revocable por dispositivo guardado con Android Keystore.
- Servicio `connectedDevice` visible mientras la impresion automatica este activa.
- FCM despierta el dispositivo; la cola persistente sigue siendo la fuente de verdad.
- WorkManager recupera y reintenta trabajos pendientes.

## Estados reales

Las impresoras economicas normalmente no confirman que el papel salio. La app distingue:

- `pending`: trabajo creado;
- `processing`: reclamado por un dispositivo;
- `sent`: bytes ESC/POS entregados al socket Bluetooth;
- `failed`: conexion o escritura fallida;
- `confirmed`: confirmacion manual opcional para diagnostico.

No se debe presentar `sent` como confirmacion fisica de papel impreso.

## Orden de implementacion

1. Compilar y abrir el shell Android en un telefono real.
2. Detectar que SOMOS corre dentro de la app y validar login, enlaces, archivos y camara.
3. Portar autenticacion y endpoints del agente de impresion.
4. Vincular telefono con comercio mediante codigo temporal.
5. Implementar seleccion de impresora y ticket de prueba.
6. Implementar impresion manual de una comanda real.
7. Activar cola automatica, FCM y reintentos.
8. Ejecutar piloto de volumen y publicar primero en prueba interna de Google Play.

## Criterios del primer piloto

- un comercio, un telefono y una impresora TIII;
- cero trabajos duplicados en veinte pedidos consecutivos;
- recuperacion despues de apagar y encender Bluetooth;
- recuperacion despues de perder internet;
- extras, notas, mesa, modalidad y precios legibles;
- revocacion del telefono efectiva desde el panel.

## Hito de hardware 2026-09-26

- Samsung A34 `SM-A346M` conectado por ADB inalambrico.
- Plugin nativo `SomosPrinter` registrado en Capacitor.
- Permisos Android 12+ para dispositivos cercanos concedidos.
- TIII Bluetooth Printer detectada como Bluetooth Classic SPP.
- Socket RFCOMM abierto con el UUID SPP estandar y ticket ESC/POS enviado con respuesta `sent: true`.
- `sent` confirma entrega de bytes al socket, no salida fisica de papel; la verificacion visual sigue siendo necesaria.
