---
target: Kashify app UI (re-critique post-3-tandas)
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-07T19-42-54Z
slug: proyectos-neo-app-kashify-app-ui
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + "escribiendo…" + undo toast + estados activos; falta indicador de carga entre rutas |
| 2 | Match System / Real World | 4 | Español rioplatense, voseo, mono para importes, ARS/EUR/USD nativo; "Neto" es el único término semi-contable |
| 3 | User Control and Freedom | 3 | UndoToast tras borrar, Escape en sheets, back, "Ver menos"; confirmar pendiente de Neo no tiene undo |
| 4 | Consistency and Standards | 3 | Sistema de primitivos (card-solid, list-row, section-title, press); sólido, algún estilo inline diverge |
| 5 | Error Prevention | 3 | Neo deduce categoría/espacio/fecha, fecha nativa, undo cubre el swipe accidental |
| 6 | Recognition Rather Than Recall | 3 | Nav con label en mobile+desktop, chips de sugerencias en Neo; **tablet queda icon-only** (768–1023) |
| 7 | Flexibility and Efficiency | 3 | Canal WhatsApp = acelerador enorme, quick-add, swipe, filtros, toggle de moneda; sin atajos de teclado web |
| 8 | Aesthetic and Minimalist Design | 3 | Números protagonistas, paleta restringida; Actividad acumula varios controles (donut + 2 pares de toggles + moneda + mes) |
| 9 | Error Recovery | 3 | "No pudimos cargar… tus datos están a salvo" + Reintentar: plano, tranquilizador, accionable |
| 10 | Help and Documentation | 3 | Neo ES la ayuda contextual + Tour de onboarding + flujo bienvenida WhatsApp; sin docs persistentes |
| **Total** | | **31/40** | **Good — base sólida, afinar zonas débiles** |

## Anti-Patterns Verdict

**LLM assessment**: No lee como AI slop. Evita activamente todos los tells de la lista negra: sin fondo crema/beige, sin gradientes en el body, sin gradient-text, sin side-stripe borders, sin hero-metric template, sin eyebrows tracked en cada sección. La paleta grafito+esmeralda con la mascota Neo es una identidad propia, no la fintech navy-y-dorado genérica. El uso de mono para importes y la contención del color a estado (positivo/negativo/warning) es decisión de diseño real, no decoración por defecto.

**Deterministic scan**: El detector (`detect.mjs`) corrió sobre historial, NeoChat, DesktopSidebar, DashboardClient y RowsSkeleton → **0 hallazgos**. Limpio.

**Visual overlays**: No disponible — no hay automatización de browser en esta sesión (sin playwright/puppeteer) y la app está detrás de login. No se pudo inyectar overlay ni hacer QA visual en vivo. Los hallazgos son de lectura de código + los dos screenshots aportados (/neo y /historial).

## Overall Impression

Subió de forma real: 26 → **31**. El salto viene de infraestructura de UX que antes no existía — undo tras borrar, skeletons que laten en vez de "Cargando...", estados de error tranquilizadores, sistema de primitivos consistente, y Neo más presente. Lo que funciona: la app **respeta sus propios principios** (números protagonistas, calidez en la copia y no en la paleta, resumen arriba / detalle adentro). La mayor oportunidad restante no es visual sino de **wayfinding en tablet** y de **densidad de controles en Actividad**.

## What's Working

1. **La copia y el idioma.** Voseo rioplatense, cero jerga contable (salvo "Neto"), Neo habla como una persona tranquila. Para una audiencia no-técnica esto baja la ansiedad exactamente donde el dinero la sube. Es el activo más difícil de copiar.
2. **Recuperación y control.** UndoToast tras borrar + estados de error que dicen "tus datos están a salvo" + Reintentar. Es raro verlo tan bien resuelto en un beta; convierte un momento de pánico en algo reversible.
3. **Disciplina de identidad.** Grafito + esmeralda + mono para importes, con el color reservado a comunicar estado. No compite con los datos. La mascota da calidez sin volver la app un juguete.

## Priority Issues

- **[P1] Sidebar icon-only en tablet mata el reconocimiento.** En 768–1023px los labels del nav se ocultan (`.sidebar-label { display:none }`) y quedan 5 íconos pelados. La persona no-técnica (mamá, familia) en una tablet no sabe qué es cada ícono — el de Neo (orbe "N") y el de Espacios (grilla) son ambiguos. **Fix:** mostrar el label debajo del ícono (stack vertical) aunque el rail sea angosto, o tooltip on-tap. **Suggested command:** `/impeccable adapt`

- **[P1] Densidad de controles en Actividad.** El panel derecho apila: nav de mes, toggle ARS/EUR/USD, toggle Circular/Barras, toggle Categoría/Espacio, más el donut con leyenda. Son ~5 decisiones simultáneas en un vistazo — empuja el límite de memoria de trabajo para el usuario objetivo. **Fix:** colapsar los toggles secundarios (Circular/Barras dentro de un menú del gráfico), o mover el selector de moneda a un solo lugar compartido. **Suggested command:** `/impeccable distill`

- **[P2] Globito de Neo se desborda sobre el contenido en tablet.** El bubble se ancla en `left: calc(100% - 6px)` de la caja de 104px de la mascota; sobre el rail de 72px sale disparado sobre el contenido principal, sin tether visual claro. **Fix:** en tablet, anclar el bubble arriba de la mascota (no al costado) o suprimirlo en el rail angosto. **Suggested command:** `/impeccable adapt`

- **[P2] "Neto" es el único término que pide traducción.** Ingresos/Gastos son obvios; "Neto" hace pensar a un no-contable. **Fix:** "Balance" o "Te queda" según el signo. **Suggested command:** `/impeccable clarify`

- **[P3] Skeletons con conteo fijo pueden saltar levemente.** TxListSkeleton muestra 3 filas y RowsSkeleton 4–5; si llegan menos ítems hay un micro-reflow. Bajo impacto. **Suggested command:** `/impeccable polish`

## Persona Red Flags

**Jordan (Primerizo):** En **tablet** el nav icon-only lo frena — no puede nombrar las secciones. En mobile y desktop está cubierto (labels visibles). El orbe "N" de Neo no se lee como "asistente" sin la palabra.

**Casey (Mobile distraído, una mano):** Bien servido — bottom-nav en el pulgar, barra de input de Neo abajo, estado persistido, swipe-to-delete con undo. Riesgo menor: el botón "Ver todas" al fondo de una lista larga (ya mitigado con el "Ver menos ↑" arriba que acabamos de agregar).

**Sam (Accesibilidad):** Contraste AA declarado y respetado, touch targets ≥44px, `prefers-reduced-motion` respetado (incluida la mascota y el conteo animado), `aria-label` en la mayoría de los controles icon-only. Verificar foco visible en el swipe-row y que el skeleton anuncie `aria-busy` (RowsSkeleton lo hace; TxListSkeleton usa `aria-hidden` — el lector no anuncia "cargando").

## Minor Observations

- TxListSkeleton usa `aria-hidden` sin `aria-busy`; para el lector de pantalla la carga es muda. RowsSkeleton sí lo anuncia.
- No hay indicador de carga en transición entre rutas (Next lo maneja, pero un top-loader ayudaría en 3G — audiencia PWA en celular).
- El icono de Neo en el sidebar (orbe con "N") compite conceptualmente con la mascota flotante justo debajo; dos representaciones de Neo en la misma columna.

## Questions to Consider

- ¿Y si Actividad mostrara UN gráfico por defecto y escondiera los toggles hasta que el usuario toque el gráfico? ¿Cuántos realmente cambian a Barras/Espacio?
- ¿"Neto" existe porque es correcto, o porque es lo que dicen las apps de finanzas? La audiencia no es contable.
- En tablet, ¿el rail angosto gana algo, o sería mejor el sidebar completo con labels como en desktop?
