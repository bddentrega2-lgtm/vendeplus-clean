# Borrador Data Safety de Somos

Actualizacion 2026-10-02: Firebase y las migraciones de eliminacion ya estan
configurados/aplicadas segun SESSION_HANDOFF.md; impresion FCM fisica confirmada.
No confundir esas tareas terminadas con la declaracion final sobre el AAB.

Estado: inventario tecnico para completar Google Play Console. No sustituye la
revision del responsable legal ni debe marcarse como enviado hasta validar
produccion, Firebase, retencion y datos de contacto.

## Datos de comprador

| Categoria Play | Datos usados por Somos | Finalidad | Tratamiento |
| --- | --- | --- | --- |
| Informacion personal | Nombre, correo de cuenta Google, telefono y cedula cuando el comercio la exige | Cuenta, pedido, contacto y prevencion de abuso | Correo en Auth; datos del pedido en Supabase; nombre/telefono/cedula tambien pueden guardarse localmente si el usuario lo elige |
| Ubicacion | Ciudad y coordenadas elegidas o autorizadas | Mostrar comercios cercanos, indicar entrega y calcular delivery | Solo al usar la funcion; puede guardarse una ubicacion frecuente localmente |
| Informacion financiera | Forma de pago, referencia, notas y comprobante opcional | Confirmar y conciliar el pedido | No se procesan tarjetas dentro de Somos; el comprobante se almacena de forma restringida |
| Actividad en la app | Carrito, pedidos, historial, calificaciones y observacion opcional | Ejecutar pedidos, historial y calidad del comercio | Vinculada a la cuenta solo cuando el comprador inicia sesion |
| Identificadores | ID de cuenta, ID de pedido, token de notificacion y token tecnico de dispositivo de impresion | Sesion, idempotencia, avisos y operacion de impresion | Tokens de impresion se guardan como hash en servidor; FCM requiere configuracion final |
| Fotos o archivos | Imagen de comprobante opcional | Verificacion de pago | Carga iniciada por el usuario; acceso restringido al comercio autorizado |

## Datos operativos de comercios y delivery

- Datos de acceso y contacto de usuarios autorizados.
- Catalogo, productos, inventario, clientes y pedidos del comercio asignado.
- Datos necesarios para retiro y entrega compartidos con el comercio y, cuando
  aplica, con la empresa o persona encargada del delivery.
- Configuracion Bluetooth, impresora vinculada, estado de trabajos y token FCM
  cuando la impresion automatica esta habilitada.

## Declaraciones que requieren confirmacion

- Cifrado en transito: si, HTTPS/TLS para servicios remotos.
- Eliminacion de cuenta: disponible dentro de Mi cuenta y publicamente en
  `/eliminar-cuenta`; pedidos operativos pueden conservarse por necesidad
  comercial, de seguridad o legal.
- Venta de datos: el comportamiento implementado indica que no se venden datos.
- Comparticion: declarar comercio, operador de delivery y proveedores tecnicos
  necesarios para prestar el servicio; no confundir procesamiento tecnico con
  venta.
- Datos opcionales: ubicacion precisa, cedula, comprobante, calificacion y
  observacion dependen del flujo o eleccion del usuario.
- Retencion: falta aprobar plazos concretos para pedidos, comprobantes, logs y
  cuentas antes de responder definitivamente en Play Console.

## Permisos Android observados

- Internet.
- Ubicacion aproximada y precisa.
- Bluetooth y dispositivos cercanos para impresion.
- Notificaciones y vibracion.
- Servicio en primer plano de dispositivo conectado para imprimir por Bluetooth.
- La candidata actual no declara arranque al encender (RECEIVE_BOOT_COMPLETED).

No se observaron permisos Android de contactos, SMS, llamadas, microfono o
camara. El selector de archivos puede usarse para elegir un comprobante sin un
permiso general de almacenamiento.

## Bloqueadores antes de enviar

1. Definir nombre legal, correo de soporte y contacto de privacidad.
2. Aprobar plazos de retencion y procedimiento para solicitudes sobre pedidos.
3. Revisar datos declarables de Firebase ya configurado para `com.somosve.app`.
4. Crear o custodiar externamente la clave de firma de Play.
5. Verificar el flujo de eliminacion de comprador y solicitud operativa desde
   la version instalada por Play. Las migraciones ya fueron aplicadas.
6. Repetir inventario sobre el AAB firmado final y completar el formulario en
   Play Console con las respuestas del propietario.
7. Completar declaracion de servicio en primer plano connectedDevice, con
   explicacion y video real de impresion. Preparar acceso de revision a un
   comercio de prueba sin datos de clientes.

## Distribucion

- Confirmar cuenta Play Console, titular y estado de verificacion; aun no se
  verificaron desde esta sesion.
- Generar AAB firmado y activar Play App Signing, luego pruebas internas.
- Si es cuenta personal creada despues del 13-11-2023, Google exige prueba
  cerrada con al menos 12 testers durante 14 dias continuos antes de solicitar
  acceso a produccion. Prueba interna no reemplaza este requisito.
- Data Safety no es requisito para una app exclusivamente en prueba interna;
  debe completarse para pruebas cerradas/abiertas y publicacion general.
- Fuentes consultadas 2026-10-02: https://support.google.com/googleplay/android-developer/answer/14151465
  https://support.google.com/googleplay/android-developer/answer/13392821
  https://support.google.com/googleplay/android-developer/answer/10787469
