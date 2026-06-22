import { categoryForText } from "@/lib/neo-keywords";
import { normalize } from "./intent";
import type { FlowContext } from "./types";

export function parseNum(s: string): number | null {
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  return isNaN(n) || n <= 0 ? null : n;
}

export function isCancelMsg(s: string): boolean {
  return /^(no|nada|olvida(lo)?|cancela(lo)?|deja(lo)?|deja|dejá|no importa|mejor no|ya esta|ya está)\b/.test(normalize(s));
}

function cleanText(s: string): string {
  return s.replace(/^(en|de|fue|son|por|para|un|una|el|la)\s+/i, "").replace(/[.!?]+$/, "").trim();
}

// Cuál slot falta todavía (gobierna tanto la pregunta como el llenado).
export function missingSlot(ctx: FlowContext): string | null {
  switch (ctx.flow) {
    case "expense":
    case "income":
      if (!ctx.description) return "description";
      if (ctx.amount == null) return "amount";
      return null;
    case "installment":
      if (!ctx.name) return "iname";
      if (ctx.nInstallments == null) return "icount";
      if (ctx.installmentAmount == null) return "iamount";
      return null;
    case "goal":
      if (!ctx.name) return "gname";
      return null;
    case "budget":
      if (!ctx.category) return "bcategory";
      if (ctx.amount == null) return "bamount";
      return null;
    case "clarify":
      return "clarify";
  }
}

export function fillSlot(ctx: FlowContext, message: string): FlowContext {
  const slot = missingSlot(ctx);
  const t = cleanText(message);
  const num = parseNum(message);
  const c = { ...ctx } as Record<string, unknown>;
  switch (slot) {
    case "description":
      c.description = t;
      c.category = (ctx as { category?: string | null }).category ?? categoryForText(t);
      break;
    case "amount":
      if (num != null) c.amount = num;
      break;
    case "iname":
    case "gname":
      c.name = t;
      break;
    case "icount":
      if (num != null) c.nInstallments = Math.round(num);
      break;
    case "iamount":
      if (num != null) c.installmentAmount = num;
      break;
    case "bcategory":
      c.category = t;
      break;
    case "bamount":
      if (num != null) c.amount = num;
      break;
  }
  return c as FlowContext;
}

export function slotQuestion(ctx: FlowContext, slot: string): { text: string; options?: string[] } {
  switch (slot) {
    case "description": return { text: ctx.flow === "income" ? "¿Qué cobraste?" : "¿En qué lo gastaste?" };
    case "amount": return { text: ctx.flow === "income" ? "¿Cuánto cobraste?" : "¿Cuánto te salió?" };
    case "iname": return { text: "¿Qué compraste en cuotas?" };
    case "icount": return { text: "¿En cuántas cuotas?" };
    case "iamount": return { text: "¿De cuánto es cada cuota?" };
    case "gname": return { text: "¿Cómo querés llamar la meta?" };
    case "bcategory": return { text: "¿Para qué categoría es el límite?" };
    case "bamount": return { text: "¿De cuánto es el límite mensual?" };
    case "clarify": return { text: "No entendí 🤔 ¿Qué querés hacer?", options: ["Registrar gasto", "Registrar ingreso", "Consultar"] };
    default: return { text: "¿Podés repetirlo?" };
  }
}

// Mapea una respuesta de clarify (o texto libre) a un flow nuevo, o null si no aplica.
export function interpretClarify(message: string): FlowContext | null {
  const m = normalize(message);
  if (/^gast|registrar gasto|un gasto|gasto$/.test(m)) return { flow: "expense" };
  if (/^ingres|cobr|registrar ingreso|un ingreso|ingreso$/.test(m)) return { flow: "income" };
  return null;
}
