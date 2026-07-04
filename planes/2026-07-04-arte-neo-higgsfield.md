# Arte de Neo — generación con Higgsfield

Dirección de arte definida por Fran el 2026-07-04. Este doc tiene todo lo necesario
para generar los 7 PNGs de la mascota en una sesión con el MCP de Higgsfield conectado.

## El personaje

Basado en una imagen de referencia que tiene Fran: **criatura azul peluda estilo Pixar**,
redonda/regordeta, ojos gigantes brillantes de cartoon, patitas cortas apenas visibles
(la imagen original es de una página 404 "Página não encontrada"). Modificaciones pedidas:

- **Sin orejas ni nariz**
- **Efecto liquid glass**: cuerpo semitranslúcido tipo vidrio esmerilado bajo el pelo,
  con una **luz tenue verde esmeralda adentro** (`#46B58C`, el accent de Kashify)
- **Con los pelos** (pelaje fino y suave, no liso)
- Gestos por mood (los 7 PNGs = poses); el movimiento lo pone el CSS existente
  (float-bob, blink, celebrate — ya implementado en globals.css)

Color del pelaje a decidir al generar: azul-grisáceo claro como la referencia
(recomendado — contrasta con el glow verde) o verde menta para matchear la marca.
Probar azul primero.

## Prompt base (inglés)

> A cute round fluffy mascot creature covered in fine soft fur, huge glossy cartoon
> eyes with dark pupils, no ears, no nose, tiny mouth, short stubby legs hidden under
> the fur. Liquid glass effect: the body is semi-translucent like frosted glass beneath
> the wispy fur, glowing softly from within with a gentle emerald green light (#46B58C),
> subtle inner luminescence visible through the fur. Pixar-style 3D render, soft studio
> lighting, front view, centered, isolated on transparent background, no text, no ground shadow

## Variación por mood (agregar al final del prompt base)

| Archivo | Agregar |
|---|---|
| `neo-idle.png` | calm relaxed pose, gentle soft smile |
| `neo-happy.png` | wide joyful smile, sparkling eyes, fur slightly puffed up |
| `neo-celebrating.png` | mid-jump with joy, eyes closed smiling, fur bouncing, inner glow brighter |
| `neo-worried.png` | drooping posture, raised inner eyebrows, small frown, fur slightly deflated |
| `neo-curious.png` | head tilted, one eye wider, leaning forward |
| `neo-thinking.png` | eyes looking up to the side, pensive tiny mouth |
| `neo-sleeping.png` | eyes closed, peaceful, curled up, inner glow dimmed |

## Specs técnicas

1. **Los 7 en una misma sesión** con la imagen de referencia de Fran como *character
   reference* (que no cambie silueta ni estilo — solo la expresión/pose).
2. Generar a **1024×1024 con fondo transparente real** (alpha; recortar pelo a mano queda mal).
3. Downscale a **208×208** (2x del render de 104px, para retina).
4. Probar cada PNG sobre fondo oscuro `#15181A` y claro `#F4F1EA` (ambos temas).
5. Guardar en `public/neo/neo-{mood}.png` (crear el directorio).
6. Activar: `NEO_ART = true` en `src/components/NeoMascot.tsx:10`.

## Nota MCP

El MCP de Higgsfield (conector de claude.ai) se conectó el 2026-07-04 pero la sesión
corriendo no lo veía (los conectores se cargan al inicio de sesión). En sesión nueva
buscarlo con ToolSearch (`+higgsfield` o keywords de generación de imagen).
