# Punto de reanudacion

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

## Carga pendiente de productos TDK (2026-08-13)

- Usuario solicito cargar 15 productos con precios entregados en la conversacion, sin duplicados.
- No se realizo ninguna escritura: todos los intentos fueron de lectura y expiraron.
- Windows quedo saturado: Node/Supabase, lectura de archivo local, `tasklist` y hasta detener Docker excedieron 30-120 segundos.
- Se prepararon scripts temporales no versionados `scripts/tmp-import-tdk-products.mjs` en `vendeplus-clean` y `vendeplus-entrega2-hotfix`; deben eliminarse al terminar.
- Siguiente paso exacto tras reiniciar: confirmar una unica tienda por `stores.name/slug ILIKE '%tdk%'`; leer productos existentes; comparar nombres normalizados sin acentos/mayusculas/signos; insertar solo faltantes; volver a consultar y verificar cero duplicados y precios.
- No asumir categoria: revisar categorias actuales de TDK y usar la adecuada o dejar sin categoria si no existe una categoria inequívoca.
