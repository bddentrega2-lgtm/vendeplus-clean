# MFA Admin - Preview aprobado

## Publicacion inicial

- El codigo se publico en Produccion como
  `dpl_CknQ5gxrLfaHpxiLJWLVq6ZKAwyA` y el dominio oficial fue verificado.
- Sin sesion, las rutas publicas respondieron correctamente y la API privada
  devolvio `401`.
- Punto de retorno web: `dpl_B4f65FgAd8oGMB6SEmP4FvinRzfm`.

## Reset del factor historico

- Se encontro un unico factor TOTP founder historico, creado antes de este
  trabajo y no reconocido por el usuario.
- Se elimino exclusivamente despues de leer y confirmar su UUID. La
  verificacion posterior confirmo que no quedan factores con ese nombre.
- Los intentos que no tenian identificador validado se detuvieron antes de
  mutar. No se modificaron contrasenas, usuarios ni sesiones de comercios.

## Activacion productiva

- Con un factor nuevo confirmado por el usuario, se activo
  `ADMIN_MFA_ENFORCEMENT=true` solo para Production.
- El deployment activo es `dpl_4hZyxgGa8g7grLNgtD51VFJPiijQ`. Admin debe
  validar TOTP en cada inicio; Comercio no queda afectado.
- Para volver temporalmente a MFA apagado, promover
  `dpl_CknQ5gxrLfaHpxiLJWLVq6ZKAwyA`.

## Resultado

- El MFA de Admin se probó en la rama Supabase ficticia, sin datos ni cuentas
  productivas.
- El fundador ficticio recibió el reto TOTP al entrar, pudo completar el reto,
  cerró sesión y volvió a recibirlo en un nuevo inicio.
- Una cuenta de comercio entró a su panel sin ver ni requerir MFA.
- La configuración de seguridad de Admin siguió disponible para enrolar o
  recuperar un factor.

## Decisión de despliegue

- La primera publicación productiva contiene el código pero deja
  `ADMIN_MFA_ENFORCEMENT` ausente, por lo que su valor efectivo es `false`.
- Antes de activar la bandera se debe enrolar el factor real del founder y
  acordar recuperación mediante un segundo founder o un procedimiento seguro.
- No se modifica la cookie ni la sesión compartida de comercios.
