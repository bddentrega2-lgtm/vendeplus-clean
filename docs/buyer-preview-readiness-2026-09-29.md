# Preparacion del preview de cuentas - 2026-09-29

## Eliminacion de cuenta y preview beta2

Preview vigente: https://vendeplus-clean-fws9sx7wu-entrega2-s-projects.vercel.app .
Incluye pagina publica `/eliminar-cuenta`, opcion interna en Mi cuenta y endpoint
server-side protegido. Buyer puro: elimina Auth/sesiones/vinculos/reviews; conserva
pedido operativo. Usuarios con rol comercio/delivery/solicitud activa se bloquean.
15 pruebas API/DB, E2E local/cloud, build116 y smokecloud PASS. No cuenta real
eliminada durante QA. APK staging beta2 code13 instalada; produccion intacta.
La eliminacion con cuenta desechable fue aceptada por el usuario. La pagina publica
`/privacidad` ya describe el tratamiento tecnico actual y enlaza la eliminacion,
pero faltan identidad/contacto legal definitivo y completar Data Safety antes de Play.

## Beta Android vigente

Preview actual: https://vendeplus-clean-5f6wylb0i-entrega2-s-projects.vercel.app .
Reemplaza erpb4otzj para pruebas nuevas y retornoGoogle. APK separada Somos Pruebas
com.somosve.app.staging generada, firmada debug y verificada; no instalada porque
ADB no muestra dispositivos. Sin nuevas migraciones ni cambios productivos.
Ver `android-buyer-beta-2026-09-30.md` para artefacto, hash y prueba fisica pendiente.
Usuario acepto observaciones del preview anterior; no confundir con validacion
GoogleAndroid real en la nueva beta.

## Actualizacion: observacion opcional

El usuario confirma la calificacion anterior y solicita observacion opcional.
Se agrega texto plano hasta 500 caracteres, contador y edicion/borrado sin
cambiar las estrellas. Solo aparece en el historial del comprador; no hay
publicacion de comentarios ni nueva vista de comercio.

Archivos: BuyerAccount.tsx, native-polish.css, api/buyer/orders/route.ts,
api/buyer/reviews/route.ts, pruebas buyer-api/buyer-accounts.db/buyer-marketplace,
nueva buyer-review-observation.e2e, ops/supabase-buyer-staging.ps1 y SQL de pruebas.
Migracion nueva: 20260930030000_buyer_review_observation.sql, aplicada solo en
XPQM; RPC previa preservada y nueva RPC restringida a service_role. Columna
nullable con limite DB500. No SQL pendiente para el usuario en pruebas; no
se aplico ninguna migracion en produccion.

QA: 12 pruebas Node/PGlite PASS; escenarios transaccionales reales originales
mas guardar/editar/borrar/limite/propietario de observaciones PASS con rollback.
UI simulada PASS320/390/1366, sin overflow, recuperacion tras recarga, error y
reintento, texto plano y borrado. Capturas inspeccionadas. Build aislado
npm.cmd run build PASS114/TS, ESLint focal y diffcheck PASS. Servidor local3107
restaurado, launcher18872, logs start-observation*.log. Preview erpb4otzj READY,
dpl_6mF8S7U1Wc7h5t3JCFUV72tJo8JT, publico SOLOese deployment, 11 smokecloud y
suite UIobservacion cloud PASS. Google stage redirige al nuevo origen, sin
cambiar credenciales ni produccion. Enlace vigente:
https://vendeplus-clean-erpb4otzj-entrega2-s-projects.vercel.app/mi-cuenta .
Ingresar con misma cuenta, agregar observacion, guardar y recargar; tambien
probar borrar texto conservando estrellas. No APK nueva. Falta prueba humana
de observacion, segunda cuenta y
Android fisico. V2: moderacion y visibilidad al comercio por definir.

## Ingreso Google confirmado por el usuario (preview anterior)

Tras agregar un secreto nuevo y recibir las indicaciones de configuracion,
el usuario confirma: "funciono bien pude ingresar con mi cuenta". Se registra
aceptacion manual del ingreso web real en el preview aislado. No se accedio a
su cuenta ni se solicitaron secretos. Posteriormente confirma compra e historial
con SO-0929-465966, Cocina Demo, una Bebida Demo por USD2. Calificaciones,
persistencia tras reabrir, otra cuenta y Android siguen pendientes de prueba.
No se retiro ningun secreto anterior ni se publico a produccion.

## Pedido demo preparado para calificar

Se verifico la asociacion del pedido al comprador en staging y se cambio SOLO
SO-0929-465966 de received a completed. Total, items, propietario y pago
cash_on_delivery preservados; rating aun nulo. Transaccion con guardas exactas
en supabase/buyer_staging_complete_demo_order.sql, ejecutada mediante la
validacion de identidad de scripts/ops/supabase-buyer-staging.ps1 y su nuevo
-DemoOrderAction complete. Ya ejecutada; no repetir. inspect es solo lectura.

Siguiente prueba humana: recargar Mi cuenta, calificar, guardar y recargar para
confirmar persistencia. No se califico por el usuario. Sin migracion ni SQL
pendiente, sin despliegue nuevo ni cambios productivos. Build aislado PASS114 y
TypeScript; servidor local relanzado con launcher3444 y logs start-rating-test*.
Riesgos pendientes: aislamiento entre cuentas y flujo fisico Android por validar.
V2: sincronizacion de perfil y moderacion; eliminacion de cuenta antes de Play Store.

## Incidencia anterior de Google (resuelta en prueba humana)

Primera prueba humana falla antes del canje final. LogsAuth SOLO staging,
2026-09-30T02:06:41Z: `invalid_client` y `Unable to exchange external code`
en /callback. El proveedor rechaza el par ID/secreto; la presencia de ambos
campos guardados NO demuestra que coincidan ni sean validos. La prueba E2E
anterior solo llegaba a la redireccion302, limite ya documentado.

Usuario pide ayuda para encontrar credenciales. Ruta: Google Auth Platform >
Clientes > somos pruebas. ID OAuth y secreto del MISMO cliente Web, no APIkey.
Si no conserva el secreto completo, Add Secret permite uno nuevo sin invalidar
el anterior; no borrar/deshabilitar el anterior hasta validar login. Google
limita a dos secretos y solo los muestra completos al crearlos. Pegarlos SOLO
en Google de Supabase XPQM, Guardar y reintentar en el mismo enlace /mi-cuenta.
No modificar el cliente productivo ni transmitir secretos por chat/capturas.

Diagnostico nuevo: `-ReadAuthDiagnostics` en PSops consulta ultimas2h de auth_logs
por analytics/endpoints/logs y muestra solo categorias de error reconocidas,
sin mensajes raw, identidades ni tokens. No se cambio codigo de autenticacion,
credenciales remotas ni despliegue para este fallo de configuracion.
Sintaxis PS, diffcheck y escaneo documental sin secretos PASS. Build aislado
npm.cmd run build repetido: PASS114/TypeScript. Servidor local restaurado,
HTTP200; launcher10928, logs start-auth-diagnostics*.log. No SQL a ejecutar.

Fuentes oficiales:
- https://developers.google.com/identity/protocols/oauth2/web-server#invalid-client
- https://support.google.com/cloud/answer/15549257#client-secret-hashing
- https://supabase.com/docs/guides/integrations/supabase-for-platforms#debugging-projects

## Estado y autorizacion

El usuario autoriza avanzar hacia un preview unificado de cuentas, historial,
calificaciones y cambios visuales. Se mantiene el limite de no modificar
produccion. El usuario respondio "procede" y autorizo crear un Supabase separado
con datos ficticios, sin contratar un plan de pago. Proyecto creado:
`somos-buyer-staging`, ref `xpqmmdmixpyqruykkbkf`, region us-east-1,
ACTIVE_HEALTHY. Organizacion `vercel_icfg_B9hGS5Xag5lYa2DTCwT7IvDi`, plan
Free verificado por API antes de crear. No se cambio ninguna suscripcion.
Preview aislado READY: https://vendeplus-clean-azxcbptg7-entrega2-s-projects.vercel.app.
Deployment `dpl_84Ebzq3YzTpHRirmGMxdmFEMdVaF`, sin promocion a produccion.
Acceso publico habilitado SOLO para esta URL, sin cambiar proteccion global.
No hay APK nueva. Ingreso Google real web confirmado por el usuario; siguen
pendientes calificaciones, segunda cuenta y validacion fisica Android.

## Preview y aislamiento verificados

- Google enabled/client configured/secret configured confirmados true por API
  despues del "listo" del usuario. No se imprimieron ni copiaron sus credenciales.
- Claves Supabase de staging obtenidas por Management API y entregadas al
  lanzador por stdin; no .env nuevos ni secretos en argumentos/documentos/Git.
- Se verifican ref/roles JWT y dos comercios ficticios antes de compilar/desplegar.
  Lectura REST anon de buyer_order_accounts devuelve 401.
- Variables sustituidas por deployment en build Y runtime. Supabase usa XPQM;
  el resto de variables de aplicacion heredadas se vacia, incluidas entradas
  especificas de rama. Entrega2/OpenAI/founder/cron/captcha y secretos previos
  no se reutilizan. Sin modificar env global del proyecto ni su enlace local.
- Site URL de Supabase staging: origen exacto de este preview. Allowlist:
  `/auth/buyer-callback` en ese origen y `com.somosve.app://buyer-auth`, sin
  comodines. Configuracion Auth/Google de produccion intacta.
- Antes/despues del deploy y al compartir: produccion sigue en
  dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1. Nunca se uso --prod/promote/push/commit.
- Build local aislado npm.cmd run build y build Vercel SIN cache: PASS114/TS,
  solo cocina-demo/tienda-demo entre los catalogos dinamicos precompilados.
- 11 verificaciones E2E locales y 11 cloud: ciudad/filtro/retorno recordado,
  mapa 320/390/1366 con logos y mosaicos cargados, catalogo visual Demo,
  buyer/panel/admin401 y salida OAuth PKCE contra XPQM con callback correcto.
  Cero pageerrors, CSP solo backend XPQM. Capturas cloud/local inspeccionadas.
  E2E bloquea escrituras; no crea compras ni inicia sesion Google real.
- La salida OAuth se comprueba hasta respuesta302 de Supabase a Google;
  no acredita consentimiento Google, secreto valido ni canje final de codigo.
  Posteriormente el usuario confirmo ingreso real con su cuenta; esa evidencia
  es manual y distinta de la cobertura automatizada descrita arriba.
- Runner: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
  scripts/ops/supabase-buyer-staging.ps1 -PreviewAction inspect|build|deploy|status|share|start`.
  Elegir UN valor, no ejecutar literalmente la lista. `-ConfigurePreviewRedirects`
  solo lee el artifact de este preview y modifica el Supabase guardado/validado.
  Artifact sin secretos: tmp/buyer-staging/preview-deployment.json.

## Entorno aislado instalado

- Esquemas public/private exportados desde produccion SOLO estructura con
  pg_dump oficial 17.11, conexion read-only, sin propietarios ni datos.
  No se copiaron auth.users, clientes, pedidos, dispositivos ni integraciones.
- Se conservaron las dependencias privadas necesarias para sesiones/limites
  de solicitudes y triggers. No se habilitaron servicios externos.
- La restauracion inicial heredo permisos por defecto diferentes en funciones.
  Se corrigio SOLO staging: permisos efectivos anon/authenticated/service_role
  reconstruidos desde metadatos de produccion. Verificacion posterior: los
  cuatro RPC de pedidos/buyer solo permiten service_role; anon/authenticated
  denegados. Las dos tablas buyer tienen RLS activado.
- Migracion 20260929193000_buyer_accounts_and_reviews.sql aplicada SOLO staging.
  create_order_atomic conserva el hash original; no se reemplazo su logica.
- Dos comercios ficticios: Cocina Demo y Tienda Demo; dos ciudades Demo y
  tres productos. Una ciudad tiene promocion y la otra no. Solo retiro,
  efectivo, sin telefonos destinatarios, bancos, impresoras ni delivery externo.
  Logotipo de prueba: recurso Somos local, no logos copiados desde la base.
- Clave nueva conservada cifrada con DPAPI en tmp ignorado. Token CLI y
  conexion de exportacion solo en memoria. No se sobreescribieron .env ni
  variables globales Vercel; enlace CLI Supabase permanece en produccion:
  NO ejecutar db push.
- La instalacion fue SQL controlado, no una reconstruccion del historial de
  migraciones. Tampoco ejecutar todas las migraciones pendientes en staging.
- Prueba transaccional real remota: 12 escenarios PASS usando el RPC original
  y su wrapper, usuarios sinteticos y ROLLBACK. Comprueba stock/idempotencia,
  fallo de stock sin escrituras parciales, propiedad, invitado no reclamable,
  rating completado/propietario/rango, bloqueo al comercio propio y agregados.
  Al finalizar: cero pedidos persistidos y usuarios sinteticos revertidos.
  NO equivale a probar OAuth Google, la API HTTP ni la app fisica.

## Paso manual de Google

El usuario creo el cliente Google "somos pruebas" y guardo sus credenciales
en staging. Proveedor habilitado confirmado. No repetir creacion/configuracion.
No se inspecciono Google Cloud. El usuario ya confirmo login real; las instrucciones
de referencia de abajo sirven solo para diagnosticar un eventual error de acceso.
Produccion conserva su proveedor, sin cambios ni copia de credenciales.

1. En https://console.cloud.google.com/auth/clients crear un cliente OAuth de
   tipo Aplicacion web, nombre Somos pruebas. Conservar el cliente vigente de
   produccion intacto. Si falta configurar consentimiento o acceso, detenerse
   y resolverlo con el titular de la cuenta.
2. URI de redireccion autorizada exacta:
   `https://xpqmmdmixpyqruykkbkf.supabase.co/auth/v1/callback`.
3. Guardar ID/secreto directamente en Authentication > Sign In / Providers >
   Google de https://supabase.com/dashboard/project/xpqmmdmixpyqruykkbkf/auth/providers.
   No enviar credenciales por chat ni guardarlas en documentos o Git.
4. Retornos exactos ya configurados para preview y Android. No agregar comodines.

Referencia oficial: https://supabase.com/docs/guides/auth/social-login/auth-google.

## Inventario previo de produccion (sin cambios)

- Proyecto Vende+ de produccion: rvmtjtuztewcrmodrodb, ACTIVE_HEALTHY.
- Su rama shibui-inventory-staging-v2 (nmuypksuaxwyonilzoqs) figura
  MIGRATIONS_FAILED y pertenece a otra prueba; no se reutilizo ni modifico.
- Los otros proyectos de la cuenta pertenecen a otros sistemas; no se tocaron.
- Vercel Preview tiene variables Supabase y varias integraciones compartidas
  con Production. No asumir que un enlace Preview significa base aislada.
- Consulta de catalogos con supabase db query --linked: dos tablas buyer y
  tres RPC nuevos ausentes. create_order_atomic existe, SECURITY DEFINER,
  ejecutable por service_role, no anon/authenticated.
- Hash MD5 de definicion de create_order_atomic antes y despues de las
  consultas: f0277ea69be7930c141ec64004774d4c. No se ejecuto esa funcion.
- No se exportaron filas de clientes, pedidos ni usuarios. No se hizo respaldo
  completo de datos ni se afirma que exista uno reciente verificado.

## Defecto corregido antes de activar

La migracion local save_buyer_store_review usaba store_users.email, columna
inexistente en el esquema real. El fixture anterior inventaba esa columna y
ocultaba el error. Se reprodujo el fallo localmente al corregir el fixture.

La validacion ahora usa store_id + user_id, igual que el acceso del panel.
Propietarios y operadores no pueden calificar su propio comercio; pertenecer
a otro comercio no impide calificar una compra legitima. No se agregaron
columnas ni se debilitaron los permisos para hacer pasar la prueba.

Archivos de esta fase:

- supabase/migrations/20260929193000_buyer_accounts_and_reviews.sql: correccion
  de la migracion aplicada ahora SOLO staging; no se modificaron migraciones historicas.
- scripts/buyer-accounts.db.test.mjs: fixture sin email y regresion por rol/tenant.
- supabase/buyer_accounts_readiness.sql: SELECT de metadatos reutilizable;
  dependencias, existencia de RPC/tablas, RLS y permisos. Sin DML ni RPC de negocio.
- Este informe, docs/buyer-marketplace-2026-09-29.md y SESSION_HANDOFF.md.
- scripts/ops/supabase-buyer-staging.ps1: creacion Free, identidad staging,
  instalacion, permisos, verificacion, catalogo, pruebas y nuevo lanzador/retornos.
- scripts/ops/buyer-staging-preview.mjs: nuevo runner de build/deploy aislado.
- scripts/buyer-staging-preview.e2e.mjs: nueva QA readonly local/cloud.
- scripts/ops/export-buyer-staging-schema.ps1: exportacion de estructura en lectura.
- supabase/buyer_staging_permissions.sql: genera grants desde metadatos, sin filas.
- supabase/buyer_staging_seed.sql: catalogo ficticio, exige base vacia.
- supabase/buyer_staging_transaction_test.sql: 12 escenarios reales con rollback.

## Verificaciones

- Consulta inicial encontro store_users.email inexistente; staging ahora tiene
  tablas/RPC instalados, permisos verificados y ninguna dependencia faltante.
- 19/19 pruebas: autenticacion/API3, PostgreSQL local8 y contratos inventario8.
  Se verifica aislamiento, replay, invitado, estado completado, roles, rating,
  RLS y promedios sin identidad. PGlite conserva su mock; adicionalmente se
  probaron los 12 escenarios remotos anteriores con el RPC real, sin mock.
- Build vigente AISLADO114/TS via nuevo runner; sustituye el build254 previo
  conectado a produccion. git diff --check, sintaxis PowerShell/Node y escaneo
  documental sin secretos: PASS. ESLint focal PASS en fase anterior.
- Sin cambios visuales nuevos: las capturas aprobadas de pines44 se conservan.
- Servidor http://127.0.0.1:3107/marketplace ahora usa SOLO staging; launcher11732,
  logs tmp/buyer-staging/start-isolated*.log. Usar preview HTTPS para Google:
  localhost NO esta en allowlist. No reiniciar con mobile-local (cargaria prod).

## Siguiente paso exacto

1. Login web confirmado. Con sesion abierta, crear pedido ficticio en cocina-demo
   (Retiro/Efectivo, sin pago real ni envio WhatsApp), volver a Mi cuenta y verificar
   codigo/estado/total. Recargar para comprobar sesion/historial. Pedir solo codigo
   publico del pedido para el siguiente paso, no claves ni datos personales.
2. Probar compra invitada en comercios Demo, completar pedido
   controlado en staging y validar rating y aislamiento entre dos cuentas.
   No tocar compras reales ni copiar credenciales del panel productivo.
3. Construir APK de prueba y verificar Google, cancelacion y retorno, compra
   autenticada/invitada, inventario, historial, calificacion y aislamiento de
   otra cuenta. Sonido/impresion requieren dispositivos de prueba autorizados.

Riesgos pendientes: persistencia/cierre de sesion, compras autenticadas HTTP y Android con base
aislada, limites del plan gratuito y no mezclar origen de
sesion del panel con comprador. No promocionar a produccion con estas pruebas
incompletas. V2 conserva sincronizacion de perfil, moderacion y eliminacion de
cuenta/datos; no se implementaron en esta fase.
