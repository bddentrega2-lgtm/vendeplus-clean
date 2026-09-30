# Auditoria de navegacion y operacion diaria - 2026-09-23

## Alcance y estado

Diagnostico, sin optimizaciones aplicadas ni despliegue. Codigo auditado: checkpoint
15cbbf9, rama fix/service-fee-production. Preview examinado:
https://vendeplus-clean-g1uj45l40-entrega2-s-projects.vercel.app .

Se revisaron catalogo/carrito, Pedidos, Productos, consultas de admin y parcialmente
Clientes. No se modificaron pedidos, productos, pagos, configuraciones ni usuarios.
No se crearon usuarios temporales: la nueva autorizacion para acceso exclusivo a
Smash Test sigue pendiente. No se reutilizaron accesos de pruebas anteriores.

## Prioridades recomendadas

### 1. Corregir respuestas obsoletas en la cache compartida

`src/lib/panel/client-fetch-cache.ts:12` borra los mapas, pero no invalida las
promesas que ya estan en curso. Al terminar, una lectura anterior vuelve a guardar
su resultado sin comprobar si hubo una escritura posterior (linea 52).

Reproduccion determinista con el modulo real y HTTP simulado: GET antiguo en
curso, PATCH exitoso, GET nuevo devuelve version 2, GET antiguo termina y escribe
version 1; la siguiente lectura recibe version 1 desde cache. Puede hacer parecer
que un cambio no se guardo, durante el TTL de 15 segundos. No se reprodujo mediante
una escritura a datos reales.

Propuesta: revision de invalidacion y descarte de lecturas anteriores, conservando
aislamiento de comercio/sesion; agregar pruebas de respuestas fuera de orden.
Agregar timeout y errores recuperables donde corresponda. No reintentar escrituras
automaticamente sin comprobar idempotencia/estado confirmado.

### 2. Buscar productos en todo el catalogo y conservar la lista al guardar

`src/components/panel/ProductManager.tsx:669` carga 120 productos inicialmente;
la busqueda local de la linea 711 solo examina los descargados. `loadData` (729)
no envia la busqueda a la API, aunque `src/app/api/panel/products/route.ts:256`
ya acepta `search` por nombre. Un producto fuera de las paginas cargadas puede no
aparecer. Evidencia de codigo, no reproduccion autenticada con mas de 120 productos.

Guardar llama `loadData(pin)` sin offset (1371/1388), reemplaza la lista por la
primera pagina y pierde las paginas adicionales. El orden SQL por sort_order no
incluye desempate unico; agregarlo al paginar reduce resultados inestables.

Propuesta: busqueda y filtros server-side con contrato explicito (actualmente la
busqueda local incluye descripcion/categoria), paginacion estable, proteccion
contra respuestas atrasadas y actualizacion del producto confirmado sin reiniciar
la posicion ni perder filtros. No reducir funcionalidad de busqueda inadvertidamente.

### 3. Evitar recargas redundantes y saltos en Pedidos

`src/components/panel/OrdersManager.tsx:881` inicia una carga; su exito cambia
isUnlocked (698) y activa otra carga forzada en el efecto de la linea 922.
El precargado de `PanelShell.tsx:54` y el helper de Pedidos
`orders/orders-manager-helpers.ts:460` usan cabeceras distintas para el mismo GET.
Como la cache incluye todas las cabeceras en la clave, no comparten el resultado.
Prueba controlada del modulo confirma dos solicitudes para igual URL con/sin
Content-Type. El numero final de GET en una navegacion real del panel esta pendiente.

Refrescos por eventos/visibilidad/poll vuelven a offset 0 y reemplazan las paginas
expandidas. Filtros/cache local se pierden al desmontar. El detalle tampoco tiene
la misma proteccion contra respuestas fuera de orden que el listado.

Propuesta: una lectura inicial compartida, revalidacion sin perder paginas/filtros,
detalle protegido frente a cambios rapidos de seleccion y actualizacion puntual
tras respuesta confirmada. Mantener pago y preparacion independientes.

### 4. Montar editores de producto solo al abrirlos

`ProductManager.tsx:1366` monta un ProductEditor por producto aunque su details
este cerrado: formularios, estado y variantes ya existen en React/DOM. La vista
alternativa tambien monta todos los editores cargados. Existe ademas un import
estatico del modal opcional PremiumInventoryPreview.

Propuesta: listado liviano y edicion bajo demanda. Medir DOM, hidratacion y tiempo
de busqueda antes/despues con 120 productos y variantes. El costo concreto en
movil aun no se midio con una sesion del panel.

### 5. Reducir lecturas repetidas del resumen admin sin cambiar contabilidad

`src/app/api/admin/summary/route.ts` vuelve a obtener datos globales y saldos al
cambiar periodo. Trae filas en paginas de 500 para agregar en JavaScript.
`src/lib/billing/service-fees.ts` recorre pagos y pedidos elegibles para calcular
saldos; durante esta muestra fueron 1.400 filas de pedidos para los saldos, incluso
al consultar un solo dia. `api/admin/stores/route.ts` repite ese calculo despues de
obtener comercios/metricas. Cambios rapidos de periodo en AdminDashboard descartan
la respuesta vieja visualmente, pero no cancelan el trabajo anterior.

Propuesta: separar datos globales de los del periodo y evaluar agregaciones SQL
acotadas, con pruebas de equivalencia antes de cualquier cambio. Conservar fees
de cancelados, cortes de pagos aprobados, exclusion de comercios de prueba y
alcance por comercio. Esta auditoria no demuestra un error en los importes.

## Mediciones publicas reales en Preview

Playwright aislado, escritorio 1440x1000 y movil emulado 390x844. Movil: latencia
150 ms, descarga 1,6 Mbps, subida 750 kbps, CPU 4x. Smash seguido de SOI Dental
en el mismo contexto: SOI reutiliza recursos JS; no es una carga fria independiente.
Cada catalogo se visito dos veces. Medida hasta buscador visible, no garantia de
interactividad completa; busqueda medida aparte. Sin enviar pedidos.

| Recorrido | Escritorio | Movil emulado |
| --- | ---: | ---: |
| Smash, primera visita | 1.297 ms | 1.832 ms |
| Smash, repeticion | 916 ms | 1.329 ms |
| SOI, primera visita del recorrido | 1.658 ms | 1.083 ms |
| SOI, repeticion | 540 ms | 934 ms |
| Busqueda, rango observado | 54-136 ms | 104-800 ms |
| Agregar al carrito local | 137 ms | 127 ms |
| Abrir carrito | 2.446 ms | 873 ms |

Sin desbordamiento horizontal detectado. Muestras pequenas, cache/servidor calientes
en distinto grado, no p95 ni SLA. El carrito movil mas rapido no implica que movil
sea intrinsicamente mas rapido. Las capturas quedan en tmp; no se realizo revision
visual manual de ellas en este cierre.

Catalogo y carrito usan el cargador completo de productos y relaciones. Hay
consultas secuenciales de configuracion; metadata tambien hidrata datos que no
necesita mostrar. Revisar deduplicacion efectiva e instrumentar antes de atribuir
un tiempo concreto a cada consulta o modificar el cargador compartido.

## Carga real de consultas admin, medida localmente

Se ejecutaron los handlers GET existentes en un arnes local contra Supabase real,
con guardia de solo lectura. Auth omitido exclusivamente en el arnes local; ninguna
proteccion de la app o endpoint remoto fue modificada. La unica RPC permitida fue
admin_store_metrics, revisada como agregacion SQL estable de lectura.

Estos tiempos NO incluyen HTTP/Vercel, autenticacion ni render del panel.
Filas transferidas cuentan repeticiones, no entidades unicas.

| Handler y periodo | Tiempo | Consultas | Filas transferidas | Bytes DB |
| --- | ---: | ---: | ---: | ---: |
| Resumen diario | 4.670 ms | 14 | 1.599 | 310.122 |
| Resumen mensual | 2.007 ms | 16 | 3.016 | 723.413 |
| Lista de comercios | 1.580 ms | 6 | 1.528 | 360.369 |

Una muestra por caso; la primera tuvo mayor costo de conexion/red. No comparar
diario y mensual como rendimientos garantizados. La respuesta del resumen mensual
fue de 8.791 bytes: el volumen leido para calcularla es una oportunidad concreta.

Clientes ya aplica busqueda/segmentos y paginacion en servidor, distinto de
Productos; obtiene varios conteos por busqueda y enriquece ultimos pedidos. Revision
parcial: no se certifica su rendimiento ni todos sus filtros en esta auditoria.

## Evidencias, validacion y siguiente paso

- Arnes/resultados ignorados: tmp/performance-cache-audit*,
  tmp/performance-public-audit* y tmp/performance-admin-db-audit*.
- Datos de medicion agregados, sin publicar credenciales ni dumps de clientes.
- Pendiente autorizacion para crear/eliminar acceso temporal exclusivo a Smash
  Test y medir panel real: entrar/volver, filtros, detalle y Productos. No incluye
  autorizacion nueva para mutar pedidos/productos/pagos ni crear acceso founder.
- Antes de optimizar, registrar esa linea base y agregar regresiones. Ejecutar
  build y validacion Preview al realizar cambios funcionales, no promover sin
  autorizacion. No hubo cambio de codigo de aplicacion en esta auditoria.
- Sin migracion, SQL pendiente, commit o push. V2: carga sostenida y varios
  dispositivos; limite por IP de Wi-Fi compartido sigue pendiente previo separado.

## Ajuste acotado posterior

Se aplico una sola optimizacion del recorrido cliente: en
`src/lib/supabase/catalog.ts`, la hidratacion de delivery y la lectura de imagenes
de productos ahora se ejecutan en paralelo, porque ambas dependen solo del comercio
ya obtenido y no una de la otra. No cambia precios, disponibilidad, inventario,
delivery ni contenido entregado al cliente.

Preview `dpl_UGmsvAK3dDDPUrn6jMdmV31rx7pn`. En la repeticion del mismo protocolo,
las vistas con cache caliente aparecieron entre 541 y 1.440 ms; abrir carrito entre
910 y 1.786 ms. Una primera carga MISS de Smash tuvo un pico de 5.041 ms, por lo
que no se atribuye una mejora porcentual con estas muestras variables. Sin pedidos
enviados, sin overflow y con operaciones de carrito solo en almacenamiento local.

Hallazgo adicional corregido: los comercios creados despues de la migracion privada
de tokens no recibian token de Mesa / Barra. La migracion
`20260923143000_create_table_tokens_for_new_stores.sql` agrega trigger para nuevos
comercios y rellena faltantes idempotentemente. Fue aplicada al Supabase compartido.
Pollos Gran Combo Andres Bello ya tiene token; acceso premium true, operacion Mesa
false, cero mesas y cero metodos de mesa seleccionados. Su ruta QR valida responde
200 en Preview. La configuracion permanece abierta despues de guardar para que el
QR no desaparezca de inmediato.

La cuenta owner unica es `redespollosgrancombo@gmail.com`. El intento solicitado
de asignar `[RETIRADO]` fue rechazado por la politica de contrasenas debiles de
Supabase; Auth no cambio. Se requiere otra clave. El script temporal que contenia
esa clave fue eliminado.

Validacion inicial: 114 pruebas PASS; build local con entorno correcto PASS, TypeScript y
230 paginas PASS; build Vercel PASS. El primer build sin cargar el entorno padre
compilo y paso TypeScript, pero fallo al prerenderizar por variables privadas
ausentes; no fue una regresion y se corrigio el protocolo. Sin produccion, commit
o push.

El 2026-09-24 el usuario autorizo produccion. Se repitieron 114 pruebas y build
local/Vercel (226 paginas actuales), todos PASS. Se promovio
`dpl_Cqi497d2DvTzKgwhM83GgBu72yW5`; `www.somos-ve.com` fue verificado apuntando a
ese deployment. Smoke posterior: catalogo y QR validos 200, API privada de mesas
401 sin sesion. La frase anterior "Sin produccion" describe solo el cierre inicial
del Preview. Sigue sin commit/push.
