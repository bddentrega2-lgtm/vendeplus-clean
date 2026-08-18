# P1 Open Graph 2026-08-17

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
- Usuario local: `smash-local@somos.test`; clave: `MesaLocal2026!`. El respaldo base no incluye la migracion posterior de anuncios, por lo que esa API auxiliar responde 500 solo en este entorno aislado.
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
