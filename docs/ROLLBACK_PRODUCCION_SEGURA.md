# Rollback de producción segura

Este documento guarda el punto estable restaurado de producción para volver rápido en caso de emergencia.

## Punto seguro actual

- Fecha estable: 18 de julio de 2026, 10:20 pm hora Venezuela.
- Proyecto Vercel: `vendeplus-clean`.
- Deployment ID: `dpl_6ddee3QzcENqXdhZ2hprgMAoaj4p`.
- Deployment URL: `https://vendeplus-clean-9mh46yrk4-entrega2-s-projects.vercel.app`.
- Producción: `https://www.somos-ve.com`.
- Estado esperado: `Ready`.
- Señal de build esperado: paquete grande con `623 output items hidden` en `vercel inspect`.

## Comando de emergencia

Ejecutar desde la raíz del proyecto:

```powershell
npx.cmd vercel promote https://vendeplus-clean-9mh46yrk4-entrega2-s-projects.vercel.app --yes
```

## Verificación rápida después del rollback

```powershell
npx.cmd vercel inspect https://www.somos-ve.com
curl.exe -s -I "https://www.somos-ve.com/marketplace"
curl.exe -s -I "https://www.somos-ve.com/transporte"
curl.exe -s -I "https://www.somos-ve.com/admin/usuarios"
npx.cmd vercel logs https://www.somos-ve.com --since 1h --level error
```

## Resultados esperados

- `vercel inspect https://www.somos-ve.com` debe mostrar:
  - `id`: `dpl_6ddee3QzcENqXdhZ2hprgMAoaj4p`
  - `url`: `https://vendeplus-clean-9mh46yrk4-entrega2-s-projects.vercel.app`
  - `status`: `Ready`
- `/marketplace` debe responder `200`.
- `/transporte` debe responder `200`.
- `/admin/usuarios` debe responder `200`.
- Los logs de error recientes deben salir sin errores relevantes.

## Regla antes de cualquier nuevo deploy

Antes de desplegar de nuevo a producción:

1. Confirmar la rama local con `git branch --show-current`.
2. Confirmar cambios exactos con `git status --short` y `git diff --name-only`.
3. Ejecutar `npm.cmd run build`.
4. Verificar que el build conserva las rutas críticas:
   - `/marketplace`
   - `/transporte`
   - `/admin/usuarios`
   - `/panel/suscripcion`
5. Si el deploy sale mal, promover inmediatamente el deployment seguro de este documento.

