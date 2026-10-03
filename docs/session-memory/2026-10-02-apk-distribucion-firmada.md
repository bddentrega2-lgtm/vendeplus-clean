# 2026-10-02 - APK firmada para distribucion manual

## Objetivo

- Preparar candidata estable de SOMOS, APK instalable en telefonos y tablets y AAB para futuro Play. Usuario aun no tiene Play Console.

## Decisiones

- Publicar ajustes web aprobados con rollback preparado, sin cambiar pedidos ni datos de comercios.
- APK release 1.5.1/code15, com.somosve.app, origen oficial HTTPS; sin dependencia de PC/Preview.
- Firma propia RSA3072 fuera de repositorio, credencial cifrada DPAPI. La clave no puede regenerarse para cada release.
- Antes de Play, respaldar firma de forma portable y usar la misma clave de aplicacion para permitir actualizar instalaciones manuales; separar clave de subida.
- A34 debug requiere migracion planificada; no desinstalarlo ni interrumpir impresion existente.

## Aprendizajes

- APK que compila no equivale a APK distribuible: verificar firma, origen, debuggable, identidad, SDK, hardware opcional y librerias nativas.
- Bluetooth/location deben ser features opcionales para no excluir tablets ni consumidores sin impresora.
- ZIP y ELF LOAD alineados a 16 KB no bastan: tambien revisar GNU_RELRO. Se encontro un problema real en una dependencia indirecta de Firebase.
- Comparar los segmentos del AAR oficial antes de actualizar evita cambios de dependencias sin evidencia. DataStore 1.2.1 corrige los segmentos observados en 1.1.7.
- Pruebas web con puente nativo simulado no sustituyen instalar la APK release en equipos reales.

## Errores y causas

- Verificador inicial rechazo Bluetooth obligatorio; corregido explicitamente en manifest.
- Segundo rechazo: libdatastore_shared_counter.so de 1.1.7 tenia fin RELRO modulo16384=8192 en arm64 y x86_64. Version1.2.1 oficial da cero, constraint de datastore-preferences actualiza la familia transitiva sin tocar Firebase completo.
- Configuracion del sidebar web desbordaba8px en320px; min-w-0 y overflow-wrap:anywhere resolvieron, probado tambien en tablet/app simulada.
- Custodia DPAPI protege en Windows pero no es respaldo recuperable en otra PC; pendiente entrega segura al titular, nunca chat/logs/Git.

## Validacion

- npm.cmd run build PASS/255paginas; contratos86/86; suite movil49/49; Play actualizado7/7; E2E movil15escenarios; checkout5/5; pedidos9viewports+marketplaceweb/app; ESLint focal/diff-check PASS.
- Produccion dpl_2nGTVDLjrBh2S8BKERRqvbCtYW7n; rollback dpl_2CeaapfxUjTEVjmR8CeMo1jRDcJC. Smoke publico200, panel307, API privada401.
- Build Android final6m43s PASS: lint, unit tests, APK y AAB. Verifier final PASS: APK4671120bytes, firma propia, ZIP/ELF LOAD/RELRO16KB correctos. No hay dispositivo conectado ni emulador.
- Sin migracion ni SQL. Nuevos scripts de firma/verificacion y guia de distribucion; privados y binarios fuera de Git.

## Estado final

- APK publicada: https://rvmtjtuztewcrmodrodb.supabase.co/storage/v1/object/public/app-releases/android/1.5.1/somos-1.5.1-android.apk?download=somos-1.5.1-android.apk . SHA256 858845925B22CA29B5F4FE598168F0D3967C960968F8003A327498B74C762498, verificado tambien tras descarga. Bucket publico con escritura anonima rechazada por RLS. Ruta inmutable.
- APK no depurable y sin archivos privados. AAB generado pero validacion bundletool/Play pendiente; jarsigner verifico firma y emitio avisos de certificado autofirmado/orden de manifiesto. No confundir APK validada con AAB aceptado por Play.
- Servidor local de QA cerrado; procesos de build/publicacion terminados. Guia de instalacion y riesgos en docs/android-1.5.1-distribucion-manual.md.
- Posteriormente el usuario autorizo asegurar el conjunto en Git: checkpoint `chore: checkpoint production printing and Android 1.5.1 release`, rama checkpoint/somos-mobile-production-20260930. Revalidacion102/102 PASS, revision de archivos sensibles sin hallazgos. No cambia produccion. Consultar git log/remote para hash confirmado. No publicar en Play sin cuenta, datos legales, Data Safety y pruebas correspondientes.
- Siguiente exacto: usuario instala desde enlace en otro telefono/tablet, prueba consumidor/comercio/pedido Smash/impresion; luego migrar A34 de debug a release con cuidado, respaldar firma de manera portable y preparar Play Console/titular/contactos.
