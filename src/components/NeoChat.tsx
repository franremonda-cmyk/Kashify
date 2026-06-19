"use client";
import { useState, useRef, useEffect, useCallback } from "react";
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
  const [listening, setListening] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { type: "needs_amount"; txType: "income" | "expense"; description: string; suggestedCategory: string | null }
    | { type: "needs_goal_name" }
    | null
  >(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

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

  // ── Voice ────────────────────────────────────────────────────────────────

  function startVoice() {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.onresult = (e: { results: { [n: number]: { [n: number]: { transcript: string } } } }) => {
      setListening(false);
      sendMessage(e.results[0][0].transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setIsActive(true);
  }

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

  // Nav pill top edge: bottom=16px + safe-area, height=60px → total ~76px + safe-area
  const INPUT_BOTTOM = "calc(80px + env(safe-area-inset-bottom, 0px))";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", overflow: "hidden",
      marginTop: -24, marginLeft: -16, marginRight: -16, marginBottom: -104,
    }}>

      {/* ── IDLE state ── */}
      {!isActive && (
        <>
          {/* Header idle */}
          <div style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px",
            background: "var(--accent)",
          }}>
            <div className="neo-avatar-idle" style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>Neo</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>Tu asistente personal</p>
            </div>
          </div>

          {/* Body */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
            background: "var(--base)",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, padding: "32px 16px 160px",
          }}>
            <div className="neo-avatar-idle" style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 32px var(--accent-glow)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Hola, soy Neo</p>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 4 }}>Preguntame lo que quieras sobre tus finanzas</p>
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

          {/* Input bar idle — same fixed bar */}
          <div style={{
            position: "fixed", bottom: INPUT_BOTTOM, left: 0, right: 0, zIndex: 50,
            padding: "8px 12px",
            background: "var(--void)",
            borderTop: "0.5px solid var(--glass-border)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--raised)", borderRadius: 24, padding: "2px 4px 2px 16px", border: "0.5px solid var(--glass-border)" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Mensaje"
                style={{ flex: 1, fontSize: 15, background: "transparent", border: "none", outline: "none", color: "var(--ink)", padding: "8px 0" }}
              />
              {input.trim() && (
                <button type="submit" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <SendIcon />
                </button>
              )}
            </form>
            {!input.trim() && (
              <button type="button" onClick={startVoice} style={{ width: 44, height: 44, borderRadius: "50%", background: listening ? "var(--accent)" : "var(--raised)", border: "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: listening ? "0 0 12px var(--accent-glow)" : "none" }}>
                <MicIcon color={listening ? "#fff" : "var(--ink-muted)"} />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── ACTIVE state ── */}
      {isActive && (
        <>
          {/* WhatsApp-style header */}
          <div style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px 10px 8px",
            background: "var(--accent)",
          }}>
            {/* Back to close/reset */}
            <button
              onClick={() => { setIsActive(false); setMessages([]); }}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className={thinking ? "neo-avatar-thinking" : "neo-avatar-active"} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>Neo</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.2 }}>
                {thinking ? "escribiendo..." : hasPhone ? phoneNumber : "en línea"}
              </p>
            </div>
          </div>

          {/* Chat area — WhatsApp wallpaper feel */}
          <div ref={listRef} style={{
            flex: 1, minHeight: 0,
            overflowY: "auto", WebkitOverflowScrolling: "touch",
            background: "var(--base)",
            padding: "8px 8px 130px",
            display: "flex", flexDirection: "column", gap: 2,
          } as React.CSSProperties}>

            {messages.map((msg, i) => {
              // Date separator
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

          {/* WhatsApp-style input bar */}
          <div style={{
            position: "fixed", bottom: INPUT_BOTTOM, left: 0, right: 0, zIndex: 50,
            padding: "8px 12px",
            background: "var(--void)",
            borderTop: "0.5px solid var(--glass-border)",
            display: "flex", alignItems: "flex-end", gap: 8,
          }}>
            {/* Context hint */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
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
              {/* Input pill */}
              <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{ display: "flex", alignItems: "center", background: "var(--raised)", borderRadius: 24, padding: "2px 4px 2px 16px", border: "0.5px solid var(--glass-border)" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Mensaje"
                  style={{ flex: 1, fontSize: 15, background: "transparent", border: "none", outline: "none", color: "var(--ink)", padding: "10px 0" }}
                />
                {input.trim() && (
                  <button type="submit" disabled={thinking} style={{ width: 36, height: 36, borderRadius: "50%", background: thinking ? "var(--raised)" : "var(--accent)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 2 }}>
                    <SendIcon />
                  </button>
                )}
              </form>
            </div>
            {/* Mic button */}
            {!input.trim() && (
              <button type="button" onClick={startVoice} style={{ width: 44, height: 44, borderRadius: "50%", background: listening ? "var(--accent)" : "var(--raised)", border: "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: listening ? "0 0 12px var(--accent-glow)" : "none", transition: "background 150ms" }}>
                <MicIcon color={listening ? "#fff" : "var(--ink-muted)"} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(90deg)" }}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
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
