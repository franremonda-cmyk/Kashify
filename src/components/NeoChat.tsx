"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { PendingTransaction } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NeoNotification {
  id: string;
  message: string;
  type: string;
  created_at: string;
}

interface DeleteCandidate {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  date: string;
}

type ChatAction =
  | { type: "confirm_delete"; candidates: DeleteCandidate[]; resolved?: boolean }
  | { type: "confirm_delete_goal"; goalId: string; goalName: string; resolved?: boolean }
  | { type: "confirm_cancel_installment"; planId: string; planName: string; resolved?: boolean };

interface ChatMessage {
  id: string;
  role: "neo" | "user";
  text: string;
  ts: Date;
  isNotification?: boolean;
  isPending?: boolean;
  pendingData?: PendingTransaction;
  action?: ChatAction;
}

interface Props {
  notifications: NeoNotification[];
  pending: PendingTransaction[];
  hasPhone: boolean;
  phoneNumber?: string;
}

const SUGGESTIONS = [
  "¿Cuánto gasté este mes?",
  "¿Cuál es mi saldo?",
  "Mis límites",
  "Mis metas",
  "Mis cuotas",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function fmt(n: number, cur: string) {
  return `${cur} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function uid() { return Math.random().toString(36).slice(2); }

function dateSeparator(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}

function notifToMessage(n: NeoNotification): ChatMessage {
  return { id: n.id, role: "neo", text: n.message, ts: new Date(n.created_at), isNotification: true };
}

function pendingToMessage(p: PendingTransaction): ChatMessage {
  const interp = p.neo_interpretation;
  const text = interp
    ? `Confirmame este registro del mensaje "${p.raw_text}": ${interp.type === "income" ? "Ingreso" : "Gasto"} de ${interp.currency_code} ${Number(interp.amount).toLocaleString("es-AR")}${interp.description ? ` — ${interp.description}` : ""}.`
    : `No pude interpretar tu mensaje "${p.raw_text}". ¿Podés confirmarlo manualmente?`;
  return { id: p.id, role: "neo", text, ts: new Date(p.created_at ?? Date.now()), isPending: true, pendingData: p };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NeoChat({ notifications, pending, hasPhone, phoneNumber }: Props) {
  const initialMessages: ChatMessage[] = [
    ...notifications.map(notifToMessage),
    ...pending.map(pendingToMessage),
  ].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isActive, setIsActive] = useState(initialMessages.length > 0);
  const [busyPending, setBusyPending] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [keyboardH, setKeyboardH] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const [pendingAction, setPendingAction] = useState<
    | { type: "needs_amount"; txType: "income" | "expense"; description: string; suggestedCategory: string | null }
    | { type: "needs_goal_name" }
    | null
  >(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isActive) scrollToBottom(); }, [isActive, scrollToBottom]);

  // ── Keyboard tracking (visualViewport) ─────────────────────────────────────
  // When the on-screen keyboard opens, the visual viewport shrinks. We compute
  // its height and lift the whole fixed container above the keyboard, so the
  // input rides on top of the keyboard and covers the app navbar; when the
  // keyboard closes, the container sits above the navbar (navbar visible again).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardH(kb);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  useEffect(() => { scrollToBottom(); }, [keyboardH, scrollToBottom]);

  // ── Send ─────────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: uid(), role: "user", text: text.trim(), ts: new Date() }]);
    setInput("");
    setIsActive(true);
    setThinking(true);

    const body: Record<string, unknown> = { message: text.trim() };
    if (pendingAction?.type === "needs_amount" && /^\d[\d.,]*$/.test(text.trim())) {
      body.pendingContext = pendingAction; setPendingAction(null);
    } else if (pendingAction?.type === "needs_goal_name") {
      body.pendingContext = { type: "create_goal_name" }; setPendingAction(null);
    }

    try {
      const res = await fetch("/api/neo/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = res.ok ? await res.json() : { text: "No pude procesar tu mensaje. Intentá de nuevo." };

      if (data.action?.type === "needs_amount") setPendingAction({ type: "needs_amount", txType: data.action.txType, description: data.action.description, suggestedCategory: data.action.suggestedCategory });
      else if (data.action?.type === "needs_goal_name") setPendingAction({ type: "needs_goal_name" });
      else setPendingAction(null);

      const actionTypes = ["confirm_delete", "confirm_delete_goal", "confirm_cancel_installment"];
      setMessages(prev => [...prev, {
        id: uid(), role: "neo", text: data.text ?? "...", ts: new Date(),
        action: data.action && actionTypes.includes(data.action.type) ? data.action : undefined,
      }]);
      if (data.action?.type === "refresh") window.dispatchEvent(new Event("transaction-added"));
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "Error de conexión. Intentá de nuevo.", ts: new Date() }]);
    } finally {
      setThinking(false);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function dismissAction(msgId: string) {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: m.action ? { ...m.action, resolved: true } : undefined } : m));
  }

  async function deleteTransaction(msgId: string, txId: string, txDesc: string) {
    setBusyPending(txId);
    const res = await fetch(`/api/transactions/${txId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      window.dispatchEvent(new Event("transaction-added"));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: { ...m.action!, resolved: true } } : m).concat({ id: uid(), role: "neo", text: `Eliminé "${txDesc}".`, ts: new Date() }));
    } else {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "No pude eliminar. Intentá desde Actividad.", ts: new Date() }]);
    }
    setBusyPending(null);
  }

  async function deleteGoal(msgId: string, goalId: string, goalName: string) {
    setBusyPending(goalId);
    const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      window.dispatchEvent(new Event("transaction-added"));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: { ...m.action!, resolved: true } } : m).concat({ id: uid(), role: "neo", text: `Eliminé la meta "${goalName}".`, ts: new Date() }));
    } else {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "No pude eliminar. Intentá desde Metas.", ts: new Date() }]);
    }
    setBusyPending(null);
  }

  async function cancelInstallment(msgId: string, planId: string, planName: string) {
    setBusyPending(planId);
    const res = await fetch(`/api/installments/${planId}/cancel`, { method: "POST" }).catch(() => null);
    if (res?.ok) {
      window.dispatchEvent(new Event("transaction-added"));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: { ...m.action!, resolved: true } } : m).concat({ id: uid(), role: "neo", text: `Saldé el plan "${planName}".`, ts: new Date() }));
    } else {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "No pude saldar. Intentá desde Cuotas.", ts: new Date() }]);
    }
    setBusyPending(null);
  }

  async function confirmPending(pendingTx: PendingTransaction) {
    if (!pendingTx.neo_interpretation) return;
    setBusyPending(pendingTx.id);
    const interp = pendingTx.neo_interpretation;
    const catMatch = categories.find(c => c.name.toLowerCase() === interp.category_name?.toLowerCase());
    await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: interp.type, amount: interp.amount, currency_code: interp.currency_code, description: interp.description, category_id: catMatch?.id ?? null, date: new Date().toISOString().split("T")[0] }) });
    await fetch(`/api/pending/${pendingTx.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "confirmed" }) });
    window.dispatchEvent(new Event("transaction-added"));
    setMessages(prev => prev.map(m => m.pendingData?.id === pendingTx.id ? { ...m, isPending: false, pendingData: undefined, text: `Registré: ${interp.description} — ${interp.currency_code} ${Number(interp.amount).toLocaleString("es-AR")}` } : m));
    setBusyPending(null);
  }

  async function dismissPending(pendingTx: PendingTransaction) {
    setBusyPending(pendingTx.id);
    await fetch(`/api/pending/${pendingTx.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) });
    setMessages(prev => prev.filter(m => m.pendingData?.id !== pendingTx.id));
    setBusyPending(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Single fixed flex-column container (WhatsApp ".phone"). Its bottom edge is
  // dynamic: when the keyboard is closed it sits just above the app navbar
  // (navbar visible); when the keyboard opens it lifts above the keyboard so the
  // input rides on top of it and the navbar is covered by the keyboard.
  const NAV_CLEARANCE = "calc(84px + env(safe-area-inset-bottom, 0px))";
  const containerBottom = keyboardH > 0 ? `${keyboardH}px` : NAV_CLEARANCE;

  // Shared input bar (used by idle + active). No microphone — text only.
  const inputBar = (
    <div style={{
      flexShrink: 0,
      padding: "6px 8px 8px",
      background: "var(--base)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      {pendingAction?.type === "needs_amount" && (
        <p style={{ fontSize: 11, color: "var(--accent)", paddingInline: 14 }}>
          Esperando monto para: {pendingAction.description}
        </p>
      )}
      {pendingAction?.type === "needs_goal_name" && (
        <p style={{ fontSize: 11, color: "var(--accent)", paddingInline: 14 }}>
          Esperando nombre de la meta...
        </p>
      )}
      <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: "var(--raised)", borderRadius: 24, padding: "4px 6px 4px 16px", border: "0.5px solid var(--glass-border)", minHeight: 44 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribir mensaje a Neo…"
            style={{ flex: 1, fontSize: 15.5, background: "transparent", border: "none", outline: "none", color: "var(--ink)", padding: "6px 0" }}
          />
        </div>
        <button
          type="submit"
          disabled={thinking || !input.trim()}
          aria-label="Enviar"
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: input.trim() && !thinking ? "var(--accent)" : "var(--raised)",
            border: "0.5px solid var(--glass-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: input.trim() && !thinking ? "0 0 12px var(--accent-glow)" : "none",
            transition: "background 150ms",
          }}
        >
          <SendIcon color={input.trim() && !thinking ? "#fff" : "var(--ink-muted)"} />
        </button>
      </form>
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      bottom: containerBottom,
      zIndex: 20,
      display: "flex", flexDirection: "column",
      background: "var(--base)",
      transition: "bottom 180ms ease-out",
    }}>

      {/* ── IDLE state ── */}
      {!isActive && (
        <>
          {/* Header strip */}
          <div style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 12,
            padding: "calc(10px + env(safe-area-inset-top, 0px)) 16px 10px",
            background: "var(--accent)",
          }}>
            <div className="neo-avatar-active" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>Neo</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.2 }}>asistente personal de finanzas</p>
            </div>
          </div>

          {/* Welcome body — scrollable */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
            background: "var(--base)",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, padding: "32px 16px 24px",
          } as React.CSSProperties}>
            <div className="neo-avatar-idle" style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 32px var(--accent-glow)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Hola, soy Neo</p>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 4 }}>Tu asistente personal de finanzas</p>
            </div>
            {!hasPhone && (
              <a href="/perfil" style={{ padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", textDecoration: "none" }}>
                Conectar WhatsApp →
              </a>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 8 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  style={{ padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 500, background: "var(--raised)", border: "0.5px solid var(--glass-border)", color: "var(--ink)", textAlign: "left" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {inputBar}
        </>
      )}

      {/* ── ACTIVE state ── */}
      {isActive && (
        <>
          {/* WhatsApp-style header strip */}
          <div style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 10,
            padding: "calc(10px + env(safe-area-inset-top, 0px)) 16px 10px 6px",
            background: "var(--accent)",
          }}>
            <button
              onClick={() => setIsActive(false)}
              aria-label="Volver"
              style={{ width: 36, height: 36, borderRadius: "50%", background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className={thinking ? "neo-avatar-thinking" : "neo-avatar-active"} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>Neo</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {thinking ? "escribiendo..." : "asistente personal de finanzas"}
              </p>
            </div>
          </div>

          {/* Message list — the only scrollable area */}
          <div ref={listRef} style={{
            flex: 1, minHeight: 0,
            overflowY: "auto", WebkitOverflowScrolling: "touch",
            padding: "8px 8px 12px",
            display: "flex", flexDirection: "column", gap: 2,
          } as React.CSSProperties}>
            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const showDate = !prevMsg || msg.ts.toDateString() !== prevMsg.ts.toDateString();
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                      <span style={{ fontSize: 11, color: "var(--ink-muted)", background: "var(--raised)", padding: "3px 10px", borderRadius: 8, border: "0.5px solid var(--glass-border)" }}>
                        {dateSeparator(msg.ts)}
                      </span>
                    </div>
                  )}
                  <WaBubble
                    msg={msg}
                    busyPending={busyPending}
                    onConfirmPending={confirmPending}
                    onDismissPending={dismissPending}
                    onDelete={deleteTransaction}
                    onDeleteGoal={deleteGoal}
                    onCancelInstallment={cancelInstallment}
                    onDismissAction={dismissAction}
                  />
                </div>
              );
            })}

            {/* Typing indicator */}
            {thinking && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginLeft: 8, marginTop: 2 }}>
                <div style={{ padding: "10px 14px", borderRadius: "0px 16px 16px 16px", background: "var(--raised)", border: "0.5px solid var(--glass-border)", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ink-muted)", display: "inline-block", animation: `neo-typing 1.3s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {inputBar}
        </>
      )}
    </div>,
    document.body
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SendIcon({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
      <path d="M2 12l19-9-7 19-2.5-7.5L2 12z" />
    </svg>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function WaBubble({
  msg, busyPending,
  onConfirmPending, onDismissPending, onDelete, onDeleteGoal, onCancelInstallment, onDismissAction,
}: {
  msg: ChatMessage;
  busyPending: string | null;
  onConfirmPending: (p: PendingTransaction) => void;
  onDismissPending: (p: PendingTransaction) => void;
  onDelete: (msgId: string, txId: string, txDesc: string) => void;
  onDeleteGoal: (msgId: string, goalId: string, goalName: string) => void;
  onCancelInstallment: (msgId: string, planId: string, planName: string) => void;
  onDismissAction: (msgId: string) => void;
}) {
  const isUser = msg.role === "user";

  // WhatsApp bubble shapes
  const bubbleBg = isUser ? "var(--accent)" : "var(--raised)";
  const bubbleRadius = isUser ? "18px 2px 18px 18px" : "2px 18px 18px 18px";
  const textColor = isUser ? "#fff" : "var(--ink)";
  const timeColor = isUser ? "rgba(255,255,255,0.65)" : "var(--ink-dim)";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginTop: 3,
      paddingInline: 6,
    }}>
      <div style={{
        maxWidth: "78%",
        background: bubbleBg,
        borderRadius: bubbleRadius,
        padding: msg.isPending || msg.action ? "10px 12px" : "7px 12px 4px",
        border: isUser ? "none" : "0.5px solid var(--glass-border)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
      }}>
        {/* Notification label */}
        {msg.isNotification && (
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", marginBottom: 3 }}>Neo</p>
        )}

        {/* Text */}
        <p style={{ fontSize: 14.5, color: textColor, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.text}
        </p>

        {/* Timestamp — inline at bottom right like WhatsApp */}
        <p style={{ fontSize: 10.5, color: timeColor, textAlign: "right", marginTop: 2, lineHeight: 1 }}>
          {fmtTime(msg.ts)}
        </p>

        {/* Pending transaction actions */}
        {msg.isPending && msg.pendingData && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => onConfirmPending(msg.pendingData!)} disabled={busyPending === msg.pendingData.id}
              style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#fff", opacity: busyPending === msg.pendingData.id ? 0.5 : 1, border: "none" }}>
              {busyPending === msg.pendingData.id ? "..." : "Confirmar"}
            </button>
            <button onClick={() => onDismissPending(msg.pendingData!)} disabled={!!busyPending}
              style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.22)" }}>
              Descartar
            </button>
          </div>
        )}

        {/* Delete tx confirmation */}
        {msg.action?.type === "confirm_delete" && !msg.action.resolved && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {msg.action.candidates.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--base)", border: "0.5px solid var(--glass-border)" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>{c.description}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 1 }}>{fmt(c.amount, c.currency_code)} · {fmtDate(c.date)}</p>
                </div>
                <button onClick={() => onDelete(msg.id, c.id, c.description)} disabled={busyPending === c.id}
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.22)", flexShrink: 0 }}>
                  {busyPending === c.id ? "..." : "Eliminar"}
                </button>
              </div>
            ))}
            <button onClick={() => onDismissAction(msg.id)}
              style={{ padding: "7px", borderRadius: 10, fontSize: 11, color: "var(--ink-dim)", background: "transparent", border: "none" }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Delete goal confirmation */}
        {msg.action?.type === "confirm_delete_goal" && !msg.action.resolved && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => onDeleteGoal(msg.id, (msg.action as Extract<ChatAction, { type: "confirm_delete_goal" }>).goalId, (msg.action as Extract<ChatAction, { type: "confirm_delete_goal" }>).goalName)} disabled={!!busyPending}
              style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.22)", opacity: busyPending ? 0.5 : 1 }}>
              {busyPending ? "..." : "Sí, eliminar"}
            </button>
            <button onClick={() => onDismissAction(msg.id)}
              style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink)" }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Cancel installment confirmation */}
        {msg.action?.type === "confirm_cancel_installment" && !msg.action.resolved && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => onCancelInstallment(msg.id, (msg.action as Extract<ChatAction, { type: "confirm_cancel_installment" }>).planId, (msg.action as Extract<ChatAction, { type: "confirm_cancel_installment" }>).planName)} disabled={!!busyPending}
              style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.22)", opacity: busyPending ? 0.5 : 1 }}>
              {busyPending ? "..." : "Sí, saldar"}
            </button>
            <button onClick={() => onDismissAction(msg.id)}
              style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink)" }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
