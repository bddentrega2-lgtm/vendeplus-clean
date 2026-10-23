# QA final del bloque autorizado - 2026-10-21

## Entrega

Preview: https://vendeplus-clean-jqytfi2b1-entrega2-s-projects.vercel.app

READY y compartido: `dpl_AjYCF8BAtZPcyDBPmcf3BEzVVQPY`. Base exclusiva
`nmuypksuaxwyonilzoqs`. Produccion sigue `dpl_BFhgckwKn8DVa9CS15kAMqCUv6Ke`.
Sin SQL/deploy/usuarios productivos, sin commit; Mila y ENTREGA2 intactos.
Accesos ficticios en `tmp/audit-staging-recovery/ACCESO-PREVIEW.txt` (ignorado).
Entrar con correo/clave, no Google. Nunca incluir claves en Git.

## Correcciones

- Clientes: la comprobacion de identidad del ultimo pedido accedia a un objeto
  inexistente. Lista vacia pasaba; clientes sin pedido disparaban HTTP500.
  Reproducido en HTTP y test unitario antes del fix. Ahora exige pedido presente
  y conserva misma sede e identidad.
- Admin/Comercios: estado inicial dependiente de sessionStorage generaba HTML
  diferente entre servidor/navegador (React418). Estado estable y sesion en
  effect; sin cambiar autorizacion ni reglas de negocio.

Archivos app: `src/app/api/panel/customers/route.ts`,
`src/components/admin/AdminStoresManager.tsx`.
QA: `scripts/audit-remediation.behavior.test.cjs`,
`scripts/audit-staging-browser-smoke.mjs`,
`scripts/audit-staging-matrix.mjs`,
`scripts/ops/recover-audit-staging.ps1` (accion matrix).

## Resultados

| Prueba | Resultado |
| --- | --- |
| 29 clientes ficticios en dos sedes | A25+3, B1, sin duplicados |
| Busqueda, nuevos/frecuentes | Resultados correctos |
| Ultimo pedido valido/otra identidad/otra sede | Solo valido visible |
| Estadisticas contra DB en cinco periodos | Conteos y valor de productos exactos |
| Estadisticas resumen vs completas | Conteos iguales |
| Periodo personalizado vacio/fechas invalidas | 200 vacio/400 |
| Directorio y privacidad de agencias | Directorio visible, columnas internas401, tarifas privadas ocultas |
| Cotizacion agencia publica/privada | $2/$3 firmadas, sin notas internas |
| Cotizacion propia/coordenadas invalidas | 200 tarifa$1/400 |
| Anon/comercio a admin o sede ajena | 401/403 |
| UI Clientes/Estadisticas/Admin/Comercios/Aliados | 200,390/1280px sin overflow ni pageerror |
| Filtros UI clientes/estadisticas y dia/semana/mes admin | PASS |
| Login real formulario ambas cuentas | PASS |
| Auditoria/carrito | 31/31 PASS |
| Contratos criticos | 90/90 PASS |
| Build local aislado/remoto | PASS133paginas/READY |

Fixtures temporales:29 clientes,1 pedido,2 agencias, tarifas y conexiones;
eliminados por UUID exacto en finally. Verificacion final:4 pedidos originales,
2 usuarios,2 comercios,0 integraciones,0 dispositivos push. Sin despachos reales.
Artefactos ignorados en `tmp/audit-staging-recovery`: matrix-result.json,
browser-smoke.json y capturas PNG. Chromium/Playwright utilizado porque el
navegador integrado no estaba disponible; capturas de Estadisticas movil y
Comercios desktop revisadas.

Build local en `%TEMP%\somos-audit-build-2e6a6b75cb3f4398be699ba1b6d60cbf`,
dependencias propias y endpoint ficticio local. Avisos fetch esperables, sin
consultar produccion. Lint focal aprobado; no afirmar lint global aprobado.
Sin migraciones nuevas: las dos de remediacion siguen solo en staging.
SQL de atomicidad/inventario y E2E Cocina/Mesa anteriores conservan su evidencia
en informe de recuperacion, no se presentan como reejecutados en este turno.

## Revision humana

1. Abrir `/panel/login` con cuenta comercio del archivo local.
2. Cocina Demo: Pedidos, Mesa y Cocina; cambiar estados de pedido ficticio.
3. Clientes/Estadisticas: cambiar filtros. Clientes puede estar vacio al retirar
   QA; crear pedido con datos ficticios desde `/cocina-demo` para ver historial.
4. Cerrar sesion e ingresar cuenta admin: `/admin`, Comercios y Aliados.
   Resumen puede mostrar0 al excluir is_test; no significa perdida de pedidos.
   Aliados esta vacio, sin liquidaciones reales.

Listo para revision del Preview, NO autorizacion automatica de produccion.
No certifica carga nacional, Android, impresoras o despacho externo real.
MFA, Sharp, carreras/reintentos y limite2MB/5MB siguen pendientes por separado.
No se simularon pagos/liquidaciones de aliados en este bloque.
