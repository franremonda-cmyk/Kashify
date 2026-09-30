import { detectPurchaseIntent, categoryForText } from "@/lib/neo-keywords";
import type { DebtDirection } from "@/types";
import { DEFAULT_TZ, isoDay } from "@/lib/dates";
import type { Intent, LearnedKeyword } from "./types";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Símbolo de moneda pegado al número ("$4000", "u$s 500"): despegarlo para que
    // el parser de monto lo agarre. Se preserva "usd" antes de sacar el "$" para no
    // perder la señal de dólar. En AR "$" solo = pesos (default), así que se descarta.
    .replace(/u\$s|us\$/g, " usd ")
    .replace(/\$/g, " ")
    // Montos hablados: "5k", "5 mil", "5 lucas", "1,5 lucas", "2 palos", "una
    // luca". Sin esto "5 lucas nafta" se anotaba como $5 (el parser toma los dígitos).
    .replace(/\buna\s+luca\b/g, "1000")
    .replace(/\bun\s+palo\b/g, "1000000")
    .replace(/(\d+(?:[.,]\d+)?)\s*(k|mil|lucas?|palos?|millon(?:es)?)\b/g, (_, n: string, u: string) =>
      String(Math.round(parseFloat(n.replace(",", ".")) * (/^(?:k|mil|luca)/.test(u) ? 1000 : 1_000_000))))
    // Emojis fuera: "presté 5000 a Juan 🙂" dejaba "Juan 🙂" de contraparte y un
    // emoji al final rompía los regex anclados con $.
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

// "cancelá" / "dejá" / "no" sueltos = descartar lo pendiente. Pero "cancelá la
// cuota de iPhone" es un comando sobre un objeto, no un descarte: sin esto el
// bloque de dismiss se comía el ejemplo que la propia ayuda de Neo publicita.
// (normalize() ya sacó los acentos, por eso "limite"/"categoria" van sin tilde)
const DISMISS_OBJECT = /\s+(?:la|el|mi|los|las|mis)?\s*(?:cuota|deuda|plan|meta|objetivo|ahorro|limite|presupuesto|gasto|ingreso|movimiento|transaccion|categoria|espacio)/;

// detectIntent trabaja sobre el texto normalizado (minúsculas y sin tildes),
// así que un nombre capturado ahí se guardaría como "diversion" o "freelance".
// Esto recupera el fragmento TAL CUAL lo escribió el usuario, alineando por
// palabras (normalize() no parte palabras salvo en montos con símbolo).
// Si no lo encuentra, devuelve el fragmento normalizado: peor formato, nunca
// un dato equivocado.
const TRAIL_PUNCT = /[.,!?;:]+$/;
function denormalize(original: string, fragment: string): string {
  const want = fragment.trim().replace(TRAIL_PUNCT, "");
  if (!want) return fragment.trim();
  const origWords = original.trim().split(/\s+/);
  const wantLen = want.split(/\s+/).length;
  for (let i = 0; i + wantLen <= origWords.length; i++) {
    const slice = origWords.slice(i, i + wantLen).join(" ");
    if (normalize(slice).replace(TRAIL_PUNCT, "") === want) return slice.replace(TRAIL_PUNCT, "");
  }
  return want;
}

// Para nombres propios que se muestran como título (espacios, categorías,
// metas, contrapartes de deuda). Después de denormalize: si lo escribiste con
// mayúscula ya viene bien, y si no, al menos no queda todo en minúscula.
function titleCase(s: string): string {
  return s.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

// denormalize + titleCase, que es lo que quieren casi todos los nombres.
function properName(original: string, fragment: string): string {
  return titleCase(denormalize(original, fragment));
}

// Fechas habladas → ISO. Solo lo que la gente dice de verdad al corregir algo
// recién anotado: nada de "el tercer martes de marzo".
function parseWhen(s: string): string | null {
  const t = s.trim();
  // ponytail: zona fija AR (detectIntent es puro, no conoce al usuario); pasar la zona del perfil si hay usuarios fuera de AR.
  const iso = (d: Date) => isoDay(d, DEFAULT_TZ);
  const shift = (days: number) => iso(new Date(Date.now() - days * 86_400_000));
  if (/^hoy$/.test(t)) return shift(0);
  if (/^ayer$/.test(t)) return shift(1);
  if (/^(?:anteayer|antes de ayer)$/.test(t)) return shift(2);
  const dm = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (dm) {
    const day = Number(dm[1]), month = Number(dm[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const year = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : new Date().getFullYear();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

// "solo en diciembre" / "solo en enero y febrero" → [12] / [1, 2].
// Devuelve también el texto sin esa cola, para que no ensucie la categoría.
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function splitMonths(s: string): { rest: string; months?: number[] } {
  const m = s.match(/^(.*?)\s+(?:solo|unicamente|nada mas)\s+(?:en|para|durante)\s+(.+)$/);
  if (!m) return { rest: s };
  const found = MESES
    .map((name, i) => (m[2].includes(name) || m[2].includes(name.slice(0, 4)) ? i + 1 : 0))
    .filter((n) => n > 0);
  return found.length ? { rest: m[1].trim(), months: found } : { rest: s };
}

// Moneda mencionada explícitamente en un texto de deuda (ya normalizado, sin
// tildes). undefined = sin mención → el flujo usa la moneda principal del user.
// Se limita a códigos + palabras inequívocas: "franco"/"real" chocan con nombres.
function debtCurrency(m: string): string | undefined {
  if (/\b(usd|dolares?|dolar)\b/.test(m)) return "USD";
  if (/\b(eur|euros?)\b/.test(m)) return "EUR";
  if (/\bchf\b/.test(m)) return "CHF";
  if (/\bbrl\b/.test(m)) return "BRL";
  return undefined;
}
const DEBT_CURRENCY_WORDS = /\b(usd|dolares?|dolar|eur|euros?|chf|brl)\b/g;

// La gente no dice las deudas siempre igual: "le presté a mamá 100000" dejaba
// "mamá 100000" como contraparte, y "le adelanté", "juan me tiene que dar" o
// "le pagué a juan 5000" terminaban en gastos basura. Se lleva el texto a la
// forma canónica que entienden los regex de abajo (sinónimos primero, después
// el orden), así cada regla nueva no tiene que contemplar todas las variantes.
// El nombre no puede arrancar con artículo/preposición: "me devolvieron 5000 del
// impuesto" no es una deuda con "del impuesto".
const DEBT_VERB_OUT = "(?:yo\\s+)?(?:le\\s+)?(?:preste|fie|debo|pag(?:ue|o)|devolvi|di)";
const DEBT_VERB_IN = "(?:debe[n]?|prest(?:o|aron)|pag(?:o|aron)|devolvi(?:o|eron))";
const NOT_A_NAME = "(?!(?:de|del|al|el|la|los|las|por|en|para|un|una|lo)\\b)";
const N = "\\d[\\d.,]*";
function debtCanonical(md: string): string {
  return md
    // Sinónimos → el verbo canónico.
    .replace(/\bdeve(n?)\b/g, "debe$1") // "me deve" (b/v)
    .replace(/\bme\s+tiene[n]?\s+que\s+(?:dar|devolver|pagar)\b|\btiene[n]?\s+que\s+(?:darme|devolverme|pagarme)\b/g, "me debe")
    .replace(/^(?:yo\s+)?(?:le\s+)?tengo\s+que\s+(?:dar|pagar|devolver)(?:le)?\b/, "le debo")
    .replace(/\badelante\b/g, "preste")
    .replace(/^prestamo\s+(?:de\s+)?(?=a\s|\d)/, "preste ")
    // "le pasé/tiré/transferí/giré N a juan": sale plata hacia alguien = como
    // "le pagué" (salda si le debías; si no, queda como egreso). Solo con "le":
    // "transferí 5000 a mi cuenta" no es plata a una persona.
    .replace(/\ble\s+(?:pase|tire|transferi|gire)\b/g, "le pague")
    .replace(/\bme\s+transfiri(o|eron)\b/g, (_, s: string) => (s === "o" ? "me pago" : "me pagaron"))
    // "le cobré N a juan" / "cobré a juan N" = juan me pagó.
    .replace(new RegExp(`^(?:le\\s+)?cobre\\s+(${N})\\s+a\\s+(.+)$`), "$2 me pago $1")
    .replace(new RegExp(`^(?:le\\s+)?cobre\\s+a\\s+(.+?)\\s+(${N})$`), "$1 me pago $2")
    // "juan me pagó 5000 de lo que me debe" → la cola no aporta.
    .replace(/\s+de\s+lo\s+que\s+(?:me\s+|le\s+)?deb\w*$/, "")
    // Orden: "le presté a mamá 100000 [para X]" → "le presté 100000 a mamá [para X]"
    .replace(new RegExp(`^(${DEBT_VERB_OUT})\\s+(?:plata\\s+)?a\\s+(.+?)\\s+(\\d[\\d.,]*)((?:\\s+para\\s+.+)?)$`), "$1 $3 a $2$4")
    // "a mamá le presté 100000" → "le presté 100000 a mamá"
    .replace(new RegExp(`^a\\s+(.+?)\\s+(le\\s+(?:preste|fie|debo|pag(?:ue|o)|devolvi|di))\\s+(\\d[\\d.,]*)((?:\\s+para\\s+.+)?)$`), "$2 $3 a $1$4")
    // "me debe mamá 100000" / "me prestó 5000 juan" → "mamá me debe 100000"
    .replace(new RegExp(`^me\\s+(${DEBT_VERB_IN})\\s+${NOT_A_NAME}(\\D+?)\\s+(\\d[\\d.,]*)$`), "$2 me $1 $3")
    .replace(new RegExp(`^me\\s+(${DEBT_VERB_IN})\\s+(\\d[\\d.,]*)\\s+${NOT_A_NAME}(\\D+)$`), "$3 me $1 $2");
}

// Alta de deuda: los slots que falten los pregunta el flujo (flow.ts).
// opts.originExpense: nació de un "presté/fié" → el flujo registra también el
// egreso. opts.rawMotivo: el "para <motivo>", que va como descripción del egreso.
// opts.currency: moneda explícita ("100 usd") → viaja al flujo.
function debtFlow(
  msg: string,
  direction: DebtDirection,
  who?: string,
  rawAmount?: string,
  opts?: { originExpense?: boolean; rawMotivo?: string; currency?: string },
): Intent {
  const amount = rawAmount ? parseAmount(rawAmount) : NaN;
  const cleaned = who?.replace(/^(?:a\s+|mi\s+amigo\s+|mi\s+amiga\s+)/, "").replace(/[.!?]+$/, "").trim();
  const motivo = opts?.rawMotivo?.replace(/[.!?]+$/, "").trim();
  return {
    type: "flow",
    ctx: {
      flow: "debt",
      direction,
      ...(opts?.currency ? { currency: opts.currency } : {}),
      counterparty: cleaned ? properName(msg, cleaned) : undefined,
      amount: !isNaN(amount) && amount > 0 ? amount : undefined,
      ...(opts?.originExpense ? { originExpense: true as const } : {}),
      ...(motivo ? { description: denormalize(msg, motivo) } : {}),
    },
  };
}

// Detección de intención 100% por reglas (0 tokens). `learnedKeywords` son
// patrones que el usuario enseñó antes (vía fallback Haiku + confirmación), que
// permiten resolver sin volver a gastar tokens.
export function detectIntent(msg: string, learnedKeywords: LearnedKeyword[] = []): Intent {
  const m = normalize(msg);

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (/^(hola|buen[ao]s?|hey|hi|buenas tardes|buenas noches|buen dia|buen día|que tal|como estas?|como andas?|ola|saludos|buenas)\b/.test(m))
    return { type: "greeting" };

  // ── Silenciar / reactivar familias de aviso ───────────────────────────────
  // VA ANTES del descarte: "no me avises más de logros" empieza con "no" y si
  // no, el bloque de dismiss se lo comería como un "cancelá lo pendiente".
  {
    const mute = m.match(/^(?:no\s+me\s+avises\s+(?:mas\s+)?(?:de|sobre|con)|deja\s+de\s+avisarme\s+(?:de|sobre|con)|silencia\w*\s+(?:los\s+)?avisos\s+(?:de|sobre)|no\s+quiero\s+(?:mas\s+)?avisos\s+(?:de|sobre))\s+(?:los\s+|las\s+)?(.+)$/);
    if (mute) return { type: "mute_notifs", family: mute[1].trim(), enable: false };

    const unmute = m.match(/^(?:volve\w*\s+a\s+avisarme\s+(?:de|sobre)|activa\w*\s+(?:los\s+)?avisos\s+(?:de|sobre)|quiero\s+(?:los\s+)?avisos\s+(?:de|sobre))\s+(?:los\s+|las\s+)?(.+)$/);
    if (unmute) return { type: "mute_notifs", family: unmute[1].trim(), enable: true };
  }

  // ── Cancel / dismiss ──────────────────────────────────────────────────────
  if (/^(no|nada|olvida(lo)?|cancela(lo)?|deja(lo)?|no importa|igual|salir|stop|listo gracias|no gracias|dejame)\b/.test(m) && !DISMISS_OBJECT.test(m))
    return { type: "cancel_pending" };

  // ── Help ──────────────────────────────────────────────────────────────────
  if (/ayuda|help|men[uú]|info|que pod[eé]s hacer|que puedes hacer|como te uso|como funciona[s]?|comandos|que hac[eé]s|que se puede|instrucciones|para que sirv[eé]s|que sos/.test(m))
    return { type: "help" };

  // ── Exportar ──────────────────────────────────────────────────────────────
  // Antes de spending_query: "pasame mis gastos en csv" contiene "mis gastos".
  if (/export|descargar\s+(?:mis\s+)?(?:datos|gastos|movimientos)|pasame\s+(?:mis\s+)?(?:datos|gastos|movimientos)\s+en\s+(?:csv|excel)|backup|csv|excel/.test(m))
    return { type: "export_query" };

  // ── Balance ───────────────────────────────────────────────────────────────
  if (/saldo|cuanto tengo|mis cuentas|mis balances|cuanta plata|cuanto hay|mi balance|ver balance|como estoy financieramente|como ando|como voy de plata|situacion financiera|plata que tengo|cuanto dinero|cuanto efectivo|cuanto me queda en total/.test(m) && !/\bdeb[eo]n?\b/.test(m))
    return { type: "balance_query" };

  // ── Summary ───────────────────────────────────────────────────────────────
  if (/resumen del mes|resumen mensual|^resumen$|como voy este mes|como voy en el mes|situacion del mes|balance del mes/.test(m))
    return { type: "summary_query" };

  // ── Income query ──────────────────────────────────────────────────────────
  if (/cuanto cobr[eé]|mis? ingresos?|cual(es)? (fue|fueron|es|son)\s+mis?\s+ingresos?|mi ingreso|cuanto ingres[eé]|cuanto entro|cuanto entró|cuanto me entro|cuanto entre\b|ingresos? del mes|ingreso de este mes|ingresos? de esta semana|ingresos? de hoy|cuanto gane este mes|cuanto gané este mes/.test(m)) {
    const period = /esta semana|semana/.test(m) ? "week" : /hoy/.test(m) ? "today" : "month";
    return { type: "income_query", period };
  }

  // ── Spending query ────────────────────────────────────────────────────────
  if (/cuanto gaste|cuanto gasté|cuanto he gastado|mis? gastos?|cual(es)? (fue|fueron|es|son)\s+mis?\s+gastos?|mi gasto|gaste esta|gasté esta|gaste hoy|gasté hoy|en que gaste|en que gasté|en qué gasté|que gaste|qué gasté|cuanto se fue|cuanto se gastó|gastos? del mes|gastos? de hoy|gastos? de esta semana|cuanto salio|cuanto salió|mis egresos|gastos totales|cuanto llevo gastado/.test(m)) {
    const catMatch = m.match(/en\s+([a-záéíóúñ\w]+)(?:\s|$)/);
    const period = /esta semana|semana/.test(m) ? "week" : /hoy/.test(m) ? "today" : "month";
    return { type: "spending_query", category: catMatch?.[1], period };
  }

  // ── Recent transactions ───────────────────────────────────────────────────
  if (/ultimas transacciones|últimas transacciones|mis ultimas|mis últimas|ver transacciones|que registre|qué registré|que anote|qué anoté|ultimos gastos|últimos gastos|que compre\b|qué compré|historial|mis movimientos|movimientos recientes|ver movimientos|que registré hoy|últimos registros/.test(m))
    return { type: "recent_tx_query" };

  // ── Budget / limits ───────────────────────────────────────────────────────
  if (/mis limites|mis límites|ver limites|ver límites|cuanto me queda|cuánto me queda|cuanto tengo de|cuánto tengo de|me queda en|cuanto puedo gastar|que puedo gastar|mis presupuestos/.test(m))
    return { type: "budget_query" };

  // ── Goals ─────────────────────────────────────────────────────────────────
  if (/mis metas|ver metas|como van mis metas|mis ahorros|como van mis ahorros|cuanto ahorr[eé]|cuánto ahorré|progreso de mis metas|metas de ahorro|cuanto llevo ahorrado|mis objetivos|ahorros/.test(m))
    return { type: "goals_query" };

  // ── Deudas (sector /deudas: plata entre personas) ─────────────────────────
  // Va ANTES de installments_query: "cuánto debo" y "mis deudas" respondían
  // sobre CUOTAS. Y muy por encima de delete_tx (goloso) y del registro pelado,
  // que anotaban "debo 10000 a juan" como un gasto llamado "debo a juan".
  {
    // Consultas
    if (/cuant[ao]s?\s+(?:plata\s+)?me\s+debe[n]?|quien(?:es)?\s+me\s+debe[n]?|me\s+deben\s+plata/.test(m))
      return { type: "debts_query", direction: "me_deben" };
    if (/cuant[ao]s?\s+(?:plata\s+)?(?:le[s]?\s+)?debo|a\s+quien(?:es)?\s+le[s]?\s+debo/.test(m))
      return { type: "debts_query", direction: "debo" };
    if (/mis\s+deudas|ver\s+deudas|deudas\s+activas|deudas\s+pendientes|mis\s+prestamos|que\s+deudas|^(?:las\s+)?deudas\??$/.test(m))
      return { type: "debts_query" };

    // Varios montos en un mensaje ("nafta 5000 y super 3000"): los regex toman
    // uno solo y el resto se perdía sin aviso. Mejor pedirlos de a uno.
    if (m.split(/\s+y\s+|,\s+/).filter((p) => /\d/.test(p)).length >= 2) return { type: "multi_amount" };

    // Moneda explícita ("nico me debe 100 usd", "presté 50 eur a ana"): se saca
    // del string de trabajo `md` para que los regex de monto no choquen ($ y u$s
    // ya los limpió normalize), y se guarda aparte para que viaje al flujo.
    const dc = debtCurrency(m);
    const md = debtCanonical(dc ? m.replace(DEBT_CURRENCY_WORDS, "").replace(/\s+/g, " ").trim() : m);

    // Alta — yo debo
    const owe = md.match(new RegExp(`^(?:yo\\s+)?(?:le\\s+)?debo\\s+(${N})\\s+(?:a\\s+)?${NOT_A_NAME}(.+)$`));
    if (owe) return debtFlow(msg, "debo", owe[2], owe[1], { currency: dc });
    const oweRev = md.match(/^(?:yo\s+)?(?:le\s+)?debo\s+(?:plata\s+)?a\s+(.+?)(?:\s+(\d[\d.,]*))?$/);
    if (oweRev) return debtFlow(msg, "debo", oweRev[1], oweRev[2], { currency: dc });
    const lentMe = md.match(/^(.+?)\s+me\s+prest(?:o|aron)\s+(\d[\d.,]*)$/);
    if (lentMe) return debtFlow(msg, "debo", lentMe[1], lentMe[2], { currency: dc });
    const lentMeNoOne = md.match(/^me\s+prest(?:aron|o)\s+(\d[\d.,]*)$/);
    if (lentMeNoOne) return debtFlow(msg, "debo", undefined, lentMeNoOne[1], { currency: dc });

    // Alta — me deben. Si alguien te debe es porque esa plata ya salió de tu
    // bolsillo (prestada o adelantada) → mismo egreso que "presté" (originExpense).
    // "me debe[n] N" sin nombre va primero, para que la variante laxa de abajo
    // ("X [me] debe N") no capture "me" como contraparte.
    const owedNoOne = md.match(/^me\s+debe[n]?\s+(\d[\d.,]*)$/);
    if (owedNoOne) return debtFlow(msg, "me_deben", undefined, owedNoOne[1], { originExpense: true, currency: dc });
    // "nico me debe 1800" y también "nico debe 1800" (el "me" es opcional).
    // "juan me debe 5000 de la cena": la cola va como motivo del egreso.
    const owed = md.match(/^(.+?)\s+(?:me\s+)?debe[n]?\s+(\d[\d.,]*)(?:\s+(?:de|del|por)\s+(.+))?$/);
    if (owed) return debtFlow(msg, "me_deben", owed[1], owed[2], { originExpense: true, rawMotivo: owed[3], currency: dc });
    // "presté 3000 a ana" · "le presté 3000 a ana para la nafta" · "fié 3000 a ana".
    // Prestar/fiar = la plata YA salió → el flujo registra también un egreso (originExpense).
    const lent = md.match(new RegExp(`^(?:yo\\s+)?(?:le\\s+)?(?:preste|fie)\\s+(${N})\\s+(?:a\\s+)?${NOT_A_NAME}(.+?)(?:\\s+para\\s+(.+))?$`));
    if (lent) return debtFlow(msg, "me_deben", lent[2], lent[1], { originExpense: true, rawMotivo: lent[3], currency: dc });
    // Sin monto: "le presté a juan" → el flujo pregunta cuánto.
    const lentNoAmt = md.match(/^(?:yo\s+)?(?:le\s+)?(?:prest[eé]|fi[eé])\s+(?:plata\s+)?a\s+(.+?)(?:\s+para\s+(.+))?$/);
    if (lentNoAmt) return debtFlow(msg, "me_deben", lentNoAmt[1], undefined, { originExpense: true, rawMotivo: lentNoAmt[2], currency: dc });

    // Saldar (va antes que pagar: "ya le pagué todo a juan" salda, no paga parcial)
    const settle = md.match(/^(?:ya\s+)?(?:le\s+)?(?:sald[eé]|salda|cancel[aeé]|cerr[eé]|termin[eé])\s+(?:la\s+)?deuda\s+(?:de|con|a)\s+["']?(.+?)["']?$/)
      ?? md.match(/^ya\s+le\s+pag(?:u[eé]|o)\s+todo\s+a\s+["']?(.+?)["']?$/);
    if (settle) return { type: "settle_debt", counterparty: settle[1].trim() };

    // Borrar (antes de delete_tx, que es muy goloso y se lo comería)
    const del = md.match(/^(?:borra|elimina|saca|quita)\w*\s+(?:la\s+)?deuda\s+(?:de|con|a)\s+["']?(.+?)["']?$/);
    if (del) return { type: "delete_debt", counterparty: del[1].trim() };

    // Pagar parcial. La preposición "a" es el discriminante: "pagué 5000 de
    // nafta" es un gasto, "le pagué 5000 a juan" es un pago de deuda.
    // "le devolví X a Y" = pago de lo que YO debía (dirección debo).
    const pay = md.match(/^(?:le\s+)?(?:pag(?:u[eé]|o)|di|devolv[ií])\s+(\d[\d.,]*)\s+a\s+["']?(.+?)["']?$/);
    if (pay) {
      const amount = parseAmount(pay[1]);
      if (amount > 0) return { type: "pay_debt", counterparty: pay[2].trim(), amount, direction: "debo", currency: dc };
    }
    // "juan me pagó 5000" · "juan me devolvió 5000" = cobro de lo que ME deben.
    const gotPaid = md.match(/^["']?(.+?)["']?\s+me\s+(?:pag(?:o|aron)|devolvi(?:o|eron))\s+(\d[\d.,]*)$/);
    if (gotPaid) {
      const amount = parseAmount(gotPaid[2]);
      if (amount > 0) return { type: "pay_debt", counterparty: gotPaid[1].trim(), amount, direction: "me_deben", currency: dc };
    }
  }

  // ── Espacios ──────────────────────────────────────────────────────────────
  // delete_space va acá arriba a propósito: delete_tx es muy goloso y se
  // comería "borrá el espacio Casa" como si fuera un gasto llamado "espacio casa".
  {
    if (/mis\s+espacios|ver\s+espacios|que\s+espacios|listar\s+espacios|cuantos\s+espacios/.test(m))
      return { type: "spaces_query" };

    const ren = m.match(/^(?:renombr|cambi)\w*\s+(?:el\s+)?(?:nombre\s+(?:de[l]?\s+)?)?espacio\s+["']?(.+?)["']?\s+(?:a|por)\s+["']?(.+?)["']?$/);
    if (ren) return { type: "rename_space", oldName: ren[1].trim(), newName: properName(msg, ren[2].trim()) };

    const crea = m.match(/^(?:crea|agrega|añad|anad|sum)\w*\s+(?:un\s+|el\s+)?(?:nuevo\s+)?espacio\s+(?:llamado\s+|nuevo\s+)?["']?(.+?)["']?$/);
    if (crea) return { type: "create_space", name: properName(msg, crea[1].trim()) };

    const delSp = m.match(/^(?:borr|elimin|sac|quit)\w*\s+(?:el\s+)?espacio\s+["']?(.+?)["']?$/);
    if (delSp) return { type: "delete_space", name: delSp[1].trim() };

    const def = m.match(/^(?:pon|marc|dej|hac)\w*\s+(?:a\s+|el\s+espacio\s+)?["']?(.+?)["']?\s+como\s+(?:espacio\s+)?(?:principal|default|por\s+defecto|predeterminado)$/);
    if (def) return { type: "set_default_space", name: def[1].trim() };

    const mov = m.match(/^(?:pas|mov|mand|cambi)\w*\s+(?:est[ae]|el\s+ultimo|es[ae])\s*(?:gasto|movimiento|ingreso|registro|compra)?\s*(?:a|al|para)\s+(?:el\s+espacio\s+)?["']?(.+?)["']?$/);
    if (mov) return { type: "move_tx_space", name: mov[1].trim() };
  }

  // ── Dólar y exportar ──────────────────────────────────────────────────────
  {
    const setUsd = m.match(/^(?:pon|fij|actualiz|cambi|marc)\w*\s+(?:el\s+)?(?:dolar|usd|tipo de cambio|cotizacion)\s+(?:a|en)\s+(\d[\d.,]*)$/);
    if (setUsd) {
      const n = parseAmount(setUsd[1]);
      if (n > 0) return { type: "set_usd_rate", rate: n };
    }
    if (/a\s+cuanto\s+esta\s+el\s+dolar|cotizacion\s+del\s+dolar|(?:que|cual)\s+(?:es\s+)?(?:el\s+)?(?:valor|precio)\s+del\s+dolar|mi\s+dolar/.test(m))
      return { type: "usd_rate_query" };

  }

  // ── Categorías ────────────────────────────────────────────────────────────
  // Renombrar usa SOLO el verbo "renombrá": "cambiá la categoría de X a Y" ya
  // significa otra cosa (corregir la categoría de un movimiento, más abajo).
  {
    if (/mis\s+categorias|ver\s+categorias|que\s+categorias|listar\s+categorias/.test(m))
      return { type: "categories_query" };

    const renCat = m.match(/^renombr\w*\s+(?:la\s+)?categoria\s+["']?(.+?)["']?\s+(?:a|por)\s+["']?(.+?)["']?$/);
    if (renCat) return { type: "rename_category", oldName: renCat[1].trim(), newName: properName(msg, renCat[2].trim()) };

    const creaCat = m.match(/^(?:crea|agrega|añad|anad|sum)\w*\s+(?:una\s+|la\s+)?(?:nueva\s+)?categoria\s+(?:llamada\s+)?["']?(.+?)["']?$/);
    if (creaCat) return { type: "create_category", name: properName(msg, creaCat[1].trim()) };

    const delCat = m.match(/^(?:borr|elimin|sac|quit)\w*\s+(?:la\s+)?categoria\s+["']?(.+?)["']?$/);
    if (delCat) return { type: "delete_category", name: delCat[1].trim() };
  }

  // ── Installments ──────────────────────────────────────────────────────────
  if (/mis cuotas|ver cuotas|cuotas activas|cuotas pendientes|cuantas cuotas|cuántas cuotas|que cuotas tengo|mis pagos en cuotas|mis creditos/.test(m))
    return { type: "installments_query" };

  // ── Edit budget ───────────────────────────────────────────────────────────
  const editMatch = m.match(/(?:edit[ao]?r?|cambia[r]?|modifica[r]?|actualiza[r]?|pon[eé]|poner|fija[r]?|subi[r]?|baja[r]?)\s+(?:el\s+)?l[ií]?mite\s+(?:de\s+)?(.+?)\s+a\s+(\d[\d.,]*)/);
  if (editMatch) {
    const amount = parseAmount(editMatch[2]);
    if (!isNaN(amount)) return { type: "edit_budget", category: editMatch[1].trim(), amount };
  }

  // ── Editar un movimiento ya registrado ────────────────────────────────────
  // Va ANTES de correct_tx_category y de delete_tx. Exige una señal explícita
  // (monto/fecha/descripción, o un número) para no comerse otros comandos.
  {
    const isLast = (s: string) => /^(?:el\s+|la\s+)?(?:ultimo|ultima|reciente|ese|esa|eso)(?:\s+(?:gasto|movimiento|registro|ingreso|compra))?$/.test(s.trim());

    // "cambiá el monto de netflix a 3000" · "corregí el monto del último a 3000"
    const amt = m.match(/^(?:corregi|cambi|edit|actualiz|modific)\w*\s+(?:el\s+)?(?:monto|importe|precio|valor)\s+(?:de[l]?\s+)?(.+?)\s+(?:a|por|en)\s+(\d[\d.,]*)$/);
    // "cambiá el monto de la meta viaje a 50000" es otra cosa: se le deja a
    // set_goal_target, que también usa la palabra "monto".
    if (amt && !/^(?:la\s+|el\s+|mi\s+)?(?:meta|objetivo|ahorro)\b/.test(amt[1])) {
      const n = parseAmount(amt[2]);
      if (n > 0) return { type: "edit_tx", search: isLast(amt[1]) ? undefined : amt[1].trim(), amount: n };
    }

    // "el último gasto eran 5000" · "el gasto de netflix eran 3000"
    const were = m.match(/^(?:el\s+|la\s+)?(?:gasto|movimiento|ingreso|registro|compra)?\s*(?:de\s+)?(.+?)\s+(?:eran?|fueron?|era|es|son)\s+(\d[\d.,]*)$/);
    if (were) {
      const n = parseAmount(were[2]);
      if (n > 0) return { type: "edit_tx", search: isLast(were[1]) ? undefined : were[1].trim(), amount: n };
    }

    // "cambiá la descripción del último a X"
    const desc = m.match(/^(?:corregi|cambi|edit|actualiz|modific)\w*\s+(?:la\s+)?(?:descripcion|nombre|detalle)\s+(?:de[l]?\s+)?(.+?)\s+(?:a|por)\s+["']?(.+?)["']?$/);
    if (desc) return { type: "edit_tx", search: isLast(desc[1]) ? undefined : desc[1].trim(), description: denormalize(msg, desc[2].trim()) };

    // "cambiá la fecha del último a ayer" (relativas y dd/mm)
    const fec = m.match(/^(?:corregi|cambi|edit|actualiz|modific)\w*\s+(?:la\s+)?fecha\s+(?:de[l]?\s+)?(.+?)\s+(?:a|por|al)\s+(.+)$/);
    if (fec) {
      const when = parseWhen(fec[2].trim());
      if (when) return { type: "edit_tx", search: isLast(fec[1]) ? undefined : fec[1].trim(), date: when };
    }
  }

  // ── Delete goal ───────────────────────────────────────────────────────────
  const deleteGoalMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borr[ao]|elimina)\s+(?:la\s+)?(?:meta|objetivo|ahorro)\s+(?:de\s+|llamad[ao]\s+)?["']?(.+?)["']?$/);
  if (deleteGoalMatch) return { type: "delete_goal", name: deleteGoalMatch[1].trim() };

  // ── Rename goal ───────────────────────────────────────────────────────────
  const renameGoalMatch = m.match(/(?:renombr[ao]r?|cambi[ao]r?\s+(?:el\s+)?nombre\s+(?:de\s+)?(?:la\s+)?(?:meta\s+)?)\s*["']?(.+?)["']?\s+a\s+["']?(.+?)["']?$/);
  if (renameGoalMatch) return { type: "rename_goal", oldName: renameGoalMatch[1].trim(), newName: properName(msg, renameGoalMatch[2].trim()) };

  // ── Set goal target amount ────────────────────────────────────────────────
  const setGoalTargetMatch = m.match(/(?:cambi[ao]r?|edit[ao]r?|modific[ao]r?|actualiz[ao]r?|pon[eé]|fij[ao]r?)\s+(?:el\s+)?(?:objetivo|monto|target|meta)\s+(?:de\s+)?(?:la\s+)?(?:meta\s+)?["']?(.+?)["']?\s+a\s+(\d[\d.,]*)/);
  if (setGoalTargetMatch) {
    const amount = parseAmount(setGoalTargetMatch[2]);
    if (!isNaN(amount)) return { type: "set_goal_target", name: setGoalTargetMatch[1].trim(), amount };
  }

  // ── Pay installment ───────────────────────────────────────────────────────
  // Exige la palabra cuota/plan/mensualidad. Antes `pag[ueé]` no podía matchear
  // "pague" (matcheaba "pagu" y después pedía un espacio), así que "pagué la
  // cuota de Netflix" caía en el flujo de CREAR cuota. Y sin exigir el sustantivo,
  // "pagué 5000 de nafta" buscaría un plan llamado "5000 de nafta".
  const payInstallMatch = m.match(/(?:pag(?:u[eé]|o|ar|amos)|registr[ao]r?\s+(?:el\s+)?pago)\s+(?:de\s+)?(?:la\s+|el\s+)?(?:cuota|plan|mensualidad)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (payInstallMatch) return { type: "pay_installment", name: payInstallMatch[1].trim() };

  // ── Cancel installment ────────────────────────────────────────────────────
  // Sin "deuda": ahora es un sector aparte (lo maneja el bloque de deudas).
  const cancelInstallMatch = m.match(/(?:cancel[ao]r?|salda[r]?|cerr[ao]r?|termina[r]?|cancel[ao])\s+(?:la\s+)?(?:cuota|plan)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (cancelInstallMatch) return { type: "cancel_installment", name: cancelInstallMatch[1].trim() };

  // ── Delete budget ─────────────────────────────────────────────────────────
  const deleteBudgetMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borra el|elimina el|saca el|quita el)\s+(?:el\s+)?(?:l[ií]?mite|presupuesto)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (deleteBudgetMatch) return { type: "delete_budget", category: deleteBudgetMatch[1].trim() };

  // ── Delete transaction ────────────────────────────────────────────────────
  const deleteMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borr[ao]|elimina)\s+(?:el\s+|la\s+)?(?:(?:gasto|pago|ingreso|compra|transaccion)\s+(?:de\s+)?)?(.+)/);
  if (deleteMatch) return { type: "delete_tx", search: deleteMatch[1].trim() };

  // ── Corregir la categoría de un movimiento por chat ───────────────────────
  // "el último gasto ponelo en Ocio", "ese es Transporte", "cambiá la categoría
  // de netflix a Ocio", "movelo a Comida". El handler valida la categoría.
  {
    const a = m.match(/(?:el\s+)?(?:ultimo|último|reciente|ese)\s+(?:gasto|movimiento|registro|ingreso)?\s*(?:pon[eé]l?[oa]|mov[eé]l?[oa]|cambi[aá]l?[oa]|deber[ií]a\s+ir\s+en|va\s+en|va|es|a|en|como)\s+(.+)$/);
    if (a && a[1] && a[1].trim().length <= 30) return { type: "correct_tx_category", category: a[1].trim() };

    const b = m.match(/(?:cambi[aá]r?|pon[eé]r?|correg[ií]r?|actualiz[aá]r?|mov[eé]r?)\s+(?:la\s+)?categor[ií]a\s+(?:de[l]?\s+)?(.+?)\s+(?:a|en|como|por)\s+(.+)$/);
    if (b) {
      const target = b[1].trim();
      const isLast = /^(el\s+)?(ultimo|último|reciente|ese)(\s+(gasto|movimiento|registro))?$/.test(target);
      return { type: "correct_tx_category", search: isLast ? undefined : target, category: b[2].trim() };
    }

    const c = m.match(/^(?:movel[oa]|cambial[oa]|ponel[oa])\s+(?:a|en|como|para)\s+(.+)$/);
    if (c && c[1].trim().length <= 30) return { type: "correct_tx_category", category: c[1].trim() };
  }

  // ── Register transaction (explicit) → expense/income flow ────────────────
  if (/registr[ao]r?|anot[ao]r?|guard[ao]r?|carg[ao]r?|apunt[ao]r?/.test(m) && !/cuota|meta|objetivo|l[ií]mite/.test(m)) {
    const txType: "income" | "expense" = /ingreso|sueldo|cobr[eé]/.test(m) ? "income" : "expense";
    const amtMatch = m.match(/(\d[\d.,]+)/);
    const amount = amtMatch ? parseAmount(amtMatch[1]) : undefined;
    const descMatch = m.match(/(?:en|de|para|por)\s+(?!ars|usd|eur|uyu|brl)(.+)$/);
    const description = descMatch?.[1]?.replace(/\d[\d.,]*/g, "").trim() || undefined;
    return { type: "flow", ctx: { flow: txType, amount: amount && amount > 0 ? amount : undefined, description, category: description ? categoryForText(description) : null } };
  }

  // ── Create goal ───────────────────────────────────────────────────────────
  const goalCreateMatch = m.match(/(?:agrega[r]?|crea[r]?|nueva|nuevo)\s+(?:una?\s+)?(?:nueva?\s+)?(?:meta|objetivo|ahorro)\s+(?:(?:llamad[ao]|con\s+nombre)\s+)?["']?(.+?)["']?\s*(?:(?:de|con\s+objetivo)\s+(\d[\d.,]*))?$/);
  if (goalCreateMatch) {
    const name = properName(msg, goalCreateMatch[1].trim());
    const amount = goalCreateMatch[2] ? parseAmount(goalCreateMatch[2]) : undefined;
    if (name.length > 0) return { type: "create_goal", name, amount };
  }
  if (/(?:agrega[r]?|crea[r]?|nueva|nuevo)\s+(?:una?\s+)?(?:nueva?\s+)?(?:meta|objetivo)\b/.test(m))
    return { type: "flow", ctx: { flow: "goal" } };

  // ── Deposit to goal ───────────────────────────────────────────────────────
  const depositMatch = m.match(/(?:deposit[ao]r?|sum[ao]r?|sumal[eo]|agreg[ao]r?l?[eo]?|ponel[eo]|cargal[eo]|mandal[eo])\s+(\d[\d.,]+)\s*(?:pesos|ars|usd|eur|uyu)?\s*(?:a|en|para)\s+(?:(?:la\s+)?(?:meta|ahorro)\s+)?["']?(.+?)["']?$/);
  if (depositMatch) {
    const amount = parseAmount(depositMatch[1]);
    if (!isNaN(amount) && amount > 0) return { type: "deposit_goal", amount, goalName: depositMatch[2].trim() };
  }

  // ── Create budget / limit → budget flow ──────────────────────────────────
  // El monto puede ir ANTES de la categoría ("límite de 30000 en Comida", que
  // es el ejemplo que Neo publicita) o después ("límite de Comida de 30000").
  // Sin este primer caso, la categoría quedaba como "30000 comida" y no existía.
  const budgetAmountFirst = m.match(/(?:pon[eé]r?|crea[r]?|agrega[r]?|fija[r]?|nuevo)\s+(?:un\s+)?(?:l[ií]?mite|presupuesto)\s+(?:de\s+)?(\d[\d.,]*)\s+(?:en|para|a)\s+(.+?)$/);
  if (budgetAmountFirst && !/edit|modific|actualiz|cambi/.test(m)) {
    const amt = parseAmount(budgetAmountFirst[1]);
    const { rest, months } = splitMonths(budgetAmountFirst[2].trim());
    return { type: "flow", ctx: { flow: "budget", category: rest || undefined, amount: amt > 0 ? amt : undefined, months } };
  }
  const budgetCreateMatch = m.match(/(?:pon[eé]r?|crea[r]?|agrega[r]?|fija[r]?|nuevo)\s+(?:un\s+)?(?:l[ií]?mite|presupuesto)\s+(?:(?:de|para|a|en)\s+)?(.+?)(?:\s+(?:de|a|en)\s+(\d[\d.,]*))?$/);
  if (budgetCreateMatch && !/edit|modific|actualiz|cambi/.test(m)) {
    const cat = budgetCreateMatch[1]?.replace(/\b(de|a|en|para)\b/g, "").trim();
    const amt = budgetCreateMatch[2] ? parseAmount(budgetCreateMatch[2]) : undefined;
    return { type: "flow", ctx: { flow: "budget", category: cat || undefined, amount: amt && amt > 0 ? amt : undefined } };
  }

  // ── Installment (en cuotas / N cuotas) → installment flow ────────────────
  if (/\bcuotas?\b|\ben\s+\d+\s+pagos?\b/.test(m)) {
    const countMatch = m.match(/(?:en\s+)?(\d+)\s*(?:cuotas?|pagos?)/);
    const nInstallments = countMatch ? parseInt(countMatch[1]) : undefined;
    const amtMatch = m.match(/(?:cuotas?|pagos?)\s+de\s+(\d[\d.,]*)|de\s+(\d[\d.,]*)\s*(?:cada|c\/u|por\s+mes|mensual)/);
    const rawAmt = amtMatch?.[1] ?? amtMatch?.[2];
    const installmentAmount = rawAmt ? parseAmount(rawAmt) : undefined;
    const name = m
      .replace(/\b(compr[eé]|comprar|pagu[eé]|pagar|saqu[eé]|sacar|adquir[ií]|me\s+compr[eé]|agrega[r]?|crea[r]?|nueva|cuota|registr[ao]r?)\b/g, " ")
      .replace(/\ben\s+\d+\s*(?:cuotas?|pagos?)\b/g, " ")
      .replace(/\b\d+\s*(?:cuotas?|pagos?)\b/g, " ")
      .replace(/\bcuotas?\s+de\s+\d[\d.,]*/g, " ")
      .replace(/\bde\s+\d[\d.,]*\s*(?:cada|c\/u|por\s+mes|mensual)?/g, " ")
      .replace(/\ben\s+cuotas?\b/g, " ")
      .replace(/\b(un|una|unos|unas|el|la|los|las|mi|mis|al|del|por)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { type: "flow", ctx: { flow: "installment", name: name || undefined, nInstallments: nInstallments && nInstallments > 0 ? nInstallments : undefined, installmentAmount: installmentAmount && installmentAmount > 0 ? installmentAmount : undefined } };
  }

  // ── Red de seguridad de deudas ────────────────────────────────────────────
  // Si habla de préstamos/deudas y el bloque de deudas no lo entendió, NUNCA
  // cae a un gasto pelado ("prestamo juan 5000" se anotaba como gasto): mejor
  // unknown → la IA (que en deudas siempre pregunta) o "no te entendí".
  if (/\bprest|\bdeb[eo]n?\b|\bdeudas?\b/.test(m)) return { type: "unknown" };

  // ── Natural language purchase/income (biblioteca de keywords, 0 tokens) ────
  const purchase = detectPurchaseIntent(m);
  if (purchase.found) {
    return {
      type: "flow",
      ctx: {
        flow: purchase.txType,
        description: purchase.item ? denormalize(msg, purchase.item) : undefined,
        amount: purchase.amount ?? undefined,
        category: purchase.suggestedCategory,
      },
    };
  }

  // ── Keywords aprendidas (lo que antes resolvió Haiku, ahora 0 tokens) ──────
  if (learnedKeywords.length) {
    const hit = learnedKeywords.find((k) => k.keyword && m.includes(k.keyword));
    if (hit) {
      const amtMatch = m.match(/(\d[\d.,]+)/);
      if (amtMatch) {
        const amount = parseAmount(amtMatch[1]);
        const desc = m.replace(/\d[\d.,]*/g, "").trim();
        return {
          type: "flow",
          ctx: {
            flow: hit.type,
            description: desc ? denormalize(msg, desc) : hit.keyword,
            amount: amount > 0 ? amount : undefined,
            category: hit.category ?? categoryForText(desc),
          },
        };
      }
      // Keyword conocida SIN monto + monto típico → preguntar "¿el de siempre?"
      if (hit.last_amount && hit.last_amount > 0) {
        return {
          type: "ask_amount",
          keyword: hit.keyword, ctype: hit.type, category: hit.category ?? null,
          currency: hit.currency_code ?? null, lastAmount: hit.last_amount,
        };
      }
    }
  }

  // ── Transacción "pelada": palabra(s) + monto, sin verbo ni comando ────────
  // "almuerzo 850", "850 uber", "kiosco 1200". Si llegó hasta acá no fue
  // ninguna consulta/comando, así que un texto + un monto = gasto (o ingreso
  // si hay keyword de ingreso). 0 tokens, sin pasar por el LLM.
  const nums = (m.match(/\d[\d.,]*/g) ?? []).map(parseAmount).filter((n) => n > 0);
  if (nums.length) {
    // Varios números: "2 cafés 3000" es cantidad + monto → el mayor. Pero dos
    // montos de verdad ("nafta 5000 super 3000") no se adivinan: de a uno.
    if (nums.filter((n) => n >= 100).length >= 2) return { type: "multi_amount" };
    const amount = Math.max(...nums);
    const desc = m
      .replace(/\d[\d.,]*/g, " ")
      .replace(/\b(pesos?|ars|usd|eur|uyu|brl|mangos?|lucas?|palos?)\b/g, " ")
      .replace(/\b(en|de|del|por|para|al|un|una|unos|unas|el|la|los|las|mi|mis|me|gaste|gasté|pague|pagué|compre|compré)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!isNaN(amount) && amount > 0 && desc.length >= 2) {
      const txType: "income" | "expense" = /ingres|sueldo|cobr[eé]?|me\s+pagaron|me\s+depositaron/.test(m) ? "income" : "expense";
      return { type: "flow", ctx: { flow: txType, description: denormalize(msg, desc), amount, category: categoryForText(desc) } };
    }
  }

  return { type: "unknown" };
}
