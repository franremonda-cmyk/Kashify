# Product

## Register

product

## Users

Personas comunes de Argentina, 20-60 años (beta real: Fran + familia — no power-users de
finanzas). Manejan ARS y USD en simultáneo, en contexto de inflación ("gastaste más pesos"
no siempre es "gastaste más"). Usan la app en el celular (PWA), muchas veces después de
dictarle algo a Neo por el Atajo de iPhone (antes era WhatsApp; se abandonó el 31/10/2026). Quieren ver sus números rápido, sin ansiedad, y
volver a lo que estaban haciendo.

## Product Purpose

Kashify es un ledger personal multi-moneda donde Neo (IA) parsea lo que le escribís en lenguaje natural y lo convierte en transacciones. No es un banco ni una app de inversiones — es una libreta inteligente que entiende español rioplatense.

El éxito se ve cuando el usuario dicta "almuerzo 850" y 5 segundos después ve su balance actualizado sin abrir la app.

**El balance es la plata en la mano** (regla de Fran, 05/11/2026): se mueve solo cuando la
plata pasa por tu mano. Un préstamo de hoy resta; una deuda vieja (la plata salió antes de
usar la app, o ya anotaste el gasto que la originó) no. Se decide al anotar la deuda con
«¿Le diste vos esta plata?». Lo que te deben y lo que debés se muestran aparte —debajo del
número y en Pendientes—, nunca sumados al número grande.

## Brand Personality

Preciso. Cálido. Limpio. El instrumento desaparece; los números quedan.

Profesional, ordenado y bonito: cada dato ubicado donde el usuario lo necesita — el
**inicio es un resumen** ("¿cómo vengo?" en segundos), **actividades/historial es el
detalle** (todo bien desglosado). La mascota Neo da calidez sin volver la app un juguete.
Fuente de verdad de la voz: `referencia/neo-voz.md` (workspace) — cálido + tranquilo +
canchero, voseo, nunca culpa.

## Anti-references

- Fintech navy-y-dorado (Mercado Pago, Nubank, bancos tradicionales)
- Fondos crema/beige "editorial cálido" (el look AI de 2026)
- SaaS indigo/morado genérico (Linear, Notion vibes)
- Glassmorphism decorativo (dashboards crypto)
- Gradientes de fondo en el body
- App financiera densa tipo Mint/YNAB (tablas, jerga contable)
- Planilla de Excel (grillas infinitas, todo numérico, sin jerarquía)
- Juguete infantil (la mascota no convierte la plata en un chiche)

## Design Principles

1. **Los números son los protagonistas.** El UI es el telón de fondo, no el espectáculo. Tipografía mono para importes; el diseño no compite con los datos.
2. **Una sola acción obvia.** En cada pantalla hay una cosa principal que hacer. Todo lo demás es contexto.
3. **Sin decoración que no trabaje.** Color, sombra y borde existen para comunicar estado — no para decorar.
4. **Calidez en el tono, no en la paleta.** La personalidad humana va en la copia de Neo, no en fondos crema ni gradientes anaranjados.
5. **Resumen arriba, detalle adentro.** Inicio responde "¿cómo vengo?" de un vistazo; el desglose completo vive en actividades/historial. No mezclar las dos alturas en una pantalla.
6. **Registrar no puede pesar.** Cada campo se explica solo; lo que Neo pueda deducir (categoría, espacio, fecha) lo deduce y el usuario solo confirma.
7. **El puente canal↔web siempre a mano.** Lo que registrás por fuera de la app (hoy el Atajo de iPhone) enlaza a la web para verlo en contexto.

## Accessibility & Inclusion

WCAG AA mínimo. Prioridad: contraste de texto (≥4.5:1 body, ≥3:1 large), touch targets ≥44px, no color como único indicador de estado. Respetar `prefers-reduced-motion` (mascota incluida).

AAA descartado deliberadamente (2026-07-04): exigiría 7:1 en todo texto normal, lo que mata
los grises "muted" del sistema y el verde esmeralda como color de texto; el costo estético
no paga la ganancia para esta audiencia.
