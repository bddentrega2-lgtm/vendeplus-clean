# 2026-09-16 - Hotfix OAuth: login Google espera sesion de panel

- Usuario reporto que Google en produccion seguia quedando cargando y solo entraba al actualizar manualmente.
- Diagnostico por logs y comportamiento: `/api/auth/panel-session` y `/api/panel/context` ya respondian 200, por lo que la sesion se creaba; el problema era de timing/navegacion cliente en `/panel/login`.
- `LoginForm` ahora, al volver de Google, completa la sesion Supabase/servidor y espera con polling corto a que `/api/panel/context` confirme la cookie HttpOnly antes de redirigir al panel. Tambien evita cache en esa comprobacion.
- Validaciones locales: `npm.cmd run test:critical` OK 77/77, `git diff --check` OK y `npm.cmd run build` OK con 218 paginas.
- Pendiente inmediato: commit, push, despliegue productivo y smoke publico. Prueba del usuario: iniciar sesion con Google desde `/panel/login`; ya no debe quedarse cargando ni requerir actualizar.

# 2026-09-16 - Remediacion P1 sesiones panel revocables

- Se avanzo la prioridad alta de seguridad: la cookie HttpOnly del panel ya no autoriza por si sola en APIs de panel/transporte.
- Cambios locales sin despliegue: `src/lib/server/panel-session-cookie.ts`, `src/lib/server/panel-session-store.ts`, `src/app/api/auth/panel-session/route.ts`, `src/lib/panel/auth.ts`, `src/lib/transport/access.ts`, `src/components/panel/UpdatePasswordForm.tsx`, `scripts/critical-contracts.test.mjs`, `docs/audits/2026-09-16-security.md`, `docs/audits/2026-09-16-security-reproduction.cjs`.
- Migracion nueva pendiente de aplicar antes de publicar: `supabase/migrations/20260916170000_panel_server_sessions.sql`.
- La migracion crea `private.panel_sessions` con RLS y RPCs `create_panel_session`, `get_panel_session`, `revoke_panel_session` solo para `service_role`.
- Al iniciar sesion se crea registro revocable y la cookie guarda `sid + secret`; al usar cookie, panel/transporte consultan `get_panel_session`; al cerrar sesion o cambiar clave se revoca el registro y se borra la cookie.
- Validaciones realizadas: `npm.cmd run test:critical` OK 75/75; `npm.cmd run build` OK, TypeScript y 218 paginas; `node docs/audits/2026-09-16-security-reproduction.cjs` marca `REMEDIATED session` y mantiene confirmados los P2 pendientes.
- Pendiente: ejecutar/aplicar migracion en Supabase del entorno objetivo antes del deploy web; luego desplegar y hacer smoke de login/logout/cambio de clave en comercio y transporte. No hubo commit, push ni despliegue en esta remediacion.

# 2026-09-16 - Remediacion P2/P3 auditoria seguridad

- Se corrigio recuperacion de cuentas huerfanas en registro comercio y transporte: si el correo ya existe, se exige OAuth validado y que `existingUser.id === oauthUser.id`; sin prueba de identidad devuelve conflicto. El fallback de comercio tras `signUp` solo recupera usuarios creados en la misma ventana breve de solicitud.
- Se corrigio redireccion externa post-login/OAuth: nuevo `src/lib/panel/safe-redirect.ts`; `LoginForm` y `client-auth` ya usan `safeInternalPanelPath`.
- Se corrigio exposicion de errores internos en panel: `panelErrorResponse` solo devuelve `PanelAccessError` o mensajes de negocio permitidos; errores desconocidos usan fallback generico.
- Validaciones finales tras P2/P3: `node docs/audits/2026-09-16-security-reproduction.cjs` OK con cuatro `REMEDIATED`; `npm.cmd run test:critical` OK 77/77; `npm.cmd run build` OK, TypeScript y 218 paginas.
- Migracion `20260916170000_panel_server_sessions.sql` aplicada en Supabase remoto con `supabase.cmd db push --include-all` y verificada en `supabase.cmd migration list`.
- Preview READY: `https://vendeplus-clean-1rt6p6171-entrega2-s-projects.vercel.app`, deployment `dpl_79kR1FuCa13tXnrcP9cBoPA6zY2G`, inspector `https://vercel.com/entrega2-s-projects/vendeplus-clean/79kR1FuCa13tXnrcP9cBoPA6zY2G`.
- Smoke anonimo por fetch devuelve 302 a Vercel SSO en todas las rutas, por proteccion del preview; probar desde navegador con acceso Vercel o usar produccion cuando se promueva.
- Usuario reporto login admin fallando con `column reference "expires_at" is ambiguous`; se corrigio `get_panel_session` usando `return query update private.panel_sessions as ps ... returning ps.*` y se aplico la funcion remota con `supabase.cmd db query --linked --file`.
- Smoke SQL remoto de `create_panel_session` + `get_panel_session` + `revoke_panel_session` OK.
- Preview corregido READY: `https://vendeplus-clean-r6yz3l1fh-entrega2-s-projects.vercel.app`, deployment `dpl_Hh5AKpJMa8RXazJDbApHNGPHdtBm`, inspector `https://vercel.com/entrega2-s-projects/vendeplus-clean/Hh5AKpJMa8RXazJDbApHNGPHdtBm`.
- Cambios asegurados en GitHub: commit `5f605d2` (`Fortalece sesiones y registros del panel`) en `checkpoint/ajustes-delivery-shibui-20260915`.
- Usuario reporto que Google login en produccion quedaba cargando; produccion seguia en deployment previo `dpl_EZhyWMMGfptR4ZoyxExFHBC5nSi5`.
- Usuario autorizo pasar preview asegurado a produccion. Deployment productivo READY: `dpl_75frXYoTv2mSuyRNJbFS8uuPpWhF`, artefacto `https://vendeplus-clean-rcwxn5met-entrega2-s-projects.vercel.app`, alias `https://www.somos-ve.com`.
- Smoke productivo anonimo post deploy: `/`, `/panel/login`, `/registro`, `/transporte/panel`, `/transporte/registro` => 200; `/api/admin/summary`, `/api/panel/stats`, `/api/transport/me` => 401. Logs Vercel ultimos 10 min sin errores, solo smoke esperado.
- Pendiente: usuario prueba login Google admin en produccion, login delivery, logout y registro con Google. Si OK, no queda trabajo inmediato salvo monitoreo.
- Usuario reporto que Google seguia colgado. Logs mostraron `POST /api/auth/panel-session` 200 seguido de `GET /api/panel/context` 401.
- Diagnostico aplicado: posible presencia de multiples cookies `somos_panel_session` (legacy + nueva); backend leia solo la primera. Hotfix `afd1d61` lee todas las cookies con ese nombre y usa la primera valida con `sid + secret`; tambien fuerza `window.location.assign(data.url)` si Supabase OAuth devuelve URL.
- Validaciones hotfix: reproduccion auditoria OK con 4 `REMEDIATED`; `npm.cmd run test:critical` OK 77/77; `npm.cmd run build` OK 218 paginas; `git diff --check` OK.
- Hotfix asegurado en GitHub: commit `afd1d61` (`Corrige lectura de sesion OAuth`) en `checkpoint/ajustes-delivery-shibui-20260915`.
- Produccion hotfix READY: `dpl_Euey9DnjzxscPmexw7mx6jpiG6fW`, artefacto `https://vendeplus-clean-bjpatcfri-entrega2-s-projects.vercel.app`, alias `https://www.somos-ve.com`.
- Smoke productivo anonimo hotfix: `/` 200, `/panel/login` 200, `/api/admin/summary` 401, `/api/panel/stats` 401, `/api/transport/me` 401; logs recientes sin errores.

# 2026-09-16 - Auditoria de seguridad actual

- Base 5395625, worktree vendeplus-login-stability-fix. Solo auditoria, sin cambios a producto, datos, SQL, despliegue, commit o push.
- Informe: docs/audits/2026-09-16-security.md. Reproducciones offline: node docs/audits/2026-09-16-security-reproduction.cjs.
- Hallazgos: P1 cookie sin revocacion individual y no borrada al cambiar clave; P2 recuperacion de cuentas huerfanas sin autenticar en ambos registros; P2 next permite redireccion externa con barra invertida; P3 errores internos expuestos en panelErrorResponse.
- npm audit: 0; escaneo documental: 0; criticos: 75/75; cinco APIs privadas de produccion devuelven 401 sin sesion. No se verificaron grants/configuracion efectiva de Supabase ni rotacion del secreto OAuth expuesto previamente.
- Build final OK, TypeScript y 218 paginas. Reproducciones offline de ambos registros, cookie y redireccion confirmadas.
- Siguiente paso: corregir hallazgos con pruebas aisladas, empezando por ciclo de sesion y recuperacion de cuentas; verificar configuracion remota mediante acceso administrativo de lectura. No asumir que la auditoria implica correccion o despliegue.

# 2026-09-15 - Google OAuth adelantado para paneles

- Se preparo el acceso con Google para cuentas ya existentes/vinculadas en panel comercio y panel empresa delivery, sin reemplazar correo/clave.
- Archivos tocados: `src/lib/panel/client-auth.ts`, `src/components/panel/LoginForm.tsx`, `src/components/transport/TransportAgencyPanel.tsx`.
- `client-auth` ahora inicia OAuth con Google y completa el retorno con `exchangeCodeForSession`, guarda token Supabase y sincroniza cookie privada `/api/auth/panel-session`.
- Panel comercio: boton `Continuar con Google` en `/panel/login`; al volver desde Google respeta `next` seguro.
- Panel delivery: boton `Continuar con Google` en `/transporte/panel`; al volver desde Google carga la empresa vinculada al email aprobado. Tambien se corrigio que `load()` use `accessToken` explicito cuando se acaba de obtener.
- Validaciones locales: `npm.cmd run test:critical` OK 75/75, `git diff --check` OK, `npm.cmd run build` OK 218 paginas.
- Sin migracion ni SQL. No se desplego ni se hizo commit/push en esta retoma.
- Pendiente para que funcione realmente: habilitar Google Provider en Supabase y configurar OAuth en Google Cloud. Redirects de app que deben estar permitidos: `https://www.somos-ve.com/panel/login` y `https://www.somos-ve.com/transporte/panel` (mas preview/local si se va a probar antes). Callback Google hacia Supabase: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Registro con Google queda para fase 2: adaptar `/api/signup` y `/api/transport/agencies/apply` para aceptar un usuario OAuth ya autenticado sin duplicar emails ni saltarse aprobacion/tenant.

# 2026-09-15 - Asegurados ajustes de particulares delivery, comprobantes e inventario SHIBUI

- Trabajo actual en `vendeplus-login-stability-fix`. No hubo commit ni push.
- Supabase produccion `rvmtjtuztewcrmodrodb`: aplicadas previamente por SQL manual y ahora registradas en historial remoto con `supabase migration repair --linked --status applied`:
  - `20260914154500_inventory_remove_missing_skus`
  - `20260915120000_transport_particular_payment_receipts`
- `supabase migration list` queda alineado: ambas versiones aparecen local y remoto.
- SHIBUI: el guardado de inventario fue validado por el usuario y funciona. Se ajusto `panelErrorResponse` para que futuros errores de panel muestren el mensaje real en vez de ocultarse detras del fallback generico.
- Delivery particulares Entrega2: matriz QA previa OK para `Yo envio`, `Yo recibo`, `Viajo yo`, `Viaja otro`, captura/referencia opcional u obligatoria. Se limpio la data QA y se dejo Entrega2 con captura obligatoria.
- Build local final: `npm.cmd run build` OK, 214 paginas.
- Preview Vercel READY:
  - Deployment: `dpl_CwMQVgHGB95eXMiwHEo4ji45LbEK`
  - URL: `https://vendeplus-clean-3h0fsifrx-entrega2-s-projects.vercel.app`
  - Inspector: `https://vercel.com/entrega2-s-projects/vendeplus-clean/CwMQVgHGB95eXMiwHEo4ji45LbEK`
- Smoke preview:
  - `GET /`, `/shibui`, `/panel/productos`, `/transporte/entrega2/particulares`, `/transporte/panel`: 200
  - `POST /api/transport/particulares/entrega2` sin payload valido: 401, no crea solicitud
  - APIs privadas GET sin sesion devuelven 302 por proxy hacia login, comportamiento actual del proyecto.
- Pendiente si el usuario autoriza produccion: promover/desplegar este artefacto o ejecutar `vercel deploy --prod` desde este worktree y repetir smoke productivo. No promover automaticamente sin confirmacion.
- Usuario autorizo produccion. Deployment productivo READY:
  - `dpl_DqoKov7mYEBe9g3i45hnrVm8LZ4k`
  - Artefacto: `https://vendeplus-clean-6ctj61mcs-entrega2-s-projects.vercel.app`
  - Alias aplicado: `https://www.somos-ve.com`
- Smoke productivo:
  - `www.somos-ve.com`: `/`, `/shibui`, `/panel/productos`, `/transporte/entrega2/particulares`, `/transporte/panel` OK.
  - APIs privadas sin sesion: 401 esperado en dominio oficial.
  - POST vacio a `/api/transport/particulares/entrega2`: 400 esperado, sin crear solicitud.
  - Logs Vercel ultimos 10 min: sin errores; solo info. El 400 observado corresponde al POST vacio de smoke.

# 2026-09-12 - Produccion: productos sin descripcion quedan en blanco

- Usuario reporto que SHIBUI seguia mostrando `Producto disponible para pedir desde Somos.` en productos sin descripcion.
- Diagnostico: los productos afectados (`Traje de Bano Triangulo Tornasol`, `Traje de Bano Gaby`, `Traje de Bano Veru`) tienen `description = null` en Supabase; el texto venia del fallback de codigo en `.security-billing-release`, no de la base de datos.
- Cambio: `src/lib/supabase/catalog.ts` ahora mapea `description: String(product.description || "").trim()` y deja blanco real cuando no hay descripcion. Se agrego contrato en `scripts/critical-contracts.test.mjs` para impedir que vuelva el texto generico.
- Validaciones locales en `.security-billing-release`: busqueda `rg` sin el texto en codigo funcional; contrato focal OK; `npm.cmd run build` OK, Next 16.3.4, 203 paginas.
- Despliegue productivo directo Vercel Ready: `dpl_5DcTea3P3kweNxDSECjabrEsKThp`, URL `https://vendeplus-clean-l2xk2jjby-entrega2-s-projects.vercel.app`; alias `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y alias de proyecto confirmados.
- Smoke productivo: `https://www.somos-ve.com/shibui` HTTP 200, contiene productos SHIBUI revisados y ya no contiene `Producto disponible para pedir desde Somos.`. Logs error del deployment: sin resultados.
- No hubo migracion ni SQL. No hubo commit/push.

# 2026-09-12 - SAM Venezuela: catalogo importado y verificado

- Retomado desde el handoff anterior. El estado remoto ya mostraba la importacion aplicada: `sam-maracay` tiene 17 categorias y 152 productos.
- Decision aplicada para el conflicto pendiente: se conserva el producto existente `Kit de Sushi con Surimi` a USD 30 y se omite `SAM-121 Kit para sushi` usando `--skip-conflicts`; no se duplico ni se cambio el precio del existente.
- Verificacion remota: 133 productos activos y 19 inactivos. Los productos sin precio `BEBIDA` y `Sesamo blanco 125gr` existen con precio 0 e inactivos; tampoco aparecen en el HTML publico.
- Storage verificado: 104 objetos bajo `product-images/78f9a439-223a-4f97-ab48-7c2234b38da6/sam-import`, sin error de listado.
- Catalogo publico verificado: `https://www.somos-ve.com/sam-maracay` responde 200, contiene `Sam Venezuela` y productos importados como `Caja Sorpresa`; no contiene `BEBIDA` ni `Sesamo blanco 125gr`.
- No hubo cambios de codigo adicionales, migraciones, SQL manual, despliegue web, commit ni push. El importador y archivos fuente quedan en el worktree como soporte de auditoria/idempotencia.
- Validaciones finales en `.security-billing-release`: `node --check scripts/import-sam-catalog.mjs` OK; `npx.cmd eslint scripts/import-sam-catalog.mjs` OK; `npm.cmd run test:critical` OK, 69/69; `npm.cmd run build` OK con variables cargadas solo en el proceso, Next 16.3.4, 203 paginas.
- Siguiente paso: revisar visualmente SAM en telefono con el cliente/comercio y completar manualmente precios si SAM decide vender `BEBIDA` o `Sesamo blanco 125gr`; no hace falta desplegar web para esta carga.

# 2026-09-11 - SAM Venezuela: importador y dry-run listos, NO aplicado

- Usuario pidió primero dry-run y confirmó: conservar cualquier duplicado ya cargado, usar la alternativa sencilla sin migración y crear `BEBIDA`/`Sesamo blanco 125gr` inactivos para que no se muestren.
- Trabajar exclusivamente desde `.security-billing-release`; la raíz principal tiene muchos cambios ajenos. Producción no fue modificada.
- Comercio real verificado por lectura: `Sam Venezuela`, slug `sam-maracay`, id `78f9a439-223a-4f97-ab48-7c2234b38da6`, activo; estado remoto intacto: 7 categorías y 28 productos.
- ZIP: 138 filas, 14 categorías, 138 URLs distintas y 20 grupos de nombres repetidos. El CSV/JSON no incluían descripciones; se consultaron las 138 páginas públicas. Se conservaron 71 descripciones específicas y se descartó como ausente el texto SEO genérico repetido en 67 fichas.
- Python no está instalado. Se aplicó el fallback previsto con Node: 138/138 imágenes 800 px descargadas, WebP válidos, cero vacías/corruptas/fallidas; 114 binarios únicos. Temporales ignorados en `tmp/imports/sam-20260911`.
- Agregados `scripts/import-sam-catalog.mjs`, `scripts/catalogs/sam/productos.csv` y `scripts/catalogs/sam/descriptions.json`. El importador es dry-run por defecto, restringe el store por id+slug, usa UUID deterministas por URL para lo nuevo, rutas Storage por hash, no sobrescribe existentes y exige tres confirmaciones para escribir remoto. Sin migración.
- Dry-run: 10 categorías nuevas, 4 reutilizadas; 124 productos nuevos propuestos; 13 filas fuente se preservan como productos/opciones existentes; 1 conflicto pendiente (`SAM-121 Kit para sushi` $25 frente a `Kit de Sushi con Surimi` $30); 2 nuevos sin precio quedarían a 0 e inactivos; 104 imágenes únicas necesarias para los productos nuevos; no hay stock cuantitativo en la fuente.
- Se probó `--apply` sin confirmaciones: bloqueo correcto antes de escribir. Lectura posterior: 7 categorías, 28 productos y 0 objetos en `product-images/<store>/sam-import`.
- Validaciones: sintaxis Node OK, ESLint focal OK y dry-run remoto OK. Primer `npm.cmd run build` compiló/TypeScript pero falló en prerender por ausencia intencional de env en el worktree; repetido como `npm.cmd run build` hijo con variables solo en proceso: Next 16.3.4, 195 páginas, OK.
- Siguiente paso exacto: usuario revisa/aprueba el dry-run y decide si `SAM-121` debe omitirse conservando el kit actual o importarse como producto distinto. Solo después ejecutar la carga remota; luego verificar DB/Storage y catálogo móvil. No desplegar web: el importador no requiere cambios de aplicación.

# 2026-09-10 - Preview UX guiada SHIBUI + gestion de stock simulada, NO produccion

- Usuario rechazo el selector unico de SKU de produccion y pidio volver a la experiencia aprobada: primero color, luego tallas disponibles y cantidad. Aclaro expresamente no tocar produccion.
- `src/components/public/ProductCard.tsx`: reemplaza el selector tecnico por botones guiados `1. Elige el color` y `2. Elige la talla`, muestra disponibilidad por color/talla, espera el color antes de revelar tallas, incorpora cantidad limitada por stock y multiplica correctamente `quantity` e `inventorySelections`. Casos sin color/talla muestran una opcion simple. Soporta presentaciones de varias piezas sin reservar mas stock del disponible.
- Gestion propuesta: se entra desde cada producto, pero el stock vive por combinacion. El prototipo `ShibuiInventoryPrototype.tsx` agrega pestanas `Vista del cliente` / `Gestionar stock`; muestra stock total por producto, ajustes locales `- / +` por combinacion y alta simulada de color+talla. No llama APIs ni Supabase y no guarda cambios.
- Preview Ready, NO promovido: `dpl_xuaLhgDWFsB5dcR7Vejsp81wAaSK`, `https://vendeplus-clean-9xoryfhfp-entrega2-s-projects.vercel.app`. Cliente real: `/shibui`; simulador de gestion: `/prototipos/shibui-inventario`.
- QA: inventario 8/8, prototipo 7/7, criticos 69/69, TypeScript, ESLint completo, `git diff --check`, build local 86 rutas y build Vercel 202 paginas OK. Logs Preview sin errores.
- Prueba movil local con catalogo real: Corset muestra Beige(2), espera color, luego S(1)/M(1), agrega Beige-S al carrito. Body Raven Gris-S permite cantidad maxima 4; cantidad 2 queda guardada como item 2 e inventario 2. Gestion simulada: Corset total2 ->3 con `+`; nueva Negro-L=2 -> total5. Cero errores JS y ningun pedido/API de escritura.
- Produccion sigue en `dpl_69kgyrK3qW9Yk9mf31twQtkimUq8` con el selector anterior. No hubo SQL, cambios de datos, deploy productivo, commit ni push en esta iteracion.
- Siguiente paso: usuario prueba ambos enlaces Preview. Si aprueba UX, implementar endpoint autenticado para ajustes reales de stock (tenant + manager + RPC atomico + auditoria), validarlo aislado y publicar solo con autorizacion expresa.

# 2026-09-10 - PRODUCCION: inventario basico exclusivo SHIBUI y catalogo importado

- Usuario autorizo avanzar despues de validar staging. Granja Mila permanecio totalmente fuera del alcance.
- Respaldo previo local: `../tmp/checkpoints/2026-09-10-shibui-pre-inventory-production.json`; SHA256 `90FB282491650E462C0E864894A8E8BCF8C098AD00E2545953CCED86373C840E`; contiene 4 productos, 1 categoria, 11 variantes y 8 imagenes de galeria previas.
- Dry-run remoto mostro exclusivamente `20260910220000_opt_in_basic_inventory.sql` y `20260910221000_inventory_stock_import_rpc.sql`; ambas se aplicaron correctamente a produccion `rvmtjtuztewcrmodrodb`. Dry-run posterior: remoto al dia.
- Inventario continua apagado por defecto y solo SHIBUI (`126f8168-f1ca-4a08-8eaf-c3816b9d9195` + slug `shibui`) esta habilitado. RLS activo en las 4 tablas; `anon` no ejecuta importacion.
- Importacion productiva: 23 productos nuevos + 3 enlazados (Dakota, Destiny, Infinity), 332 SKU y 458 unidades. Total SHIBUI: 27 productos y 6 categorias, porque Emely existente se preservo. Set Nikki omitido sin precio; Body Barbara sin imagen; Dakota conserva USD 16. Segunda ejecucion: 0 productos nuevos y siguen 332 movimientos, confirmando idempotencia.
- Preview validado `dpl_5entrgP5W494k2aSeU7YUpuXW4FE`. Produccion Ready `dpl_69kgyrK3qW9Yk9mf31twQtkimUq8`, URL de artefacto `https://vendeplus-clean-hkob95644-entrega2-s-projects.vercel.app`; alias `www.somos-ve.com`, `somos-ve.com`, `vendeplus-clean.vercel.app` confirmados.
- QA productivo: home, Marketplace, SHIBUI, carrito, checkout, Smash y login 200; APIs privadas panel/transporte 401 sin sesion. Prueba movil automatizada abrio Corset de Gamuza, mostro `Beige - S/M` con 1 disponible, permitio seleccionar y agregar al carrito; sin crear pedido y sin errores JS. Logs Vercel sin errores. Suite previa: inventario 8/8, criticos 69/69, puente 5/5, facturacion 9/9, TS/ESLint/build/DB lint OK.
- Rollback web anterior: `dpl_7E3AaLH429ZeP4vZyp6CWU15jiHV`. En emergencia funcional de SHIBUI, primero deshabilitar solo su fila en `store_inventory_settings`; no borrar tablas ni productos automaticamente. Restauracion de catalogo debe usar el respaldo y revisar si ya existen pedidos posteriores.
- No hubo commit ni push. Siguiente paso: usuario prueba desde telefono un producto simple (Corset) y luego uno de varias piezas; puede llegar hasta carrito sin enviar un pedido real. Revisar Body Barbara/Set Nikki antes de completarlos manualmente.

# 2026-09-10 - SHIBUI inventario opt-in validado en staging aislado, NO produccion

- Usuario autorizo avanzar despues de aprobar el prototipo visual. Se mantuvo la regla: inventario apagado por defecto y habilitado exclusivamente para SHIBUI mediante ID `126f8168-f1ca-4a08-8eaf-c3816b9d9195` + slug `shibui`; otros comercios conservan su comportamiento actual.
- Produccion `rvmtjtuztewcrmodrodb` NO fue modificada. No hubo deploy, migracion productiva, commit ni push.
- Rama Supabase aislada vigente: `shibui-inventory-staging-v2`, branch id `527921ed-2cd9-4398-b9bd-c9435364f1c7`, project ref `nmuypksuaxwyonilzoqs`, sin datos productivos. No guardar ni mostrar sus credenciales. Una primera rama vacia fallo por falta de esquema base y fue eliminada; sus credenciales quedaron invalidadas.
- Migraciones nuevas preparadas: `20260910220000_opt_in_basic_inventory.sql` (tablas/RLS, descuento atomico, reposicion al cancelar, bloqueo de reapertura) y `20260910221000_inventory_stock_import_rpc.sql` (carga de stock transaccional, solo service role, diferencias auditadas).
- Importador nuevo `scripts/import-shibui-catalog.mjs`, dry-run por defecto y escritura solo con doble confirmacion de slug y project ref. Protege ID/slug de SHIBUI, rechaza precios vacios y stock incoherente, conserva precios existentes, evita nombres ambiguos, sube imagenes idempotentes y usa el RPC de inventario.
- Resultado real en staging: 26 productos importables; 23 nuevos + 3 enlazados con Dakota/Destiny/Infinity existentes; 332 SKU; 458 unidades; 22 imagenes nuevas. `Set Nikki` omitido por precio faltante. `Body Barbara` queda sin imagen. Dakota conserva USD 16 frente a USD 18 de la fuente. Emely existente no se modifica.
- La importacion se ejecuto dos veces: segunda pasada creo 0 productos nuevos y mantuvo exactamente 332 SKU, 458 unidades y 332 movimientos; idempotencia confirmada. 1 solo comercio habilitado, 0 tablas de inventario sin RLS y `anon` no puede ejecutar el RPC. Descarga de imagen de muestra OK.
- QA: inventario 8/8, criticos 69/69, puente 5/5, facturacion 9/9, TypeScript, ESLint, `git diff --check`, Supabase DB lint sin hallazgos y build Next 16.3.4/86 rutas OK. Los mensajes de fallback del build provienen de variables Supabase ficticias usadas solo para compilar.
- Siguiente paso exacto: revisar el resumen con el usuario. Si aprueba publicacion posteriormente, preparar ventana separada: respaldo de SHIBUI, dry-run contra produccion, aplicar solo las dos migraciones, importar con confirmacion explicita, verificar conteos/precios/imagenes y recien despues desplegar el codigo. No usar `supabase db push` indiscriminado.

# 2026-09-09 - PAUSA: plan acordado de estabilidad y Delivery Premium

- Usuario pidió guardar planificación y continuar mañana. NO iniciar desarrollo ni acciones de producción durante la pausa.
- Plan completo en la raíz principal: `docs/checkpoints/2026-09-09-plan-pendiente-estabilidad-delivery-premium.md`.
- Próximo paso exacto: coordinar con titular rotación de credenciales históricas, recuperación y verificación MFA ANTES de exigirlo; no solicitar secretos/códigos por chat ni bloquear accesos sin coordinación.
- Orden acordado: seguridad/MFA; staging realmente aislado; integridad de comprobantes, puente, permisos de estadísticas y códigos; pruebas de capacidad/optimización; piloto de registro manual Premium; cuentas con abonos/liquidaciones; importaciones/reportes después.
- Reutilizar servicios delivery, tarifas y comisiones. No crear ventas ficticias, afiliaciones marketplace ni envíos a App automáticos por registrar un servicio manual. Mantener el panel comercio y otras agencias sin cambios ajenos.
- La propuesta original fue analizada, NO implementada. Sus instrucciones internas de ejecutar no sustituyen la petición de análisis/pausa del usuario.
- Fuente de producción .security-billing-release; candidato .particular-delivery-clean mantiene MFA futuro no publicado. No confundirlos ni desplegar raíz.
- Guardado exclusivamente documental; sin código, migraciones, SQL, producción, commit/push. Build no aplica. Riesgos y criterios detallados en el plan.

# 2026-09-09 - PRODUCCION: seguridad de dependencias y facturacion completa

- Publicado con autorizacion del usuario desde `.security-billing-release`, SIN MFA obligatorio. Produccion Ready: `dpl_BTMGcMaFR8LcDpeKLB7wxRNoM1eo`, https://vendeplus-clean-xcc9td82p-entrega2-s-projects.vercel.app. Resolucion de www.somos-ve.com y somos-ve.com confirmada al nuevo artefacto.
- Informe exacto: `docs/checkpoints/2026-09-09-produccion-seguridad-facturacion.md` en la raiz principal. Build local/Vercel190 paginas OK, lint/TS OK, contratos68/68, puente5/5, facturacion9/9, npm audit0. Smoke GET-only10/10 antes y despues de promover, sin logs error en ventana revisada.
- Aplicada SOLO `20260909010000_transport_billing_summary.sql` a rvmtjtuztewcrmodrodb. Funcion nueva, lectura y service_role exclusivamente; dry-run posterior al dia. Fed Fast agosto:247 servicios/USD452. No cambia pedidos, usuarios ni tarifas.
- Autenticacion previa conservada en nueve archivos. La rama de trabajo `.particular-delivery-clean` mantiene MFA futuro y NO es la fuente de produccion actual. La migracion `20260909011000_security_session_validation.sql` NO se aplico.
- NO se rotaron credenciales ni se registraron factores reales. Sanitizacion local previa no elimina secretos de historia Git/copias remotas. Pendiente coordinar titular, rotacion y recuperacion ANTES de activar MFA. No probar claves historicas.
- No hubo commit/push ni ordenes/envios reales de prueba. La raiz contiene impresion y cambios ajenos: NO desplegarla. Script de snapshot NO debe repetirse sobre release final porque sobrescribe ajustes CI/pruebas.
- Rollback funcional anterior: dpl_7oPyS4b2SQYvGXK8kFFPQvGmo9MY; reintroduce dependencias vulnerables, solo emergencia. Funcion SQL aditiva puede permanecer.
- Siguiente paso exacto: titular valida ingreso habitual, factura Fed Fast agosto y cambio de agencia; luego coordinar cierre de credenciales/MFA. E2E autenticado con pedidos reales no realizado. Otros P1 de auditoria siguen pendientes.

# 2026-09-09 - Parche preparado: seguridad y facturación, aún sin publicar

- Leer `../docs/audits/2026-09-09-correcciones-seguridad-facturacion.md`. Usuario autorizó tres correcciones; NO publicar ni aplicar SQL implícitamente. No commit/push. Preservar los cambios previos de comprobantes/tarjetas/particulares.
- Next/eslint-config-next16.3.4, sharp0.35.4/libheif1.23.2, transitivas actualizadas: audit0. node_modules propio; junction anterior retirado sin modificar destino compartido. Último build con configuración correcta:192 páginas (anterior196, depende de catálogos precargados); fallos iniciales por variable privada ausente documentados.
- Se retiraron22 apariciones de posibles contraseñas en14 documentos de continuidad locales. Valores antiguos pueden permanecer en Git/copies; NO rotación ni limpieza de historia ni MFA real efectuados. No volver a guardar secretos aquí. Titular debe cambiar contraseña y verificar autenticador; definir recuperación antes de activar obligación.
- `/cuenta/seguridad` y bootstrap `/api/account/security`; MFA obligatorio fundador y owner/admin delivery, además de cuentas con factor verificado. Guardas server-side requieren aal2 y sesión vigente para protegidos. Comercio normal sin factor conserva acceso. UI móvil probada con respuestas simuladas y conexiones externas bloqueadas.
- Facturación usa `transport_billing_summary` completo; detalle paginado con conteo exacto, scope de agencia, cancelaciones y sin duplicar registros legacy/transporte en comercio. Detalle máximo20.000 rechaza sin subtotal, resumen SQL no se recorta.
- SQL nuevo PENDIENTE: `20260909010000_transport_billing_summary.sql`, `20260909011000_security_session_validation.sql`. Aplicación debe preceder al nuevo código. No ejecutar push indiscriminado; Preview usa servicios reales.
- Validaciones:68 contratos,5 puente,13 nuevas pruebas; SQL PostgreSQL temporal201/1001/10000 y permisos/sesiones; lint/TS; imágenes actualizadas. CI reforzado. Herramienta browser integrada no disponible; fallback automatizado local, cero altas reales de Auth.
- Siguiente paso: titular+ventana de rotación/recuperación/MFA, revisión y autorización de migraciones/despliegue. Si coordinación demora, separar parche P0 de dependencias. Producción aún sin estas correcciones, restantesP1 fuera del alcance continúan abiertos.
- Limpieza final: servidor QA3155 detenido, `../tmp/security-build.env` eliminado, configuración original intacta. No hay Preview nuevo publicado ni SQL aplicado; las altas de MFA fueron simuladas.

# Estado anterior: auditoría general posterior, con P0/P1 abiertos

Leer `../docs/audits/2026-09-08-ecosistema-seguridad-escalabilidad.md` y la sección final de auditoría. Las publicaciones anteriores no implican ausencia de riesgos. Próximo paso: parche de seguridad autorizado; producción sin cambios durante la auditoría.

# 2026-09-08 - Produccion tarjeta Delivery simplificada y compatibilidad China Town

- Usuario aprobo el Preview `dpl_HdRSR2ydR5oU228LsnuHTXmdqvot`. Se promovio exactamente ese artefacto, sin reconstruir otro candidato y sin SQL.
- Produccion nueva Ready: `dpl_4GotPD8R2EiHLg6BC2QFoiyJiwcn`, `https://vendeplus-clean-prxwynvhb-entrega2-s-projects.vercel.app`. Alias oficiales `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` confirmados sobre este deployment.
- Cambio visible: tarjeta del comercio usa moto y boton generico `Delivery`; azul antes del envio y verde/deshabilitado despues. No muestra `Entrega2 App: ...` ni `Empresa delivery: ...`. Pedidos historicos China Town con provider legacy e integracion `sent` conservan la moto verde aunque no tengan `transport_order`.
- Smoke posterior: `/`, `/marketplace`, `/smash`, `/panel/login`, `/panel/pedidos`, `/transporte`, Marketplace/Particulares Entrega2 respondieron 200; APIs privadas de panel/transporte respondieron 401 sin sesion. Sin logs nivel error ni 5xx.
- Supabase dry-run posterior: base remota al dia. Sin migracion ni SQL. Validaciones del artefacto: 65/65 criticos, 5/5 puente, TypeScript, ESLint, build local Webpack y Vercel Turbopack con 185 paginas.
- Rollback web inmediato: produccion anterior `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`. No se hizo commit ni push.
- Siguiente paso: usuario confirma visualmente en produccion un pedido historico China Town enviado y uno nuevo/pendiente; ambos deben conservar una unica accion `Delivery` coherente.

# 2026-09-08 - Preview compatibilidad visual pedidos legacy China Town

- Usuario noto que en China Town no aparecia ninguna accion delivery despues de quitar los chips redundantes. Diagnostico remoto de lectura: los 12 pedidos delivery recientes consultados conservan `delivery_provider='entrega2'`, integracion `sent` y `delivery_status='sent'`, pero no tienen `transport_order` porque fueron enviados antes de la migracion al puente.
- Se amplio la condicion visual `showDeliverySent` en `OrdersManager`: pedidos legacy Entrega2 con integracion/estado confirmado muestran moto verde `Delivery`; pedidos actuales de empresa delivery tambien usan como respaldo `order.transport_agency_status`. Estados pendientes, enviando, fallidos o en conciliacion no se marcan como enviados.
- Se mantienen ocultos `Entrega2 App: ...` y `Empresa delivery: ...`; no cambio ninguna ruta, envio, estado interno ni dato remoto.
- Validaciones: 65/65 contratos criticos, 5/5 puente, TypeScript, ESLint y `git diff --check` OK. `npm.cmd run build` conserva el fallo ambiental conocido del symlink Turbopack; build local Webpack con variables en memoria y build Vercel Turbopack aprobaron 185 paginas.
- Preview corregido Ready y sin logs de error: `dpl_HdRSR2ydR5oU228LsnuHTXmdqvot`, `https://vendeplus-clean-pckfeajg2-entrega2-s-projects.vercel.app`. Produccion sigue intacta en `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`.
- Sin migracion, SQL, commit ni push. Siguiente paso: revisar China Town en el Preview; los pedidos legacy enviados deben mostrar el boton verde `Delivery` con moto.

# 2026-09-08 - Preview tarjeta de pedido delivery simplificada

- Usuario aclaro la UX correcta del comercio: solo debe saber que envio el pedido a su empresa delivery; no debe ver si internamente paso a Entrega2 App ni duplicar el mismo estado en chips.
- En `src/components/panel/OrdersManager.tsx`, Delivery usa icono `Motorbike` en la modalidad y en los botones; se eliminaron de la tarjeta los chips `Entrega2 App: ...` y `Empresa delivery: ...`; el boton se llama siempre `Delivery`, azul antes de enviar y verde/deshabilitado despues. La logica, estados y puente interno no cambiaron.
- `scripts/critical-contracts.test.mjs` protege la UX: exige moto y evita que vuelvan los textos internos o el camion de 16 px en la accion.
- Validaciones: contratos criticos 65/65, puente 5/5, TypeScript, ESLint focal y `git diff --check` OK. `npm.cmd run build` exacto falla por el symlink conocido de Turbopack fuera del root; build Webpack con variables cargadas solo en memoria aprobo 185 paginas. Build remoto Vercel Turbopack aprobo 185 paginas.
- Preview Ready: `dpl_2ZuqFpVMbu1hnVbyu9ziqKYHMae4`, `https://vendeplus-clean-2flvb24th-entrega2-s-projects.vercel.app`; sin logs de error. Produccion permanece sin cambios en `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`.
- Sin migracion, SQL, commit ni push. Siguiente paso: usuario revisa una tarjeta delivery enviada y otra pendiente en Preview; promover solo con aprobacion explicita.

# 2026-09-08 - QA posterior a produccion puente Entrega2

- Validacion solicitada por el usuario, sin crear pedidos ni modificar datos. Navegador integrado no disponible; se uso smoke HTTP directo, pruebas locales y lecturas de Supabase/Vercel.
- Produccion sigue Ready en `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`; siete rutas publicas/panel respondieron 200, APIs privadas de contexto y ambos endpoints de envio respondieron 401 sin sesion, y payloads invalidos de cotizacion/particulares respondieron 400. No hubo 5xx en logs desde el despliegue.
- Pruebas repetidas: contratos criticos 65/65, puente Entrega2 5/5, `git diff --check` OK y Supabase dry-run al dia.
- Estado remoto: 0 legacy, 15 configuraciones apuntan a Entrega2 Somos, 15 conexiones activas/default/exclusivas correctamente enlazadas, 14 credito y 1 contado.
- Cotizacion real no destructiva para Smash: respuesta disponible desde Entrega2 App, provider `transport_agency`, 2484 ms; no activo fallback. El fallback de 4.5 s queda validado por contrato automatizado, no se forzo una falla real del proveedor.
- Desde el despliegue no hay integraciones nuevas, fallidas ni en conciliacion. Ultimos envios comerciales previos visibles: Smash `VP-0908-DPK` y China Town con estado integracion/delivery `sent` y external ID presente.
- Hallazgo historico: 9 integraciones de particulares del 6-7 de septiembre siguen en `sending`, todas anteriores al despliegue, sin `order_id` comercial ni error. No afectan pedidos nuevos ni comercios, pero esos nueve servicios antiguos no pueden reintentarse hasta conciliarlos. No se modificaron por tratarse de una validacion de lectura.
- Pendiente E2E humano: ejecutar un pedido nuevo Smash credito, uno Sabore contado y un particular; esto genera datos/envios reales y requiere operacion controlada con sesion.

# 2026-09-08 - Produccion puente Entrega2 Somos-App

- Usuario aprobo expresamente el pase cauteloso a produccion despues de validar Smash credito y aclarar la etiqueta del boton.
- Respaldo previo de las 13 configuraciones legacy: `../tmp/checkpoints/2026-09-08-entrega2-legacy-preprod-backup.json`, SHA256 `4543526FFEC7734CDB4DC7E248F3328908F866C720251D6681E11EF883E160A1`.
- Migracion no destructiva aplicada: `supabase/migrations/20260907213000_align_legacy_entrega2_connections.sql`. Resultado: 0 configuraciones legacy pendientes, 13 configuraciones alineadas, 13 conexiones creadas/alineadas (12 credito y 1 contado: Sabore). Total de conexiones activas Entrega2: 15 incluyendo Smash y Andinos. Dry-run posterior: base remota al dia.
- Se promovio exactamente el Preview validado `dpl_8MegoK5yEdDKmZjYmjiTffNhmo4a` (`vendeplus-clean-h3310xzpi-entrega2-s-projects.vercel.app`). Produccion nueva Ready: `dpl_5A5wyGUYQt7CpqUd23uPFW7oJQQ5`, `https://vendeplus-clean-fkouk33r7-entrega2-s-projects.vercel.app`.
- Alias confirmados sobre el deployment nuevo: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y el alias del proyecto.
- Smoke posterior sobre `www.somos-ve.com`: `/`, `/marketplace`, `/smash`, `/panel/login`, `/transporte`, `/transporte/entrega2/marketplace` y `/transporte/entrega2/particulares` respondieron 200; `/api/panel/context` y `/api/transport/me` respondieron 401 sin sesion, esperado. Contenido principal verificado y sin logs Vercel de nivel error desde el despliegue.
- Validaciones del candidato promovido: contratos criticos 65/65, puente Entrega2 5/5, ESLint focal y `git diff --check` OK; build local Webpack y build remoto Vercel aprobados con 185 paginas.
- Rollback web disponible: deployment productivo anterior `dpl_2VEUZVTE5Arge4DJSifqkHgmMRru`. Reversion de datos solo de forma controlada usando el respaldo previo; no es necesaria actualmente.
- No se hizo commit ni push. Riesgos P1 independientes pendientes: aislar Preview de Supabase productivo, rotar credenciales historicas y eliminar topes de 200 en facturacion/afiliados.
- Siguiente paso exacto: prueba operativa corta del usuario en produccion: Smash credito debe crear registro Somos y enviarse directo a Entrega2 App; Sabore contado debe quedar en Somos hasta que la operadora pulse `Enviar a Entrega2 App`; un particular debe seguir el mismo flujo operado. Vigilar que cada caso tenga una sola integracion y no se duplique al reintentar.

# 2026-09-08 - Checkpoint Puente Entrega2 Somos-App pendiente de validacion

- Usuario confirma revision visual OK y pide guardar para validar antes de produccion.
- Ficha principal: `../docs/checkpoints/2026-09-08-puente-entrega2-somos-app-pendiente-validacion.md`.
- ZIP local verificado: `../tmp/checkpoints/2026-09-08-puente-entrega2-somos-app-pendiente-validacion.zip`, 445 entradas, sin `.env*`; SHA256 `27220EB8689FB87DE66C960DCDF980265B939CD50F4F64FE6C97D14CC2F100F1`.
- Preview vigente: https://vendeplus-clean-r68ntp10u-entrega2-s-projects.vercel.app (`dpl_7mjJ1Sg1cQR3gJ4xPhLg5XtPWZ6v`). Etiqueta visible legacy retirada; compatibilidad interna conservada.
- Cotizacion centralizada App con timeout 4.5 s y respaldo Somos; credito/contado/particulares segun arquitectura documentada en `docs/ENTREGA2_SOMOS_BRIDGE.md`.
- Ultimo build local y Vercel aprobados (185 paginas); contratos 65/65; TypeScript/ESLint OK. Pruebas previas son de contrato/lectura, no E2E operativo.
- No promover produccion ni ejecutar migraciones. Preview comparte base productiva; las pruebas con escrituras requieren entorno aislado. Migracion de alineacion pendiente: `20260907213000_align_legacy_entrega2_connections.sql`.
- Se inicia auditoria de seguridad y escalabilidad de lectura solicitada por el usuario. Ver informe en `../docs/audits/2026-09-08-somos-seguridad-escalabilidad.md` cuando termine; sus hallazgos deben revisarse antes de publicar.
- Auditoria finalizada en ese informe. Cinco P1: aislamiento de entornos, credenciales historicas, integridad del puente/eventos, validacion/latencia de cotizacion y agregados/listados truncados. Se reprodujeron localmente tarifa 0 ante costos invalidos, total $600 para 201 servicios de $3, regresion entregado -> aceptado y espera de ~8046 ms. Programa de reproduccion en `../docs/audits/2026-09-08-somos-behavior.cjs`; no usa servicios reales.
- No se corrigio producto ni se promovio produccion. El checkpoint es la referencia visual, no una aprobacion operativa; resolver/revalidar estos hallazgos antes de proponer la publicacion.
- Cierre de auditoria: build local Webpack repetido y aprobado, 185 paginas; contratos 65/65; tres APIs privadas del Preview devolvieron 401 sin sesion. No hubo deploy nuevo.
- Codificacion de este historial y el principal reparada mecanicamente: dos bytes Windows-1252 invalidos por archivo convertidos a UTF-8, copias previas privadas en `../tmp/checkpoints/`. Se preservo el resto del contenido.

# 2026-09-07 - Preview puente claro con comercios Entrega2 App legacy visibles

- Usuario probo Preview anterior: podia entrar a `Comercios`, pero solo veia `Smash (Test)` y no veia otros comercios ni opcion clara para pasarlos a contado/credito.
- Diagnostico: los comercios existentes con Entrega2 App viven en configuracion legacy `store_delivery_settings.delivery_provider = 'entrega2'`, no como filas reales en `store_transport_agency_connections`. Por eso Entrega2 Somos no los listaba.
- Cambio aplicado: `/api/transport/me` ahora, cuando la cuenta es Entrega2 Somos, mezcla en `connections` los comercios legacy de Entrega2 App que aun no tienen conexion real. Salen con chip `Entrega2 App legacy`, `Credito directo` por defecto, excepto `sabore` como `Contado validado`.
- Cambio aplicado: en `Comercios`, el selector de modalidad queda bloqueado para legacy hasta confirmar cobro. Al cambiar `Cobro` en un legacy, llama `POST /api/transport/legacy-entrega2/[storeId]`, crea/actualiza la conexion real con Entrega2 Somos, cambia `store_delivery_settings` de `entrega2` a `transport_agency`, apunta `transport_agency_connection_id`, y deja `delivery_billing_mode` segun lo elegido.
- Cambio aplicado: la pantalla mantiene contadores y filtro `Todos/Solo credito/Solo contado`, y chips claros `Credito directo` / `Contado validado` + destino operativo.
- Migracion global `20260907213000_align_legacy_entrega2_connections.sql` sigue preparada para alinear todos de una vez, pero no aplicada. El endpoint permite alinear uno por uno desde UI.
- Validaciones aprobadas: contratos directos `65/65`; TypeScript OK; ESLint focal OK; `git diff --check` OK; Supabase dry-run detecta solo la migracion global pendiente; build local Webpack OK, 185 paginas.
- Preview nuevo Ready: `dpl_45s1oqTJ7sBuRao3nZVLQuqXtV7z`, `https://vendeplus-clean-wxvp92jem-entrega2-s-projects.vercel.app`, target Preview. `vercel inspect` Ready y logs de error sin resultados.
- Produccion codigo no fue promovida. Nota operativa: el Preview usa la base remota; ver la lista no cambia datos, pero cambiar el selector de cobro en un comercio legacy si crea/actualiza conexion real en la base. Para prueba segura usar primero `Smash (Test)`.
# 2026-09-07 - Preview visibilidad y alineacion credito/contado Entrega2

- Usuario aclaro regla operativa: todos los comercios que hoy estan conectados a Entrega2 App deben quedar tambien conectados a Entrega2 Somos. Desde Entrega2 Somos se elige quien es `Credito` y quien es `Contado`; actualmente todos son credito excepto `sabore`.
- Diagnostico remoto de datos: las tiendas legacy con `store_delivery_settings.delivery_provider = 'entrega2'` no tenian fila en `store_transport_agency_connections`, por eso no aparecian en Comercios de Entrega2 Somos ni podian clasificarse contado/credito. La agencia Entrega2 Somos existe como `transport_agencies.slug = 'entrega2'`, id `3db97653-4a7a-4ab0-854d-0ca847ff88a9`.
- Tiendas legacy detectadas para alinear: Andinos, China Town, Cookies Shop, Don Aniello, Happy chicken, La cabana, La Cremita Gourmet Guasimal, La Cremita Gourmet Las Ballenas, Pasteleria TDK Delicias, Pasteleria TDK Los Cedros, Pasteleria TDK Pinonal, Sabore, Santo Sabor, Smash (Test), Strawberry.
- Cambio UI aplicado: en `Transporte > Panel > Comercios`, cuando la empresa es Entrega2, se muestra bloque `Cobro Entrega2` con contadores `Activos Entrega2`, `Credito directo`, `Contado validado`, filtro `Todos/Solo credito/Solo contado`, y chips por comercio: `Credito directo` + `Envia directo a Entrega2 App` o `Contado validado` + `Operadora libera desde Somos`.
- Migracion nueva preparada pero NO aplicada a produccion: `supabase/migrations/20260907213000_align_legacy_entrega2_connections.sql`. Crea/actualiza conexiones activas Entrega2 Somos para tiendas legacy `delivery_provider='entrega2'`, cambia `store_delivery_settings` a `transport_agency`, asigna `credit` a todas excepto `sabore` como `cash`, y apunta `transport_agency_connection_id` a la conexion creada.
- Supabase dry-run: detecta solo esta migracion pendiente (`20260907213000_align_legacy_entrega2_connections.sql`). No se ejecuto `db push` real.
- Validaciones aprobadas: contratos directos `65/65`; TypeScript `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; build local `npm.cmd run build -- --webpack` OK con 185 paginas.
- Preview nuevo Ready: `dpl_7PJQgWZLJtQcNM5aMdJE5epiAyvg`, `https://vendeplus-clean-jk5kypv73-entrega2-s-projects.vercel.app`, target Preview. Build remoto Vercel Turbopack OK. Logs de error: sin resultados. Smoke HTTP cae en `Login - Vercel` por SSO de Preview.
- Produccion no fue promovida ni tocada. Para prueba funcional completa hace falta decidir/aprobar aplicar la migracion de alineacion en la base remota, porque el Preview usa la misma base y sin esa migracion los comercios legacy no apareceran aun en Entrega2 Somos.
# 2026-09-07 - Preview puente Entrega2 credito/contado sin produccion

- Usuario recordo el objetivo: puente entre Entrega2 Somos y Entrega2 App. Comercios con credito deben enviarse directo a Entrega2 App desde el panel del comercio; comercios de contado deben llegar al panel Entrega2 Somos, donde la operadora valida y luego libera hacia Entrega2 App.
- Se continuo exclusivamente en el worktree `.particular-delivery-clean`. No se promovio ni se toco produccion.
- Implementacion verificada: `store_transport_agency_connections.delivery_billing_mode` soporta `cash` por defecto y `credit`; al aprobar afiliaciones Entrega2 se selecciona contado/credito; la empresa puede cambiarlo despues desde Comercios; el comercio ve el modo de cobro en su Marketplace de empresas delivery.
- Ruta comercio verificada: `POST /api/panel/orders/[orderId]/send-delivery` para `transport_agency` + Entrega2 crea `transport_orders`; si la conexion es `credit`, envia directo a Entrega2 App con `sendCommerceOrderToEntrega2App`; si es `cash`, registra evento `cash_validation_required` y deja el servicio en Entrega2 Somos para validacion.
- Ruta Entrega2 Somos verificada: `POST /api/transport/panel/orders/[transportOrderId]/send-entrega2` permite liberar a Entrega2 App tanto particulares como pedidos de comercio validados, con GPS requerido, deduplicacion en `order_integrations`, evento `entrega2_app_sent` o `entrega2_app_released`, y webhooks actualizando `transport_order_id`.
- Supabase dry-run: `Remote database is up to date`; no hay SQL pendiente contra la base remota.
- Validaciones aprobadas: contratos directos `65/65`; `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; build local `npm.cmd run build -- --webpack` OK con variables cargadas desde `../.env.local` solo en memoria, 185 paginas.
- `npm.cmd run build` normal falla localmente por el problema conocido de Turbopack con `node_modules` symlink fuera del root del worktree; el build remoto Vercel Turbopack aprobo.
- Preview Ready: `dpl_ECXcWbXwnfgSDSK9fkpbzMzpbiwG`, `https://vendeplus-clean-3ovgj960m-entrega2-s-projects.vercel.app`, target Preview.
- Smoke Preview: `vercel inspect` Ready y `vercel logs --level error --since 10m` sin logs. Smoke HTTP de rutas devuelve Vercel SSO (`Login - Vercel`), esperado por proteccion de Preview; prueba funcional requiere entrar con cuenta Vercel o bypass configurado.
- Siguiente paso exacto: probar en Preview con sesion Entrega2 Somos: (1) marcar un comercio Entrega2 como `Credito`, crear/enviar pedido delivery y confirmar que pasa directo a Entrega2 App; (2) marcar otro como `Contado`, enviar pedido desde comercio, confirmar que aparece en Pedidos de Entrega2 Somos y solo se manda a Entrega2 App al pulsar el boton de enviar/liberar; (3) confirmar que reintentos quedan bloqueados si `order_integrations` ya tiene estado no fallido. No promover a produccion sin aprobacion explicita posterior.
# 2026-09-07 - Auditoria produccion antes de arquitectura credito/contado Entrega2

- Usuario pidio asegurar lo que esta en produccion antes de planificar cambios nuevos de cotizacion Entrega2 App y selector credito/contado.
- Sin tocar codigo ni desplegar. `git status --short` conserva el worktree con cambios historicos de particulares y handoff; no se hizo commit ni push.
- Produccion actual inspeccionada: `dpl_2VEUZVTE5Arge4DJSifqkHgmMRru`, `https://vendeplus-clean-i5l94eert-entrega2-s-projects.vercel.app`, target production, status Ready.
- Aliases oficiales confirmados: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app`, `https://vendeplus-clean-entrega2-s-projects.vercel.app`.
- Supabase dry-run: `Remote database is up to date`; no migraciones ni SQL pendientes.
- Smoke produccion OK: `/`, `/marketplace`, `/transporte`, `/transporte/entrega2/particulares`, `/transporte/panel`, `/panel`, `/china-town` en `www.somos-ve.com` respondieron 200 con contenido; tambien OK en alias `vendeplus-clean.vercel.app` para particulares y panel transporte.
- Logs Vercel ultimos 20 minutos: actividad normal nivel info, multiples 200 en paneles/catalogos/API; un `POST /api/orders` 400 aislado nivel info, compatible con validacion de solicitud y sin indicio de fallo 5xx/server error.
- Siguiente paso exacto: no modificar produccion hasta disenar y aprobar arquitectura para: cotizacion particulares primero contra Entrega2 App con fallback Somos; selector por comercio conectado a Entrega2 entre credito directo y contado con validacion/liberacion desde panel Entrega2 Somos.
# 2026-09-07 - Produccion recordar solicitante particulares

- Usuario aprobo el Preview `https://vendeplus-clean-fi4ujktf4-entrega2-s-projects.vercel.app` y pidio pasarlo a produccion con cuidado.
- Verificacion previa: `vercel inspect` confirmo Preview Ready (`dpl_8PVcTuckFBY4wHtF5A17Nee8xpzh`) y `npx.cmd supabase db push --linked --dry-run` confirmo `Remote database is up to date`.
- Se promovio exactamente ese Preview con `vercel.cmd promote vendeplus-clean-fi4ujktf4-entrega2-s-projects.vercel.app --yes`.
- Produccion nueva Ready: `dpl_2VEUZVTE5Arge4DJSifqkHgmMRru`, `https://vendeplus-clean-i5l94eert-entrega2-s-projects.vercel.app`.
- Aliases oficiales confirmados sobre el deployment nuevo: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y `https://vendeplus-clean-entrega2-s-projects.vercel.app`.
- Smoke produccion OK: `https://www.somos-ve.com/transporte/entrega2/particulares` 200 content-ok, `https://www.somos-ve.com/transporte/panel` 200 content-ok, y mismos checks OK en `vendeplus-clean.vercel.app`.
- Logs Vercel recientes: solo eventos info 200 para formulario, panel, imagenes y `/api/transport/panel/orders`; sin errores reportados por CLI.
- Supabase dry-run posterior: `Remote database is up to date`. Migracion `20260907190000_add_particular_request_contact_names.sql` ya aplicada. No hay SQL pendiente.
- No se hizo commit ni push.
- Siguiente paso exacto: prueba real controlada en produccion creando un particular Delivery/Usted envia y otro Delivery/Usted recibe, verificando que recuerda solicitante y que WhatsApp/panel muestran nombres de retiro/entrega.
# 2026-09-07 - Preview generado recordar solicitante particulares

- Usuario autorizo generar Preview para recordar datos del solicitante y pedir nombre de la otra parte en Delivery particular.
- Migracion remota aplicada con `npx.cmd supabase db push --linked`: `20260907190000_add_particular_request_contact_names.sql` agrega `pickup_name` y `delivery_name` opcionales. Dry-run posterior: `Remote database is up to date`.
- Validaciones previas/post: contratos directos 64/64 OK, `git diff --check` OK, build local `npm.cmd run build -- --webpack` OK, build remoto Vercel Turbopack OK con 181 paginas.
- Preview READY: https://vendeplus-clean-fi4ujktf4-entrega2-s-projects.vercel.app (`dpl_8PVcTuckFBY4wHtF5A17Nee8xpzh`), target Preview, proyecto `vendeplus-clean`.
- Smoke sin sesion contra `/transporte/entrega2/particulares` y `/transporte/panel` devolvio 302 por proteccion/SSO de Vercel Preview; `vercel inspect` confirma estado Ready. No se promovio a produccion.
- Siguiente paso exacto: probar el Preview con sesion/bypass Vercel en movil: Delivery/Usted envia debe pedir nombre/telefono de quien recibe; Delivery/Usted recibe debe pedir nombre/telefono de quien entrega; recargar debe recordar nombre/telefono del solicitante si el checkbox queda activo. Si el usuario aprueba, promover a produccion y hacer smoke posterior en dominios oficiales.
# 2026-09-07 - Preview pendiente: recordar solicitante y nombres por punto en particulares

- Usuario pidio agregar a pedidos particulares la opcion de recordar datos de solicitante como en checkout de comercios, y pedir nombre de la otra parte en Delivery particular: si el solicitante envia, pedir nombre/telefono de quien recibe; si el solicitante recibe, pedir nombre/telefono de quien entrega.
- Cambio aplicado en `.particular-delivery-clean`: `ParticularDeliveryForm` reutiliza `customer-browser-profile` para cargar/guardar nombre y telefono del solicitante en `localStorage`, con checkbox activado por defecto y opcion de limpiar si se desmarca.
- Cambio aplicado: `Point` ahora soporta `name`; el formulario muestra `Nombre de quien recibe en entrega` o `Nombre de quien entrega en retiro` segun el rol del solicitante. Para traslado de persona se conserva la logica de pasajero ya existente.
- Cambio aplicado server-side: la API publica de particulares valida `pickup.name` y `delivery.name`, inserta `pickup_name` y `delivery_name`, y los incluye en el WhatsApp de solicitud particular.
- Cambio aplicado panel/operacion: las APIs de pedidos/particulares seleccionan `pickup_name` y `delivery_name`; el panel muestra contactos de retiro/entrega en el detalle y los incluye en la comanda WhatsApp al repartidor; el envio a Entrega2 App agrega esos nombres en `detalles`.
- Migracion nueva pendiente de aplicar antes de Preview/produccion: `supabase/migrations/20260907190000_add_particular_request_contact_names.sql`, aditiva, agrega `pickup_name` y `delivery_name` opcionales con limite de 100 caracteres. No destruye datos viejos.
- Validaciones aprobadas: `node --experimental-strip-types scripts/critical-contracts.test.mjs` 64/64; `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; `npx.cmd supabase db push --linked --dry-run` OK y detecta solo esta migracion nueva; `npm.cmd run build -- --webpack` OK, Next.js 16.3.0, 181 paginas.
- No se hizo deploy, no se promovio produccion, no se aplico la migracion remota en esta retoma.
- Siguiente paso exacto: aplicar la migracion en Supabase remoto, desplegar Preview, probar en movil los caminos Delivery/Usted envia y Delivery/Usted recibe verificando que se cargan/guardan datos del solicitante y que se exigen los nombres de la otra parte; luego revisar panel y WhatsApp antes de aprobar produccion.
# Enlace público para particulares por empresa delivery (2026-09-04)

- Trabajo aislado en `.particular-delivery-clean`, rama `feature/particular-delivery-links`; sin commit, Preview, producción ni escrituras remotas.
- Se agregó `/transporte/[agencySlug]/particulares`, un flujo móvil de cuatro pasos: solicitante, retiro, entrega y resumen. Distancia y tarifa se recalculan server-side antes de registrar y abrir WhatsApp.
- El panel permite abrir/copiar el enlace y muestra solicitudes limitadas a la empresa autenticada. La API pública limita abuso por IP/empresa, cuerpos de 8 KB y valida slug, coordenadas, teléfonos, textos y pago.
- Migración aditiva `20260905010000_transport_particular_requests.sql`, todavía NO aplicada: tabla con FK a empresa, checks, índice, RLS y acceso directo revocado a `public`, `anon` y `authenticated`.
- Validaciones aprobadas después de liberar espacio: 63/63 contratos críticos, ESLint dirigido, `git diff --check`, TypeScript y build completo Next.js 16.3.0 con 193 páginas. El build usó Webpack porque Turbopack rechaza el junction local de dependencias compartidas; las variables privadas se cargaron solo en memoria desde `.env.local`, sin copiar ni modificar secretos.
- Migración aditiva `20260905010000_transport_particular_requests.sql` aplicada remotamente con autorización, después de un dry-run que confirmó que era la única pendiente. Verificación: tabla vacía, RLS activo, `anon`/`authenticated` sin SELECT, `service_role` con SELECT, índice esperado y ocho constraints presentes.
- Preview Ready: `dpl_9LcVAZiGmu96YZbNzdZFsjsdv65V`, `https://vendeplus-clean-lx9ddaaf8-entrega2-s-projects.vercel.app`, target Preview y proyecto correcto `vendeplus-clean`. Build remoto Next.js 16.3.0 de 193 páginas aprobado.
- Smoke Preview: `/transporte/entrega2/particulares` HTTP 200; API pública GET 405; API de panel sin sesión 401; cotización POST sin crear solicitud devolvió 2,87 km y $1,50 desde tarifa server-side. La tabla continuó con 0 filas y no hubo logs de error.
- Siguiente paso: probar desde teléfono el flujo visual con el enlace de una empresa activa y registrar una solicitud controlada; confirmar que abre WhatsApp y aparece solo en Pedidos de esa empresa. No promover a producción sin aprobación explícita.
- Culminación técnica (2026-09-04): las solicitudes particulares ahora crean automáticamente un `transport_order`, aparecen en el listado operativo normal de Pedidos, admiten asignación de repartidor y sincronizan sus estados. La empresa configura métodos/datos de pago que el cliente puede consultar y copiar.
- Se corrigió el orden de migraciones antes de aplicar: la integración quedó como `20260905020000_integrate_particular_delivery_orders_and_payments.sql`, posterior a la tabla base `20260905010000`. El dry-run propuso solo esa migración y fue aplicada remotamente sin errores.
- Validaciones finales: 63/63 contratos críticos (ejecución directa por el `spawn EPERM` conocido del runner), ESLint global, TypeScript, `git diff --check` y build Next.js 16.3.0 de 193 páginas aprobados. El build local usó Webpack por el junction del worktree; el build remoto Turbopack también aprobó.
- Preview final Ready: `dpl_CVeWAjv9wpLtZcaWgbgraE8sm1FH`, `https://vendeplus-clean-ey6d0ph5k-entrega2-s-projects.vercel.app`. Producción web no fue promovida.
- Próximo paso exacto: configurar al menos un método de pago en una empresa controlada, crear una solicitud real desde teléfono y confirmar en Pedidos que aparece una sola vez, permite asignar repartidor y sincroniza estados. Promover solo después de esa validación.
- Refinamiento visual solicitado sobre capturas: cabecera pública con mejor jerarquía, fondo suave, logo elevado y decoración discreta; cabecera del panel con acciones compactas, alturas consistentes y etiquetas más cortas para evitar la fila sobredimensionada.
- Pagos particulares simplificados exclusivamente a `Pago móvil` y `Efectivo`. Configuración presentada en dos tarjetas; Pago móvil permite escribir libremente el nombre del banco, teléfono, cédula/RIF y titular. Métodos antiguos quedan filtrados en cliente y rechazados server-side.
- Retiro y entrega unifican `Dirección escrita` + `Referencia opcional` en un solo campo `Dirección o referencia`. El GPS continúa siendo obligatorio y la descripción escrita opcional.
- Pago móvil exige ahora `Referencia del pago` tanto en cliente como server-side. Se guarda en `transport_particular_requests.payment_reference`, aparece en WhatsApp y en el detalle operativo del pedido. Migración aditiva `20260905030000_add_particular_payment_reference.sql` aplicada remotamente; no requiere SQL manual.
- Validaciones: TypeScript, ESLint dirigido, 63/63 contratos, `git diff --check` y build local Next.js 16.3.0 de 193 páginas aprobados. Preview final `dpl_5AHQ57ZSkSuxCtmLtwGx9wKqeB91`, `https://vendeplus-clean-8up7b5zkr-entrega2-s-projects.vercel.app`, Ready; build remoto Turbopack aprobado. Producción web intacta.
- Próximo paso exacto: revisar en Preview la cabecera del panel y el formulario móvil; configurar Pago móvil/Efectivo, registrar una solicitud con referencia y confirmar su visualización en Pedidos. No promover sin aprobación explícita.
- Hotfix visual posterior: el logo del enlace público ya no usa un contenedor con recorte ni estira la imagen al 100%. Ahora dispone de caja 72x72, margen interno real y una imagen 48x48 con `object-contain`, por lo que conserva completa cualquier proporción.
- ESLint dirigido, TypeScript, `git diff --check` y build local/remoto Next.js 16.3.0 de 193 páginas aprobados. Preview corregida `dpl_C8eYcCd4FznLrvUsqcbAhNo7f5rK`, `https://vendeplus-clean-jpv44yxc8-entrega2-s-projects.vercel.app`, Ready. Sin migración adicional ni producción.
- Segunda corrección del logo tras evidencia visual: el archivo de Entrega2 contiene margen blanco interno, por lo que `object-contain` mostraba la marca útil diminuta. La miniatura ahora usa el patrón de avatar (`object-cover`, centrado, sin padding) para ocupar completamente el cuadro 72x72. ESLint, TypeScript, diff check y build local/remoto de 193 páginas aprobados. Preview `dpl_BjkAzbqQqNdrALcarbKtJWTToayz`, `https://vendeplus-clean-95rvs0ki4-entrega2-s-projects.vercel.app`, Ready; producción intacta.

# Optimización por sección del panel delivery (2026-08-26)

- Rama local `perf/transport-panel-section-loading`; producción intacta y sin migración/SQL.
- Diagnóstico: la entrada directa a Pedidos todavía descargaba perfil, condiciones, tarifas, zonas y rangos completos de la empresa. Resumen descargaba hasta 200 servicios con todos sus campos, relaciones, repartidores y datos del pedido solo para mostrar cantidad y total.
- `/api/transport/me` conserva compatibilidad y agrega dos controles opt-in: `includeConfiguration=false` devuelve identidad operativa compacta; `billingDetail=false` usa una selección mínima para el resumen. Facturación sigue solicitando el detalle completo.
- El cliente distingue ahora configuración completa, resumen de facturación y detalle de facturación. Al navegar desde Pedidos carga configuración solo cuando otra sección la necesita, y al entrar en Facturación exige detalle aunque Resumen ya se haya cargado.
- La fusión de respuestas compactas conserva campos completos previamente cacheados. La alerta de configuración se oculta durante la entrada compacta a Pedidos para no mostrar faltantes falsos.
- QA autenticada temporal contra Supabase remoto, sin crear pedidos: en una empresa con servicios, Pedidos bajó de 2.639 a 621 bytes (76% menos) y Resumen de 34.375 a 18.350 bytes (47% menos). En esa corrida caliente el endpoint pasó de 716 a 625 ms en Pedidos y de 1.107 a 949 ms en Resumen. El usuario y membresía QA se eliminaron y el script verificó cero membresías residuales.
- Validaciones aprobadas: 55/55 contratos críticos, ESLint global, TypeScript, `git diff --check` y build Next.js 16.3.0 de 173 páginas.
- Preview `https://vendeplus-clean-r4zurt510-entrega2-s-projects.vercel.app`, deployment `dpl_AaR258x7e5nVhf8dzVjtHwyQyL3T`, target Preview y estado Ready; build remoto de 173 páginas aprobado. Está protegida por SSO de Vercel. Acceso CLI con bypass confirmó que `/api/transport/me` sin sesión mantiene `401 No autorizado`.
- El script QA ahora exige `application/json` y estructura válida para no confundir una página SSO HTTP 200 con la API.
- Usuario aprobó visualmente y autorizó producción. Se promovió exactamente la Preview validada; deployment productivo `dpl_2rWk28vJy6BgBh4NEUa9NfgbgsV7` (`https://vendeplus-clean-2ti1k7xy9-entrega2-s-projects.vercel.app`), Ready y con alias oficiales.
- Smoke productivo aprobado: Home, panel delivery, Pedidos y Facturación HTTP 200; `/api/transport/me` sin sesión HTTP 401 esperado; sin logs de error iniciales. Rollback web inmediato: `https://vendeplus-clean-9krzoivg8-entrega2-s-projects.vercel.app`.

# Corrección completa La Maravilla del Sushi (2026-08-25)

- Estado inicial auditado: 4 categorías, 8 productos activos, 0 pedidos, 0 imágenes y 0 grupos de opciones. Los 8 productos correspondían al menú real pero tenían nombres/descripciones incompletos; faltaban 12 productos. Ensalada Dinamita conservaba 2 variantes erróneas e inactivas `Topinng...`.
- Migración idempotente aplicada y registrada: `20260826031500_correct_la_maravilla_sushi_menu.sql`, limitada al slug `la-maravilla-del-sushi`. No hubo cambio de esquema ni código global.
- Se conservaron los IDs de los 8 productos existentes y se actualizaron: Ensalada Dinamita, Croquetas de Cangrejo, Cangrejo Especial, Camarones Rebosados, Tera Roll, Dinamita Roll, Sakana Roll y Chicken Roll. `Croquetas de cangrejo` y `Dinamit Roll` corrigieron sus nombres.
- Se crearon 12 faltantes: Umi Roll, Camarón Roll, Skin Roll, Kani Roll, Tuna Roll, California Roll, Aguacate Roll, Salmón Roll, Me Prefieres a Mí, Flow La Marash, La Sensación y Pa' Que La Pases Bien.
- Categorías finales activas: Entradas, Tempurizados, Fríos y Promociones. Las dos categorías con cantidades entre paréntesis se renombraron conservando IDs. No había categorías o productos extra que desactivar.
- Se eliminaron únicamente las 2 variantes erróneas `Topinng Cangrejo/Wakame` de Ensalada Dinamita; no tenían pedidos ni estaban activas. Los toppings quedaron como parte de las descripciones, sin modificadores artificiales.
- Resultado remoto verificado: exactamente 20 productos activos y únicos: 4 Entradas, 6 Tempurizados, 6 Fríos y 4 Promociones; precios, orden y descripciones coinciden con el menú fuente. `La Sensación` conserva literalmente `5 Cangrejo Rolls`.
- Imágenes: no existía ninguna imagen principal ni galería, por lo que no hubo imágenes que conservar o reasignar. La migración no modifica imágenes al actualizar productos equivalentes.
- QA pública: `/la-maravilla-del-sushi` HTTP 200, contiene los productos nuevos/corregidos, muestra 20 productos y no contiene `Dinamit Roll` ni `Topinng`. Validaciones: ESLint dirigido, TypeScript, 54/54 contratos, `git diff --check`, dry-run remoto y build Next.js 16.3.0 de 177 páginas.
- Pendiente: respaldo Git conjunto de las tres migraciones recientes, contratos y handoff. No se requiere despliegue web porque fue una corrección de datos sobre arquitectura existente.

# Menú regular Pizza Mia oculto (2026-08-25)

- Usuario solicitó cargar solo el menú regular y mantener intactas las 9 promociones. Añadió como regla que todos los productos nuevos deben quedar ocultos hasta que cargue sus fotos y los active manualmente.
- Migración idempotente aplicada y registrada: `20260826023000_load_pizza_mia_regular_menu.sql`. No referencia la categoría Promociones ni modifica `stores`; usa únicamente tablas existentes.
- Categorías creadas/reutilizadas: `Pizzas / Especialidades`, `Nuevas`, `Arma tu pizza`, `Otros` y `Subs`. Se cargaron 22 productos regulares, todos con `is_available=false`, `is_featured=false` e `image_url=null`.
- Especialidades y Buffalo usan variantes con medidas y precios absolutos. `Grande con borde de queso` es una variante separada exactamente $3 por encima de Grande, por lo que el borde no puede elegirse en otros tamaños. Pan Pizza y Gigante son variantes separadas con el mismo precio indicado.
- `Arma tu pizza como quieras` usa 5 variantes y 28 ingredientes. `product_option_value_variant_prices` aplica por ingrediente: Personal $1, Pequeña $1.50, Grande $2, Grande con borde $2 y Gigante $2.50. Pan Pizza comparte los 28 nombres mediante su grupo propio a $2.50; Pizza Siciliana usa grupo propio a $3.
- Hawaiana tiene canela opcional a $0. Philly Cheesesteak y Crispy Chicken comparten Tocineta, Queso cheddar y Champiñones a $1.50. Mexicana y Buffalo incluyen `🌶 Picante` en la descripción porque no existe un sistema visual de picante en productos remotos.
- Para no colisionar con la promoción activa `Siciliana`, el producto regular se llama `Pizza Siciliana`; queda oculto con precio técnico $0 y texto `Precio base pendiente por confirmar`. No debe activarse hasta cargar el precio real.
- Primer intento remoto falló por `product_variants.updated_at` inexistente; PostgreSQL revirtió toda la transacción. Se corrigió y el segundo intento aplicó completo. Verificación independiente: 6 categorías totales, 9 promociones activas e intactas, 22 regulares ocultos, 0 imágenes regulares, matrices de variantes correctas, 28/28/28 ingredientes y 3 extras de Subs.
- QA pública: `/pizza-mia` HTTP 200, promociones visibles, productos regulares ausentes y API de opciones de producto oculto HTTP 404. Validaciones: ESLint dirigido, TypeScript, 53/53 contratos críticos, `git diff --check`, dry-run remoto y build Next.js 16.3.0 de 177 páginas.
- Pendiente: usuario carga fotos y activa manualmente cada producto. Antes de activar `Pizza Siciliana`, debe guardar su precio base real. También queda pendiente respaldo Git de las dos migraciones de Pizza Mia, contratos y handoff.

# Promociones Pizza Mia (2026-08-25)

- Usuario solicitó cargar 9 promociones en `pizza-mia`, respetando categoría, productos, opciones, precios e imágenes existentes.
- Se creó y aplicó la migración idempotente `20260826014000_load_pizza_mia_promotions.sql`. Crea/reutiliza `Promociones`, busca productos por comercio + nombre normalizado y conserva cualquier `image_url` preexistente.
- Se cargaron exactamente 9 promociones con precios: 3.99, 5.99, 6.99, 6.99, 9.99, 14.99, 16.99, 19.99 y 19.99 USD. Verificación independiente confirmó 9 nombres únicos y cero duplicados.
- Sici Box y Siciliana usan el grupo obligatorio `Elige tu ingrediente incluido`, selección única, sin costo, con 10 ingredientes: Pepperoni, Jamón, Tocineta, Maíz, Cebolla, Pimentón, Aceitunas negras, Champiñones, Piña y Anchoas.
- No se creó selector de refrescos porque no existe una lista verificable de sabores. Las cantidades y presentaciones sí están explícitas en las descripciones.
- No había imágenes de producto almacenadas; los 9 productos conservan `image_url=null` y el catálogo usa correctamente el logo de Pizza Mia como fallback. No se enlazaron imágenes externas.
- Supabase remoto registró la migración. `/pizza-mia` responde HTTP 200, muestra la categoría y 9 productos; la API pública de opciones devuelve HTTP 200, 1 grupo obligatorio y 10 ingredientes para Sici Box y Siciliana. El comercio figuraba activo al finalizar; la migración no alteró `stores`.
- Validaciones aprobadas: ESLint dirigido, TypeScript, 52/52 contratos críticos, `git diff --check`, dry-run remoto y build Next.js 16.3.0 de 177 páginas.
- Archivos modificados: migración nueva, `scripts/critical-contracts.test.mjs` y este handoff. Sin cambios de aplicación ni despliegue web necesarios. Pendiente solo revisión visual del usuario y, si lo solicita, imágenes específicas/sabores reales de refresco y respaldo Git.

# Preview checkout: nota del pedido vuelve a ser protagonista (2026-08-25)

- QA del usuario aprobó logos circulares de empresas delivery y llegada rápida de notificaciones. Detectó que el estilo resaltado quedó en la información del efectivo y la nota general perdió jerarquía.
- Ajuste mínimo: `Información del efectivo` permanece dentro de `4. ¿Cómo vas a pagar?` con textarea neutro; la tarjeta ámbar independiente conserva solamente el título `5. Indicaciones del pedido (opcional)` y el textarea con su ejemplo de fondo, sin textos redundantes.
- No cambió persistencia, validación server-side, WhatsApp, precios, delivery ni Realtime. No hubo migración ni SQL.
- Validaciones aprobadas: 51/51 contratos críticos, TypeScript, ESLint dirigido, `git diff --check` y build local/remoto Next.js 16.3.0 de 173 páginas.
- Preview final: `https://vendeplus-clean-5ymsfgwso-entrega2-s-projects.vercel.app`, deployment `dpl_4UGtcyTiJ57eV3s6R7A5MkVKvPBX`, target Preview, estado Ready.
- Usuario aprobó y autorizó producción. Se promovió exactamente esa Preview; deployment productivo `dpl_9swgyuZCdZ97UnEkhN6wam2u5Mbb` (`https://vendeplus-clean-di11mq79u-entrega2-s-projects.vercel.app`), estado Ready y alias oficiales asignados.
- Smoke productivo aprobado: Home, Marketplace, `/smash/checkout`, `/panel/pedidos` y `/panel/estadisticas` responden HTTP 200. Sin logs de error iniciales. No hubo migración ni SQL.
- Rollback web inmediato: `https://vendeplus-clean-fp4am6fvt-entrega2-s-projects.vercel.app`.

# Preview nocturna: Pedidos + logo delivery + notas separadas (2026-08-25)

- Usuario solicito terminar pruebas y dejar Preview para revisar al dia siguiente; produccion no debe tocarse hasta su aprobacion.
- Checkout: el logo de la empresa delivery ahora vive en un contenedor circular de 48 px, con recorte `object-cover`, fondo neutro, aro blanco y sombra leve. Esto evita que un archivo rectangular muestre relleno blanco lateral y conserva fallback con inicial.
- Checkout: elegir efectivo ya no cambia ni sustituye la nota general. Se muestran dos campos independientes: `cashPaymentNote` para moneda/cambio y `notes` para indicaciones del pedido.
- Persistencia: la informacion del efectivo se acepta solo cuando el metodo es efectivo, se limpia a 500 caracteres y se guarda en `orders.payment_notes` con filtros simultaneos por `id` y `store_id`. La columna ya existia; no hubo migracion ni SQL nuevo. La nota general permanece en `orders.notes`.
- Salidas: WhatsApp incluye la informacion del efectivo en una linea propia; Confirmacion usa el nuevo campo; el detalle del panel presenta `Nota del pedido` e `Informacion del efectivo` como bloques separados.
- Compatibilidad: pedidos/localStorage anteriores sin `cashPaymentNote` siguen funcionando porque las lecturas normalizan valores ausentes. No se alteraron precios ni reglas de delivery.
- Validaciones aprobadas: revision Next.js 16 y React, 51/51 contratos criticos, TypeScript, ESLint dirigido, `git diff --check` y build local Next.js 16.3.0 de 177 paginas.
- Preview conjunta: `https://vendeplus-clean-7xa70w6q1-entrega2-s-projects.vercel.app`, deployment `dpl_ByJMVxDvyTg12vxKzxHitbW1Pfex`, target Preview, Ready. Build remoto 177 paginas aprobado; `/smash/checkout`, `/panel/pedidos` y `/panel/estadisticas` HTTP 200 con cabeceras de seguridad; sin logs de error iniciales.
- La Preview incluye tambien la correccion de Realtime de Pedidos y Mesa/Barra del bloque siguiente. Prueba manual pendiente: usar un comercio afiliado a empresa delivery, agregar producto, elegir Delivery + Efectivo, escribir textos distintos en ambos campos, confirmar y comprobar logo circular, WhatsApp, aparicion del pedido sin refrescar y ambos bloques separados en el detalle.

# Correccion de llegada inmediata de pedidos en Preview (2026-08-24)

- El usuario confirmo que Estadisticas funciona, pero un pedido nuevo no aparecia en Pedidos hasta refrescar o cambiar de pestana.
- Diagnostico: el broadcast privado de Supabase, el trigger y la politica RLS funcionan (prueba autenticada real recibida en ~1,4 s), pero el cliente no supervisaba el estado de la suscripcion. Si Realtime fallaba o tardaba, el respaldo de 180 s hacia que la vista pareciera congelada. Mesa/Barra ademas usaba el topic no autorizado `store:<id>:table-order-alerts`.
- Correccion local: Pedidos y Mesa/Barra registran `SUBSCRIBED`; mientras Realtime no este confirmado o se desconecte sondean cada 15 s, y cuando esta sano vuelven a 180 s/120 s. Mesa/Barra ahora escucha el topic permitido `store:<id>:orders`.
- Validaciones aprobadas: QA autenticada de broadcast privado, TypeScript, ESLint dirigido, 50/50 contratos criticos, `git diff --check` y build local Next.js 16.3.0 de 177 paginas.
- Preview corregida: `https://vendeplus-clean-kq9l5cki1-entrega2-s-projects.vercel.app`, deployment `dpl_GCbi6TsT8SjdawDR4ijPmN7PXKKL`, target Preview, estado Ready. Build remoto aprobado, `/panel/pedidos` HTTP 200 con cabeceras de seguridad y sin logs de error iniciales.
- No hubo migracion ni SQL nuevo para esta correccion y produccion web permanece intacta.
- Proximo paso exacto: mantener `/panel/pedidos` abierto en esta Preview y crear un pedido desde otro dispositivo/incognito. Debe aparecer normalmente en ~1-3 s; si Realtime no conecta, en un maximo aproximado de 15 s, sin refrescar. Repetir en Mesa/Barra. No promover produccion sin aprobacion explicita.

# P1 estadisticas escalables para 5.000 pedidos/dia (2026-08-24)

- Implementacion local y Preview listas; produccion web permanece intacta.
- `/api/panel/stats` intenta ahora `panel_store_stats` con los `store_id` derivados exclusivamente de la sesion y la sede validada. La respuesta agregada no descarga pedidos ni items y deja `range.capped=false`.
- El despliegue es escalonado y seguro: la API exige `summary.aggregationVersion=2`; mientras la migracion no exista o la RPC falle, conserva el flujo anterior como fallback temporal.
- Nueva migracion aditiva `20260825024934_optimize_panel_store_stats_rpc.sql`: reemplaza solo la funcion, agrega en PostgreSQL sin limite de filas, excluye delivery de los ingresos del comercio, conserva aparte `deliveryFeesUsd`, excluye cancelados de graficas/listas operativas y devuelve solo 8 pedidos recientes.
- Seguridad: funcion `security invoker`, `store_id` siempre server-side, ejecucion revocada a `public`, `anon` y `authenticated`, concedida solo a `service_role`. No se agregaron tablas, RLS ni indices; los indices requeridos ya existen.
- Validaciones aprobadas: TypeScript, ESLint dirigido, 49/49 contratos criticos, `git diff --check`, dry-run remoto (solo esta migracion pendiente) y build Next.js 16.3.0 de 177 paginas.
- Validacion SQL remota en `BEGIN/ROLLBACK` aprobada: la funcion compilo, conteo e ingresos coincidieron con calculos independientes, recientes no supero 8 y permisos quedaron correctos. El rollback dejo `aggregationVersion=0`, confirmando cero persistencia de la prueba.
- Usuario autorizo avanzar y la migracion fue aplicada y registrada en Supabase remoto. Verificacion posterior independiente volvio a aprobar metricas y permisos. El lint remoto conserva solo el error interno preexistente de `extensions.index_advisor` por `hypopg_reset()` ausente.
- Preview `https://vendeplus-clean-ncah225sa-entrega2-s-projects.vercel.app`, deployment `dpl_GMHkXkABsjqi9dtPh2B1D685KFNb`, target Preview, estado Ready y build remoto de 177 paginas aprobado. `/panel/estadisticas` responde HTTP 200, API sin sesion rechaza correctamente y no hay logs de error ni HTTP 500.
- Prueba autenticada controlada aprobada contra el build local y Supabase remoto: usuario QA temporal limitado a un comercio recibio HTTP 200, `aggregationVersion=2`, `capped=false`, 8 recientes y cifras identicas a la RPC. Latencia observada desde este equipo: 2.715 ms. Limpieza independiente confirmo 0 usuarios y 0 membresias QA residuales.
- P2 polling preparado: Pedidos conserva Realtime privado y refresco al volver a una pestaña visible, pero su respaldo pasa de 30 a 180 segundos. Mesa/Barra conserva alerta Realtime y respaldo visible de 20 a 120 segundos. Por sesion abierta, ambos respaldos bajan de unas 300 a 50 solicitudes por hora (aprox. 83% menos).
- Nueva Preview conjunta `https://vendeplus-clean-qpo8ov7l9-entrega2-s-projects.vercel.app`, deployment `dpl_8PjyJD3Xngrxgpx66nDLZ2nug7JR`, target Preview, Ready. Build remoto de 177 paginas, Pedidos y Estadisticas HTTP 200, sin logs de error ni HTTP 500.
- Validacion visual automatizada local no estuvo disponible: ni `agent-browser` ni el navegador integrado estaban habilitados en esta sesion. Proximo paso exacto: validar con sesion real en la Preview conjunta Estadisticas, llegada inmediata de un pedido normal y alerta Mesa/Barra. Promover produccion solo con aprobacion explicita posterior.

# P0 rendimiento panel de empresas delivery (2026-08-19)

- Implementación local y Preview listas; producción intacta, sin migración ni SQL.
- Estados y asignaciones actualizan solo la fila afectada; se eliminaron las recargas completas de pedidos/panel y el recálculo de facturación desde la vista operativa.
- Realtime ignora durante 2 segundos únicamente el servicio mutado por el mismo navegador; cambios externos continúan invalidando la lista. Polling de respaldo pasó de 30 a 180 segundos.
- La lista dejó de pedir conteo exacto: usa `limit + 1`, devuelve 40 filas y determina `hasMore`. La API de estados dejó de usar `select(*)`.
- Las búsquedas de membresía por usuario y correo se ejecutan en paralelo después de validar el token; controles de rol y tenant permanecen.
- Validaciones: TypeScript, ESLint, 21/21 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas aprobados.
- Preview: `https://vendeplus-clean-li8qbnhhy-entrega2-s-projects.vercel.app`, deployment `dpl_2MpJGuoJ1y2hzfQDCQ2kKfLebUQt`, Ready, sin logs de error.
- Próximo paso exacto: validar con sesión real en `/transporte/panel/pedidos`: carga, cambio de estado, asignación, aparición inmediata del botón WhatsApp, filtros y recepción de un pedido externo. No promover sin aprobación explícita.
- Segunda fase preparada localmente: la navegación usa pestañas internas con `history.pushState`, conserva el panel montado y soporta Atrás/Adelante, eliminando “Cargando empresa delivery” entre módulos.
- Estados visibles simplificados por etapa: pendiente solo Aceptar/Rechazar; aceptado o asignado pasa a En camino/Novedad; En camino pasa a Entregado/Fallido/Novedad. Se habilitó server-side `pending_agency -> agency_rejected` y `driver_assigned -> on_the_way/delivered`, que antes podían dejar el flujo atascado.
- Nueva migración aditiva pendiente `20260820033000_mutate_transport_order_atomic_rpc.sql`: actualiza servicio, evento, pedido e integración en una sola transacción para estados y asignaciones. RPC revocada a `anon/authenticated`, solo `service_role`.
- Dry-run remoto de Supabase aprobado; no se aplicó SQL. TypeScript, ESLint, 22/22 contratos y build local de 167 páginas aprobados.
- Próximo paso exacto: con autorización explícita, validar la RPC en `BEGIN/ROLLBACK`, aplicar la migración aditiva y desplegar nueva Preview. El código nuevo no debe desplegarse antes de la RPC.

# Configuración opcional de cédula del cliente (2026-08-19)

- Migración aditiva aplicada y registrada en Supabase remoto; producción web permanece intacta.
- Nueva preferencia por comercio `request_customer_id_number`, apagada por defecto mediante la migración aditiva `20260820023000_add_customer_id_request_setting.sql`.
- El comercio puede activar “Solicitar cédula”. Checkout la muestra junto a nombre y teléfono, y la API la exige según la configuración real. Envío nacional conserva su requisito sin duplicar el campo.
- “Recordar mis datos” guarda y recupera la cédula solo cuando el comercio la solicita. Perfiles anteriores siguen siendo compatibles.
- La cédula queda en el detalle congelado del pedido, WhatsApp y confirmación.
- Verificación remota: 34 comercios, 0 con la opción activa y 34 apagados; no cambió el checkout de ninguno.
- TypeScript, ESLint, 20/20 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas aprobados sin fallback de catálogo.
- Preview: `https://vendeplus-clean-5uyoa8wdp-entrega2-s-projects.vercel.app`, deployment `dpl_2yrKfYoS54yioydCcKHAAxpzEwFq`, target Preview, estado Ready. Home HTTP 200; producción no fue promovida.
- Próximo paso exacto: validar en `/panel/configuracion` activar “Solicitar cédula”; abrir el checkout del comercio, comprobar campo/obligatoriedad y memoria; luego apagar y comprobar que desaparece. No promover a producción sin aprobación posterior.
- Ajuste posterior: la cédula ahora separa un selector `V / E / J` (V por defecto) y un campo exclusivamente numérico; se almacena normalizada como `V-12345678`. La API normaliza y valida el formato antes de crear el pedido.
- Nueva Preview: `https://vendeplus-clean-2iybb6fnu-entrega2-s-projects.vercel.app`, deployment `dpl_5aH276RVHr5woiq54W1HBM2iftdf`; build remoto de 167 páginas aprobado. Producción intacta.
- Usuario aprobó visualmente y autorizó producción. Promovida como `dpl_HQ8HsoFAFtRmS1YkSSmAu97CnwoJ` (`vendeplus-clean-qf0mex1x2-entrega2-s-projects.vercel.app`), estado Ready; dominios `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` asignados.
- Smoke productivo: Home, Marketplace, Smash, checkout Smash, login y Transporte HTTP 200; APIs protegidas de pedidos/configuración sin sesión HTTP 401 esperado. Sin logs de error iniciales.
- Rollback web disponible: `dpl_4khixG8RUcpaFzvuCdo4gtLkuxjU`. No hubo nueva migración durante la promoción; la preferencia de cédula sigue apagada en los 34 comercios hasta que cada comercio la active.

# P1 Open Graph 2026-08-17

# Auditoría de arquitectura para 5.000+ pedidos/día (2026-08-18)

## P0.1 tokens privados de Mesa / Barra (2026-08-18)

- Migración remota autorizada y aplicada el 2026-08-19; no hubo promoción a producción web, commit ni push.
- Los tokens QR se movieron a `private.store_table_order_tokens`, con RLS, privilegios exclusivos de `service_role` y funciones RPC inaccesibles para `anon`/`authenticated`.
- La migración genera tokens nuevos para todos los comercios. El código nuevo resuelve y valida esos tokens exclusivamente en servidor; mantiene un fallback temporal al campo legacy solo cuando las RPC aún no existen, para permitir un despliegue escalonado seguro.
- Página pública, estado de pedido, creación de pedido y API del panel ya usan el helper privado. No quedan lecturas directas del token público en la aplicación.
- Validación local: token privado nuevo funciona, token público anterior deja de resolver con el código nuevo, acceso anónimo a las RPC falla con `42501` y el panel autenticado recibe el token privado.
- Validaciones aprobadas: TypeScript, ESLint, 16/16 contratos críticos, contrato Entrega2, lint SQL local y build Next.js 16.3.0 de 167 páginas.
- `20260818054500_move_table_order_tokens_to_private.sql` quedó registrada en Supabase remoto. Verificación: 34/34 comercios con token privado, 34 tokens únicos, todos distintos al legacy; resolución server-side correcta y RPC anónima denegada con `42501`.
- La producción web actual conserva el código anterior y su QR legacy operativo (HTTP 200), por lo que la migración aditiva no interrumpió el servicio.
- Preview P0: `https://vendeplus-clean-dsdwjrxt8-entrega2-s-projects.vercel.app`, deployment `dpl_oBe2ukpPC3ZJPmWWiBeJeSKsEr66`, target Preview, estado Ready; build remoto limpio de 167 páginas aprobado.
- Smoke protegido de Preview: el QR privado nuevo reconoce el comercio y muestra el flujo Mesa / Barra; el token legacy no reconoce el comercio y devuelve la vista de no encontrado. Home consultado mediante bypass de Preview.
- Siguiente paso exacto: prueba manual del usuario en Preview, incluyendo obtener/regenerar el QR desde `/panel/mesas` y abrirlo en una sesión separada. No promover sin aprobación explícita.
- Usuario aprobó la prueba manual y la Preview fue promovida a producción el 2026-08-19 como `dpl_w6GifRf2NskVY5QfQMKPQYK7t8c8` (`vendeplus-clean-kzyf3kkdw-entrega2-s-projects.vercel.app`). Los dominios productivos apuntan al deployment nuevo en estado Ready.
- Smoke productivo aprobado: Home, Marketplace, Smash, login y Transporte HTTP 200; QR privado reconoce Smash y muestra Mesa / Barra; token legacy devuelve la vista de no encontrado; API del panel sin sesión 401; sin logs de error en el deployment.
- Siguiente paso exacto: respaldar este P0 con commit/push excluyendo `scripts/import-don-aniello-menu.mjs`; después preparar y validar una migración separada para eliminar `stores.table_order_token` y su índice legacy.
- P0 respaldado en GitHub: commit `f8da889` (`security: proteger tokens de mesa y barra`) publicado en `origin/main`; el importador de Don Aniello permaneció excluido.
- Limpieza legacy preparada localmente: el helper ya no tiene fallback a `stores.table_order_token` y la migración `20260819223000_drop_legacy_table_order_token.sql` elimina solamente el índice y la columna antiguos. No se aplicó SQL remoto.
- Validaciones de la limpieza: TypeScript, ESLint, 16/16 contratos críticos, contrato Entrega2 y build local/remoto de 167 páginas aprobados.
- Preview de limpieza legacy: `https://vendeplus-clean-7g4x50g9s-entrega2-s-projects.vercel.app`, deployment `dpl_9rtbND9y4vS7SEEFoBBMwCWDqnos`, estado Ready. Pendiente prueba manual del QR privado; no promover ni ejecutar la migración destructiva sin aprobación.
- Usuario aprobó la Preview de limpieza. Promovida a producción como `dpl_s5XG4Qzr9txZTXQTiDquBzRFVC8b` (`vendeplus-clean-hpaj0vp9r-entrega2-s-projects.vercel.app`), estado Ready y dominios productivos asignados.
- Antes del SQL, producción sin fallback aprobó Home, Marketplace, Smash, login, Transporte y QR privado. Luego se aplicó `20260819223000_drop_legacy_table_order_token.sql` en Supabase remoto.
- Cierre P0 verificado: `stores.table_order_token` ya no existe (`42703`), token privado presente, QR HTTP 200 reconociendo el comercio, panel sin sesión 401 y cero logs de error del deployment. El lint remoto conserva solo el fallo interno conocido de `extensions.index_advisor` por `hypopg_reset()`.
- Siguiente prioridad: P0 de atomicidad de pedidos. Auditar y diseñar una función PostgreSQL transaccional e idempotente para pedido público y manual; implementar y probar local/Preview antes de cualquier SQL o promoción adicional.
- Impacto operativo al promover el código: los QR impresos o compartidos anteriormente deben regenerarse porque el token se rota. Luego de verificar producción, una migración separada debe eliminar `stores.table_order_token` y su índice para cerrar definitivamente la exposición.

- Auditoría solo lectura; no se modificó producción ni código funcional.
- Capacidad actual: 5.000 pedidos/día son 0,058 pedidos/s promedio; el stack Vercel + Supabase puede soportarlo, pero el sistema aún no debe declararse listo para picos sin corregir P0/P1.
- P0 seguridad confirmado con cliente anónimo: `stores` concede SELECT público a toda la tabla y expone `table_order_token`. Se pudieron leer tokens no nulos de los 31 comercios activos; 1 tiene Mesas habilitado. No se mostraron ni guardaron los tokens. Separar el token en tabla privada o restringir columnas/usar API pública con DTO y rotar tokens.
- P0 consistencia: `/api/orders` inserta `orders`, `order_items`, `order_item_options` y cliente en operaciones separadas. Hay limpieza compensatoria, pero una terminación entre pasos puede dejar pedidos incompletos. Migrar la escritura a una función PostgreSQL transaccional e idempotente. El pedido manual repite el mismo patrón.
- P1 catálogo: `getPublicStores()` hidrata delivery con 3 consultas por comercio mediante `Promise.all` (N+1). Con 31 comercios activos una regeneración puede lanzar ~93 consultas adicionales. Cambiar a 3 consultas masivas y agrupar por `store_id`.
- P1 infraestructura: Vercel ejecuta en `iad1`, mientras Supabase producción está en AWS `us-west-2`; probar Preview en `sfo1` contra `iad1` y fijar la región ganadora por p95.
- P1 proveedores: llamadas Entrega2 no tienen timeout/AbortSignal; ya hubo una espera real de ~60,7 s. Definir timeout corto, circuit breaker y fallback inmediato. Nominatim también carece de timeout.
- P1 estadísticas: `/api/panel/stats` descarga y agrega pedidos en Node y limita a 1.000; con 5.000/día devuelve cifras truncadas. Mover agregaciones a SQL/RPC y materializaciones por día/comercio.
- P1 observabilidad/DR: no hay APM/alertas operativas persistentes; logs informativos dependen de `ENABLE_API_EVENT_LOGS`. Hay backup DB validado, pero recuperabilidad de Storage sigue pendiente y no consta PITR habilitado. Definir SLO, alertas, PITR y prueba periódica de restauración DB + Storage.
- P2 panel: `OrdersManager` sondea cada 30 s además de Realtime; `TableOrderNotifier` cada 20 s. Reducir a Realtime con sondeo adaptativo solo como respaldo para evitar carga multiplicada por sesiones abiertas.
- P2 rate limits: el límite de pedidos por IP/comercio puede bloquear muchos pedidos de Mesa/Barra compartiendo Wi-Fi/NAT. Hacer prueba de pico y ajustar por modalidad sin debilitar abuso.
- P2 mantenibilidad: rutas críticas muy grandes (`panel/orders` ~1.085 líneas, `orders` ~954, `stats` ~667); separar servicios y agregar integración real, caos y carga de escritura.
- Base remota saludable y pequeña: 28 MB, 1.242 pedidos estimados, 1.724 items, hit rate de tablas/índices 1,00, sin consultas largas ni bloqueo relevante; 11 conexiones de authenticator sobre límite 60. Esto no simula todavía 5.000 pedidos/día.
- Vercel: deployment productivo Ready; sin logs error ni 5xx en 24 h. Lecturas secuenciales públicas: TTFB ~0,94-1,31 s. Smoke de 10 concurrentes devolvió todo 200 pero p95 ~10,6 s desde este entorno; requiere prueba k6/Artillery desde región controlada antes de usarlo como capacidad.
- Seguridad positiva: precios/opciones/delivery se recalculan en servidor, idempotencia por comercio, rate limit distribuido, APIs panel/admin con controles multi-tenant, webhooks Entrega2 con secreto, RLS sin escrituras públicas de pedidos. `npm audit --omit=dev`: 0 vulnerabilidades; no se detectaron secretos versionados.
- Validación: ESLint aprobado, 15/15 contratos críticos, contrato Entrega2 y build Next.js 16.3.0 de 167 páginas aprobados.
- Orden recomendado: 1) cerrar/rotar token Mesas; 2) transacción atómica de pedidos; 3) timeouts/circuit breaker; 4) eliminar N+1; 5) SQL de estadísticas; 6) región y pruebas de carga; 7) alertas/PITR/restore; 8) sondeo adaptativo.

# Opciones La Cremita Gourmet (2026-08-18)

- Respaldo previo completo: `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-18\la-cremita-gourmet-before-flavor-options.json`; SHA-256 `59ee60ab699394e25e4336b78964729e3f393244a0d43d6d96d753c941b4c8f7`.
- Grupo obligatorio `Sabores de chantilly` asignado solo a `Fresas con crema`: Chantilly tradicional, Chantilly Pistacho y Chantilly Oreo, todos USD 0; permite seleccionar mínimo 1 y máximo 2.
- Grupo obligatorio `Tipo de chocolate` asignado a `Fresas con Chocolate` y `Fresas Dubai`: Chocolate blanco, Chocolate oscuro y Chocolate combinado, todos USD 0; exige exactamente 1.
- Los grupos existentes Toppings, Untar y Toppings Extras permanecieron intactos.
- API pública productiva verificada para los tres productos: grupos, obligatoriedad, límites y precios correctos.
- No hubo cambios de código, migración, SQL, commit, push ni despliegue.

# Curaduría productiva Don Aniello (2026-08-18)

- Usuario aprobó la propuesta basada en ventas visibles del 2026-05-01 al 2026-07-31. La suma visible fue 1.362 unidades aunque el archivo indicaba total 3.935; la selección se basó en las filas visibles aprobadas.
- Respaldo previo completo del catálogo: `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-18\don-aniello-catalog-before-sales-curation.json`; SHA-256 `809ab448cfc325c3a3aba26d17a6f7940e5ed698177d5bbae4fe4fcbc2d6c83a`.
- Resultado remoto verificado: 108 productos totales, 66 activos y 42 ocultos. Se conservaron/actualizaron 49 productos existentes y se agregaron 17 productos vendidos que faltaban.
- `Gnocchi Napolitano` fue agregado como producto distinto; `Gnocchi di Zucca` quedó oculto.
- Exactamente cinco destacados, cubriendo tres categorías: Margherita Classica, Charcutera, Refrescos, Tricolor y Lomito alla Griglia. `Menú de la Nonna` está activo en `Promo` a USD 17, pero no destacado para respetar el límite de cinco.
- Grupo `Extras para pizzas`: 12 extras con precio, asignado a 21 productos activos de Pizze.
- Grupo obligatorio `Contorno incluido`: Vegetales, Puré de papa, Papas rústicas y Papas fritas, todos USD 0, asignado a 8 proteínas activas.
- Grupo obligatorio `Tipo de pasta`: Penne, Linguini y Spaghetti, todos USD 0, asignado a 10 pastas activas.
- `Alternativa de pasta` quedó inactiva y sin asignaciones; Sin gluten/Tiras de calabacín ya no aparecen.
- Auditoría comprobó 0 productos ocultos asociados a los grupos nuevos. Catálogo público HTTP 200 con caché renovada: muestra Menú de la Nonna y Gnocchi Napolitano, y no muestra Marinara Original.
- API pública verificada: Margherita devuelve 12 extras, Lomito 4 contornos y Fettuccine 3 tipos de pasta.
- No hubo cambios de código, migración, SQL, commit, push ni despliegue. El único archivo no versionado sigue siendo `scripts/import-don-aniello-menu.mjs`, excluido por indicación del usuario.
- Segunda curaduría aprobada: ocultar todo producto activo con 7 ventas o menos y retirar Café por completo, sin ocultar ningún otro producto con 8 o más ventas. Respaldo previo: `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-18\don-aniello-catalog-before-second-curation.json`, SHA-256 `6ef375b9b8030c06efb08d5fccd8dc79734c8e0583c1f9b1c10c3e18b2cbdf8c`.
- Se ocultaron 12 adicionales: Quattro Estagioni, Panzerotti Charcutero, Focaccia Mortadella Italiana, Risotto di Funghi, Filetto di Mero, Panna Cotta, Profiterol, Ración de Tequeños, Agua Mineral 335 ml, Limón, Caffè Latte y Caffè Marrone. La categoría Caffè quedó inactiva.
- Resultado final de esta regla: 108 productos totales, 54 activos y 54 ocultos; siguen exactamente 5 destacados. No es posible bajar de 50 sin ocultar al menos cinco productos con 8 ventas o más.
- Grupos limpiados y verificados: 19 pizzas con extras, 7 proteínas con contorno, 10 pastas con tipo; 0 asignaciones a productos ocultos. Catálogo público renovado y HTTP 200: Cafè, Quattro Estagioni y Tequeños ya no aparecen; Menú de la Nonna y Margherita permanecen.

- Causa confirmada en logs: `ImageResponse` no admite directamente logos WebP de Supabase.
- La ruta OG pasa a Node.js, restringe imágenes a HTTPS del dominio público o `*.supabase.co`, limita descargas a 5 MB y convierte a PNG con Sharp.
- Si la imagen falla, muestra la inicial del comercio y evita romper la generación.

# Punto de reanudacion

## Pedidos en Mesa V1 local (2026-08-16)

- Rama local: `agent/table-orders-v1`; sin commit, push, preview ni cambios en produccion.
- Se implemento un QR unico y estable por comercio; al escanearlo el cliente elige una mesa activa.
- Piloto limitado en servidor a Smash. Incluye configuracion, mesas/zonas, pagos prepagados, selector publico, checkout `table`, snapshots de mesa y seguimiento de estado.
- Migracion local aplicada: `20260816040501_table_orders_v1.sql`. No se aplico SQL remoto.
- E2E local aprobado: Mesa 1, producto USD 8, Pago movil; pedido `VP-0816-3VV` guardado con `delivery_type=table`, mesa/zona congeladas y estado actualizado de `received` a `ready`.
- Seguridad local: token falso 404, acceso anonimo directo a `store_tables` denegado y `supabase db lint --local --level error` sin hallazgos.
- Validaciones finales: ESLint, 8/8 contratos criticos y `npm.cmd run build` aprobados.
- Servidor local: `http://localhost:3101`; QR de prueba: `/smash/mesa/22222222-2222-4222-8222-222222222222`.
- Usuario local: `smash-local@somos.test`; clave: `[RETIRADO: rotación pendiente]`. El respaldo base no incluye la migracion posterior de anuncios, por lo que esa API auxiliar responde 500 solo en este entorno aislado.
- Siguiente paso: prueba manual del usuario. No desplegar ni aplicar la migracion en produccion sin aprobacion explicita.
- Ajuste posterior local: checkout ya no muestra `Sin delivery` ni la fila de delivery para Mesa, Retiro o Envio nacional.
- `/panel/mesas` lista todos los pedidos activos por mesa, con cliente, pago, total, estado y acciones para avanzar o cancelar. Cambio de `received` a `accepted` verificado en navegador y restaurado para continuar la prueba.
- `/panel/pedidos` tiene filtros rapidos `Todos los pedidos`, `Excluir mesas` y `Solo mesas`; la exclusion se ejecuta en servidor antes de paginar.
- Solo para pedidos en mesa, confirmar ya no redirige automaticamente a WhatsApp: navega a `/confirmacion`, conserva el seguimiento visible y deja WhatsApp como accion secundaria en otra pestaña. E2E local aprobado en Mesa 2.
- Confirmacion ajustada: titulo general `Pedido enviado`; para Mesa indica que el seguimiento continua en la pantalla y no promete confirmacion por WhatsApp. E2E local verificado.
- Fee de Mesa verificado con replica local de Smash (Test): plan `per_service`, cliente paga USD 0.10; pedido QA guardo subtotal USD 2.00, fee USD 0.10 y total USD 2.10.
- La replica local de Smash (Test) usa sus 3 categorias y 5 productos publicos reales con imagenes; no se modificaron datos remotos.
- Nueva migracion local `20260816063446_update_legacy_default_store_palette.sql`: cambia solo las dos combinaciones exactas de defaults antiguos a teal/naranja/navy y actualiza defaults futuros; paletas personalizadas quedan intactas. No aplicada en produccion.

## Continuidad entre computadoras (2026-08-15)

- Punto de seguridad local publicado en GitHub en la rama `agent/audit-critical-hardening`.
- Commit: `3b1704e` (`checkpoint: respaldar avances locales de Somos`).
- Build, ESLint y 8/8 contratos criticos aprobados antes de publicar.
- No hubo despliegue a Vercel ni cambios en produccion.
- El unico archivo local no versionado es `scripts/import-don-aniello-menu.mjs`, excluido por ser un importador temporal.

## Idea pendiente: referidos para influencers

- No implementar hasta nueva indicación del usuario.
- Cada influencer tendrá código y enlace de registro.
- Comisión propuesta: 50% de pagos realmente aprobados durante los primeros 3 meses del comercio referido.
- Aplica a mensualidades y fees pagados; excluye pendientes, rechazados y comercios `is_test`.
- Panel ligero del influencer: referidos, ingresos generados, comisión pendiente y pagada.
- Mantener historial contable congelado por pago y acceso privado con Supabase Auth.

Actualizado: 2026-08-09, despues del despliegue a produccion

## Objetivo actual

Validar los cambios pendientes del registro de comercios y los requisitos para aparecer en Somos.

## Cambios locales pendientes

- `src/components/public/SignupForm.tsx`: solicita nombre y cedula del representante y logo obligatorio JPG/PNG/WebP de hasta 2 MB; envia el registro como `FormData`.
- `src/app/api/signup/route.ts`: valida esos campos en servidor, normaliza la cedula, carga el logo en `product-images`, guarda su URL, crea el perfil del representante y limpia usuario/comercio/logo si el flujo falla. Tambien reintenta recuperar el usuario creado cuando Auth no devuelve inmediatamente su ID.
- `src/lib/supabase/catalog.ts`: Somos solo muestra comercios con suscripcion vigente, logo y al menos un producto con precio mayor que cero; aplica igualmente al marketplace de agencias de transporte.
- `supabase/migrations/20260809011159_commerce_registration_and_marketplace_requirements.sql`: crea `store_registration_profiles` con RLS y la funcion `marketplace_eligible_store_ids`.

## Estado confirmado

- Proyecto correcto: `C:\Users\Windows\Desktop\RESPALDOS\vendeplus-clean`.
- Rama: `main`, commit base `f54fd79`.
- Los cuatro archivos anteriores contienen cambios sin commit.
- Docker 29.6.2 y Docker Compose 5.3.1 estan instalados despues del reinicio.
- La migracion fue aplicada correctamente sobre una copia local del esquema de produccion.
- RLS y las dos politicas de `store_registration_profiles` fueron verificadas.
- La funcion de elegibilidad devolvio solo el comercio con logo y un producto de precio mayor que cero.
- Registro E2E aprobado: HTTP 201; creo usuario Auth, comercio, owner, perfil y logo en Storage.
- El comercio no aparecio antes de tener producto y si aparecio en `/marketplace` despues de agregar un producto de USD 10.
- `npm.cmd run build` termino correctamente.
- Advisors locales de seguridad y rendimiento: sin problemas.
- Limitacion local observada: `next/image` no permite `127.0.0.1` como host de imagen; no afecta la URL de Storage de produccion.
- Problema previo del repositorio: las migraciones no incluyen el esquema base, por lo que `supabase start` directo falla antes de llegar a la migracion nueva. Para la prueba se uso un baseline temporal obtenido con `db dump --linked` sin datos ni escrituras remotas.
- Migracion `20260809011159` aplicada y verificada en el Supabase remoto enlazado.
- Advisors remotos de seguridad: sin problemas.
- Preview Vercel lista: `https://vendeplus-clean-i8xyiw6br-entrega2-s-projects.vercel.app`.
- La preview esta protegida por SSO de Vercel; requiere iniciar sesion con la cuenta autorizada.
- Smoke test autenticado aprobado en `/registro`; el HTML contiene nombre y cedula del representante y carga de logo.
- Deployment ID: `dpl_2orXwi4Gfhma2TqLA8WQy4SZsx15`.
- Preview aprobada por el usuario y promovida a produccion.
- Deployment de produccion: `dpl_CvYJtS4hK3jMg52ZeTY1Q1Rg5Pz9`.
- Dominio publico verificado: `https://www.somos-ve.com`.
- Smoke test posdespliegue: `/registro` HTTP 200 y `/marketplace` HTTP 200.
- Formulario productivo verificado con nombre y cedula del representante y logo del comercio.
- Logs de Vercel nivel error de la ultima hora: 0 resultados.
- Los cambios siguen sin commit ni push a GitHub; un despliegue futuro desde `origin/main` podria reemplazarlos.

## Siguiente paso exacto

Prioridad operativa pendiente: versionar los cambios actuales en Git y publicarlos en GitHub para que `origin/main` coincida con produccion. Requiere autorizacion explicita para commit y push.

Plan futuro aprobado: modulo opcional de cadenas documentado en `docs/MODULO_CADENAS_PLAN.md`. No implementar codigo ni migraciones hasta que el usuario lo indique expresamente.
# Trabajo actual: Logros Somos (2026-08-09)

- Implementada localmente la primera versión del sistema de logros permanentes.
- Nueva pantalla: `/panel/logros`.
- Seis logros: configuración/delivery, 10 pedidos/estadísticas básicas, 50 pedidos/estadísticas completas + 50 productos, referido/colores, promoción + 20 ventas/clientes, 3 promociones + 3 meses/detalle de clientes.
- Nuevos registros quedan limitados a 25 productos publicados; al completar 50 pedidos suben a 50.
- Comercios existentes recibieron los seis beneficios como `inherited`.
- Migración remota aplicada: `20260809132811_store_achievements_and_unlocks.sql`.
- Verificación remota: 29 comercios, 174 desbloqueos heredados.
- Build, TypeScript y ESLint aprobados.
- Servidor local para prueba: `http://localhost:3000/panel/logros`.
- Código todavía NO desplegado a Vercel/producción.

## Ajuste posterior de logros

- Nuevos comercios inician con 30 productos publicados.
- 50 pedidos + 20 clientes únicos desbloquean estadísticas completas.
- Nuevo logro: 100 pedidos + 35 clientes únicos desbloquean 20 productos adicionales (50 total).
- 10 pedidos requieren 5 clientes únicos; promoción + 20 ventas requiere 10 clientes únicos.
- Super Admin puede habilitar individualmente cualquier recompensa desde la ficha del comercio.
- Super Admin también puede retirar cualquier recompensa. Se registra un reinicio por logro y solo la actividad posterior vuelve a contar; al retirar el aumento de catálogo el límite regresa a 30 sin borrar productos existentes.
- El logro de referido ya no exige una venta: se completa cuando el comercio referido se registra y un propietario/administrador queda autorizado mediante la confirmación de correo de Super Admin.
- Sistema de logros desplegado a producción el 2026-08-09: `dpl_8gJpcELyqmd3JC1vHhd1bzp8EZbj`, alias `https://www.somos-ve.com`.
- Auditoría posterior al despliegue: 29 comercios; todos conservan sus siete recompensas salvo Smash, que mantiene exactamente los dos reinicios administrativos probados (`referral_brand_colors` y `promos_3_three_months_customer_details`).

## Retos temporales de agosto 2026

- Implementados localmente dos retos vigentes del 10 al 31 de agosto: descuento + primera venta del producto, y Comercio rápido (mínimo 10 pedidos, 90% respondidos en 15 minutos).
- La recompensa del primer reto destaca el producto 7 días en una nueva sección del Marketplace; la segunda muestra la insignia Comercio rápido durante septiembre.
- Se registran automáticamente `first_responded_at` y `completed_at` en pedidos, y eventos reales de activación de descuento.
- Super Admin puede retirar o reactivar recompensas mensuales ya ganadas desde la ficha del comercio.
- El acceso Logros quedó destacado con estrella, brillo y gradiente en la navegación de escritorio y móvil.
- Migración remota aplicada: `20260810035004_august_monthly_challenges.sql`.
- Código todavía no desplegado a Vercel. Pruebas locales: `/panel/logros`, `/marketplace`, `/admin/comercios`.
- Ajuste posterior: el reto de descuento se gana inmediatamente al activar un descuento nuevo; ya no requiere venta. Migración remota `20260810041345_simplify_august_discount_challenge.sql`.
- En `/panel/logros`, las recompensas temporales aparecen primero y todas las tarjetas se compactaron (cuatro columnas en pantallas amplias para los logros permanentes).
- La sección pública de Productos destacados se compactó a tarjetas horizontales pequeñas en dos columnas.
- Retos de agosto y ajustes visuales desplegados a producción: `dpl_CwKJGvYNAYBYZhdGcN2mFPHJvTDJ`, alias `https://www.somos-ve.com`.
- Verificación posterior: Marketplace, Logros, Super Admin y Registro responden 200; sin errores recientes de Vercel; se preservaron 60 reinicios administrativos y existe 1 recompensa mensual ganada.
- Migración incremental remota aplicada: `20260809140035_split_product_limit_achievement.sql`.
- Migración incremental remota aplicada: `20260809142220_reset_revoked_achievements.sql`.
- Corrección remota aplicada: `20260810005351_add_store_product_update_timestamps.sql`; agrega `updated_at` automático a comercios y productos para reiniciar correctamente el logro de configuración.
- Los 29 comercios existentes recibieron también la recompensa nueva como heredada.
## Hotfix Entrega2 - telefonos invertidos (2026-08-12)

- Causa: `buildEntrega2Payload` enviaba `stores.whatsapp` como `telefono_contacto` y `order.customer_phone` como `telefono_comercio`.
- Correccion: cliente -> `telefono_contacto`; comercio -> `telefono_comercio`.
- Archivo funcional: `src/app/api/panel/orders/[orderId]/send-delivery/route.ts`.
- Validaciones: 8/8 contratos criticos, ESLint dirigido y `npm.cmd run build` exitosos; preview y produccion Vercel `Ready`.
- GitHub: commit `2e35b0c` en `origin/main`.
- Produccion: deployment `dpl_EYRz5PtNPH1WuTVjJtA5f8skRcZa`, aliases `somos-ve.com` y `www.somos-ve.com`.
- No se reenvio el pedido previo ni se creo un delivery real de prueba. Proximo pedido enviado a Entrega2 usara el mapeo corregido.

## Idea multisedes pendiente de decision (2026-08-12)

- Se compararon dos modelos: central con cada sede como `store`, y una marca con menu unico mas sedes internas mediante `branch_id`.
- Preferencia preliminar a largo plazo: marca con sedes internas; valoracion 7.8/10 frente a 7.3/10 para central + stores.
- La alternativa central + stores conserva menor riesgo y mayor compatibilidad inmediata.
- Analisis y condiciones guardados en `docs/MODULO_CADENAS_PLAN.md`.
- No se implemento codigo, migracion ni cambios en Supabase. Esperar decision y autorizacion expresa del usuario.

## P0 crecimiento - cierre operativo (2026-08-12)

- GitHub `origin/main` y produccion quedaron en `b608962`.
- Se versiono la migracion remota faltante `20260811151611_add_test_store_financial_metrics.sql`.
- Se aplico y versiono `20260813014423_add_order_idempotency.sql`.
- Checkout: clave idempotente unica por comercio; reintentos concurrentes devuelven el mismo pedido.
- Entrega2: adquisicion atomica de `sending`; dos solicitudes simultaneas no pueden llamar al proveedor.
- Prueba productiva controlada: 5/5 pedidos QA correctos; precios, delivery y pagos recalculados en servidor.
- Prueba idempotente: 2 solicitudes simultaneas, 2 respuestas 200, mismo orderId y 1 fila persistida.
- Load smoke concurrencia 10: sin errores; p95 catalogo ~3.3 s y `/transporte` ~6.1 s.
- Recursos QA eliminados y verificados: 0 tiendas, 0 agencias y 0 pedidos residuales.
- Produccion Vercel `dpl_Am3Rqr4ooh3CeW9fPyyJFxt6dnwR` en estado Ready.
- Monitoreo avanzado Vercel bloqueado por 403 del plan/permisos; logs basicos disponibles.
- Backup DB no completado: `supabase db dump` requiere Docker Desktop activo en este entorno.
- Backup Storage parcial: 179 archivos / ~35.7 MB, sin manifiesto final por limite de 5 minutos; no cuenta como backup recuperable.
- Pendiente P0 externo: habilitar Docker o backups gestionados y ejecutar dump + restauracion aislada; definir monitoreo/alertas con plan compatible o Sentry.

## Cierre P0 y auditoria inicial del panel (2026-08-13)

- `origin/main` quedo en `d5c3edb`; incluye el checkout simplificado (`c7d93be`) y el contrato automatico de prioridad del delivery externo.
- Produccion conserva prioridad Entrega2/empresa delivery sobre zonas propias; Smash verificado sin selector de zonas.
- Backup remoto de DB generado en `C:\Users\Windows\Desktop\RESPALDOS\somos-backups\2026-08-13`: `schema.sql` (124909 bytes) y `data.sql` (3726008 bytes), ambos con SHA256 calculado.
- Pendiente para declarar recuperabilidad completa: restaurar el dump en una instancia aislada y completar backup verificable de Storage.
- Logs Vercel de produccion, nivel error, ultima hora: sin resultados.
- Auditoria inicial del panel: cada cambio de modulo dispara de nuevo `/api/panel/settings` desde `PanelFrame`; luego el modulo monta y pide su propia API. `PanelAuthProvider` ya carga `/api/panel/context`, pero no comparte el estado necesario. Este waterfall es la causa principal percibida.
- Otras causas: `PanelStoreIdentity` vuelve a pedir settings, no hay cache/prefetch de APIs de modulos, y el selector de comercio usa `window.location.reload()`.
- Siguiente paso recomendado: unificar contexto/suscripcion en `PanelAuthProvider`, eliminar fetch repetido por ruta, mantener el shell estable, agregar estados instantaneos y medir navegacion/API antes y despues. Probar local, preview y produccion.

## Respaldo Somos en Google Drive (2026-08-14)

- Reintento completado en la cuenta de Google Drive conectada (`bddentrega2@gmail.com`).
- Carpeta: `vendeplus-backups/somos-database-2026-08-13`.
- URL: `https://drive.google.com/drive/folders/1ppV7mVPRkCBkkYxZTR6rZ1Dl1VGDlq2k`.
- `schema.sql`: 124909 bytes; SHA256 `D35C737AB06D50F073F7F6AD308F27891E86CEA511FC4E48092307CF2E4F9F8B`.
- `data.sql`: 3726008 bytes; SHA256 `8ECA6B8A0392C58791C1C6B32083DEFB8100DB71A0168FB5FF96CF0A8A58EEC8`.
- Drive confirmo ambos archivos, nombres y tamanos tras la carga.
- Pendiente para recuperabilidad completa: restaurar la base en una instancia aislada y generar/verificar un respaldo actual de Supabase Storage.

## Pedido manual y notificaciones del panel (2026-08-15)

- Pedido manual habilitado en producción desde `/panel/pedidos`, con Delivery, Retiro, Mesa y Barra, opciones/extras y filtros por modalidad.
- Super Admin puede publicar y pausar novedades, retos, nuevas funciones o avisos importantes desde `/admin/notificaciones`.
- Los avisos activos aparecen en la parte superior de todas las pantallas del panel y cada comercio puede cerrarlos en su navegador.
- Migración remota aplicada: `20260815181515_create_panel_announcements.sql`; tabla verificada mediante acceso de servidor y sin filas de prueba.
- Build local y Vercel aprobados; TypeScript, ESLint, 8 contratos críticos y contrato Entrega2 aprobados.
- Producción: `dpl_7Jp9gZrmADUcbJHWbvqyaYFe22Ad`, estado Ready, alias `https://www.somos-ve.com`.
- Smoke test: Pedidos, Pedido manual y Admin Notificaciones HTTP 200; API de avisos sin sesión HTTP 401 como corresponde; sin errores recientes en logs.
- No se publicó una notificación de prueba para no avisar a comercios reales sin contenido aprobado.
- Ajuste final desplegado: campana flotante permanente; muestra contador de avisos nuevos, conserva los avisos activos para releerlos y muestra `Sin mensajes` cuando no hay publicaciones.
- Regla acordada con el usuario: toda modificación futura debe implementarse y probarse primero en local. No desplegar a producción hasta recibir aprobación explícita después de la prueba local.

## Optimización local de navegación (2026-08-15)

- Trabajo solo local, todavía sin commit, push ni despliegue.
- Se eliminó `force-dynamic`/`revalidate = 0` de pantallas cliente de Registro, Login, Panel, Admin y Transporte Panel.
- `/transporte` usa regeneración de 60 segundos.
- Se eliminó el middleware global duplicado; encabezados de seguridad permanecen en `next.config.ts` y `X-Robots-Tag` se aplica específicamente a `/panel` y `/admin`.
- Build confirmó que las pantallas pasan de dinámicas a estáticas; APIs siguen dinámicas y protegidas.
- TypeScript, ESLint, 8 contratos críticos y build aprobados. API de contexto sin sesión continúa respondiendo 401.
- Medición producción previa: TTFB aproximado 1.1–1.8 s; `/transporte` hasta 2.7 s total.
- Medición producción local optimizada en puerto 3100: primera carga 0.017–0.10 s normalmente; siguientes 0.004–0.009 s; `/transporte` 0.064 s inicial y ~0.005 s en caché.
- Servidor de prueba: `http://127.0.0.1:3100`. Siguiente paso: usuario inicia sesión y prueba navegación y carga real de datos; no desplegar sin su aprobación.
- Segunda fase local: autenticación de APIs del panel cambió de `auth.getUser()` remoto en cada solicitud a `auth.getClaims()` con verificación criptográfica ES256 y caché de claves públicas, recomendada por Supabase.
- `/api/panel/context` inicia en paralelo la consulta de comercios y el permiso de Estadísticas cuando conoce el comercio autorizado.
- Segunda fase aprobó TypeScript, ESLint, 8 contratos críticos y build. Servidor local reiniciado en puerto 3100; pantalla Pedidos ~0.066 s y API sin sesión sigue bloqueada con 401.
- Tercera fase local tras confirmar que los datos internos seguían lentos: medición directa detectó ~0,6–0,75 s por viaje caliente a Supabase y ~3 s en el primer viaje frío.
- `src/lib/panel/auth.ts` reutiliza durante 10 segundos solo las membresías positivas ya verificadas; una revocación puede tardar como máximo ese tiempo en reflejarse. JWT, acceso y filtros `store_id` se siguen validando.
- Pedidos consulta integraciones y transporte en paralelo; Clientes consulta el desbloqueo puntual en vez de recalcular todos los logros; Estadísticas inicia en paralelo permisos, comercios, pedidos, productos, clientes y estado de logros.
- Tercera fase aprobó TypeScript, ESLint, 8 contratos críticos y build completo. Servidor local actualizado en `http://127.0.0.1:3100`.
- Siguiente paso exacto: el usuario debe recargar el panel local e iniciar sesión si hace falta; comparar especialmente Pedidos, Clientes y Estadísticas. No hay commit, push ni despliegue; no desplegar sin aprobación explícita.
- Cuarta fase local: la lista compacta de Pedidos obtiene integraciones y transporte dentro de la consulta principal, eliminando el segundo viaje secuencial. Medición directa caliente: ~0,92–1,09 s frente a ~1,35–1,40 s anterior; primera consulta fría aún puede superar 5 s por conexión remota.
- Pedidos y Estadísticas ahora usan el caché común que Clientes/Inicio ya utilizaban. El caché sobrevive al cambio de módulo, se invalida al modificar datos y las actualizaciones forzadas de Pedidos omiten el caché.
- Los accesos de navegación a Pedidos, Clientes y Estadísticas precargan datos al pasar el puntero o tocar el enlace; la clave incluye las cabeceras de sesión/comercio para no mezclar tenants.
- Cuarta fase aprobó TypeScript, ESLint dirigido, 8 contratos críticos y build completo. Consulta anidada de Supabase verificada con datos reales sin escrituras. Servidor local actualizado en `http://127.0.0.1:3100`.
- Siguiente paso exacto: usuario debe hacer `Ctrl + F5`, probar primero Pedidos y luego salir/volver a Pedidos, Clientes y Estadísticas. Evaluar tanto primera carga como retorno cacheado. No desplegar sin aprobación explícita.

## Auditoría defensiva de seguridad (2026-08-15)

- Auditoría solo lectura; no se modificó código, Supabase ni producción.
- Producción confirmó 401 sin sesión en APIs de Panel, Admin y Transporte; HSTS, `X-Frame-Options: DENY`, `nosniff`, política de permisos y referrer policy activos.
- No se encontraron secretos reales versionados. Service role permanece encapsulado en servidor. Webhooks Entrega2, cron, uploads, pedidos y registros conservan autenticación/límites de tamaño o abuso.
- Riesgo alto operativo: `npm audit` reporta `js-yaml 4.3.0` y `nanoid 3.3.17` con alertas altas de denegación de servicio; ambas son indirectas y tienen corrección disponible.
- Riesgo medio: no existe Content-Security-Policy y el token del panel vive en `sessionStorage`; una futura inyección XSS podría robar la sesión. Recomendado CSP estricta y, en una fase posterior, cookies `HttpOnly`.
- Riesgo medio: respuestas 401 de APIs productivas declaran `Cache-Control: public`; aunque Vercel reportó `MISS`, conviene imponer `private, no-store` a todas las APIs autenticadas.
- Riesgo bajo/robustez: el smoke productivo espera 400 ante registro vacío pero `/api/signup` respondió 500. La API no expuso detalles, pero debe cerrar con validación 400.
- El contrato automático marcó `/api/panel/announcements` por no usar literalmente `requirePanelAuth`, pero revisión manual confirmó que llama `getPanelAuthContext` y devuelve 401 sin sesión; es falso positivo del test.
- `supabase db lint --linked` no encontró errores del esquema de la aplicación; solo dos avisos internos de `extensions.index_advisor`. El conector de Advisors de seguridad no tuvo permiso para consultar.
- 8/8 contratos críticos aprobados. Pendiente recomendado: corregir primero dependencias, CSP/caché de APIs y validación vacía de signup, todo local antes de desplegar.
- Correcciones urgentes implementadas localmente: `js-yaml` 4.3.1 y `nanoid` 3.3.18; `npm audit` reporta 0 vulnerabilidades.
- `next.config.ts` agrega CSP, incluyendo bloqueo de objetos, frames, base externa y conexiones fuera de Somos/Supabase; en desarrollo permite `unsafe-eval`, en producción no. Next requiere todavía `unsafe-inline`, por lo que una futura fase con nonce/cookies HttpOnly sigue siendo recomendable.
- Todas las rutas `/api/*` reciben `Cache-Control: private, no-store, max-age=0`.
- `/api/signup` rechaza contenido que no sea formulario multipart con HTTP 400 antes de procesarlo; prueba local con JSON vacío confirmó 400 en vez de 500.
- Verificación local: CSP presente, API sin sesión 401 y no-store, TypeScript/ESLint aprobados, 8/8 contratos críticos, build completo y `npm audit` 0. Servidor actualizado en `http://127.0.0.1:3100`.
- No hubo migración, SQL, commit, push ni despliegue. Siguiente paso: prueba visual local de login, panel, catálogo/checkout y carga de imágenes antes de pedir aprobación para producción.
- Usuario aprobó la prueba local. Cambios guardados en GitHub en `agent/audit-critical-hardening`, commit `f6e96a8` (`perf: acelerar panel y reforzar seguridad`). PR borrador: `https://github.com/bddentrega2-lgtm/vendeplus-clean/pull/5`.
- Preview Vercel creada: deployment `dpl_4XBTWHHA9yWoDjXEUFUwTn8MXpJ6`, estado Ready, URL `https://vendeplus-clean-614169u0i-entrega2-s-projects.vercel.app`.
- Preview protegida por SSO de Vercel; acceso público redirige al login de Vercel. Producción no fue modificada.
- Siguiente paso: usuario abre la preview con su cuenta autorizada y prueba login, panel, Pedidos, Clientes, Estadísticas, catálogo/checkout y carga de imagen. Solo tras aprobación explícita se promueve a producción.

## Carga pendiente de productos TDK (2026-08-13)

- Usuario solicito cargar 15 productos con precios entregados en la conversacion, sin duplicados.
- No se realizo ninguna escritura: todos los intentos fueron de lectura y expiraron.
- Windows quedo saturado: Node/Supabase, lectura de archivo local, `tasklist` y hasta detener Docker excedieron 30-120 segundos.
- Se prepararon scripts temporales no versionados `scripts/tmp-import-tdk-products.mjs` en `vendeplus-clean` y `vendeplus-entrega2-hotfix`; deben eliminarse al terminar.
- Siguiente paso exacto tras reiniciar: confirmar una unica tienda por `stores.name/slug ILIKE '%tdk%'`; leer productos existentes; comparar nombres normalizados sin acentos/mayusculas/signos; insertar solo faltantes; volver a consultar y verificar cero duplicados y precios.

## Optimizacion y hardening promovidos a produccion (2026-08-15)

- El usuario aprobo la Preview `https://vendeplus-clean-614169u0i-entrega2-s-projects.vercel.app`, deployment `dpl_4XBTWHHA9yWoDjXEUFUwTn8MXpJ6`.
- La Preview aprobada fue promovida a produccion mediante Vercel; nuevo deployment `dpl_6xazeTakB8qKfSs2YFWXD4r2W9Zo`, estado Ready.
- Alias confirmados: `https://www.somos-ve.com`, `https://somos-ve.com` y `https://vendeplus-clean.vercel.app`.
- Smoke test productivo: Home, Registro, Marketplace y `/panel/clientes` HTTP 200.
- `/api/panel/context` sin sesion responde HTTP 401 con `Cache-Control: private, no-store, max-age=0`; CSP productiva confirmada.
- Logs de Vercel nivel error desde el despliegue: sin resultados.
- No hubo migracion ni SQL nuevo.
- PR #5 fusionado en `main`: merge commit `115c6b9`; la correccion de CI quedo en `46a5cd8`.
- Causa del check fallido: `/marketplace` abortaba el prerender cuando el Supabase ficticio de CI no respondia. `getActiveMonthlyMarketplaceRewards()` ahora registra el error y devuelve recompensas vacias solo durante esa indisponibilidad.
- GitHub Quality, Vercel, lint, build con variables ficticias de CI y 8/8 contratos criticos aprobados.
- Deployment automatico final desde `main`: `dpl_EGGCZna3K1o2Bm5yoYUMBCRaXNcR`, estado Ready y dominios publicos asignados.
- Smoke test final: Home, Marketplace y `/panel/clientes` HTTP 200; `/api/panel/context` sin sesion HTTP 401 y no-store; sin errores recientes en logs.
- No asumir categoria: revisar categorias actuales de TDK y usar la adecuada o dejar sin categoria si no existe una categoria inequívoca.

## Pedidos en Mesa premium local (2026-08-16)

- Trabajo solo local en `agent/table-orders-v1`; no hubo commit, push, Preview, produccion ni escrituras remotas.
- Se agrego `stores.table_orders_access_enabled`, separado de `table_orders_enabled`: Super Admin concede el acceso premium y el comercio controla si el servicio esta operativo.
- Super Admin puede activar o retirar Pedidos en Mesa desde la edicion del comercio en `/admin/comercios/[storeId]`.
- Sin acceso premium, Mesas desaparece de la navegacion; la entrada directa muestra funcion no habilitada; `/api/panel/tables` responde 403; el QR y `/api/orders` rechazan pedidos de mesa.
- Se elimino por completo el piloto fijo por slug Smash. El permiso funciona para cualquier comercio y los nuevos comercios nacen con acceso deshabilitado.
- Revocacion local verificada: Smash con acceso `false` conservo `table_orders_enabled=true`, 2 mesas y 7 pedidos de mesa. Al reactivar el acceso reaparecio todo sin perdida.
- Estado local final de Smash: `table_orders_access_enabled=true`, `table_orders_enabled=true`; listo para continuar pruebas.
- Validaciones: ESLint aprobado, 8/8 contratos criticos aprobados, contrato Entrega2 aprobado y `npm.cmd run build` aprobado con 79 rutas.
- Migracion preparada: `20260816040501_table_orders_v1.sql`. La columna nueva se aplico solo al Supabase local; no ejecutar aun en produccion.
- Siguiente paso exacto: manana levantar una sesion local limpia, probar visualmente el toggle desde Super Admin, confirmar ocultamiento/restauracion en Panel, escanear el QR desde un telefono en la misma red y completar un pedido de mesa con cambio de estados y fee. Solo despues evaluar Preview.

### Prueba integral premium local

- Toggle real desde Super Admin verificado: retirar y restaurar acceso respondio HTTP 200 y mostro confirmacion visual.
- Revocado: Mesas desaparecio del menu, `/panel/mesas` mostro funcion premium no habilitada, `/api/panel/tables` respondio 403 y el QR mostro pedidos no disponibles.
- Habilitado: el QR cargo Smash, mostro Mesa 1/Salon y Mesa 2/Terraza; se selecciono Mesa 1, abrio el catalogo real y agrego Coca-Cola 1 litro al carrito.
- Pedido real creado por la API: el cliente intento enviar precio USD 0.01 y el servidor recalculo USD 2.00; fee USD 0.10, delivery USD 0 y total USD 2.10 / Bs. 1.260.
- Persistencia verificada: `delivery_type=table`, mesa y zona congeladas, fee/pagador/customer fee correctos, item USD 2.00 y pago en revision.
- Estados protegidos verificados: `received -> accepted -> preparing -> ready -> completed`; seguimiento publico devolvio estado `completed` y Mesa 1/Salon.
- Prueba negativa: con premium revocado, `/api/orders` respondio 400 y no creo pedido. Acceso restaurado al finalizar.
- Limpieza completada: pedido y cliente QA eliminados; Smash termino con premium y operacion activos, 2 mesas y los 7 pedidos previos.
- Pendiente real: escaneo fisico desde telefono en la misma red y revision visual manual del carrito/checkout/confirmacion en ese telefono. Luego se puede decidir Preview.

## Incidente cotizacion delivery Knockouts (2026-08-16)

- Reporte confirmado en produccion, solo lectura, pedido `VP-0816-9N0`: checkout mostro 7.3 km / USD 3.60 y WhatsApp recibio 10.8 km / USD 5.00.
- Causa exacta: checkout calculaba OSRM directamente desde el navegador. Al fallar esa consulta uso el respaldo Haversine: 5.84 km x 1.25 = 7.30 km. Al guardar, el servidor consulto OSRM correctamente, obtuvo 10.80 km y aplico el rango `10.01-11 km` de la empresa delivery.
- La comanda y la fila guardada coinciden: delivery USD 5, total USD 25.50, 10.8 km. El error era la cifra previa mostrada en checkout.
- Correccion solo local: checkout ahora solicita al servidor todas las cotizaciones con ubicacion, no solo Entrega2. `/api/delivery/quote` admite delivery propio/empresa delivery, conserva `zoneId` y usa la misma configuracion vigente que la creacion del pedido.
- Archivos del fix: `src/components/public/CheckoutForm.tsx` y `src/app/api/delivery/quote/route.ts`.
- Validacion: ESLint, 8/8 contratos criticos, TypeScript y build de 163 rutas aprobados.
- No hubo cambios en Supabase, SQL, commit, push, Preview ni produccion. Pendiente probar local/Preview con las coordenadas del caso y luego desplegar con aprobacion.

### Cotizacion unica y firmada

- Decision confirmada: la primera cotizacion mostrada al cliente es la que debe guardarse y enviarse por WhatsApp.
- `/api/delivery/quote` firma por 30 minutos comercio, coordenadas, subtotal, zona y resultado completo de la cotizacion.
- `/api/orders` ya no consulta nuevamente OSRM ni llama nuevamente a Entrega2. Valida la firma despues de recalcular productos/extras y guarda exactamente distancia/tarifa/proveedor mostrados.
- Si cambia carrito, subtotal, ubicacion, zona, firma o vence la cotizacion, el pedido no se registra y solicita volver a cotizar.
- Entrega2 queda protegido contra doble llamada: una llamada al cotizar; cero llamadas adicionales al confirmar.
- La firma usa `DELIVERY_QUOTE_SIGNING_SECRET` si existe y fallback server-only a `SUPABASE_SERVICE_ROLE_KEY`; no se expone ningun secreto al navegador.
- Prueba automatica agregada: conserva 10.8 km/USD 5 y rechaza subtotal, coordenadas o token manipulados.
- Validaciones finales: ESLint aprobado, 9/9 contratos criticos, contrato Entrega2 y build de 163 rutas aprobados.
- Sigue solo local: sin migracion, SQL, commit, push, Preview ni produccion.

### Entorno local de delivery externo

- Se detecto que la build local anterior mezclaba paginas prerenderizadas con variables remotas y APIs locales; Smash local realmente no tenia agencia conectada.
- Se creo solo en Supabase local `Delivery Local QA`, con tarifas por rangos de distancia, y se conecto como agencia exclusiva/default de Smash.
- Se reconstruyo la aplicacion completa con variables de Supabase local y se reinicio en `http://127.0.0.1:3102`.
- HTML verificado: proveedor `transport_agency`, agencia `Delivery Local QA`, precios `distance_ranges` y ausencia de `Zona de entrega`.
- El servidor queda activo para prueba manual. La agencia QA y conexion existen solo localmente; no hubo escritura remota.

## Preview Smash real y cotizacion firmada (2026-08-16)

- Preview desplegada sin promover a produccion: `dpl_845iexXGGBwafg65UKtqTWXtK6jr`.
- URL base: `https://vendeplus-clean-kke66yilp-entrega2-s-projects.vercel.app`.
- URL Smash: `https://vendeplus-clean-kke66yilp-entrega2-s-projects.vercel.app/smash`.
- Vercel confirmo estado Ready; build remoto, TypeScript y 163 rutas aprobados.
- La Preview usa datos reales/configuracion remota de Smash y esta protegida por acceso Vercel.
- No se aplico migracion ni SQL remoto y produccion no fue modificada.
- Probar: producto -> carrito -> checkout -> ubicacion; confirmar que no aparece selector propio cuando hay empresa conectada, anotar distancia/tarifa, confirmar pedido QA y comparar exactamente WhatsApp. El pedido QA debe identificarse para eliminarlo despues.
- Usuario aprobo la prueba funcional de esta Preview. La cotizacion firmada con llamada unica queda aprobada para avanzar.
- Ajuste posterior solo local: la etiqueta visible `Tarifa de servicio` del resumen del checkout volvio a `Fee`, termino general acordado para el producto. Falta publicar este ajuste en una nueva Preview o incluirlo en el siguiente despliegue aprobado.
- Prueba movil local de Mesas detecto que `crypto.randomUUID()` no existe en algunos navegadores bajo HTTP por IP local. `CheckoutForm` ahora genera el UUID v4 idempotente con `crypto.getRandomValues()` y un respaldo compatible, conservando el formato validado por `/api/orders` y la proteccion contra doble pedido.

## Preview integral Mesas + cotizacion firmada (2026-08-16)

- Usuario aprobo las pruebas locales y solicito pasar el conjunto a Preview.
- Migracion remota aplicada: `20260816040501_table_orders_v1.sql`. Es aditiva; 33 comercios quedaron con acceso y operacion de Mesas desactivados, 0 tokens faltantes y 0 mesas iniciales.
- Seguridad remota verificada: `store_tables` tiene RLS, `anon` queda bloqueado con `42501` y solo `service_role` accede directamente. El lint solo reporto el problema interno conocido de `extensions.index_advisor` con `hypopg_reset()`.
- La migracion de paleta `20260816063446_update_legacy_default_store_palette.sql` NO fue aplicada remotamente porque no es necesaria para Mesas y cambiaria datos compartidos.
- Preview integral: `https://vendeplus-clean-iqjfv77go-entrega2-s-projects.vercel.app`.
- Deployment: `dpl_8BZkMknXrXN2Fzh8EWn8bemvAfHU`, target Preview, estado Ready; build remoto de 163 rutas aprobado.
- Preview protegida por SSO de Vercel; las respuestas publicas sin sesion redirigen con HTTP 302 al acceso de Vercel.
- No se promovio a produccion, no hubo commit ni push. Pendiente prueba integral manual y limpieza de mesas/pedido QA si se crean sobre Smash real.
- Ajuste posterior solicitado, todavia solo local: Mesa usa `Confirmar pedido`; su confirmacion oculta el siguiente paso, instrucciones/botones de WhatsApp y datos para volver a pagar, y muestra la referencia ya recibida. Se agrego notificacion global visual y sonora en todo el panel para IDs nuevos de pedidos de mesa, con Broadcast privado y sondeo de respaldo, sin sonar en la carga inicial ni por cambios de estado.
- Ajuste anterior desplegado a nueva Preview: `https://vendeplus-clean-h47ksb272-entrega2-s-projects.vercel.app`, deployment `dpl_5z8xGHsMCqr97wu4QMoQC6ouaHbB`, estado Ready. TypeScript, ESLint, 9/9 contratos criticos, contrato Entrega2 y build local/remoto de 163 rutas aprobados. Sin nueva migracion, commit, push ni promocion a produccion.
- Nuevo ajuste en desarrollo local: estados publicos de Mesa `Enviado -> Aprobado -> Preparando -> Listo`. El comercio puede elegir `Servir en la mesa` (comportamiento anterior) o `Retiro en barra`; en barra el QR abre el catalogo sin pedir mesa y al quedar listo indica al cliente que retire. Se congela el modo en cada pedido mediante la migracion nueva `20260817024713_add_table_order_fulfillment_mode.sql`, aplicada y verificada solo en Supabase local. Todavia no aplicada remotamente ni desplegada a Preview.
- Ajuste de modos aplicado tambien en Supabase remoto: migracion `20260817024713_add_table_order_fulfillment_mode.sql`; los 33 comercios quedaron en `table_service` y ninguno cambio automaticamente a retiro.
- Nueva Preview: `https://vendeplus-clean-rew1ydd0t-entrega2-s-projects.vercel.app`, deployment `dpl_D2Vukiymd43NaQBTgxgdVwDPfRFV`, estado Ready. Build local/remoto de 163 rutas, TypeScript, ESLint, 9/9 contratos criticos y Entrega2 aprobados. Sin promocion a produccion, commit ni push.
# Actualización 2026-08-16 — Mesas en vivo e identificación de modalidad

- `TableOrderNotifier` emite un evento local multi-tenant al detectar el pedido nuevo que ya genera sonido/notificación.
- `TablesManager` escucha ese evento y recarga pedidos activos en segundo plano, sin refresco manual ni pantalla de carga.
- `/panel/pedidos` muestra una insignia evidente con icono y texto: Mesa, Barra, Retiro (pick up), Delivery o Envío nacional.
- Barra reconoce tanto pedidos manuales (`delivery_pricing_type=bar`) como QR configurado para retiro en barra (`table_fulfillment_snapshot=counter_pickup`).
- La API del panel incluye `table_fulfillment_snapshot` en sus tres niveles de selección.
- No requiere migración ni SQL adicional.
- Validado: ESLint dirigido, `tsc --noEmit`, 9/9 contratos críticos, contrato Entrega2 y `npm.cmd run build` (163 rutas).
- Ajuste posterior de copy: en `/panel/pedidos`, la insignia y el filtro usan `Retiro` en lugar de `Retiro (pick up)`.
- Limpieza posterior: se eliminó la modalidad repetida de la línea secundaria de cada tarjeta y el selector avanzado duplicado. Los filtros rápidos quedan: Todos, Delivery, Retiro, Barra y Mesa.
- Corrección de filtros: `Barra` incluye pedidos manuales y QR con `table_fulfillment_snapshot=counter_pickup`; `Mesa` excluye esos QR y conserva pedidos manuales/QR de servicio en mesa.
- Seguimiento público de pedidos de mesa/barra: se agregó un aviso visible con icono para que el cliente haga una captura de la pantalla y confirme su pedido cuando esté listo.

# Producción 2026-08-16

- Preview aprobado promovido a producción: `dpl_H1bWinxNPJqT52f9HfoGbGrUbp93` (`vendeplus-clean-lpz97rw11-entrega2-s-projects.vercel.app`).
- Dominios `somos-ve.com`, `www.somos-ve.com` y `vendeplus-clean.vercel.app` apuntan al nuevo despliegue.
- Verificación pública: `https://www.somos-ve.com` respondió HTTP 200.
- Producción anterior guardada para rollback: `dpl_EGGCZna3K1o2Bm5yoYUMBCRaXNcR` (`vendeplus-clean-d6xkwh75e-entrega2-s-projects.vercel.app`).
- Reversión exacta desde la raíz del proyecto: `npx.cmd vercel rollback dpl_EGGCZna3K1o2Bm5yoYUMBCRaXNcR --yes`.
- Logs de los últimos 15 minutos: un error de imagen Open Graph de `/smash/opengraph-image` anterior a la promoción; sin relación con mesas/pedidos.

# Rate limit de cotizaciones delivery local (2026-08-17)

- `/api/delivery/quote` ahora aplica el limitador distribuido existente antes de consultar rutas o Entrega2.
- Límite global: 90 solicitudes por IP cada 10 minutos.
- Límite por comercio: 30 solicitudes por IP y comercio cada 10 minutos.
- Al exceder el límite responde HTTP 429 con `Retry-After` y cabeceras `X-RateLimit-*`; conserva el respaldo en memoria si la RPC distribuida falla.
- Se agregó un contrato crítico que verifica ambas claves, la respuesta 429 y sus cabeceras.
- Validaciones locales: ESLint completo, 10/10 contratos críticos, contrato Entrega2 y `npm.cmd run build` aprobados; build generó 167 páginas.
- No hubo migración, SQL, escritura remota, commit, push, Preview ni cambio en producción.
- Siguiente paso: prueba local manual de una cotización normal; para validar visualmente el 429 sin realizar 30 llamadas reales a Entrega2 conviene usar un límite temporal solo local o una prueba de integración con proveedor simulado.
- Prueba local completada en `http://127.0.0.1:3101` contra Supabase local y `Delivery Local QA`: una cotización respondió 200 sin llamar a Entrega2 real.
- Prueba controlada con comercio inexistente: 30 respuestas 400 antes de consultar rutas/proveedores y la solicitud 31 respondió 429. Cabeceras verificadas: `Retry-After`, límite 30, restante 0, reset y request ID.
- Hallazgo adicional pendiente: `toSafeNumber(null)` convierte coordenadas GPS faltantes a `0`, por lo que un comercio sin latitud/longitud puede producir una distancia absurda desde `0,0` en vez de fallar con el mensaje de GPS requerido. Corregir y probar localmente antes de una prueba real de delivery.
- Hallazgo corregido localmente: la cotización rechaza `null`, `undefined`, cadenas vacías y coordenadas fuera de los rangos latitud -90/90 y longitud -180/180.
- Prueba local aprobada: Smash sin GPS respondió HTTP 400 con `El comercio necesita ubicacion GPS configurada para cotizar con Entrega2 App.`; latitud 999 también respondió 400 antes de rutas/proveedores.
- Validaciones posteriores: 11/11 contratos críticos, contrato Entrega2, ESLint completo y build de 167 páginas aprobados.
- El servidor local de `http://127.0.0.1:3101` se detuvo para evitar competencia con el build final.

# Apertura y simplificación del mapa local (2026-08-17)

- Causa del mapa lento/vacío: la CSP no permitía imágenes de `*.tile.openstreetmap.org`; además Leaflet se descargaba solo después de pulsar `Usar mapa`.
- `next.config.ts` permite exclusivamente los mosaicos HTTPS de OpenStreetMap en `img-src`.
- `LocationPicker` precarga Leaflet al mostrarse el selector en checkout y reutiliza la misma promesa al abrir/inicializar el mapa.
- Se eliminó `Marcar centro del mapa` y su lógica. El cliente selecciona directamente tocando el mapa; el texto explica que puede moverlo y tocar otra zona.
- Validaciones: ESLint completo, 12/12 contratos críticos y build de 167 páginas aprobados.
- Servidor local reactivado en `http://127.0.0.1:3101`; `/smash` responde 200 y la CSP servida contiene `tile.openstreetmap.org`.
- No hubo migración, SQL remoto, commit, push, Preview ni cambio en producción.
- Preview creada para validar rate limit, GPS y mapa: `https://vendeplus-clean-gxh2vdfai-entrega2-s-projects.vercel.app`.
- Deployment `dpl_5nYAFDM2cAtthHMqFezFmufCvq38`, target Preview, estado Ready; build remoto de 167 páginas aprobado.
- La Preview está protegida por acceso de Vercel y redirige al login sin sesión autorizada. Producción no fue promovida ni modificada.
- Probar con un comercio real que tenga GPS: abrir checkout, pulsar `Usar mapa`, confirmar carga rápida de mosaicos, ausencia de `Marcar centro del mapa`, tocar un punto y verificar distancia/tarifa. No confirmar el pedido salvo que se identifique para limpieza.
- La primera Preview mostró Tailwind parcialmente compilado: cargaba CSS base, pero faltaban botones, tarjetas, espaciados y colores compuestos. No promover `dpl_5nYAFDM2cAtthHMqFezFmufCvq38`.
- Se reconstruyó desde cero con `vercel deploy --force`, sin caché. Nueva Preview: `https://vendeplus-clean-cdzk1i7u2-entrega2-s-projects.vercel.app`, deployment `dpl_6hKNFAXKDtnxDsZf4NGrBkY1UPVm`, target Preview, estado Ready; 414 paquetes instalados desde cero y build remoto de 167 páginas aprobado.
- Incidente productivo investigado alrededor de 20:15-20:18: Vercel no registró HTTP 500 y el deployment productivo `dpl_CXyMauRpq6Vc688kUo84SWVSYfao` sigue Ready.
- Hubo fallos intermitentes de Supabase que activaron el catálogo de respaldo; Supabase mantiene incidente activo `401 errors due to JWT rejections`, con sesiones renovadas rechazadas por la API.
- Entrega2 falló al cotizar Smash a las 20:17:54; esperó 60,7 segundos y la aplicación respondió 200 usando fallback. Esto pudo hacer que el checkout pareciera congelado.
- Estado posterior: Home, Marketplace, Smash y login respondieron 200; API de panel sin sesión 401 esperado; sin logs 5xx. Producción no fue modificada durante el diagnóstico.

# Auditoría fallback Entrega2 (2026-08-17)

- El fallback sí se activó en producción cuando Entrega2 falló: `/api/delivery/quote` registró `entrega2_quote_fallback_used` y respondió HTTP 200 con token firmado.
- Sin embargo, `calculateEntrega2FallbackQuote` recibe los ajustes normales del comercio y fuerza `distance_ranges`; en Smash termina usando `store_delivery_distance_rates`, no las tarifas de la empresa Entrega2 creada en Somos.
- Rangos actuales de Smash: 0-2 km $1; 2-5 km $2; 5-7 km $3; 7-10 km $4.
- Rangos actuales de la empresa Entrega2: 0-1,5 km $1; 1,51-3 km $1,50; 3,01-4 km $2,50; 4,01-6 km $3; 6,01-8 km $3,50; 8,01-10 km $4.
- Smash tiene `delivery_provider=entrega2`, `pricing_type=manual` y `transport_agency_id/connection_id=null`. La conexión histórica con la empresa Entrega2 está `paused`, sin default.
- Conclusión original: el fallback funcionaba técnicamente, pero usaba una fuente distinta a la contingencia acordada.

## Corrección fallback Entrega2 (2026-08-17)

- Corregido localmente: si la API directa de Entrega2 falla, `/api/delivery/quote` carga primero la configuración activa de la agencia con slug `entrega2` y usa sus rangos guardados en Somos.
- Si esa agencia no existe o su configuración no está completa, conserva como segundo respaldo las tarifas propias del comercio; la respuesta identifica `rateSource` como `entrega2_agency` o `store`.
- Prueba de integración local con la API forzada a fallar: 5,54 km cotizó USD 3 mediante el rango 4,01-6 km de la agencia y devolvió `source=fallback`, `provider=entrega2` y `rateSource=entrega2_agency`.
- Los datos QA fueron eliminados y Smash local recuperó su conexión/configuración previa. No hubo escrituras remotas ni cambios en producción.
- Validaciones finales aprobadas: ESLint, 13/13 contratos críticos, contrato Entrega2 y build local de 167 páginas.
- Preview limpia sin caché: `https://vendeplus-clean-mmm19zq6u-entrega2-s-projects.vercel.app`; deployment `dpl_2hSCwBqsoGtRWJDqjZvFmdV5Bs6a`, build remoto de 167 páginas aprobado. Producción no fue promovida ni modificada.
- Preview aprobada por el usuario y promovida a producción como `dpl_5rtPk12FGKxa8RfmpEevcyfSdGaQ` (`vendeplus-clean-qi9lcdl2p-entrega2-s-projects.vercel.app`). Los dominios `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` apuntan al nuevo despliegue.
- Smoke test posterior: Home, Marketplace, Smash, login del panel y Transporte respondieron HTTP 200; la CSP incluye mosaicos de OpenStreetMap; API de panel sin sesión respondió 401 y cotización inválida 400. Sin errores ni HTTP 500 en logs del nuevo deployment.
- Rollback exacto disponible: `dpl_CXyMauRpq6Vc688kUo84SWVSYfao` (`vendeplus-clean-rhiisqhoc-entrega2-s-projects.vercel.app`). No hubo migración ni escritura en Supabase durante la promoción.

# Home mesas/barra, logo del panel y paleta default (2026-08-17)

- Home conserva sus textos y secciones originales. Después de las dos soluciones principales se agregó un banner compacto `Nueva modalidad: Pedidos en mesa o barra`, con pedido por QR, menos filas/atención más rápida y estado visible. Delivery aparece antes del banner; no se menciona seguimiento en tiempo real ni se modifica la comparación con otras apps.
- El encabezado lateral del panel de comercios usa el logo oficial de Somos en lugar del isotipo genérico y el texto escrito; Super Admin no fue modificado.
- Registro, API de configuración, formulario del panel y catálogos locales de respaldo usan como defaults `#1F464C`, `#F27533` y `#042332`.
- Auditoría remota solo lectura: 19 de 34 comercios conservan exactamente una combinación legacy; los otros 15 tienen colores personalizados o distintos y no deben cambiar.
- La migración `20260816063446_update_legacy_default_store_palette.sql` solo reemplaza las dos combinaciones legacy exactas y actualiza defaults de columnas. Aplicada a Supabase remoto con autorización explícita: 19 comercios pasaron a la paleta `#1F464C/#F27533/#042332`, quedaron 0 legacy y los 15 personalizados conservaron exactamente la misma huella SHA-256 previa.
- Verificación pública posterior: Alkkon Fit sirve HTTP 200 con `--brand-primary:#1F464C`, `--brand-accent:#F27533` y `--brand-button-text:#042332` después de renovar la caché del catálogo.
- Validaciones: ESLint completo, 15/15 contratos críticos y build local/remoto de 167 páginas aprobados.
- Preview vigente: `https://vendeplus-clean-mzd86fgh9-entrega2-s-projects.vercel.app`, deployment `dpl_A8bqAwhJ1ZsNUzcrD6uGHoTKR1kn`. Producción no fue modificada.
- Ajuste final: el módulo del panel se presenta como `Mesa / Barra` en navegación y encabezado, y como `Pedidos en Mesa / Barra` dentro de la gestión.
- Preview final: `https://vendeplus-clean-6kmv887gd-entrega2-s-projects.vercel.app`, deployment `dpl_4KU853RLs1dw5tBKVzcvkLpBHXed`.
- Preview promovida a producción: `dpl_3EPtZx3JNWHcYvLauAYHLKqP3Ybt` (`vendeplus-clean-9jldj5rhe-entrega2-s-projects.vercel.app`). `www.somos-ve.com` apunta al deployment nuevo en estado Ready.
- Smoke productivo: Home, Marketplace, Smash, login del panel y Transporte HTTP 200; banner Mesa/Barra y comparación con otras apps presentes; sin errores ni HTTP 500 en logs. Rollback anterior: `dpl_C59dpBfMhLHJ4dzzuwTW4Lnp7rSy`.
# Estado 2026-08-19 - P0 creación atómica de pedidos

- Implementación local lista, todavía sin aplicar a Supabase remoto ni desplegar.
- Se agregó `create_order_atomic(jsonb,jsonb)` como migración aditiva para guardar cabecera, ítems y opciones dentro de una sola transacción, con idempotencia por comercio.
- Las rutas pública y manual ya usan el helper RPC; el pedido manual conserva una clave estable durante reintentos.
- La actualización CRM del cliente queda después del commit y en modo no crítico: una falla allí no invalida ni duplica el pedido.
- Validaciones superadas: `test:critical` 17/17, `test:entrega2-contract` 1/1 y `npm.cmd run build` exitoso con Next.js 16.3.0.
- Docker y WSL quedaron detenidos. Las imágenes locales de Supabase habían sido eliminadas durante la limpieza del equipo; `supabase start` no logró descargarlas dentro de un tiempo razonable.
- No se tocó producción. Próximo paso exacto: con autorización explícita, validar la migración contra Supabase remoto dentro de `BEGIN ... ROLLBACK`, incluyendo creación correcta, repetición idempotente y fallo forzado sin residuos. Si pasa, solicitar/aplicar la migración aditiva y preparar Preview; producción solo después de validación del usuario.
- Validación remota transaccional autorizada y aprobada el 2026-08-19: la función temporal creó cabecera + ítem + opción, reconoció el segundo intento sin duplicar y el fallo forzado por cantidad inválida no dejó cabecera parcial. La consulta independiente posterior confirmó `function_exists_after_rollback=false` y cero pedidos, ítems u opciones QA; no quedó ningún cambio persistente en producción.
- Próximo paso exacto: solicitar autorización separada para aplicar permanentemente la migración aditiva `20260820013000_create_order_atomic_rpc.sql`. Después desplegar solamente a Preview y validar pedidos público, manual y Mesa/Barra antes de cualquier promoción.
- Usuario autorizó avanzar. Migración aditiva `20260820013000_create_order_atomic_rpc.sql` aplicada a `vendeplus-production` y registrada en el historial remoto. Verificación: función presente; `anon=false`, `authenticated=false`, `service_role=true`; cero pedidos QA residuales.
- Preview atómica creada: `https://vendeplus-clean-7op8ek9cr-entrega2-s-projects.vercel.app`, deployment `dpl_GruL1DzRNpFcALv49ghSdvnoQKmp`, target Preview, estado Ready, build remoto exitoso de 167 páginas. No se promovió producción.
- Smoke de infraestructura: Preview protegida por Vercel; bypass alcanzó la aplicación y `/api/panel/orders` sin sesión respondió sin error de servidor. Cero logs de nivel error y cero HTTP 500 en el deployment.
- Próximo paso exacto: usuario debe validar en Preview (1) pedido público normal, (2) pedido manual desde panel y (3) pedido Mesa/Barra si tiene una mesa disponible. Confirmar que cada uno aparece con productos/extras y una sola vez. No promover a producción sin aprobación explícita.
- Usuario aprobó funcionalmente la Preview atómica y autorizó promover, pero solicitó antes compactar el botón “Enviar a Entrega2 App”. Se cambió únicamente `OrdersManager`: ahora muestra icono `Motorbike` + texto `Entrega2`; conserva título/aria-label contextual para envío o reintento y no cambia la acción.
- Validaciones posteriores aprobadas: ESLint, 17/17 contratos críticos, contrato Entrega2 1/1 y build local Next.js 16.3.0 de 167 páginas.
- Nueva Preview conjunta: `https://vendeplus-clean-96io5f8kd-entrega2-s-projects.vercel.app`, deployment `dpl_CgFLJuZkDoc2a3AS8qWVL3JeRiRE`, estado Ready, build remoto exitoso, sin logs de error ni HTTP 500.
- Próximo paso exacto: usuario valida visualmente el botón compacto en `/panel/pedidos`; después promover este deployment a producción y hacer smoke + revisión de logs. Producción aún no fue promovida.
- Usuario aprobó el botón compacto. Preview promovida a producción como `dpl_4khixG8RUcpaFzvuCdo4gtLkuxjU` (`vendeplus-clean-dt0xulyoi-entrega2-s-projects.vercel.app`), estado Ready. Alias activos: `www.somos-ve.com`, `somos-ve.com`, `vendeplus-clean.vercel.app` y alias del equipo.
- Smoke productivo aprobado sobre el dominio canónico: Home 200, Marketplace 200, catálogo Smash 200, panel login 200 y `/api/panel/orders` sin sesión 401. Supabase confirma función atómica presente, ejecución denegada a `anon`/`authenticated` y permitida solo a `service_role`. Cero logs de error y cero HTTP 500 del deployment.
- P0 atomicidad completado en producción. Pendiente de respaldo en Git: no hacer commit/push hasta que el usuario lo solicite.
- Usuario confirmó que Don Aniello ya está listo y ordenó eliminar el importador temporal. `scripts/import-don-aniello-menu.mjs` fue eliminado localmente; nunca estuvo versionado, por lo que no produce un cambio Git ni afecta Supabase, Vercel o el catálogo existente.
- Mejora UX Mesa/Barra preparada: `TablesManager` ya no reemplaza toda la vista con loading después de guardar configuración, crear/editar mesa o actualizar un estado; refresca en segundo plano y actualiza el pedido de forma inmediata, conservando la posición visual.
- La configuración + QR se abre automáticamente solo si el módulo está inactivo; cuando ya está activo aparece plegada en una franja compacta con resumen y botón “Editar configuración”. Al guardar una configuración activa vuelve a plegarse. “Nueva mesa” se movió debajo de pedidos y mesas para priorizar la operación diaria.
- Validaciones: ESLint, 18/18 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas aprobados.
- Preview UX Mesa/Barra: `https://vendeplus-clean-53rpvy9tj-entrega2-s-projects.vercel.app`, deployment `dpl_8wf6gP39Noj93fsnvPgyiorG33Hg`, Ready, sin logs de error ni HTTP 500. No se promovió producción.
- Próximo paso exacto: usuario valida en `/panel/mesas` que configuración inicia plegada y que cambiar un estado no lo devuelve arriba; promover solo con aprobación explícita.
- Usuario aprobó UX plegada y pidió dos mejoras adicionales. Se agregó DELETE protegido de mesas: exige manager y `store_id`, bloquea si existen pedidos activos, confirma en UI y conserva los snapshots de pedidos históricos gracias al FK existente `on delete set null`. No requiere migración.
- Pedido manual: tamaños/extras/notas salieron del resumen lateral. Al agregar un producto con opciones se abre un diálogo enfocado; en móvil ocupa la parte útil de la pantalla y en PC queda centrado. Incluye cantidad, grupos obligatorios/opcionales, precios extra, nota, validación de requeridos y total. El resumen queda compacto con opciones elegidas y botón “Personalizar”.
- Validaciones aprobadas: TypeScript, ESLint, 19/19 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas.
- Preview conjunta: `https://vendeplus-clean-edcvumg8l-entrega2-s-projects.vercel.app`, deployment `dpl_B21u8AuXcfLbX5tma7zYY6qaHeRH`, Ready, sin logs de error ni HTTP 500. No se promovió producción y no hubo SQL.
- Próximo paso exacto: usuario valida eliminar una mesa sin pedidos, bloqueo de una mesa con pedido activo y personalización manual desde teléfono/PC; promover solo con aprobación explícita.
- Usuario reportó que el botón eliminar se veía mal y que faltaban tamaños. Se dejó solo un botón circular con icono de papelera, tooltip y aria-label; la confirmación y protecciones permanecen.
- Causa de tamaños: las presentaciones viven en `product_variants`, no en grupos de extras, y `/api/panel/catalogo` no las incluía. Ahora el catálogo del panel carga variantes; el diálogo exige tamaño/presentación cuando existen, muestra precio, lo resume y lo envía como `variantId`.
- Seguridad/precio: `/api/panel/orders` valida server-side que la variante pertenezca al producto y esté disponible, usa su precio real, congela `variant_name` y aplica `product_option_value_variant_prices` cuando un extra cambia de precio según tamaño. WhatsApp incluye variante + extras.
- Validaciones aprobadas: TypeScript, ESLint, 19/19 contratos críticos y build local/remoto Next.js 16.3.0 de 167 páginas.
- Preview corregida: `https://vendeplus-clean-ikrrdya0s-entrega2-s-projects.vercel.app`, deployment `dpl_CK628EP1CcyDCs6CMHb2EgVgDcSd`, Ready, sin logs de error ni HTTP 500. Producción intacta; sin migración ni SQL.
- Próximo paso exacto: usuario valida papelera y un producto manual con tamaño + extras (incluyendo cambio de precio); promover solo con aprobación explícita.

# Estado 2026-08-19 - P0 empresas delivery

- Se eliminó el remount entre módulos del panel delivery: la navegación interna cambia de pestaña y URL sin desmontar `TransportAgencyPanel`, conserva historial Atrás/Adelante y evita la pantalla blanca de “Cargando empresa delivery”.
- Los estados visibles se redujeron a las siguientes acciones válidas según el estado actual. Se corrigieron transiciones faltantes desde pendiente hacia rechazo y desde repartidor asignado hacia en camino/entregado.
- Las mutaciones de estado y repartidor ahora pasan por `mutate_transport_order_atomic`: servicio, evento, pedido origen e integración se actualizan dentro de una sola transacción PostgreSQL.
- La migración aditiva `20260820033000_mutate_transport_order_atomic_rpc.sql` fue aplicada a Supabase remoto con autorización del usuario. Permisos verificados: denegada a anon y disponible solo para service role. La prueba de error controlado no alteró pedidos ni eventos reales.
- Performance P0 adicional: sin refetch completo tras cambios propios, supresión del evento Realtime propio, debounce de Realtime, polling de respaldo de 30 a 180 segundos, consulta de membresía paralela, lista sin conteo exacto y paginación mediante `limit + 1`.
- Validaciones aprobadas: TypeScript, ESLint, 22/22 contratos críticos y build local Next.js 16.3.0 de 167 páginas.
- Preview conjunta: `https://vendeplus-clean-jbs5s46w9-entrega2-s-projects.vercel.app`, deployment `dpl_AC2H2YwfJE4S8GaMsR31DGxWkFap`, target Preview, estado Ready, sin logs de error. La ruta protegida responde 302 hacia autenticación sin sesión, comportamiento esperado.
- Producción web no fue promovida. Próximo paso exacto: validar con sesión real (1) cambiar entre Pedidos/Repartidores/Tarifas sin pantalla blanca, (2) aceptar o rechazar un pedido pendiente, (3) asignar repartidor, pasar a En camino y Entregado, (4) abrir WhatsApp y confirmar que aparece inmediatamente. Promover solo con aprobación explícita.
- Usuario aprobó funcionalmente el P0, pero pidió antes agregar filtro por repartidor en Facturación. `TransportBillingTab` ahora permite elegir todos, un repartidor histórico/actual o servicios sin asignar; el filtro actualiza el total filtrado, el detalle y el bloque de pagos sin nuevas consultas al servidor.
- Validaciones finales aprobadas: TypeScript, ESLint, 23/23 contratos críticos y build local/remoto Next.js 16.3.0 de 159 páginas estáticas generadas.
- Nueva Preview conjunta: `https://vendeplus-clean-65s6n4syv-entrega2-s-projects.vercel.app`, deployment `dpl_3DyCZTesVfuH1wno5iBHfrjZf5rV`, target Preview, estado Ready, sin logs de error. Facturación protegida responde 302 hacia autenticación sin sesión, esperado.
- No hubo migración nueva ni SQL adicional. Producción web continúa intacta. Próximo paso exacto: usuario valida el filtro en Facturación y, con aprobación explícita, promover esta Preview conjunta a producción y ejecutar smoke + logs.
- Se agregó en Super Admin → Transporte un control independiente por empresa: `Activar premium` / `Premium activo`. Es reversible, actualiza la tarjeta inmediatamente y no altera aprobación, publicación, tarifas ni conexiones.
- El endpoint PATCH valida `enabled` como booleano y reutiliza `requireAdminAuth`, por lo que solo una sesión founder puede modificar `premium_dispatch_enabled`.
- Validaciones aprobadas: TypeScript, ESLint, 24/24 contratos críticos y build local/remoto Next.js 16.3.0 de 159 páginas estáticas generadas.
- Preview final conjunta: `https://vendeplus-clean-a7d395wg6-entrega2-s-projects.vercel.app`, deployment `dpl_3sgqXDx6zH9ya2SvFVfnVFGPjQt5`, target Preview, Ready, sin logs de error. `/admin/transporte` sin sesión responde 302 esperado.
- Sin migración ni SQL nuevo; producción intacta. Próximo paso: usuario prueba activar/desactivar Premium desde `/admin/transporte`, verifica acceso de repartidores en el panel delivery y autoriza explícitamente la promoción.
- Usuario validó la Preview completa y autorizó promoción. Vercel promovió exactamente la Preview aprobada a producción como `dpl_CabbMnCyz82gzQkHwQseVKXj7EnD` (`vendeplus-clean-dlau9cs5w-entrega2-s-projects.vercel.app`), estado Ready.
- Alias productivos confirmados: `www.somos-ve.com`, `somos-ve.com`, `vendeplus-clean.vercel.app` y alias del equipo.
- Smoke productivo aprobado: Home, Marketplace, Alkkon Fit, login y Transporte HTTP 200; API Admin sin sesión HTTP 401 esperado. Logs del deployment sin HTTP 500 ni errores de ejecución.
- Rollback web inmediato disponible al deployment productivo anterior `dpl_5vVUiXtUsbJgs8YEcLMy4gFrsdph` / `vendeplus-clean-boz38o2xw-entrega2-s-projects.vercel.app`. La migración atómica delivery ya es aditiva y compatible hacia atrás.
- Pendiente de respaldo Git: los cambios están desplegados pero continúan sin commit/push porque el usuario no lo ha solicitado todavía.
- Ajuste posterior solo local: en el Home se intercambiaron los temas visuales de las tarjetas principales. `Para comercios` ahora usa fondo verde oscuro, texto claro y botón claro; `Para empresas delivery` usa tarjeta blanca, texto verde oscuro y botón naranja. Textos, enlaces y estructura no cambiaron.
- Validaciones locales: 24/24 contratos críticos, ESLint y build Next.js 16.3.0 aprobados. Servidor local disponible en `http://127.0.0.1:3000/` con HTTP 200.
- Este ajuste de color no fue desplegado a Preview ni producción. Próximo paso: usuario revisa el Home local y decide si se prepara Preview.
- Ajuste local adicional: los dos iconos de camión del Home vinculados a delivery fueron sustituidos por `Motorbike` (tarjeta `Para empresas delivery` y beneficio `Delivery conectado`).
- Validaciones posteriores: 24/24 contratos críticos, ESLint y build aprobados; servidor local reiniciado y Home HTTP 200 en `http://127.0.0.1:3000/`. Sigue sin Preview ni producción.
- Usuario aprobó los colores e iconos locales y autorizó producción. Se creó primero Preview limpia `dpl_DFiyaRukMMF9ufWGfK1DA6M4Dnrp` (`vendeplus-clean-9g2d9wtws-entrega2-s-projects.vercel.app`), Ready y sin errores, y se promovió exactamente ese deployment.
- Producción vigente: `dpl_GJYsWyxbiFhzfNezLfXbeGdSbzyV` (`vendeplus-clean-3bhstoy2t-entrega2-s-projects.vercel.app`), Ready; dominios `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` asignados.
- Smoke productivo: Home, Marketplace, Alkkon Fit, login y Transporte HTTP 200; API de panel sin sesión HTTP 401 esperado; sin HTTP 500 ni errores en logs. Rollback web anterior: `dpl_CabbMnCyz82gzQkHwQseVKXj7EnD`.
- No hubo migración ni SQL en este ajuste. Paquete completo respaldado en Git mediante commit `9debfff` (`feat: optimizar empresas delivery y renovar home`) y enviado a `origin/main`.

# P1 resiliencia Entrega2 y catálogo público (2026-08-20)

- Prioridades 1 y 3 implementadas localmente, sin producción: las cotizaciones de Entrega2 abortan a los 4,5 s y los envíos de pedidos a los 8 s. El timeout cubre también la lectura del cuerpo y siempre limpia el temporizador.
- Se agregó cortacircuito de cotización por instancia: después de 3 fallos de red, HTTP 429/5xx o timeout, evita nuevas esperas durante 30 s y permite que `/api/delivery/quote` use inmediatamente las tarifas de contingencia ya existentes. Los errores 4xx normales no abren el circuito.
- Home y Marketplace dejaron de ejecutar tres consultas delivery por comercio. `hydrateStoresDeliveryRelations` hace solo tres consultas masivas por lote (`settings`, `zones`, `distance_rates`) y agrupa los resultados por `store_id`; con 31 comercios pasa de hasta ~93 consultas adicionales a 3.
- El hidratador conserva los datos ya incluidos si una consulta masiva específica falla, evitando borrar configuración por una incompatibilidad temporal.
- Validaciones aprobadas: TypeScript, ESLint, 26/26 contratos críticos y build Next.js 16.3.0 de 159 páginas. Smoke local: Home, Marketplace y Alkkon Fit HTTP 200.
- Preview: `https://vendeplus-clean-2empl8kpk-entrega2-s-projects.vercel.app`, deployment `dpl_Gnd6m8jgCJPKbjnr1Mu5gTNEaxfM`, target Preview, Ready, build remoto aprobado y sin logs de error.
- No hubo migración ni SQL. Producción sigue intacta. Próximo paso: validar Home/Marketplace/catálogos en Preview y una cotización Entrega2; promover solo con aprobación explícita.
- Usuario aprobó la Preview y autorizó producción. Se promovió exactamente `dpl_Gnd6m8jgCJPKbjnr1Mu5gTNEaxfM` como deployment productivo `dpl_JDnrqBD1F1FgpH5j4CXTt8pP96HE` (`vendeplus-clean-qw4is7gj3-entrega2-s-projects.vercel.app`), estado Ready.
- Alias productivos confirmados: `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`. Smoke: Home, Marketplace, Alkkon Fit y Transporte HTTP 200; API de panel sin sesión rechazada; sin HTTP 500 ni errores en logs.
- Rollback web anterior: `dpl_5ZfdoVqSFZxFKtuvsJAukqxDPQ78` (`vendeplus-clean-el30ljxyw-entrega2-s-projects.vercel.app`). Pendiente respaldar este P1 en GitHub cuando el usuario lo autorice.

# Próxima prioridad - TDK multisede (2026-08-20)

- Crear dos comercios independientes adicionales: `TDK Delicias` y `TDK Los Cedros`, inicialmente con el mismo catálogo/productos de la sede TDK existente.
- Cada sede debe conservar operación independiente: pedidos, configuración, delivery, horarios, usuarios y futuras modificaciones de catálogo no deben mezclarse automáticamente.
- Se necesita una vista central autorizada para consultar los pedidos de todas las sedes. Antes de implementar, revisar el plan existente `docs/MODULO_CADENAS_PLAN.md` y elegir la solución mínima segura: agrupación de sedes + permisos explícitos, manteniendo `store_id` en cada pedido.
- No se crearon sedes ni se copiaron datos en esta sesión. Próximo paso exacto: auditar la sede TDK actual, definir los slugs/datos básicos y presentar el alcance del panel consolidado antes de cualquier escritura remota.
- Auditoría remota solo lectura completada: sede origen `Pastelería TDK` (`pasteleria-tdk`), activa, 5 categorías (`Tortas`, `Postres`, `Box`, `Desayunos`, `Pizzas`), 15 productos activos, 5 destacados, sin variantes, extras, pedidos, clientes ni mesas. Tiene 1 usuario owner.
- Delivery actual de TDK: propio, cotización manual, delivery y retiro activos, sin zonas/rangos ni empresa delivery. La dirección visible sigue como `Ubicacion del negocio`; por seguridad no debe copiarse a nuevas sedes junto con GPS, WhatsApp, pagos u horarios sin confirmación.
- Arquitectura mínima confirmada: cada sede será un `store` independiente; el mismo usuario owner se vincula mediante `store_users`. La API ya autoriza y devuelve pedidos de todas las tiendas vinculadas sin mezclar `store_id`, por lo que no hacen falta tablas de organizaciones para el piloto de 3 sedes.
- Base local del panel consolidado implementada: Pedidos muestra selector `Todas las sedes`/sede individual para usuarios normales con más de una tienda, identifica la sede en cada fila y valida server-side que el filtro solicitado pertenezca al usuario. Founder conserva su selector actual y no ve un filtro incompatible.
- Validaciones locales: TypeScript, ESLint, 27/27 contratos críticos y build Next.js 16.3.0 aprobado. Sin Preview, producción, migración ni escrituras remotas.
- Usuario confirmó la configuración mínima: mismo WhatsApp y horario; GPS y métodos de pago en blanco; ambas sedes usarán Entrega2; mismo usuario con selector de sede y Pedidos consolidado.
- Implementación local completa: el selector superior ahora aparece para cualquier usuario con más de una sede; Pedidos ofrece `Todas las sedes` o una sede particular, identifica la sede de cada pedido y valida el filtro server-side contra `store_users`. Founder conserva su aislamiento por comercio seleccionado.
- Migración idempotente preparada: `20260820050000_clone_tdk_branches.sql` crea `pasteleria-tdk-delicias` y `pasteleria-tdk-los-cedros`, copia usuarios, 5 categorías, 15 productos e imágenes desde TDK, reutiliza WhatsApp/horarios/identidad visual, configura Entrega2 y deja ambas tiendas inactivas, sin GPS y sin métodos de pago. No fue aplicada remotamente.
- Validaciones aprobadas: 28/28 contratos críticos, TypeScript, ESLint y build local Next.js 16.3.0 de 163 páginas. `supabase db push --dry-run` confirmó que únicamente esta migración está pendiente.
- Preview de código: `https://vendeplus-clean-896sk4frn-entrega2-s-projects.vercel.app`, deployment `dpl_Dh8gpbXQjJpHC9Mdp4MAVkxnFyn5`, target Preview, estado Ready y build remoto aprobado. Producción y datos remotos siguen intactos.
- Próximo paso exacto: revisar Preview sin esperar todavía ver las nuevas sedes; luego, con autorización explícita, aplicar la migración remota. Las sedes aparecerán en el selector pero seguirán inactivas hasta configurar GPS y pagos de cada una. Después validar panel consolidado y solo entonces promover el código a producción.
- Usuario autorizó y se aplicó remotamente la migración aditiva `20260820050000_clone_tdk_branches.sql`. Supabase confirmó su registro sin errores.
- Verificación remota posterior: `pasteleria-tdk-delicias` y `pasteleria-tdk-los-cedros` existen, ambas inactivas, con WhatsApp `584124574587`, GPS nulo, métodos de pago vacíos, 1 usuario autorizado, 5 categorías, 15 productos y 17 imágenes por sede. Delivery está activo con proveedor `entrega2`, retiro activo y cotización manual.
- El código multisede continúa solo en Preview; producción web no fue promovida. Próximo paso: entrar al Preview con el usuario TDK, comprobar el selector de sede y la vista `Todas las sedes` en Pedidos. Después configurar GPS y pagos por sede antes de activarlas, y promover el código únicamente con aprobación explícita.
- GPS cargado remotamente por solicitud del usuario, sin activar las sedes: Los Cedros `10.240814864, -67.59266906`; Delicias `10.260254588, -67.59025545`. La actualización exigió `is_active=false` y afectó exactamente una fila por slug. Ambas continúan inactivas y con métodos de pago vacíos; la sede TDK original no fue modificada.
- Enlace único TDK implementado en `/tdk`: obtiene únicamente las sedes TDK activas desde el catálogo público, permite selección manual, solicita geolocalización solo al pulsar el botón, calcula distancias localmente con Haversine, ordena por cercanía y recuerda la última sede en `localStorage`. No almacena ni transmite la ubicación del cliente y no carga mapa externo.
- Validaciones aprobadas: 29/29 contratos críticos, TypeScript, ESLint y build local Next.js 16.3.0 de 164 páginas. Nueva Preview conjunta `https://vendeplus-clean-6ucnznpkx-entrega2-s-projects.vercel.app`, deployment `dpl_D1htdjiNsPWHzB2BkdBjfnWdfgue`, target Preview, estado Ready y build remoto aprobado. El navegador integrado no estuvo disponible para QA visual; queda validación desde el teléfono del usuario.
- Producción web no fue promovida. Mientras Delicias y Los Cedros sigan inactivas, `/tdk` mostrará solo la sede original; al activarlas aparecerán automáticamente en un máximo de 30 segundos. Falta GPS válido de la sede original para poder calcular su distancia. Próximo paso: validar diseño y permiso de ubicación en Preview, completar pagos/GPS faltante, activar sedes y luego promover con aprobación explícita.
- Usuario detectó 45 productos al entrar a TDK desde el panel. Causa: el selector global guardaba la sede activa, pero GET `/api/panel/catalogo` y `/api/panel/products` consultaban todas las membresías del usuario. Corregido: ambos endpoints leen `X-Panel-Store-Id`, validan acceso y filtran tiendas, categorías y productos por la sede activa; el fallback de Productos también queda filtrado. Pedidos mantiene intencionalmente `Todas las sedes`.
- Validaciones posteriores: 30/30 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 164 páginas aprobados. Preview corregida conjunta: `https://vendeplus-clean-jj6qu0556-entrega2-s-projects.vercel.app`, deployment `dpl_BrWCsp6hCCRCdAvAmBTHyEewcwSh`, target Preview, build remoto aprobado. Producción intacta.
- Próximo paso: usuario cambia entre las tres sedes en Preview y confirma que `/panel/productos` y `/panel/catalogo` muestran 15 productos por sede; verificar que Pedidos sí conserva la vista consolidada. Promover solo con aprobación explícita.
- Para permitir QA completo sin activar comercios, `/tdk` ahora usa una vista especial cuando `VERCEL_ENV=preview`: muestra las tres sedes y marca Delicias/Los Cedros como `En configuración`; en producción continúa filtrando estrictamente `is_active=true`. Los botones de sedes inactivas llevan a la pantalla segura de catálogo inactivo, comportamiento esperado hasta su activación.
- Preview QA multisede final: `https://vendeplus-clean-e5ulkaipg-entrega2-s-projects.vercel.app`, deployment `dpl_5qzzZoDQGt5dMD12nayPwcBKZdRK`, target Preview, estado Ready y build remoto aprobado. Validaciones: 30/30 contratos, TypeScript, ESLint y build de 164 páginas. Sin promoción ni SQL nuevo.
- Próximo paso: usuario prueba `/tdk`, geolocalización, recuerdo de sede, selector de panel, aislamiento 15/15/15 y Pedidos consolidado. No crear pedidos QA persistentes sin acordar limpieza; promover únicamente después de aprobación explícita.
- Usuario reportó que Configuración seguía mostrando las tres sedes. Diagnóstico confirmado: GET `/api/panel/settings` aún filtraba por todas las membresías y no por `X-Panel-Store-Id`. Se corrigió con validación `assertStoreAccess` y filtro exacto de la sede activa.
- Auditoría preventiva del mismo flujo: GET `/api/panel/delivery-settings` y GET `/api/panel/options` también fueron aislados por la sede superior; Productos, Catálogo y Pedido manual ya estaban cubiertos. Pedidos conserva deliberadamente `Todas las sedes`.
- Validaciones: 31/31 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas aprobados. Preview actualizada: `https://vendeplus-clean-8sn5xfkid-entrega2-s-projects.vercel.app`, deployment `dpl_CvsTQqBnNpYeDMuF6H1TKmDnfB8d`, target Preview, build remoto aprobado. Sin SQL ni promoción.
- Próximo paso: validar cambiando de sede en Configuración, Delivery y Opciones/Extras; cada módulo debe mostrar exactamente una sede y mantener sus propios datos. Promover solo con aprobación explícita.
- Usuario detectó que Inicio → `Ver catálogo` abría Delicias aunque la sede superior fuera Piñonal. Causa: `/api/panel/stats?mode=summary` ignoraba `X-Panel-Store-Id`, devolvía todas las tiendas y Dashboard elegía la primera. Corregido: Stats toma la sede del query o encabezado, valida acceso y filtra también `stores`, pedidos, productos y clientes; enlace y métricas de Inicio quedan alineados con la sede activa.
- Piñonal auditada remotamente: `Pastelería TDK Piñonal`, GPS válido `10.235959415, -67.577899972`, activa. Por solicitud del usuario se cambió de `own_delivery` a `entrega2`, conservando delivery activo, retiro activo y pricing manual. Actualización afectó exactamente la configuración esperada.
- Validaciones: 32/32 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas. Preview actual: `https://vendeplus-clean-68ohgikec-entrega2-s-projects.vercel.app`, deployment `dpl_4ypsEbZ7qxWW8jTCfnQUDY17huEX`, target Preview y build remoto aprobado. Sin migración ni promoción web.
- Próximo paso: en Preview seleccionar Piñonal, confirmar que Inicio → Ver catálogo abre `/pasteleria-tdk`, que las métricas corresponden a Piñonal y que Delivery muestra Entrega2. Repetir enlace con Delicias/Los Cedros. Promover solo con aprobación explícita.
- Usuario mostró que el nombre de sede en tarjetas de Pedidos se truncaba (`Pastelería TDK P...`). Se amplió la primera columna desktop de 92px a 180px, se permite hasta dos líneas con tipografía legible y se agregó `title` con el nombre completo. No cambia datos ni acciones del pedido.
- Validaciones: 33/33 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas. Preview actual: `https://vendeplus-clean-mzjqol2dv-entrega2-s-projects.vercel.app`, deployment `dpl_8vJiAzaKT4dwc33FDKVEhkA5ap3d`, target Preview y build remoto aprobado. Sin SQL ni producción.
- Próximo paso: revisar en `/panel/pedidos` la misma tarjeta de la captura en PC y teléfono, confirmando que `Pastelería TDK Piñonal` sea legible y que el resto de columnas no se solape. Promover solo con aprobación explícita.
- Usuario indicó que ampliar la columna agrandó demasiado la tarjeta. Se restauró el ancho original de 92px y se compacta únicamente el prefijo común `Pastelería TDK`: las tarjetas muestran `Piñonal`, `Delicias` o `Los Cedros`; el atributo `title` conserva el nombre completo. La tarjeta vuelve a su tamaño previo.
- Validaciones sin cambios: 33/33 contratos críticos, TypeScript, ESLint y build Next.js 16.3.0 de 160 páginas. Preview refinada: `https://vendeplus-clean-1fxraaztr-entrega2-s-projects.vercel.app`, deployment `dpl_i9MAVSjZ9GTopKSYN8e6kXE2xRbX`, target Preview, build remoto aprobado. Producción intacta.
- Auditoría final multisede completada. Confirmado: autorización y roles se validan server-side contra `store_users`; mutaciones sensibles recalculan/validan `store_id`; caché cliente incluye encabezados (incluido `X-Panel-Store-Id`), evitando reutilizar respuestas de otra sede; Founder continúa aislado al comercio seleccionado.
- Riesgos corregidos: Clientes, exportación y reconstrucción histórica ahora quedan limitados a la sede activa; Suscripción y Logros respetan la sede superior; Delivery, después de PATCH/POST/DELETE, devuelve únicamente la sede modificada y no vuelve a mezclar las tres. Solo Pedidos conserva consolidación intencional.
- Validaciones finales: 35/35 contratos críticos, TypeScript, ESLint, `git diff --check` y build Next.js 16.3.0 de 160 páginas aprobados. Preview final: `https://vendeplus-clean-ehsd17ie2-entrega2-s-projects.vercel.app`, deployment `dpl_DmZ5YaFWrz8tMEUxyWJewsNP7h99`, target Preview, estado Ready y build remoto aprobado. Sin migración ni promoción nueva.
- Riesgo arquitectónico residual no bloqueante para piloto: la pertenencia multisede se deduce de compartir usuario en `store_users`; es segura pero puede agrupar negocios no relacionados del mismo propietario. Antes de habilitar multisede masivamente, crear agrupación explícita (`store_groups` + membresías) y hacer que `Todas las sedes` consolide solo el grupo activo. No hace falta para el piloto TDK de tres sedes.
- Próximo paso: validar en Preview Clientes, Delivery, Suscripción y Logros cambiando entre Piñonal/Delicias/Los Cedros; después promover y respaldar únicamente con aprobación explícita.
- Usuario solicitó activar las tres TDK, dejar únicamente `Efectivo` y ocultarlas del Marketplace. Se agregó control explícito `stores.marketplace_visible` (default `true`) y se actualizó `marketplace_eligible_store_ids` para excluir de forma centralizada las tiendas con visibilidad desactivada, manteniendo disponibles sus enlaces directos.
- Migración `20260821030000_add_marketplace_visibility.sql` aplicada remotamente tras dry-run exitoso. Estado verificado: Piñonal, Delicias y Los Cedros `is_active=true`, `marketplace_visible=false`, `payment_methods=["Efectivo"]`; RPC de Marketplace devuelve cero IDs elegibles para las tres.
- Defensa adicional en web: `getPublicStores` también descarta `marketplace_visible=false` antes de Home/Marketplace, incluso si la lista candidata ya fue obtenida. Los catálogos directos y `/tdk` no dependen de esa visibilidad.
- Validaciones: 36/36 contratos críticos, TypeScript, ESLint y build local Next.js 16.3.0 aprobados. Preview: `https://vendeplus-clean-6dun1kfkg-entrega2-s-projects.vercel.app`, deployment `dpl_GBKUnofBWRKmBMxNSFfYygNFRaxN`, target Preview y build remoto aprobado. Producción web no fue promovida; la exclusión del Marketplace ya funciona en producción mediante la RPC remota.
- Próximo paso: validar `/tdk`, los tres catálogos directos, checkout con solo Efectivo y ausencia de TDK en `/marketplace`; después promover web con aprobación explícita.
- Usuario aprobó la Preview y autorizó continuar. Se promovió exactamente `dpl_GBKUnofBWRKmBMxNSFfYygNFRaxN`; Vercel creó el deployment productivo `dpl_FzvGmHkcKHZztgYnDmky4bEcKHVq` (`vendeplus-clean-6edplbpwq-entrega2-s-projects.vercel.app`), estado Ready, con alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`.
- Smoke productivo aprobado: Home, Marketplace, `/tdk`, los tres catálogos TDK y login HTTP 200; `/api/panel/orders` sin sesión HTTP 401 esperado. TDK no aparece en el HTML de Marketplace y los tres catálogos contienen Efectivo. Sin logs de error iniciales y `git diff --check` limpio.
- Rollback web disponible al deployment productivo anterior registrado por Vercel; la migración de visibilidad y la clonación de sedes ya estaban aplicadas y verificadas antes de promover.

# Pendientes de producto priorizados (2026-08-21)

## Marketplace orientado a ventas

- Mejorar la interfaz del Marketplace para que sea más atractiva, visual y orientada a conversión, manteniendo una carga rápida en móviles.
- Incorporar bloques de ofertas y productos más vendidos; definir reglas verificables para destacados y evitar que un comercio monopolice la portada.
- Mostrar u ordenar comercios según cercanía cuando el cliente autorice su ubicación, con selector manual y funcionamiento normal si rechaza el permiso. No almacenar ni transmitir coordenadas sin necesidad.
- Considerar secciones como `Cerca de ti`, `Ofertas`, `Más vendidos`, `Nuevos` y categorías/rubros, sin recargar la pantalla.
- Antes de implementar: auditar datos disponibles, definir cómo se identifica una oferta y calcular rankings server-side sin consultas N+1 ni exponer datos privados.

## Estadísticas de crecimiento para Super Admin

- Mejorar el tablero Founder/Super Admin con pedidos acumulados históricos, pedidos del mes y comparación contra el mes anterior, incluyendo variación absoluta y porcentual.
- Mostrar facturación/GMV mensual y comparativo mes a mes, dejando claro que representa ventas procesadas y no necesariamente ingresos de Somos.
- Métricas valiosas propuestas: comercios activos y nuevos por mes, comercios con al menos un pedido, pedidos promedio por comercio activo, ticket promedio, clientes nuevos/recurrentes, repetición de compra, pedidos por canal (delivery, retiro, mesa/barra), pedidos por estado/cancelación y crecimiento de sedes.
- Incluir rango de fechas, serie mensual y tabla por comercio; proteger todo exclusivamente para Founder/Super Admin.
- Implementar agregaciones en PostgreSQL/RPC e índices adecuados, evitando descargar todos los pedidos a Next.js. Validar definiciones, zona horaria, moneda y tratamiento de pedidos cancelados antes de construir los indicadores.

- Orden sugerido para la próxima sesión: primero auditar tablas y calidad de datos; luego diseñar definiciones y wireframe; implementar una iniciativa a la vez en local/Preview, sin tocar producción hasta aprobación.
- Usuario confirmó visualmente que producción se ve bien. Revisión final: deployment `dpl_FzvGmHkcKHZztgYnDmky4bEcKHVq` continúa Ready; Home, Marketplace, `/tdk`, los tres catálogos y login HTTP 200; API privada de pedidos sin sesión HTTP 401 esperado; sin logs de error. No se hizo un nuevo despliegue ni cambio funcional.

# Estadísticas de crecimiento Super Admin (2026-08-21)

- Implementación local completa, sin cambios remotos ni producción. El resumen Founder agrega pedidos históricos y del mes, ventas/GMV históricas y mensuales, ticket promedio, cancelaciones/tasa, comparación contra el mismo tramo del mes anterior, 12 meses de gráficas, modalidades Delivery/Retiro/Mesa/Barra/Envío nacional y ranking mensual de comercios.
- Definiciones: se excluyen comercios `is_test=true`; pedidos cancelados no cuentan en volumen válido, ventas ni ticket, pero se reportan por separado; todo usa `America/Caracas`. La comparación del mes actual usa los mismos días transcurridos del mes anterior para evitar comparaciones engañosas.
- Migración aditiva pendiente `20260821040000_admin_growth_metrics.sql`: crea RPC `admin_growth_metrics(integer)` ejecutable solo por `service_role` y un índice global por `orders.created_at`. Las agregaciones y rankings ocurren en PostgreSQL; Next.js recibe solo JSON resumido.
- API `/api/admin/summary` conserva `requireAdminAuth` Founder server-side e integra la RPC. Si la migración aún no existe, el resumen anterior sigue funcionando y la sección nueva no aparece.
- Validaciones aprobadas: 37/37 contratos críticos, TypeScript, ESLint completo, `git diff --check` y build Next.js 16.3.0 de 156 páginas. `supabase db push --dry-run` confirmó que solo está pendiente esta migración. Docker local no está activo, por lo que no se ejecutó lint SQL local.
- Próximo paso exacto: con aprobación explícita, aplicar la migración remota aditiva, verificar valores/privilegios y tiempos de RPC, desplegar Preview y probar visualmente `/admin`. No promover web a producción sin aprobación posterior.

# Renovación Marketplace orientada a ventas (2026-08-21)

- Implementación local completa y producción intacta. Se auditó el flujo existente: tiendas ligeras, búsqueda/rubros, recompensas mensuales reales y filtros de actividad/suscripción/visibilidad.
- Nueva experiencia mobile-first: portada compacta, búsqueda por tienda/producto/rubro, filtros horizontales, tarjetas con portada/logo/estado/tiempo/modalidad/costo fijo cuando existe, carruseles, `Ver todos`, lista completa, estado sin resultados, limpiar filtros y skeleton de carga.
- Ubicación voluntaria: solo se solicita al pulsar `Usar mi ubicación`, calcula Haversine en el navegador, ordena y muestra distancia, advierte cuando supera el radio configurado y conserva las coordenadas solo en `localStorage` durante 2 horas; nunca se transmiten al servidor. Incluye permiso denegado, GPS no disponible, timeout, reintento y búsqueda manual por zona/dirección.
- Secciones dinámicas conectadas a datos reales: ofertas por `discount_percent`, más vendidos por unidades de `order_items` en 90 días excluyendo cancelados y nuevos por `products.created_at` en 45 días. Si no tienen contenido no aparecen. No se agregaron calificaciones porque no existe sistema real de reseñas.
- Migración aditiva pendiente `20260821041000_marketplace_discovery.sql`: RPC service-role-only `marketplace_discovery(integer)` e índices para producto/fecha. Filtra tiendas activas, visibles, no test y con suscripción vigente; Next.js recibe solo un JSON pequeño.
- Archivos nuevos: `src/lib/marketplace.ts`, `src/app/marketplace/loading.tsx` y la migración. Cambios en `src/app/marketplace/page.tsx`, `src/components/public/MarketplaceClient.tsx` y contratos.
- Paquete conjunto Estadísticas + Marketplace validado: TypeScript, ESLint completo, 38/38 contratos críticos, `git diff --check` y build Next.js 16.3.0 de 156 páginas aprobados. Dry-run remoto confirma que solo están pendientes `20260821040000_admin_growth_metrics.sql` y `20260821041000_marketplace_discovery.sql`.
- Próximo paso exacto: con aprobación explícita, aplicar ambas migraciones remotas aditivas, verificar resultados/privilegios/rendimiento, desplegar una sola Preview y realizar QA visual en teléfono/escritorio de Marketplace y `/admin`. No promover a producción sin aprobación posterior.
- Ajuste aprobado sobre recomendaciones: se eliminó `Tiendas recomendadas`. `Los favoritos de la semana` muestra como máximo un producto por comercio: el de mayor cantidad vendida en los últimos 7 días, solo si alcanza al menos 10 unidades y excluyendo pedidos cancelados. Si ningún producto cumple, la sección no aparece. TypeScript, ESLint dirigido, 38/38 contratos y build de 156 páginas aprobados; servidor local actualizado en `http://127.0.0.1:3102/marketplace`.
- El enlace LAN local cargó sin CSS/JS en el teléfono aunque los assets respondían HTTP 200 desde la PC; para QA móvil fiable se desplegó Preview HTTPS `https://vendeplus-clean-llq6f89ka-entrega2-s-projects.vercel.app`, deployment `dpl_DycnWzL2kNAADtjfGnpysmFHqLdp`, target Preview, Ready, build remoto aprobado y `/marketplace` HTTP 200. Producción intacta. Las secciones agregadas permanecen vacías hasta aplicar las dos RPC pendientes.
- Se aplicó remotamente solo la migración Marketplace `20260821041000_marketplace_discovery.sql` y se registró como aplicada. La RPC service-role-only devolvió 1 oferta, 3 favoritos semanales reales (Queje Olga 88, China Town 42 y Knockouts 29 unidades) y 12 productos nuevos. La migración de estadísticas `20260821040000_admin_growth_metrics.sql` continúa pendiente; por el orden de versiones, su futura aplicación requiere `supabase db push --include-all`.
- Rediseño Marketplace refinado: cabecera/hero compactos, ubicación y búsqueda claras, chips horizontales, carruseles de oferta/favoritos/nuevos y comercios en 2 columnas móvil, 3 tablet y 4 desktop. Las tarjetas conservan imagen, logo, estado, rubro, tiempo/distancia y modalidades sin un botón grande adicional.
- Se excluyó también en la defensa de Next.js cualquier comercio `is_test=true`; la QA final muestra 18 comercios reales y ya no incluye `Smash (Test)`.
- QA visual local aprobada en 360, 390, 430, 768 y 1280 px: sin desbordamiento horizontal, grillas 2/2/2/3/4 columnas, geolocalización simulada operativa y cero errores de consola. Capturas finales: `.next/marketplace-final-390.png` y `.next/marketplace-final-1280.png`.
- Validaciones finales del paquete: TypeScript, ESLint, 38/38 contratos críticos, `git diff --check` y build Next.js 16.3.0 de 152 páginas aprobados. Preview final `https://vendeplus-clean-mbskmo2au-entrega2-s-projects.vercel.app`, deployment `dpl_4LJ4Ctufmf2fbNTwRRFGX1S1CHQM`, target Preview, Ready. Producción web no fue promovida.
- Ajuste posterior solicitado: los chips `Abiertos`, `Delivery`, `Retiro`, `Ofertas` y rubros ahora filtran de forma coherente comercios, `Cerca de ti`, destacados, ofertas, favoritos semanales y nuevos. En `Ofertas` se ocultan los demás carruseles para que el resultado sea inequívoco. La búsqueda también filtra los productos visibles.
- Se eliminó el campo manual `Escribe tu zona`; la cercanía depende exclusivamente del botón GPS. Si el permiso se rechaza/falla, el usuario recibe un mensaje y puede continuar explorando sin ubicación.
- Validaciones posteriores aprobadas: TypeScript, ESLint, 38/38 contratos críticos y build Next.js 16.3.0 de 152 páginas. Preview actualizada `https://vendeplus-clean-eo55rl6xf-entrega2-s-projects.vercel.app`, deployment `dpl_4GqSpExPkXpAj68ez495iTooNpcR`, target Preview, Ready. Producción permanece intacta.
- Auditoría de rubros detectó datos históricos mezclados (`food`/`Comida`, `desserts`/`Postres`, `tech`/`Tecnología`). Realza está correctamente guardada como `fashion`; fallaba porque Marketplace comparaba el texto visible `Ropa` contra el código crudo.
- Se creó `src/lib/business-types.ts` como fuente única con orden `Comida`, `Postres`, `Ropa`, `Tecnología`, `Otros`. Marketplace, registro, Configuración del comercio y formulario Super Admin reutilizan la misma lista. Signup, Settings y Admin normalizan server-side los nuevos valores. Los valores históricos se traducen al vuelo, sin migrar ni modificar datos remotos; accesorios, belleza y tipos desconocidos se agrupan en `Otros`.
- El filtro Marketplace ahora incluye la etiqueta canónica en el texto de búsqueda: `Ropa` reconoce `fashion` y muestra Realza/Bodys Style; `Postres` aparece también en registro y Comida queda como opción inicial.
- Validaciones: TypeScript, ESLint, 39/39 contratos críticos y build Next.js 16.3.0 de 152 páginas aprobados. Preview `https://vendeplus-clean-heho5w942-entrega2-s-projects.vercel.app`, deployment `dpl_3ZV3NAQEzXy4h8NwPZVQfnKmsSBY`, target Preview, Ready. Sin SQL ni cambios en producción.
- Usuario aprobó promover. Se revalidó el deployment Preview exacto con TypeScript, 39/39 contratos y `git diff --check`; luego se promovió a producción. Deployment productivo `dpl_FC2TCQhxMwnYaVFZDx1Lf9E9fUsp` (`vendeplus-clean-4q4vx4lfn-entrega2-s-projects.vercel.app`), Ready, con alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`.
- Smoke productivo aprobado: Home, Marketplace, Registro, `/tdk` y `/realza` HTTP 200; `/api/panel/orders` y `/api/admin/summary` sin sesión HTTP 401 esperado. QA Playwright móvil sobre producción: Ropa muestra Realza/Bodys Style, Postres muestra La Cremita/Saboré, Otros muestra Alkkon Fit; Registro presenta exactamente Comida, Postres, Ropa, Tecnología y Otros; cero errores de consola.
- Cambio posterior solo en Preview: tarjetas de Ofertas, Favoritos de la semana y Recién llegados reducidas aproximadamente 20–25% (ancho móvil 55vw, máximo 210px, imagen 16:11, tipografía/padding compactos y menor separación vertical). Mantienen comercio, nombre, precio, descuento y unidades vendidas.
- Preview compacta `https://vendeplus-clean-hrn78ejx4-entrega2-s-projects.vercel.app`, deployment `dpl_H5XsbqWpbzPexiwLFPyZFhsFEdDy`, Ready. TypeScript, ESLint, 39/39 contratos y build de 152 páginas aprobados. Producción aún conserva el tamaño anterior.
- Propuesta pendiente de aprobación: bienvenida ligera sobre `/` solo en primera visita, con `Quiero comprar` hacia Marketplace y `Quiero vender con Somos` para revelar el Home actual; recordar la elección localmente. Evita mover rutas, duplicar Home o afectar SEO. No implementada todavía.
- Pantalla de bienvenida implementada en Preview sobre `/`, sin mover rutas ni sustituir el Home renderizado. Solo aparece si el dispositivo no tiene `somos-welcome-choice-v1`: `Quiero comprar` recuerda `buyer` y navega a `/marketplace`; `Quiero vender con Somos` recuerda `business` y revela el Home actual. Bloquea scroll mientras está abierta; accesos directos a Marketplace, catálogos, Registro y Panel no se interceptan.
- Diseño mobile-first validado visualmente a 390px y escritorio 1280px; la decisión completa cabe en el primer viewport móvil. Capturas locales `.next/welcome-mobile.png` y `.next/welcome-desktop.png`.
- Paquete conjunto incluye las tarjetas compactas del Marketplace. Validaciones: TypeScript, ESLint completo, 40/40 contratos críticos y build Next.js 16.3.0 de 152 páginas aprobados. Preview `https://vendeplus-clean-a3eeiuerv-entrega2-s-projects.vercel.app`, deployment `dpl_8YUmMEVLZgRUGawhodfrbbviNj8c`, target Preview, Ready. Producción intacta.
- Mejora posterior de bienvenida: durante la lectura inicial de `localStorage` se muestra una cubierta neutra para impedir el destello del Home; el diálogo mueve y atrapa el foco, aísla el fondo con `inert`, restaura foco/scroll al cerrar, admite `Escape` y ofrece `Ahora no, ver inicio` sin guardar una elección accidental. Los botones muestran foco visible.
- Validaciones posteriores: ESLint dirigido, TypeScript, 40/40 contratos críticos y build local/remoto Next.js 16.3.0 de 152 páginas aprobados. Preview nueva `https://vendeplus-clean-182vbsx9u-entrega2-s-projects.vercel.app`, deployment `dpl_3nELuELSg1QrphhtxA3SSSzMqswo`, completado. Producción intacta; sin migración ni SQL.
- Próximo paso exacto: probar la Preview en una pestaña privada: primera carga sin destello, navegación por Tab/Shift+Tab, Escape, `Ahora no`, `Quiero vender` y `Quiero comprar`; no promover a producción sin aprobación explícita.
- Usuario aprobó la bienvenida y autorizó producción después de una revisión preventiva. La Preview exacta estaba Ready, sin logs de error, con TypeScript, ESLint, 40/40 contratos y build local/remoto aprobados; se confirmó que no requería SQL adicional.
- Promovida sin reconstruir como deployment productivo `dpl_2h5hq4UsGUQV3uAG61mZZiArSfem` (`vendeplus-clean-nzfa8zvsf-entrega2-s-projects.vercel.app`), estado Ready y alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` asignados.
- Smoke productivo aprobado: Home, Marketplace, Registro, `/tdk` y `/realza` HTTP 200; APIs `/api/panel/orders` y `/api/admin/summary` sin sesión HTTP 401 esperado; cero logs de error del deployment nuevo. No se aplicó migración ni SQL durante la promoción. Rollback web: deployment productivo anterior `dpl_FC2TCQhxMwnYaVFZDx1Lf9E9fUsp`.
- Usuario autorizó activar las estadísticas avanzadas del Super Admin. El dry-run con `--include-all` confirmó que únicamente faltaba `20260821040000_admin_growth_metrics.sql`; se aplicó y quedó registrada remotamente, sin redespliegue web.
- Verificación remota: índice `orders_created_at_idx` presente; RPC `admin_growth_metrics(integer)` es `security invoker`, ejecutable solo por `service_role` y denegada a `anon`/`authenticated`. Respondió 12 meses, 1.276 pedidos históricos válidos, 829 del mes actual, 3 modalidades y 10 filas de ranking en zona `America/Caracas`.
- Smoke posterior: `/admin` HTTP 200, `/api/admin/summary` sin sesión HTTP 401 esperado y cero logs de error del deployment productivo. El lint remoto conserva únicamente el fallo interno preexistente de `extensions.index_advisor` por ausencia de `hypopg_reset()`; no pertenece a la migración ni afecta las estadísticas.
- Contacto oficial Somos preparado localmente con el número `+58 422-4600742`, centralizado como `584224600742`. Home muestra `Contactar por WhatsApp`; el registro exitoso de comercio o empresa delivery abre el chat oficial con un resumen prellenado y mantiene un botón de respaldo. El usuario confirma el envío en WhatsApp; nunca se incluyen contraseña, cédula ni captcha.
- Ambos formularios informan antes de enviar que WhatsApp se abrirá después del registro. El chat solo se abre tras una respuesta exitosa de la API, por lo que errores de validación/captcha no lo disparan.
- Validaciones: TypeScript, ESLint dirigido, 41/41 contratos críticos, `git diff --check` y build local/remoto Next.js 16.3.0 aprobados. Preview `https://vendeplus-clean-ewbdsg2d4-entrega2-s-projects.vercel.app`, deployment `dpl_AU91k46Xdu3i83CyDUptQViq85jr`, target Preview, Ready y sin logs de error. Producción intacta; sin migración ni SQL.
- Próximo paso exacto: validar botón del Home y avisos de `/registro` y `/transporte/registro`; para probar el envío automático completo debe usarse un registro QA autorizado porque crea datos reales. No promover sin aprobación explícita.
- Ajuste visual posterior: el botón oficial de WhatsApp se retiró del hero y ahora aparece al cierre de `Creado para operaciones locales reales`, dentro de una franja compacta de ayuda. Las tres acciones principales del hero recuperaron su jerarquía original.
- Validaciones posteriores: ESLint dirigido, 41/41 contratos, `git diff --check` y build local/remoto de 164 páginas aprobados. Preview actualizada `https://vendeplus-clean-f6d50eyq4-entrega2-s-projects.vercel.app`, deployment `dpl_B5daNPrsmrx33qHnwpMbmWf149TS`, target Preview. Producción intacta.
- Usuario aprobó y autorizó producción. La Preview exacta fue promovida sin cambios de base de datos como deployment productivo `dpl_2786Lm33srzm4wQyr8Kvy9Bxm5o6` (`vendeplus-clean-1t1f06dfq-entrega2-s-projects.vercel.app`), estado Ready y alias productivos asignados.
- Smoke productivo aprobado: Home contiene `Contactar por WhatsApp`; Registro de comercio y empresa delivery contienen el aviso del WhatsApp oficial; Marketplace, `/tdk` y `/realza` HTTP 200; APIs privadas de pedidos y resumen admin sin sesión HTTP 401 esperado; cero logs de error. Rollback web: `dpl_2h5hq4UsGUQV3uAG61mZZiArSfem`.

# Acciones compactas del catálogo (2026-08-21)

- Cambio preparado solo en Preview; producción permanece en `dpl_2786Lm33srzm4wQyr8Kvy9Bxm5o6` sin modificaciones.
- Debajo del buscador, las acciones ahora son cuatro tarjetas compactas en una fila: WhatsApp, Tasa, Compartir e Instalar Somos. Se eliminó de esa zona la tarjeta de tiempo estimado.
- `PwaInstallButton` admite una variante `tile` discreta para el catálogo sin alterar sus usos existentes en Home, Panel o Admin. Si la app ya está instalada, la acción no se muestra; la ayuda de instalación no ensancha la cuadrícula.
- El encabezado ya no presenta el texto predeterminado `Disponible hoy`. Solo muestra un horario/texto personalizado no vacío; los estados reales abierto/cerrado y sus avisos siguen funcionando.
- Archivos modificados: `src/components/public/CatalogClient.tsx`, `src/components/public/StoreBrandHeader.tsx`, `src/components/pwa/PwaInstallButton.tsx`, `src/lib/supabase/catalog.ts` y `scripts/critical-contracts.test.mjs`.
- Sin migración ni SQL. Validaciones aprobadas: ESLint dirigido, TypeScript, 42/42 contratos críticos, `git diff --check` y build local Next.js 16.3.0 de 164 páginas.
- Preview: `https://vendeplus-clean-qywq190gm-entrega2-s-projects.vercel.app`, deployment `dpl_CPQWdRjm2JyeJ4ac3PZVRgxShmeN`, target Preview, estado Ready, build remoto aprobado y sin logs de error.
- Próximo paso exacto: probar un catálogo en móvil, incluida la acción Instalar Somos en Android/iPhone, y promover solo con aprobación explícita. No hay commit ni push de este cambio todavía.
- Refinamiento solicitado aplicado: WhatsApp queda visualmente solo como icono (con etiqueta accesible), la tasa elimina el escudo y se divide en `1$`/`1€` arriba y `Bs. monto` abajo, y la acción usa la misma familia tipográfica con el texto `Instalar Somos`.
- Se eliminó la etiqueta redundante `Promocional`; la sección conserva únicamente el título `Favoritos del momento`.
- Revalidación aprobada: ESLint dirigido, TypeScript, 42/42 contratos, `git diff --check` y build local/remoto de 164 páginas. Preview final `https://vendeplus-clean-4a9gx0lx3-entrega2-s-projects.vercel.app`, deployment `dpl_G6wbg65fk1cBbv9T6hWoG6eXUccn`, Ready y sin logs de error. Producción continúa intacta.
- Corrección por QA visual móvil: la captura del usuario evidenció tarjetas altas y una instalación deformada. El contenedor/search redujo padding y sombra; las cuatro acciones tienen altura fija uniforme de 56 px. `Instalar Somos` ya no muestra un icono comprimido en esta variante y hereda explícitamente la fuente del catálogo en negrita.
- QA móvil local sobre `/realza` confirmó una barra compacta y alineada. Validaciones y build local/remoto de 164 páginas aprobados. Preview corregida `https://vendeplus-clean-lhm9122hn-entrega2-s-projects.vercel.app`, deployment `dpl_9DkiRuHDRpcxbYNEFV1tPFeLhc7s`. Producción intacta.
- Usuario aprobó la corrección visual y se promovió exactamente esa Preview a producción sin reconstruir cambios distintos. Deployment productivo `dpl_ASeqiQW6WRZrBGenzEYEgng73V2R` (`vendeplus-clean-m5ly8u9nx-entrega2-s-projects.vercel.app`), Ready, con alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app`.
- Smoke productivo aprobado: Home, Marketplace, Registro, `/realza` y `/tdk` HTTP 200; APIs privadas de pedidos y resumen admin sin sesión HTTP 401 esperado; sin logs de error. Sin migración ni SQL. Rollback web: `dpl_2786Lm33srzm4wQyr8Kvy9Bxm5o6`.
- Corrección posterior del cuarto control: la causa de que desapareciera era la rama `isStandalone()` del PWA. Si Somos no está instalada continúa mostrando `Instalar Somos`; si ya está instalada, conserva la cuarta tarjeta con el isotipo oficial enlazado al Home (`/`) en lugar de ocultarla.
- Validaciones aprobadas: ESLint, TypeScript, 42/42 contratos, `git diff --check`, build local/remoto de 164 páginas. Preview `dpl_Ame8afy2GGTyZ3CcMgW36KcamBYD`; producción `dpl_BL92WGUBSAvyCjdHmiR4PzSh9ooH` (`vendeplus-clean-n09pzmowf-entrega2-s-projects.vercel.app`), Ready y con alias productivos. Home/Marketplace/Realza/TDK HTTP 200, APIs privadas 401 esperado y sin logs de error. Rollback: `dpl_ASeqiQW6WRZrBGenzEYEgng73V2R`.
- Checkpoint final solicitado: diff revisado y limitado a las acciones/horario del catálogo, variante PWA, contrato crítico y este handoff. Lint global, TypeScript, 42/42 contratos, `git diff --check`, `check:production` y build de 164 páginas aprobados. Producción continúa Ready y sin errores en logs durante la última hora.
- Advertencias operativas conocidas, no causadas por este cambio: Entrega2 permanece apagado sin variables y Pedido asistido usa interpretación local mientras no exista `OPENAI_API_KEY`. No se modificaron variables, Supabase, migraciones ni SQL.

# Sedes La Cremita Gourmet (2026-08-21)

- Usuario confirmó que la sede existente corresponde a Guasimal y autorizó crear Las Ballenas con el mismo WhatsApp/catálogo, vinculada a la misma cuenta, más un selector único estilo TDK.
- Migración idempotente `20260821213759_clone_la_cremita_las_ballenas.sql` creada y aplicada en Supabase producción. Renombró la sede origen a `La Cremita Gourmet Guasimal` sin cambiar su slug, historial ni coordenadas.
- Nueva sede `La Cremita Gourmet Las Ballenas`, slug `la-cremita-gourmet-las-ballenas`, ID `e54a6132-0e4b-4652-a432-dd1e70493ae6`, coordenadas `10.267079665610519, -67.59386449349098`, WhatsApp `584243326419`, activa y visible en Marketplace.
- Las Ballenas comparte el propietario `lacremitagourmet1@gmail.com`; se clonaron 3 categorías, 3 productos, 3 imágenes, 5 grupos, 25 opciones, 8 asociaciones y una configuración de delivery. Tiene cero pedidos y cero clientes; Guasimal conserva 2 pedidos y 2 clientes.
- Se añadió localmente `/la-cremita`, reutilizando de forma configurable el selector de TDK. Guarda la última sede en una clave separada y solo usa geolocalización en el dispositivo.
- Validaciones: transacción SQL de prueba revertida correctamente, dry-run confirmó una sola migración, migración registrada local/remota, ESLint dirigido, TypeScript, 43/43 contratos, `git diff --check` y build local/remoto Next.js 16.3.0 de 165 páginas aprobados.
- Preview Ready `https://vendeplus-clean-m5okzvrnc-entrega2-s-projects.vercel.app`, deployment `dpl_D581fYqKuDmr9jQsRPVyCnLDGwbV`, sin logs de error. El catálogo directo productivo `/la-cremita-gourmet-las-ballenas` ya responde HTTP 200 con el nombre correcto; el selector `/la-cremita` aún no fue promovido a producción.
- Próximo paso exacto: validar visualmente el selector Preview y ambos catálogos; con aprobación explícita promover esa Preview. No hay commit ni push todavía.
- Usuario autorizó producción. Se promovió exactamente la Preview como deployment productivo `dpl_7WPa2J7sgLcRaYe2faz5ndrk882g` (`vendeplus-clean-laxm1sxck-entrega2-s-projects.vercel.app`), Ready y con alias oficiales.
- Smoke productivo aprobado: `/la-cremita` HTTP 200 y contiene Guasimal + Las Ballenas; ambos catálogos directos HTTP 200 y Las Ballenas presenta su nombre correcto. Sin logs de error. Selector oficial: `https://www.somos-ve.com/la-cremita`. Rollback web: `dpl_8sqATEFQvRHTen42WJ6LwT5D7Q4G`; la migración de datos ya aplicada es independiente del rollback web.
- El comercio confirmó operación real y uso correcto de ambas sedes. Usuario solicitó asegurar el trabajo en Git; rama nueva `checkpoint/la-cremita-sedes-20260824` creada desde `origin/main` para evitar reutilizar el PR #7 ya fusionado.
- Revalidación previa al checkpoint: lint global, TypeScript, 43/43 contratos, `git diff --check` y build Next.js 16.3.0 de 173 páginas aprobados; Supabase dry-run confirma base remota al día. No se alteraron datos durante este aseguramiento.
# Delivery propio avanzado y nota contextual del checkout (2026-08-24)

- Trabajo preparado en `feature/delivery-propio-notas-checkout`; producción web permanece intacta.
- Delivery propio ahora conserva `distance_factor`, permite configurar USD por km adicional después del último rango y ofrece un simulador sin efectos sobre pedidos ni tarifas guardadas.
- Panel y API rechazan precios vacíos en tarifa fija, zonas y rangos; también detectan cobertura mayor al último rango sin precio adicional y valores adicionales negativos.
- Checkout reemplaza la nota poco visible por `¿Alguna indicación para tu pedido?`, con tarjeta más llamativa y placeholder automático por rubro. Efectivo conserva su ejemplo específico.
- Configuración del comercio permite un ejemplo personalizado opcional de hasta 180 caracteres. Vacío usa el fallback por rubro; nunca se guarda el ejemplo como nota real.
- Migración aditiva `20260824170036_add_checkout_note_placeholder.sql` aplicada y verificada remotamente. Agrega solo `stores.checkout_note_placeholder`; no modifica valores existentes. Advisors de seguridad sin hallazgos.
- Validaciones: TypeScript, ESLint global, 45/45 contratos, `git diff --check` y build Next.js 16.3.0 de 173 páginas aprobados.
- Preview `https://vendeplus-clean-o0mm1av1u-entrega2-s-projects.vercel.app`, deployment `dpl_CoBDfXhpnMMcAMzfeu9VfGC9PPbZ`, target Preview, Ready. Panel Delivery, Configuración y catálogo de Las Ballenas responden HTTP 200.
- Próximo paso exacto: probar con sesión real en Preview `/panel/delivery` (rango, km adicional y simulador) y `/panel/configuracion` (ejemplo personalizado), luego completar un checkout. No promover producción sin aprobación explícita.
- QA del usuario detectó que un hueco `9–10 km` seguido de `10,2–11 km` no se señalaba. Se agregó detección explícita de continuidad desde 0 km, aviso visible y bloqueo al guardar tanto en cliente como servidor. Rangos contiguos como `9–10` y `10–11` quedan permitidos; los cruces reales continúan bloqueados.
- Usuario aprobó la Preview corregida y autorizó producción y aseguramiento en Git. Preview aprobada exacta: `dpl_4Mr5wEXQ2Bz314vaUVbn17wzcthb` (`https://vendeplus-clean-jguobq5w4-entrega2-s-projects.vercel.app`).

# Presentación informativa de empresa delivery en checkout (2026-08-24)

- Cambio local en `ui/checkout-delivery-partner-note`; producción intacta.
- El bloque con logo dejó de imitar un botón: sin borde perimetral, fondo de tarjeta, sombra, hover ni cursor. Ahora es una nota abierta con línea lateral, logo y el texto `Tu entrega será coordinada por`.
- Refinamiento aprobado: se retiró la explicación secundaria por redundante. El bloque conserva únicamente `Tu entrega será coordinada por`, nombre y logo. No cambia selección, cotización ni envío del pedido. Usuario autorizó llevarlo a producción.

# Marketplace con experiencia tipo app (2026-08-24)

- Trabajo local en `preview/marketplace-app-experience`; producción web y Supabase productivo permanecen intactos.
- `Recién llegados` ahora verifica server-side, mediante una sola consulta adicional de máximo 12 IDs, que cada producto tenga `products.image_url` propio. No acepta el fallback de logo o portada del comercio para esa sección.
- Primera propuesta visual app-like: cabecera móvil compacta, hero contenido como superficie redondeada, buscador/filtros sticky, secciones unificadas en tarjetas blancas con ritmo consistente y navegación inferior móvil a Inicio/Cerca/Ofertas/Comercios.
- Se conservaron GPS, filtros, búsqueda, ofertas, favoritos, nuevos, enlaces a catálogos y grilla de comercios. Sin migración ni SQL para evitar cualquier cambio productivo.
- Ajuste posterior: `Cerca` en la navegación inferior solicita la ubicación; se eliminó el botón naranja redundante junto al buscador y se conservó la acción de ubicación en la cabecera móvil.
- Segunda iteración visual solicitada: más vida sin saturar; ofertas usan coral suave, favoritos ámbar, nuevos menta, comercios verde claro y la navegación inferior incorpora acentos cromáticos por destino.
- Cabecera móvil refinada: reemplaza el texto `Somos` por el `BrandLogo` oficial y agrega un instalador PWA sutil. La variante se oculta si la app ya está instalada y conserva la ayuda específica para iPhone/otros navegadores.
- Copy simplificado: el hero dice `Las mejores opciones en un solo lugar.` y favoritos usa `Lo más pedido`, eliminando el texto técnico sobre ganador, tienda y mínimo de ventas.
- Usuario aprobó la propuesta completa y autorizó producción. Se promovió exactamente la Preview aprobada `dpl_H1eVkjm9aqbgBtAzzqtRwoVGTUWT`; Vercel creó el deployment productivo `dpl_BxSo8XN6q3g6nCF4f65ZYRP9UpL2` (`vendeplus-clean-9r9ca4cfr-entrega2-s-projects.vercel.app`). Está `Ready` y posee los alias `www.somos-ve.com` y `somos-ve.com`.
- Smoke productivo: `https://www.somos-ve.com/marketplace` responde HTTP 200 y contiene `Las mejores opciones en un solo lugar`; escaneo de logs de error de los últimos 10 minutos sin hallazgos. No hubo migración ni SQL. Aún no hay commit, push ni PR para esta iteración.
- Usuario reportó intermitencia en `Instalar` y pospuso indefinidamente la app nativa. Diagnóstico: `RegisterServiceWorker` solo escuchaba `load`; si React hidrataba después del evento, el SW no se registraba en esa visita. Corrección local: registrar inmediatamente cuando `document.readyState === "complete"`, listener único con cleanup en los demás casos, y botón protegido contra doble toque, errores/rechazo y regreso desde instalación. Pendiente validar y mostrar en Preview antes de producción.
- Corrección PWA validada con TypeScript, ESLint dirigido, 48/48 contratos, `git diff --check` y build Next.js 16.3.0 de 181 páginas. Preview `dpl_BU6RsEJzkjeqxpdbzoi8zBDxhmdJ` (`https://vendeplus-clean-8hb2zlaem-entrega2-s-projects.vercel.app`) está `Ready`; `/marketplace` responde HTTP 200 autenticado. La protección SSO de Preview redirige `sw.js`/manifest a login para visitantes sin sesión, por lo que la instalación real debe verificarse en un origen local seguro o tras autorización productiva. En producción actual ambos recursos responden correctamente con MIME `application/javascript` y `application/manifest+json`. No promover aún sin aprobación.
- Usuario aprobó y autorizó promover la corrección PWA. Se promovió exactamente `dpl_BU6RsEJzkjeqxpdbzoi8zBDxhmdJ`; deployment productivo resultante `dpl_BFKDTvXMoGGYDdB1DGhuSZmNafP5` (`vendeplus-clean-e5zxrm4r3-entrega2-s-projects.vercel.app`) está `Ready` y tiene los alias oficiales. Smoke productivo: Marketplace HTTP 200, `sw.js` HTTP 200 `application/javascript`, manifest HTTP 200 `application/manifest+json`, sin logs de error recientes. Rollback web inmediato: `dpl_BxSo8XN6q3g6nCF4f65ZYRP9UpL2`. Sin migración ni SQL; cambios aún sin commit/push/PR.
- Segundo reporte PWA: en vez del prompt nativo aparecía la ayuda y, en móvil, se cortaba hacia la derecha. Nueva corrección local: captura temprana de `beforeinstallprompt` con `next/script` `beforeInteractive` para evitar perder el evento antes de la hidratación; el botón consume el evento compartido y la ayuda compacta pasa a diálogo flotante centrado (`fixed`, ancho limitado), legible en pantallas estrechas. Pendiente validar en Preview; no promover sin nueva aprobación.
- Segunda corrección PWA validada: TypeScript, ESLint dirigido, 48/48 contratos, `git diff --check` y build Next.js 16.3.0 de 177 páginas aprobados. Preview `dpl_4NzoRuSQxqJ8AoCVaout6964k59v` (`https://vendeplus-clean-l2u52cqky-entrega2-s-projects.vercel.app`) está `Ready`. La prueba real del prompt continúa sujeta a la política/cooldown del navegador y la protección SSO del Preview; el diálogo fallback sí queda acotado a pantalla. No promover sin aprobación.
- Usuario confirmó que el prompt nativo funcionó y autorizó promover. Se promovió exactamente `dpl_4NzoRuSQxqJ8AoCVaout6964k59v`; deployment productivo `dpl_GUH6suuagmvqQPqPhzSjbiQPQJSG` (`vendeplus-clean-ks1qbtun1-entrega2-s-projects.vercel.app`) está `Ready` con todos los alias oficiales. Smoke: Marketplace HTTP 200, `sw.js` HTTP 200 `application/javascript`, manifest HTTP 200 `application/manifest+json`, sin logs de error recientes. Rollback: `dpl_BFKDTvXMoGGYDdB1DGhuSZmNafP5`. Sin migración/SQL; cambios todavía sin commit/push/PR.
- Usuario autorizó asegurar la entrega completa en Git: commit de los 8 archivos de Marketplace/PWA/pruebas/handoff, push, PR a `main`, checks y merge si todo queda verde. El PR borrador antiguo #3 queda fuera de alcance.
# Hotfix productivo Marketplace + zonas de empresa delivery (2026-08-30)

- Producción vigente `dpl_735qQPwarBPWvvH9a9PtyNgdPGcc`, Ready y con alias oficiales.
- Superadmin `/admin/comercios` conserva la tabla existente y agrega únicamente el ojo para cambiar `marketplace_visible`. El endpoint PATCH exige founder y actualiza exclusivamente ese campo.
- `POST /api/orders` evita enviar UUID de `transport_agency_zones` a `orders.delivery_zone_id`, cuya FK pertenece a `store_delivery_zones`; para empresa delivery guarda `delivery_zone_id=null` y conserva todos los metadatos de agencia, zona y tarifa.
- Prueba real Preview aprobada con Burger Más + Un Delivery Más: pedido `VP-0830-TNC`, zona San Felipe Centro, $2, estado de agencia pendiente y respuesta HTTP 200.
- Producción verificada: Burger Más, carrito, checkout y Marketplace HTTP 200; rutas de impresión HTTP 404; cero logs de error del deployment nuevo.
- Sin migración ni SQL. Validaciones: 57/57 contratos, ESLint dirigido, TypeScript, `git diff --check` y build Next.js 16.3.0 de 161 páginas.
- El piloto de impresión permanece fuera de esta rama y fuera del bundle productivo.
# Marketplace público: textos simplificados (2026-09-04)

- En `/transporte/[agencySlug]/marketplace` el encabezado conserva solo `Comercios aliados a [empresa]`; se retiraron las dos líneas redundantes que repetían el nombre.
- En el descubrimiento quedan solo `Destacados Somos`, `Los favoritos de la semana` y `Recién llegados`; se retiraron `Beneficios activos`, `Lo más pedido` y `Productos nuevos`.
- `MarketplaceClient` omite eyebrow y descripción vacíos sin alterar los textos predeterminados del Marketplace general.

# Recuperación de ciudad y mensaje de contraseña (2026-09-04)

- Trabajo aislado en `.city-recovery-clean`, rama `fix/restore-city-and-signup`, desde `origin/main`; no se mezclaron impresión, controles delivery ni catálogos pendientes.
- Causa ciudad: la fase ya había llegado a producción y Supabase conserva el esquema/datos, pero sus archivos nunca se integraron en `main`; un despliegue posterior desde `main` retiró el selector y el flujo estructurado.
- Restaurado: selector/filtro por ciudad del Marketplace, ciudad obligatoria en registro, ciudad en configuración y Superadmin, ciudad base/cobertura de empresas delivery y validación server-side al solicitar afiliación.
- Registro corregido: la API ya no recorta la clave y diferencia longitud insuficiente de claves débiles/comunes/filtradas; el cliente valida 8 caracteres antes de enviar. Nunca se registra la clave.
- Migraciones recuperadas en Git: `20260831120000_service_cities_phase1.sql` y `20260901130000_add_venezuela_state_capitals.sql`. Ya estaban aplicadas en producción; no se ejecutó SQL en esta recuperación.
- Validaciones: TypeScript, ESLint dirigido, 59/59 contratos y `git diff --check` aprobados. El build local encontró bloqueo EPERM/Turbopack por dependencias del worktree; el build remoto Vercel Next.js 16.3.0 aprobó 182 páginas.
- Preview Ready: `dpl_FcNQVGYFSWWX64QqS4sJUnrXpawA`, `https://vendeplus-clean-kjhoyrdl3-entrega2-s-projects.vercel.app`. La protección de Preview devuelve login de Vercel al smoke anónimo; no hubo logs de error.
- No hay commit, push ni producción. Próximo paso: validar con sesión Vercel el selector en `/marketplace` y ciudad/registro en `/registro`; con aprobación explícita promover exactamente esta Preview.
- Usuario aprobó la Preview y autorizó proceder. Se promovió exactamente `dpl_FcNQVGYFSWWX64QqS4sJUnrXpawA`; deployment productivo resultante `https://vendeplus-clean-gb2ianpix-entrega2-s-projects.vercel.app`, Ready y con alias oficiales.
- Smoke productivo aprobado: `/marketplace`, `/registro` y `/api/cities` HTTP 200 con sus marcadores de ciudad; cero logs de error recientes. Rollback web: `https://vendeplus-clean-7gbev6i76-entrega2-s-projects.vercel.app`.
- Pendiente inmediato: commit, push, PR y merge a `main` de esta rama limpia para impedir una nueva regresión.
- Validaciones aprobadas en worktree limpio: ESLint dirigido, `git diff --check` y build Next.js 16.3.0 de 181 páginas.
- Sin migración ni SQL. Cambio aislado de la impresión térmica y demás trabajos pendientes.
# Adelanto backlog: contraseña, colores y respaldo delivery (2026-09-04)

- Rama aislada `feature/account-delivery-controls`, basada en `origin/main` después del PR #16. No mezcla impresión térmica, catálogos ni cobertura por ciudades.
- Punto 1: comercios ven `Contraseña` en su navegación y empresas delivery ven `Contraseña` en su panel. El formulario reutiliza la sesión Supabase activa, exige 8 caracteres, confirmación, cierra la sesión después del cambio y conserva el flujo de recuperación por email.
- Punto 2: la configuración de empresa delivery incorpora color principal y de acento. La API exige rol owner/admin y normaliza valores hexadecimales. El Marketplace público aplica ambos colores al encabezado mediante variables CSS con los colores Somos como fallback.
- Migración nueva no destructiva: `20260904044204_transport_agency_marketplace_colors.sql`; agrega `marketplace_primary_color` y `marketplace_accent_color` con defaults y checks hexadecimales.
- Punto 4: Facturación delivery incorpora `Descargar respaldo CSV`. El endpoint limita el período, máximo 5.000 filas y 12 descargas cada 10 minutos; autoriza únicamente owner/admin/billing de la empresa, filtra por `agency_id`, evita fórmulas CSV y responde sin caché.
- Validaciones aprobadas: ESLint dirigido, TypeScript, 60/60 contratos críticos, `git diff --check` y build Next.js 16.3.0 de 183 páginas.
- Bloqueo para aplicar SQL: el dry-run remoto detectó 13 migraciones aplicadas en Supabase que aún no existen en `main` (`20260826152000` a `20260903203000`). No se aplicó la nueva migración para no romper el historial; primero deben integrarse las migraciones pendientes en Git.
- Sin commit, push, PR ni despliegue de esta rama todavía. Próximo paso: reconciliar el historial de migraciones, repetir `supabase db push --linked --dry-run`, revisar en Preview con cuentas reales y recién entonces publicar.

## Revisión posterior y sincronización con main (2026-09-04)

- La rama se actualizó por fast-forward hasta `origin/main` (`28f6d67`) y conserva tanto la restauración de ciudades/registro como los tres adelantos. Los dos conflictos de integración se resolvieron manteniendo ambas funcionalidades.
- Seguridad corregida: la pantalla de contraseña ahora limpia tokens conservando la ruta actual, también en `/transporte/panel/seguridad`; el CSV exige siempre un `agencyId` concreto y aplica `.eq("agency_id", requestedAgencyId)` incluso en modo founder, evitando exportaciones globales accidentales.
- Validaciones actualizadas: ESLint global aprobado, 62/62 contratos críticos aprobados, TypeScript aprobado, `git diff --check` aprobado y build Next.js 16.3.0 de 184 páginas aprobado cargando secretos solo en memoria del proceso.
- `supabase migration list --linked` confirmó 11 migraciones remotas sin archivo local en `origin/main`: cuatro de impresión y siete de catálogos. Se recuperaron los archivos originales sin cambiar su contenido; esto no reactivó la impresión ni volvió a ejecutar esas migraciones.
- El dry-run propuso exclusivamente `20260904044204_transport_agency_marketplace_colors.sql`; se aplicó correctamente y la lista local/remota quedó completamente alineada.
- UX de claves refinada: ayuda visible con una recomendación simple y errores separados para longitud, contraseña filtrada y otros rechazos, sin desactivar la protección de Supabase. Se aplicó a registro de comercios, registro de empresas delivery y cambio de contraseña.
- Validación final: ESLint global, 62/62 contratos, TypeScript, `git diff --check` y build Next.js 16.3.0 de 184 páginas aprobados.
- Estado: puntos 1, 2 y 4 listos para commit, push y Preview. Aún no promover a producción sin prueba real del usuario.

## Preview de contraseña, colores y respaldo delivery (2026-09-04)

- Commit funcional `6c9fd6f` creado y subido a `origin/feature/account-delivery-controls`.
- Preview Ready: `dpl_2mDYiM5pS2G2qYgZ53f9C3iw971Y`, `https://vendeplus-clean-6e98kqbkx-entrega2-s-projects.vercel.app`. Build remoto Next.js 16.3.0 de 184 páginas aprobado.
- La protección SSO de Vercel responde 302 en el smoke anónimo de todas las rutas; no hubo logs de error. Las pruebas funcionales requieren una sesión autorizada de Vercel y cuentas reales de comercio/empresa delivery.
- Supabase quedó alineado local/remoto y la migración de colores `20260904044204` está aplicada. Producción web no fue promovida.
- Próximo paso exacto: probar en Preview cambio de contraseña de una cuenta controlada, colores del Marketplace y descarga CSV. No promover sin esa aprobación.
# Preview: portada Somos para comercios sin banner (2026-09-04)

- Trabajo aislado en `.default-banner-clean`, rama `fix/default-store-banner-somos`, basada en `origin/main`; no mezcla impresión, catálogos ni otros cambios locales.
- Causa: `mapStore` usaba como fallback global el hero de Don Aniello, una foto de pasta, cuando un comercio nuevo no tenía `cover_image_url`.
- Corrección: comercios sin portada usan el logotipo vigente `/brand/new-somos-preview/somos-logo-preview.png`; el catálogo y las tarjetas del Marketplace lo muestran con `object-contain` y fondo neutral para evitar recortes. Los banners personalizados y los fallbacks explícitos de demos existentes permanecen intactos.
- Validaciones aprobadas: ESLint dirigido, 62/62 contratos, `git diff --check` y build Next.js 16.3.0 de 192 páginas.
- La primera Preview `dpl_FhwxgF6W5vZqBStkZ4GUVTXHkYcA` usó por error el logo anterior y queda descartada. Se retiraron los 3 assets de marca y 7 iconos antiguos que no tenían referencias activas; toda la identidad interna/PWA conserva los recursos vigentes de `new-somos-preview`.
- Preview corregida Ready: `dpl_BguVQ6KP92hkVxywJ9G98tMfCYdG`, `https://vendeplus-clean-fnn0nk2e2-entrega2-s-projects.vercel.app`. Verificación autenticada en `/start-13`: contiene el logotipo nuevo, no contiene el logo anterior ni el fallback de pasta.
- Sin migración ni SQL. Commit `6da3979`, push y PR #20 creados; usuario autorizó proceder. Pendiente: checks verdes, merge y promover la Preview exacta.

# Menú 2026 Sierra Yara (2026-09-04)

- Rama aislada `data/sierra-yara-menu-2026`, basada en `origin/main`; solo incorpora la migración de datos `20260904123000_load_sierra_yara_menu_2026.sql`.
- Migración aplicada correctamente al proyecto Supabase vinculado para el comercio existente `Sierra Yara` (`sierra-yara`). Es idempotente, restringida por `store_id` y elevó `product_limit` a 129 sin cambiar el plan trial.
- Resultado remoto verificado: 21 categorías, 129 productos activos, 55 descripciones, cero precios nulos, 4 grupos, 14 valores y 20 asociaciones de opciones.
- Opciones cargadas: leche solo en los 9 cafés autorizados; salsa en Alitas y Capitan Pops; presentación en las 5 hamburguesas; término de cocción en las 4 hamburguesas de carne.
- Exclusiones confirmadas: ninguna categoría/licor, `Galleta con Helado` y los demás productos sin precio del documento. Pepitos quedaron estándar, sin variantes; no se cargaron acompañantes porque los platos fuertes aplicables no tenían precio.
- Catálogo productivo responde HTTP 200 en `https://www.somos-ve.com/sierra-yara`; tras revalidación contiene `Sierra Yara`, `Espresso` y `Bacon Star`, y no muestra estado inactivo.
- Validación final: `git diff --check` aprobado y build Next.js 16.3.0 aprobado con 192 páginas, cargando secretos solo en memoria del proceso. PR #19 fusionado a `main` en `a704b20`; no hubo cambios adicionales en la base de datos.

# Retoma: asignacion de repartidor en particulares (2026-09-05)

- Usuario confirma que contrasena, colores y CSV ya estan en produccion. Particulares se probo en varias Previews; pendiente: al crear un pedido particular no dejaba asignar repartidor.
- Trabajo vigente en `.particular-delivery-clean`. Vercel confirma ultima Preview Ready `dpl_BjkAzbqQqNdrALcarbKtJWTToayz`, https://vendeplus-clean-95rvs0ki4-entrega2-s-projects.vercel.app, creada 2026-09-04 21:56:57 America/Caracas.
- Diagnostico: RPC original mutate_transport_order_atomic rechaza cuando order_id es null, caso normal de particulares. Correccion local existente en 20260905040000_complete_particular_delivery_operations.sql usa NOT FOUND y omite sincronizacion de orders cuando no hay order_id.
- Verificacion remota migration list --linked: 20260905010000, 020000 y 030000 aplicadas; 20260905040000 pendiente. No se aplico SQL ni se cambio codigo en esta retoma; build no ejecutado por tratarse de diagnostico.
- Siguiente paso exacto: revisar completa la migracion 20260905040000 (tambien incluye idempotencia), validar dry-run y aplicar la correccion; probar asignacion y transiciones de estado en Preview, incluyendo pedido de comercio como regresion. No dar por corregido hasta probar persistencia y eventos. No promover particulares a produccion todavia.

# Validacion de correcciones de particulares (2026-09-05)

- Esta verificacion reemplaza el pendiente anterior: Supabase db push --linked --dry-run responde que la base esta actualizada. Las funciones remotas confirman el guard NOT FOUND para servicios sin order_id y el guard store_id IS NOT NULL para broadcast. No se aplicaron migraciones ni cambios persistentes de datos en esta sesion.
- Se agrego scripts/qa-particular-operations.sql en .particular-delivery-clean: prueba remota BEGIN/ROLLBACK aprobada para creacion, reintento duplicado, asignacion, 9 estados, sincronizacion de solicitud, 10 eventos, servicio inexistente, regresion de comercio y permisos RPC. Todos los datos de QA se revirtieron.
- Validaciones: 63/63 contratos, ESLint global, TypeScript y git diff --check aprobados. npm.cmd run build -- --webpack aprobado: 193 paginas. npm.cmd run build con Turbopack fallo por el enlace node_modules del worktree; el primer intento Webpack carecia de variables privadas. Build final aprobado con ../.env.local cargado solo en memoria, sin modificar archivos de entorno.
- Preview existente confirmada Ready: dpl_BjkAzbqQqNdrALcarbKtJWTToayz, https://vendeplus-clean-95rvs0ki4-entrega2-s-projects.vercel.app. No se hizo deploy, commit ni push.
- Navegador integrado no disponible (iab); no se afirma validacion visual ni E2E de API autenticada. Siguiente paso: probar visualmente en Preview un particular: aceptar, asignar repartidor, En camino, Entregado, recargar y revisar historial. No promover a produccion hasta aprobacion explicita.

# Correccion UX particulares: Entregado y textos del formulario (2026-09-05)

- Usuario confirma que ya permite asignar repartidor, pero en el selector solo veia Repartidor asignado, En camino y Reportar novedad; faltaba mostrar Entregado antes de En camino en operaciones reales.
- Cambios aplicados en `.particular-delivery-clean`: `src/components/transport/TransportOrdersTab.tsx` ahora muestra Entregado desde Aceptado, Repartidor asignado, Por retirar, Retirado y En camino. Tambien conserva Por retirar/Retirado donde aplica y Reportar novedad.
- Cambios aplicados en `src/components/public/ParticularDeliveryForm.tsx`: las pestanas visibles del link de particulares pasan de Envio/Recibo a Usted envia/Usted recibe. No cambia la logica interna sender/receiver.
- Validaciones: `node --experimental-strip-types scripts/critical-contracts.test.mjs` aprobado 63/63; ESLint focal aprobado para los dos componentes; verificacion dinamica UI-vs-servidor aprobada; `git diff --check` aprobado; `npm.cmd run build -- --webpack` aprobado con 193 paginas.
- Preview nuevo Ready: `dpl_HNboUttVUxtATAvfJXdjVJvX579W`, https://vendeplus-clean-rfphl62wk-entrega2-s-projects.vercel.app. Build remoto de Vercel tambien aprobado con 193 paginas.
- No hubo migracion nueva ni SQL a ejecutar. No se hizo commit, push ni promocion a produccion.
- Siguiente prueba visual recomendada: abrir el Preview, crear/usar un particular, aceptar, asignar repartidor, abrir selector de estado y confirmar que Entregado aparece; marcar Entregado, recargar y revisar historial.

# Revision final pre-produccion particulares (2026-09-05)

- Usuario probo el Preview y reporta que todo se ve ok.
- Revision final: Preview `dpl_HNboUttVUxtATAvfJXdjVJvX579W` sigue Ready y target preview. Supabase `db push --linked --dry-run` confirma base remota al dia, sin SQL pendiente.
- Validaciones repetidas: contratos 63/63, ESLint amplio en transporte/particulares sin errores, `git diff --check` sin errores, build local `npm.cmd run build -- --webpack` aprobado con 193 paginas.
- Higiene release: sin cambios en `.env`, `.next`, `node_modules`, package lock, next config ni configuracion Vercel; sin TODO/FIXME/debugger/console.log en el alcance revisado. Avisos CRLF de Git en Windows no bloqueantes.
- Criterio: listo para promocion a produccion desde el Preview validado, con riesgo residual bajo propio de cualquier cambio nuevo. No se ejecuto promocion todavia.

# Promocion a produccion particulares (2026-09-05)

- Usuario autorizo "procede". Se ejecuto `vercel promote vendeplus-clean-rfphl62wk-entrega2-s-projects.vercel.app --yes`.
- Produccion nueva Ready: `dpl_9spgVAKexmJbwVhwwYrbdmFxPieE`, https://vendeplus-clean-6yguima55-entrega2-s-projects.vercel.app.
- Aliases confirmados sobre el deployment nuevo: https://www.somos-ve.com, https://somos-ve.com, https://vendeplus-clean.vercel.app y https://vendeplus-clean-entrega2-s-projects.vercel.app.
- No se hizo commit ni push. No hubo SQL pendiente antes de promover.

# Boton enviar particular a Entrega2 App (2026-09-06)

- Usuario confirmo que Entrega2 App puede recibir origen particular y autorizo "procede con esto".
- Se agrego migracion aplicada remotamente `20260906010000_allow_entrega2_integrations_for_particular_transport_orders.sql`: `order_integrations.order_id` ahora permite null y se agregan `transport_order_id` y `particular_request_id` con indices unicos por proveedor para registrar integraciones de particulares sin simular pedidos de comercio.
- Se agrego endpoint `POST /api/transport/panel/orders/[transportOrderId]/send-entrega2`: protegido por sesion de empresa delivery, rol owner/admin/operator, solo permite `agency.slug = entrega2` y solo `transport_orders` con `particular_request_id`, sin `order_id` ni `store_id`. Valida GPS de retiro y entrega, arma payload particular para Entrega2 App, evita duplicados, registra `order_integrations` y evento `entrega2_app_sent`.
- Se extendieron list/detail de pedidos delivery para incluir `order_integrations`; el panel muestra boton "Enviar a Entrega2 App" solo para particulares cuando la empresa seleccionada es Entrega2. Si ya fue enviado queda deshabilitado con estado de Entrega2.
- Webhooks Entrega2 App `order-status` y `driver-location` ahora leen `transport_order_id`; `order-status` puede sincronizar estados hacia `transport_orders` particulares.
- Validaciones: contratos `64/64`, ESLint focal, TypeScript `npx.cmd tsc --noEmit`, `git diff --check`, Supabase dry-run sin pendientes, build local `npm.cmd run build -- --webpack` con 193 paginas, build Vercel Preview Ready.
- Preview Ready usado para promover: `dpl_JDn2jmjxZyfzWz5f3sWNeuLZMFRy`, https://vendeplus-clean-bpbd0pzye-entrega2-s-projects.vercel.app.
- Produccion nueva Ready: `dpl_EzDrR3V7jopd1znpeojmFFwdVkTK`, https://vendeplus-clean-kubr19ria-entrega2-s-projects.vercel.app. Aliases confirmados: https://www.somos-ve.com, https://somos-ve.com, https://vendeplus-clean.vercel.app y https://vendeplus-clean-entrega2-s-projects.vercel.app.
- No se hizo commit ni push. Prueba real pendiente: desde panel Entrega2, abrir Pedidos, tomar un particular con GPS retiro/entrega, pulsar Enviar a Entrega2 App y confirmar que Entrega2 App lo recibe. Si ya fue enviado, el boton debe quedar deshabilitado mostrando el estado.

# Correccion Preview: puntos retiro/entrega y nota adicional (2026-09-06)

- Usuario corrigio el proceso: no promover a produccion sin prueba explicita previa en Preview. Esta correccion queda solo en Preview; no se promovio.
- Diagnostico: el formulario de particulares podia reutilizar estado interno del componente de mapa entre paso Retiro y paso Entrega. Se aislaron las instancias con keys separadas `pickup-fields` y `delivery-fields`, y tambien key en `LocationPicker` por modo/nombre.
- Se agrego campo visible "Nota adicional (opcional)" al final del paso Resumen. Para evitar nueva migracion antes de prueba en Preview, la nota viaja en el payload, se valida server-side y se incorpora al detalle operativo/WhatsApp como "Nota adicional:" usando el campo existente `package_description`.
- Validaciones: contratos `64/64`, ESLint focal, TypeScript, Supabase dry-run sin SQL pendiente, `git diff --check`, build local `npm.cmd run build -- --webpack` aprobado.
- Preview Ready para prueba manual: `dpl_A4L1rSbmaa5jVLoPpv4ygugjY1q2`, https://vendeplus-clean-liki20t7s-entrega2-s-projects.vercel.app. No promover a produccion hasta que el usuario confirme que el flujo esta ok en este Preview.

# Promocion controlada puntos/nota particulares (2026-09-06)

- Usuario aprobo el Preview y pidio "ok pasalo a produccion controlado".
- Se ejecuto `vercel promote vendeplus-clean-liki20t7s-entrega2-s-projects.vercel.app --yes`.
- Produccion nueva Ready: `dpl_44YcMzKyKqDD5VnnC4orScKYPSwi`, https://vendeplus-clean-hh7vygwdb-entrega2-s-projects.vercel.app.
- Aliases confirmados sobre el deployment nuevo: https://www.somos-ve.com, https://somos-ve.com, https://vendeplus-clean.vercel.app y https://vendeplus-clean-entrega2-s-projects.vercel.app.
- Supabase dry-run posterior confirma base remota al dia. No hubo SQL nuevo para esta correccion de puntos/nota.

# Correccion colores y boton Actualizar en empresas delivery (2026-09-06)

- Diagnostico: los colores del Marketplace se guardaban desde `/api/transport/agencies/[agencyId]`, pero `/api/transport/me` no los incluia al cargar/refrescar el panel. El boton `Actualizar` en el panel delivery tambien llamaba `load()` con defaults dependientes de la pestaña; en `Pedidos` no traia configuracion completa, por eso podia verse estado viejo. El Marketplace publico de empresa delivery tenia `revalidate = 60`, asi que un cambio de color podia tardar hasta 60s.
- Cambios aplicados en `.particular-delivery-clean`: `/api/transport/me` ahora selecciona `marketplace_primary_color` y `marketplace_accent_color` en carga completa y compacta; el boton `Actualizar` es `type="button"` y fuerza `includeConfiguration: true`; el formulario de perfil se remonta cuando cambian los colores; `/transporte/[agencySlug]/marketplace` queda dinamico con `force-dynamic`.
- Contratos reforzados en `scripts/critical-contracts.test.mjs` para exigir colores en `/api/transport/me`, refresh completo, boton seguro y pagina publica dinamica.
- Validaciones aprobadas: 64/64 contratos criticos, ESLint dirigido, TypeScript, `git diff --check`, Supabase dry-run remoto (`Remote database is up to date`) y build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_AneVjiUC8yrFTv3Lnc7NrZCAXhJb`, `https://vendeplus-clean-600zwtybb-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado con 181 paginas; `/transporte/[agencySlug]/marketplace` sale dinamico. Smoke sin sesion queda redirigido a SSO de Vercel, esperado para Preview protegida.
- No hubo migracion nueva ni SQL que ejecutar. No se promovio a produccion; siguiente paso: probar en Preview con login de Vercel/panel que cambiar colores, guardar y pulsar Actualizar refleja valores actuales y el Marketplace abre con los colores nuevos. Promover solo con aprobacion explicita posterior.

# Refinamiento perceptible boton Actualizar delivery (2026-09-06)

- Ajuste posterior a feedback del usuario: aunque el boton `Actualizar` ya refrescaba datos, visualmente no se percibia actividad porque `load()` no mostraba carga cuando habia cache inicial.
- `TransportAgencyPanel` ahora agrega estado dedicado `isPanelRefreshing`: al tocar Actualizar muestra `Actualizando...` con spinner, queda deshabilitado durante la carga y termina con `Panel actualizado.`.
- El refresh manual conserva el mensaje de progreso con `silent: true`, fuerza `includeConfiguration: true` e `includeRelations: true`, refresca pedidos si esta en `Pedidos` y repartidores si esta en `Repartidores`.
- Contratos reforzados y aprobados: 64/64. Validaciones aprobadas: ESLint dirigido, TypeScript, `git diff --check`, build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_3Z6jxbKpZkC2ffzNYARhgM6fmf5x`, `https://vendeplus-clean-p7hsm1o7z-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado de 181 paginas.
- No hubo migracion ni SQL. No se promovio a produccion.

# UX link particulares: tipo de servicio, notas por punto y ubicacion actual condicionada (2026-09-06)

- Usuario reporto que el logo de Entrega2 no se veia centrado en el link de particulares y pidio ajustar el flujo.
- `ParticularDeliveryForm` ahora muestra en el primer paso un selector de tipo de servicio: `Delivery` con icono de moto/bici y `Traslado de persona` con icono de usuario.
- El logo de Entrega2 en la cabecera del link particular usa tratamiento especial `object-contain`, `object-center`, `scale-110` y padding minimo para evitar recorte/descentrado del archivo.
- Se cambio el texto de los campos por punto a `Direccion, referencia o nota de retiro` y `Direccion, referencia o nota de entrega`, ambos opcionales.
- Se elimino la nota adicional final del resumen. La nota/instruccion ahora vive en el campo del punto correspondiente.
- `LocationPicker` agrega `allowCurrentLocation`: el boton de ubicacion actual solo aparece en Retiro cuando el solicitante elige `Usted envia`, y solo aparece en Entrega cuando el solicitante elige `Usted recibe`. El otro punto queda por mapa.
- API publica de particulares acepta `serviceType` y guarda/envia por WhatsApp `Servicio` + `Detalle` dentro de `package_description`, sin cambiar esquema.
- Validaciones aprobadas: 64/64 contratos criticos, ESLint focal, TypeScript, `git diff --check`, Supabase dry-run sin SQL pendiente, build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_AZGfjvJAmVKWHzUTwXtBRNyDB7cW`, `https://vendeplus-clean-4qz7g5ntt-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado de 181 paginas.
- No hubo migracion ni SQL. No se promovio a produccion; probar visualmente en Preview antes de promover.

# Reorganizacion flujo particulares por tipo de servicio (2026-09-07)

- Usuario pidio revertir ajuste especial del logo Entrega2 y rediseñar la logica de particulares para evitar confusion.
- `ParticularDeliveryForm` fue reorganizado: primer paso inicia con selector principal `Delivery` o `Traslado de persona`. El resto del paso se despliega solo despues de elegir tipo.
- Para `Delivery`: pide datos del solicitante y luego `Usted envia` o `Usted recibe`. Si envia, su telefono/ubicacion aplican a retiro y se pide telefono del receptor en entrega. Si recibe, su telefono/ubicacion aplican a entrega y se pide telefono de quien entrega en retiro.
- Para `Traslado de persona`: pide datos del solicitante y luego `Viajo yo` o `Viaja otra persona`. Si viaja el solicitante, no duplica datos del pasajero; usa sus datos iniciales. Si viaja otra persona, pide nombre y telefono del pasajero.
- La ubicacion actual queda restringida al punto donde esta el solicitante: delivery sender en retiro, delivery receiver en entrega, traslado self en retiro. En los demas puntos queda seleccion por mapa.
- Logo de Entrega2 revertido: vuelve al render normal `object-cover object-center`; se quito el ajuste `scale-110 object-contain`.
- API publica de particulares ahora acepta `travelerName`/`travelerPhone` y arma WhatsApp claro: `Servicio`, `Solicitante`, `Telefono solicitante`, y si aplica `Pasajero`/`Telefono pasajero`. Ya no usa `Cliente: ...` ni nota final.
- No hubo migracion ni SQL. Validaciones aprobadas: contratos 64/64, ESLint focal, TypeScript, `git diff --check`, Supabase dry-run al dia, build local Next.js 16.3.0 con Webpack de 181 paginas.
- Preview Vercel Ready: `dpl_F3yXYhfF5PE5yEh7NFpi7qVDxwH6`, `https://vendeplus-clean-hvdqp80sr-entrega2-s-projects.vercel.app`. Build remoto Turbopack aprobado de 181 paginas.
- No se promovio a produccion. Probar visualmente en Preview los cuatro caminos: Delivery/Usted envia, Delivery/Usted recibe, Traslado/Viajo yo, Traslado/Viaja otra persona.

# Cierre local ajustes particulares (2026-09-07)

- Retoma ejecutada en el worktree `.particular-delivery-clean`; no se tocaron archivos de produccion desde la raiz principal.
- Validaciones repetidas: TypeScript `npx.cmd tsc --noEmit` aprobado; ESLint focal aprobado para `ParticularDeliveryForm`, `LocationPicker`, API publica de particulares, pagina publica y `TransportOrdersTab`; `git diff --check` sin errores; contratos directos `64/64` aprobados. El runner `npm.cmd run test:critical` sigue fallando con `spawn EPERM`, por eso se uso ejecucion directa como en las sesiones previas.
- Supabase dry-run remoto: `Remote database is up to date`; no hay SQL ni migraciones pendientes.
- Build obligatorio: `npm.cmd run build` con Turbopack falla por el problema conocido del symlink `node_modules` fuera del root del worktree; `npm.cmd run build -- --webpack` primero fallo por falta de variables privadas en el worktree y luego aprobo cargando `../.env.local` solo en memoria. Resultado final: Next.js 16.3.0, Webpack, 181 paginas.
- Verificacion visual automatizada local en `http://localhost:3105/transporte/entrega2/particulares` con viewport movil 390x844 aprobo los cuatro caminos: Delivery/Usted envia, Delivery/Usted recibe, Traslado/Viajo yo y Traslado/Viaja otra persona. En cada camino se llego al resumen y se valido que el boton de ubicacion actual solo aparece en el punto donde corresponde.
- No se creo solicitud real ni se presiono `Registrar y enviar`; la prueba uso mapa local y se detuvo en Resumen para no generar datos operativos.
- Preview vigente para revision: `dpl_F3yXYhfF5PE5yEh7NFpi7qVDxwH6`, `https://vendeplus-clean-hvdqp80sr-entrega2-s-projects.vercel.app`.
- Produccion no fue promovida en esta retoma. Siguiente paso exacto: si el usuario aprueba, promover de forma controlada ese Preview a produccion y hacer smoke posterior de `/transporte/entrega2/particulares` y panel delivery. No promover sin aprobacion explicita.

# Revision pre-produccion particulares y clave Entrega2 (2026-09-07)

- Usuario pidio revisar produccion, ajustar terminos delivery/traslado y cambiar clave de entregados.venezuela a `[RETIRADO: rotación pendiente]`.
- Cuenta identificada sin ambiguedad en Supabase remoto: `entregados.venezuela@gmail.com`, empresa delivery `Entrega2`, slug `entrega2`, rol `owner`, user_id `7685d856-3236-40ac-bae5-665802086c91`.
- Supabase Auth rechazo la clave solicitada `[RETIRADO: rotación pendiente]` por ser debil/conocida. No se forzo por SQL ni se modifico `auth.users` manualmente por seguridad. Siguiente paso: usar una variante fuerte aprobada por el usuario, por ejemplo `[RETIRADO: rotación pendiente]`.
- Auditoria de terminos: el flujo publico de particulares esta acorde para `Delivery` y `Traslado de persona`; separa solicitante, rol, pasajero, origen, destino, paquete y pago. Se detecto mejora menor en panel delivery: algunas etiquetas de particulares decian `Cliente`; se cambiaron a `Solicitante` donde aplica, `Cliente / Solicitante` en tabla y `Entrega WA` para el WhatsApp del destino particular. Pedidos de comercio conservan `Cliente` y `Cliente WA`.
- Archivos modificados en esta retoma: `src/components/transport/TransportOrdersTab.tsx`, `scripts/critical-contracts.test.mjs` y `SESSION_HANDOFF.md`.
- No hubo migracion ni SQL nuevo. Supabase dry-run remoto: `Remote database is up to date`.
- Validaciones aprobadas: contratos directos `64/64`; TypeScript `npx.cmd tsc --noEmit`; ESLint focal; `git diff --check`; build local `npm.cmd run build -- --webpack` con variables en memoria, 181 paginas.
- Preview Vercel nuevo Ready: `dpl_3qrVtKzkERDDbFPbLDiqrNaN1tjg`, `https://vendeplus-clean-219cygqvw-entrega2-s-projects.vercel.app`, target Preview. Build remoto Turbopack aprobado con 181 paginas.
- Smoke Preview: `/transporte/entrega2/particulares` HTTP 200, contenido cargado; `vercel inspect` Ready; logs de error recientes sin resultados.
- Criterio: listo tecnicamente para produccion cuando el usuario apruebe promover este Preview. No se promovio produccion en esta retoma.

# Produccion particulares reorganizados (2026-09-07)

- Usuario confirmo que probo el Preview de particulares y autorizo pasarlo a produccion.
- Se promovio el Preview validado `https://vendeplus-clean-219cygqvw-entrega2-s-projects.vercel.app` con `vercel promote`.
- Primer promote creo production `dpl_HPpw6D4xuSBEwgJJDLC41NGDrgiF` (`https://vendeplus-clean-ajabc9058-entrega2-s-projects.vercel.app`). Se repitio el promote con URL completa por confirmacion de alias y quedo production final `dpl_2dthwkhr5QsTrZ2iW3tj5Fn7rD5L`, `https://vendeplus-clean-g84qjqmjo-entrega2-s-projects.vercel.app`, estado Ready.
- Aliases oficiales confirmados sobre `dpl_2dthwkhr5QsTrZ2iW3tj5Fn7rD5L`: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y `https://vendeplus-clean-entrega2-s-projects.vercel.app`.
- Smoke productivo final: `/transporte/entrega2/particulares` HTTP 200 y contenido de particulares cargado; `/transporte/panel` HTTP 200; logs de error de Vercel ultimos 10 minutos sin resultados.
- Supabase dry-run posterior: sin migraciones pendientes. No hubo SQL nuevo en esta promocion.
- Clave Entrega2 previamente cambiada y verificada: `entregados.venezuela@gmail.com` quedo con `[RETIRADO: rotación pendiente]`.
- No se hizo commit ni push.

# Preview diferenciacion Delivery vs Traslado en panel delivery (2026-09-07)

- Usuario pidio diferenciar traslados de delivery en el panel de pedidos de empresas delivery.
- Cambio aplicado en `.particular-delivery-clean`: `TransportOrdersTab` detecta el tipo desde `transport_particular_requests.package_description`, que ya guarda prefijo `Delivery:` o `Traslado de persona:`. No requiere migracion.
- En la tabla de pedidos, una solicitud particular ahora muestra `Delivery particular` o `Traslado particular` como origen, mas una etiqueta visual `Delivery`/`Traslado` con color distinto. Pedidos de comercio conservan nombre del comercio.
- En el detalle, los particulares muestran `Tipo: Delivery` o `Tipo: Traslado`; el bloque de descripcion usa `Paquete` para delivery y `Detalle` para traslado. La comanda WhatsApp al repartidor tambien arranca con `Nuevo delivery particular` o `Nuevo traslado particular`.
- Validaciones aprobadas: contratos directos `64/64`, TypeScript `npx.cmd tsc --noEmit`, ESLint focal `TransportOrdersTab`, `git diff --check`, Supabase dry-run remoto al dia y build local `npm.cmd run build -- --webpack` con 181 paginas.
- Preview Vercel Ready: `dpl_6gkUy7eheujHaVgjnVs9sZxvEtrf`, `https://vendeplus-clean-k03mtrp40-entrega2-s-projects.vercel.app`, target Preview. Build remoto Turbopack aprobado con 181 paginas.
- Smoke Preview: `/transporte/panel` HTTP 200; `vercel inspect` Ready; logs de error recientes sin resultados.
- No se promovio a produccion. Siguiente paso: usuario prueba Preview en panel delivery con servicios particulares existentes o nuevos; si aprueba, promover este Preview a produccion.

# Preview fix real diferenciacion Delivery/Traslado (2026-09-07)

- Usuario probo Preview anterior y reporto que en panel todos seguian como `Particular`, sin diferenciar `Delivery` o `Traslado`.
- Diagnostico: la relacion `transport_particular_requests` puede llegar al componente como arreglo desde Supabase en la lista; el helper leia solo objeto y no encontraba `package_description`, por eso caia al fallback `Particular`.
- Fix aplicado: `particular(entry)` normaliza objeto/arreglo (`Array.isArray(request) ? request[0] : request`) y `particularServiceLabel` detecta `Delivery:` o `Traslado de persona:` aunque no esten estrictamente al inicio.
- Se conserva lo ya implementado: tabla muestra `Delivery particular` o `Traslado particular`, etiqueta visual `Delivery`/`Traslado`, detalle con `Tipo`, y comanda WhatsApp del repartidor con `Nuevo delivery particular` o `Nuevo traslado particular`.
- No hubo migracion ni SQL nuevo. Supabase dry-run remoto: base al dia.
- Validaciones aprobadas: contratos directos `64/64`, TypeScript, ESLint focal, `git diff --check`, build local `npm.cmd run build -- --webpack` con 181 paginas.
- Preview Vercel Ready: `dpl_4PsCrE2WBFq2f5gv59kJfmeNDbdE`, `https://vendeplus-clean-kml8k8cqu-entrega2-s-projects.vercel.app`, target Preview. Build remoto Turbopack aprobado con 181 paginas.
- Smoke Preview: `/transporte/panel` HTTP 200; `vercel inspect` Ready; logs de error recientes sin resultados.
- No se promovio a produccion. Siguiente paso: usuario prueba este Preview en panel delivery; si ya muestra `Delivery particular` y `Traslado particular`, promover este Preview a produccion.

## 2026-09-07 - Preview ajustes textos particulares

- Cambio aplicado: en panel delivery, pedidos particulares muestran origen `Particular`; el tipo queda debajo como `Delivery` o `Traslado`.
- Cambio aplicado: mensajes WhatsApp de solicitudes particulares evitan redundancia de pasajero cuando coincide con solicitante.
- Cambio aplicado: para traslados se usan `ORIGEN`/`DESTINO` y etiquetas de origen/destino; no `RETIRO`/`ENTREGA`.
- Archivos clave: `src/components/transport/TransportOrdersTab.tsx`, `src/app/api/transport/particulares/[agencySlug]/route.ts`, `src/app/api/transport/panel/orders/[transportOrderId]/send-entrega2/route.ts`, `scripts/critical-contracts.test.mjs`.
- Validaciones: `node --experimental-strip-types scripts/critical-contracts.test.mjs` 64/64; `npx.cmd tsc --noEmit` OK; ESLint focal OK; `git diff --check` OK; `npx.cmd supabase db push --linked --dry-run` OK, remota al dia; `npm.cmd run build -- --webpack` OK.
- Preview Vercel READY: https://vendeplus-clean-m00p4o10w-entrega2-s-projects.vercel.app (`dpl_4rD5Rk5FE3fLdawebGRBq5oNpQLQ`).
- Smoke: `/transporte/panel` 200, `/transporte/entrega2/particulares` 200. `vercel logs` local fallo por `ECONNREFUSED 127.0.0.1:9`; no se pudo leer logs desde CLI.
- Siguiente paso: usuario debe probar preview y aprobar promocion a produccion si todo esta correcto.

## 2026-09-07 - Preview etiquetas mapa traslado particular

- Cambio aplicado: en `ParticularDeliveryForm`, cuando el servicio es `Traslado de persona`, los puntos del mapa y resumen usan `Origen` y `Destino`; para delivery siguen `Retiro` y `Entrega`.
- Cambio aplicado: `LocationPicker` acepta `referenceMarkerLabel` y `referencePopupLabel` opcionales para que el pin/popup base no diga `Retiro aqui` en el mapa de destino de pasajeros.
- Archivos: `src/components/public/LocationPicker.tsx`, `src/components/public/ParticularDeliveryForm.tsx`, `scripts/critical-contracts.test.mjs`.
- Validaciones: contratos 64/64, `npx.cmd tsc --noEmit` OK, ESLint focal OK, `git diff --check` OK, `npm.cmd run build -- --webpack` OK.
- Preview READY: https://vendeplus-clean-ps0wdknt9-entrega2-s-projects.vercel.app (`dpl_9axhfeAhBkeg2wUMRC4D3esZPKbM`). Smoke `/transporte/entrega2/particulares` y `/transporte/panel` 200.
- Pendiente: usuario prueba preview y aprueba produccion.

## 2026-09-07 - Produccion particulares traslado/delivery

- Usuario probo preview y aprobo produccion.
- Validacion previa: contratos 64/64, `npx.cmd tsc --noEmit` OK, `git diff --check` OK, `npm.cmd run build -- --webpack` OK.
- Preview aprobado/promovido: https://vendeplus-clean-ps0wdknt9-entrega2-s-projects.vercel.app (`dpl_9axhfeAhBkeg2wUMRC4D3esZPKbM`).
- Produccion promovida con `vercel.cmd promote ... --yes`; Vercel reporto deployment nuevo: https://vercel.com/entrega2-s-projects/vendeplus-clean/E1e4h2QDQdoZY3Wh4FQTD6tUfj5f.
- Smoke produccion OK: `https://vendeplus-clean.vercel.app/transporte/entrega2/particulares` 200, `/transporte/panel` 200, `https://www.somos-ve.com/transporte/entrega2/particulares` 200, `/transporte/panel` 200.
- `vercel logs` fallo localmente por `ECONNREFUSED 127.0.0.1:9`; no hubo lectura de logs desde CLI.
- No hubo migracion nueva ni SQL pendiente en este ultimo ajuste.
# 2026-09-08 - Puente Entrega2 reforzado y listo para validacion manual

- Preview final: `https://vendeplus-clean-qng4gyk3g-entrega2-s-projects.vercel.app`, deployment `dpl_EC9M8VtvoETB84d9W1G5rCauH7Bc`, target Preview, READY. Produccion no fue tocada.
- Se corrigieron dos hallazgos criticos de la auditoria: costos nulos/vacios/booleanos ya no se convierten en tarifa cero y la distancia OSRM se calcula en paralelo con la espera maxima de 4.5 s de Entrega2 App.
- Los envios directos y manuales reservan primero `order_integrations` y finalizan por el ID exacto; ya no usan upsert sobre el indice parcial. Un resultado externo incierto queda `reconcile_required`, visible como `Revisar antes de reenviar`, y bloquea reenvios ciegos.
- El webhook actualiza `orders.delivery_status`, no el estado comercial del pedido, y descarta regresiones/finales atrasados. Las actualizaciones usan comparacion del estado previo para reducir carreras concurrentes.
- Pruebas: `test:entrega2-bridge` 5/5, contratos criticos 65/65, ESLint dirigido OK, `git diff --check` OK y build local Webpack 185 paginas OK. Build Vercel Turbopack 185 paginas OK.
- Sin migracion nueva ni SQL aplicado. Sigue pendiente `supabase/migrations/20260907213000_align_legacy_entrega2_connections.sql`; aplicar primero en staging, nunca directamente en produccion sin validar.
- El navegador integrado no estuvo disponible y la Preview exige SSO de Vercel, por lo que el smoke visual autenticado queda en manos del usuario. No se hicieron pedidos, cotizaciones ni mutaciones contra la base compartida con produccion.
- Prueba manual siguiente: validar en Preview 1) Smash credito: directo a App y registro en Somos; 2) Smash contado: solo Somos/WhatsApp y boton manual hacia App; 3) particular: Somos/WhatsApp y boton manual; 4) otra empresa: nunca muestra envio a App; 5) cotizacion: respuesta normal y, en staging aislado, fallback menor de 5 s.
# 2026-09-08 - Horario China Town corregido

- Cambio de datos autorizado por el usuario y aplicado directamente al registro exacto `china-town` (`4fe11a35-7599-4328-ae75-d381259244cf`).
- Lunes y viernes pasaron de no tener rangos a `12:20-22:20`, habilitados. Se conservaron los demas dias y `manual_open_status=auto`.
- Verificacion posterior por lectura publica confirmo una sola fila, lunes `12:20-22:20` y viernes `12:20-22:20`.
- No hubo cambios de codigo, migracion, SQL ni despliegue. El catalogo tiene revalidacion de 30 segundos.
# 2026-09-08 - Etiqueta Entrega2 aclarada en pedidos del comercio

- La prueba reciente de Smash si llego a Entrega2 App: pedido `VP-0908-DPK`, integracion `entrega2` en estado `sent`, ID externo `22190`, sin error. Tambien quedo su servicio operativo en Somos.
- La confusion provenia del boton generico `Delivery` del panel del comercio para conexiones `transport_agency`.
- En `OrdersManager`, cuando la empresa snapshot es Entrega2 el boton ahora muestra `Entrega2`; cuando ya existe integracion externa muestra `Entrega2 App`. Otras empresas conservan `Delivery`.
- Preview nueva: `https://vendeplus-clean-h3310xzpi-entrega2-s-projects.vercel.app`, deployment `dpl_8MegoK5yEdDKmZjYmjiTffNhmo4a`, READY, target Preview. Produccion web no fue desplegada.
- Validaciones: contratos 65/65, puente 5/5, ESLint dirigido, diff check, build local Webpack y remoto Turbopack de 185 paginas aprobados. Sin migracion ni SQL.
# 2026-09-08 - Comprobantes de pago, Premium particulares y archivado seguro listos localmente

- Se implemento sin desplegar ni modificar produccion la configuracion por comercio `No solicitar | Pedir referencia | Pedir captura o foto`, con selector `Opcional | Obligatorio`. Aplica a todos los metodos, incluido efectivo; el texto cliente es `Subir captura de pago o foto del billete`.
- Referencia: checkout y API publica exigen minimo 4 digitos cuando se proporciona o es obligatoria; la edicion del pago en panel y los particulares Pago movil tambien rechazan referencias con menos de 4 digitos.
- Capturas: nuevo endpoint publico limitado y rate-limited; revalida la configuracion del comercio, decodifica la imagen real con Sharp, elimina metadatos, redimensiona y guarda WebP de maximo 2 MB en bucket privado. Solo entrega token opaco; nunca URL publica.
- El pedido valida el token contra el mismo `store_id`, evita reutilizacion entre pedidos y marca pagos no efectivo `En revision`. El panel consulta por tenant y genera una URL firmada de 5 minutos para `Ver captura o foto`.
- Limpieza: cron diario elimina imagenes adjuntas a los 30 dias y cargas abandonadas a las 24 horas, en lotes de 200, conservando solo metadatos de auditoria.
- Empresas delivery: Superadmin incorpora `Eliminar`, implementado como archivado, nunca hard delete. RPC transaccional pausa afiliaciones, desactiva solo los checkouts que realmente usaban esa conexion, conserva historial y protege la agencia del sistema `entrega2`.
- Particulares: pagina publica, API y enlaces del panel quedan bloqueados/ocultos si `premium_dispatch_enabled` no esta activo.
- Migracion nueva NO aplicada: `supabase/migrations/20260908193000_payment_proofs_and_agency_archiving.sql`. Supabase dry-run confirma que es la unica pendiente. Preview y produccion comparten Supabase: aplicar la migracion requiere aprobacion explicita antes de publicar un Preview funcional.
- Validaciones: TypeScript OK, ESLint focal OK, contratos criticos 68/68, puente Entrega2 5/5, `git diff --check` OK. `npm.cmd run build` exacto conserva el fallo ambiental conocido del symlink Turbopack; `npm.cmd run build -- --webpack` aprobo 190 paginas.
- No hubo commit, push, deploy ni SQL remoto. Siguiente paso exacto: revisar/aprobar la migracion aditiva; luego aplicarla de forma controlada, desplegar Preview, hacer pruebas de referencia opcional/obligatoria, captura opcional/obligatoria con efectivo y pago movil, visualizacion privada en panel, bloqueo Premium y archivado usando una agencia de prueba. Solo despues considerar produccion web.
# 2026-09-08 - Preview comprobantes de pago y empresas delivery listo para prueba

- Usuario autorizo aplicar con cautela la migracion y probar en Preview. Se aplico `20260908193000_payment_proofs_and_agency_archiving.sql` a Supabase remoto; no se promovio codigo web a produccion.
- Verificacion posterior: base remota al dia; 49 comercios quedaron con `payment_proof_mode='disabled'` y `payment_proof_required=false`; 0 comprobantes creados; bucket `payment-receipts` privado y limite 2 MB.
- Preview final READY: `https://vendeplus-clean-1r0lzi3f2-entrega2-s-projects.vercel.app`, deployment `dpl_APzPWFMAffoJ8vNsd3RbGPvQuWwj`, target Preview. Produccion web permanece en `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem` / commit `b44feed`.
- QA no destructivo Preview: `/`, `/marketplace`, `/smash`, `/panel/configuracion`, `/admin/transporte` y particulares Entrega2 respondieron 200; carga vacia de comprobante responde 400; cotizacion de particular para `despachos-rapidito` no Premium responde 404; pagina no Premium renderiza 404 de Next; sin logs de error.
- Se corrigio antes del Preview final que multipart vacio devolviera 400 en lugar de 500. No se crearon pedidos, archivos ni se archivaron empresas durante QA.
- Validaciones vigentes: contratos criticos 68/68, puente 5/5, TypeScript y ESLint OK, build local Webpack 190 paginas, Vercel Turbopack 190 paginas. Navegador integrado no disponible; visual autenticado queda para el usuario.
- No commit ni push. Siguiente prueba: en un comercio piloto configurar referencia opcional/obligatoria y captura opcional/obligatoria; probar captura tanto en Efectivo como Pago movil; confirmar `Ver captura o foto` en panel. En Admin usar solo una agencia descartable para probar Eliminar; nunca Entrega2 ni una activa real.
# 2026-09-08 - Preview corregido: comprobante visible en checkout

- Usuario reporto que el selector estaba antes de metodos de pago y que, aunque guardaba todas las opciones, checkout no mostraba referencia ni captura.
- Diagnostico confirmado por lectura: Supabase si guardo `Smash (Test) = image/opcional`, pero `getPublicStoreShellBySlug`, usado especificamente por checkout, no seleccionaba `payment_proof_mode` ni `payment_proof_required`; `mapStore` recibia undefined y aplicaba `disabled`.
- Correccion: ambos campos se agregaron a `storeShellSelect` y `storeShellCompatibleSelect`; contrato automatizado protege esa consulta. El bloque `Comprobante antes de enviar` quedo inmediatamente despues de `Metodos de pago activos` y antes de `Imagen de portada`.
- Preview final READY: `https://vendeplus-clean-8cvqnozpl-entrega2-s-projects.vercel.app`, deployment `dpl_C5UKmJxSLWyr8cp94s46L3mxfbFd`, target Preview. Produccion web no fue modificada.
- Verificacion remota: el RSC de `/smash/checkout` entrega `paymentProofMode='image'` y `paymentProofRequired=false`; `/smash/checkout`, `/panel/configuracion`, `/admin/transporte` y particulares Entrega2 respondieron 200; sin logs de error.
- Validaciones: contratos criticos 68/68, TypeScript y diff check OK, build local Webpack 190 paginas, Vercel Turbopack 190 paginas. Build local Turbopack conserva solo el fallo ambiental conocido del symlink de node_modules.
- Sin migracion nueva, SQL adicional, commit, push ni produccion web. Siguiente paso: usuario recarga el Preview nuevo, confirma ubicacion del selector y prueba Smash con `image/opcional` (debe mostrar la carga), luego referencia obligatoria (debe mostrar el campo y rechazar menos de 4 digitos).
# 2026-09-08 - Preview UX verde y comprobante visible en pedido

- Usuario confirmo referencia obligatoria/minimo 4 digitos OK; pidio hacer mas visual la carga verde y reporto no encontrar la captura en panel.
- Diagnostico de datos: captura `b0ab3302-db5a-4c0e-91b7-02156964aca0` existe, privada, 39,242 bytes WebP, asociada al pedido Smash `VP-0908-OER` (`e4a356ce-9018-4c89-9fe0-1936f8ba76e1`), estado pago `review`, vence 2026-10-09. Lectura con URL firmada temporal devolvio 200 `image/webp` y 39,242 bytes; no hubo perdida de archivo.
- Checkout: reemplazado input nativo poco visible por tarjeta verde, boton verde con icono `Seleccionar imagen`; despues de subir muestra check y `Imagen cargada · Cambiar`, nombre de archivo y permite volver a elegir el mismo archivo.
- Panel: `Comprobante recibido` aparece en tarjeta verde inmediatamente dentro del bloque Cliente/Pago del detalle, con boton `Ver captura o foto`. La pestaña vacia se abre sincronamente al clic antes de solicitar la URL firmada, evitando bloqueo del navegador; se cierra si ocurre error.
- Preview final READY: `https://vendeplus-clean-f0qxju3i9-entrega2-s-projects.vercel.app`, deployment `dpl_69D1yb8Z95JbHmDPe5i2KEeVC2CJ`, target Preview. Produccion web intacta.
- QA: `/smash/checkout`, `/panel/pedidos`, `/panel/configuracion` 200; sin logs de error. Contratos 68/68, TypeScript, ESLint focal y diff check OK; build local Webpack y Vercel Turbopack 190 paginas. Turbopack local conserva fallo ambiental conocido del symlink.
- Sin migracion/SQL adicional, commit, push ni produccion. Siguiente paso: usuario abre pedido `VP-0908-OER` en Preview y confirma bloque verde; checkout Smash debe mostrar carga verde al seleccionar un metodo de pago.
# 2026-09-08 - Preview pago compacto y opcion opcional corregida

- Usuario aprobo UX de tarjeta: `Revisar pago` + check; reporto que captura opcional seguia exigiendo archivo.
- Diagnostico: DB mostraba Smash `image/required=true`. El control anterior era un unico toggle cuyo texto mostraba el estado actual; pulsar `Opcional` lo alternaba a obligatorio, causando confusion. Se reemplazo por dos botones independientes `Opcional` y `Obligatorio` con seleccion visual/aria clara.
- Dato corregido bajo la intencion explicita del usuario: solo Smash (`47f344a7-46f2-4871-9266-489c79361c4d`) quedo `payment_proof_mode=image`, `payment_proof_required=false`. Preview RSC confirma ambos valores.
- Guardar configuracion ahora invalida inmediatamente catalogo, carrito y checkout del slug, evitando esperar la revalidacion de 30 segundos.
- Tarjeta de pedido: si hay captura o referencia muestra `Revisar pago`; captura abre modal rapido privado dentro del panel y referencia aparece en el mismo modal. Sin evidencia muestra solo `Pago pendiente`/`Pago al recibir`. Check verde adyacente pide confirmacion y marca pagado; al confirmar se reemplaza todo por un unico chip `Pagado` con check.
- La consulta compacta de hasta 40 pedidos incorpora una unica consulta por lote para marcar `has_payment_receipt`, sin N+1. El comprobante continua accesible dentro del detalle como respaldo.
- Preview READY: `https://vendeplus-clean-osplh8wo3-entrega2-s-projects.vercel.app`, deployment `dpl_AEFGdHzcvDVhGT21viMnMPMK6aLk`. Produccion web intacta.
- QA: `/smash/checkout`, `/panel/pedidos`, `/panel/configuracion` 200; sin logs de error. Contratos 68/68, TypeScript, ESLint focal, diff check y build local Webpack 190 paginas OK; Vercel Turbopack 190 paginas OK. Turbopack local conserva fallo ambiental de symlink.
- Sin migracion/SQL adicional (solo update exacto del flag Smash), commit, push ni produccion. Siguiente paso: usuario valida Smash opcional sin archivo y tarjeta `VP-0908-OER` mostrando `Revisar pago` + check.

# 2026-09-08 - Preview tarjetas de pedidos alineadas por modalidad

- Usuario pidio compactar `Revisar pago` con el check en una sola linea y eliminar la diferencia visual entre Delivery, Retiro, Mesa, Barra y Envio nacional.
- En `src/components/panel/OrdersManager.tsx` se retiro la modalidad duplicada del bloque izquierdo. La zona derecha ahora conserva tres columnas fijas: WhatsApp (58 px), modalidad/accion (104 px) y Ver (48 px).
- Delivery mantiene exactamente su comportamiento: boton oscuro cuando se puede enviar, verde/deshabilitado cuando ya fue enviado (incluyendo compatibilidad historica China Town), y etiqueta estatica solo cuando no existe accion disponible. Retiro, Mesa, Barra y Envio nacional usan el mismo espacio como identificadores estaticos; no cambian estados ni disparan acciones.
- `Revisar pago`, estado de pago y check usan altura de 28 px, tipografia compacta y `flex-nowrap`, evitando que el check baje en escritorio.
- Contrato critico ampliado para proteger ancho/alineacion, modalidad en la derecha y las condiciones dinamicas existentes. Resultado: 68/68 contratos, TypeScript, ESLint focal y `git diff --check` OK.
- `npm.cmd run build` exacto conserva el fallo ambiental conocido: Turbopack rechaza el symlink de `node_modules` fuera del worktree. Build local Webpack OK con 194 paginas; Vercel Turbopack OK con 194 paginas.
- Preview READY: `https://vendeplus-clean-6v00ptebr-entrega2-s-projects.vercel.app`, deployment `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`, target Preview. `/panel/pedidos`, `/smash/checkout` y `/panel/configuracion` respondieron 200; sin logs de error.
- Navegador integrado no estuvo disponible para inspeccion visual autenticada. Produccion web intacta; sin migracion, SQL, datos, commit ni push en este ajuste.
- Siguiente paso: usuario valida en Preview una fila Retiro y una Delivery (pendiente y enviada), ademas de `VP-0908-OER`; confirmar misma alineacion derecha y que `Revisar pago` + check quedan juntos. Promover solo con aprobacion explicita.

# 2026-09-08 - Revision final previa a produccion comprobantes/agencias/tarjetas

- Usuario valido el Preview tanto en escritorio como en telefono y solicito una ultima revision antes de produccion. No se promovio nada en esta revision.
- Candidato exacto: Preview `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`, `https://vendeplus-clean-6v00ptebr-entrega2-s-projects.vercel.app`, estado Ready. Produccion permanece en `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem` (`www.somos-ve.com`).
- Revision de seguridad aprobada: bucket `payment-receipts` privado, RLS/revocacion para anon/authenticated, lectura con `requirePanelAuth` + `assertStoreAccess` + store_id, URL firmada de 300 s, carga limitada por IP/4 MB/JPG-PNG-WebP, salida WebP <=2 MB, huérfanos 24 h y vencimiento 30 dias con cron protegido por `CRON_SECRET`. Service role permanece solo en servidor.
- Eliminacion de empresa aprobada: API solo founder mediante `requireAdminAuth`, Entrega2 bloqueada tanto en API como RPC, archivado transaccional desactiva conexiones/configuracion sin borrar pedidos ni historial. Particulares se cierran server-side si el pack Premium no esta activo.
- Compatibilidad aprobada: logica `showDeliverySent` intacta para Entrega2 legacy/China Town; la reorganizacion visual no modifica estados, filtros, integraciones ni envios. Referencia de 4 digitos y captura opcional/obligatoria se revalidan server-side.
- Supabase `db push --dry-run`: base remota al dia. No hay SQL pendiente antes de promover el artefacto web.
- QA final: contratos criticos 68/68, contrato telefonos Entrega2 1/1, puente 5/5, TypeScript, ESLint global y `git diff --check` OK. Build local Webpack y Vercel Turbopack OK con 194 paginas. Build local Turbopack conserva solo el fallo ambiental del symlink del worktree.
- `predeploy:smoke` confirmo rutas/controles principales y seis alertas no atribuibles al candidato: tres 401 de Vercel Deployment Protection en APIs publicas del Preview, y tres reglas estaticas antiguas demasiado estrictas (`announcements` usa `getPanelAuthContext`, particulares es publicamente intencional con rate limit, y signed-delivery-quote usa el service role solo como secreto server-side de respaldo). Los tres patrones existen en `origin/main`; no son regresiones de este candidato. Smoke HTTP de seis rutas publicas dio 200 y no hay logs Vercel de error.
- Riesgos residuales no bloqueantes para V2: asociacion pedido-comprobante ocurre inmediatamente despues del RPC idempotente (un fallo excepcional se recupera reintentando); el cron procesa 200 archivos por ejecucion y podria requerir paginacion/bucle con volumen alto. Para pilotos actuales la capacidad es suficiente.
- Siguiente paso exacto: con aprobacion explicita del usuario, promover el artefacto existente `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L` sin reconstruir, confirmar aliases oficiales, smoke de produccion y logs; rollback web a `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem`.

# 2026-09-08 - Produccion comprobantes, Premium, archivado y tarjetas alineadas

- Usuario aprobo expresamente promover despues de validar escritorio, telefono y revision final.
- Se promovio el artefacto exacto del Preview `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`; Vercel creo la copia productiva `dpl_7oPyS4b2SQYvGXK8kFFPQvGmo9MY`, Ready, sin reconstruir codigo diferente ni ejecutar SQL.
- Alias oficiales confirmados sobre la nueva produccion: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y alias del proyecto.
- Smoke posterior: `/`, Marketplace, Smash/catalogo/checkout, login/panel pedidos/configuracion, Admin Transporte, Transporte y Marketplace/Particulares Entrega2 respondieron 200.
- Controles de seguridad posteriores: APIs de panel, pedidos compactos, admin, transporte y cron devolvieron 401 sin sesion/secret; carga de comprobante y solicitud particular con payload vacio devolvieron 400. Sin escrituras validas ni datos de prueba.
- Logs Vercel nivel error desde el despliegue: sin resultados. Supabase ya estaba al dia; no hubo migracion ni SQL durante la promocion.
- Validaciones previas del mismo artefacto: 68/68 criticos, 1/1 contrato Entrega2, 5/5 puente, TypeScript, ESLint global, diff check, Webpack local y Vercel Turbopack (194 paginas) OK.
- Rollback web exacto: `dpl_8bKgcCsgjiXvr7gL2VYAeJ4gATem`. No se hizo commit ni push.
- Siguiente paso: validacion humana corta en produccion de una captura opcional/obligatoria, un Delivery enviado y un Retiro; vigilar logs si se genera un pedido real.
# 2026-09-08 - Auditoría posterior: seguridad crítica y P1 pendientes

- Informe vigente fuera del candidato: `../docs/audits/2026-09-08-ecosistema-seguridad-escalabilidad.md`; leer antes de continuar. Solo auditoría: ningún arreglo funcional ni despliegue realizado.
- Producción actual consultada `dpl_7oPyS4b2SQYvGXK8kFFPQvGmo9MY`, Preview promovido `dpl_8rqkGaGGvVhJ6URdxVotmcnG2L5L`. HEAD b44feed no contiene todos los cambios publicados: preservar y revisar diff.
- P0: dependencias Next 16.3.0/sharp 0.35.3 con avisos oficiales de posible RCE. No se intentó explotación. Preparar parche controlado; rollback anterior no corrige estas versiones.
- P1: secretos históricos en handoffs, sin MFA observado, Preview comparte Supabase/servicios de producción. No copiar credenciales ni probarlas. Requiere plan de rotación y separación.
- Fallos reproducidos: comprobante puede dejar pedido guardado y devolver 500; pago no habilitado/consulta extras fallida pasan; stats no espera validación de función (log real con rechazo no manejado); webhook puede descartar evento terminal en carrera. Recibo atómico es P1, NO V2.
- Facturación de Fed Fast agosto en Venezuela: 247 facturables/$452,00 frente a límite200/$363,70. Diferencia $88,30 del cálculo, sin afirmar cobro incorrecto ejecutado. Corregir agregación/paginación.
- Entrega2 conserva 9 sending históricos y 2 errores anteriores, ninguno nuevo desde despliegue consultado; conciliar con App, no reenviar a ciegas. Limpieza200/día, IDs cortos y backups Storage sin paginación necesitan endurecimiento.
- Nuevas pruebas offline: `node ../docs/audits/2026-09-08-ecosistema-behavior.cjs`; exit0 confirma defectos actuales. 68/68 contratos y 5/5 puente pasan. Build local falla por symlink externo node_modules; no confundir con validación verde. Sin migración nueva; dry-run al día.
- Siguiente paso: autorización de parche de seguridad acotado, build reproducible e aislamiento; después correcciones P1 con pruebas. No desplegar raíz ni incorporar impresión. Producción no se modifica como consecuencia implícita de esta auditoría.

# 2026-09-10 - Outta Brand corregido y aislamiento del panel delivery en Preview

- Diagnóstico productivo confirmado: Outta Brand (`4e03663d-866c-44a0-8b5a-275aa45cba97`) tenía cinco solicitudes pendientes y una afiliación exclusiva/crédito aprobada por error con Mandamelo. No existían `transport_orders` del comercio, por lo que no hubo pedidos que migrar.
- Se aplicó a producción la migración atómica y acotada `20260910193000_correct_outta_brand_entrega2_affiliation.sql`. Mandamelo y las otras solicitudes quedaron `cancelled`; Entrega2 quedó `approved`, única conexión activa/default/exclusiva, modalidad `credit`; `store_delivery_settings` apunta a Entrega2 y conserva pickup/envío nacional. Verificación posterior aprobada y base remota al día.
- Causa UI: fundador cargaba relaciones de todas las empresas delivery y las listas/métricas no filtraban por `agency_id`; una solicitud de Mandamelo podía aparecer mientras se visualizaba Entrega2.
- Corrección web en `.security-billing-release`: `/api/transport/me` limita solicitudes/conexiones al `agencyId` solicitado; el cliente filtra nuevamente por empresa activa, recarga relaciones al cambiar selector, bloquea doble clic y confirma comercio + empresa antes de aprobar. El PATCH exige que `body.agencyId` coincida con la solicitud.
- Preview READY: `https://vendeplus-clean-2e4fc9lvo-entrega2-s-projects.vercel.app`, deployment `dpl_6dxRWKJRiB1ytTwee44tYJeTsFmS`. Producción web NO fue promovida.
- QA: contratos críticos 69/69, billing 9/9, puente 5/5, ESLint focal y `git diff --check` OK. Build local Next/Turbopack con entorno cargado y build Vercel/Turbopack aprobaron 194 páginas. Smoke Preview de Home y paneles transporte respondió 200.
- Siguiente paso exacto: usuario entra al Preview como fundador, cambia entre Entrega2/Mandamelo/FED y confirma que Solicitudes, Comercios y métricas cambian sin mezclarse; verificar Outta Brand solo en Entrega2 como crédito. Promover este artefacto exacto solo con aprobación explícita.

# 2026-09-10 - Aislamiento del panel delivery promovido a producción

- Usuario validó el Preview y autorizó expresamente promover. Se promovió exactamente `dpl_6dxRWKJRiB1ytTwee44tYJeTsFmS`, sin reconstruir otro código ni ejecutar SQL adicional.
- Producción nueva Ready: `dpl_7E3AaLH429ZeP4vZyp6CWU15jiHV`, `https://vendeplus-clean-jzq7jjfaj-entrega2-s-projects.vercel.app`.
- Alias confirmados sobre el nuevo deployment: `https://www.somos-ve.com`, `https://somos-ve.com`, `https://vendeplus-clean.vercel.app` y alias del proyecto.
- Smoke productivo: Home, Marketplace, Outta Brand, checkout y paneles Transporte/Solicitudes/Comercios respondieron 200. APIs de transporte, admin y pedidos respondieron 401 sin sesión, como corresponde. Logs de error: sin resultados.
- La relación de Outta Brand ya había quedado verificada en DB como única conexión activa/default/exclusiva con Entrega2 y crédito; no se tocaron pedidos.
- Rollback web: deployment productivo anterior `dpl_BTMGcMaFR8LcDpeKLB7wxRNoM1eo`. La corrección de datos de Outta Brand es independiente del rollback web.

# 2026-09-10 - Dry-run catálogo SHIBUI; importación pausada por falta de inventario real

- Fuente revisada sin mutaciones: `C:/Users/Windows/Downloads/SHIBUI_Catalogo_Listo_para_Codex.zip`, extraída bajo `tmp/imports/shibui-20260910` (ignorado por Git). Los archivos principales son consistentes: 27 productos, 6 categorías, 333 combinaciones color/talla/detalle, stock total 459, 26 JPG válidos, sin claves de variante duplicadas, sin imágenes duplicadas y todas las sumas por producto coinciden.
- Comercio productivo localizado: `SHIBUI C.A`, slug `shibui`, id `126f8168-f1ca-4a08-8eaf-c3816b9d9195`, activo/trial. Tiene 4 productos y 1 categoría; con deduplicación y Set Nikki pendiente queda dentro del límite de 30.
- Coincidencias existentes: Infinity y Destiny coinciden en precio ($18) pero ya tienen presentaciones/promos e imágenes; Dakota existe a $16 y el archivo indica $18, por lo que es conflicto y no debe sobrescribirse. Emely no está en el paquete y debe preservarse.
- Casos especiales: Set Nikki sin precio (omitir o guardar borrador inactivo); Body Bárbara sin imagen (puede usar placeholder existente). Categorías estimadas: 5 nuevas y 1 reutilizada.
- Bloqueo arquitectónico crítico: producción no posee stock en `products`, `product_variants` ni `product_option_values`. `product_variants` representa presentaciones/precios y las opciones son selecciones independientes; usarlas como inventario permitiría combinaciones inválidas y no descontaría stock atómicamente.
- Recomendación pendiente de autorización: crear inventario genérico por SKU/combinación, separado de presentaciones y extras, con selección dependiente color/talla, validación y descuento transaccional al crear pedido. Luego importar SHIBUI mediante script idempotente y Preview. No crear solución especial solo para SHIBUI.
- No hubo cambios de código, DB, Storage, deploy, commit ni push por esta importación.

# 2026-09-10 - Preview aislado del inventario SHIBUI

- Usuario autorizó una demostración primero y sin producción. Se creó `/prototipos/shibui-inventario`, exclusiva de Preview: con `VERCEL_ENV=production` responde 404 y declara noindex/no-follow.
- Usa los 27 productos, 333 combinaciones, stock simulado 459 y 26 imágenes del archivo primario. El descuento vive solo en estado React: no usa `fetch`, Supabase, Storage ni APIs y se reinicia al recargar.
- UX móvil: búsqueda/categorías, color antes de talla, solo combinaciones existentes, cantidad limitada, última unidad/agotado y compra simulada. Set Nikki queda bloqueado por precio faltante; Body Bárbara usa placeholder; Dakota expone conflicto $16/$18; Destiny/Infinity se marcan para fusionar sin duplicar.
- Archivos nuevos: `src/app/prototipos/shibui-inventario/page.tsx`, `src/components/prototypes/ShibuiInventoryPrototype.tsx`, `src/data/shibui-catalog.preview.json`, `public/catalog-previews/shibui/*.jpg` y `scripts/shibui-preview.behavior.test.mjs`.
- Preview READY: `dpl_35CciKSA8EMwRmkyhULE7PA2thUf`, base `https://vendeplus-clean-hm9qxfm8p-entrega2-s-projects.vercel.app`. Se generó enlace compartible temporal, sin guardar el token en documentos. Producción oficial devuelve 404 para esta ruta y no fue promovida.
- QA: ESLint focal, TypeScript, diff check, SHIBUI 5/5, críticos 69/69, puente 5/5 y builds local/Vercel con 194 páginas. Ruta e imagen autenticadas 200, sin logs de error. Browser integrado no disponible; queda la validación visual del usuario.
- Sin migración, SQL, DB/Storage, importación real, commit, push ni producción. Siguiente paso: validar en teléfono/escritorio; después, con aprobación, construir inventario SKU genérico y descuento atómico en entorno aislado.

# 2026-09-10 - Preview SHIBUI corregido a la visual real de Somos

- Usuario señaló correctamente que el primer prototipo parecía otra aplicación. Auditoría confirmó cero referencias o archivos Mila y hashes exactos del ZIP SHIBUI; el defecto era solo una composición visual inventada.
- Se reemplazó esa composición por la estructura vigente del catálogo Somos: `vp-public-store`/`vp-container`, portada y logo Somos, fondo crema, buscador, filtros, tarjetas compactas tipo `ProductListItem`, modal tipo `ProductOptionsSheet` y barra inferior. Se conserva únicamente la nueva lógica Color -> Talla -> stock.
- Nuevo Preview READY: `dpl_5eMG7Pk3K5Rt2t636G3bQkTKAXtd`, base `https://vendeplus-clean-dm13qh72p-entrega2-s-projects.vercel.app`; enlace compartible temporal generado sin guardar token. El Preview anterior queda obsoleto.
- QA: 6/6 pruebas SHIBUI, ESLint, TypeScript y build local/Vercel de 194 páginas OK; smoke protegido confirmó logo Somos y SHIBUI; sin logs de error. Producción sigue 404 en la ruta y no fue promovida.

# 2026-09-10 - Mis Accesorios / Entrega2: diagnóstico pendiente de corrección

- Lectura productiva sin mutaciones: Mis Accesorios `7984f09a-18ad-4528-8a73-0f1b3cd3f25f` tiene solicitud Entrega2 `22ec6a82-92f6-47a5-a39f-43574a1ab44f` marcada `approved`, pero no existe conexión Entrega2 y `store_delivery_settings` continúa `manual_quote` sin agency/connection.
- Causa: la conexión histórica Mandamelo `4aa80b58-cbcc-44fe-8419-f2412fca3cc9` tiene desconexión solicitada/confirmada/efectiva el 10 de septiembre, pero conserva `status=active`, `is_default=true`, `is_exclusive=true`. La aprobación ignora correctamente relaciones lógicamente terminadas, pero el upsert de Entrega2 choca con el índice único SQL que todavía ve Mandamelo activa/default.
- Defecto adicional: API actual marca primero la solicitud `approved` y después crea la conexión; el segundo paso falló y dejó estado parcial. Corrección futura debe ser atómica o no marcar aprobada hasta confirmar conexión, y debe normalizar la fila finalizada antes del upsert.
- No se modificó producción ni código. Antes de reparar datos hay que confirmar si la nueva conexión Entrega2 debe ser crédito o contado. Reparación segura: cancelar/desmarcar la relación histórica Mandamelo, crear/alinear Entrega2 como activa/default/exclusiva con modalidad confirmada y actualizar settings a `transport_agency`.

# 2026-09-10 - Mis Accesorios conectado a Entrega2 de contado

- Usuario confirmó contado. Se aplicó a producción únicamente `20260910202500_repair_mis_accesorios_entrega2_cash.sql`, con guardas exactas e idempotencia. Dry-run previo listó solo esa migración; dry-run posterior confirmó base al día.
- Resultado verificado: conexión Entrega2 `a024f618-8e7c-4791-a7cf-dca82651ee7e` activa/default/exclusiva, `delivery_billing_mode=cash`; settings apuntan a Entrega2/esa conexión con `delivery_provider=transport_agency` y tarifas `distance_ranges`. Mandamelo quedó `cancelled`, no default/no exclusiva.
- Los dos `transport_orders` históricos de Mandamelo se conservaron sin cambios, incluido uno `delivered` y otro histórico `driver_assigned`; no se tocaron pedidos ni integraciones.
- Prevención web preparada, aún no promovida: la aprobación normaliza conexiones lógicamente terminadas antes del upsert y solo marca la solicitud aprobada después de crear correctamente la conexión. Evita repetir el estado parcial observado.
- QA del código: críticos 69/69, puente 5/5, ESLint focal, TypeScript, diff check y `npm.cmd run build` con 194 páginas. Sin commit/push ni despliegue web productivo.
- Siguiente paso: usuario actualiza Conexiones/Delivery de Mis Accesorios en producción y confirma Entrega2 contado. El endurecimiento web se incluirá en un Preview/despliegue autorizado posterior.
# 2026-09-10 - Base de inventario opt-in SHIBUI preparada, no publicada

- Usuario aprobó avanzar con inventario básico bloqueado para todos y activable inicialmente solo en SHIBUI. Trabajo únicamente en `.security-billing-release`; producción y Supabase no fueron modificados.
- Migración pendiente `20260910220000_opt_in_basic_inventory.sql`: interruptor por comercio apagado por defecto, fila exacta de SHIBUI habilitada, SKUs por producto/combinación, movimientos auditables, asignaciones congeladas por pedido, índices, RLS y acceso exclusivo `service_role`.
- `create_order_atomic` descuenta stock en la misma transacción solo cuando el comercio está habilitado y el producto tiene SKUs. Valida `store_id`, producto, SKU, unidades de la presentación y stock; el replay idempotente no vuelve a descontar.
- Cancelar desde panel usa `cancel_order_with_inventory`, devuelve unidades una sola vez y bloquea reabrir pedidos inventariados cancelados. Antes de aplicar la migración conserva fallback legacy.
- Catálogo público, carrito y pedido manual muestran combinaciones solo para productos inventariados. Presentaciones de varias piezas exigen elegir cada pieza. Las etiquetas visibles se reconstruyen en servidor; el navegador no decide inventario ni stock.
- Compatibilidad: sin fila habilitada todo funciona como antes; incluso en SHIBUI, productos sin SKUs conservan flujo legacy. No se cargó ningún SKU/producto/imagen real y no se resolvieron todavía Dakota, Set Nikki ni Body Bárbara.
- QA: inventario 6/6, críticos 69/69, puente 5/5, billing 9/9, lint completo, TypeScript y diff check OK. `supabase db push --dry-run --linked` lista solo la migración nueva y no aplicó nada. Build Next 16.3.4 OK con variables CI ficticias, 86 rutas generadas; primer build sin variables privadas falló como era esperable.
- Sin commit/push, Preview ni producción. Siguiente paso seguro: validar la migración contra PostgreSQL/Supabase aislado, crear importador SHIBUI idempotente con dry-run y cargar datos/imágenes allí; luego ejecutar pedidos concurrentes, agotado, reintento y cancelación antes de cualquier producción.
# 2026-09-10 - Preview panel Inventario Premium exclusivo SHIBUI, NO produccion

- Usuario definio inventario como funcion Premium opt-in por comercio: negocios actuales no cambian; SHIBUI sera piloto. Se implemento una primera experiencia dentro de `/panel/productos`, visible solo cuando la sede devuelta coincide simultaneamente con ID `126f8168-f1ca-4a08-8eaf-c3816b9d9195` y slug `shibui`.
- Nuevo `src/components/panel/PremiumInventoryPreview.tsx`: carga por GET autenticado `/api/panel/catalogo`, valida nuevamente ID/slug/`inventory_enabled`, resume productos/unidades/stock bajo/agotados, busca y filtra, abre administracion por producto, permite simular sin inventario/stock total/combinaciones, ajustar cantidades, agregar combinaciones con atributos genericos y definir cuantas unidades descuenta cada presentacion.
- Es una simulacion estrictamente local: no contiene POST/PATCH/PUT/DELETE, no escribe Supabase y al recargar pierde cambios. La pantalla lo indica de forma visible. No se agrego API de escritura ni migracion.
- `ProductManager.tsx` muestra una tarjeta verde `Inventario Premium` solo para SHIBUI. Los demas comercios mantienen exactamente el panel anterior.
- Preview Ready, NO promovido: `dpl_3nRxjHaxT4Ps2xHZA4H1Cfv2GRY6`, `https://vendeplus-clean-avfmifxch-entrega2-s-projects.vercel.app`. La URL exige autenticacion Vercel y luego login habitual de Somos.
- QA: inventario 8/8, contratos criticos 69/69, piloto SHIBUI 10/10, ESLint y `git diff --check` sin errores. Vercel build Next 16.3.4 completo: TypeScript OK y 202 paginas. Build local compilo/TS pero no finalizo prerender por variables privadas Supabase ausentes en esta copia; Vercel valido con entorno seguro. Un `.next/dev/types/validator.ts` generado y corrupto se renombro a `.next/dev/types/validator.corrupt.txt`; es artefacto ignorado, no codigo fuente.
- Navegador integrado no disponible; smoke HTTP anonimo confirma que la proteccion de Vercel intercepta Preview. No se probaron acciones autenticadas por no usar credenciales del usuario.
- Siguiente paso: usuario abre Preview, entra a `/panel/productos`, selecciona SHIBUI, pulsa `Administrar inventario` y prueba stock total, combinaciones y presentaciones. Tras feedback, construir API real con manager+tenant, RPC atomico, auditoria e idempotencia; mantener opt-in por comercio. No limpiar Destiny ni escribir stock productivo sin autorizacion posterior.
# 2026-09-10 - Preview Inventario Premium guardable + vista de catálogo Visual, NO produccion

- Usuario aprobó UX de inventario y pidió avanzar, además solicitó que cada comercio pueda elegir entre catálogo clásico y una navegación similar al prototipo SHIBUI, con tarjetas de foto grandes y más cuadradas. Producción sigue fuera de alcance.
- Nuevo Preview final Ready: `dpl_4nnmnQaaYRKB15aN5ds8ohkzwj8J`, `https://vendeplus-clean-cj0y4f7be-entrega2-s-projects.vercel.app`. Build Vercel Next 16.3.4: TypeScript OK, 203 páginas. No promoción productiva.
- Catálogo: `CatalogClient` acepta preferencia `classic|visual` y override de prueba `?vista=visual|clasica`; Visual usa cuadrícula 2 columnas móvil/3 tablet/4 desktop y `ProductListItem` conserva exactamente carrito, variantes, opciones, inventario, galería y agregar. Fotos cuadradas grandes. Clásica sigue por defecto.
- Configuración: selector visual en `/panel/configuracion`, con enlace `Probar esta vista`. La columna nueva se consulta/guarda por separado de la actualización general para no activar fallbacks que arriesguen horarios, pagos, colores o delivery si la migración falta.
- Inventario: API nueva `/api/panel/inventory` exige sesión, rol owner/admin, tenant, ID+slug exactos SHIBUI y `store_inventory_settings.enabled`. GET entrega hasta 100 movimientos; PATCH valida hasta 500 SKU/50 presentaciones y llama RPC atómico por producto. UI permite guardar combinaciones y unidades consumidas por presentación; stock total/desactivar siguen marcados como simulación hasta diseñar su transición sin SKU huérfanos.
- Migración aditiva pendiente `20260910232000_premium_inventory_and_catalog_layout.sql`: `stores.catalog_layout` default `classic`; RPC service-role-only `manage_inventory_sku` y `manage_inventory_product`, bloqueo de fila, tenant, stock no negativo, ajuste por producto en una transacción y auditoría en `inventory_movements.created_by`.
- La migración fue aplicada SOLO directamente en rama Supabase aislada `shibui-inventory-staging-v2` porque su historial experimental impide `db push`; verificación posterior: columna y ambos RPC existen. No se aplicó SQL a producción. Dry-run productivo lista solo esta migración como pendiente.
- QA: inventario 8/8, críticos 69/69, SHIBUI 12/12, ESLint, TypeScript y `git diff --check` OK. Navegador integrado no disponible; Vercel Preview está protegido por login Vercel. No se ejecutó ajuste autenticado desde la UI ni pedido real.
- Enlaces a probar: Visual `/shibui?vista=visual`; Clásica `/shibui?vista=clasica`; panel inventario `/panel/productos`; selector `/panel/configuracion`. Preview usa base productiva, por lo que Guardar inventario fallará cerrado mientras el RPC no exista allí; no aplicar migración productiva sin autorización expresa.
- Siguiente paso: usuario valida visual móvil y panel. Luego decidir ventana para aplicar migración productiva (aditiva) o dedicar un Vercel Preview autenticable a Supabase staging. Antes de producción, agregar prueba real de incremento+rollback/historial, probar save de combinación/presentación y confirmar que Smash/otros permanecen clásicos.
# 2026-09-10 - Cierre QA Inventario Premium y vista Visual SHIBUI, NO produccion

- Usuario aprobo continuar. Se avanzo solo en el candidato `.security-billing-release` y en la rama Supabase aislada `shibui-inventory-staging-v2`; no hubo despliegue, SQL, datos, commit ni push en produccion.
- Prueba SQL real en staging: `manage_inventory_product` incremento una combinacion, genero exactamente un movimiento de auditoria y luego una transaccion forzada revirtio tanto stock como historial. Resultado: atomicidad, auditoria y rollback OK, sin cambio residual.
- Aislamiento verificado en staging: un `store_id` ajeno fue rechazado; ambos RPC solo tienen ejecucion para `postgres` y `service_role` (no `anon`, `authenticated` ni `PUBLIC`); la unica tienda de la rama conserva `catalog_layout=classic` por defecto.
- Produccion se consulto solo en lectura y sigue sin `stores.catalog_layout`, `manage_inventory_product` ni `manage_inventory_sku`. Dry-run productivo lista exclusivamente `20260910232000_premium_inventory_and_catalog_layout.sql`; no fue aplicada.
- QA final: inventario 8/8, contratos criticos 69/69, SHIBUI 12/12 y puente Entrega2 5/5 (94/94); TypeScript, ESLint y `git diff --check` OK. `npm.cmd run build` sin entorno fallo solo al prerender por variables privadas ausentes; repetido con placeholders identicos al CI compilo correctamente las 87 rutas. Preview Vercel previo permanece Ready con 203 paginas.
- Los scripts temporales usados para consultar staging se eliminaron. No se guardaron credenciales de la rama.
- Riesgo pendiente antes de publicar: el Preview actual apunta a Supabase productiva, por lo que no permite una prueba autenticada real de `Guardar inventario` mientras la migracion no exista alli. Siguiente decision segura: preparar ventana productiva con respaldo+SQL+deploy y smoke autenticado, solo tras autorizacion expresa; o configurar un Preview autenticable contra staging.

# 2026-09-11 - PRODUCCION: Inventario Premium administrable y selector de vista de catalogo

- Usuario autorizo `procede` despues del cierre QA. Se publico exactamente el Preview aprobado `dpl_4nnmnQaaYRKB15aN5ds8ohkzwj8J`, promovido como produccion `dpl_FNnJa5qv6bG1RDsetgaMzWKWmMkz`, URL de artefacto `https://vendeplus-clean-260hotnyr-entrega2-s-projects.vercel.app`. Alias `www.somos-ve.com`, `somos-ve.com` y `vendeplus-clean.vercel.app` confirmados.
- Antes del SQL: SHIBUI tenia 332 SKU, 458 unidades y 332 movimientos. Dry-run mostro exclusivamente `20260910232000_premium_inventory_and_catalog_layout.sql`; se aplico esa unica migracion a `rvmtjtuztewcrmodrodb`. Dry-run posterior: remoto al dia.
- Despues del SQL y despliegue: SHIBUI conserva exactamente 332 SKU, 458 unidades y 332 movimientos. La migracion no altero stock. `catalog_layout` y ambos RPC existen; funciones ejecutables solo por `postgres` y `service_role`; 0 comercios cambiaron a visual automaticamente, todos conservan `classic` hasta elegirlo.
- Smoke productivo GET: `/`, `/marketplace`, `/shibui`, `/shibui?vista=visual`, carrito, checkout, login, productos, configuracion y `/smash` respondieron 200. APIs privadas `/api/panel/inventory`, `/api/panel/settings` y `/api/panel/catalogo` respondieron 401 sin sesion. Sin logs de nivel error en la ventana consultada.
- QA previo del artefacto: 94/94 pruebas, TypeScript, ESLint, diff check y build Vercel 203 paginas. Build local final con placeholders CI genero 87 rutas; sin variables privadas fallo solo en prerender como se esperaba.
- No se creo pedido, no se ajusto inventario, no hubo commit ni push. Navegador integrado no disponible; la validacion autenticada del boton `Guardar cambios` queda para el usuario desde SHIBUI.
- Rollback web inmediato: `dpl_69kgyrK3qW9Yk9mf31twQtkimUq8`. La migracion es aditiva y puede permanecer si se revierte la web. Para incidencia de inventario, deshabilitar solo SHIBUI en `store_inventory_settings`; no borrar SKU ni movimientos.
- Siguiente paso: usuario entra a SHIBUI en `/panel/productos`, cambia una existencia conocida en 1 unidad, guarda y confirma historial; luego en `/panel/configuracion` puede elegir Visual y guardar. Verificar cliente en `/shibui`. No activar inventario para otros comercios durante el piloto.

# 2026-09-11 - PRODUCCION: hotfix de stock total derivado de combinaciones

- Usuario reporto que modifico cantidades por combinacion pero `Stock total` no cambiaba. Diagnostico: el guardado real si funciono; tres movimientos recientes en Infinity (+1, -1, -1) dejaron el total SHIBUI correctamente en 457 frente a 458. El defecto era solo de estado/UX: `totalStock` podia conservar una cifra separada y congelada si se abria antes.
- `PremiumInventoryPreview.tsx`: en modo combinaciones ahora muestra un chip reactivo `Stock total: X`, calculado siempre como suma de los SKU locales; cambia inmediatamente con +, -, escritura manual y despues de guardar. La opcion alternativa se renombro a `Stock sencillo`. Si un producto ya tiene combinaciones y se abre esa opcion, el total es calculado y de solo lectura, con explicacion humana.
- `scripts/shibui-preview.behavior.test.mjs` protege el total derivado, el nombre no ambiguo y el campo read-only para productos con combinaciones.
- QA: SHIBUI 12/12, inventario 8/8, criticos 69/69, TypeScript, ESLint focal, diff check y build local 87 rutas OK. Preview `dpl_9n7x3Pv3uSssBkX5VtLCjbWoSjbz` genero 195 paginas en Vercel y fue promovido exactamente.
- Produccion nueva Ready: `dpl_EqgdcsnSYSdn9rdQDV6X3hSjHPWM`, `https://vendeplus-clean-a61uj0agg-entrega2-s-projects.vercel.app`; alias oficiales confirmados. Smoke `/`, `/shibui`, `/panel/productos` 200 y API de inventario 401 sin sesion; sin logs error.
- No hubo SQL/migracion, ajuste de stock, pedido, commit ni push por parte del hotfix. Stock final leido: 332 SKU y 457 unidades, coincidente con los cambios del usuario. Rollback web inmediato: `dpl_FNnJa5qv6bG1RDsetgaMzWKWmMkz`.
- Siguiente paso: usuario recarga `/panel/productos`, abre Infinity y cambia temporalmente una combinacion; el chip debe cambiar antes de guardar y conservar el valor al guardar/volver a entrar.

# 2026-09-11 - PRODUCCION: limpieza de mensajes de inventario y retiro de etiqueta piloto

- Usuario pregunto por el texto `4 cambio(s) pendiente(s)... simulacion` y pidio quitar `SHIBUI piloto`. Se explico que el numero contaba acciones locales, no necesariamente campos diferentes, y que el resto era texto obsoleto del Preview.
- Se reemplazo por estado simple: `Tienes cambios sin guardar. Revisa las cantidades y presiona Guardar cambios.` o `Las cantidades estan guardadas.` Ya no se muestra un contador de clics.
- Se retiraron de la UI las etiquetas/textos `Piloto exclusivo SHIBUI`, `Piloto SHIBUI`, `Preview`, `prueba`, `simulacion` y `sin guardar cambios todavia`. Internamente se conserva el gate ID+slug de SHIBUI para no habilitar inventario en otros comercios.
- Se ocultaron alternativas no operativas `Sin inventario` y `Stock sencillo`; el panel presenta solo el flujo real `Control por combinaciones`. Un producto sin SKU ofrece `Configurar combinaciones`. `Añadir a esta prueba` ahora dice `Añadir combinacion`.
- Archivos: `PremiumInventoryPreview.tsx`, `ProductManager.tsx`, `shibui-preview.behavior.test.mjs`. Sin SQL ni cambios de datos.
- QA: SHIBUI 12/12, TypeScript, ESLint focal, diff check y build local 87 rutas OK. Preview exacto `dpl_5qjh9kzLmjvUAzEDtxG22FXJeKvP`, build Vercel 195 paginas; promovido como produccion `dpl_9DktnVp8KscYfJKSTyU8ZSjS7FM9`, `https://vendeplus-clean-djpuvs6l7-entrega2-s-projects.vercel.app`.
- Alias oficiales confirmados. Smoke `/`, `/shibui`, `/panel/productos` 200, API inventario 401 sin sesion y sin logs error. Rollback web inmediato: `dpl_EqgdcsnSYSdn9rdQDV6X3hSjHPWM`. Sin commit/push.

# 2026-09-11 - Auditoria read-only de aislamiento de inventario y evaluacion Realza

- Usuario pidio validar que inventario no afecte otros comercios y evaluar migrar Realza. Revision solo lectura; sin codigo, SQL, datos, deploy, commit ni push.
- Produccion: solo SHIBUI tiene `store_inventory_settings.enabled=true`; es el unico comercio con SKU (332), movimientos (343 al momento de consulta) y asignaciones de pedido (1). Realza y todos los demas no tienen fila habilitada, SKU, movimientos ni reservas.
- Aislamiento en codigo/DB: catalogo adjunta inventario solo a tiendas habilitadas; `create_order_atomic` salta completamente inventario cuando el opt-in es falso; RPC exige `enabled`; API y tarjeta actuales siguen restringidas por ID+slug exactos de SHIBUI. Otros comercios conservan el flujo legacy.
- Smoke productivo: `/realza`, carrito y checkout, `/smash`, `/china-town` y `/andinos` respondieron 200. No hubo pedidos no-SHIBUI posteriores a la ventana consultada, asi que no se afirmo una validacion transaccional reciente de otro comercio; contratos automatizados previos siguen cubriendo el fallback.
- Realza ID `a83135ce-1c4b-4bf7-95b4-b2f31df31546`, slug `realza`: inventario apagado, 45 productos, 114 pedidos historicos, 0 `product_variants` tecnicas, 0 SKU. Lo que el comercio llama variantes vive como grupos de opciones compartidos: Talla en 45 productos (Xs/S/M/L), Color en 40 (11 valores), Largo en 10 (2 valores), ademas de grupos especiales para promos, tela Rib y packs.
- No activar Realza directamente: con el codigo actual el cliente veria el selector nuevo de inventario y tambien los grupos Color/Talla existentes, duplicando preguntas. La migracion correcta debe convertir dimensiones fisicas a SKU y desvincular Color/Talla/Largo solo en cada producto ya migrado; el historial permanece congelado en `order_item_options`.
- Ruta recomendada: generalizar entitlement/API por `store_inventory_settings`; migrar primero un producto normal sin promo con stock real suministrado; validar pedido, agotado y cancelacion; luego migrar regulares por lotes. No generar automaticamente el producto cartesiano de todos los colores/tallas ni inventar cantidades.
- Promociones 3x y `Pack de basicos esenciales` requieren fase aparte: pueden consumir varias piezas y, en el pack, incluso productos fisicos distintos. La arquitectura actual valida SKU dentro del mismo `product_id`, por lo que el pack necesita componentes/bundle o una estrategia explicita antes de activarse.
# 2026-09-11 - Checkpoint Git de Somos antes de migrar inventario a otros comercios

- El usuario pidio asegurar todo el avance actual. Se trabajo exclusivamente en `.security-billing-release`; Granja Mila continua fuera de este repositorio y no se modifico produccion, Supabase ni Vercel.
- Se creo la rama `checkpoint/somos-entrega2-inventario-20260911` desde el candidato exacto desplegado. El objetivo es conservar juntos los cambios acumulados del puente Entrega2, comprobantes, seguridad/facturacion e Inventario Premium SHIBUI.
- Separacion verificada con busqueda completa: no existen rutas, activos ni codigo de Granja Mila en este worktree. La unica coincidencia es una nota de continuidad que confirma que quedo fuera del alcance.
- Seguridad y QA: escaneo documental 0 credenciales; `npm audit` 0 vulnerabilidades; criticos 69/69, puente 5/5, facturacion 9/9, inventario 8/8 y SHIBUI 12/12; ESLint y `git diff --check` OK.
- `npm.cmd run build` compilo y TypeScript paso, pero sin variables privadas se detuvo en prerender como esta previsto. Repetido con los placeholders seguros del CI termino correctamente las 87 rutas, sin usar datos productivos.
- Este checkpoint no habilita inventario para Realza ni para ningun otro comercio. La auditoria anterior y el plan de migracion por producto siguen vigentes.
