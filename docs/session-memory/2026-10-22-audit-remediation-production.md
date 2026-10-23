# Publicacion controlada de remediaciones de auditoria

## Alcance

Se publico SOMOS el 2026-10-22 despues de QA aislada. El cambio incluye la
proteccion de lecturas publicas de agencias de transporte, la asociacion atomica
entre pedido y comprobante, validaciones de pedido, aislamiento de ultimo pedido
en Clientes y rechazo de estadisticas incompletas.

## Operacion

- Punto previo: `dpl_BFhgckwKn8DVa9CS15kAMqCUv6Ke`.
- Punto publicado: `dpl_B4f65FgAd8oGMB6SEmP4FvinRzfm`.
- Las migraciones `20261020120000` y `20261020121000` se ensayaron dentro de
  una transaccion con `ROLLBACK` y luego se aplicaron una sola vez.
- Se creo un respaldo completo ignorado por Git. No registrar su ruta publica,
  credenciales, contenido ni datos de pedidos en conversaciones externas.

## Aprendizajes

- Las credenciales obtenidas por `supabase db dump --dry-run` son adecuadas
  para respaldo de lectura, pero no para aplicar DDL en produccion. Para el
  ensayo y apply de migraciones se uso el endpoint administrativo de Supabase,
  siempre con una lista cerrada de SQL, timeouts, historial de migracion y
  confirmacion del ref productivo.
- Una URL de despliegue Vercel con proteccion SSO no sirve para smoke anonimo;
  validar build/inspect y, despues de promocion, hacer smoke muy corto en el
  dominio oficial con rollback web ya identificado.
- El rollback del despliegue no deshace DDL. Por eso el backup y el ensayo de
  las migraciones preceden siempre a la promocion web.

## Validacion posterior

- Paginas publicas y de acceso principales respondieron 200.
- API privada sin sesion respondio 401.
- No aparecieron errores Vercel en los diez minutos posteriores.
- Las suites focales y de contratos fueron 31/31 y 90/90.
