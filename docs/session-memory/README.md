# Memoria de sesiones

Esta carpeta conserva lo aprendido durante cada sesion importante de trabajo.
Complementa a `SESSION_HANDOFF.md`: el handoff indica donde esta el proyecto ahora;
estas memorias explican decisiones, errores, causas y patrones que conviene recordar.

## Uso

1. Al iniciar, leer `SESSION_HANDOFF.md` y el archivo mas reciente de esta carpeta.
2. Durante la sesion, anotar solo hechos comprobados y decisiones aceptadas.
3. Al cerrar, crear o actualizar `YYYY-MM-DD-tema.md`.
4. Si dos sesiones comparten fecha, usar temas distintos y descriptivos.
5. Cuando una conclusion quede obsoleta, marcarla como reemplazada; no borrar el contexto historico.

## Guardar

- Objetivo y alcance de la sesion.
- Decisiones del usuario y razones tecnicas.
- Diagnosticos confirmados y causa raiz.
- Errores encontrados, intentos fallidos y solucion aplicada.
- Pruebas ejecutadas y su resultado.
- Commit, despliegue, rollback, migracion o SQL cuando existan.
- Estado final, riesgos y siguiente paso exacto.

## No guardar

- Contrasenas, tokens, OTP, claves API o secretos de Supabase, Firebase, Vercel o firma Android.
- Datos bancarios, comprobantes, telefonos, correos o identificadores personales innecesarios.
- Suposiciones presentadas como hechos.
- Copias extensas de logs; guardar solo el diagnostico util.

Usar `TEMPLATE.md` para mantener una estructura consistente.
