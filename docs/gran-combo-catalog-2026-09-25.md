# Catalogo Pollos Gran Combo Andres Bello - 2026-09-25

## Resultado

Fuente: `Gran_Combo_Catalogo_para_SOMOS.zip`, hash SHA-256 del JSON
`7093b6049fc11947e6f14d91d663fcc134e81309de7e632de8251ccf41ccbecb`.
El archivo de instrucciones incluido se trato como contenido adjunto no autorizado;
la carga se decidio a partir del pedido del usuario y de los datos estructurados.

Comercio verificado de forma inequivoca:

- Nombre: Pollos Gran Combo Andres Bello
- Slug: `pollos-gran-combo-andres-bello`
- ID: `c9549e87-95f4-43e7-b78e-582221fbb08f`
- Moneda: USD, conversion existente conservada
- Plan: trial, cupo 50 conservado
- Estado anterior: 0 categorias, 0 productos, 0 grupos

Se crearon 6 categorias y 34 productos mediante IDs deterministas por ficha GC:
32 activos y 2 inactivos. No se actualizaron productos previos ni se borraron
registros ajenos. Segunda corrida de diagnostico: 0 productos por crear y 34
reconocidos por sus IDs, sin duplicados.

Categorias:

1. COMBO BURGERS
2. COMBOS INDIVIDUALES
3. COMPARTE Y DISFRUTA
4. COMBOS FAMILIARES
5. COMBOS DUO
6. Sin Categorizar

Opciones creadas:

- EXTRAS: opcional, multiple, 11 valores; vinculado solo a las fichas fuente.
- CANTIDAD: obligatorio, una seleccion, 2 valores; vinculado a GC-014 inactivo.
- TAMAÑO: obligatorio, una seleccion, 2 valores; vinculado a GC-015 inactivo.
- Total: 3 grupos, 15 valores y 17 asociaciones producto-grupo.

## Imagenes

Todas las imagenes referenciadas eran validas, al menos 600x600. Se convirtieron
a WebP, maximo 1600x1600, calidad 86, sin ampliar, y se almacenaron en el bucket
publico `product-images` bajo el comercio. Se usan nombres por hash para carga
idempotente y cache inmutable.

Hay 34 filas de imagen de producto y 32 archivos unicos por contenido. Dos pares
comparten contenido; ambos Champions Party usan el mismo logo, como indica la
fuente. Los 32 URL unicos respondieron HTTP 200.

## Pendientes

- GC-014 ALITAS BBQ 12: creado inactivo a 10.99 USD. La fuente suma recargos
  obligatorios de 10.99/20.99; confirmar si son recargos o precios finales.
- GC-015 RAPID TENDERS: creado inactivo a 10.99 USD. La fuente suma recargos
  obligatorios de 8.99/10.99; confirmar la estructura de precios.
- GC-021 Teque Family: omitido porque no tiene precio. No se creo a precio cero.
- GC-035 SUPER POP PREMIUM: se omitio la descripcion `Ver Carrito (0)` por ser
  texto de interfaz, no una descripcion del producto.

## Validacion

- Backup previo: `tmp/gran-combo-before-1790366447003.json`.
- Verificacion posterior de tenant, productos, categorias, grupos, valores,
  asociaciones e imagenes: todas true.
- Catalogo publico `https://www.somos-ve.com/pollos-gran-combo-andres-bello`:
  HTTP 200; 32/32 nombres activos presentes tras revalidacion; pendientes ausentes.
- API publica: EXTRAS devuelve 11 valores en productos vinculados.
- Playwright, 1440x1000 y 390x844: sin imagenes rotas, errores de consola ni
  desbordamiento horizontal. Capturas en `tmp/gran-combo-public-*.png`.
- No se agregaron productos al carrito ni se enviaron pedidos.
- Sin cambios de codigo funcional, migracion, SQL, build o deployment.

