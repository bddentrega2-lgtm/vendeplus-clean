# Auditoria modulo Empresas Delivery - VendeMas

## 1. Resumen ejecutivo

Veredicto: LISTO CON RIESGOS CONTROLADOS.

El modulo ya tiene una base comercializable para pilotos: registro de empresas delivery, panel propio, logo, tarifas plana/zonas/rangos/cotizacion, km limite, solicitudes de afiliacion, conexiones comercio-empresa, pedidos operativos con snapshots, estados de transporte, facturacion semanal basica y supervision desde admin.

Lo que no esta listo como operacion nacional completa es el cierre formal de facturacion, reportería avanzada, paginacion robusta en admin, observabilidad real de latencia, historial completo de cambios comerciales y una app/flujo de repartidores. No hacen falta para vender el piloto, pero si para escalar con control.

Riesgo principal: varias pantallas siguen cargando datos amplios en cliente/admin y la operacion depende de WhatsApp manual para confirmar el envio a la empresa delivery.

Recomendacion para pilotos: operar con 3 a 15 comercios y 2 empresas delivery, pero activar monitoreo, aplicar migraciones pendientes y probar exhaustivamente el flujo comercio -> cliente final -> empresa delivery antes de sumar mas ciudades.

## 2. Funciones existentes

| Funcion | Estado | Ruta | Riesgo | Comentario |
|---|---|---|---|---|
| Landing empresa delivery | Lista | `/transporte` | Bajo | Lenguaje visible ajustado a "empresa delivery". |
| Registro empresa delivery | Lista | `/transporte/registro` | Bajo | Registro simple, queda pendiente activacion admin. |
| Login/panel empresa delivery | Lista | `/transporte/panel` | Medio | Usa Supabase Auth y usuario vinculado a empresa. |
| Configuracion operativa | Lista V1 | `/transporte/panel/configuracion` | Medio | Logo, capacidad, moneda, tasa, condiciones y modalidad. |
| Tarifas | Lista V1 | `/transporte/panel/tarifas` | Medio | Plana, zonas, rangos sin solape y cotizacion manual. |
| Tarifas publicas/privadas | Agregada | Configuracion + API panel comercio | Medio | Requiere ejecutar migracion nueva. |
| Solicitudes de afiliacion | Lista | `/transporte/panel/solicitudes`, `/panel/delivery` | Medio | Permite reenviar tras rechazo. |
| Exclusividad | Reforzada | APIs solicitud/aprobacion/activacion | Medio | Bloqueo server-side agregado. |
| Pedidos operativos | Lista V1 | `/transporte/panel/pedidos` | Medio | Estados, contacto comercio/cliente e historial. |
| Facturacion semanal | Basica | `/transporte/panel/facturacion` | Medio | Calcula por comercio y estado; falta cierre formal. |
| Super admin transporte | Mejorado | `/admin/transporte` | Medio | Ahora puede desafiliar inmediato sin 72 horas. |
| Checkout cliente final | Integrado | `/{storeSlug}/checkout`, `/api/orders` | Medio | Usa tarifas de empresa activa y snapshots en pedido. |

## 3. Funciones faltantes recomendadas

| Funcion | Prioridad | Comentario |
|---|---:|---|
| Cierre semanal formal | Alta | Crear corte revisado/pagado con notas y snapshot. |
| Paginacion admin y filtros por fecha | Alta | Evita lentitud al crecer pedidos/clientes. |
| Auditoria de cambios | Alta | Registrar cambios de tarifa, modalidad y desafiliacion. |
| Notificaciones internas | Media | Avisos para solicitudes, desafiliaciones y pedidos enviados. |
| SLA operativo | Media | Tiempos de aceptacion, retiro, entrega y fallas. |
| Repartidores/asignacion | V2 | No construir app completa todavia; primero validar flujo empresa. |
| Conciliacion por comercio | V2 | Marcar cortes como revisados/pagados con adjuntos. |

## 4. Integracion de datos

Si la empresa delivery cambia tarifas, afecta nuevos pedidos y nuevos calculos de checkout para comercios activos. No debe cambiar historicos porque `orders` y `transport_orders` guardan snapshot de empresa, tarifa, zona, cliente, direccion y estado.

Si el comercio cambia direccion, WhatsApp u horario, nuevas solicitudes deben tomar esos datos; solicitudes antiguas conservan snapshots.

Si la empresa se pausa, las conexiones activas se pausan desde admin y dejan de ser proveedor por defecto.

Si el comercio se desafilia por flujo normal, queda solicitud/confirmacion y aviso de 72 horas. Si super admin desafilia, se cancela inmediato, se limpia `is_default` y si esa empresa estaba en checkout se desactiva delivery para no cobrar precios obsoletos.

Si una empresa tiene tarifas privadas, el API del panel comercio oculta tarifas, zonas y rangos hasta que exista conexion activa. El checkout si puede calcular cuando el comercio ya esta aprobado y activo.

## 5. Seguridad

Cambios aplicados:

| Riesgo | Cambio |
|---|---|
| Comercio podia solicitar otra empresa teniendo exclusiva activa | Bloqueo en API de solicitud. |
| Empresa podia aprobar comercio incompatible con exclusividad | Bloqueo en API de aprobacion. |
| Comercio podia activar otra empresa pese a exclusiva | Bloqueo en API de activacion. |
| Tarifas privadas ocultas solo en UI | Enmascarado agregado en API panel comercio. |
| Admin sin corte inmediato | Endpoint admin protegido para desafiliar directo. |

Riesgos pendientes:

| Riesgo | Mitigacion recomendada |
|---|---|
| RLS de tablas transporte bloquea acceso directo y se opera con service role en APIs | Mantener validacion fuerte en Route Handlers; revisar con advisors antes de abrir mas permisos. |
| No hay auditoria formal de cambios | Agregar tabla de eventos de relacion comercio-empresa. |
| No hay cierre inmutable de facturacion | Agregar statements con snapshot semanal. |

## 6. Performance y lentitud

Senales reales revisadas:

| Prueba produccion | Resultado |
|---|---:|
| `/` | 200, aprox. 2485 ms |
| `/marketplace` | 200, aprox. 497 ms |
| `/armario` | 200, aprox. 359 ms |
| Logs Vercel 30 min | Sin 500; una advertencia de fallback por Supabase en `/robots.txt`. |

Causas probables:

| Area | Hallazgo |
|---|---|
| Home | Carga datos dinamicos para logos/comercios y puede tardar en primer request ISR. |
| Admin | Hay consultas con limites de 10k/20k en resumen/admin. |
| Paneles | Componentes cliente grandes cargan bastante estado en una sola pantalla. |
| Transporte | Algunas APIs traen empresa + tarifas + zonas + rangos en la misma respuesta. |
| Supabase | Si el proyecto esta en plan gratuito, cold starts/conexion/pausas pueden sentirse como lentitud. |

Mejoras aplicadas:

| Archivo | Cambio |
|---|---|
| `/api/panel/transport/agencies` | Enmascara tarifas privadas y evita exponer reglas a no aprobados. |
| APIs exclusividad | Evita estados inconsistentes que luego encarecen soporte. |

Pendientes de performance:

| Prioridad | Mejora |
|---|---|
| Alta | Reducir queries admin de 10k/20k por conteos agregados o RPC. |
| Alta | Paginacion real en pedidos, clientes, conexiones y transporte. |
| Media | Separar carga de panel empresa por tab para no traer todo en `/api/transport/me`. |
| Media | Cachear home/marketplace con invalidacion por cambio de tienda/logo. |

## 7. Servidor y plan pago

Con el trafico esperado esta semana, el setup actual puede aguantar pilotos pequenos si los comercios no generan picos fuertes. Para demos y pilotos controlados, no migraria todo por intuicion.

Recomendacion: pasar Supabase a plan pago antes de operar masivamente con comercios grandes si se observan pausas, lentitud de autenticacion, storage creciendo por imagenes o errores de conexion. Prioridad: Supabase primero, porque la app depende de DB/Auth/Storage. Vercel Pro conviene si necesitan mas observabilidad, logs retenidos, equipo, dominios/seguridad y menor friccion operativa.

Senales para subir:

| Senal | Decision |
|---|---|
| Mas de 10 comercios operando a diario | Evaluar Supabase Pro. |
| Mas de 100 pedidos diarios sostenidos | Supabase Pro recomendado. |
| Latencias API frecuentes sobre 2s | Revisar queries y plan DB. |
| Necesidad de diagnosticar incidentes reales | Vercel Pro por observabilidad/logs. |
| Muchas imagenes de catalogo/logo | Vigilar storage y transformaciones. |

## 8. Cambios aplicados

| Archivo | Cambio | Motivo | Riesgo reducido |
|---|---|---|---|
| `supabase/migrations/20260709143000_transport_agency_visibility.sql` | Agrega `rates_visibility` | Tarifas publicas/privadas | Exposicion comercial indebida |
| `src/lib/transport.ts` | Normalizador de visibilidad y copy | Modelo comun | Inconsistencia |
| `src/app/api/panel/transport/agencies/route.ts` | Oculta tarifas privadas sin conexion activa | Seguridad de datos | Tarifas visibles antes de aprobacion |
| `src/app/api/panel/transport/agencies/[agencyId]/request/route.ts` | Bloquea solicitud incompatible con exclusiva | Reglas de afiliacion | Doble afiliacion invalida |
| `src/app/api/transport/requests/[requestId]/route.ts` | Bloquea aprobacion incompatible con exclusiva | Reglas de afiliacion | Estado imposible |
| `src/app/api/panel/transport/connections/[connectionId]/activate/route.ts` | Bloquea activacion incompatible con exclusiva | Checkout correcto | Precios de proveedor equivocado |
| `src/app/api/admin/transport/connections/[connectionId]/disengage/route.ts` | Desafiliacion inmediata admin | Soporte operativo | Bloqueo por 72 horas en emergencia |
| `src/components/admin/AdminTransportManager.tsx` | Boton "Desafiliar ahora" | Control founder | Operacion manual en SQL |
| `src/components/transport/*` | Lenguaje empresa delivery | Producto comercial claro | Confusion comercial |
| `src/components/panel/*` | Lenguaje y tarifas privadas | Claridad comercio | Confusion y filtracion |
| `src/components/public/*` | Lenguaje home/marketplace | Coherencia comercial | Marca inconsistente |

## 9. SQL/migraciones

Nueva migracion:

`supabase/migrations/20260709143000_transport_agency_visibility.sql`

Hace:

- Agrega `transport_agencies.rates_visibility`.
- Default: `public`.
- Check: `public` o `private`.

Debe ejecutarse en Supabase produccion antes de usar la configuracion de tarifas privadas.

## 10. Build

`npm.cmd run build` ejecutado correctamente.

Resultado: compilacion, TypeScript, generacion de paginas y rutas OK.

Nota: aparece `DEP0205 DeprecationWarning: module.register() is deprecated`. No bloquea el build, pero conviene revisarlo luego como mantenimiento de dependencias/runtime.

## 11. Checklist para probar

Empresa delivery:

- Entrar a `/transporte/panel`.
- Subir/cambiar logo.
- Cambiar modalidad a abierta/exclusiva/mixta.
- Cambiar visibilidad de tarifas publica/privada.
- Configurar tarifa plana, zonas y rangos.
- Aprobar y rechazar solicitud.
- Ver pedido recibido y cambiar estado.
- Revisar facturacion semanal.

Comercio:

- Entrar a `/panel/delivery`.
- Ver empresa con tarifas publicas.
- Ver empresa con tarifas privadas sin detalle antes de aprobacion.
- Solicitar afiliacion.
- Reenviar solicitud rechazada.
- Activar empresa aprobada.
- Confirmar que con empresa exclusiva no se pueda activar otra.
- Solicitar desafiliacion normal.

Cliente final:

- Entrar al catalogo del comercio.
- Agregar producto.
- Ir a checkout.
- Confirmar que tarifa de empresa activa alimenta el delivery.
- Confirmar que si se desafilia la empresa, el checkout deja de usar esa tarifa.

Admin:

- Entrar a `/admin/transporte`.
- Activar/pausar empresa.
- Filtrar por comercio.
- Ver conexiones.
- Usar "Desafiliar ahora".
- Confirmar que se limpia el proveedor del checkout si era activo.

## 12. Veredicto

LISTO CON RIESGOS CONTROLADOS.

El modulo ya puede venderse y operarse como piloto real, siempre que se aplique la migracion nueva, se pruebe el flujo completo con Smash/Entrega2 o un comercio demo, y se mantenga una supervision manual fuerte durante las primeras semanas.
