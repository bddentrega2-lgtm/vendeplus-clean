# Guia de cambios funcionales

1. Fijar commit, despliegue y migraciones vigentes; revisar
   [cobertura](cobertura-y-validacion.md). Este mapa tiene fecha y puede caducar.
2. Buscar el elemento en [matriz-impacto.csv](matriz-impacto.csv), rutas,
   funciones/RPC y triggers. Trazar consumidores directos e indirectos,
   incluidos Android instalado, web vieja y empresas externas.
3. Escribir invariantes y elegir pruebas segun impacto: unitarias para logica
   pura; integracion RPC/tenant para dinero, stock y permisos; E2E aislada para
   recorridos; carga solo en entorno controlado.
4. Revisar tipos, estados, moneda/redondeo, zona horaria, nullability,
   idempotencia y compatibilidad con consumidores antiguos. Una migracion debe
   ser no destructiva, reversible cuando sea viable y verificable antes de uso.
5. Cambiar el menor numero de archivos; actualizar matriz, flujo y pruebas si
   cambia un contrato. No equiparar pantalla oculta con autorizacion API.
6. Separar Preview, prueba funcional y pase a produccion. Definir metricas,
   ventana, rollback del deployment y reconciliacion de datos si la DB cambia.
   No probar con pedidos/cobros/envios reales sin permiso y control QA.

Texto breve propuesto para agregar **despues**, sin reemplazar `AGENTS.md`:

> Antes de cambios funcionales, consultar `docs/auditoria/` y hacer analisis
> de impacto en pantallas, APIs, SQL, integraciones y pruebas; actualizar mapa y
> regresiones relacionadas. Estos documentos tienen fecha y commit, por lo que
> siempre deben contrastarse con el codigo y la base vigentes.
