# Somos: inventario antes de produccion (2026-09-29)

## Decision y diagnostico

No se publico, promovio, hizo commit ni push durante esta revision. El usuario
pidio conocer pendientes y una recomendacion; no se interpreta como autorizacion
de despliegue. Publicar no reemplaza respaldar.

La produccion actual se desplego con cambios sin commit (`gitDirty=1`). Comparar
solo contra HEAD mezclaria novedades con funciones que ya estan publicadas.
Se compararon los hashes del arbol de fuentes real de ambos deployments Vercel:

- Produccion: `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`, dominio `www.somos-ve.com`.
- Preview: `dpl_2ThqxhG3VSi2VUGmLqAYs7GdQ3h8`,
  `https://vendeplus-clean-gwcs2ob9j-entrega2-s-projects.vercel.app`.
- Diferencias: 50 archivos, incluyendo pruebas/configuracion y un archivo
  generado `tsconfig.tsbuildinfo`. No son 50 funciones nuevas.
- Android no forma parte del despliegue Next.js; requiere su APK independiente.

## Pendiente de publicar

### Compartido entre web y app

- Botones Anadir/Cerrado compactos, titulos de producto y accion Editar con lapiz.
- Campana para pedidos pendientes y megafono separado para novedades.
- Cambios de login, revalidacion de sesion, seleccion de comercio y limpieza de
  cache privada. Parte de esta logica es compartida, no solo presentacion nativa.
- Ajustes del flujo de pedido, con protecciones de envio y recuperacion movil.
- Nuevos codigos `SO-MMDD-NNNNNN`; los pedidos historicos VP no se renombran.
- API de impresion con mas datos para la comanda: contacto, entrega, opciones,
  notas y pago. El formato nativo nuevo evita direccion/referencia duplicadas y
  elimina distancia, tarifa y estado de pago. El cambio de formato requiere la
  APK correspondiente; publicar la web no actualiza Java en APK anteriores.

### Exclusivo de la experiencia Android reciente

- Presentacion movil desde la entrada, navegacion comprador/comercio,
  recuperacion de carga, filtros y borrador.
- Seleccion de ciudad con GPS y alternativa manual.
- Acceso Promos con ofertas existentes.
- Una ubicacion frecuente local: guardar, reutilizar y eliminar. No es una
  cuenta de cliente ni sincronizacion entre dispositivos.
- Aviso nativo con sonido/vibracion, activacion y prueba desde la campana.
  Deteccion de pedidos solo con el panel visible, por consulta periodica.

### Ya estaba publicado

La impresion automatica, vinculacion y cola existentes, y las mejoras previas
de descubrimiento/imagenes del Marketplace. No confundirlas con los cambios
posteriores de comanda o las notificaciones de pedidos.

## Respaldo recuperable

Carpeta local:
`C:/Users/Windows/Desktop/RESPALDOS/SOMOS-checkpoints/20260929-app-1.3.0`.

- `source/` y `source.zip`: 663 archivos; copia y contenido del ZIP comprobados
  individualmente con SHA256.
- `git-base.bundle`: historial base de HEAD, verificado con Git. Los cambios sin
  commit se conservan en el archivo de fuentes, no en ese historial.
- APK exacta 1.3.0, versionCode 9, instalada en el A34; copia verificada SHA256:
  `642A6821F20ABB58F91CBE2BBD721F13BC4BE9FBAFC84E939CAFEE820CA5D450`.
- `manifest.json`: inventario y hashes; `production-vs-preview.json`: lista
  exacta de los 50 archivos distintos entre deployments.
- SHA256 ZIP:
  `43FED1A84A278494EE92064DB2DD24F4082A806342207CBE788BEE63437E970E`.

Se excluyeron archivos de entorno, claves de firma, dependencias y builds.
No incluye base de datos. Es una copia en la misma PC, no respaldo externo ante
perdida del disco. No sustituye conservar credenciales/firma de forma segura.
El informe presente y la anotacion posterior del handoff no forman parte del
checkpoint inmutable ya creado.

## Validaciones y limites

Ultima validacion de la app registrada: `npm.cmd run build`, mediante
`node scripts/mobile-local.mjs build` para cargar entorno privado en memoria,
PASS con 240 paginas y TypeScript; Vercel PASS. Contratos 80/80, nuevos unitarios
3/3, regresion Etapa 1, 29 casos/capturas moviles mas 6 web, y cloud 7/7 PASS.
Compilacion Android PASS. El usuario confirmo sonido audible de la segunda
notificacion nativa de prueba.

Esta revision no modifico codigo de la app ni repitio el build: agrego el script
de checkpoint y documentacion. El script se ejecuto satisfactoriamente y verifico
fuentes, ZIP e historial; el hash de la APK copiada se comprobo aparte.

Antes de publicar falta validar un pedido real controlado en Smash Test, su
comanda fisica nueva y el aviso automatico con el panel visible. Las pruebas
automaticas usaron pedidos simulados, no acreditan ese recorrido fisico completo.

## Recomendacion y siguiente paso

1. Con autorizacion expresa, guardar un commit revisado y subirlo a un remoto
   privado confirmado. No incluir secretos ni archivos ajenos del worktree raiz.
2. Preparar la entrega desde `.fee-billing-prod` y revisar su diferencia exacta
   contra produccion. No promover a ciegas ni copiar el directorio raiz mezclado.
3. Validar ingreso/salida, cambio de comercio, catalogo web movil/escritorio y
   pedido controlado con comanda y aviso. Probar precios activados/desactivados,
   direccion/referencia, extras y ausencia de impresiones duplicadas.
4. Con aprobacion de despliegue, promover el candidato validado en una ventana
   tranquila y comprobar nuevamente las rutas publicas y privadas. Conservar el
   deployment productivo anterior como opcion de reversion.
5. Mantener Android como piloto privado. La APK actual apunta al Preview fijo;
   publicar web no cambia ese origen. Preparar otra APK para el dominio oficial
   cuando corresponda, sin necesidad de publicar en Play Store. Cookies y datos
   locales dependen del origen; pueden requerir login y ubicacion guardada nuevos.

No se detectan migraciones nuevas entre estos deployments; no hay SQL pendiente
para este lote. Preview usa backend real: pedidos creados alli tambien son datos
reales. Revertir Vercel no revierte pedidos ni otros cambios de base de datos.

## V2 y Play Store

Pendientes: notificaciones con app cerrada/segundo plano (Firebase y flujo de
tokens/eventos), mapa con logos, historial autenticado y calificaciones de
comercios. Firma release/AAB, privacidad y validacion de distribucion siguen
siendo pasos separados. La APK actual es de piloto, no un lanzamiento Play Store.

## Archivos de esta revision

- `scripts/release-checkpoint.ps1`: crea copia nueva, compara deployments y
  verifica fuentes/ZIP/Git; IDs fijados al checkpoint de esta fecha.
- `docs/production-readiness-2026-09-29.md`: este inventario y recomendacion.
- `SESSION_HANDOFF.md`: continuidad y siguiente paso exacto.

Sin cambios de produccion, migraciones, SQL, configuracion Vercel ni variables.
