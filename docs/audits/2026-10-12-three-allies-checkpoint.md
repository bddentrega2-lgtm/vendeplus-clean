# Revision de tres aliados y respaldo

## Alcance

Usuario solicita revisar tres aliados creados en produccion y asegurar en Git si
la configuracion es correcta. Inspeccion SQL en transaccion READ ONLY y peticiones
GET publicas. Sin registros, pedidos, pagos, cambios de claves ni impersonacion.
No se guardan correos personales, datos de pago ni credenciales en este informe.

## Configuracion verificada

| Codigo | Perfil | Descuento | Paga comercio | Comision suscripcion | Comision fee | Plazo |
| --- | --- | --- | --- | --- | --- | --- |
| VIBES | Creador | 50% | USD10 | 100% = USD10 | 50% | 3 meses |
| ALE | Vendedor | 0% | USD20 | 75% = USD15 | 50% | 3 meses |
| FED | Delivery | 75% | USD5 | 0% = USD0 | 50% | 1 mes |

- Tres codigos activos, sin vencimiento ni limite de usos. Sin duplicados de
  beneficiario ni colision con slugs de comercios. Tres enlaces GET200, validacion
  publica kind=affiliate y descuento/importe coinciden con base de datos.
- VIBES/ALE: correos configurados y normalizados. Aun no hay cuenta Auth con esos
  correos; el primer ingreso Google debe hacerlo cada aliado. No simular ese login
  ni crear cuentas/claves en nombre del usuario para una auditoria.
- FED: vinculado a FED (Fast Express Delivery), empresa activa y un miembro con
  rol owner/admin. Acceso desde panel de transporte. No necesita correo adicional
  en el codigo del aliado. Sesion real del propietario no probada en esta revision.
- Cero referidos, comercios afiliados, comisiones y liquidaciones; saldos y conteos
  de la funcion real usada por Admin coinciden. No hay ganancias ficticias.
- FED deliberadamente se describe como configurado: 0% inicial y UN mes de fee.
  Es una combinacion valida; no cambiarla a tres meses o asignarle comision inicial
  por asumir condiciones de otros perfiles. Comision fee solo sobre cobro SOMOS;
  por cada USD0.10 cobrado, 50% equivale a USD0.05 segun redondeo del sistema.

## Herramientas y continuidad

- Nueva accion reusable -AffiliateReleaseAction allies-audit en los helpers ops;
  consulta readonly y salida sin correos, tokens ni datos bancarios.
- Build directo inicialmente fallo por falta de variables privadas. Usar helper
  -PreviewAction build -AffiliatePreview que inyecta staging sin escribir .env.
- El guard de fixtures descubrio un tercer comercio de staging (papa), conservado
  sin modificar. SOLO el modo build acepta adicionales manteniendo los dos demos
  base, ref/roles de credenciales, aislamiento y prueba de privacidad. Deploy/test
  siguen exigiendo fixtures exactos. No ampliar guard de mutaciones por comodidad.
- Detector documental: tres falsos positivos eran qaSmashOrders y campos Entrega2,
  no secretos. Reformuladas referencias historicas; detector PASS0 hallazgos.
- Build final npm.cmd run build con helper staging PASS138paginas/TypeScript.
  Mensajes unitarios PASS7/7; smoke oficial19/19; tres enlaces/validaciones3/3;
  escaneo74archivos sin patrones de claves conocidas. No migracion nueva ni SQL
  manual pendiente. Artefacto local staging no debe promoverse a produccion.
- Checkpoint previsto: checkpoint/referrals-production-20261012, con historia
  anterior conservada. Subir solamente etiqueta a GitHub evita mover main y no
  solicita otro deployment. El checkpoint guarda codigo/migraciones, NO es un
  respaldo de filas Supabase ni de recibos/imagenes. Datos operativos viven en BD.

## Pendiente humano

Primer ingreso Google de VIBES/ALE; primer acceso al panel de referidos desde FED;
datos de Pago Movil del aliado y primer cobro/liquidacion reales. La auditoria no
equivale a verificar la identidad del correo ni una transferencia bancaria.
