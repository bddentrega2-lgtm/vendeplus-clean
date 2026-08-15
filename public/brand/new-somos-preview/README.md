# Assets temporales del nuevo branding de Somos

Carpeta local de previsualizacion. Estos archivos no estan conectados todavia con componentes, metadata, favicon, manifest ni rutas de la web.

## Paleta usada para la previsualizacion

- Naranja: `#F27533`
- Ambar: `#F5A220`
- Blanco calido: `#F4F4F4`
- Verde petroleo: `#1F464C`
- Azul marino profundo: `#042332`

La presentacion original contiene codigos escritos que no coinciden con los colores renderizados. Esta carpeta usa los colores medidos visualmente en los assets. No debe tomarse como confirmacion definitiva de la paleta para CSS.

## Inventario generado

| Archivo | Fuente original | Peso | Dimensiones | Transparencia | Uso recomendado |
| --- | --- | ---: | ---: | --- | --- |
| `somos-logo-preview.png` | `Versiones logo/Horizontal/Logotipo-01.png` | 7.637 bytes | 1117 x 172 | Si | Logo principal horizontal para fondos claros |
| `somos-isotipo-preview.png` | `Versiones logo/Icono/icono-01.png` | 14.474 bytes | 512 x 452 | Si | Isotipo principal; fuente para iconos temporales |
| `somos-logo-white-preview.png` | `PNG sin fondo/Logotipo-10.png` | 7.427 bytes | 1117 x 172 | Si | Logo sobre fondos oscuros o fotografias |
| `somos-isotipo-white-preview.png` | `PNG sin fondo/icono-10.png` | 12.492 bytes | 512 x 452 | Si | Isotipo sobre fondos oscuros |
| `somos-logo-black-preview.png` | `PNG sin fondo/Logotipo-11.png` | 7.376 bytes | 1117 x 172 | Si | Logo monocromatico para fondos claros o impresion |
| `somos-isotipo-black-preview.png` | `PNG sin fondo/icono-11.png` | 12.523 bytes | 512 x 452 | Si | Isotipo monocromatico para fondos claros |
| `favicon-preview-32.png` | Generado desde `somos-isotipo-preview.png` | 960 bytes | 32 x 32 | No | Favicon con fondo blanco e isotipo centrado |
| `apple-touch-icon-preview.png` | Generado desde `somos-isotipo-preview.png` | 4.648 bytes | 180 x 180 | No | Icono Apple con fondo blanco e isotipo centrado |
| `somos-icon-preview-192.png` | Generado desde `somos-isotipo-preview.png` | 5.022 bytes | 192 x 192 | No | Icono PWA con fondo blanco e isotipo centrado |
| `somos-icon-preview-512.png` | Generado desde `somos-isotipo-preview.png` | 19.445 bytes | 512 x 512 | No | Icono PWA con fondo blanco e isotipo centrado |
| `somos-icon-preview-maskable-512.png` | Generado desde `somos-isotipo-preview.png` | 13.645 bytes | 512 x 512 | No | Icono maskable blanco con margen de seguridad ampliado |

## Procesamiento aplicado

- Recorte del espacio vacio de los lienzos originales de 2250 x 2250 px.
- Conservacion de transparencia en logos e isotipos.
- Redimensionado Lanczos sin ampliar los originales.
- Compresion PNG sin perdida y paleta optimizada.
- Limpieza de pixeles residuales encontrados en las variantes blancas transparentes.
- Fondo blanco puro `#FFFFFF`, isotipo centrado y margen de seguridad en los iconos Apple/PWA.

## Advertencias

- Los archivos principales a color son provisionales: la entrega no incluye una exportacion transparente del logo a color. Se elimino de forma controlada el fondo uniforme `#EAEAEA` de la variante 01 y se reconstruyeron sus bordes con los colores medidos `#F27533` y `#1F464C`.
- Los archivos blancos y negros provienen de los PNG transparentes oficiales, pero siguen siendo raster.
- Antes de considerarlos definitivos conviene solicitar al disenador SVG transparentes oficiales del logotipo y del isotipo, tanto a color como monocromaticos.
- Debe confirmarse la paleta oficial debido a la contradiccion de codigos en la presentacion.
- El favicon de 32 px necesita aprobacion visual a tamano real.
- El icono maskable debe probarse en las mascaras circular, squircle y redondeada antes de conectarlo al manifest.
- No se incluyeron archivos AI, presentacion, mockups, fotografias ni tipografias OTF.
