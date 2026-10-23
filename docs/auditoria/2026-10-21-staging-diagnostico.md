# Diagnostico de staging SOMOS - 2026-10-21

Nota posterior: el usuario autorizo recuperar la rama existente con respaldo.
La recomendacion de transferir staging de este diagnostico historico quedo
superada por la [recuperacion y QA aislada](2026-10-21-staging-recuperado.md).

## Alcance y resultado

Revision de solo lectura autorizada para valorar reutilizar la rama antigua.
No se crearon, reactivaron, transfirieron ni eliminaron recursos. No hubo SQL
de escritura, cambio de plan, despliegue, commit ni acceso a datos de clientes.
Produccion, Mila y ENTREGA2 permanecen sin modificaciones por este trabajo.

La API de organizaciones confirma `pro` para `tqkuaohznmpndqxdepdu`, donde
esta SOMOS produccion. La organizacion `vercel_icfg_B9hGS5Xag5lYa2DTCwT7IvDi`
devuelve `free`; alli se encuentra el staging independiente pausado.

## Rama antigua

- Nombre: `shibui-inventory-staging-v2`.
- ID de rama: `527921ed-2cd9-4398-b9bd-c9435364f1c7`.
- Proyecto: `nmuypksuaxwyonilzoqs`; padre: `rvmtjtuztewcrmodrodb`.
- CLI: `MIGRATIONS_FAILED`, proyecto subyacente `ACTIVE_HEALTHY`.
- Creada 2026-09-10; no persistente; `with_data=false`.
- SQL de lectura funciona. GET generico `/v1/projects/{branch-ref}` devuelve
  404; esto NO implica que la rama no exista ni que su base este inaccesible.

| Evidencia | Rama antigua | Produccion (solo metadatos) |
| --- | --- | --- |
| Tablas publicas | 11 | 69 |
| Funciones publicas | 7 | 84 |
| Clientes, miembros de comercio, comprobantes, agencias, configuracion delivery, cuentas de compradores | Ausentes | Presentes |

Conteos exactos de la rama: 1 comercio, 28 productos, 0 pedidos, 332 movimientos
de inventario, 0 usuarios Auth y 22 objetos Storage. Sus 11 tablas tienen RLS
activado; esto no equivale a haber auditado todas sus politicas.

Historial aplicado:

- `20260101000000 minimal_order_schema`
- `20260910220000 opt_in_basic_inventory`
- `20260910220500 catalog_schema`
- `20260910220700 existing_shibui_products`
- `20260910221000 inventory_stock_import_rpc`
- `20260910223000 clean_failed_import`

El handoff del 2026-09-10 confirma que fue un ensayo limitado de inventario.
`with_data=false` no significa que siga vacia: despues se cargaron productos
y fotos. No resetearla ni eliminarla sin respaldo y autorizacion.

## Conclusion

No es un staging integral listo para reutilizar. Las migraciones nuevas
`20261020120000` y `20261020121000` dependen de objetos ausentes; aplicarlas
directamente aqui no permite validar SOMOS ni los puntos de auditoria.
La incompletitud esta comprobada. No se recupero el log original del fallo
de migraciones y no se atribuye `MIGRATIONS_FAILED` a una sentencia concreta.

No conviene cambiar de proveedor de base de datos para resolver este problema.
Recomendacion: recuperar el staging integral existente en la organizacion Pro,
si Supabase permite su transferencia en estado pausado y se aprueba el costo.
Si exige restaurarlo primero o hay restricciones de marketplace/permisos,
detenerse y resolver ese requisito; no pausar otros proyectos para forzarlo.
La alternativa es reconstruir un entorno aislado completo, no remendar este
esquema experimental como si ya fuera equivalente a produccion.

## Siguiente paso exacto

1. Confirmar autorizacion de costo y elegibilidad de traslado del staging
   `xpqmmdmixpyqruykkbkf` a la organizacion Pro, sin alterar produccion.
2. Antes de retirar la rama antigua, respaldar y verificar su esquema, datos
   y objetos Storage; revisar dependencias de previews. El retiro requiere
   autorizacion separada. No hacer merge a produccion.
3. En staging integral activo, verificar diferencias de esquema actuales;
   aplicar las dos migraciones solo alli y sembrar datos ficticios.
4. Preview con credenciales exclusivas de staging; desactivar integraciones,
   correos, push y despachos reales. Verificar identidad de base antes de QA.
5. Probar permisos anonimos, recibos repetidos/fallo, inventario, retiro,
   delivery, mesa/barra, clientes y estadisticas. Produccion requiere aprobacion
   posterior, incluso si el Preview pasa.

## Costos y limites de evidencia

Una rama Micro parte de USD 0.01344/h, aproximadamente USD 9.68 por 30 dias,
solo computo. Es referencia oficial, NO una lectura de la factura ni una
confirmacion del tamano contratado para esta rama. No se consulto facturacion
historica. Una rama activa puede generar consumo aunque su migracion haya
fallado. No prometer costo cero por estar en Pro.

- https://supabase.com/docs/guides/platform/manage-your-usage/branching
- https://supabase.com/docs/guides/platform/project-transfer
- https://supabase.com/docs/guides/platform/billing-faq

## Validacion de esta tarea

Solo documentacion modificada; ninguna migracion nueva ni SQL pendiente para
produccion generado por este diagnostico. No se repitio build por no cambiar
codigo: el build aislado anterior paso (ver SESSION_HANDOFF.md). Sigue pendiente
la validacion integral remota; el exito de tests locales no la sustituye.
