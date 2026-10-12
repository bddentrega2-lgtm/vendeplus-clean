# Referidos: salida controlada

## Autorizacion y estado

El usuario autorizo publicar referidos de forma controlada el 2026-10-12.
El usuario confirmo "si correcto" a conservar sin cobro inicial las tres
solicitudes previas al esquema de USD20 y luego solicito continuar.
No se crearon los cinco aliados: falta identificar personas/empresas y completar
los porcentajes acordados de creadores y delivery.

**PUBLICADO en el dominio oficial.** Las 17 migraciones quedaron confirmadas en
una transaccion. Promocion completada y HTML oficial verificado el
2026-10-12T17:05:56.065Z. Artefacto construido con variables productivas, no de staging.

- Fuente: `.referrals-v2-preview`, base `b73d7f6` igual al worktree productivo limpio.
- Dominio oficial actual: `dpl_2MqTY91XWA7FUdxK4i7kQd5h5fji`, confirmado por HTML;
  `somos-ve.com` redirige a `www.somos-ve.com`.
- Anterior conservado: `dpl_GRtQNdWLDv7G5McqVQWcVNs9c7P9`.
- Candidato promovido: `dpl_2MqTY91XWA7FUdxK4i7kQd5h5fji`, READY.
- URL: https://vendeplus-clean-ey0luldk4-entrega2-s-projects.vercel.app
- Creado con `vercel deploy --prod --skip-domain --yes`; el alias predeterminado
  vendeplus-clean-entrega2-s-projects.vercel.app SI apunta al candidato. No
  confundir ese alias o project.targets.production con el dominio comercial.
- No hubo commit ni push solicitado.

## Cambios adicionales

- API y botones de aprobacion admiten `legacy`, sin exigir confirmar un pago
  inexistente. Acciones de cobrar un registro legacy se rechazan.
- Nueva migracion `20261012130000_affiliate_legacy_activation.sql`: permite activar
  legacy y prohibe que tenga codigo de aliado. Por si sola no marca solicitudes
  pendientes ni modifica precios. Aplicada en staging y ahora en produccion.
- Script `affiliate-release-db.ps1`, invocado por el helper Supabase, permite
  inspeccionar, ensayar con rollback, aplicar una lista cerrada de 17 migraciones
  y verificar. Rechaza esquema/historial inesperado o aprobaciones en curso;
  lock timeout 3s, statement timeout 60s. No ejecutar todo `supabase db push`.
- El script guarda los 17 SQL en el historial de migraciones en la misma
  transaccion. Conserva los registros existentes como legacy solamente si se
  autoriza explicitamente el modo PreserveLegacyRegistrations.
- Guia funcional: `docs/referrals-first-five.md`.

## Validaciones

- Antecedente: 10 escenarios / 550 comprobaciones en staging, todos PASS.
- Caso 11 nuevo: registro anterior, rechazo de cobro retroactivo, aprobacion,
  acceso, pedido, pago de fee y ausencia de comisiones: 15 checks PASS.
  Ejecucion `7715598161`, datos y cuentas temporales eliminados.
- SQL financiero transaccional repetido en staging: PASS.
- `npm.cmd run build`: PASS local staging (138 paginas), candidato con variables
  productivas PASS (262 paginas), TypeScript sin errores.
- Ensayo productivo de las 17 migraciones: PASS, rollback confirmado, no persistio
  schema ni cambios a solicitudes. Preflight: 64 comercios, 4694 pedidos al leer,
  3 solicitudes pendientes y ninguna activandose; no son contadores congelados.
- Seis lecturas de regresion tanto dominio oficial como candidato: Smash/Realza
  checkout, Shibui carrito y login200; pedidos/notificaciones sin sesion401.
- Smoke ampliado del candidato: 17/17 PASS. El primer intento esperaba200 en admin
  sin seguir su redireccion307 al login; se corrigio el harness, no la proteccion.
- Inspeccion posterior al ensayo: esquema de referidos ausente e historial aplicado0;
  tres solicitudes pendientes y ninguna activandose. Confirma que el rollback no
  dejo migraciones persistentes.
- Servidor local3107 detenido. Ningun pedido, producto, pago ni cuenta productiva
  modificados por estas pruebas; no se enviaron correos reales.

## Siguiente paso exacto

1. Entrar con la cuenta administradora a /admin/aliados y confirmar la lista vacia.
   No se creo sesion administrativa productiva de prueba ni se suplantaron usuarios.
2. Confirmar nombres/correos de vendedor y creadores, las dos empresas delivery
   existentes y sus condiciones pendientes, segun docs/referrals-first-five.md.
3. Crear los cinco aliados reales y probar sus enlaces sin enviar registros ficticios.
4. Primera prueba humana de Google/correo real y primer registro/pago de un comercio
   con su consentimiento. Los ensayos con .invalid no verifican correo real ni Google.
5. Commit/push solo cuando el usuario lo solicite; el despliegue no es respaldo Git.

## Resultado de publicacion

- Apply productivo: 17 migraciones, preserved_prior_registrations=true, committed=true.
  NO repetir apply; el helper rechaza historial existente.
- Verify posterior: 5 aprobadas, 3 pendientes y 1 rechazada, todas legacy.
  Mismos nueve registros anteriores; no entraron solicitudes nuevas durante el cambio.
- Cero codigos de aliado y cero comisiones productivas; ningun demo trasladado.
- RLS activo en todas las tablas affiliate; RPC administrativa denegada al rol
  authenticated y permitida a service_role. Comprobantes en buckets privados 5MB.
- Smoke despues de migrar: candidato18/18 PASS; dominio oficial18/18 PASS despues
  de promover. Lecturas publicas, codigo inexistente valid=false y APIs privadas401.
- Browser Chromium headless, fallback tras iab no disponible: 5 rutas x390/1280,
  10/10 PASS, sin overflow ni errores JS. Registro muestra20USD; /aliados sin sesion
  muestra enlace de acceso. Checkout/carrito se verificaron vacios, sin enviar pedidos.
  Capturas y resultados: tmp/referrals-release-visual. Registro movil/PC inspeccionado.
- Harness visual ajustado: no inferir pagina vacia por menos de60 caracteres en
  acceso denegado; esperar el enlace de login y validar contenido real.
- Logs del deployment filtrados nivel error desde17:05:56Z: sin resultados en la
  ventana observada; no garantiza ausencia futura de errores.
- git diff --check PASS. Sin cambios al codigo de aplicacion tras build productivo
  PASS262 paginas; solo script QA y documentacion posteriores. Sin SQL manual pendiente.

## Cuidado con el intervalo de cambio

No dejar pasar tiempo innecesario entre aplicar esquema y promover candidato.
Las solicitudes existentes quedan legacy; una solicitud llegada al codigo viejo
despues de migrar puede conservar estado pending con USD20, aunque aun haya visto
la web anterior. Revisar ese intervalo y preservar condiciones anteriores antes
de aprobar/cobrar. No cambiar atribuciones ni marcar pagos como confirmados.

El rollback de deployment no revierte triggers SQL. Si ya se recibieron nuevas
solicitudes/pagos, preferir arreglo compatible y conciliacion, no borrar tablas,
desactivar validaciones o repetir migraciones. Conservar el candidato anterior
como referencia, pero no prometer rollback financiero automatico.
