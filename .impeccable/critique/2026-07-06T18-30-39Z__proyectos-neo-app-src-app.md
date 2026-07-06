---
target: Inicio + Actividad + desktop/tablet (src/app)
total_score: 26
p0_count: 0
p1_count: 4
timestamp: 2026-07-06T18-30-39Z
slug: proyectos-neo-app-src-app
---
# Crítica de diseño — Kashify (Inicio + Actividad, desktop/tablet)

Method: dual-agent (A: revisión de diseño · B: detector determinista) · sin browser automation (sin overlays)

## Design Health Score

| # | Heurística | Score | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad de estado | 2 | Cero skeletons en el repo; "Cargando..." plano; sidebar sin estado activo en /metas /cuotas /categorias (DesktopSidebar.tsx:117) |
| 2 | Match sistema/mundo real | 3 | Voseo excelente; deslices: "default" en inglés, ⚠ alarmista (PendingTransactionsBanner.tsx:19) |
| 3 | Control y libertad | 3 | UndoToast de manual; pero Esc solo en 2/5 modales; borrar meta = window.confirm crudo (metas:67) |
| 4 | Consistencia y estándares | 2 | "✓ Lograda" / "¡Lograda!" / "¡LOGRADA!" (3 redacciones); chips glass vs sólidos; botón primario #fff vs #04130D |
| 5 | Prevención de errores | 3 | Defaults inteligentes ✓; gap: multi-filtro roto deja creer que filtraste |
| 6 | Reconocimiento vs recuerdo | 3 | Labels siempre ✓; doble ruta a Categorías (sidebar→perfil?section vs Ver todo→/categorias) |
| 7 | Flexibilidad y eficiencia | 3 | WhatsApp = EL acelerador; sin atajos de teclado; sort solo ordena la página cargada |
| 8 | Estética y minimalismo | 2 | Sobrio en lo micro, saturado en lo macro: 11 bloques en Inicio, 4 animaciones ambientales |
| 9 | Recuperación de errores | 2 | Mejor copy del sistema, pero catch(()=>{}) convierte fallo de red en "Sin metas todavía" (metas:41-46) |
| 10 | Ayuda y documentación | 3 | Tour + hints + SpacesHintCard; sin help central pero cubre |
| **Total** | | **26/40** | **Aceptable — mejoras significativas antes de que los usuarios estén contentos** |

## Veredicto anti-patterns

**LLM (A)**: la piel tiene identidad propia (verde propio, mascota, mono para importes); el esqueleto es default-LLM: glassmorphism como contenedor de TODO (globals.css:168-175, sobre fondo casi opaco — ban absoluto y anti-referencia del propio PRODUCT.md), aurora 20s + sheen 7s + shimmer decorativos permanentes (ban del registro product), scrollbar custom 3px (ban literal), y 5 secciones idénticas "section-title + Ver todo →". Limpio en: side-stripes, gradient text, eyebrows, numbered markers, hero-metric template. Números con container queries = craft real.

**Detector (B)**: 4 hallazgos. 2 reales: progress bars animan `width` (cuotas/page.tsx:198, metas/page.tsx:146 → usar transform: scaleX). 2 falsos positivos: la boca CSS de la mascota (globals.css:852,863 — el border ES la forma). Los hallazgos reales refuerzan la crítica de motion de A; B no encontró slop estructural adicional — el codebase está limpio a nivel determinista.

## Impresión general

No hay que cambiar de dirección; hay que terminar la elegida. La identidad es defendible y diferenciada para el público rioplatense. La "vaguedad" que siente el dueño es arquitectural (dos pantallas compitiendo por el mismo trabajo) + un desktop que declara grilla de 2 columnas y la esquiva. Lo único que puede ECHAR usuarios son los números no confiables (P1-C).

## Fortalezas

1. Sistema de primitivos documentado en el código (radios tokenizados, .list-row canónica, regla card-glass/card-solid comentada) — la infraestructura para arreglar la inconsistencia ya existe.
2. La copy es la mejor parte del producto: voseo genuino, errores que preservan el trabajo, hints que enseñan. Cumple neo-voz.md casi al 100%.
3. Reaseguro de borrado (confirmación + undo) y auto-categorización con aprendizaje local = patrones de producto maduro.

## Problemas prioritarios

**[P1] C — Números que pueden mentir.** Filtros multi-selección silenciosamente ignorados: `if (filters.categories.length === 1)` (historial:478-479) — elegís 2 categorías, el botón dice "Filtrar · 2" y la lista muestra TODO. Totales y donut computados sobre la página cargada (máx 50 tx). En un ledger esto erosiona la única promesa del producto. Fix: filtros con arrays server-side + summary del mes completo.

**[P1] A — Inicio y Actividad son la misma pantalla barajada.** Ambas muestran límites, metas, cuotas, gráfico y summary; en Actividad la lista de movimientos —su única razón de ser— muestra 5 ítems colapsados debajo de widgets repetidos (historial:726). Viola el principio 5 de PRODUCT.md. Fix: Inicio = hero + métricas + ahorro/ritmo + límites + últimas 5; Actividad = lista expandida agrupada por día + summary + filtros; borrar metas/cuotas/tendencia de Actividad.

**[P1] B — Desktop: grilla declarada, casi nadie la usa.** 8 de 12 bloques van en dash-full (DashboardShell:432-448) → celdas vacías junto a las métricas, cards de 3 líneas estiradas a 1200px, margin-top:32px fósil (globals.css:725). Tablet: sidebar fijo de 210px = 27% del ancho para 5 links. Fix: asignación intencional de columnas (izq = flujo del mes; der = rail de seguimiento) + rail de íconos en tablet.

**[P1] D — Contraste del hero en tema claro, verificado numéricamente.** Pill moneda inactiva 2.17:1; label BALANCE 2.13:1; "pesos argentinos" 3.10:1; monto blanco sobre #2BAC7B 2.88:1 (todos fallan AA; el tema oscuro está sano). Fix: gradiente desde #1F9468→#136049, pills a 0.30/blanco, hero-ink-soft a 0.95.

**[P2] E — Touch targets sub-44 sistemáticos.** ✏️🗑 de 28×28 en metas:131-140; ✕ de 28px en 4 modales; pills a 40. El patrón correcto ya existe en QuickAdd (BottomNav:366-372). Audiencia real = dedos de 55 años.

**[P3] F — Progress bars animan width** (cuotas:198, metas:146) → transform: scaleX. (Del detector.)

## Personas — red flags

**Jordan (primera vez)**: dos empty states contradictorios apilados ("usá el +" vs "escribile por WhatsApp"); NeoBanner tapa el saludo a los 2s incluso con WhatsApp ya vinculado (NeoBanner:12-14); "default"/"Conversión" sin explicar; dos caminos distintos a Categorías.

**Casey (mobile, una mano)**: Importar/Exportar fuera de la zona del pulgar; filtros/mes/búsqueda en useState sin URL → todo se resetea al volver (historial:383-396); targets de 28px; blur 22-52px = jank en gama media. A favor: inputs 16px ✓, FAB central ✓, nav se esconde con teclado ✓.

**Alex (power)**: cero atajos; la herramienta le miente (multi-filtro + sort sobre página); sin bulk ni rango custom. Lo rescata el export CSV.

**Marta, 55 (registra por WhatsApp, entra "a ver cómo viene")**: pills 2.17:1 ilegibles al sol; ⚠ la asusta (neo-voz lo prohíbe); tipografía operativa 11.5-13px; window.confirm crudo = el único momento "de máquina" en una app que le hablaba como amiga.

## Viaje emocional

Picos: saludo con nombre + count-up + mascota; "Neo eligió X · podés cambiarlo"; undo de borrado. Valles: **guardar un movimiento no se celebra** (el momento que PRODUCT.md define como éxito); NeoBanner interrumpe la entrada; error de red disfrazado de "no tenés nada"; window.confirm nativo.

## Carga cognitiva

4/8 items fallan (umbral crítico): single focus (mitad inferior del Inicio compite), chunking (11 bloques), one-thing-at-a-time (QuickAdd 6 grupos visibles), minimal choices (FilterSheet: 6 sorts + 4 tipos + N categorías de una; Actividad: 7 controles de vista).

## Observaciones menores

Tres redacciones de "lograda"; botón primario #fff en espacios:73; chips glass vs sólidos; títulos con estilo inline en historial:943 y cuotas:131; 3 patrones de header de página; "Ver todo →" vs "+ Agregar" para las mismas secciones; bottom-sheet vs modal centrado sin criterio; aria-modal ausente en QuickAdd y TransactionSheet; emojis ✏️🗑 solo en metas; avatar no-clickeable que parece clickeable; useCounter duplicado; radial-gradient del body roza la anti-referencia propia.

## Preguntas provocadoras

1. Si Actividad es "el detalle", ¿por qué su lista muestra 5 ítems colapsados debajo de 6 widgets que ya están en Inicio?
2. ¿Qué haría el usuario con 1200px que no puede hacer con 390? Si la respuesta es "ver lo mismo más ancho", desktop todavía no tiene diseño.
3. Si mañana el 100% de los registros entrara por WhatsApp, ¿qué pantalla borrarías?

## Spec del dueño vs. realidad

Ya existe: selector de espacios con "Total" (SpaceSwitcher), include_in_total en DB, hero de saldo, ingresos vs gastos con delta, sección metas, FAB central, filtros tipo/categoría/divisa, motor de cuotas con proyección, aportes a metas. Gaps genuinos: alerta "cuotas por vencer" en Inicio mobile (hoy desktop-only), tipo de cambio manual para que Total multi-divisa cierre, edición rápida desde la fila, feed agrupado Hoy/Ayer, y que los filtros multi FUNCIONEN (P1-C).

## Respuesta directa

El diseño le puede gustar a la gente: es cálido sin ser juguete y se diferencia de Mercado Pago/bancos. La dirección es correcta; falta disciplina de ejecución. Orden recomendado: C (confianza) → A (un trabajo por pantalla) → B (desktop real) → D (contraste) → E (targets). Todo es cirugía sobre primitivos existentes; rediseñar desde cero tiraría lo más difícil de conseguir (tokens, voz, reaseguro).
