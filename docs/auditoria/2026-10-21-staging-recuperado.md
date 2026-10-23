# Recuperacion de staging SOMOS - 2026-10-21

Actualizacion: [QA final y Preview nuevo](2026-10-21-qa-preview-final.md).
Las pruebas UI/API pendientes de este informe se completaron. Usar jqytfi2b1;
la URL di1bf8uf7 se conserva abajo solo como evidencia historica.

## Resultado

Se reutilizo la rama existente `shibui-inventory-staging-v2`, proyecto
`nmuypksuaxwyonilzoqs`, parent `rvmtjtuztewcrmodrodb`, branch ID
`527921ed-2cd9-4398-b9bd-c9435364f1c7`. No se creo otro recurso, cambio de
plan ni compute. La rama activa conserva su consumo habitual; no es gratis
por reutilizarla. El proyecto independiente de staging sigue pausado.
Produccion, Mila y ENTREGA2 no fueron modificados.

Preview: https://vendeplus-clean-di1bf8uf7-entrega2-s-projects.vercel.app

Deployment `dpl_37psKg9dKDBWwkCNrYqNEmxd5hPW`. Produccion conserva
`dpl_BFhgckwKn8DVa9CS15kAMqCUv6Ke`. Sin commit de este trabajo.

## Respaldo y reconstruccion

- Original: 11 tablas, 28 productos, 332 movimientos, cero pedidos/usuarios,
  22 objetos Storage. No se trato como una base vacia.
- Respaldo verificado: `tmp/audit-staging-recovery/backup-20261021-125752`.
  Dump nativo, SQL, TOC, conteos, metadatos y binarios de Storage con hashes.
- Ensayo real de restauracion con ROLLBACK y comprobacion de conteos paso.
- Copia externa: `C:\Users\Windows\Desktop\RESPALDOS\SOMOS-STAGING-BACKUPS\20261021-125752`;
  30 archivos comparados por hash. La carpeta 125623 es un intento incompleto.
- Esquema productivo exportado en modo solo lectura y ensayado con rollback;
  despues aplicado solo a la rama. Sin datos de clientes, cuentas, pedidos
  ni secretos productivos. Storage anterior conservado; configuracion y
  politicas necesarias reconstruidas sin copiar objetos productivos.
- Migraciones aplicadas SOLO en rama: `20261020120000` (privacidad de agencias)
  y `20261020121000` (pedido/comprobante atomico).
- Historial base `20261021090000 isolated_schema_snapshot_from_production`.
  No ejecutar db push/reset/merge automatico sobre este historial sintetico.
  El marcador antiguo MIGRATIONS_FAILED no se reparo mediante reset/merge.

## Aislamiento

La verificacion final devuelve 69 tablas, 2 usuarios ficticios, 2 comercios,
4 pedidos demo, 0 integraciones y 0 dispositivos push. Anon no ejecuta el RPC
de comprobantes ni lee columnas privadas de agencias; service role si puede
ejecutar el RPC. Google/signup desactivados solo en rama.

Variables heredadas depuradas por deployment: sin FCM, Entrega2, cron,
proveedores externos ni credenciales productivas. No se cambiaron variables
compartidas del proyecto Vercel. Las cuentas demo se guardan solo en
`tmp/audit-staging-recovery/ACCESO-PREVIEW.txt`, ignorado por Git.

## Pruebas realizadas

| Validacion | Resultado |
| --- | --- |
| Restore nativo y ensayo de esquema | PASS, transacciones revertidas |
| buyer_staging_transaction_test.sql | PASS con rollback |
| order_status_consistency_test.sql | PASS con rollback |
| audit_remediation_staging_test.sql | PASS con rollback |
| Cocina E2E HTTP/Chromium | PASS, usuario/pedidos temporales retirados |
| Realtime privado y Mesa sin recargar | PASS, En vivo confirmado |
| Login formulario de comercio y founder ficticios | PASS |
| Catalogo 390px/1280px | HTTP 200, sin overflow, sin error JS observado |
| Pruebas focales auditoria/carrito | 31/31 PASS |
| test:critical | 90/90 PASS |
| npm.cmd run build, copia aislada | PASS, 133 paginas |
| Build remoto Preview | READY |

SQL cubre cuatro modalidades, stock, comprobante reutilizado, fallo de
asociacion con rollback de pedido/items/stock/fee, cruce entre comercios y
comercio sin inventario. E2E prueba permisos 401/403, envio manual sin pago,
deduplicacion, preparar/listo, rechazo de estado obsoleto, cancelacion con
motivo, ciclo sin Cocina, mesa validada por servidor y envio por pago.

Build local en `%TEMP%\somos-audit-build-2e6a6b75cb3f4398be699ba1b6d60cbf`,
dependencias propias y Supabase local ficticio. Avisos de fetch esperables;
no se consulto produccion. Lint focal JS sin errores; lint global conserva
errores heredados de harness y warnings de hooks, no declarar verde global.

Artefactos privados bajo `tmp/audit-staging-recovery`: browser-smoke.json,
capturas catalog-390/1280 y login-commerce/admin. Captura movil revisada.

## Como probar

1. Abrir `/panel/login` en el Preview y usar cuenta commerce del archivo local.
2. En Cocina Demo revisar Pedidos, Mesa y Cocina; preparar/listo/cancelar solo
   pedidos ficticios. Confirmar sincronizacion y motivo de cancelacion.
3. Abrir `/cocina-demo` en telefono: probar retiro, delivery propio, Mesa y
   Barra; no usar datos personales ni cuentas bancarias reales.
4. Abrir `/tienda-demo`: probar articulo con inventario y rechazo al exceder
   stock. No equivale a repetir compras sobre Shibui real.
5. Revisar Clientes y Estadisticas despues de los pedidos demo; comprobar
   filtros y conteos. Con cuenta admin probar `/admin`.

## Limites y siguiente paso

No hay autorizacion productiva por esta tarea. Falta revision humana del
Preview, recorrido UI completo de Admin/Clientes/Estadisticas y matriz
publica de cotizacion antes de preparar rollout con aprobacion separada.
No se probaron despachos externos reales, Android/impresion, carga nacional
ni todos los hallazgos de auditoria. Tiempos E2E 0.45-5.82s no son benchmark.

Realtime fallo inicialmente con CHANNEL_ERROR y luego paso suite completa;
causa inicial no probada. El test antiguo se ajusto a expectedStatus y
transiciones hacia adelante, sin cambiar el producto para hacerlo pasar.
Verificar compatibilidad de carga de comprobantes con constraint DB 2MB
frente a requisito historico 5MB; podria existir compresion previa, no se
ha demostrado un fallo actual y no se modifico en esta tarea.

Para produccion preparar respaldo/rollback, aplicar las dos migraciones
revisadas antes del codigo dependiente y ejecutar smoke controlado con
autorizacion. No restaurar este dump de pruebas sobre produccion.
