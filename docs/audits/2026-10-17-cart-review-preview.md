# Revision de carritos desactualizados - Preview

## Checkpoint productivo

- Commit `b5b8edfd1df8a0ab76f7bbb031e47ba0da266e90` publicado en `origin/feature/catalog-ux-20261015`.
- Etiqueta anotada remota `checkpoint/productos-rapidos-production-20261017` apunta al mismo commit. Los checkpoints anteriores permanecen.
- Produccion permanece READY en `dpl_GY6a7UvDj8unt2LWCcFc6t56jb13`; verificado al terminar. No se desplegaron los cambios nuevos en produccion.

## Implementacion

- Revision publica de solo lectura `POST /api/catalog/cart-review`: comercio activo, suscripcion vigente, limites de cuerpo/items, limite por IP y sin cache HTTP. Productos y grupos filtrados por comercio; variantes solo de productos del comercio consultado.
- Normalizacion y precios/opciones compartidos con POST orders. Productos ausentes/ocultos no se sustituyen; variantes y opciones retiradas requieren seleccion nueva; diferencias de precio devuelven propuesta para aceptar expresamente.
- POST orders responde 409/CART_CHANGED antes de crear el pedido si la comprobacion final detecta cambios. Se mantienen la validacion de mesa, modalidad, pagos, cotizacion firmada, inventario atomico e idempotencia existentes.
- Se conserva cantidad repetida de extras, tanto si llega expandida como agrupada. Un grupo eliminado ya no se descarta silenciosamente.
- El carrito conserva actualizacion local inmediata, sin consulta remota al agregar o cambiar cantidad. La revision con avisos, quitar producto y aceptar precio se realiza al entrar a checkout. El servidor vuelve a comprobar antes de crear el pedido. Control de respuestas atrasadas y comparacion de snapshot antes de aplicar una accion; reintento tras fallo sin vaciar el carrito.
- Nombre, telefono, notas y campos permitidos del borrador se conservan en sessionStorage web, por comercio y durante 24 horas; app mantiene almacenamiento nativo existente. No se persisten comprobante, credenciales ni coordenadas en ese borrador. Confirmacion limpia el borrador.
- Volver desde un aviso carga el catalogo con revisar=carrito y solicita opciones frescas. El cache habitual sigue en el recorrido normal.

## Evidencias

- `node --test scripts/cart-review.behavior.test.cjs scripts/basic-inventory.behavior.test.mjs`: 30/30 PASS. Incluye contrato de carrito inmediato y revision solo en checkout; casos de producto eliminado, oculto, ajeno, precio mayor/menor/descuento, variantes y opciones retiradas, extras repetidos y rechazo final antes de persistir en delivery/retiro/mesa/barra.
- ESLint focal de 12 archivos: PASS.
- Suite critica: 86/89. Tres fallos ajenos a este ajuste en contratos antiguos de WhatsApp oficial, cambio de clave y clasificacion de rutas de referidos. La nueva ruta publica tiene contrato y no agrega un hallazgo. Se actualizaron dos comprobaciones de fuente que referenciaban validacion ahora compartida; pruebas de comportamiento independientes verifican cantidades e inventario.
- `npm.cmd run build` local: FAIL por junction node_modules/Turbopack preexistente. tsc local solo reporta dependencias preexistentes faltantes de markercluster/google-auth-library. Dev local se detuvo por esas dependencias.
- Preview actual Vercel `dpl_7yaVS8zFoJAEJ9rb2YxjffWCS5uM`: READY, Next 16.3.8, TypeScript y build PASS, 265 paginas. URL base: https://vendeplus-clean-916cdw6jc-entrega2-s-projects.vercel.app . Enlace compartible temporal de 48 horas entregado por chat; no registrar su token en Git.
- Smoke movil del Preview (390x844, Smash Test): carrito con producto guardado abre con 0 solicitudes a `cart-review`; subir cantidad 1 a 2 mantiene 0 solicitudes; al entrar a checkout se hace 1 solicitud y no hay error. No se envio pedido.
- Navegador integrado no disponible; QA con Edge/Playwright headless. Caso real de identificador historico Joshi reproducido solo en carrito local de QA, sin crear pedidos. Producto actual con precio viejo requiere aceptar; quitar una fila conserva las otras. Error de red bloquea y permite reintentar. Producto ajeno devuelve solo indisponibilidad sin revelar datos del otro comercio. Limite de 81 items devuelve 400.
- Nombre/telefono/notas se preservan al volver del catalogo. Respuesta atrasada de una revision descartada despues de modificar el carrito (cantidad 3 conservada). Opciones con refresh devuelven Cache-Control no-store.
- Sin overflow a 320, 390 y 1440 px; sin errores JS del Preview. Capturas locales `tmp/cart-review-qa/mobile-320.png` y `desktop-1440.png`.
- POST /api/orders interceptado/bloqueado en el navegador de QA para impedir pedidos reales. No se validaron entregas fisicas, WhatsApp o impresiones con un pedido nuevo.

## Prueba del usuario y pendientes

En el Preview, agregar varios productos y cambiar cantidades en carrito: no debe verse espera de revision. Con un producto de Smash Test, abrir carrito y cambiar su precio u ocultarlo desde el panel: el aviso debe aparecer al entrar a Finalizar pedido, no en el carrito. Aceptar precio o quitar solo esa fila; probar opcion retirada y volver al catalogo. Escribir datos en checkout y regresar para verificar conservacion. Las mutaciones del panel en este Preview usan la base real: solo modificar productos de prueba.

Sin migraciones ni SQL. Pendiente validacion humana antes de autorizar pase productivo. Nuevos cambios sin commit; el checkpoint guardado corresponde exclusivamente al codigo ya publicado. V2: revision previa detallada de stock/SKU y edicion directa de opciones dentro del carrito; inventario sigue validado al crear la orden.
