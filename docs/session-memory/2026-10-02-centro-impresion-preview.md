# 2026-10-02 - Centro de impresion en Preview

## Objetivo

- Convertir la impresion ya funcional en una operacion recuperable para comercios.
- Detectar telefonos sin actividad, trabajos pendientes o fallidos y permitir reintentos seguros.
- Resolver que una impresion manual quedara en cola sin despertar la app.

## Decisiones

- Un pedido manual debe despertar la app aunque la automatizacion este desactivada.
- Los eventos automaticos received y paid conservan sus filtros configurables.
- Solo se reintentan trabajos failed; un trabajo pendiente o en proceso no se duplica.
- El panel muestra errores humanos y nunca expone tokens FCM ni errores tecnicos crudos.
- La cola visible se limita a las 20 comandas mas recientes para mantener la pantalla operativa.
- No se modifica produccion sin prueba controlada en Smash Test.

## Aprendizajes

- Crear un registro manual en order_print_jobs no basta desde que Android dejo el sondeo permanente; tambien hay que enviar FCM para despertar el agente.
- El wake FCM solo transporta type=print_jobs y orderId; Android drena la cola real del comercio, por lo que un reintento no necesita duplicar el trabajo.
- La tabla ya contenia toda la informacion necesaria para salud y recuperacion. No fue necesaria una migracion.
- last_seen_at se actualiza por el agente con una ventana de un minuto y permite distinguir actividad reciente sin sondeo agresivo desde el panel.
- Los previews de este proyecto nacen protegidos por SSO de Vercel aunque el despliegue este READY. Se puede compartir solo el despliegue validado mediante el bypass de alias usado por las herramientas del repositorio; el panel y sus APIs conservan su propia autenticacion.
- Vercel lista FIREBASE_SERVICE_ACCOUNT_JSON para Produccion, pero al exportar variables entrega vacio ese valor sensible. No se debe intentar debilitar esa proteccion ni guardar el secreto localmente.

## Errores y causas

- La impresion manual funcionaba solo cuando la app estaba abierta y llamaba processQueue(). Desde web, la comanda quedaba pendiente porque la ruta no enviaba FCM.
- La primera prueba visual redirigio a login porque el servidor local no habia cargado las variables del .env.local del directorio padre.
- La primera simulacion del panel fue interceptada por una ruta Playwright generica agregada despues de las rutas especificas. Playwright aplica esos handlers en orden inverso; se elimino el interceptor generico.
- La primera captura en Windows uso URL.pathname y genero una ruta duplicada. Se corrigio con fileURLToPath.
- next dev modifico next-env.d.ts; se restauro el archivo generado antes del build final.
- El intento de preparar un Preview con FCM detecto que la credencial exportada estaba vacia y aborto antes del despliegue. El archivo temporal se elimino en finally y no quedo ningun secreto en disco o Git.

## Validacion

- FCM e impresion: 9/9 PASS, incluida impresion manual con automatizacion apagada.
- Contratos criticos: 86/86 PASS.
- Centro de impresion movil: 2/2 PASS en 320 y 390 px, sin overflow, con reintento y cero errores de pagina.
- TypeScript, ESLint focal y git diff --check: PASS.
- Endpoint anonimo del estado de impresion: 401.
- npm.cmd run build: PASS con Next.js 16.3.4 y 255 paginas.
- Preview Vercel READY y compartible: dpl_329TqS4Qtn1AvKyEopY29DDmSEDD. Marketplace 200, panel privado redirige a login y API anonima 401.
- Sin migracion y sin SQL.

## Estado final

- ACTUALIZACION: usuario aprobo el Preview y autorizo produccion.
- Produccion final: dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC, READY, con todos los aliases oficiales.
- Rollback previo al Centro: dpl_386nQSZ6aF4jz5oxJfLm4JsiAgu4.
- Una auditoria de solo lectura detecto siete fallos historicos en Smash Test. Se agrego una ventana server-side de 24 horas, confirmacion visible y conteo de errores recientes para impedir reimpresiones antiguas accidentales.
- Smoke productivo: Home, Marketplace y Smash 200; panel privado redirige a login; API anonima 401.
- Cambios sin commit ni push.
- Preview: https://vendeplus-clean-patd1se2n-entrega2-s-projects.vercel.app.
- El Preview sirve para validar UI, pero no contiene la credencial FCM de Produccion.
- ACTUALIZACION: usuario confirmo ticket fisico manual. SO-1002-951577 termino printed en un intento, aproximadamente 6 segundos; solo un trabajo manual. La prueba fisica ya esta completada.
- Siguiente paso: ajustes de codigo visible y cierre del marketplace en Preview; despues commit/push y AAB firmado.
- Despues: upload key, AAB firmado y Play Internal Testing.
