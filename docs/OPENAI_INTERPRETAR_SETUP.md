# Configurar OpenAI para Interpretar pedidos

Estado actual: pausado visualmente en el panel. La infraestructura existe, pero el bloque `Interpretar` de pedido manual esta oculto temporalmente mientras se diseña un modulo IA mas completo para creacion de catalogos.

Objetivo: hacer que el boton `Interpretar` use OpenAI en el servidor, sin exponer la clave al navegador.

## Variables necesarias

Obligatoria:

```txt
OPENAI_API_KEY=sk-...
```

Opcional:

```txt
OPENAI_ORDER_MODEL=gpt-5.4-mini
```

Si no defines `OPENAI_ORDER_MODEL`, VendeMas usara `gpt-5.4-mini` por defecto. Para maxima precision puedes usar `gpt-5.5`, pero primero conviene probar costo, velocidad y calidad con mensajes reales.

## Paso a paso para crear la API key

1. Entra a https://platform.openai.com/api-keys
2. Inicia sesion con tu cuenta de OpenAI.
3. Crea una key nueva.
4. Ponle un nombre claro, por ejemplo `vende-mas-production`.
5. Copia la clave una sola vez y guardala en un lugar seguro.
6. No la pegues en el chat, no la subas a GitHub y no la pongas en archivos publicos.

## Poner la key en Vercel

1. Entra a Vercel.
2. Abre el proyecto de VendeMas.
3. Ve a `Settings`.
4. Ve a `Environment Variables`.
5. Agrega:

```txt
Name: OPENAI_API_KEY
Value: tu clave de OpenAI
Environment: Production
```

6. Agrega opcionalmente:

```txt
Name: OPENAI_ORDER_MODEL
Value: gpt-5.4-mini
Environment: Production
```

7. Guarda los cambios.
8. Haz un redeploy de produccion para que Vercel cargue las variables nuevas.

## Probar cuando se reactive

1. Reactiva visualmente el bloque de interpretacion en pedido manual.
2. Entra al panel.
3. Abre `Pedidos`.
4. Abre `Pedido manual`.
5. Pega un mensaje real de WhatsApp.
6. Toca `Interpretar`.
7. En el resumen debe aparecer:
   - `Modo: IA`
   - `Modelo: gpt-5.4-mini` o el modelo configurado
   - `Confianza: X%`

Si aparece `Modo: Local`, VendeMas no pudo usar OpenAI. Las causas mas comunes son:

- `OPENAI_API_KEY` no esta en Vercel Production.
- No hiciste redeploy despues de agregar la variable.
- La key no tiene credito o permisos.
- El modelo configurado no esta disponible para tu cuenta.
- OpenAI tardo demasiado y se uso fallback local.

## Mensajes buenos para probar

```txt
Hola soy Maria, quiero 2 hamburguesas clasicas sin cebolla, 1 perro caliente con todas las salsas y 3 refrescos. Delivery en Base Aragua, casa azul frente a la farmacia. Pago movil.
```

```txt
Buenas, para retirar: una pizza margarita grande, dos nestea y una racion de papas. A nombre de Carlos 0412-1234567. Pago en efectivo.
```

```txt
Cliente Ana 0424-5557788. Me agregas 1 combo familiar, sin picante, y 2 malta. Enviar a Los Samanes torre B piso 3. Transferencia.
```

## Como debe comportarse

- Debe llenar nombre, telefono, entrega/retiro, direccion, metodo de pago y productos.
- Debe agregar notas como `sin cebolla`, `sin picante`, `con todas las salsas`.
- Si no reconoce un producto, debe advertirlo.
- Si hay duda, debe bajar la confianza.
- Siempre debes revisar antes de guardar. La IA ayuda, pero el operador confirma.
