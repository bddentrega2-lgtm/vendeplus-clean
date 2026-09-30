# Somos Android 1.2.0: pulido visual

## Alcance autorizado

Punto 1 de la propuesta: calidad visual desde la entrada, Marketplace, catalogo,
pedidos, productos y navegacion. Candidato Preview; no publicacion productiva.

## Diagnostico y cambios

- La cabecera duplicaba marca y navegacion. Ahora hay una sola cabecera clara,
  con logo, acceso al negocio y retorno contextual.
- Inicio reservaba demasiado alto antes de mostrar productos. Ciudad, buscador
  y categorias ahora son compactos, con controles tactiles de al menos 44px.
- Las tarjetas usan fotografias reales, nombres en dos lineas, precios alineados,
  bordes de 8px y sombras contenidas.
- Acceso del comercio sin tarjeta flotante: marca, formulario, campos de 16px,
  autocompletado, envio con Enter y errores anunciados. Mismos servicios Auth.
- El catalogo muestra la foto de portada sin oscurecerla, identidad debajo,
  acciones compactas y categorias fijadas debajo de la cabecera nativa.
- Los destacados del catalogo permiten ver foto, nombre, precio y accion juntos.
- Productos elimina titulos repetidos y texto introductorio; agrupa cantidad,
  crear y actualizar. Conserva formulario cerrado y selector de vista.
- Pedidos destaca codigo y total; mantiene cliente, pago, estado y acciones.
- La campana pasa a la cabecera para no tapar acciones de los registros.
- Navegacion inferior con estado activo consistente y soporte de movimiento
  reducido, foco visible y controles sin desbordamiento horizontal.

## Archivos de esta entrega

- `src/app/native-polish.css`: estilos bajo `html.somos-native-app`.
- `src/app/layout.tsx`: importa la hoja nativa.
- `src/components/mobile/NativeExperience.tsx`: entrada y cabecera.
- `src/components/public/MarketplaceClient.tsx`: clases de presentacion.
- `src/components/public/CatalogClient.tsx`: herramientas y destacados.
- `src/components/public/StoreBrandHeader.tsx`: portada e identidad.
- `src/components/public/CategoryTabs.tsx`: estado seleccionado accesible.
- `src/components/public/ProductCard.tsx`: clases de presentacion del producto.
- `src/components/panel/LoginForm.tsx`: presentacion y semantica de formulario.
- `src/components/panel/PanelShell.tsx`: cabecera, sede y navegacion.
- `src/components/panel/ProductManager.tsx`: barra de acciones y vista.
- `src/components/panel/OrdersManager.tsx`: barra de acciones y registros.
- `mobile/somos-android/android/app/build.gradle`: versionCode7/1.2.0-design-preview.
- `scripts/mobile-polish.e2e.mjs`: comprobacion visual y funcional local.
- `SESSION_HANDOFF.md` y este documento: continuidad y resultados.

No se cambiaron APIs, precios, permisos, aislamiento de comercios ni Java de
impresion en esta entrega. Los cambios anteriores de comanda/ID siguen incluidos.
Sin migraciones ni SQL. Sin commit ni push.

## Validacion

- `npm.cmd run build`, ejecutado por `node scripts/mobile-local.mjs build`:
  PASS, TypeScript y 244 paginas. Entorno privado solo en memoria.
- Build Vercel: PASS, 244 paginas.
- Contratos criticos: 80/80 PASS.
- Regresion Etapa 1 sobre build compilado: 16/16 PASS.
- QA visual: 16 capturas/casos en 320, 390 y 768px; login, Marketplace,
  catalogo, productos, crear producto, pedidos y menu. Sin overflow ni errores
  React. Capturas web adicionales 390/1366px conservan presentacion de navegador.
- E2E cloud sobre Preview final: 7/7 PASS.
- ESLint focal: PASS. Diff check: PASS, solo avisos CRLF preexistentes.
- Navegador integrado no disponible; usado Playwright local del proyecto.
- APIs privadas se simulan en QA visual; escrituras bloqueadas. No pedidos
  reales, cuentas reales ni cambios de datos creados por las pruebas.
- En desarrollo una prueba de restauracion de borrador fallo; el mismo caso
  paso en el build compilado. La restauracion preexistente debe revisarse
  separadamente bajo efectos duplicados de desarrollo si se sigue usando dev.

## Preview

- URL: https://vendeplus-clean-1sft3681b-entrega2-s-projects.vercel.app
- Deployment: `dpl_4S4GcSvsxP2fatAnAuzbxCErEwef`, Ready, Preview.
- Excepcion reversible solo para este deployment; sin secretos en el APK.
- Produccion verificada sigue `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`.
- Servidor local compilado: http://127.0.0.1:3107
- Capturas de referencia: `tmp/mobile-polish/`.
- La apariencia nueva se activa en Capacitor; abrir el enlace en un navegador
  normal conserva la experiencia web.
- Gradle: BUILD SUCCESSFUL, 73 tareas. APK
  `tmp/mobile-polish/somos-1.2.0-design-preview.apk`, 5.692.318 bytes,
  SHA256 `51ADA54567AAD48C4D466A1ACAB91743E23F26FEB73F6B2C3AD48EDF4FDF4C5C`.
- Instalacion `adb install --no-streaming -r`: Success en Samsung A34.
  `dumpsys` confirma versionCode7/versionName1.2.0-design-preview.
  APK inspeccionado: origen Preview exacto, cleartext false; configuracion
  generada restaurada al dominio oficial despues de guardar la copia.
- Captura A34 negra: no se considera validacion visual fisica. Pantallas
  verificadas mediante Playwright; usuario debe abrir y probar en el telefono.

## Prueba manual y siguiente etapa

Recorrer Inicio, ciudad, busqueda, catalogo, extras y carrito; entrar a Smash Test,
revisar Productos/Pedidos, abrir/cerrar formularios y menu, cambiar sede, probar
teclado y Atras. Crear pedidos solo de prueba en el comercio autorizado.
La Preview usa backend real: las operaciones manuales pueden modificar datos.

Pendiente comprobar nuevamente la comanda 1.1.4 en papel. V2 conserva como
pendientes push real, diagnostico, firma AAB, privacidad, revision de pagos y
pruebas cerradas de Google Play. Esta entrega no declara la app lista para Play.
