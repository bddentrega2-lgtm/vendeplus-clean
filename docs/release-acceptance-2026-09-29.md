# Prueba de aceptacion Somos 1.3.2

## Estado

Actualizacion: usuario autorizo "procede" y el lote ya esta en produccion:
https://www.somos-ve.com . Final dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1.
Ver production-release-1.3.2-2026-09-29.md para validaciones y reversion.
APK11 sigue privada y conserva el siguiente Preview READY:
https://vendeplus-clean-9f7uno4fk-entrega2-s-projects.vercel.app

APK candidata: 1.3.2-profile-controls-preview, versionCode 11, instalada en A34.
Usuario confirmo sonido automatico e impresion en 1.3.1 y Promos por ciudad.
Usuario confirma "revise todo ok": ajustes 1.3.2 aceptados en el recorrido
revisado. Publicacion web autorizada y completada; APK oficial/Play Store separados.
Detalles y validaciones actuales
en mobile-profile-controls-2026-09-29.md. Esa nota prevalece sobre el registro
historico de pruebas al final de este documento.
Catalogo confirmado HTTP 200, titulo Smash (Test):
https://vendeplus-clean-9f7uno4fk-entrega2-s-projects.vercel.app/smash

Estas pruebas usan backend real. Usar solo Smash (Test), datos propios/de prueba,
sin pagos reales, envios WhatsApp ni solicitudes a repartidores externos.
No crear pedidos en comercios operativos. No borrar datos ni reinstalar la app.

## Preparacion

- A34 con la APK indicada, internet, volumen de notificaciones audible y sin
  silencio/No molestar. Impresora encendida y vinculada como estaba.
- Ingresar al panel, seleccionar Smash (Test), comprobar impresion automatica
  activa. No cambiar ajustes de otros comercios.
- Campana: activar Sonido y notificacion. Probar y comprobar sonido y aviso.
- Dejar el panel visible unos 20 segundos, hasta que carguen pendientes sin
  error, antes de crear el pedido. No bloquear ni minimizar el telefono.
- Abrir el catalogo Preview anterior desde una PC u otro telefono para comprar.
  No usar el dominio de produccion para esta prueba del candidato.

## Pruebas y resultado esperado

1. **Pedido completo, Retiro (pick up).** Desde el otro navegador, agregar un
   producto con opciones/extras si existen y una nota identificable de prueba.
   Usar nombre `PRUEBA PREPUBLICACION`, telefono propio y efectivo si esta
   disponible. Confirmar una vez, sin pago real. Revisar producto, cantidad,
   extras y total antes de confirmar. Debe aparecer una sola confirmacion y un
   codigo `SO-MMDD-NNNNNN`, coincidente con panel y comanda.
2. **Aviso automatico.** Con A34 todavia en el panel de ese comercio, esperar
   aproximadamente 15 segundos mas el tiempo de red. Debe sonar y mostrar un
   aviso nuevo. Los pedidos anteriores no deben volver a sonar. Registrar el
   tiempo observado; si pasa un minuto, revisar red/permisos/estado y reportar
   antes de crear mas pedidos. Esto no comprueba funcionamiento con app cerrada.
3. **Impresion automatica.** Debe salir una sola comanda por el pedido, sin pulsar
   Reimprimir. Comparar codigo, nombre, telefono, Retiro, productos, cantidades,
   opciones, nota y totales con la confirmacion. Guardar foto. Observar otros
   30 segundos para detectar duplicados del mismo pedido. No confundir otros
   trabajos pendientes con duplicados; comparar codigos.
4. **Direccion y precios.** Para revisar entrega, usar una comanda de prueba
   existente o un segundo pedido solo si hay Delivery propio sin despacho a
   terceros. Usar direccion y referencia distintas. Deben salir completas,
   sin repetir texto identico y sin distancia/tarifa/estado de pago. Reimprimir
   deliberadamente para comparar precios activados y desactivados; registrar
   estas copias como manuales y restaurar el ajuste original al terminar.
5. **Controles compartidos web/app.** Revisar catalogo visual y clasico:
   precio/nombre no tapados por +/Cerrado, accion a la derecha del precio en
   visual. Campana pierde rojo al revisar y vuelve a marcar pedidos nuevos.
   En Productos, abrir el lapiz y
   cerrar sin guardar. Campana muestra pedidos y megafono novedades. Repetir
   en el navegador del Preview. Cambiar solo entre comercios autorizados y
   comprobar que no se mezclan pedidos; volver a Smash (Test).
6. **Comprador Android.** Despues de la prueba de aviso, revisar Inicio, ciudad,
   Promos y boton Atras. En Mis datos guardar nombre, telefono, cedula y una
   ubicacion frecuente (Agregar ubicacion, direccion/punto, Guardar ubicacion).
   Reabrir y comprobar persistencia; editar/cancelar/eliminar desde Mis datos.
   En borrador Delivery solo Usar Casa; cedula recuperada cuando se exige.
   No confirmar otro pedido. Promos debe respetar ciudad/ofertas existentes;
   una ciudad sin ofertas puede mostrar estado vacio.
7. **Sesion y recuperacion.** Al final, salir e ingresar otra vez, comprobar
   comercio correcto y ausencia de informacion de la cuenta anterior. Probar
   brevemente sin internet y reconectar: mensaje recuperable, sin pantalla
   blanca. Hacerlo sin pedido en envio ni impresion en curso.

## Que reportar

- Codigo de pedido y hora aproximada.
- Sonido: si/no y demora aproximada. Aviso visible: si/no.
- Cantidad de comandas automaticas del mismo codigo y foto legible.
- Precio/extras/nota/direccion correctos o campo que falta.
- Captura y pasos de cualquier superposicion, error o mezcla de comercios.

No enviar contrasenas, comprobantes bancarios ni datos de clientes reales.
El pedido de prueba queda en la base real; al terminar, cancelarlo desde el
panel segun el flujo normal, sin eliminar registros. No cancelar pedidos ajenos.

## Puerta de publicacion

No marcar aprobacion manual hasta recibir resultados. Si falta pedido, sonido,
hay duplicados, totales incorrectos o fuga entre comercios, detener publicacion.
Una prueba de aviso manual no sustituye el aviso automatico del pedido.

Revalidado en esta sesion: 80/80 contratos criticos, 17/17 pruebas unitarias de
movil, 7/7 recorridos cloud y ausencia de errores React. Cloud bloqueo escrituras
y no genero pedidos. Rutas privadas rechazaron peticiones anonimas con 401.
Ultimo build de app PASS240 local/Vercel; no se repitio porque no cambio codigo.

El remoto GitHub actual fue verificado PUBLICO. No subir el respaldo a ese
destino suponiendo que es privado ni cambiar su visibilidad automaticamente.
Esperar confirmacion de un destino privado antes del respaldo externo. Se
retiraron tres apariciones de una clave propuesta/rechazada en documentos; no
se modifico Auth. El respaldo local anterior a esta limpieza conserva las notas
antiguas: no distribuirlo ni subirlo tal cual. Una copia nueva debe usar las
fuentes saneadas. Las exclusiones de .env/keys no equivalen a una auditoria
completa del historial Git.

Sin migracion/SQL ni despliegue. Firebase para segundo plano, mapa con logos,
historial autenticado, calificaciones y distribucion Play Store quedan fuera.
