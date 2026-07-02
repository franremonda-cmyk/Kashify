import type { SupabaseClient } from "@supabase/supabase-js";

// El motor es agnóstico del cliente de Supabase: funciona igual con el client
// con sesión de usuario (web) o el de service-role (WhatsApp), porque todas las
// queries filtran explícitamente por user_id.
export type NeoSupabase = SupabaseClient;

// Canal que invoca el motor. Define capacidades de UI (la web puede mostrar
// formularios y botones de confirmación; WhatsApp solo texto).
export type NeoChannel = "web" | "whatsapp";

// ─── Intents (0 tokens) ──────────────────────────────────────────────────────

export type Intent =
  | { type: "greeting" }
  | { type: "help" }
  | { type: "cancel_pending" }
  | { type: "balance_query" }
  | { type: "spending_query"; category?: string; period: "month" | "week" | "today" }
  | { type: "income_query"; period: "month" | "week" | "today" }
  | { type: "summary_query" }
  | { type: "recent_tx_query" }
  | { type: "budget_query"; category?: string }
  | { type: "goals_query" }
  | { type: "installments_query" }
  | { type: "edit_budget"; category: string; amount: number }
  | { type: "delete_budget"; category: string }
  | { type: "delete_tx"; search: string }
  | { type: "correct_tx_category"; search?: string; category: string }
  | { type: "create_goal"; name: string; amount?: number }
  | { type: "delete_goal"; name: string }
  | { type: "rename_goal"; oldName: string; newName: string }
  | { type: "set_goal_target"; name: string; amount: number }
  | { type: "deposit_goal"; amount: number; goalName: string }
  | { type: "pay_installment"; name: string }
  | { type: "cancel_installment"; name: string }
  | { type: "flow"; ctx: FlowContext }
  | { type: "unknown" };

// ─── Flow context (slot-filling) ─────────────────────────────────────────────

// Una acción parcialmente completada que espera sus slots faltantes.
// space_id: espacio destino ya resuelto. awaitingSpace: Neo preguntó a qué
// espacio y espera la respuesta (solo gastos/ingresos preguntan).
export type FlowContext =
  | { flow: "expense" | "income"; description?: string; amount?: number; category?: string | null; space_id?: string; awaitingSpace?: boolean }
  | { flow: "installment"; name?: string; nInstallments?: number; installmentAmount?: number; space_id?: string }
  | { flow: "goal"; name?: string; target?: number; space_id?: string }
  | { flow: "budget"; category?: string; amount?: number; space_id?: string }
  | { flow: "clarify" };

export interface DeleteCandidate {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  date: string;
}

// ─── Estado de conversación (persistido server-side para WhatsApp; round-trip
//     vía cliente para web) ─────────────────────────────────────────────────

// Confirmaciones pendientes (WhatsApp las resuelve con "sí"/"no"/número; la web
// las resuelve con botones via NeoEffect).
export type PendingConfirm =
  | { kind: "confirm_delete_tx"; candidates: DeleteCandidate[] }
  | { kind: "confirm_delete_goal"; goalId: string; goalName: string }
  | { kind: "confirm_cancel_installment"; planId: string; planName: string };

// Estado que viaja entre turnos. Puede ser un flujo de slot-filling o una
// confirmación pendiente.
// Preguntar antes de asumir: Haiku interpretó algo pero no está seguro → Neo
// confirma la categoría/tipo antes de registrar (en vez de crear mal).
export interface ConfirmTx {
  kind: "confirm_tx";
  parsed: { type: "expense" | "income"; amount: number; currency_code: string; description: string; category_name?: string | null };
  original: string;          // mensaje original → keyword para aprender
  spaceId?: string | null;
  awaitingCategory?: boolean; // segundo turno: el usuario está eligiendo categoría
}

export type NeoState =
  | { kind: "flow"; ctx: FlowContext }
  | { kind: "clarify_learn"; original: string }
  | ConfirmTx
  | PendingConfirm;

// ─── Efectos de UI (solo los consume la web) ─────────────────────────────────

export type NeoEffect =
  | { type: "refresh" }
  | { type: "cancel_pending" }
  | { type: "installment_form"; prefill: { name?: string; nInstallments?: number; installmentAmount?: number } }
  | { type: "confirm_delete"; candidates: DeleteCandidate[] }
  | { type: "confirm_delete_goal"; goalId: string; goalName: string }
  | { type: "confirm_cancel_installment"; planId: string; planName: string };

// ─── Resultado canónico del motor ────────────────────────────────────────────

export interface NeoReply {
  text: string;
  // Estado a persistir/round-trip para el próximo turno (null = limpiar).
  state?: NeoState | null;
  // Efectos de UI para la web (la web mapea effects[0] → action). WhatsApp los ignora.
  effects?: NeoEffect[];
  // Quick-replies (web los muestra como botones).
  options?: string[];
}

// Keywords aprendidas por usuario, cargadas una vez por request para alimentar
// la detección de intent en 0 tokens.
export interface LearnedKeyword {
  keyword: string;
  type: "expense" | "income";
  currency_code: string | null;
  category: string | null;
  last_amount?: number | null;  // monto "de siempre" (Fase 3: se ofrece como pregunta)
  weight?: number;              // confianza × usos, para rankear matches
}
