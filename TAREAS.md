# Kashify — Tareas y fechas

**Este archivo NO se reescribe: se actualiza.** Es la única lista de pendientes del proyecto.

🔴 **Regla (Fran, 19/10/2026):** se lee **al abrir cualquier sesión de Kashify**, antes de ponerse a
trabajar, y se reporta lo que vence hoy o está vencido. Cuando una tarea cambia de estado se edita
acá **en el momento**, no al cierre.

**Las fechas van en `AAAA-MM-DD`** para que `python3 agenda.py` las pueda leer. Sin ese formato, la
tarea no aparece en el aviso.

Estados: ⏳ pendiente · 🔜 vence pronto · 🔴 vencida · ✅ hecha (se deja una semana y se borra)

---

## Con fecha

| Fecha | Qué | Quién | Estado |
|---|---|---|---|
| `2026-10-26` | ✅ **El número de WhatsApp volvió a andar.** Estaba en `status: PENDING` / `platform_type: NOT_APPLICABLE` y Meta devolvía `(#133010) The account is not registered`: el número no estaba registrado en la Cloud API, lo que explicaba a la vez que los mensajes no llegaran y que no se viera la foto de perfil. Se arregló con `POST /{PHONE_NUMBER_ID}/register` (lo corrió Fran, el POST está bloqueado para Claude). Quedó `CONNECTED` / `CLOUD_API` / `throughput: STANDARD` / `quality_rating: GREEN`. **PIN de dos pasos: está en `.env.local` como `WHATSAPP_TWO_STEP_PIN`** (no se commitea). **Causa encontrada el mismo día en «Check test webhooks» del panel de Meta** (no era cierto que no hubiera registro): el 25/10 17:33:59 llegó un `account_update` con `{"event": "ACCOUNT_DELETED"}` sobre el WABA `888236463637738`. Según el changelog de Meta, `ACCOUNT_DELETED` significa «un número fue desregistrado o eliminado de una cuenta de WhatsApp Business» — no que se borrara la cuenta. Línea de tiempo: `messages` OK el 22/10 22:04 · dos `account_update` el 24/10 01:55:54 y 01:55:55 · otro el 24/10 14:18 · `ACCOUNT_DELETED` el 25/10 17:33. **Falta leer los payloads de los tres del 24/10**, que son los que dicen qué lo disparó | Fran corrió, Claude diagnosticó | ✅ |
| `2026-10-26` | ✅ **PROBADO PUNTA A PUNTA: Neo contesta y la foto se ve.** Fran mandó `café 1200` y Neo respondió. El circuito entero (teléfono → worker de Cloudflare → Vercel → Supabase → Neo → teléfono) funciona. **Para destrabarlo hubo que pelear con el caché del cliente de WhatsApp:** el teléfono seguía diciendo «esta persona ya no está en WhatsApp» y no dejaba escribir, aun con el número ya `CONNECTED` y con el `hello_world` recibido. Se arregló borrando el contacto de la agenda del iPhone, borrando el chat y volviendo a crear el contacto con `+1 555 659 7324`. **Anotado porque va a volver a pasar si el número se desregistra de nuevo: el estado de Meta y lo que cree tu teléfono son dos cosas distintas.** Envío de prueba: `./scripts/probar-whatsapp.sh <tu-numero-sin-el-+>` (plantilla `hello_world`; el botón del panel de Meta NO sirve, pide su propio token temporal) | Fran + Claude | ✅ |
| `2026-10-26` | ✅ **Foto de perfil de Neo repuesta y verificada.** El perfil había quedado vacío al desregistrarse el número. Subida con `./scripts/subir-foto-perfil-neo.sh` (`perfil-whatsapp-idle.png`, 640×640), `{"success":true}`, y confirmada por API: `profile_picture_url` presente y la descripción «Neo registra tus gastos e ingresos por WhatsApp…» de vuelta. Fran la ve en el chat | Claude escribió el script, Fran lo corrió | ✅ |
| `2026-10-26` | ⏳ **La sesión de Cloudflare caducó:** `npx wrangler whoami` tira `Failed to fetch auth token: 400 Bad Request`. Sin eso no se pueden ver los logs del worker (`npx wrangler tail neo-webhook`) ni deployarlo. Arreglo: `cd cloudflare-worker && npx wrangler login`, con la cuenta `kashify.finanzas@gmail.com`. **La URL pública del worker no está anotada en ningún archivo del workspace: anotarla acá cuando se entre** | Fran entra, Claude anota | ⏳ |
| `2026-10-26` | ⏳ **Leer los tres `account_update` del 24/10** en «Check test webhooks» (panel de Meta → Step 1. Try it out): 01:55:54, 01:55:55 y 14:18. Dicen qué desregistró el número. Dos en el mismo segundo a las 2 AM no los dispara una persona | Fran mira, Claude interpreta | ⏳ |
| `2026-10-20` | 🔴 **El `SUPABASE_ACCESS_TOKEN` del MCP `supabase-kashify` da «Invalid access token»** (detectado el 20/10 desde Tempo). Hay que renovar el Personal Access Token en el panel de Supabase y pegarlo en `proyectos/neo-app/.mcp.json`. Sin eso Claude no puede leer la base en vivo | Fran | 🔴 |

## Sin fecha todavía

| Qué | Quién | Estado |
|---|---|---|
| 🔴 **El número actual es el de prueba de Meta** (`+1 555-659-7324`, nombre «Test Number»): solo puede escribirle a **5 destinatarios cargados a mano** en el panel. Alcanza para que Fran lo pruebe, **no alcanza para que entre la familia**. Para eso hace falta un número propio y verificación de negocio en Meta. Es el bloqueante real del punto 3 del roadmap (invitar usuarios) | Fran decide cuándo | ⏳ |
| Los tres puntos del roadmap viejo (navegación · Neo+WhatsApp · usuarios) están cumplidos a nivel código: 11 pantallas, worker + webhook + 4 crons, y `/onboarding`. Falta definir qué sigue: usar la app y anotar lo que molesta, o abrirla a la familia | Fran | ⏳ |
