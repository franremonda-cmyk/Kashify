---
target: Kashify app UI (flujos, botones, acciones + Deudas)
total_score: 27
p0_count: 2
p1_count: 2
timestamp: 2026-09-30T13-36-29Z
slug: proyectos-neo-app-kashify-app-ui
---
⚠️ DEGRADED: single-context (esta sesión no lanza sub-agentes sin pedido explícito del usuario; sin navegador autenticado: las pantallas requieren login y no se creó usuario en la base de producción)

## Design Health Score

| # | Heurística | Puntaje | Δ vs 25/08 | Problema clave |
|---|---|---|---|---|
| 1 | Visibilidad del estado | 3 | = | Skeletons y undo bien; 22 fetch fallan mudos (Deudas nueva incluida) |
| 2 | Mundo real | 3 | ↓ | Fechas en UTC: lo cargado después de las 21 queda con fecha de mañana; "Registrar pago" en una deuda que te deben |
| 3 | Control y libertad | 3 | = | 8 overlays sin Escape (sumaron DebtForm e InstallmentForm); borrar deuda/cuota sin undo |
| 4 | Consistencia | 3 | ↑ | Tokens adoptados (488 vs 19 sueltos). Nuevo: la web y Neo tratan distinto la misma deuda |
| 5 | Prevención de errores | 2 | ↓ | Doble toque duplica deuda/plan de cuotas; "Me deben" por web no baja el neto |
| 6 | Reconocer vs recordar | 2 | ↓ | Deudas/Cuotas/Metas escondidas en Perfil; moneda arranca en ARS (Actividad, +, DebtForm) |
| 7 | Flexibilidad | 3 | = | WhatsApp es el atajo; el + no ofrece deuda |
| 8 | Minimalismo | 3 | = | Inicio más ordenado ("Neo dice una sola cosa"); aurora infinita sigue |
| 9 | Recuperación de errores | 2 | = | Editar deuda sin manejo de error; catches mudos |
| 10 | Ayuda | 3 | = | Vacío de Deudas no enseña la frase de WhatsApp |
| **Total** | | **27/40** | (29) | **Aceptable: la base visual mejoró, aparecieron agujeros de datos** |

## Veredicto anti-patrones
No parece hecho por IA. Detector: 2 hallazgos, ambos falsos positivos (boca de Neo, globals.css:908/919). P1 de agosto (contraste tema claro, tokens) verificados como resueltos.

## Problemas prioritarios
- [P0] Deuda "Me deben" creada en la web no descuenta el neto (api/debts POST no crea el egreso que sí crea Neo) → al cobrarla entra un ingreso fantasma. Borrar una deuda creada por Neo deja su egreso. Editar el monto no ajusta el egreso.
- [P0] Fechas en UTC en toda la app y en Neo (servidor Vercel sin TZ): después de las 21 (AR) se fecha mañana; fin de mes cae en el mes siguiente. ~20 lugares (BottomNav:255, actions.ts:204/278, debts/pay.ts:51, installments pay, crons).
- [P1] Doble toque en "Registrar ✓" (DebtForm, InstallmentForm) duplica deuda / plan de cuotas: sin estado saving ni disabled.
- [P1] Deudas, Cuotas y Metas viven bajo Perfil (junto a Apariencia); Inicio no muestra deudas; el + solo ofrece gasto/ingreso.
- [P2] Moneda default "ARS" hardcodeada en Actividad (historial:364), + (BottomNav:252) y DebtForm:63 en vez de la moneda principal.
- [P2] 22 catch mudos; editar deuda no maneja error.
- [P3] 8 overlays sin Escape; "Registrar pago" en "Me deben" debería decir "Registrar cobro"; badge "default" en inglés; vacío de Deudas sin ejemplo de WhatsApp; aurora infinita.

## Personas
- Fran: carga "4200 queso" 21:23 → aparece del viernes. Crea "Me deben" por web y al cobrar el neto le sube de más. Para ver deudas entra a Perfil.
- Mamá (58, primera vez): toca dos veces "Registrar ✓" porque no ve feedback → deuda duplicada.
- Nico (USD): el + y Deudas arrancan en ARS.

## Preguntas
- ¿Deudas es sección de primer nivel (junto a Actividad) o un bloque en Inicio?
- ¿Zona horaria fija Argentina o por usuario (mudanza a Zug)?
