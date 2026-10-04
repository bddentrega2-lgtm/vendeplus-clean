# Auditoria de seguridad SOMOS - 2026-10-03

Actualizacion 2026-10-04: usuario autorizo expresamente `procede`. Puntos1 y2 corregidos y publicados en produccion, deployment `dpl_3GFBP86MDDSvkT6zeHD6gQpscte5`, Next16.3.8. Migracion `20261004000000_restrict_public_store_columns` aplicada/registrada despues del codigo compatible. REST administrativo antes200 ahora401; columnas publicas y relaciones200; permisos service_role conservados. Los apartados inferiores conservan el diagnostico historico, NO representan el estado actual de esos dos hallazgos. Puntos3/4 siguen pendientes.

Validacion del parche:91/91 pruebas PASS, build local previo y build productivo remoto PASS257 paginas/TypeScript; npm audit --omit=dev0. Permanecen5 avisos high transitivos SOLO tooling dev ESLint/braces. Postdeploy Home/Marketplace/login y catalogo/carrito/checkout/OG de Smash, Queje Olga, Realza y Shibui200; extras de productos con grupos200; rutas privadas y8 tablas sensibles rechazaron lectura anonima. Sin pedidos, productos, pagos o usuarios modificados. El usuario solicito asegurar el lote en Git despues del despliegue. No revertir al codigo anterior incompatible con permisos revocados. Detalle y continuidad en SESSION_HANDOFF.md.

Base revisada: commit `1b2456b`, rama `checkpoint/somos-mobile-production-20260930`, worktree `.fee-billing-prod`. HTTP real contra `https://www.somos-ve.com` y metadatos de Supabase produccion `rvmtjtuztewcrmodrodb` consultados con `read_only=true`.

## Decision operativa

Hay hallazgos que requieren correccion prioritaria. No se ha demostrado una intrusion, ejecucion remota ni acceso anonimo a pedidos/clientes. No hay fundamento suficiente para apagar toda la operacion. Se recomienda bloquear nuevas promociones funcionales hasta resolver la dependencia critica y la exposicion de datos internos. Una suite funcional verde no equivale a seguridad completa.

## 1. Dependencia critica en generacion de imagenes - atender hoy

- `package.json` instala Next.js `16.3.4`. `npm audit --omit=dev --json` identifica un aviso critico: GHSA-vcvr-r3jv-pc5j / CVE-2026-94545.
- Fuente oficial: https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j . Version corregida desde `16.3.6`; npm ofrece `16.3.8` como actualizacion compatible.
- `src/app/[storeSlug]/opengraph-image.tsx:6` usa Node y `:76` instancia ImageResponse. Los colores del comercio se interpolan en estilos. `src/app/api/panel/settings/route.ts:207` solo convierte y recorta strings; `src/lib/supabase/catalog.ts:252` los conserva. Modificar colores requiere manager y la funcion de marca desbloqueada.
- El aviso afecta valores controlables por atacantes que llegan a contenido, atributos o estilos SVG. SOMOS construye JSX de divs, posteriormente renderizado, y convierte sus logos a PNG; esto no demuestra por si mismo el exploit descrito. La aplicabilidad exacta a esa cadena requiere validacion aislada. No se ejecutaron payloads de explotacion en produccion.
- Cero comercios tenian colores fuera del formato hexadecimal de seis digitos al consultar; eso no descarta intentos anteriores ni prueba ausencia de compromiso.
- Accion: actualizar Next a parche corregido, alinear eslint-config-next, validar colores en servidor y al renderizar, probar OG/catalogo/panel y desplegar parche acotado. No intentar explotar produccion para decidir actualizar.

## 2. Informacion administrativa legible sin sesion - confirmado

- `supabase/migrations/20260711153646_freeze_public_rls_and_grants.sql:69` concede SELECT de toda `stores` a anon/authenticated; la policy limita filas activas pero no columnas internas. Los permisos actuales de produccion mantienen ese acceso.
- Peticion real anonima a REST seleccionando `billing_notes,monthly_price_usd,subscription_status,next_payment_due_at` devolvio HTTP 200 y una fila. No se imprimieron ni guardaron valores.
- Permite consultar notas internas, condiciones del plan y fechas de cobro de comercios activos. No permite por si sola modificar planes ni leer la tabla de pagos.
- Accion: retirar lectura publica de columnas administrativas mediante permisos por columna o una proyeccion publica dedicada; revisar consultas actuales antes del cambio para preservar catalogo, checkout y suscripcion.

## 3. Segundo factor sin exigencia en admin - confirmado en codigo

- `src/lib/admin/access.ts:5` exige usuario autorizado/founder, pero no nivel AAL2.
- `src/lib/panel/auth.ts` obtiene claims firmados y confia en correo founder; no verifica AAL. `src/app/api/auth/panel-session/route.ts` crea cookie desde un access token valido sin exigir MFA. `src/lib/server/panel-session-store.ts` utiliza RPCs v1 sin AAL.
- Existe `20260916203000_panel_session_aal_rpc_v2.sql`, pero el servidor actual no usa esas funciones. Produccion tiene un factor MFA verificado; ese dato NO significa que el admin lo exija ni identifica aqui a su titular.
- Impacto: las guardias actuales admiten una sesion valida AAL1 del fundador. Activar un factor sin exigirlo en APIs y cookies no protege las operaciones administrativas frente a credenciales comprometidas.
- Accion: exigir AAL2 para founder, persistir y verificar el nivel en cookies, y preparar enrolamiento/recuperacion antes de activarlo para evitar bloquear al administrador.
- No se intento iniciar sesion en ninguna cuenta real ni omitir su segundo factor durante la auditoria.

## 4. Endurecimiento de autenticacion y abuso - siguiente prioridad

- Auth produccion permite alta directa (`disable_signup=false`), email/password habilitado, confirmacion de correo obligatoria, minimo de seis caracteres y CAPTCHA desactivado. La app guarda solicitudes pendientes, pero eso no impide crear una identidad Auth directamente por la API de Supabase.
- Crear esa identidad no concede tienda ni permisos: `store_users` y aprobacion administrativa siguen protegiendo el panel. No confundir identidad Auth con comercio aprobado. No cerrar todos los registros indiscriminadamente porque el flujo Google de compradores tambien debe seguir funcionando.
- Reautenticacion para cambiar password esta desactivada. Se recomienda elevar politica de claves, revisar proteccion antiabuso y exigir reautenticacion para acciones sensibles.
- `src/app/api/auth/panel-session/route.ts` carece de limite propio y crea una fila por token valido. Los limites distribuidos de otros endpoints caen a memoria por instancia si DB falla (`src/lib/server/rate-limit.ts`). Revisar abuso y observabilidad, especialmente registro, captura y pedidos anonimos.
- CSP productiva incluye `script-src 'unsafe-inline'`. No se detecto un sink HTML ejecutable en la busqueda revisada; nonce/hash seria defensa adicional, no prueba de XSS existente.

## Verificaciones satisfactorias

- 46 rutas GET privadas en produccion: 45 respuestas 401 y auth-check 404 intencional; ninguna devolvio datos operativos.
- 18 comprobaciones adicionales de rutas/methods sensibles sin credenciales: 401 (admin, pedidos, pago, suscripcion, Cocina, configuracion, uploads, impresion, webhooks y cron). Cookie de founder falsificada: 401.
- REST directo anonimo rechazo ocho tablas sensibles: orders, customers, store_users, order_items, order_payment_receipts, store_subscription_payments, print_agent_devices, order_kitchen_tickets.
- Metadatos: ninguna tabla public/private legible por anon/authenticated sin RLS; ninguna vista publica legible. Funciones SECURITY DEFINER operativas cerradas; unica funcion accesible encontrada es autorizacion de Realtime en esquema privado para authenticated, con search_path cerrado.
- Buckets payment-receipts y commerce-registration-assets privados, sin policy de lectura publica. Los buckets publicos son imagenes y APK.
- Revision de pedidos: precios/opciones/delivery/fee calculados en servidor; el cliente no fija payment_status=verified. Operaciones de pago consultan propiedad del pedido. Impresion vincula token revocable hasheado a store_id.
- Escaneo de archivos versionados: sin coincidencias de secretos privados reconocidos, service-role JWT ni archivos env/keystore versionados. 83 archivos locales de bundle publico sin coincidencias literales con los secretos disponibles del entorno. No equivale a escaneo de todos los chunks desplegados ni de todo el historial Git.
- El scanner documental marco un contador tecnico en el handoff como posible clave; no es evidencia de credencial. Auditoria anterior deja rotacion historica pendiente, sin confirmar aqui si esas claves siguen vigentes; no se probaron.
- 86/86 contratos criticos locales aprobados. Son pruebas funcionales/contratos y no contradicen los hallazgos anteriores.
- Cabeceras reales: CSP, HSTS, DENY y nosniff presentes.

## Alcance y siguiente paso

No hubo cambios de codigo de aplicacion, migraciones, modificaciones de pedidos/usuarios, despliegue ni commit. Las peticiones negativas pueden generar registros y contadores normales del servicio. Solo se guardo este informe y continuidad; herramientas temporales en tmp ignorado.

No se ejecutaron cargas destructivas, explotacion RCE, pruebas de penetracion exhaustivas con cuentas autenticadas cruzadas, revision completa del APK, escaneo integral del historial Git ni investigacion forense. No se puede afirmar seguridad al 100% ni ausencia historica de intrusion.

Build no ejecutado: no se modifico codigo ni dependencias. No hay SQL aplicado ni pendiente de ejecutar por el usuario como parte de esta auditoria.

Siguiente intervencion: parche Next/colores y cierre de columnas administrativas en Preview/staging; pruebas de catalogo, carrito, checkout, OG, panel y privilegios; promocion controlada del parche. Despues MFA real para admin y autenticacion/abuso. Mantener el checkpoint anterior para comparar, no usar un rollback a otra version vulnerable como correccion de seguridad.
