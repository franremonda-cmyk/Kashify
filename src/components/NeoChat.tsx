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

interface ChatMessage {
  id: string;
  role: "neo" | "user";
  text: string;
  ts: Date;
  isNotification?: boolean;
  isPending?: boolean;
  pendingData?: PendingTransaction;
  action?: {
    type: "confirm_delete";
    candidates: DeleteCandidate[];
    resolved?: boolean;
  };
}

interface Props {
  notifications: NeoNotification[];
  pending: PendingTransaction[];
  hasPhone: boolean;
  phoneNumber?: string;
}

// ─── Suggestion chips ────────────────────────────────────────────────────────

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
  const d = new Date(s);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function fmt(n: number, cur: string) {
  return `${cur} ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function notifToMessage(n: NeoNotification): ChatMessage {
  return {
    id: n.id,
    role: "neo",
    text: n.message,
    ts: new Date(n.created_at),
    isNotification: true,
  };
}

function pendingToMessage(p: PendingTransaction): ChatMessage {
  const interp = p.neo_interpretation;
  const text = interp
    ? `Confirmame este registro del mensaje "${p.raw_text}": ${interp.type === "income" ? "Ingreso" : "Gasto"} de ${interp.currency_code} ${Number(interp.amount).toLocaleString("es-AR")}${interp.description ? ` — ${interp.description}` : ""}.`
    : `No pude interpretar tu mensaje "${p.raw_text}". ¿Podés confirmarlo manualmente?`;
  return {
    id: p.id,
    role: "neo",
    text,
    ts: new Date(p.created_at ?? Date.now()),
    isPending: true,
    pendingData: p,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NeoChat({ notifications, pending, hasPhone, phoneNumber }: Props) {
  // Build initial messages from DB notifications + pending transactions
  const initialMessages: ChatMessage[] = [
    ...notifications.map(notifToMessage),
    ...pending.map(pendingToMessage),
  ].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [avatarState, setAvatarState] = useState<"idle" | "thinking" | "active">("idle");
  const [isActive, setIsActive] = useState(initialMessages.length > 0);
  const [busyPending, setBusyPending] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { type: "needs_amount"; txType: "income" | "expense"; description: string; suggestedCategory: string | null }
    | { type: "needs_goal_name" }
    | null
  >(null);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Voice input (Web Speech API — 0 tokens) ─────────────────────────────

  function startVoice() {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.onresult = (e: { results: { [n: number]: { [n: number]: { transcript: string } } } }) => {
      const text = e.results[0][0].transcript;
      setListening(false);
      sendMessage(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setIsActive(true);
  }

  // ── Send message to chat API ─────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", text: text.trim(), ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsActive(true);
    setAvatarState("thinking");

    // If Neo is waiting for an amount or a goal name, attach context
    const body: Record<string, unknown> = { message: text.trim() };
    if (pendingAction?.type === "needs_amount" && /^\d[\d.,]*$/.test(text.trim())) {
      body.pendingContext = pendingAction;
      setPendingAction(null);
    } else if (pendingAction?.type === "needs_goal_name") {
      body.pendingContext = { type: "create_goal_name" };
      setPendingAction(null);
    }

    try {
      const res = await fetch("/api/neo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = res.ok ? await res.json() : { text: "No pude procesar tu mensaje. Intentá de nuevo." };

      // Store pending context if Neo is asking for a follow-up
      if (data.action?.type === "needs_amount") {
        setPendingAction({ type: "needs_amount", txType: data.action.txType, description: data.action.description, suggestedCategory: data.action.suggestedCategory });
      } else if (data.action?.type === "needs_goal_name") {
        setPendingAction({ type: "needs_goal_name" });
      } else {
        setPendingAction(null);
      }

      const neoMsg: ChatMessage = {
        id: uid(),
        role: "neo",
        text: data.text ?? "...",
        ts: new Date(),
        action: data.action?.type === "confirm_delete" ? data.action : undefined,
      };
      setMessages(prev => [...prev, neoMsg]);
      if (data.action?.type === "refresh") window.dispatchEvent(new Event("transaction-added"));
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "Tuve un error de conexión. Intentá de nuevo.", ts: new Date() }]);
    } finally {
      setAvatarState("active");
    }
  }

  // ── Delete transaction ────────────────────────────────────────────────────

  async function deleteTransaction(msgId: string, txId: string, txDesc: string) {
    setBusyPending(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
      if (res.ok) {
        window.dispatchEvent(new Event("transaction-added"));
        const neoMsg: ChatMessage = { id: uid(), role: "neo", text: `✅ Listo, eliminé "${txDesc}".`, ts: new Date() };
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: { ...m.action!, resolved: true } } : m).concat(neoMsg));
      } else {
        setMessages(prev => [...prev, { id: uid(), role: "neo", text: "No pude eliminar la transacción. Intentá desde Actividad.", ts: new Date() }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "Error de conexión. Intentá de nuevo.", ts: new Date() }]);
    } finally {
      setBusyPending(null);
    }
  }

  // ── Confirm pending transaction ───────────────────────────────────────────

  async function confirmPending(pendingTx: PendingTransaction) {
    if (!pendingTx.neo_interpretation) return;
    setBusyPending(pendingTx.id);
    const interp = pendingTx.neo_interpretation;
    let categoryId: string | null = null;
    if (interp.category_name) {
      const match = categories.find(c => c.name.toLowerCase() === interp.category_name?.toLowerCase());
      categoryId = match?.id ?? null;
    }
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: interp.type,
        amount: interp.amount,
        currency_code: interp.currency_code,
        description: interp.description,
        category_id: categoryId,
        date: new Date().toISOString().split("T")[0],
      }),
    });
    await fetch(`/api/pending/${pendingTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    window.dispatchEvent(new Event("transaction-added"));
    setMessages(prev => prev.map(m =>
      m.pendingData?.id === pendingTx.id
        ? { ...m, isPending: false, pendingData: undefined, text: `✅ Registré: ${interp.description} — ${interp.currency_code} ${Number(interp.amount).toLocaleString("es-AR")}` }
        : m
    ));
    setBusyPending(null);
  }

  async function dismissPending(pendingTx: PendingTransaction) {
    setBusyPending(pendingTx.id);
    await fetch(`/api/pending/${pendingTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setMessages(prev => prev.filter(m => m.pendingData?.id !== pendingTx.id));
    setBusyPending(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const avatarClass = avatarState === "thinking" ? "neo-avatar-thinking" : isActive ? "neo-avatar-active" : "neo-avatar-idle";
  const avatarBg = "var(--accent)";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", overflow: "hidden",
      marginTop: -24, marginLeft: -16, marginRight: -16, marginBottom: -104,
    }}>

      {/* ── IDLE state — avatar from top ── */}
      {!isActive && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 16px 160px" }}>
          {/* Avatar — no letter, pure color from theme */}
          <div
            className={avatarClass}
            style={{ width: 140, height: 140, borderRadius: "50%", background: avatarBg, flexShrink: 0, boxShadow: "0 0 40px var(--accent-glow)" }}
          />

          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.5px" }}>Neo</p>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 4 }}>
              {hasPhone ? `Activo · ${phoneNumber}` : "Tu asistente personal"}
            </p>
          </div>

          {/* Connection CTA if no phone */}
          {!hasPhone && (
            <a href="/perfil" style={{ padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", textDecoration: "none" }}>
              Conectar WhatsApp →
            </a>
          )}

          {/* Inline input — replaces the fixed bar in idle state */}
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(input); }}
            style={{ display: "flex", gap: 8, width: "100%" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Preguntale algo a Neo..."
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 14, fontSize: 15,
                background: "var(--base)", border: "0.5px solid var(--glass-border)",
                color: "var(--ink)", outline: "none", boxSizing: "border-box",
              }}
              onFocus={() => { if (input.trim()) setIsActive(true); }}
            />
            {!input.trim() ? (
              <button type="button" onClick={startVoice}
                style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: listening ? "var(--accent)" : "var(--raised)", border: listening ? "none" : "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: listening ? "0 0 12px var(--accent-glow)" : "none", transition: "background 150ms ease-out" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: listening ? "#FFFFFF" : "var(--ink-muted)" }}>
                  <rect x="9" y="2" width="6" height="12" rx="3"/>
                  <path d="M5 10a7 7 0 0 0 14 0"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
              </button>
            ) : (
              <button type="submit"
                style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "var(--accent)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms ease-out" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "#FFFFFF", transform: "rotate(90deg)" }}>
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </form>

          {/* Suggestion chips */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                style={{ padding: "11px 16px", borderRadius: 14, fontSize: 13, fontWeight: 500, background: "var(--base)", border: "0.5px solid var(--glass-border)", color: "var(--ink)", textAlign: "left", boxShadow: "var(--shadow-sm)" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIVE state — chat layout ── */}
      {isActive && (
        <>
          {/* Header — sticky so it stays visible while messages scroll */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 10, paddingTop: 8, paddingBottom: 12, paddingInline: 16, borderBottom: "0.5px solid var(--glass-border)", background: "var(--void)", flexShrink: 0 }}>
            <div
              className={avatarClass}
              style={{ width: 44, height: 44, borderRadius: "50%", background: avatarBg, flexShrink: 0, boxShadow: "0 0 16px var(--accent-glow)" }}
            />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Neo</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)", display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                  {avatarState === "thinking" ? "Pensando..." : hasPhone ? `Activo · ${phoneNumber}` : "Activo"}
                </span>
              </div>
            </div>
          </div>

          {/* Message list — scrolleable, room for fixed input bar */}
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 120px", display: "flex", flexDirection: "column", gap: 8 } as React.CSSProperties}>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                busyPending={busyPending}
                onConfirmPending={confirmPending}
                onDismissPending={dismissPending}
                onDelete={deleteTransaction}
              />
            ))}

            {/* Typing indicator */}
            {avatarState === "thinking" && (
              <div style={{ display: "flex", gap: 6, padding: "10px 14px", borderRadius: 16, background: "var(--raised)", border: "0.5px solid var(--glass-border)", alignSelf: "flex-start", maxWidth: 80 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: `neo-typing 1.3s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* ── Input bar — fixed above bottom nav ── */}
          <div style={{
            position: "fixed",
            bottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(100%, 520px)",
            padding: "10px 16px 12px",
            background: "var(--void)",
            borderTop: "0.5px solid var(--glass-border)",
            zIndex: 200,
          }}>
            {/* Pending context indicator */}
            {pendingAction?.type === "needs_amount" && (
              <p style={{ fontSize: 11, color: "var(--accent)", marginBottom: 6, paddingInline: 2 }}>
                💬 Esperando monto para: {pendingAction.description}
              </p>
            )}
            {pendingAction?.type === "needs_goal_name" && (
              <p style={{ fontSize: 11, color: "var(--accent)", marginBottom: 6, paddingInline: 2 }}>
                💬 Esperando nombre de la meta...
              </p>
            )}
            <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Escribile a Neo..."
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 14, fontSize: 15,
                  background: "var(--base)", border: "0.5px solid var(--glass-border)",
                  color: "var(--ink)", outline: "none", boxSizing: "border-box",
                }}
              />
              {!input.trim() ? (
                <button type="button" onClick={startVoice}
                  style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: listening ? "var(--accent)" : "var(--raised)", border: listening ? "none" : "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: listening ? "0 0 12px var(--accent-glow)" : "none", transition: "background 150ms ease-out" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: listening ? "#FFFFFF" : "var(--ink-muted)" }}>
                    <rect x="9" y="2" width="6" height="12" rx="3"/>
                    <path d="M5 10a7 7 0 0 0 14 0"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                  </svg>
                </button>
              ) : (
                <button type="submit" disabled={avatarState === "thinking"}
                  style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: avatarState !== "thinking" ? "var(--accent)" : "var(--raised)", border: "0.5px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms ease-out" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "#FFFFFF", transform: "rotate(90deg)" }}>
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  busyPending,
  onConfirmPending,
  onDismissPending,
  onDelete,
}: {
  msg: ChatMessage;
  busyPending: string | null;
  onConfirmPending: (p: PendingTransaction) => void;
  onDismissPending: (p: PendingTransaction) => void;
  onDelete: (msgId: string, txId: string, txDesc: string) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
      {/* Main bubble */}
      <div
        style={{
          maxWidth: "82%",
          padding: msg.isPending || msg.action ? "12px 14px" : "10px 14px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? "var(--accent)" : msg.isNotification ? "var(--accent-soft)" : "var(--raised)",
          border: isUser ? "none" : msg.isNotification ? "0.5px solid var(--accent-glow)" : "0.5px solid var(--glass-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Notification badge */}
        {msg.isNotification && (
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", marginBottom: 4 }}>Neo</p>
        )}

        {/* Text (render with line breaks) */}
        <p style={{ fontSize: 14, color: isUser ? "#FFFFFF" : "var(--ink)", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.text}
        </p>

        {/* Pending transaction actions */}
        {msg.isPending && msg.pendingData && (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={() => onConfirmPending(msg.pendingData!)}
              disabled={busyPending === msg.pendingData.id}
              style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: busyPending === msg.pendingData.id ? 0.5 : 1 }}
            >
              {busyPending === msg.pendingData.id ? "..." : "Confirmar"}
            </button>
            <button
              onClick={() => onDismissPending(msg.pendingData!)}
              disabled={!!busyPending}
              style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.08)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.18)" }}
            >
              Descartar
            </button>
          </div>
        )}

        {/* Delete confirmation */}
        {msg.action?.type === "confirm_delete" && !msg.action.resolved && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {msg.action.candidates.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--base)", border: "0.5px solid var(--glass-border)" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>{c.description}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>{fmt(c.amount, c.currency_code)} · {fmtDate(c.date)}</p>
                </div>
                <button
                  onClick={() => onDelete(msg.id, c.id, c.description)}
                  disabled={busyPending === c.id}
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.22)", flexShrink: 0 }}
                >
                  {busyPending === c.id ? "..." : "Eliminar"}
                </button>
              </div>
            ))}
            <button
              onClick={() => {/* just dismiss the action */}}
              style={{ padding: "7px", borderRadius: 10, fontSize: 11, color: "var(--ink-dim)", background: "transparent" }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <p style={{ fontSize: 10, color: "var(--ink-dim)", paddingInline: 4 }}>{fmtTime(msg.ts)}</p>
    </div>
  );
}
