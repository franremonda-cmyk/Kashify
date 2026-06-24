import { detectPurchaseIntent, categoryForText } from "@/lib/neo-keywords";
import type { Intent, LearnedKeyword } from "./types";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

// Detección de intención 100% por reglas (0 tokens). `learnedKeywords` son
// patrones que el usuario enseñó antes (vía fallback Haiku + confirmación), que
// permiten resolver sin volver a gastar tokens.
export function detectIntent(msg: string, learnedKeywords: LearnedKeyword[] = []): Intent {
  const m = normalize(msg);

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (/^(hola|buen[ao]s?|hey|hi|buenas tardes|buenas noches|buen dia|buen día|que tal|como estas?|como andas?|ola|saludos|buenas)\b/.test(m))
    return { type: "greeting" };

  // ── Cancel / dismiss ──────────────────────────────────────────────────────
  if (/^(no|nada|olvida(lo)?|cancela(lo)?|deja(lo)?|no importa|igual|salir|stop|listo gracias|no gracias|dejame)\b/.test(m))
    return { type: "cancel_pending" };

  // ── Help ──────────────────────────────────────────────────────────────────
  if (/ayuda|help|que pod[eé]s hacer|que puedes hacer|como te uso|como funciona[s]?|comandos|que hac[eé]s|que se puede|instrucciones|para que sirv[eé]s/.test(m))
    return { type: "help" };

  // ── Balance ───────────────────────────────────────────────────────────────
  if (/saldo|cuanto tengo|mis cuentas|mis balances|cuanta plata|cuanto hay|mi balance|ver balance|como estoy financieramente|como ando|como voy de plata|situacion financiera|plata que tengo|cuanto dinero|cuanto efectivo|cuanto me queda en total/.test(m))
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

  // ── Installments ──────────────────────────────────────────────────────────
  if (/mis cuotas|ver cuotas|cuanto debo|cuánto debo|mis deudas|cuotas activas|cuotas pendientes|cuantas cuotas|cuántas cuotas|que cuotas tengo|mis pagos en cuotas|mis creditos/.test(m))
    return { type: "installments_query" };

  // ── Edit budget ───────────────────────────────────────────────────────────
  const editMatch = m.match(/(?:edit[ao]?r?|cambia[r]?|modifica[r]?|actualiza[r]?|pon[eé]|poner|fija[r]?|subi[r]?|baja[r]?)\s+(?:el\s+)?l[ií]?mite\s+(?:de\s+)?(.+?)\s+a\s+(\d[\d.,]*)/);
  if (editMatch) {
    const amount = parseAmount(editMatch[2]);
    if (!isNaN(amount)) return { type: "edit_budget", category: editMatch[1].trim(), amount };
  }

  // ── Delete goal ───────────────────────────────────────────────────────────
  const deleteGoalMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borr[ao]|elimina)\s+(?:la\s+)?(?:meta|objetivo|ahorro)\s+(?:de\s+|llamad[ao]\s+)?["']?(.+?)["']?$/);
  if (deleteGoalMatch) return { type: "delete_goal", name: deleteGoalMatch[1].trim() };

  // ── Rename goal ───────────────────────────────────────────────────────────
  const renameGoalMatch = m.match(/(?:renombr[ao]r?|cambi[ao]r?\s+(?:el\s+)?nombre\s+(?:de\s+)?(?:la\s+)?(?:meta\s+)?)\s*["']?(.+?)["']?\s+a\s+["']?(.+?)["']?$/);
  if (renameGoalMatch) return { type: "rename_goal", oldName: renameGoalMatch[1].trim(), newName: renameGoalMatch[2].trim() };

  // ── Set goal target amount ────────────────────────────────────────────────
  const setGoalTargetMatch = m.match(/(?:cambi[ao]r?|edit[ao]r?|modific[ao]r?|actualiz[ao]r?|pon[eé]|fij[ao]r?)\s+(?:el\s+)?(?:objetivo|monto|target|meta)\s+(?:de\s+)?(?:la\s+)?(?:meta\s+)?["']?(.+?)["']?\s+a\s+(\d[\d.,]*)/);
  if (setGoalTargetMatch) {
    const amount = parseAmount(setGoalTargetMatch[2]);
    if (!isNaN(amount)) return { type: "set_goal_target", name: setGoalTargetMatch[1].trim(), amount };
  }

  // ── Pay installment ───────────────────────────────────────────────────────
  const payInstallMatch = m.match(/(?:pag[ueé]|pagué|registr[ao]r?\s+(?:el\s+)?pago\s+de|pago\s+la\s+cuota\s+de|pagué\s+(?:la\s+)?cuota\s+de|pago\s+cuota\s+de)\s+["']?(.+?)["']?$/);
  if (payInstallMatch) return { type: "pay_installment", name: payInstallMatch[1].trim() };

  // ── Cancel installment ────────────────────────────────────────────────────
  const cancelInstallMatch = m.match(/(?:cancel[ao]r?|salda[r]?|cerr[ao]r?|termina[r]?|cancel[ao])\s+(?:la\s+)?(?:cuota|plan|deuda)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (cancelInstallMatch) return { type: "cancel_installment", name: cancelInstallMatch[1].trim() };

  // ── Delete budget ─────────────────────────────────────────────────────────
  const deleteBudgetMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borra el|elimina el|saca el|quita el)\s+(?:el\s+)?(?:l[ií]?mite|presupuesto)\s+(?:de\s+)?["']?(.+?)["']?$/);
  if (deleteBudgetMatch) return { type: "delete_budget", category: deleteBudgetMatch[1].trim() };

  // ── Delete transaction ────────────────────────────────────────────────────
  const deleteMatch = m.match(/(?:elimin[ao]r?|borra[r]?|saca[r]?|quita[r]?|borr[ao]|elimina)\s+(?:el\s+|la\s+)?(?:(?:gasto|pago|ingreso|compra|transaccion)\s+(?:de\s+)?)?(.+)/);
  if (deleteMatch) return { type: "delete_tx", search: deleteMatch[1].trim() };

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
    const name = goalCreateMatch[1].trim();
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

  // ── Natural language purchase/income (biblioteca de keywords, 0 tokens) ────
  const purchase = detectPurchaseIntent(m);
  if (purchase.found) {
    return {
      type: "flow",
      ctx: {
        flow: purchase.txType,
        description: purchase.item || undefined,
        amount: purchase.amount ?? undefined,
        category: purchase.suggestedCategory,
      },
    };
  }

  // ── Keywords aprendidas (lo que antes resolvió Haiku, ahora 0 tokens) ──────
  if (learnedKeywords.length) {
    const amtMatch = m.match(/(\d[\d.,]+)/);
    if (amtMatch) {
      const hit = learnedKeywords.find((k) => k.keyword && m.includes(k.keyword));
      if (hit) {
        const amount = parseAmount(amtMatch[1]);
        const desc = m.replace(/\d[\d.,]*/g, "").trim();
        return {
          type: "flow",
          ctx: {
            flow: hit.type,
            description: desc || hit.keyword,
            amount: amount > 0 ? amount : undefined,
            // categoría aprendida si existe; si no, la deduce de las keywords
            category: hit.category ?? categoryForText(desc),
          },
        };
      }
    }
  }

  // ── Transacción "pelada": palabra(s) + monto, sin verbo ni comando ────────
  // "almuerzo 850", "850 uber", "kiosco 1200". Si llegó hasta acá no fue
  // ninguna consulta/comando, así que un texto + un monto = gasto (o ingreso
  // si hay keyword de ingreso). 0 tokens, sin pasar por el LLM.
  const bareAmt = m.match(/(\d[\d.,]*)/);
  if (bareAmt) {
    const amount = parseAmount(bareAmt[1]);
    const desc = m
      .replace(/\d[\d.,]*/g, " ")
      .replace(/\b(pesos?|ars|usd|eur|uyu|brl|mangos?|lucas?|palos?)\b/g, " ")
      .replace(/\b(en|de|del|por|para|al|un|una|unos|unas|el|la|los|las|mi|mis|me|gaste|gasté|pague|pagué|compre|compré)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!isNaN(amount) && amount > 0 && desc.length >= 2) {
      const txType: "income" | "expense" = /ingres|sueldo|cobr[eé]?|me\s+pagaron|me\s+depositaron/.test(m) ? "income" : "expense";
      return { type: "flow", ctx: { flow: txType, description: desc, amount, category: categoryForText(desc) } };
    }
  }

  return { type: "unknown" };
}
