# Arte de Neo — generación con Higgsfield

> **✅ COMPLETADO 2026-07-04:** los 7 PNGs generados por Fran (Higgsfield web, cuenta nueva),
> recortados con Vision de macOS, escalados a 208×208 en `public/neo/`, `NEO_ART = true`.
> Originales en `planes/arte-neo/`. Este doc queda como referencia para regenerar/agregar poses
> (parpadeo, saludo 2 frames — prompts al final de la conversación del 2026-07-04).

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

## Prompt base FINAL (inglés) — validado con Fran tras 5 iteraciones

> A cute round chubby monster mascot standing upright on two short stubby furry legs,
> facing the camera directly, front view, symmetrical. Its entire body and face are
> completely covered in long shaggy soft steel-blue fur draping gently downward — no
> skin visible anywhere, only fluffy fur. Two big round glossy white cartoon eyes with
> large dark pupils, eyes mostly open with small subtle upper eyelids. Two fluffy
> expressive eyebrows made of fur in a slightly darker steel-blue shade than the body.
> A small cute mouth below the eyes with a gentle smile and a hint of pink tongue.
> No ears, no nose. A soft emerald green light (#46B58C) glows from deep within its
> belly, diffusing through the fur like a lantern. Pixar-style 3D render, soft studio
> lighting, centered, plain flat light background, no text, no ground shadow.

⚠️ Párpados: Fran pidió que sean **chicos/sutiles** — con párpados semi-caídos parece
"drogado" (v5). De ahí el "eyes mostly open with small subtle upper eyelids".

## Variación por mood (reemplazar la última oración de expresión del prompt base)

| Archivo | Expresión |
|---|---|
| `neo-idle.png` | Expression: calm and relaxed, eyes open, gentle soft smile, eyebrows neutral. |
| `neo-happy.png` | Expression: wide joyful open-mouth smile, sparkling wide-open eyes, eyebrows raised high, fur slightly puffed up. |
| `neo-celebrating.png` | Pose: mid-jump with joy, eyes closed in happy arcs, big open smile, fur bouncing, inner green glow brighter. |
| `neo-worried.png` | Expression: eyebrows tilted upward in the middle, small frown, slightly drooping posture, fur a bit deflated. |
| `neo-curious.png` | Pose: head tilted to one side, one eyebrow raised high and the other low, one eye wider than the other, leaning slightly forward, small curious open mouth. |
| `neo-thinking.png` | Expression: eyes looking up and to the side, one eyebrow raised, tiny pursed mouth, pensive. |
| `neo-sleeping.png` | Expression: both eyes fully closed with smooth furry eyelids, peaceful tiny smile, relaxed drooping posture, inner green glow dimmed. |

## Flujo manual (cuenta nueva de Higgsfield)

1. Modelo: **Nano Banana Pro**, aspect ratio 1:1.
2. Generar primero el **base/idle**. Tip: subir `planes/arte-neo-base-v5-cejas.png` como
   imagen de referencia + prompt base → mantiene el personaje ya aprobado (solo achica párpados).
3. Para cada mood: usar la MEJOR imagen base como referencia + prompt:
   *"Same fluffy blue monster character, identical fur, colors, proportions and style.
   Only change: {expresión de la tabla}"*.
4. Fondo: pedir "plain flat light background" (NUNCA "transparent" — dibuja un ajedrez falso).
   El alpha real se hace después con remove-background (Higgsfield o cualquier herramienta).
5. Descargar los 7 PNGs → pasármelos (carpeta del workspace o rutas) → yo hago: recorte si
   falta, downscale 208×208, `public/neo/neo-{mood}.png`, `NEO_ART = true` en NeoMascot.tsx.

## Specs técnicas

1. **Los 7 en una misma sesión** con la imagen de referencia de Fran como *character
   reference* (que no cambie silueta ni estilo — solo la expresión/pose).
2. Generar a **1024×1024 con fondo transparente real** (alpha; recortar pelo a mano queda mal).
3. Downscale a **208×208** (2x del render de 104px, para retina).
4. Probar cada PNG sobre fondo oscuro `#15181A` y claro `#F4F1EA` (ambos temas).
5. Guardar en `public/neo/neo-{mood}.png` (crear el directorio).
6. Activar: `NEO_ART = true` en `src/components/NeoMascot.tsx:10`.

## ESTADO 2026-07-04 (tarde): look base APROBADO

Fran aprobó el look tras 4 iteraciones ("así me encantó" + pidió boca). Base =
`planes/arte-neo-base-aprobado.png`, job_id Higgsfield `0b7ca1db-38d2-45c4-a03e-4fe294a84f78`
(modelo `nano_banana_pro`, 2 créditos/imagen). **El personaje final difiere del prompt base de
arriba**: todo cubierto de pelo azul acero (cara incluida, SIN piel/vidrio visible), parado en
2 patas cortas, brazos caídos de pelo, ojos glossy grandes, boca chica sonriente con lengüita,
glow verde esmeralda difuso en la panza.

**Para las 6 poses restantes:** pasar ese job_id como `medias: [{value, role:"image"}]` y pedir
"Same fluffy blue monster character, identical..., only change the expression/pose to: {mood}".

Lecciones de prompt: "sheepdog" → sale perro en 4 patas; siempre "standing upright on two stubby
legs, front view". "transparent background" → dibuja ajedrez falso; pedir "plain flat light
background" y recortar después con `remove_background`.

**v5 (candidata a base final):** Fran pidió cejas + párpados del mismo color del pelaje pero
más oscuro, para que las expresiones se noten más. Job_id `0af1af8b-ceb1-4815-bb20-f1d37f331515`,
archivo `planes/arte-neo-base-v5-cejas.png`. Salió con párpados semi-caídos (vibe relajado, muy
parecido a la referencia original). Pendiente OK de Fran sobre si esa es la expresión idle o se
pide menos párpado.

**Créditos: 0 (plan free, se usaron los 10).** Para continuar hace falta top-up en Higgsfield:
6 poses × 2 créditos + remove_background × 7 (costo aparte). Con créditos: usar el job_id de la
base aprobada como character reference y generar mood por mood.

## Nota MCP

El MCP de Higgsfield (conector de claude.ai) se conectó el 2026-07-04 pero la sesión
corriendo no lo veía (los conectores se cargan al inicio de sesión). En sesión nueva
buscarlo con ToolSearch (`+higgsfield` o keywords de generación de imagen).
