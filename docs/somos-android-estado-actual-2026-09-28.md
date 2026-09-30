# SOMOS Android: estructura, funcionamiento y diseño actual

Fecha de corte: 28 de septiembre de 2026  
Versión candidata: `1.1.4-ticket-preview`  
Estado: aplicación Android de prueba; no publicada en Google Play.

## 1. Resumen del producto

SOMOS es una plataforma de comercio para vender mediante catálogo, carrito,
pedidos, pagos, delivery y WhatsApp. La aplicación Android no reescribe el
producto: usa Capacitor para mostrar la aplicación Next.js compartida y agrega
capacidades nativas donde aportan valor, especialmente navegación móvil,
ciclo de vida Android e impresión térmica Bluetooth.

La misma plataforma atiende dos espacios principales:

- **Comprar:** Marketplace, búsqueda, catálogos, carrito y checkout.
- **Mi negocio:** pedidos, productos, resumen, configuración, Mesa/Barra e
  impresión para comercios autorizados.

Los flujos Founder y empresas delivery continúan usando sus permisos y rutas
existentes. Una preferencia guardada en el teléfono nunca concede acceso.

## 2. Arquitectura

### Capa web compartida

- Next.js 16.3.4 con App Router y React 19.
- Tailwind CSS para estilos.
- Supabase para PostgreSQL, autenticación y almacenamiento.
- Vercel para la aplicación web y las Previews.
- APIs privadas bajo `/api/panel/*`, `/api/admin/*` y `/api/printing-agent/*`.
- Validación multi-tenant en servidor mediante usuario, comercio y dispositivo.

### Capa Android

- Capacitor 8.5.2.
- Identificador: `com.somosve.app`.
- WebView remota restringida a un origen HTTPS autorizado.
- `MainActivity` controla carga inicial, reintento y botón Atrás.
- Plugin nativo `SomosPrinter` para Bluetooth Classic SPP y ESC/POS.
- Servicio foreground persistente para impresión automática.
- Credencial del dispositivo cifrada con Android Keystore/AES-GCM.
- Receptor de arranque para recuperar el servicio después de reiniciar o
  actualizar la aplicación.
- Firebase Messaging está preparado como acelerador futuro; sin la
  configuración Firebase, el sondeo periódico sigue siendo el respaldo activo.

### Relación APK/web

El APK contiene Capacitor, código Java nativo, permisos, iconos y configuración
del origen. La interfaz React y la mayoría de las funciones se cargan desde la
web remota. Por tanto:

- Cambiar Java, permisos o impresión requiere compilar e instalar otro APK.
- Cambiar React, CSS o APIs requiere desplegar la web correspondiente.
- Para probar ambos cambios juntos, el APK debe apuntar al deployment Preview
  exacto que contiene la web candidata.

## 3. Experiencia del comprador

### Entrada y espacios

- Una persona nueva entra en Comprar/Marketplace.
- Existe acceso visible a `Ingresar a mi negocio`.
- La aplicación recuerda el espacio elegido sin preguntar en cada apertura.
- La navegación nunca usa esa preferencia como autorización.

### Navegación

La barra inferior usa tres destinos principales:

- **Inicio:** descubrimiento del Marketplace.
- **Buscar:** enfoque directo en búsqueda y filtros.
- **Mis datos:** perfil local del comprador.

El carrito aparece de forma contextual cuando contiene productos. No se
muestran pestañas vacías, historial ficticio ni una cuenta supuestamente
verificada a partir de un teléfono local.

### Ciudad y ubicación

- En la primera entrada nativa puede solicitar ubicación mientras se usa la app.
- Infiere una ciudad usando comercios geolocalizados cercanos.
- La selección manual siempre tiene prioridad.
- No existe seguimiento en segundo plano.
- No se guardan coordenadas nuevas en el perfil local.
- Si la ubicación es ambigua, está apagada o fue negada, se ofrece selección
  manual en lugar de inventar una ciudad.

### Estado local y recuperación

- Conserva carrito, ruta interna segura y borrador permitido de checkout.
- Al regresar de WhatsApp, banco u otra aplicación intenta continuar el flujo.
- No persiste comprobantes, secretos, cotizaciones firmadas ni tokens privados.
- No restaura precios como autoridad: el servidor recalcula el pedido.
- Al completar una compra borra el borrador para evitar reenvíos.
- `Mis datos` es almacenamiento de este dispositivo, no una identidad verificada.

## 4. Experiencia del comercio

### Acceso y sedes

- Supabase Auth mantiene la sesión.
- El backend devuelve únicamente comercios autorizados para la cuenta.
- Si existen varias sedes, el usuario puede elegir y recordar la última.
- El acceso se revalida al volver al primer plano.
- Cerrar sesión o cambiar de cuenta limpia caché y preferencias privadas.
- Los roles owner, admin y operator conservan sus permisos actuales.

### Navegación de negocio

La navegación inferior prioriza:

- **Pedidos**
- **Productos**
- **Resumen**
- **Negocio**, que abre una hoja inferior con el resto de herramientas.

La hoja Negocio tiene cierre visible, toque exterior, gesto hacia abajo y
soporte de Atrás. Desde ella se accede a configuración, Mesa/Barra, impresión,
clientes, estadísticas y otras funciones permitidas por el comercio/rol.

### Protección de trabajo en curso

- Productos y Configuración avisan antes de abandonar cambios sin guardar.
- Un error temporal de conexión cubre la pantalla sin desmontar inmediatamente
  formularios locales.
- Respuestas tardías no deben repoblar datos privados después de cerrar sesión.

## 5. Botón Atrás y ciclo de vida

El orden esperado del botón o gesto Atrás es:

1. Cerrar diálogo, modal, hoja o capa abierta.
2. Retroceder dentro del espacio actual.
3. Desde la raíz del espacio, permitir salir normalmente de Android.

La app evita saltos involuntarios entre Comprar y Mi negocio. Cuando vuelve al
primer plano, revisa conectividad, sesión y permisos antes de restaurar vistas
privadas.

## 6. Carga y conectividad

- Vista nativa de carga durante el arranque.
- Pantalla nativa de error si la web inicial no carga.
- Acción de reintento sin dejar una WebView blanca.
- Indicador web de desconexión y recuperación.
- El carrito local puede mantenerse durante una interrupción.
- Nunca confirma un pedido sin respuesta válida del servidor.
- No implementa catálogo offline completo.

## 7. Impresión térmica

### Funcionamiento

- Bluetooth Classic SPP/RFCOMM con impresoras ESC/POS.
- Piloto validado con Samsung A34 y TIII Bluetooth Printer.
- Papel configurable en 58 u 80 mm.
- Entre una y tres copias.
- Importes opcionales mediante `Mostrar precios en la comanda`.
- Impresión manual desde un pedido.
- Impresión automática mediante servicio foreground aun con SOMOS cerrada.
- Sondeo serial de la cola y reintentos ante fallos temporales.
- Recuperación validada tras Bluetooth apagado/encendido, pérdida de internet y
  reinicio del teléfono.

### Seguridad de la cola

- Vinculación temporal de dispositivo con código de un solo uso.
- Token aleatorio; el servidor guarda hash SHA-256.
- Token cifrado en Android Keystore.
- Cola aislada por `store_id` y dispositivo reclamante.
- Bloqueo temporal, deduplicación y estados pending/processing/printed/failed.
- La APK no contiene `SUPABASE_SERVICE_ROLE_KEY`.
- `sent` significa bytes entregados al socket Bluetooth; no demuestra que el
  papel salió físicamente.

### Contenido de la comanda candidata 1.1.4

- Comercio, código, fecha y hora Venezuela.
- Modalidad: Delivery, Retiro, Mesa/Barra o Envío nacional.
- Mesa y zona cuando corresponda.
- Cliente y teléfono.
- Dirección y referencia solo cuando sean diferentes, además de zona y empresa
  de delivery cuando existan.
- Método y referencia de pago. El estado interno de pago no se imprime.
- Productos, cantidades, variantes, grupos/opciones, extras y notas por ítem.
- Detalles y nota general del pedido.
- Si se permiten precios: subtotal, delivery, total USD y total Bs.
- Los pedidos nuevos usan código `SO-MMDD-NNNNNN`; los históricos conservan
  sus códigos anteriores `VP-*`.

No imprime comprobantes, datos bancarios del comercio, coordenadas GPS, tokens,
credenciales ni enlaces privados.

## 8. Diseño visual

### Dirección general

- Mobile-first, táctil y orientada a uso frecuente.
- Marca SOMOS con verde petróleo, blanco y naranja como acción/acento.
- Superficies claras para contenido y tarjetas compactas.
- Iconos Lucide en acciones reconocibles.
- Bordes moderados y jerarquía tipográfica fuerte.
- Respeto de safe areas superiores e inferiores de Android.
- Barra inferior fija con áreas táctiles estables.
- Sin barras web duplicadas dentro del shell nativo.

### Marketplace

- Encabezado verde petróleo con marca, ciudad, buscador y categorías.
- Selector de ciudad naranja de alta visibilidad.
- Tarjetas visuales con fotografía real, comercio, producto y precio.
- Secciones de favoritos, ofertas, recién llegados y comercios.
- Barra inferior blanca con estado activo naranja.
- El teclado y las barras del sistema no deben tapar controles principales.

### Mi negocio

- Interfaz más utilitaria y compacta que el Marketplace.
- Pedidos y Productos ocupan destinos directos.
- Herramientas secundarias viven en la hoja Negocio.
- Estados de carga, error, desconexión y cambios sin guardar son explícitos.

## 9. Seguridad y privacidad

- Autorización real siempre en servidor.
- Filtros por comercio en lecturas y escrituras privadas.
- La app no confía en precios, delivery, opciones ni estados del navegador.
- Las preferencias locales solo mejoran UX.
- Limpieza de datos privados al cerrar sesión o cambiar de cuenta.
- Origen Android restringido a HTTPS permitido.
- Build release bloqueado si apunta a localhost o Preview.
- Preview pública no elimina la autenticación de SOMOS.

## 10. Estado de validación

Validado hasta ahora:

- Instalación/actualización en Samsung A34.
- Navegación comprador y shell de negocio.
- Ciudad automática y selección manual.
- Reconexión y recuperación de estado en pruebas automatizadas.
- Impresión física manual y automática con app cerrada.
- Recuperación de impresión después de fallos comunes.
- Preview cloud sin túnel ADB ni PC para funcionar.
- APIs privadas continúan rechazando usuarios anónimos.

Pendiente para la candidata 1.1.4:

- Imprimir una comanda real controlada con todos los tipos de datos.
- Confirmar legibilidad en 58 mm y que no haya información redundante.
- Probar Delivery, Retiro y Mesa/Barra.
- Confirmar comportamiento con `Mostrar precios` activo e inactivo.
- Verificar dos pedidos consecutivos sin duplicados.

## 11. Límites actuales

- No hay publicación ni actualización automática por Google Play.
- No hay firma release ni custodia formal de clave de publicación.
- FCM real requiere proyecto/configuración Firebase; el polling funciona como
  respaldo pero no es la arquitectura final para escala nacional.
- No existen cuentas verificadas de comprador, OTP, favoritos sincronizados ni
  historial privado multiplataforma.
- La ciudad se infiere por comercios cercanos, no por límites municipales.
- El contenido web depende de internet; no existe catálogo offline completo.
- La impresión está pilotada con una familia concreta de impresora ESC/POS.

## 12. Preguntas útiles para una evaluación externa

1. ¿La separación Comprar/Mi negocio reduce fricción sin ocultar funciones?
2. ¿Qué destinos merecen barra inferior y cuáles deben quedar en Negocio?
3. ¿Qué información de la comanda es imprescindible para cocina, caja y delivery?
4. ¿Conviene una plantilla distinta para restaurante, retail y Mesa/Barra?
5. ¿Cómo migrar de polling a push sin perder el respaldo offline/reintentos?
6. ¿Qué métricas medir: tiempo a primer pedido, abandono, retorno, errores de
   impresión, duplicados y tiempo desde pedido hasta papel?
7. ¿Qué trabajo falta antes de Google Play: firma, privacidad, analytics,
   crash reporting, actualización y soporte de dispositivos?
8. ¿Qué partes deben seguir compartidas con web y cuáles justifican UI nativa?

La evaluación debe preservar tres restricciones: autoridad del servidor,
aislamiento multi-tenant y funcionamiento simple para comercios no técnicos.
