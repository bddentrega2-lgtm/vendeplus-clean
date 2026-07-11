# Piloto 3 Comercios - Checklist Operativo

Fecha de preparacion: 2026-07-06  
Alcance: beta controlada con 3 comercios reales, 20 a 30 pedidos diarios por comercio.

## Antes de iniciar

- Verificar que el ultimo deploy de Vercel este en estado `Ready`.
- Abrir `https://vendeplus-clean.vercel.app` y confirmar que la home carga.
- Confirmar que Supabase apunta al proyecto correcto: `rvmtjtuztewcrmodrodb`.
- Ejecutar o revisar `supabase/production_readiness_checks.sql` si hay dudas de esquema.
- Confirmar variables de produccion en Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `FOUNDER_EMAILS`
  - `CRON_SECRET`
- Mantener Entrega2 apagado si no estan listas sus credenciales reales.
- Confirmar que cada comercio esta activo.
- Confirmar que cada comercio tiene usuario asignado.
- Confirmar que cada comercio tiene productos activos con foto, precio y disponibilidad.
- Confirmar que productos con extras obligatorios no se pueden agregar sin seleccionar opcion.
- Confirmar metodos de pago activos y datos visibles al cliente.
- Confirmar tasa USD/EUR a Bs y si el comercio muestra Bs.
- Configurar delivery segun el comercio:
  - zonas activas con precio,
  - rangos por km activos,
  - tarifa fija,
  - solo retiro,
  - o cotizar por WhatsApp.
- Probar un pedido real por comercio antes de abrir ventas.
- Confirmar que WhatsApp abre con el mensaje completo.
- Confirmar que el pedido aparece en `/panel/pedidos`.
- Confirmar que el comercio puede marcar o revisar pago.
- Confirmar que el carrito queda vacio luego de enviar pedido.
- Confirmar que el cliente puede volver a catalogo sin conservar el pedido anterior en carrito.

## Durante el piloto

- Revisar pedidos entrantes cada 30 a 60 minutos.
- Revisar si algun cliente reporta que no puede seleccionar delivery/retiro.
- Revisar que el total del checkout coincida con WhatsApp y panel.
- Revisar pagos en estado pendiente o en revision.
- Revisar errores de delivery por zona, distancia o direccion.
- Pedir al comercio capturas de cualquier pantalla confusa.
- Registrar bugs con:
  - comercio,
  - hora,
  - celular usado,
  - link abierto,
  - producto,
  - modalidad de entrega,
  - metodo de pago,
  - captura.
- No cambiar configuraciones criticas en horas pico salvo que bloquee ventas.

## Despues del primer dia

- Contar pedidos totales por comercio.
- Contar pedidos fallidos o abandonados reportados.
- Revisar pedidos duplicados.
- Revisar diferencias entre total checkout, WhatsApp y panel.
- Revisar problemas de delivery:
  - zona no visible,
  - km no calculado,
  - direccion incompleta,
  - tarifa incorrecta.
- Revisar problemas de pago:
  - datos faltantes,
  - referencias confusas,
  - pagos no verificables.
- Revisar feedback del comercio:
  - que fue facil,
  - que fue lento,
  - que no entendieron,
  - que les genero miedo operativo.
- Priorizar solo bugs que afecten ventas, pedidos, pagos, delivery o acceso.

## Prueba minima por comercio

1. Abrir catalogo publico en celular.
2. Agregar producto simple.
3. Agregar producto con extras si existe.
4. Ir a carrito.
5. Ir a checkout.
6. Probar Delivery.
7. Probar Retiro si esta activo.
8. Probar metodo de pago principal.
9. Enviar pedido.
10. Confirmar WhatsApp.
11. Confirmar pedido en panel.
12. Confirmar pago en panel.
13. Confirmar carrito vacio.

