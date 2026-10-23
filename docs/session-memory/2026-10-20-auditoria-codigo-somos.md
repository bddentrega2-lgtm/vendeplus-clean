# 2026-10-20 - Auditoria de codigo SOMOS, continuacion

## Alcance y decisiones

- Se continuo sobre `.catalog-ux-preview-20261015` HEAD
  `0f4c17483fe9097467fd775af71c4b8eb1b8518a`, sin tocar produccion,
  migraciones ni comportamiento. Los cambios previos del hotfix Shibui se
  dejaron intactos.
- Se leyeron guardias de admin/panel/transporte, sesion cookie y RPC AAL,
  creacion de orden y comprobante, resumen/estadisticas, afiliados, marketplace,
  cron de tasa, despacho y rutas comprador/impresion. Inventario mecanico de
  metodos mutantes en 110 rutas API: todos tienen algun guardia textual o
  rate limit salvo `auth/panel-session`, que valida token Supabase. Esto no
  demuestra autorizacion correcta de cada rama.

## Hallazgos nuevos

- A-01 P1: admin solo verifica correo fundador, no AAL2; codigo usa sesiones
  RPC v1 aunque existe migracion AAL v2.
- A-05 P1: pedido se persiste antes de asociar captura; error/uso previo del
  token produce 500 con orden ya creada.
- A-14 P1: lockfile Sharp 0.35.4 afectado por GHSA-wq5f-xc86-pv6w;
  imagen social permite URL de cualquier `*.supabase.co` y pasa bytes a Sharp
  sin rechazo SVG. Exposicion plausible, no explotacion demostrada. Aviso
  `source-map-js@1.2.1` aparece por toolchain, sin entrada cliente hallada.
- A-06 **descartado para produccion**: la URL que habilita saldos demo es del
  staging pausado (`xpqmmdmixpyqruykkbkf`), no del proyecto productivo
  (`rvmtjtuztewcrmodrodb`). La primera inferencia fue incorrecta por no
  contrastar el identificador de entorno antes de clasificar el hallazgo.
- A-07/A-08/A-09/A-13 P2: resumen admin mueve todas las filas del periodo;
  marketplace y conexiones tienen topes sin paginar; fallback stats trunca;
  cron de tasa actualiza sedes secuencialmente sin paginar.
- A-10/A-12 P2: cuerpo de pedido se limita solo por Content-Length; envio
  externo puede competir con cierre/cancelacion de orden.
- A-15 P2 condicionado: la lista Clientes carga `last_order_id` sin validar
  sede de la orden; un puntero corrupto podria exponer resumen de otra sede.
- A-11 P2: lint local falla por 8 errores de regla Next en pruebas/docs;
  CI ejecuta lint antes de build. No inferir fallo runtime.
- A-16 P1 confirmado en permisos productivos: migraciones otorgan SELECT de toda
  `transport_agencies` a anon para agencias activas. Hay `admin_notes`, RIF,
  terminos financieros y `particular_payment_details` en esa misma tabla;
  ninguna migracion posterior encontrada restringe columnas. Un GET anonimo
  con `limit=0` a `admin_notes` dio HTTP 200 en prod, mientras el control de
  columna privada de `stores` dio 401. HEAD conto 8 agencias activas, 4 con
  tarifas privadas. No se descargaron valores ni se probo acceso de terceros.
- Android: manifiesto no exporta servicios de impresion/FCM y deshabilita
  backup; callback nativo valida esquema/host de deep link y URL OAuth;
  token de impresion se cifra con Android Keystore. Lectura parcial, sin
  prueba de APK ni hallazgo nativo confirmado.

## Validacion

- `npm.cmd run test:critical` 90/90 PASS; `npm.cmd run test:billing-release`
  9/9 PASS. `npm.cmd run lint` FAIL con 8 errores/2 advertencias. `npm.cmd
  audit --omit=dev --audit-level=high` reporta 2 high; `npm.cmd ls` confirma
  que el junction local esta desalineado del lock. Ya constaba
  suite focal 138/138 PASS; build/types locales bloqueados por junction y
  paquetes ausentes. No se ejecutaron pedidos, pagos, cargas ni pruebas de
  estres productivas.
- Documentos `docs/auditoria` actualizados con hallazgos, flujos, cobertura y
  prioridades. No hay commit ni despliegue.

## Proximo paso exacto

- Auditoria sigue **parcial**. Verificar esquema/RLS/grants/Storage desplegados
  en solo lectura, existencia de codigos demo y volumen real; staging aislado
  para fallos de comprobante, concurrencia de despacho, cuatro modalidades y
  webhook; instalar dependencias en copia aislada para build/types y medir
  p95. No llamar 100% comprobado al inventario estatico.
