# Solicitud por WhatsApp, pago independiente y bienvenida

## Alcance

Solicitud del usuario: registro sin pago previo, condiciones completas en WhatsApp,
datos de pago coordinados por ese medio, aprobacion de comercio y pago independientes;
mensaje compartible al crear aliados. Implementado en .referrals-v2-preview.
Publicado en produccion con autorizacion "si con cuidado". No commit/push solicitado.

Preview READY/shared: https://vendeplus-clean-ozwyxys8m-entrega2-s-projects.vercel.app
Deployment dpl_JDLLpoDrzXiwyA5fbm3mMWdksWuS. NO promover: usa datos aislados de staging.
HTML oficial verificado 2026-10-12T20:04:11.379Z en
dpl_8fVbQ819PoxVUQ3E1GaTD4f36b6W. Candidato productivo independiente:
https://vendeplus-clean-pd0x0bagw-entrega2-s-projects.vercel.app.
Anterior dpl_2MqTY91XWA7FUdxK4i7kQd5h5fji conservado.

## Cambios

- SignupForm: quita CTA de reportar pago en el paso posterior al registro. WhatsApp
  usa precio base/descuento/total devueltos por servidor; muestra codigo o registro
  directo y pago pendiente. Conserva costo inicial visible, no promete gratuidad.
- API/admin Solicitudes: aprobar sin pago; confirmar ingreso antes o despues de
  aprobar. Referencia, importe exacto, fecha y administrador quedan en la solicitud.
  Reintentos concurrentes no duplican la confirmacion. Legacy sigue sin cobro.
- Dos botones: Aprobar comercio y Aprobar pago. Filtro Pagos pendientes tambien
  encuentra aprobados; recibo confirmado muestra monto/fecha/referencia.
- API y formulario de comprobantes anteriores siguen funcionando tras aprobar,
  sin permitir confirmar dinero desde el cliente. No se eliminan enlaces viejos.
- AdminAffiliatesManager: bienvenida tras crear codigo, posibilidad de recuperarla
  desde el icono de mensaje, copiar y compartir a WhatsApp manualmente. Vendedor/
  creador con correo Google; delivery desde cuenta propietaria/administradora.
- Helpers puros en src/lib/affiliates.ts; condiciones de comisiones no cambiadas.

## Base de datos

Migracion nueva: 20261012180000_registration_independent_payment.sql. Aplicada en
staging xpqmmdmixpyqruykkbkf y produccion rvmtjtuztewcrmodrodb. Sustituye guard de activacion sin quitar bloqueo
de reversion de aprobadas ni vinculo de referido. Trigger de comision inicial
responde a aprobacion o confirmacion de pago, exige ambos y conserva UNIQUE por
solicitud/ON CONFLICT. No modifica pagos ni comisiones historicos. Aplicada antes
de promover codigo, tras ensayo con ROLLBACK y comprobacion de estado. Helper
payment-apply limita a esta migracion, con lock_timeout3s, historial y comparacion
transaccional de solicitudes. Nueve registros anteriores conservados integramente.
payment-inspect confirma trigger correcto, ausencia de bloqueo de pago y guard
legacy intacto. Ningun SQL manual pendiente; no repetir apply.

## Pruebas

- npm.cmd run build PASS (Next16.3.8, TypeScript, 138 paginas con staging).
- SQL financiero transaccional de regresion PASS, rollback limpio.
- Journey run81b449027f: casos11-16 PASS6/6,179 checks, limpieza true.
  Antiguos sin cobro, vendedor aprobado antes de pago por WhatsApp, creador con
  comprobante posterior, directo sin comision, exoneracion total, delivery con
  pago antes de aprobar. Se recorren pedido, fee cobrado y liquidacion posteriores.
- Dos confirmaciones de pago simultaneas: HTTP200+409 y comision unica.
- UI admin390/1280: ambos botones disponibles sin pago, bienvenida correcta y
  enlace WhatsApp integro; sin overflow ni erroresJS. Capturas inspeccionadas.
- Mensajes unitarios7/7: 0/50/75/100% descuento y tres perfiles de aliado.
- UI registro4/4: directo y descuento50%,390/1280. POST del formulario simulado
  solo en este test visual; los registros de journeys usan API real en staging.
  MensajeWhatsApp correcto y sin CTA de pago; captura movil inspeccionada.
- ESLint focal en helpers/aliados/comprobante/API comprobante PASS.
- QA remoto autenticado admin390/1280 PASS: tresdemos, buscador, detalle, sin
  overflow ni erroresJS. Sesiones cerradas y servidorlocal3107 detenido/puertolibre.
- Errores de harness corregidos: staging no tiene supabase_migrations (se inspecciona
  trigger real antes de aplicar); label de select Ciudad incluye opciones en su
  nombre accesible (selector por prefijo). No eran fallos de producto.

## Validacion productiva posterior

- Build remoto productivo PASS262 paginas/TypeScript antes de promocion.
- Smoke19/19 en candidato y dominio oficial. Incluye rechazo401 sin sesion en
  APIs protegidas y texto nuevo de solicitud sin pago previo en registro.
- Browser readonly5rutas x390/1280=10/10PASS: sin overflow ni errores JavaScript.
  Registro movil/escritorio inspeccionados; capturas tmp/referrals-release-visual.
  Checkouts/carrito vacios, no compra real ni simulacion de pago en produccion.
- RLS, RPC restringidas y buckets privados5MB preservados. Nueve solicitudeslegacy,
  ingresos iniciales0, comisiones0. Un codigo existente observado, no creado por QA.
- Consulta logs de error desde20:04:11Z sin resultados en ventana revisada.
- Rollback al deployment previo no revierte migracion ni dinero. La API previa
  volveria a exigir pago para aprobar: revisar consistencia antes de retroceder.

## Limites y siguiente paso

No se envian mensajes WhatsApp automaticamente. Las referencias de prueba son
ficticias; no hubo transferencias bancarias ni correo/Google interactivo real.
Los botones financieros registran un pago confirmado por admin, no mueven dinero.
Sin cambios V2 adicionales solicitados. Siguiente: crear aliados reales con sus
condiciones confirmadas y comprobar el primer ingreso real desde admin. Ningun
pedido, pago o usuario ficticio creado en produccion por estas validaciones.
