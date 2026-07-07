---
target: Kashify app UI (re-critique post-fixes P1-P3)
total_score: 33
p0_count: 0
p1_count: 0
timestamp: 2026-07-07T21-19-41Z
slug: proyectos-neo-app-kashify-app-ui
---
## Design Health Score

| # | Heuristic | Score | Δ | Key Issue |
|---|-----------|-------|---|-----------|
| 1 | Visibility of System Status | 3 | = | Skeletons ahora anuncian carga (aria-busy + sr-only); falta loader entre rutas |
| 2 | Match System / Real World | 4 | = | 'Neto'→'Balance' quitó el único término semi-contable; voseo, mono, monedas nativas |
| 3 | User Control and Freedom | 3 | = | UndoToast, Escape, back; confirmar pendiente de Neo sin undo |
| 4 | Consistency and Standards | 3 | ↑ | Se eliminó el selector de moneda DUPLICADO (rail + gráfico); aún hay estilos inline dispersos |
| 5 | Error Prevention | 3 | = | Neo deduce categoría/fecha, undo cubre el swipe |
| 6 | Recognition Rather Than Recall | 4 | ↑ | Tablet ahora con labels bajo cada ícono — nav nombrado en mobile+tablet+desktop |
| 7 | Flexibility and Efficiency | 3 | = | WhatsApp = acelerador; sin atajos de teclado web |
| 8 | Aesthetic and Minimalist Design | 4 | ↑ | Actividad reorganizada (contexto+resumen+2 cols), números ya no desbordan, 1 selector de moneda |
| 9 | Error Recovery | 3 | = | 'No pudimos cargar… tus datos están a salvo' + Reintentar |
| 10 | Help and Documentation | 3 | = | Neo ES la ayuda contextual + Tour; sin docs persistentes |
| **Total** | | **33/40** | **+2** | **Good — sólido, quedan detalles de eficiencia/ayuda** |

## Anti-Patterns Verdict

**LLM assessment**: Sigue sin leer como AI slop. Ninguno de los tells de la lista negra (crema, gradient-text, side-stripes, hero-metric template, eyebrows). El rediseño de Actividad refuerza los principios de PRODUCT.md: los filtros globales (mes+moneda) viven juntos arriba, el resumen es una banda escaneable y el detalle (lista) manda a la izquierda. La identidad grafito+esmeralda+mono se mantiene.

**Deterministic scan**: `detect.mjs` sobre historial, NeoChat, DesktopSidebar, RowsSkeleton y dashboard → **0 hallazgos**. Limpio.

**Visual overlays**: No disponible — sin browser automation (sin playwright/puppeteer, app tras login). Re-score fundamentado en lectura de código + los screenshots de esta sesión. **No verificado en tablet real.**

## Overall Impression

31 → **33**. La suba viene de cerrar los dos P1 y un bug visible: (1) el nav de tablet ahora está nombrado (Recognition 3→4), (2) Actividad se reorganizó y perdió la duplicación de moneda + los números que desbordaban (Aesthetic 3→4, Consistency ↑). El resto quedó igual a propósito — no se tocaron control/freedom, error recovery, atajos ni docs. Para pasar a "Excellent" (36+) el techo ahora son cosas de eficiencia (atajos, loader de rutas) y ayuda persistente, no problemas de base.

## What's Working

1. **Actividad ahora se lee de un vistazo.** Contexto (mes+moneda) → resumen (3 tiles) → detalle (lista) | gráfico. La jerarquía sigue "resumen arriba, detalle adentro" sin mezclar alturas. La moneda es UN control, no dos.
2. **Números confiables.** El fix de container-queries hace que ningún importe desborde su tarjeta, en cualquier pantalla. En una app de plata, un número cortado rompe la confianza — ahora no pasa.
3. **Wayfinding parejo.** Nav nombrado en los tres breakpoints. La mamá en tablet ya no ve 5 íconos mudos.

## Priority Issues

- **[P2] Sin indicador de carga entre rutas.** Los skeletons cubren la carga de datos dentro de una pantalla, pero al navegar entre secciones no hay feedback (audiencia PWA en celular, a veces 3G). **Fix:** un top-loader fino en transiciones. **Suggested command:** `/impeccable animate`
- **[P2] Sin atajos de teclado (desktop).** Registrar, buscar, cambiar mes: todo a mouse. Baja para esta audiencia, pero es lo que frena Flexibility. **Fix:** `/` para buscar, `n` para nuevo movimiento. **Suggested command:** `/impeccable adapt`
- **[P3] El gráfico aún tiene 2 toggles (Circular/Barras + Categoría/Espacio).** Ya no compite con la moneda, pero sigue siendo la zona más densa. **Fix:** esconder Circular/Barras en un menú del gráfico. **Suggested command:** `/impeccable distill`
- **[P3] Ayuda no persistente.** Neo cubre la ayuda pero no hay un acceso estable ("¿cómo funciona?"). **Suggested command:** `/impeccable onboard`

## Persona Red Flags

**Jordan (Primerizo):** Ahora cubierto en los tres breakpoints (nav nombrado). Riesgo residual: sin un "¿cómo empiezo?" visible más allá del Tour de primera vez.

**Casey (Mobile):** Bien — bottom-nav en el pulgar, input de Neo abajo, "Ver menos ↑" arriba, estado persistido. Sin loader entre rutas es el único bache en 3G.

**Sam (Accesibilidad):** Mejoró — skeletons anuncian carga (role=status + sr-only), touch targets ≥44px, `prefers-reduced-motion` respetado, contraste AA. Verificar orden de foco en la nueva grilla de Actividad.

## Minor Observations

- La banda de resumen (3 tiles) en mobile muy angosto queda 3-across apretada; los números usan cqi así que entran, pero podría ir 1-fila/2-cols en <360px.
- Neo en el sidebar a 1.65 (desktop) — verificar que el bob no toque el botón "Invitar amigo" (slot 200px debería alcanzar).

## Questions to Consider

- ¿Cuántos usuarios cambian a "Barras" o "Espacio" en el gráfico? Si son pocos, esconder esos toggles sube el minimalismo sin costo.
- ¿Vale un loader de rutas, o Next las sirve lo bastante rápido para que no se note?
- ¿"Balance" comunica mejor que "Neto" para tu familia, o probamos "Te queda / Te faltó" según el signo?
