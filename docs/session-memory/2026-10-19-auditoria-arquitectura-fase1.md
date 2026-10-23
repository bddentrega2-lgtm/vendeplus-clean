# 2026-10-19 - Auditoria de arquitectura, fase 1

## Objetivo

- Mapear arquitectura, contratos e impacto de SOMOS con evidencia, solo
  diagnostico y documentacion. Excluir CRM ENTREGA2 y no tocar produccion.

## Decisiones

- Auditar el worktree `.catalog-ux-preview-20261015`, no la raiz antigua con
  multiples cambios y proyectos anidados.
- Marcar la cobertura parcial y no declarar una auditoria integral completada
  por inventario estatico o suites focales.
- No modificar AGENTS.md; proponer texto en la guia para revision posterior.

## Aprendizajes

- El estado igual de Entrega2 **si** puede reintentarse:
  `src/lib/entrega2-contract.ts:115-120` retorna true para `current === next`.
  `close_entrega2_order_v2` es idempotente para orden terminal. Trazar hasta
  el contrato compartido y la migracion mas reciente antes de declarar riesgo.
- Un `node_modules` junction del worktree apunta a la raiz antigua y no
  refleja todas las dependencias declaradas; no inferir fallo de produccion de
  ese build local.

## Errores y causas

- Hipotesis inicial equivocada: despues de una escritura parcial del webhook,
  el mismo evento seria descartado. Causa: leer la rama de rechazo en la ruta
  sin leer primero `canAdvanceEntrega2OrderStatus`. Corregido en documentos;
  la recuperacion completa aun requiere fallo inyectado en staging.
- Auditoria de build local bloqueada por junction Turbopack y paquetes
  faltantes en instalacion compartida; no se instalaron ni cambiaron versiones.

## Validacion

- `node --test` en carrito, inventario, contratos criticos y puente Entrega2:
  138/138 PASS. Build local FAIL por junction; TypeScript FAIL por dos paquetes
  ausentes y errores derivados. CSV de impacto 10 filas, 10 columnas validas.
- Sin migracion, SQL, despliegue, pedido, cobro ni cambio de permisos durante
  esta fase.

## Estado final

- Rama `feature/catalog-ux-20261015`, HEAD
  `0f4c17483fe9097467fd775af71c4b8eb1b8518a`; sin commit nuevo.
- Nueve documentos en `docs/auditoria/`. Siguiente paso: resolver entorno de
  build aislado, comparar esquema/RLS desplegados de solo lectura y continuar
  E2E/fallos aislados. Respetar avances previos del hotfix Shibui.
