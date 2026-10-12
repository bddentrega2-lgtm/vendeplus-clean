# Crear los primeros cinco aliados de SOMOS

Actualizacion 2026-10-12: el flujo de aprobacion independiente y mensaje de
bienvenida descrito abajo YA esta en produccion. Aprobar comercio y aprobar pago
son acciones separadas; aprobar acceso no registra dinero recibido.

Los cinco son aliados que refieren comercios. No hay que crearles un comercio
propio para que ganen comisiones.

## Datos antes de empezar

- Vendedor y dos creadores: nombre y correo exacto con el que entraran con Google.
- Dos empresas delivery: identificar las empresas existentes en Admin > Transporte
  y confirmar quien tiene acceso como propietario o administrador de cada empresa.
- Por cada aliado: descuento al comercio, porcentaje de comision de suscripcion,
  porcentaje del fee y duracion de 1, 2 o 3 meses.
- Usar un codigo unico por aliado; letras, numeros, guion o guion bajo, de 3 a 32
  caracteres. Evitar el mismo nombre corto de un catalogo existente.

## Condiciones acordadas y pendientes

| Aliado | Categoria | Descuento al comercio | Comision suscripcion | Comision fee | Duracion |
| --- | --- | --- | --- | --- | --- |
| Empresa delivery 1 | Delivery | 75% | Definir | Definir | Definir: 1-3 meses |
| Empresa delivery 2 | Delivery | 75% | Definir | Definir | Definir: 1-3 meses |
| Vendedor | Vendedor | 0% | 75% | 50% | 3 meses |
| Creador 1 | Creador | 50% | 100% | Definir | Definir: 1-3 meses |
| Creador 2 | Creador | 50% | 100% | Definir | Definir: 1-3 meses |

La tabla no configura nada automaticamente. Los porcentajes de las demos de
delivery/creadores no son acuerdos comerciales y no deben copiarse por defecto.

Ejemplos de suscripcion inicial, no mensual:

- Vendedor: el comercio paga USD20 y el vendedor gana USD15.
- Creador con esas condiciones: el comercio paga USD10 y el creador gana USD10.
- Delivery: el comercio paga USD5. La comision de suscripcion se calcula sobre
  esos USD5, con el porcentaje que acuerdes, no sobre USD20.
- Un 50% de un fee cobrado de USD0.10 genera USD0.05. El plazo empieza cuando el
  comercio activa el plan por fee, no al registrarse durante el mes de prueba.

## Crearlos en admin

1. Entra a https://www.somos-ve.com/admin/aliados con tu cuenta administradora.
2. Pulsa **Nuevo aliado**.
3. Escribe codigo, nombre y contacto; elige **Vendedor**, **Creador** o **Delivery**.
4. Para vendedor/creador escribe su **Correo Google del aliado**. Para delivery
   selecciona su **Empresa** existente; no hace falta crear una cuenta duplicada.
5. Completa **Descuento %**, **Comision por suscripcion %**, **Comision del fee %**
   y **Meses**, segun el acuerdo de ese aliado. No dejar un 0 por descuido.
6. Si no hay limite o fecha acordados, deja vacios los campos de usos y vigencia.
7. Pulsa **Crear codigo**. Aparece **Mensaje de bienvenida**, con correo Google,
   acceso al panel, enlace para compartir y codigo. Puedes copiarlo o abrir WhatsApp
   para elegir el destinatario; no se envia automaticamente. Para delivery indica
   acceso desde la cuenta propietaria/administradora de su empresa.
8. En **Codigos y pago movil**, usa el icono **Copiar enlace**. El resultado es
   `https://www.somos-ve.com/registro?ref=CODIGO`.
9. Repite para los otros cuatro aliados. No cambies nombres/correos por datos demo.

## Primera comprobacion con cada aliado

1. Abre su enlace en una ventana privada, sin enviar el formulario: confirma que
   el descuento coincide (USD20 vendedor, USD10 creador, USD5 delivery).
2. El vendedor y creadores entran en https://www.somos-ve.com/aliados y eligen
   iniciar sesion con Google usando el correo configurado.
3. Las empresas delivery entran a su panel de transporte y abren **Referidos**.
   El acceso financiero es de propietario/administrador, no de repartidor/operador.
4. Cada uno registra sus datos de **Pago Movil** para recibir liquidaciones.
5. Confirma que inicialmente las ganancias estan en cero y solo ven sus datos.
6. Pueden compartir el enlace o usar **Registrar comercio** en su panel; ambas
   opciones conservan el codigo, sin evitar el registro y aprobacion de SOMOS.

## Primer comercio real y primer pago

1. El comercio completa el registro desde el enlace del aliado, sin pagar en la web.
   Envia la solicitud por WhatsApp, que incluye precio base, descuento, codigo y
   total pendiente. SOMOS le facilita por ese medio los datos de pago.
2. En **Admin > Solicitudes**, **Aprobar comercio** crea el acceso sin registrar
   dinero recibido. **Aprobar pago** registra referencia e importe real verificado.
   Se pueden hacer en cualquier orden. El filtro **Pagos pendientes** incluye
   comercios ya aprobados. La confirmacion no admite importes distintos del total.
3. Cuando el comercio esta aprobado y el pago confirmado, se reconoce la comision
   inicial del aliado una sola vez. Un comercio aprobado sin pagar no la genera.
   Subir un comprobante por un enlace anterior tampoco confirma el ingreso.
4. Tras la prueba, el comercio activa el plan por fee y recibe pedidos. Pedidos
   manuales no tienen fee; cancelados cobrables si lo tienen.
5. SOMOS confirma el pago de ese fee en **Admin > Suscripciones**. Solo entonces
   la comision elegible aparece para el aliado; no mostrarle deuda aun no cobrada.
6. En **Admin > Aliados**, abre el aliado y elige las comisiones a liquidar. Realiza
   el pago por el medio acordado y registra fecha, metodo y referencia verdadera.
   **Liquidar no transfiere dinero automaticamente**: deja constancia del pago.
7. Comprueba que baja **Por pagar** y sube **Ya pagado** por el mismo importe.

Las condiciones quedan congeladas al registrar cada comercio. Editar un codigo
solo cambia las condiciones de solicitudes futuras, no recalcula las anteriores.
