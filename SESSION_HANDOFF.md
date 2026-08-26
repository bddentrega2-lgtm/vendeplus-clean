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
