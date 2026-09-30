# Publicacion Somos 1.3.2 - 2026-09-29

## Autorizacion y resultado

Usuario aprobo la revision manual con "revise todo ok" y autorizo pasar el
Preview a produccion respondiendo "procede" a la pregunta explicita.
No autoriza commit, push, nueva APK ni publicacion en Play Store.

Produccion final READY:
- https://www.somos-ve.com
- https://somos-ve.com
- Deployment dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1.
- URL inmutable https://vendeplus-clean-57i0zs2kn-entrega2-s-projects.vercel.app.

Se verificaron ambos dominios con inspect y el sitio www con navegador.
El candidato aprobado fue dpl_9dRv22Ui3nSRFkjYtKJGSmPNp636 (Preview9f7uno4fk).
Comparacion de fuentes via API Vercel: 559 archivos en cada uno, cero diferencias.
Comparacion con produccion anterior: 54 archivos distintos, cero migraciones.
No se uso la raiz mezclada; trabajo exclusivo desde .fee-billing-prod.

## Incidencia de compilacion y recuperacion

1. Promote del Preview genero dpl_E15k78J8hcnWUWs7wVsVNwL5Nx2m con entorno
   production. Build PASS244 y fuentes identicas, pero la revision visual
   detecto CSS base nativo ausente en el resultado compilado: Mis datos sin
   padding ni estructura esperada. No confundir igualdad de fuentes con
   equivalencia del artefacto compilado.
2. Se restauro produccion anterior dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi mediante
   rollback. Se confirmo el dominio apuntando al anterior. El despliegue
   defectuoso NO es candidato de reversion.
3. Se reconstruyo con `vercel deploy --prod --force --skip-domain --yes`
   desde el worktree correcto. Logs confirman Skipping build cache. Resultado
   dpl_GPkUBRjbfD2Fv6Dk7W5sdXAMjUj1. Sin cambios funcionales ni de configuracion.
4. Candidato staged conservaba proteccion Vercel. La prueba anonima cloud
   encontro login Vercel y se detuvo; NO se reporta como prueba funcional PASS.
   Intento de excepcion por deployment fue rechazado400 para production;
   no se desactivo proteccion global. Verificacion autorizada con credencial
   de automatizacion existente, solo en memoria y solo al origen exacto.
   No se guardo en archivos, URLs ni APK ni se imprimio.
5. CSS reconstruido coincide en nombres de chunks con Preview aprobado:
   3sc22mgbpsd7x.css y 33n8ngil3q_t7.css. Comprobado padding20px en perfil,
   navegacion fixed, cedula y Agregar ubicacion. Captura inspeccionada y
   cinco APIs privadas401 antes de asignar dominios.
6. Promote del candidato ya production asigno dominios sin otro rebuild.
   Verificacion final sin credenciales en www PASS. El build con cache omitio
   estilos que el build limpio recupero: indicio de cache de compilacion
   obsoleta, sin investigacion interna adicional del compilador.

## Validaciones finales

- Build Vercel limpio ejecuta npm run build: PASS, TypeScript y 244 paginas.
  npm.cmd run build local anterior PASS244; no repetido en esta publicacion
  porque no hubo cambios de codigo y se verifico identidad de fuentes.
- GET200: /, /marketplace, /smash, /smash/carrito, /smash/checkout, /panel/login.
- Formulario de acceso visible; no se enviaron credenciales ni se simulo login real.
- GET401 anonimo: /api/panel/context, /api/panel/orders, /api/panel/products,
  /api/panel/printing/settings, /api/admin/stores.
- Web390/1366: imagenes visibles cargadas, sin desborde horizontal y sin
  navegacion exclusiva Android en web. Capturas finales revisadas.
- Emulacion nativa sobre dominio oficial: perfil con cedula/ubicacion, estilos
  correctos (padding20px, barra fixed), sin errores React en recorridos finales.
- Resultados finales: tmp/production-1.3.2/final/results.json y capturas.
  Carpeta superior tambien contiene capturas diagnosticas del intento fallido;
  no usarlas como resultado final.
- Vercel logs nivel error, ultimos10m del deployment final: sin resultados.
- Navegador integrado iab no disponible; usado Playwright existente del repo.
- Pruebas de navegador bloquearon escrituras. Sin pedidos, pagos, despachos,
  cambios de base de datos, migraciones ni SQL. No prueba fisica nueva.

## Cambios de archivos de esta publicacion

Solo documentacion: este informe, SESSION_HANDOFF.md,
docs/mobile-profile-controls-2026-09-29.md y docs/release-acceptance-2026-09-29.md.
No codigo nuevo, commit ni push. Cambios previos aprobados descritos en el informe
mobile-profile-controls y production-readiness; este registro prevalece sobre
sus estados historicos de "no publicado".

## Reversion y siguiente paso

Anterior conservado: dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi,
https://vendeplus-clean-ptyksvenf-entrega2-s-projects.vercel.app.
En una regresion confirmada, rollback a ese ID desde el proyecto correcto.
Reversion de deployment no revierte pedidos ni datos de Supabase.

APK11/1.3.2 del A34 sigue apuntando a Preview9f7uno4fk; no se reinstalo ni se
cambio su configuracion. La app sigue privada. Preparar APK oficial hacia
www.somos-ve.com es un paso separado; contemplar login/datos locales por origen.
No se publico en Play Store ni se considera lista para ello por este despliegue.

Siguiente comprobacion humana: abrir web oficial, revisar catalogo y entrar al
panel habitual; reportar cualquier diferencia con Preview. Sonido/impresion
continuan con validacion humana previa, sin afirmar una prueba nueva en produccion.
Pendientes V2: Firebase/segundo plano, mapa/logos de comercios, calificaciones,
historial autenticado y preparacion de distribucion Android oficial.
