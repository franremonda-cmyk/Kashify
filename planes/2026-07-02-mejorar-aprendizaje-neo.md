# Plan: Mejorar el aprendizaje de Neo (aprende de correcciones, pregunta antes de asumir, monto típico, digest semanal)

**Creado:** 2026-07-02
**Estado:** Borrador
**Pedido:** Que Neo aprenda mejor y use menos IA con el tiempo, priorizando preguntar antes que registrar mal; que aprenda de las correcciones del usuario; que pregunte el monto típico; y que mande un mail semanal solo al operador (Fran) con lo aprendido.

---

## Descripción General

### Qué Logra Este Plan

Convierte el aprendizaje de Neo de "solo aprende cuando Haiku resuelve y auto-registra" a un ciclo robusto y auto-corregible: **aprende de las correcciones del usuario** (el señal más fuerte), **pregunta cuando no está seguro en vez de registrar mal**, ofrece el **monto típico como pregunta** (no autofill), y le manda a Fran un **digest semanal** para auditar. Cada corrección mejora la precisión y baja el uso de IA.

### Por Qué Importa

La visión de Neo es un asistente que "pregunta, aprende, y con el tiempo usa menos tokens porque el aprendizaje reemplaza a la IA". Hoy el ciclo tiene dos fugas: (1) el señal más valioso —cuando el usuario corrige a mano— se ignora; (2) cuando Haiku duda, registra igual y el usuario tiene que ir al dashboard a arreglarlo, que es peor UX que una pregunta rápida. Este plan cierra esas fugas y le da a Fran visibilidad para calibrar.

---

## Estado Actual

### Estructura Existente Relevante

- **Motor Neo** (`src/lib/neo/engine/`): `index.ts` (orquestador `runNeo`), `intent.ts` (`detectIntent` por reglas, 0 tokens), `actions.ts` (`respondFlow`/`executeIntent`), `llm-fallback.ts` (`llmFallback` → Haiku), `types.ts` (`Intent`, `FlowContext`, `NeoState`, `NeoReply`, `LearnedKeyword`).
- **Aprendizaje** (`src/lib/neo/learning.ts`): `extractKeyword` (palabra más larga sin stopwords/verbos), `learnFromConfirmation` (upsert a `parser_rules`: `pattern = keyword|type|currency`, confidence 60, +10 por reuso, guarda `category_id`), `loadLearnedKeywords` (≥60 → detección 0 tokens).
- **Haiku** (`src/lib/neo/haiku-client.ts`): el `SYSTEM_PROMPT` YA pide `confidence` (0-100), `needs_confirmation` (bool) y `question` cuando el tipo/monto no es claro. **El motor los ignora hoy.**
- **Flujo actual (index.ts 64-92):** reglas → si `flow`/intent conocido, ejecuta; si `unknown` → `domainHint` → `llmFallback`. **Si Haiku resuelve, `respondFlow` AUTO-CREA la transacción** y recién ahí `learnFromConfirmation`. Si Haiku falla → estado `clarify_learn` (pide reformular, reinterpreta y aprende del original).
- **Corrección manual:** `PATCH /api/transactions/[id]` (acepta `category_id`, `type`, etc.) — usado por `TransactionSheet` y Quick Add. **No aprende nada.**
- **State machine:** `NeoState` = `flow` | `clarify_learn` | `PendingConfirm`. Multi-turno persiste en `neo_conversation_state` (WhatsApp) y round-trip vía cliente (web). `pending_transactions` existe pero **nadie la inserta** (el `confirmPending` de `NeoChat` es código latente) → para "confirmar antes de registrar" conviene el `NeoState`, no esa tabla.
- **Crons:** `vercel.json` ya tiene 3 (installments, budget-alerts, process-webhook). Sumar uno semanal es trivial. Patrón de cron guard: `authorization: Bearer ${CRON_SECRET}` (ver `api/cron/installments`).
- **`parser_rules`:** definida en `001_initial_schema.sql:160`, global (no por espacio). Próxima migración = **011**.
- **Email:** NO hay infra (grep resend/nodemailer/sendgrid = 0).
- **Tests:** `cloudflare-worker/test/*.test.ts` assert-based, correr con `npx tsx`. Migraciones se corren a mano en Supabase SQL Editor. Verificación E2E es en prod (passkey no anda en localhost).

### Brechas o Problemas que se Abordan

1. **No aprende de correcciones** (el ground truth). Solo del fallback de Haiku.
2. **La confianza solo sube (+10), nunca se corrige.** Una regla mal aprendida queda mal para siempre.
3. **Haiku auto-registra aunque dude** (ignora su propio `confidence`/`needs_confirmation`).
4. **No usa el monto típico** ni pregunta por él.
5. **`extractKeyword` crudo** (palabra más larga; pierde comercios de 2 palabras; match = primer substring sin rankear por confianza).
6. **Sin visibilidad para el operador** de lo que Neo aprende/corrige.

---

## Cambios Propuestos

### Resumen de Cambios

- **Fase 1** — `learnFromCorrection` en `learning.ts` + hook en `PATCH /api/transactions/[id]`: cada corrección de categoría/tipo enseña y **sobrescribe** la regla.
- **Fase 2** — Gate de confirmación en `index.ts`: si Haiku duda (o categoría no matchea), Neo pregunta con `NeoState` `confirm_tx` en vez de crear; aprende al confirmar.
- **Fase 3** — Migración 011 (`last_amount`) + estado `confirm_amount`: keyword conocida sin monto → "¿el mismo de siempre? ($X)".
- **Fase 4** — Resend + cron semanal `/api/cron/neo-digest` → mail solo a Fran con lo aprendido/corregido.
- **Transversal (opcional)** — mejorar `extractKeyword` (bigramas, sustantivo cerca del monto) y rankear matches por `confidence × match_count`.

### Nuevos Archivos a Crear

| Ruta del Archivo | Propósito |
| ---------------- | --------- |
| `supabase/migrations/011_neo_learning.sql` | (1) Agrega `last_amount numeric` y `corrected_count int default 0` a `parser_rules`. (2) Crea `neo_global_rules` (capa global compartida): `keyword`, `category_name`, `type`, `taught_by int`, `confidence`, `updated_at`; RLS de solo-lectura para autenticados (o se inyecta vía service-client). Correr a mano en SQL Editor. |
| `src/app/api/cron/neo-digest/route.ts` | Cron semanal: arma el digest de aprendizaje y lo manda por email a Fran (Fase 4). |
| `src/lib/email.ts` | Wrapper mínimo de email vía Gmail SMTP + nodemailer (`sendEmail({ to, subject, html })`); no-op si faltan envs. |
| `cloudflare-worker/test/learning.test.ts` | Self-check de `learnFromCorrection` + gate de confirmación (Fases 1-2, funciones puras/mock). |

### Archivos a Modificar

| Ruta del Archivo | Cambios |
| ---------------- | ------- |
| `src/lib/neo/learning.ts` | Nueva `learnFromCorrection(supabase, userId, description, type, currency, categoryId)` que sobrescribe la categoría de la regla existente (o crea) y sube confianza a tope + `corrected_count++`. `learnFromConfirmation` guarda `last_amount`. `loadLearnedKeywords` devuelve `last_amount`. Opcional: mejorar `extractKeyword`. |
| `src/app/api/transactions/[id]/route.ts` | Tras un PATCH exitoso, si cambió `category_id` (o `type`), llamar `learnFromCorrection` con la `description` del movimiento (best-effort, no bloquea la respuesta). |
| `src/lib/neo/engine/index.ts` | Gate de confirmación: no auto-crear si Haiku duda → devolver reply de confirmación con `state: { kind: "confirm_tx", ... }`. Nuevo `continueConfirmTx`. Rama de `confirm_amount` (Fase 3). Aprender al confirmar (incl. "otra categoría"). |
| `src/lib/neo/engine/types.ts` | `NeoState` suma `confirm_tx` y `confirm_amount`. `LearnedKeyword` suma `last_amount`. |
| `src/lib/neo/engine/intent.ts` | Rama de keyword aprendida SIN monto → devuelve intent/estado que dispara la pregunta de monto típico (Fase 3). |
| `src/components/NeoChat.tsx` | Manejar los nuevos `options`/estados de confirmación (ya soporta `options` como quick-replies; verificar que el round-trip de `state` cubra `confirm_tx`/`confirm_amount`). |
| `vercel.json` | Agregar cron semanal para `/api/cron/neo-digest` (ej. `0 12 * * 1`). |
| `package.json` | Dependencias `nodemailer` (+ `@types/nodemailer` dev). |
| `.env.local` (y Vercel env) | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OPERATOR_EMAIL=kashify.finanzas@gmail.com`. **Acción manual de Fran** (App Password de Gmail con 2FA). |

### Archivos a Eliminar (si aplica)

Ninguno.

---

## Decisiones de Diseño

### Decisiones Clave Tomadas

1. **"Preguntar, no asumir" vía `NeoState`, no `pending_transactions`.** La tabla `pending_transactions` no la inserta nadie hoy; el state-machine (`clarify_learn`/`flow`) ya funciona en web (round-trip) y WhatsApp (`neo_conversation_state`). Reusarlo es menos código y consistente.
2. **El gate de confirmación solo aplica al fallback LLM.** Las reglas puras y las keywords aprendidas con confianza alta son "obvias" → auto-registran. Solo las interpretaciones frescas de Haiku con `confidence < 85`, `needs_confirmation = true`, o categoría que no matchea una categoría del usuario, disparan la pregunta.
3. **La corrección SOBRESCRIBE, no solo suma.** Si el usuario mueve "uber" de Ocio→Transporte, la regla pasa a Transporte con confianza alta (ground truth pisa lo que dedujo la IA). Se trackea con `corrected_count`.
4. **Monto típico como pregunta, nunca autofill.** En Argentina los montos cambian; se guarda `last_amount` y se ofrece ("¿el mismo de siempre? ($2000)"), pero el usuario confirma o tipea otro.
5. **El digest semanal es solo para Fran (operador), no una feature de usuario.** Va por Resend a `OPERATOR_EMAIL`. Fase última por depender de infra externa.
6. **Aprender también tras confirmación IA.** Si Neo preguntó y el usuario confirmó (o eligió otra categoría), eso se aprende con confianza alta — es tan bueno como una corrección.

### Alternativas Consideradas

- **Usar `pending_transactions` + banner en el dashboard** para las confirmaciones: rechazado, agrega un mecanismo paralelo cuando el state-machine ya resuelve web+WhatsApp; además el banner es más fricción que un quick-reply en el chat.
- **Autofill del monto típico:** rechazado por el usuario (los montos cambian).
- **Digest a todos los usuarios:** fuera de alcance (el pedido es solo para el operador); un feed in-app de "consejos" es la Fase 2 de otro plan (`kashify-neo-aprendizaje`).
- **Gmail MCP para el mail:** restringido al proyecto de empleo con permiso (memoria `gmail-uso-permiso`); mejor un transaccional dedicado (Resend).

### Decisiones Resueltas (respondidas por Fran, 2026-07-02)

1. **Email destino (`OPERATOR_EMAIL`):** `kashify.finanzas@gmail.com` (cuenta de ops del proyecto).
2. **Servicio de email:** como el destino es un Gmail que Fran controla y el digest va a **un solo destinatario interno**, se usa **Gmail SMTP vía `nodemailer` + App Password** de `kashify.finanzas@gmail.com` (no requiere verificar dominio; Fran genera un App Password con 2FA activo). Resend queda como alternativa si más adelante se manda mail a usuarios reales.
3. **Alcance del digest:** **GLOBAL** — cubre a **todos los usuarios** (Neo aprende de todos), y el resumen se manda **solo a Fran**. El digest incluye detalle de reglas nuevas + correcciones de la semana a través de todas las cuentas.
4. **Umbral "obvio":** `confidence >= 85` **y** categoría ∈ categorías del usuario → auto-registra; si no, pregunta. **Confirmado 85.**

### Decisión de arquitectura: aprendizaje en DOS CAPAS (resuelto 2026-07-02)

Fran quiere que Neo aprenda solo (no curar a mano) pero con visibilidad + poder de veto, y que las reglas generales se compartan entre usuarios sin filtrar lo personal.

- **Capa GLOBAL (compartida, tabla nueva `neo_global_rules`):** mapeo `keyword → category_name (canónica) + type`, **sin montos**. Se **promueve automáticamente** cuando ≥ `PROMOTION_THRESHOLD` usuarios distintos enseñan/corrigen el mismo `keyword→categoría`. Aplica a **todos** (incluidos nuevos usuarios → arrancan "inteligentes"). Legible por todos (o inyectada por el service-client en cada request).
- **Capa POR USUARIO (`parser_rules`, RLS, existente):** overrides personales (pisan la global solo para ese usuario) + `last_amount` ("lo de siempre" — SIEMPRE por usuario, nunca global).
- **Orden de resolución en `detectIntent`:** regla personal del usuario → regla global → biblioteca `neo-keywords` (a mano).
- **Filtro de "lo individual":** un apodo/keyword personal lo enseña 1 solo usuario → nunca alcanza el umbral → **nunca se globaliza**. El umbral hace el filtro solo; Fran solo poda casos raros desde el digest.
- **Privacidad:** lo global es keyword→categoría genérica (ej "farmacia→Salud"); no lleva montos ni descripciones de nadie.
- `category_name` canónica: se usa el **nombre** de categoría (las 9 default son iguales para todos). Al aplicar una global, se resuelve nombre → `category_id` del usuario; si la borró/renombró, degrada sin romper.

### Pregunta menor (ajustable después)

- **`PROMOTION_THRESHOLD`:** ¿cuántos usuarios distintos para promover a global? Propuesta: **3** al arrancar (con pocos usuarios beta, quizás 2). Ajustable con el digest.

---

## Tareas Paso a Paso

### Paso 1 (Fase 1): `learnFromCorrection` + hook de corrección (app **y chat**)

**Acciones:**
- En `learning.ts`, agregar `learnFromCorrection(supabase, userId, description, type: "expense"|"income", currency, categoryId)`:
  - `keyword = extractKeyword(description)`; si null, salir.
  - `pattern = keyword|type|currency`. Si existe la regla → `update` seteando `category_id = categoryId` (sobrescribe), `confidence = min(100, max(confidence, 85))`, `corrected_count = corrected_count + 1`. Si no existe → `insert` con confidence 85 y `corrected_count = 1`.
- **Corrección desde la app:** en `PATCH /api/transactions/[id]/route.ts`, tras el `update` exitoso, si cambió `category_id` (o `type`) y el movimiento es `expense`/`income`, llamar `learnFromCorrection(...)` con `data.description` (best-effort `try/catch`).
- **Corrección desde el chat/WhatsApp** (pedido de Fran: "el usuario le pide por whatsapp, modifica el gasto reciente"): nuevo intent en `intent.ts`, ej. `correct_tx_category`, que matchea frases tipo _"el último gasto ponelo en Transporte"_, _"cambiá la categoría del último a Comida"_, _"movelo a Ocio"_, _"ese gasto es Salud"_. En `actions.ts`, el handler:
  - Busca el movimiento a corregir: el **más reciente** (o el que matchee una descripción mencionada) del usuario en el scope activo.
  - Resuelve la categoría destino (`resolveCategoryId`), hace `update` de `category_id`, y llama `learnFromCorrection`.
  - Responde confirmando ("Listo, moví _{desc}_ a {categoría} ✅") con `effect: refresh`.
  - Multi-turno: si hay ambigüedad (varios recientes) puede pedir cuál (patrón `delete_tx` con candidatos).

- **Promoción a global (autónoma):** en `learnFromConfirmation`/`learnFromCorrection`, tras escribir la regla personal, disparar `maybePromoteToGlobal(keyword, category_name, type)`: contar usuarios distintos con esa misma (keyword, category, type) en `parser_rules`; si ≥ `PROMOTION_THRESHOLD` → upsert en `neo_global_rules` (`taught_by`, `confidence`). Best-effort. (Alternativa perf: hacer el conteo/promoción en batch dentro del cron del digest en vez de en cada learn — decidir en implementación según carga.)
- **Resolución en dos capas:** `loadLearnedKeywords` (o una nueva `loadRules`) combina: reglas **personales** del usuario (pisan) + reglas **globales** de `neo_global_rules`. La global aporta `type`+`category_name` (se resuelve a `category_id` del usuario al usarla); el `last_amount` sale siempre de la regla personal.

**Archivos afectados:** `src/lib/neo/learning.ts`, `src/app/api/transactions/[id]/route.ts`, `src/lib/neo/engine/intent.ts`, `src/lib/neo/engine/actions.ts`, `src/lib/neo/engine/types.ts`, `supabase/migrations/011_neo_learning.sql`.

---

### Paso 2 (Fase 2): Gate de confirmación en el motor

**Acciones:**
- `types.ts`: agregar a `NeoState` el estado `{ kind: "confirm_tx"; parsed: ParsedTransactionLike; spaceId?: string | null }` (guardar lo necesario para crear: type, amount, currency, description, category).
- `index.ts`: donde hoy hace `if (fallback) { respondFlow → crea → learn }`, insertar el gate:
  - Calcular `obvio = fallback.parsed.confidence >= 85 && !fallback.parsed.needs_confirmation && categoríaMatcheaUnaDelUsuario`.
  - Si `obvio` → comportamiento actual (crear + `learnFromConfirmation`).
  - Si NO → devolver `{ text: "Anoto: {desc} — {sym}{amount} en {categoría}. ¿Va?", options: ["Sí", "Otra categoría", "No"], state: { kind: "confirm_tx", parsed, spaceId } }`. NO crear todavía.
- Nuevo `continueConfirmTx(supabase, userId, state, message, channel)` (análogo a `continueClarifyLearn`):
  - "Sí"/afirmativo → `respondFlow` crea + `learnFromConfirmation` (confianza alta) → limpiar estado.
  - "Otra categoría" → responder con la lista de categorías como `options`; guardar estado `confirm_tx` con flag `awaitingCategory`. Al recibir la categoría elegida → crear con esa categoría + `learnFromCorrection` (ground truth) → limpiar.
  - "No"/cancel → descartar, `state: null`.
- En `runNeo`, rutear `state.kind === "confirm_tx"` a `continueConfirmTx` (junto a `clarify_learn`).
- `NeoChat.tsx`: confirmar que renderiza `options` como quick-replies (ya lo hace en el `inputBar`) y que el round-trip de `state` incluye el nuevo kind (el cliente reenvía `state` tal cual).

**Archivos afectados:** `src/lib/neo/engine/types.ts`, `src/lib/neo/engine/index.ts`, `src/components/NeoChat.tsx` (verificación).

---

### Paso 3 (Fase 3): Monto típico como pregunta

**Acciones:**
- **Migración** `011_neo_learning.sql`: (a) `alter table parser_rules add column last_amount numeric; add column corrected_count int not null default 0;`. (b) `create table neo_global_rules (...)` (capa global). (Fran la corre en SQL Editor.)
- `learning.ts`: `learnFromConfirmation` y `learnFromCorrection` guardan `last_amount = parsed.amount` (cuando hay monto > 0). `loadLearnedKeywords` incluye `last_amount`. `LearnedKeyword` (types) suma `last_amount: number | null`.
- `types.ts`: `NeoState` suma `{ kind: "confirm_amount"; keyword; type; category; currency; lastAmount }`.
- `intent.ts`: en la rama de keywords aprendidas, si hay una keyword conocida **sin** monto en el mensaje y esa regla tiene `last_amount` → devolver un intent/marcador que `index.ts` traduce a: `{ text: "¿{keyword} por el mismo de siempre? ({sym}{lastAmount})", options: ["Sí", "Otro monto"], state: { kind: "confirm_amount", ... } }`.
- `index.ts`: `continueConfirmAmount`: "Sí" → crear con `lastAmount` + learn; "Otro monto" o un número → usar ese monto; cancel → descartar.

**Archivos afectados:** `supabase/migrations/011_parser_rules_amount.sql`, `src/lib/neo/learning.ts`, `src/lib/neo/engine/types.ts`, `src/lib/neo/engine/intent.ts`, `src/lib/neo/engine/index.ts`.

---

### Paso 4 (Transversal, opcional): Mejorar extracción/matching de keywords

**Acciones:**
- `extractKeyword`: además de la palabra más larga, considerar **bigrama** si dos palabras de contenido son adyacentes ("mercado libre"), y preferir el sustantivo **cercano al monto**.
- En `intent.ts`, la rama de keywords aprendidas: rankear los hits por `confidence × match_count` (traerlo en `loadLearnedKeywords`) en vez de "primer substring que pega".
- Cubrir con casos en el test.

**Archivos afectados:** `src/lib/neo/learning.ts`, `src/lib/neo/engine/intent.ts`, `src/lib/neo/engine/types.ts`.

---

### Paso 5 (Fase 4): Infra de email (Gmail SMTP + nodemailer)

**Acciones (Fran, manual):** en `kashify.finanzas@gmail.com` activar 2FA y generar un **App Password** de Gmail; setear en `.env.local` + Vercel: `GMAIL_USER=kashify.finanzas@gmail.com`, `GMAIL_APP_PASSWORD=...`, `OPERATOR_EMAIL=kashify.finanzas@gmail.com`.
**Acciones (código):**
- `npm i nodemailer` (+ `@types/nodemailer` dev).
- `src/lib/email.ts`: `sendEmail({ to, subject, html })` con `nodemailer` (transport `service: "gmail"`, auth con `GMAIL_USER`/`GMAIL_APP_PASSWORD`); no-op con warning si faltan envs (no rompe dev/build).

**Archivos afectados:** `package.json`, `src/lib/email.ts`, `.env.local`.

---

### Paso 6 (Fase 4): Cron semanal del digest

**Acciones:**
- `src/app/api/cron/neo-digest/route.ts`: guard `CRON_SECRET`. Con **service client** (RLS bypass → alcance GLOBAL). (Opcional) correr aquí la **promoción a global** en batch. Armar el digest: **reglas promovidas a `neo_global_rules` esta semana**, correcciones (`corrected_count`), top keywords aprendidas, contadores agregados (reglas nuevas, correcciones, y si se instrumenta % resuelto sin IA), y **anomalías** (reglas globales con confianza rara). HTML simple. `sendEmail({ to: OPERATOR_EMAIL, subject: "Neo · resumen semanal", html })` — **solo a Fran**. Incluir cómo podar una global (link a un admin mínimo o instrucción SQL) — Fran ve y veta, no aprueba cada una.
- `vercel.json`: agregar `{ "path": "/api/cron/neo-digest", "schedule": "0 12 * * 1" }` (lunes 12:00 UTC).
- (Opcional) instrumentar un contador liviano rules-vs-LLM para el "% sin IA" (tabla o log agregable); si es mucho, dejar solo conteo de reglas/correcciones en v1.

**Archivos afectados:** `src/app/api/cron/neo-digest/route.ts`, `vercel.json`.

---

### Paso 7: Tests y validación

**Acciones:**
- `cloudflare-worker/test/learning.test.ts`: `learnFromCorrection` sobrescribe categoría y sube confianza; `extractKeyword` (casos bigrama si se implementó). Con stub de Supabase (patrón de `engine.test.ts`).
- Extender `cloudflare-worker/test/engine.test.ts`: fallback dudoso → pide confirmación (no crea); "Sí" crea+aprende; "Otra categoría" → elige → crea+corrige; keyword sin monto → pregunta monto típico; "Sí" usa `last_amount`.
- Correr `npx tsx cloudflare-worker/test/*.test.ts`, `npx tsc --noEmit`, `npm run build`.
- Deploy a Vercel; E2E en prod (chat web + WhatsApp): registrar algo dudoso → Neo pregunta; corregir una categoría en la app → la próxima vez la acierta; keyword sin monto → pregunta el típico.

**Archivos afectados:** `cloudflare-worker/test/learning.test.ts`, `cloudflare-worker/test/engine.test.ts`.

---

## Conexiones y Dependencias

### Archivos que Referencian Esta Área

- `src/app/api/neo/chat/route.ts` (web) y `src/app/api/process-webhook/route.ts` (WhatsApp) → ambos llaman `runNeo`; heredan el nuevo comportamiento sin cambios (son adaptadores delgados). Verificar que reenvían `state`.
- `src/components/NeoChat.tsx` → renderiza `options`/`text`/round-trip de `state`.
- `neo_conversation_state` (migración 007) → persiste los nuevos estados en WhatsApp (ya aplicada).

### Actualizaciones Necesarias para Consistencia

- `CLAUDE.md` (raíz del workspace) y `proyectos/neo-app` docs: mencionar el nuevo cron y el flujo de confirmación si corresponde.
- Memoria del proyecto (`kashify-neo-aprendizaje`): actualizar al implementar.

### Impacto en Flujos de Trabajo Existentes

- El registro por chat cambia: mensajes dudosos ahora **preguntan** en vez de registrar. Es intencional; puede sentirse "más lento" en casos borde, pero evita basura. El `NEO_LLM_FALLBACK=false` sigue funcionando (cae a clarify).
- El PATCH de transacciones ahora también aprende (best-effort, no cambia su contrato).

---

## Lista de Validación

- [ ] Corregir la categoría de un movimiento crea/actualiza la regla en `parser_rules` (categoría sobrescrita, `corrected_count++`).
- [ ] Un mensaje dudoso por Haiku hace que Neo **pregunte** (no registra); "Sí" registra y aprende; "Otra categoría" registra con la elegida y corrige la regla.
- [ ] Escribir una keyword conocida sin monto dispara "¿el mismo de siempre? ($X)"; "Sí" usa `last_amount`.
- [ ] Migración 011 corrida en Supabase (columnas `last_amount`, `corrected_count`).
- [ ] `npx tsx` de los tests verde; `tsc --noEmit` y `build` OK.
- [ ] Cron `/api/cron/neo-digest` responde 200 con `CRON_SECRET` y manda el mail solo a `OPERATOR_EMAIL`.
- [ ] `vercel.json` con el cron semanal; envs de Resend en Vercel.
- [ ] WhatsApp y web comparten el comportamiento (mismo `runNeo`).

---

## Criterios de Éxito

1. Neo **aprende de correcciones**: tras corregir "uber" a Transporte una vez, el próximo "uber 1500" cae en Transporte sin IA.
2. Neo **pregunta antes de registrar** cuando duda; deja de crear movimientos mal categorizados que obligan a ir al dashboard.
3. Neo **ofrece el monto típico** como pregunta cuando falta el monto de una keyword conocida.
4. Fran recibe **un mail semanal** (solo él) con lo que Neo aprendió/corrigió, para calibrar.
5. Baja medible (o al menos observable) del uso de Haiku a igualdad de mensajes.

---

## Notas

- **Orden de implementación sugerido:** Fase 1 → Fase 2 → Fase 3 → (Transversal) → Fase 4. Las 1-3 no dependen de nada externo; la 4 espera la cuenta/API key de Resend de Fran.
- **Riesgo del gate de confirmación:** si el umbral es muy agresivo, Neo pregunta de más y molesta. Empezar en `confidence >= 85` y ajustar con el digest.
- **Privacidad del digest global:** nunca incluir descripciones/montos de transacciones de otros usuarios; solo contadores agregados.
- **`extractKeyword`** sigue siendo heurístico; el digest semanal es justamente para cazar reglas raras y corregirlas.
- Relacionado: `kashify-neo-aprendizaje` (Fase 2 de consejos in-app, otro plan), `src/lib/recurring.ts` (recurrentes, ya construido — el `last_amount` se apoya en la misma idea).
