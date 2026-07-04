---
target: app Kashify (src/app + components)
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-07-04T21-47-15Z
slug: proyectos-neo-app-src-app
---
⚠️ DEGRADED: single-context (política del harness: sin subagentes salvo pedido explícito; se corrió secuencial A→B)

# Crítica UX/UI — Kashify (src/app + components) — 2026-07-04

## Design Health Score

| # | Heurística | Score | Hallazgo clave |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado del sistema | 2 | TransactionSheet guarda sin verificar `res.ok` (falla silenciosa); sin toast de éxito |
| 2 | Sistema ↔ mundo real | 4 | Rioplatense impecable ("¿En qué gastaste?"), formato es-AR, cero jerga |
| 3 | Control y libertad del usuario | 2 | Sin deshacer tras eliminar; modales no cierran con Esc; form perdido si se cierra |
| 4 | Consistencia y estándares | 3 | Botón Guardar: texto #FFFFFF en un modal y #04130D en otro; z-index 50/9000/9100; modales centrados vs bottom-sheet |
| 5 | Prevención de errores | 3 | Valida requeridos y confirma borrado; permite monto 0; moneda/fecha con defaults |
| 6 | Reconocimiento vs memoria | 2 | **Registrar sin labels**: placeholders que desaparecen, selects de Categoría y Espacio idénticos sin título, fecha sin explicar (la queja de Fran) |
| 7 | Flexibilidad y eficiencia | 3 | WhatsApp como acelerador estrella; quick-add; import Excel; falta puente WhatsApp→web |
| 8 | Diseño estético y minimalista | 3 | Sistema de primitivos sólido; inicio con hasta ~10 bloques apilados (condicionales, se ocultan solos) |
| 9 | Recuperación de errores | 1 | "Error al guardar" sin causa ni reintento; fallas silenciosas; PWA sin mensaje offline |
| 10 | Ayuda y documentación | 2 | Hay Tour y Neo responde, pero cero ayuda contextual en formularios |
| **Total** | | **25/40** | **Aceptable — mejoras significativas antes de abrir al público** |

## Veredicto Anti-Patterns

**LLM**: NO parece hecho por IA. Tiene identidad real: mascota propia, voz rioplatense, tokens
consistentes (--void/--accent), primitivos reutilizados (list-row, card-glass, section-title).
Pasa el "product slop test": un usuario de buenas apps confiaría. El riesgo no es slop sino
huecos de estados (error/undo/offline).

**Detector (19 hallazgos, 0 críticos)**: 13× `transition: width` (barras de progreso en
DashboardShell/BudgetDetail/ImportFlow/historial — animar width causa layout thrash; usar
`transform: scaleX`), 4× bounce easing `cubic-bezier(0.34,1.56,0.64,1)` (globals 386-400 +
SplashScreen:41 — el registro product pide ease-out sin rebote; en la mascota puede ser
personalidad deliberada, en el splash no), 2× borde acento 3px (globals 852/863).
Falsos positivos: ninguno claro; los width-transitions son reales pero de impacto menor.

**Browser overlays**: no disponibles (app con login; sin herramienta de browser en la sesión).

## Impresión general

La base es muy superior al promedio: sistema visual coherente, personalidad genuina, el patrón
"Neo eligió X · podés cambiarlo" es feedback de IA visible hecho bien. Lo que separa esto de
una app "lista para gente ajena a la familia" no es estética: son los **estados feos** (error,
deshacer, offline) y el **formulario de registrar**, que es la acción #1 de la app y hoy exige
adivinar. La mayor oportunidad: que registrar sea tan explicado y confiable como conversar con Neo.

## Lo que funciona

1. **La voz**: copy rioplatense sin culpa en toda la app — coincide exactamente con neo-voz.md.
2. **El sistema**: tokens + primitivos usados en serio; inicio=resumen con secciones que se
   ocultan cuando no aplican (dashboard vacío enseña el primer paso).
3. **"Neo eligió Comida · podés cambiarlo"**: transparencia de IA + control humano en una línea.

## Issues prioritarios

**[P1] Neo no re-detecta la categoría al cambiar la descripción**
- Dónde: `src/components/BottomNav.tsx:274` — `category_id: f.category_id || guessed`.
- Por qué: el usuario escribe "café", Neo pone Comida; borra y escribe "nafta" → queda Comida.
  Registro erróneo silencioso = datos sucios y desconfianza en Neo.
- Fix: recordar si la categoría vigente la puso Neo (ref `lastAutoId`); si la actual === auto,
  reemplazar con el nuevo guess (o limpiar si no hay); si la eligió el usuario, no tocar.

**[P1] El formulario Registrar no se explica (queja directa del usuario)**
- Dónde: `QuickAddModal` (BottomNav.tsx 355-486).
- Por qué: placeholders desaparecen al tipear; Categoría y Espacio son dos selects idénticos sin
  título; la fecha aparece suelta sin label. Primera acción de la app = máxima fricción.
- Fix: label chico (12px, --ink-muted) arriba de cada campo: "Descripción", "Monto", "Moneda",
  "Categoría", "Espacio", "Fecha"; microcopy de 1 línea donde hace falta ("Neo la elige sola,
  podés cambiarla"). Mantener una sola columna, no crece el modal más de ~60px.

**[P1] Errores silenciosos o mudos**
- Dónde: `TransactionSheet.handleSave/handleDelete` no miran `res.ok`; QuickAdd muestra
  "Error al guardar" sin causa ni reintento.
- Por qué: en móvil con red mala (el caso real argentino), el usuario cree que guardó y no.
- Fix: verificar `res.ok` siempre; mensaje específico + botón reintentar; conservar lo tipeado.

**[P2] Eliminar sin deshacer**
- Confirmación existe, pero el patrón superior es toast "Movimiento eliminado · Deshacer" (5s).
  Menos fricción al borrar legítimo y salvavidas para el error.

**[P2] Puente WhatsApp→web (pedido del usuario)**
- Al registrar por WhatsApp, Neo responde confirmando pero sin link. Agregar al final:
  "Velo en tu cuenta → kashify.vercel.app/historial" (y en la bienvenida, el link al login con
  `?hint=` del mail si se conoce). Cierra el principio 7 de PRODUCT.md.

## Persona Red Flags

**Casey (móvil distraído, una mano)**: quick-add bien abajo (pulgar ✓), pero si cierra el modal
sin querer (tap fuera) pierde todo lo tipeado; sin autosave de borrador. Targets de 28px en los
botones ✕ de cierre (< 44px). Barra de fecha nativa chica.

**Jordan (primera vez)**: en Registrar duda entre dos selects idénticos (¿cuál era Espacio?);
"Conversión" en tipos de movimiento no se explica; tras "Error al guardar" no sabe qué hacer.
El empty-state del inicio sí lo guía bien.

**Sam (accesibilidad)**: los inputs tienen `outline: none` sin estilo de focus de reemplazo →
navegación por teclado a ciegas; modales sin manejo de Esc ni focus-trap; aria-labels presentes
(bien); montos con +/− además de color (bien).

## Observaciones menores

- Guardar: texto blanco sobre accent en QuickAdd vs #04130D en TransactionSheet — unificar (el
  oscuro tiene mejor contraste AA sobre #46B58C).
- Escala z-index semántica (dropdown<sticky<backdrop<modal<toast) en vez de 50/9000/9100.
- Barras de progreso: `transform: scaleX` en vez de `transition: width` (13 casos).
- Splash con rebote: pasarlo a ease-out; el rebote reservarlo para Neo (personalidad).
- Monto acepta 0 — validar > 0.

## Preguntas para pensar

- ¿Qué pasa cuando un usuario registra por WhatsApp y por la web el mismo gasto? ¿Hay
  deduplicación o al menos una pista visual?
- Si "registrar no puede pesar", ¿el quick-add podría ser 2 campos (descripción + monto) y que
  TODO lo demás lo deduzca Neo con confirmación posterior?
- ¿El inicio necesita 10 bloques, o 4 bloques con drill-down bastan para "¿cómo vengo?"?
