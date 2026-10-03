# 2026-10-02 - Codigos de pedidos y comercios cerrados

## Objetivo

- Usuario confirmo impresion fisica y pidio mostrar codigo completo de pedido y avisar si un producto mas vendido pertenece a un comercio cerrado.

## Decisiones

- Mantener codigo completo, con salto de linea para codigos largos.
- Usar el openState del comercio ya cargado para productos de mas vendidos, ofertas y destacados. No ocultar el catalogo cerrado ni cambiar ranking.
- Entregar Preview; produccion queda en el Centro de impresion aprobado.

## Aprendizajes

- La columna fija de 92 px junto con truncate ocultaba el sufijo de pedidos. El ancho nuevo de 132 px permite el formato actual.
- Seis columnas no caben junto al sidebar en tablets de 1024 px. Activarlas en xl evita el desbordamiento.
- MarketplaceProduct no incluia apertura; relacionar storeId con stores evita consultas por tarjeta.
- La impresion manual SO-1002-951577 termino printed en un intento, unos 6 segundos. Usuario confirmo ticket fisico; el evento paid anterior es independiente.

## Errores y causas

- Un parche con varios hunks fuera de orden fallo. Generar hunks en orden del archivo y verificar el diff antes de repetir.
- Una prueba contractual fijaba la columna de 92 px; se actualizo para permitir el arreglo solicitado.
- Navegador integrado no disponible (iab). Se uso Playwright local, con datos simulados para panel, sin escribir pedidos ni usar cuentas reales.
- QA detecto un overflow previo de 8 px en Configuracion del menu web a 320 px. No ocultarlo bajo una afirmacion global de cero overflow; las tarjetas verificadas si quedan dentro de la pantalla.

## Validacion

- 7 escenarios visuales de pedidos, codigo normal y largo: PASS. Web 320/390/1024/1280/1440 y app simulada 320/390.
- Marketplace web/app: tres tarjetas cerradas y dos abiertas, cero errores de pagina.
- Contratos criticos 86/86, ESLint focal y diff-check PASS.
- npm.cmd run build (runner con variables heredadas) PASS; 255 paginas.
- Preview READY dpl_BmYuFcfAs1ww4veckb3s7uesCaWP. Marketplace 200, panel privado 307 a login, API privada 401.
- Sin migracion ni SQL; produccion sin cambios, verificada por ID.

## Estado final

- Usuario aprobo Preview y consulto pendientes Play; aun no se publico este ajuste. Consulta contrastada con fuentes oficiales de Google. Data Safety tenia pendientes obsoletos (Firebase, migraciones y arranque automatico) y fue actualizado. No se ejecuto build nuevo porque esta consulta solo modifico documentacion.
- Sin commit/push. Cambios previos del Centro de impresion se preservaron.
- Preview: https://vendeplus-clean-dz3f5sa77-entrega2-s-projects.vercel.app.
- Pendiente independiente: etiqueta Configuracion en web estrecha; apertura no se refresca continuamente mientras el marketplace permanece abierto.
- Siguiente paso: revision del Preview y autorizacion para publicarlo; luego Git y candidata firmada Play.
