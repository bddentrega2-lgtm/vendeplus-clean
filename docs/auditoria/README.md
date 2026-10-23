# Auditoria de codigo y arquitectura de SOMOS (en curso)

Inicio: 2026-10-19; ampliacion: 2026-10-20 (America/Caracas). Base: `feature/catalog-ux-20261015`,
commit `0f4c17483fe9097467fd775af71c4b8eb1b8518a`, mas cambios locales
preexistentes del hotfix de carrito. El codigo publicado se contrasto solo en
las pruebas de lectura y pedido QA descritas en `cobertura-y-validacion.md`;
no se ha probado que todas las migraciones del repositorio esten aplicadas.

## Dictamen provisional

SOMOS es una aplicacion Next.js con una base Supabase compartida por catalogo,
panel comercial, admin, delivery, afiliados e integraciones. Android es una
carcasa Capacitor que carga la web y agrega impresion, alertas y autenticacion
nativa. Hay contratos transversales sensibles: crear pedido, fee, estado,
proveedor de delivery, stock y permisos. Un cambio en cualquiera de ellos
requiere pruebas cruzadas.

La ampliacion encontro cuatro prioridades altas: lectura publica de columnas
internas de agencias activas, comprobada en produccion sin leer valores (A-16),
admin sin AAL2 efectivo (A-01), creacion de pedido antes de asociar un
comprobante requerido (A-05) y `sharp` vulnerable con un camino plausible de
SVG a la imagen social (A-14). Ninguna prueba indica intrusiones ni pagos
errados ocurridos. Tambien
hay riesgos de capacidad en resumen y marketplace, y un fallo de lint en la
puerta CI. El webhook Entrega2 admite reintentar el mismo estado y su cierre
terminal es idempotente en el codigo revisado; queda pendiente inyectar fallos
aislados para comprobar recuperacion completa. **Inventario de superficies no
equivale a 100% de comportamientos verificados**: ver limites de cobertura.
La hipotesis de saldos demo en produccion (A-06) se descarto al contrastar la
URL codificada con la identidad del proyecto staging; queda documentada para
no reabrirla sin evidencia nueva.

## Orden de lectura

1. [Cobertura y validacion](cobertura-y-validacion.md): alcance real y limites.
2. [Arquitectura actual](arquitectura-actual.md) e [inventario funcional](inventario-funcional.md).
3. [Flujos criticos](flujos-criticos.md) y [matriz de impacto](matriz-impacto.csv).
4. [Hallazgos](hallazgos.md), [plan de remediacion](plan-remediacion.md) y
   [guia de cambios](guia-de-cambios.md).

No ejecutar el plan automaticamente. Revalidar fecha, commit, configuracion y
migraciones vigentes antes de cualquier cambio funcional.
