# Plan incremental de remediacion

Actualizacion 2026-10-21: completadas pruebas UI/API de Clientes, Estadisticas,
Admin y cotizaciones publicas/privadas. Corregidos error por ultimo pedido
ausente y renderizado inicial de Admin/Comercios. Ver
[informe y Preview vigente](2026-10-21-qa-preview-final.md). Pendiente revision
humana y aprobacion separada de Git/produccion; no es cierre de toda auditoria.

Los puntos 1, 2, 5 y 9 de la lista de prioridades fueron autorizados para
preparacion local el 2026-10-20: A-16, A-05, A-15, A-02 y A-09. Sus cambios
estan en el worktree y, desde el 2026-10-21, en un Preview aislado sobre la
rama recuperada `nmuypksuaxwyonilzoqs`, con ambas migraciones aplicadas SOLO
alli. El staging independiente anterior sigue pausado. Ver
[validacion y pendientes](2026-10-21-staging-recuperado.md). Produccion no se
ha modificado por esta remediacion. Las demas etapas de este plan no estan
autorizadas; cada etapa requiere Preview aislado y aprobacion antes de
produccion.

| Etapa | Alcance minimo | Prerrequisito | Regresion/aceptacion | Reversion |
| --- | --- | --- | --- | --- |
| 0a | A-16: separar columnas publicas de internas de agencias y respetar tarifas privadas **sin esperar el cierre de la auditoria** | Grant productivo confirmado; mapa de consumidores anonimos antes del cambio | Anon no lee notas/condiciones/datos privados ni tarifas privadas; directorio y cotizacion intactos | Revertir permiso acotado solo con control compensatorio temporal; no publicar datos internos |
| 0 | Completar auditoria paralela: revisar manualmente rutas/RPC/UI pendientes, conciliar RLS/Storage/migraciones, probar fallos aislados y medir baseline | Acceso de solo lectura y staging utilizable sin datos reales | Matriz completa con evidencia y pendientes explicitos, no suponer seguridad por test verde | No aplica |
| 1 | A-14: impedir SVG en la imagen social y actualizar Sharp tras QA | Revisar formatos reales de logos y build limpio | SVG rechazada; JPG/PNG/WebP y Open Graph intactos; aviso audit resuelto | Revertir solo lectura de imagen; mantener bloqueo SVG |
| 2 | A-05: asociar comprobante y crear pedido atomicamente | Staging con fixture, migracion no destructiva, rollback preparado | Token usado/ajeno o fallo DB no deja pedido, stock ni fee; cuatro modalidades conservadas | Volver a version anterior solo tras conciliar pedidos de prueba |
| 3 | A-01: exigir MFA AAL2 para fundador en cookie y Bearer | Enrolamiento/recuperacion listo y Preview con cuenta propia | AAL1 rechazado, AAL2 aceptado, comercio normal sigue aislado | Feature flag temporal con auditoria, no quitar proteccion sin plan |
| 4 | A-15, A-02 y A-10: aislamiento de ultima orden y validacion de payload/cuerpo | Contratos por sede y modalidad | Ningun resumen ajeno; 400/413 sin escritura; pedidos legitimos intactos | Revertir handler acotado tras verificar aislamientos |
| 5 | A-11: CI reproducible; A-09: fallback stats veraz | Dependencias propias del worktree, RPC desplegada verificada | lint/build/types/test verdes; fallo RPC no muestra totales parciales | Revertir configuracion/lanzamiento aislado |
| 6 | A-07/A-08: agregados y paginacion nacional | Baseline p50/p95, volumen y max_rows reales | Conteos exactos, >1000 comercios y >200 conexiones navegables | Cambiar por endpoint paginado previo sin tocar datos |
| 7 | A-12, A-03/A-04 y recuperacion de webhook/impresion | Medir errores RPC/backlog, fixture de fallo entre pasos y cancelacion concurrente | Sin despacho tras cierre ni perdida/duplicado silencioso; cola de comprobantes decrece | Restituir limites previos sin borrar historial |
| 8 | A-13: cron de tasas nacional | Medir sedes activas, max_rows y tiempo de funcion | >1000 sedes actualizadas o fallidas con reintento trazable | Volver a lote anterior sin modificar tasas manuales |
| 9 | Validacion posterior a cada despliegue: RLS/Storage, dinero historico, E2E web/Android y observabilidad | Baseline de etapa 0 y datos anonimizados | Matriz de permisos y cuatro rutas E2E repetidas; p95 y tasa de error no empeoran | Revertir cambio puntual y conciliar efectos |

Correcciones de seguridad/dinero van antes de mejoras funcionales. Refactors de
archivos grandes se hacen solo alrededor de un cambio probado. Para capacidad,
medir p50/p95 y tasas de error bajo escenarios explicitados: por ejemplo 20
mesas activas por sede, 100 pedidos/hora en una sede y 100 sedes concurrentes;
son supuestos de ensayo, **no capacidad prometida**. Registrar CPU/DB,
PostgREST/RPC, duracion webhook, cola de impresion y gasto de proveedores.
