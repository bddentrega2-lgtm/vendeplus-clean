# Respaldo de Produccion Somos - 2026-07-20

Este es el punto de retorno aprobado luego de validar el panel de comercios.

## Estado

- Fecha: 2026-07-20
- Hora aproximada: 19:34 America/Caracas
- Proyecto Vercel: `entrega2-s-projects/vendeplus-clean`
- Dominio principal: `https://www.somos-ve.com`
- Deployment de produccion: `dpl_fLp6XDTQr1tbLqXMFcKC8Yu9ybEz`
- URL del deployment: `https://vendeplus-clean-fs436q72z-entrega2-s-projects.vercel.app`
- Estado: `Ready`

## Cambios validados en este punto

- Panel de comercios con barra lateral izquierda visible en desktop.
- `/panel`, `/panel/inicio` y `/panel/pedidos` usando el shell correcto.
- Navegacion movil del panel visible en telefono.
- Home sin publicar cambios de rediseno no aprobados.
- PWA usando nombre Somos, iconos `somos-icon-*` y service worker `somos-pwa-v2`.

## Rollback rapido

Si una version posterior falla, volver a este punto con:

```bash
npx.cmd vercel promote https://vendeplus-clean-fs436q72z-entrega2-s-projects.vercel.app --yes
```

Tambien se puede inspeccionar con:

```bash
npx.cmd vercel inspect https://vendeplus-clean-fs436q72z-entrega2-s-projects.vercel.app
```
