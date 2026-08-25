---
target: Kashify app UI (revisión completa + tema claro + sistema de diseño)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-08-25T21-42-19Z
slug: proyectos-neo-app-kashify-app-ui
---
⚠️ DEGRADED: single-context (esta sesión tiene prohibido lanzar sub-agentes salvo pedido explícito del usuario)

## Design Health Score

| # | Heurística | Puntaje | Δ vs 07-07 | Problema clave |
|---|-----------|-------|---|-----------|
| 1 | Visibilidad del estado del sistema | 3 | = | Skeletons + loading.tsx + UndoToast cubren casi todo; los fetch que fallan no avisan nada |
| 2 | Correspondencia con el mundo real | 4 | = | Rioplatense real, monedas nativas, "Ritmo de gasto"/"Gastos fijos"; nada de jerga contable |
| 3 | Control y libertad del usuario | 3 | = | UndoToast y click-fuera en todos los overlays; 6 de 12 modales NO cierran con Escape |
| 4 | Consistencia y estándares | 2 | ↓ | 500 `fontSize` hardcodeados y 0 usos de los tokens `--text-*`; 8 radios distintos para 4 tokens; 4 nombres de card para 2 comportamientos |
| 5 | Prevención de errores | 3 | = | Neo deduce categoría/fecha, validación antes de enviar, undo en borrado |
| 6 | Reconocer antes que recordar | 3 | ↓ | Actividad arranca fija en "ARS" aunque tu moneda principal sea otra: la pantalla aparece vacía sin explicar por qué |
| 7 | Flexibilidad y eficiencia | 3 | = | WhatsApp es el acelerador real; sin atajos de teclado (decisión tomada, correcta para esta audiencia) |
| 8 | Diseño estético y minimalista | 3 | ↓ | Inicio apila hasta 14 bloques del mismo peso visual; el "¿cómo vengo?" se diluye |
| 9 | Recuperación de errores | 2 | — | 18 `catch(() => {})` silenciosos: si falla la red, la pantalla queda vacía y muda |
| 10 | Ayuda y documentación | 3 | = | Tour, hints en cada campo, SpacesHintCard, onboarding de vocabulario |
| **Total** | | **29/40** | **(33 en julio)** | **Sólido, con dos agujeros medibles: tema claro y sistema de diseño** |

**Sobre el 33 → 29:** no es que la app haya empeorado. Es que esta pasada midió dos cosas que la de julio no midió: el **contraste real del tema claro** (calculado, no estimado) y el **uso real de los tokens** en los componentes. Los puntos que bajaron son hallazgos nuevos, no regresiones.

## Veredicto de anti-patrones

**¿Parece hecho por IA?** No. Y es un logro real: la paleta obsidiana + esmeralda no es ni el fintech azul-marino-y-dorado ni el crema editorial ni el índigo SaaS. Los anti-references del PRODUCT.md se respetaron. El personaje Neo le da identidad propia que ninguna app generada por IA tiene.

Tres tells menores sí aparecen:
- **Eyebrow chico en mayúsculas con tracking** ("BALANCE", 12.5px, `letter-spacing: 0.16em`) en el hero y otra vez en las cards de Espacios (11px, 0.08em). Uno solo sería voz de marca; dos ya empieza a ser gramática de IA.
- **Movimiento decorativo permanente**: `.sheen` barre el hero cada 7 segundos para siempre, y `body::before` tiene una aurora que deriva 20s en loop infinito. En una app de plata, el movimiento que no comunica estado es ruido (y batería). El registro *product* lo prohíbe explícitamente.
- **Cards idénticas**: la banda de stats son 4 cards con la misma cáscara (label + número + barrita + frase). Es el patrón que el propio PRODUCT.md llama "sin decoración que no trabaje".

**Escaneo determinista** (`detect.mjs` sobre `src` + `public`): 2 hallazgos, ambos **falsos positivos** — `border-bottom: 3px solid` y `border-top: 3px solid` en `globals.css:972` y `:983` son la **boca de Neo** (la cara CSS de respaldo), no un borde de acento en una card.

**Inspección en navegador**: no disponible. No hay Playwright ni Puppeteer instalados y esta sesión no tiene herramienta de navegador, así que no hubo overlay visual ni screenshots. Todo lo de abajo sale de leer el código y de calcular los contrastes numéricamente. **Los cuatro breakpoints en pantalla real los tenés que mirar vos.**

## Impresión general

Esta app está mucho mejor diseñada que el 90% de lo que se ve. Tiene una decisión de color propia y sostenida, un personaje con identidad, tipografía mono para los importes, y un producto que entiende a su usuario (rioplatense, inflación, dos monedas). El trabajo previo se nota.

Los dos problemas grandes que quedan son invisibles desde el celular de Fran en tema oscuro:

1. **El tema claro no llega a AA en los importes** — y los importes son *el contenido* de esta app.
2. **El sistema de diseño está escrito pero no se usa**: los tokens viven en `globals.css` y los componentes los ignoran (500 tamaños de fuente a mano, 0 tokens). Es la razón por la que la deriva se repite en cada pantalla nueva.

La oportunidad más grande, en cambio, no es un bug: **Inicio dejó de responder "¿cómo vengo?" de un vistazo** y se convirtió en una lista de todo lo que la app sabe hacer.

## Lo que está funcionando

- **La voz.** "Llevás $X gastados. A este ritmo cerrás el mes en ~$Y." Eso es lenguaje de persona, no de banco. `referencia/neo-voz.md` como fuente de verdad fue una decisión excelente y se nota en cada string.
- **El tema oscuro está sólido.** Verifiqué los pares reales: acento 6.4:1, muted 6.0:1, dim 5.25:1, semánticos entre 5.3 y 7.9. Todo pasa AA con margen. El trabajo de julio aguantó.
- **Los números no desbordan.** `container-type: inline-size` + `clamp(…, 13.5cqi, …)` escala el importe al ancho de la tarjeta, no del viewport. Es la solución correcta, no el parche.
- **Defaults que piensan.** Fecha = hoy, categoría deducida por Neo, "el de siempre" para montos repetidos. El principio #6 ("registrar no puede pesar") está honrado en la lógica.

## Problemas prioritarios

### [P1] El tema claro reprueba AA justo en los importes

**Qué**: calculé los contrastes reales del tema claro contra sus tres fondos (`#FFFFFF`, `--void #EEF1EA`, `--raised #E7EBE2`):

| Token | Valor | Sobre blanco | Sobre raised | Dónde duele |
|---|---|---|---|---|
| `--positive` / `--accent` | `#1F9468` | **3.82** ✗ | **3.16** ✗ | montos de ingreso (14.5px/700), "Ver todo →", "Ver N más", "Neo eligió X" |
| `--negative` | `#D24B49` | **4.34** ✗ | 4.15 ✗ | **todos los montos de gasto** |
| `--warning` | `#B9760C` | **3.71** ✗ | 3.44 ✗ | montos de cuotas |
| `--ink-dim` (α .60) | `#727A76` | 4.41 ✗ | **4.13** ✗ | fechas, "de $X de ingresos", captions |

El mínimo AA para texto normal es 4.5:1. **Ninguno llega.** El PRODUCT.md se compromete textualmente con "WCAG AA mínimo. Prioridad: contraste de texto (≥4.5:1 body)".

**Por qué importa**: la mamá de Fran, 58 años, con el celular al sol y el tema claro puesto, lee los números de su plata al 3.8:1. Es exactamente la persona para la que se hizo la app. El tema oscuro está perfecto — por eso nadie lo vio.

**Arreglo** (valores ya calculados y verificados contra los 3 fondos):
- `--positive`/`--accent` → `#197653` (5.59 / 4.90 / 4.63)
- `--negative` → `#C23230` (5.54 / 4.85 / 4.58)
- `--warning` → `#935E0A` (5.46 / 4.79 / 4.52)
- `--ink-dim` → α `0.64` (5.02 / 4.65)

**Cuidado con el efecto colateral**: `--accent` también es *fondo* del botón primario y del FAB, con tinta `#04130D` encima. Si se oscurece el acento sin más, ese botón cae de 5.0:1 a 3.4:1 — se arregla un lado y se rompe el otro. La solución correcta es separar el rol: un token `--on-accent` (oscuro en tema oscuro, blanco en tema claro) para la tinta que va *sobre* el acento.

**Comando sugerido**: `/impeccable audit` (o lo aplico directo, ya está calculado).

### [P1] El sistema de diseño está escrito pero nadie lo usa

**Qué**: `globals.css` define la escala tipográfica (`--text-2xs` … `--text-2xl`) y dice textualmente sobre los radios "usar SIEMPRE estos en vez de números sueltos". La realidad medida en `src/**/*.tsx`:

- **500** `fontSize:` hardcodeados · **0** usos de `var(--text-*)`
- 18 tamaños distintos en uso: 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17… Eso no es una escala, es un espectro.
- **8** valores de `borderRadius` a mano (8, 10, 12, 14, 16, 18, 20, 999) para **4** tokens definidos.
- **4 nombres de clase para 2 comportamientos**: `.card-glass` y `.glass-card` son *la misma regla CSS* (9 y 8 usos), más `.card-v2` (1 uso) y `.card-solid` (6).

**Por qué importa**: no es cosmético — es la causa raíz de la deriva. El piso de legibilidad documentado ("nada por debajo de 12px") ya se rompió en 8 lugares (11px y 11.5px en el gráfico, los chips de límite, el badge "default" de Espacios). Cada pantalla nueva reinventa sus tamaños porque copiar el número de al lado es más fácil que buscar el token. Y `.card-v2` con un solo uso es superficie muerta del sistema.

**Arreglo**: consolidar los alias de card a uno solo, mapear los 18 tamaños a los 8 tokens que ya existen, y borrar `.card-v2`. Es un refactor mecánico y de bajo riesgo (mismos valores, distinta fuente).

**Comando sugerido**: `/impeccable extract`

### [P2] Inicio dejó de responder "¿cómo vengo?"

**Qué**: contados desde `dashboard/page.tsx` + `DashboardShell.tsx`, Inicio puede apilar hasta **14 bloques**: saludo, selector de espacio, hint de espacios, pendientes de Neo, banner de WhatsApp, hero, resumen de espacios, 2 métricas, hasta 4 cards de stats, franja de límites (hasta 10 chips), últimas transacciones, metas y gráfico. Casi todos con el mismo peso visual: `glass-card`, radio 18, padding 16-18.

**Por qué importa**: el principio #5 del propio PRODUCT.md dice "Resumen arriba, detalle adentro. Inicio responde '¿cómo vengo?' de un vistazo; el desglose completo vive en actividades/historial. **No mezclar las dos alturas en una pantalla.**" Hoy Inicio tiene siete detalles: tasa de ahorro, ritmo, cuotas, recurrentes, límites, metas y gráfico. Y el principio #2 ("una sola acción obvia") compite con cinco "Ver todo →" simultáneos.

**Por qué pasó**: cada card se agregó sola y con buen criterio. El problema no es ninguna card, es la suma — nadie las miró juntas.

**Arreglo**: jerarquía en vez de amputación. El hero y las 2 métricas son el resumen; la banda de stats se vuelve **una** línea de contexto (no 4 cards); límites, metas y gráfico bajan un nivel de peso visual o se mueven a Actividad, que es donde el PRODUCT.md dice que vive el detalle.

**Comando sugerido**: `/impeccable layout`

### [P2] Los fetch que fallan no le dicen nada al usuario

**Qué**: 18 `.catch(() => {})` en la app. Ejemplos: `DashboardShell.tsx:330` (categorías), `cuotas/page.tsx:23` (planes de cuotas), `PerfilClient.tsx:190-192` (metas, cuotas, preferencias de avisos).

**Por qué importa**: con la red floja — celular, subte, datos agotados — el usuario ve un desplegable de categorías vacío o la pantalla de Cuotas sin nada, y **no hay ninguna señal de que algo falló**. Va a concluir que perdió los datos. En una app de plata, eso es pánico, no una molestia.

**Arreglo**: un estado de error mínimo y reusable ("No pudimos cargar esto. Reintentar") en los tres o cuatro fetch que alimentan una pantalla entera. Los `catch` de telemetría o de fondo pueden quedarse mudos.

**Comando sugerido**: `/impeccable harden`

### [P2] Actividad arranca en ARS aunque tu moneda principal sea otra

**Qué**: `historial/page.tsx:364` → `useState<string>("ARS")`, hardcodeado. El dashboard, en cambio, arranca en `primaryCurrency` (la del perfil).

**Por qué importa**: un usuario con USD como moneda principal ve Inicio en dólares y, al tocar "Actividad", una lista vacía o parcial sin explicación. Además el selector de moneda de cada pantalla es estado local: elegís USD en Inicio, vas a Actividad y volvió a ARS.

**Arreglo**: que Actividad tome `primaryCurrency` igual que el dashboard, y que la moneda elegida se recuerde entre pantallas (mismo patrón que ya usa `SpaceContext` para el espacio activo — la pieza ya existe, hay que reusarla).

**Comando sugerido**: `/impeccable harden`

### [P3] Escape cierra la mitad de los modales

**Qué**: cierran con Escape 6 (TransactionSheet, FilterSheet, ExportSheet, QuickAdd, y los de historial/metas). No cierran 6: `BudgetDetailModal`, `CategoryModal`, `SpaceModal`, `TxBreakdownModal`, `IconPicker`, `ImportFlow`. Todos sí cierran con click afuera y con la ✕, así que nadie queda atrapado. Además `CategoryModal` y `SpaceModal` no declaran `role="dialog"`/`aria-modal`.

**Por qué importa**: es inconsistencia de vocabulario — el registro *product* la prohíbe: "si el botón de guardar se ve distinto en dos lugares, uno está mal". Acá es el gesto de cierre.

**Arreglo**: un solo hook `useDismiss(onClose)` que haga Escape + click afuera + `role="dialog"`, y que lo usen los 12. Diff más chico que parchear seis archivos por separado.

**Comando sugerido**: `/impeccable polish`

## Banderas rojas por persona

**Marta, 58 (la mamá — primera vez, tema claro, celular al sol)**
- Lee los montos de gasto a 4.34:1 y las fechas a 4.13:1. Va a entrecerrar los ojos con su propia plata.
- Los nombres de los chips de límite están a 11.5px, por debajo del piso de 12px que el propio sistema fijó.
- Si la red falla mientras carga Cuotas, ve una pantalla vacía sin mensaje: va a llamar a Fran pensando que perdió los datos.
- Llega a Inicio y encuentra 14 bloques. No sabe dónde mirar primero.

**Nico, 27 (freelance, cobra en USD y gasta en ARS)**
- Pone USD como moneda principal, toca "Actividad" y ve ARS. Sin aviso, sin explicación.
- Elige USD en Inicio, entra a un movimiento, vuelve: otra vez ARS. El estado no sobrevive la navegación.
- El total unificado ("≈ $X unificado") solo aparece en el hero de Inicio, y solo si cargó la cotización en Perfil. En Actividad no existe.

**Fran (power user, dueño del producto)**
- Sin atajos de teclado en toda la web — decisión ya tomada y correcta para esta audiencia, pero él es el que más carga datos.
- Registrar un gasto son 6 decisiones (tipo, descripción, monto, moneda, categoría, espacio, fecha) cuando la app ya sabe cuatro de ellas. WhatsApp es su atajo real; el formulario web quedó atrás.

## Observaciones menores

- El `.sheen` del hero (barrido de luz cada 7s, infinito) y la aurora de `body::before` (20s, infinita) son decoración pura. `prefers-reduced-motion` está bien respetado, pero para todos los demás corren para siempre.
- Dos eyebrows en mayúsculas con tracking ("BALANCE" en el hero y en las cards de Espacios). Elegir uno.
- El badge "default" en `espacios/page.tsx:61` está en inglés y en minúscula, en una app que en todo lo demás habla castellano impecable.
- `.card-v2` tiene un solo uso en toda la app. O se adopta o se borra.
- `metric-value` usa `clamp()` fluido para el importe; el registro *product* prefiere escala fija, pero acá está justificado (el ancho del número es impredecible por la inflación).
- El hero mezcla `.display` (Space Grotesk) y `.mono` (DM Mono) en el mismo elemento. Funciona porque mono gana, pero es una clase de más.

## Preguntas para pensar

- Si Inicio solo pudiera mostrar **tres** cosas, ¿cuáles serían? Todo lo demás tiene su pantalla.
- La banda de stats (ahorro, ritmo, cuotas, recurrentes) son cuatro respuestas a preguntas que el usuario no hizo. ¿Y si Neo dijera **una** de las cuatro, la que hoy importa, en una línea?
- El tema claro, ¿lo usa alguien de verdad, o es una cortesía? Si nadie lo usa, arreglar el contraste igual (es barato). Si lo usa la mamá, es P0 y no P1.
- ¿Qué pasaría si el formulario de registrar pidiera solo "qué" y "cuánto", y todo lo demás quedara detrás de "más opciones"?
