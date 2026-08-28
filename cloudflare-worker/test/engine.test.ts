// Pruebas offline del motor unificado de Neo. Stub de Supabase en memoria: no
// toca prod ni red. Correr con: npx tsx cloudflare-worker/test/engine.test.ts
//
// NOTA: importa desde src/ vía alias relativo; tsx resuelve TS directamente.
import { runNeo } from "../../src/lib/neo/engine/index.ts";
import { detectIntent } from "../../src/lib/neo/engine/intent.ts";
import type { NeoState } from "../../src/lib/neo/engine/types.ts";

// ─── Stub de Supabase ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type DB = Record<string, Row[]>;

let idSeq = 1;
function newId() { return `id-${idSeq++}`; }

class QB {
  private filters: { op: string; col: string; val: unknown }[] = [];
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private wantSingle = false;
  private wantSelect = false;
  private countHead = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private onConflict: string[] = [];

  constructor(private db: DB, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) { this.wantSelect = true; if (opts?.count) this.countHead = true; return this; }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row, o?: { onConflict?: string }) { this.op = "upsert"; this.payload = p; this.onConflict = o?.onConflict?.split(",").map(s => s.trim()) ?? []; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.filters.push({ op: "eq", col, val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ op: "neq", col, val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ op: "in", col, val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ op: "gte", col, val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ op: "lte", col, val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ op: "is", col, val }); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = o?.ascending ?? true; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.wantSingle = true; return this.exec(); }
  maybeSingle() { this.wantSingle = true; return this.exec(); }
  then(resolve: (v: { data: unknown; error: unknown; count?: number }) => void) { resolve(this.exec()); }

  private rows(): Row[] { return (this.db[this.table] ??= []); }

  private match(r: Row): boolean {
    return this.filters.every(f => {
      const v = r[f.col];
      switch (f.op) {
        case "eq": return v === f.val;
        case "neq": return v !== f.val;
        case "in": return (f.val as unknown[]).includes(v);
        case "gte": return (v as string | number) >= (f.val as string | number);
        case "lte": return (v as string | number) <= (f.val as string | number);
        case "is": return f.val === null ? (v === null || v === undefined) : v === f.val;
        default: return true;
      }
    });
  }

  private exec(): { data: unknown; error: unknown; count?: number } {
    const table = this.rows();
    if (this.op === "insert" || this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted: Row[] = [];
      for (const item of items) {
        if (this.op === "upsert" && this.onConflict.length) {
          const existing = table.find(r => this.onConflict.every(k => r[k] === item[k]));
          if (existing) { Object.assign(existing, item); inserted.push(existing); continue; }
        }
        const row = { id: item.id ?? newId(), ...item };
        table.push(row);
        inserted.push(row);
      }
      if (this.wantSingle) return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }

    let result = table.filter(r => this.match(r));

    if (this.op === "update") {
      for (const r of result) Object.assign(r, this.payload);
      return { data: result, error: null };
    }
    if (this.op === "delete") {
      this.db[this.table] = table.filter(r => !this.match(r));
      return { data: null, error: null };
    }

    // select
    if (this.countHead) return { data: null, error: null, count: result.length };
    if (this.orderCol) {
      const col = this.orderCol;
      result = [...result].sort((a, b) => {
        const av = a[col] as string, bv = b[col] as string;
        return this.orderAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);
    if (this.wantSingle) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
}

function makeStub(db: DB) {
  return { from: (table: string) => new QB(db, table) } as never;
}

// ─── Aserciones ──────────────────────────────────────────────────────────────

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const USER = "user-1";
const SPACE = "space-personal";
function seed(): DB {
  return {
    profiles: [{ user_id: USER, primary_currency: "ARS", display_name: "Fran" }],
    spaces: [{ id: SPACE, user_id: USER, name: "Personal", is_default: true, include_in_total: true, primary_currency: "ARS", sort_order: 0, created_at: "2026-01-01" }],
    transactions: [],
    categories: [{ id: "cat-comida", user_id: USER, name: "Comida" }],
    category_budgets: [],
    savings_goals: [],
    installment_plans: [],
    installment_payments: [],
    debts: [],
    parser_rules: [],
    neo_conversation_state: [],
  };
}

async function main() {
  process.env.NEO_LLM_FALLBACK = "false"; // sin tokens en los tests

  // 1) Registrar gasto explícito por reglas (0 tokens)
  {
    const db = seed();
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "compré nafta 5000", channel: "whatsapp" });
    check("compré nafta 5000 → crea transacción", db.transactions.length === 1 && Number(db.transactions[0].amount) === 5000);
    check("compré nafta 5000 → responde confirmación", r.text.includes("✅"));
  }

  // 2) Consulta de gasto del mes
  {
    const db = seed();
    const today = new Date().toISOString().split("T")[0];
    db.transactions.push({ id: "t1", user_id: USER, space_id: SPACE, type: "expense", amount: 1000, currency_code: "ARS", date: today });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "cuánto gasté este mes", channel: "whatsapp" });
    check("cuánto gasté este mes → reporta total", r.text.includes("1.000") || r.text.toLowerCase().includes("gastaste"));
  }

  // 3) Saldo
  {
    const db = seed();
    db.transactions.push({ id: "t1", user_id: USER, space_id: SPACE, type: "income", amount: 5000, currency_code: "ARS", date: "2026-06-01" });
    db.transactions.push({ id: "t2", user_id: USER, space_id: SPACE, type: "expense", amount: 2000, currency_code: "ARS", date: "2026-06-02" });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "cuánto tengo", channel: "whatsapp" });
    check("cuánto tengo → balance acumulado", r.text.toLowerCase().includes("balance"));
  }

  // 4) Slot-filling multi-turno (WhatsApp): falta el monto
  {
    const db = seed();
    const stub = makeStub(db);
    const r1 = await runNeo({ supabase: stub, userId: USER, message: "comí sushi", channel: "whatsapp" });
    check("comí sushi → pregunta el monto", !!r1.state && r1.text.toLowerCase().includes("cuánto"));
    const r2 = await runNeo({ supabase: stub, userId: USER, message: "3000", channel: "whatsapp", state: r1.state as NeoState });
    check("respuesta '3000' → crea el gasto", db.transactions.length === 1 && Number(db.transactions[0].amount) === 3000);
  }

  // 5) Borrado con confirmación (WhatsApp)
  {
    const db = seed();
    const today = new Date().toISOString().split("T")[0];
    db.transactions.push({ id: "tx-del", user_id: USER, space_id: SPACE, type: "expense", amount: 999, currency_code: "ARS", description: "netflix", date: today });
    const stub = makeStub(db);
    const r1 = await runNeo({ supabase: stub, userId: USER, message: "borrá el gasto de netflix", channel: "whatsapp" });
    check("borrá netflix → pide confirmación (sí/no)", !!r1.state && r1.text.toLowerCase().includes("elimino"));
    const r2 = await runNeo({ supabase: stub, userId: USER, message: "sí", channel: "whatsapp", state: r1.state as NeoState });
    check("confirmar 'sí' → marca deleted_at", !!db.transactions[0].deleted_at, `reply: ${r2.text}`);
  }

  // 6) Borrado: 'no' no toca nada
  {
    const db = seed();
    const today = new Date().toISOString().split("T")[0];
    db.transactions.push({ id: "tx-keep", user_id: USER, space_id: SPACE, type: "expense", amount: 999, currency_code: "ARS", description: "spotify", date: today });
    const stub = makeStub(db);
    const r1 = await runNeo({ supabase: stub, userId: USER, message: "borrá el gasto de spotify", channel: "whatsapp" });
    const r2 = await runNeo({ supabase: stub, userId: USER, message: "no", channel: "whatsapp", state: r1.state as NeoState });
    check("confirmar 'no' → NO borra", !db.transactions[0].deleted_at && r2.text.toLowerCase().includes("no toco"));
  }

  // 7) Sin fallback: mensaje no entendido → clarify (0 tokens)
  {
    const db = seed();
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "xyzqwerty foobar", channel: "whatsapp" });
    check("desconocido sin fallback → clarify, 0 transacciones", db.transactions.length === 0 && r.text.toLowerCase().includes("no te entend"));
  }

  // 8) Keyword aprendida → resuelve en 0 tokens
  {
    const db = seed();
    db.parser_rules.push({ id: "pr1", user_id: USER, pattern: "kiosco|expense|ARS", type: "expense", currency_code: "ARS", confidence: 70, match_count: 2 });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "kiosco 500", channel: "whatsapp" });
    check("kiosco 500 (aprendida) → crea gasto sin tokens", db.transactions.length === 1 && Number(db.transactions[0].amount) === 500, `reply: ${r.text}`);
  }

  // 8b) Variantes de fraseo de consultas (singular/posesivo)
  {
    const db = seed();
    const today = new Date().toISOString().split("T")[0];
    db.transactions.push({ id: "i1", user_id: USER, space_id: SPACE, type: "income", amount: 7000, currency_code: "ARS", date: today });
    const r1 = await runNeo({ supabase: makeStub(db), userId: USER, message: "Cuál fue mi ingreso este mes?", channel: "whatsapp" });
    check("'cuál fue mi ingreso este mes' → reporta ingreso", r1.text.toLowerCase().includes("ingresaste"), `reply: ${r1.text}`);
    db.transactions.push({ id: "e1", user_id: USER, space_id: SPACE, type: "expense", amount: 300, currency_code: "ARS", date: today });
    const r2 = await runNeo({ supabase: makeStub(db), userId: USER, message: "cuál fue mi gasto este mes?", channel: "whatsapp" });
    check("'cuál fue mi gasto este mes' → reporta gasto", r2.text.toLowerCase().includes("gastaste"), `reply: ${r2.text}`);
  }

  // 9) Paridad web: borrado devuelve effect (no state)
  {
    const db = seed();
    const today = new Date().toISOString().split("T")[0];
    db.transactions.push({ id: "tx-w", user_id: USER, space_id: SPACE, type: "expense", amount: 100, currency_code: "ARS", description: "uber", date: today });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "borrá el gasto de uber", channel: "web" });
    check("web: borrado → effect confirm_delete (no state)", !r.state && r.effects?.[0]?.type === "confirm_delete");
  }

  // 10) Multi-espacio (WhatsApp): Neo pregunta a qué espacio va el movimiento
  {
    const db = seed();
    db.spaces.push({ id: "space-freelance", user_id: USER, name: "Freelance", is_default: false, include_in_total: true, primary_currency: "USD", sort_order: 1, created_at: "2026-02-01" });
    const stub = makeStub(db);
    const r1 = await runNeo({ supabase: stub, userId: USER, message: "compré café 800", channel: "whatsapp" });
    check("multi-espacio: pregunta a qué espacio (no crea aún)", !!r1.state && r1.text.toLowerCase().includes("espacio") && db.transactions.length === 0, `reply: ${r1.text}`);
    const r2 = await runNeo({ supabase: stub, userId: USER, message: "2", channel: "whatsapp", state: r1.state as NeoState });
    check("multi-espacio: '2' crea el gasto en Freelance", db.transactions.length === 1 && db.transactions[0].space_id === "space-freelance", `reply: ${r2.text}`);
  }

  // 11) Un solo espacio: NO pregunta, usa el único
  {
    const db = seed();
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "compré café 800", channel: "whatsapp" });
    check("un espacio: crea directo sin preguntar", db.transactions.length === 1 && db.transactions[0].space_id === SPACE, `reply: ${r.text}`);
  }

  // 12) Web con espacio activo: no pregunta, usa el activo
  {
    const db = seed();
    db.spaces.push({ id: "space-freelance", user_id: USER, name: "Freelance", is_default: false, include_in_total: true, primary_currency: "USD", sort_order: 1, created_at: "2026-02-01" });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "compré café 800", channel: "web", activeSpaceId: "space-freelance" });
    check("web activeSpace: crea directo en el espacio activo", db.transactions.length === 1 && db.transactions[0].space_id === "space-freelance", `reply: ${r.text}`);
  }

  // 13) Regresión: los ejemplos que la propia ayuda de Neo publicita.
  //     "pagué la cuota de X" creaba un plan nuevo (`pag[ueé]` no podía matchear
  //     "pague") y "cancelá la cuota de X" lo comía el regex de descarte.
  {
    const intentOf = (msg: string) => detectIntent(msg).type;
    check("'pagué la cuota de Netflix' → pay_installment (no crea plan)", intentOf("pagué la cuota de Netflix") === "pay_installment");
    check("'pago la cuota de Netflix' → pay_installment", intentOf("pago la cuota de Netflix") === "pay_installment");
    check("'cancelá la cuota de iPhone' → cancel_installment (no descarte)", intentOf("cancelá la cuota de iPhone") === "cancel_installment");
    check("'ayuda' → help (no el welcome corto)", intentOf("ayuda") === "help");
    check("'menu' → help", intentOf("menu") === "help");
    // Y lo que NO se debe romper al exigir el sustantivo / al acotar el descarte:
    check("'pagué 5000 de nafta' sigue siendo gasto", intentOf("pagué 5000 de nafta") === "flow");
    check("'no' sigue descartando", intentOf("no") === "cancel_pending");
    check("'cancelalo' sigue descartando", intentOf("cancelalo") === "cancel_pending");
    check("'comprá la tele en 12 cuotas de 30000' sigue creando plan", intentOf("comprá la tele en 12 cuotas de 30000") === "flow");
  }

  // 14) "ayuda" end-to-end: debe llegar el texto largo, no el WELCOME.
  {
    const r = await runNeo({ supabase: makeStub(seed()), userId: USER, message: "ayuda", channel: "whatsapp" });
    check("'ayuda' devuelve la ayuda completa (menciona Cuotas y Límites)", r.text.includes("Cuotas:") && r.text.includes("Límites:"), `reply: ${r.text.slice(0, 40)}…`);
  }

  // 15) Deudas: alta en las dos direcciones (sector /deudas, NO cuotas)
  {
    const db = seed();
    await runNeo({ supabase: makeStub(db), userId: USER, message: "debo 10000 a juan", channel: "whatsapp" });
    const d = db.debts[0];
    check("'debo 10000 a juan' → deuda direction=debo", db.debts.length === 1 && d?.direction === "debo" && d?.counterparty === "juan" && Number(d?.total_amount) === 10000, JSON.stringify(d));
    check("'debo 10000 a juan' NO crea una transacción", db.transactions.length === 0);
  }
  {
    const db = seed();
    await runNeo({ supabase: makeStub(db), userId: USER, message: "mamá me debe 50000", channel: "whatsapp" });
    check("'mamá me debe 50000' → deuda direction=me_deben", db.debts[0]?.direction === "me_deben" && Number(db.debts[0]?.total_amount) === 50000);
  }
  {
    const db = seed();
    await runNeo({ supabase: makeStub(db), userId: USER, message: "le presté 3000 a ana", channel: "whatsapp" });
    check("'le presté 3000 a ana' → me_deben", db.debts[0]?.direction === "me_deben" && db.debts[0]?.counterparty === "ana");
  }
  {
    // "me prestaron" salió de INCOME_VERBS: es una deuda, no un ingreso.
    const db = seed();
    await runNeo({ supabase: makeStub(db), userId: USER, message: "me prestaron 5000", channel: "whatsapp" });
    check("'me prestaron 5000' → deuda (no ingreso)", db.debts.length === 0 && db.transactions.length === 0, "pregunta a quién");
  }

  // 16) Deudas: alta por slot-filling cuando falta el monto
  {
    const db = seed();
    const stub = makeStub(db);
    const r1 = await runNeo({ supabase: stub, userId: USER, message: "debo plata a juan", channel: "whatsapp" });
    check("'debo plata a juan' → pregunta el monto", !!r1.state && db.debts.length === 0, `reply: ${r1.text}`);
    await runNeo({ supabase: stub, userId: USER, message: "7000", channel: "whatsapp", state: r1.state as NeoState });
    check("responder '7000' → crea la deuda", db.debts.length === 1 && Number(db.debts[0]?.total_amount) === 7000);
  }

  // 17) Deudas: consulta separada de cuotas (el bug que abrió el sector)
  {
    const db = seed();
    db.debts.push({ id: "d1", user_id: USER, space_id: SPACE, direction: "debo", counterparty: "Juan", total_amount: 10000, paid_amount: 2000, currency_code: "ARS", status: "active", due_date: null });
    db.debts.push({ id: "d2", user_id: USER, space_id: SPACE, direction: "me_deben", counterparty: "Ana", total_amount: 5000, paid_amount: 0, currency_code: "ARS", status: "active", due_date: null });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "cuánto debo", channel: "whatsapp" });
    check("'cuánto debo' → deudas, con saldo pendiente (no cuotas)", r.text.includes("Juan") && r.text.includes("8.000") && !r.text.includes("Ana"), `reply: ${r.text}`);
    const r2 = await runNeo({ supabase: makeStub(db), userId: USER, message: "quién me debe", channel: "whatsapp" });
    check("'quién me debe' → solo lo que te deben", r2.text.includes("Ana") && !r2.text.includes("Juan"), `reply: ${r2.text}`);
    const r3 = await runNeo({ supabase: makeStub(db), userId: USER, message: "mis deudas", channel: "whatsapp" });
    check("'mis deudas' → las dos puntas", r3.text.includes("Juan") && r3.text.includes("Ana"), `reply: ${r3.text}`);
    const r4 = await runNeo({ supabase: makeStub(db), userId: USER, message: "mis cuotas", channel: "whatsapp" });
    check("'mis cuotas' sigue respondiendo cuotas", r4.text.includes("cuotas activas"), `reply: ${r4.text}`);
  }

  // 18) Deudas: pagar parcial y saldar
  {
    const db = seed();
    db.categories.push({ id: "cat-deudas", user_id: USER, name: "Deudas" });
    db.debts.push({ id: "d1", user_id: USER, space_id: SPACE, direction: "debo", counterparty: "Juan", total_amount: 10000, paid_amount: 0, currency_code: "ARS", status: "active", due_date: null });
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "le pagué 4000 a juan", channel: "whatsapp" });
    check("'le pagué 4000 a juan' → baja el saldo de la deuda", Number(db.debts[0].paid_amount) === 4000 && db.debts[0].status === "active", `reply: ${r.text}`);
    check("el pago informa el saldo restante (sin NaN)", r.text.includes("6.000") && !r.text.includes("NaN"), `reply: ${r.text}`);
    check("el pago crea un egreso en la categoría Deudas", db.transactions.length === 1 && db.transactions[0].type === "expense" && db.transactions[0].category_id === "cat-deudas");
    const r2 = await runNeo({ supabase: makeStub(db), userId: USER, message: "le pagué 6000 a juan", channel: "whatsapp" });
    check("pagar el resto → queda saldada", db.debts[0].status === "paid", `reply: ${r2.text}`);
    check("al saldar avisa que quedó saldada", r2.text.toLowerCase().includes("saldaste") && !r2.text.includes("NaN"), `reply: ${r2.text}`);
  }
  {
    // Cobro de lo que te deben → ingreso, no egreso.
    const db = seed();
    db.debts.push({ id: "d2", user_id: USER, space_id: SPACE, direction: "me_deben", counterparty: "Ana", total_amount: 5000, paid_amount: 0, currency_code: "ARS", status: "active", due_date: null });
    await runNeo({ supabase: makeStub(db), userId: USER, message: "ana me pagó 5000", channel: "whatsapp" });
    check("'ana me pagó 5000' → ingreso y deuda saldada", db.transactions[0]?.type === "income" && db.debts[0].status === "paid");
  }

  // 19) VÁLVULA DE SEGURIDAD: pagarle a alguien sin deuda = gasto normal
  {
    const db = seed();
    const r = await runNeo({ supabase: makeStub(db), userId: USER, message: "le pagué 5000 a la panadería", channel: "whatsapp" });
    check("pagar sin deuda previa → gasto normal (no error)", db.transactions.length === 1 && Number(db.transactions[0].amount) === 5000 && db.debts.length === 0, `reply: ${r.text}`);
  }

  // 20) Deudas: saldar y borrar
  {
    const db = seed();
    db.debts.push({ id: "d3", user_id: USER, space_id: SPACE, direction: "debo", counterparty: "Juan", total_amount: 10000, paid_amount: 0, currency_code: "ARS", status: "active", due_date: null });
    await runNeo({ supabase: makeStub(db), userId: USER, message: "saldé la deuda de juan", channel: "whatsapp" });
    check("'saldé la deuda de juan' → status paid", db.debts[0].status === "paid" && Number(db.debts[0].paid_amount) === 10000);
  }
  {
    const db = seed();
    db.debts.push({ id: "d4", user_id: USER, space_id: SPACE, direction: "debo", counterparty: "Juan", total_amount: 10000, paid_amount: 0, currency_code: "ARS", status: "active", due_date: null });
    const stub = makeStub(db);
    const r1 = await runNeo({ supabase: stub, userId: USER, message: "borrá la deuda de juan", channel: "whatsapp" });
    check("'borrá la deuda de juan' → pide confirmación", !!r1.state && db.debts.length === 1, `reply: ${r1.text}`);
    await runNeo({ supabase: stub, userId: USER, message: "sí", channel: "whatsapp", state: r1.state as NeoState });
    check("confirmar → borra la deuda", db.debts.length === 0);
  }

  console.log(`\n${failures === 0 ? "✅ TODO OK" : `❌ ${failures} fallo(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
