"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { PendingTransaction } from "@/types";
import NeoOrb from "./NeoOrb";

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
  | { type: "confirm_cancel_installment"; planId: string; planName: string; resolved?: boolean }
  | { type: "installment_form"; prefill?: { name?: string; nInstallments?: number; installmentAmount?: number }; resolved?: boolean };

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
  "¿Cómo van mis límites?",
  "¿Cómo van mis metas?",
  "¿Qué cuotas tengo?",
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
  const [kbOpen, setKbOpen] = useState(false);
  const [vpH, setVpH] = useState(0);   // visualViewport.height — real visible area above keyboard
  const [noKbH, setNoKbH] = useState(0); // actual rendered container height when keyboard is closed
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Clean slate on mount — previous instance may have left these if it unmounted
    // while the keyboard was open or the user was chatting.
    document.body.classList.remove("neo-keyboard-open");
    document.body.classList.remove("neo-chatting");
    setMounted(true);
    return () => {
      document.body.classList.remove("neo-keyboard-open");
      document.body.classList.remove("neo-chatting");
    };
  }, []);
  // Generic slot-filling context echoed back to the server (opaque to the client).
  // useRef instead of useState: sendMessage must always read the *current* value,
  // not a value captured in a stale closure from a previous render (iOS Safari
  // fires visualViewport events that cause re-renders mid-fetch, which would
  // make a useState closure see null even after the context was set).
  const pendingCtxRef = useRef<unknown | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxVpHeight = useRef(0);

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

  // ── Keyboard detection (visualViewport) ────────────────────────────────────
  // Track whether the soft keyboard is open by comparing the current visual
  // viewport height (vv.height) against the largest height ever seen (= no
  // keyboard). kbOpen toggles the navbar and the container height formula;
  // vpH feeds the keyboard-open height (see containerStyle below).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const h = vv.height;
      if (h > maxVpHeight.current) maxVpHeight.current = h;
      const kb = Math.max(0, maxVpHeight.current - h);
      setKbOpen(kb > 80);
      setVpH(prev => Math.abs(prev - h) < 1 ? prev : h);
    };
    const onResize = () => { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener("resize", onResize);
    apply();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    // iOS scrolls the layout viewport when keyboard opens/closes.
    // Reset immediately so fixed elements don't appear shifted.
    window.scrollTo(0, 0);
    scrollToBottom();
    // Keyboard open/close animation takes ~300ms; RAF alone fires too early.
    const t = setTimeout(() => scrollToBottom(), 300);
    return () => clearTimeout(t);
  }, [kbOpen, scrollToBottom]);

  // Hide the app navbar while the keyboard is open so it sits behind the keyboard
  // and only the input shows above it. CSS rule lives in globals.css.
  useEffect(() => {
    document.body.classList.toggle("neo-keyboard-open", kbOpen);
    return () => { document.body.classList.remove("neo-keyboard-open"); };
  }, [kbOpen]);

  // Tell the navbar a conversation is active (via body class) so it can animate
  // its Neo avatar while chatting. CSS rule lives in globals.css.
  useEffect(() => {
    document.body.classList.toggle("neo-chatting", isActive);
    return () => { document.body.classList.remove("neo-chatting"); };
  }, [isActive]);


  // Measure the actual rendered container height while the keyboard is closed.
  // noKbH is the hard ceiling for the keyboard-open height (see containerStyle):
  // it guarantees the container can never grow when the keyboard opens, even at
  // the instant the navbar's 84px is reclaimed before the keyboard finishes
  // sliding up. Measuring from the DOM also captures safe-area-inset-bottom exactly.
  useEffect(() => {
    if (!mounted || kbOpen) return;
    if (containerRef.current) {
      const h = containerRef.current.offsetHeight;
      if (h > 0) setNoKbH(h);
    }
  }, [kbOpen, mounted]);

  // When the chat is active, iOS Safari may scroll the layout viewport when
  // the input is focused (to bring it into view). Intercept every scroll event
  // and reset immediately so fixed elements don't appear shifted.
  useEffect(() => {
    if (!isActive || !mounted) return;
    const reset = () => { if (window.scrollY !== 0) window.scrollTo(0, 0); };
    window.addEventListener("scroll", reset);
    reset(); // reset on activation
    return () => window.removeEventListener("scroll", reset);
  }, [isActive, mounted]);

  // Prevent touchmove on the NeoChat container so iOS can't scroll the page,
  // but allow it inside the message list (listRef).
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [mounted]);

  // ── Send ─────────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: uid(), role: "user", text: text.trim(), ts: new Date() }]);
    setInput("");
    setIsActive(true);
    setThinking(true);

    const body: Record<string, unknown> = { message: text.trim() };
    if (pendingCtxRef.current) body.pendingContext = pendingCtxRef.current;
    setQuickReplies(null);

    try {
      const res = await fetch("/api/neo/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = res.ok ? await res.json() : { text: "No pude procesar tu mensaje. Intentá de nuevo." };

      // Slot-filling continuation: store whatever pending context the server returns.
      pendingCtxRef.current = data.pending ?? null;
      setQuickReplies(Array.isArray(data.options) ? data.options : null);
      if (data.action?.type === "cancel_pending") { pendingCtxRef.current = null; setQuickReplies(null); }

      const actionTypes = ["confirm_delete", "confirm_delete_goal", "confirm_cancel_installment", "installment_form"];
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

  // Safety net: if visualViewport resize doesn't fire when keyboard closes,
  // remove the navbar-hide class after the input loses focus.
  const handleInputBlur = () => {
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setKbOpen(false);
        document.body.classList.remove("neo-keyboard-open");
      }
    }, 150);
  };

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

  async function createInstallment(msgId: string, data: { name: string; nInstallments: number; installmentAmount: number; firstPaymentDate: string }) {
    setBusyPending(msgId);
    const res = await fetch("/api/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        total_amount: data.nInstallments * data.installmentAmount,
        currency_code: "ARS",
        n_installments: data.nInstallments,
        installment_amount: data.installmentAmount,
        interest_type: "none",
        first_payment_date: data.firstPaymentDate,
      }),
    }).catch(() => null);
    if (res?.ok) {
      window.dispatchEvent(new Event("transaction-added"));
      const totalFmt = (data.nInstallments * data.installmentAmount).toLocaleString("es-AR", { maximumFractionDigits: 0 });
      const eachFmt = data.installmentAmount.toLocaleString("es-AR", { maximumFractionDigits: 0 });
      setMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, action: { ...m.action!, resolved: true } } : m)
          .concat({ id: uid(), role: "neo", text: `✅ Creé la cuota "${data.name}": ${data.nInstallments} cuotas de ARS ${eachFmt}.\nTotal: ARS ${totalFmt}.`, ts: new Date() })
      );
    } else {
      setMessages(prev => [...prev, { id: uid(), role: "neo", text: "No pude crear la cuota. Intentá desde la sección Cuotas.", ts: new Date() }]);
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

  // Container sizing:
  // - No keyboard: CSS calc(100svh - 84px - safe-area-bottom). svh is stable (URL bar retraction
  //   does not change it). Reserves space for the navbar at the bottom.
  // - Keyboard open: Math.min(noKbH, vpH).
  //     noKbH = the actual rendered no-keyboard container height (measured from the DOM).
  //       It's the hard ceiling: the container can NEVER be taller than it was without a keyboard,
  //       so reclaiming the navbar's 84px the instant the keyboard starts opening can't grow it.
  //     vpH = visualViewport.height = the real visible area above the keyboard, shrinks as the
  //       keyboard slides up. Once vpH drops below noKbH, the container follows it down.
  //     min() => the height can only DECREASE from the moment the keyboard opens. No growth.
  const vpFallback = vpH || maxVpHeight.current || (typeof window !== "undefined" ? window.innerHeight : 812);
  const containerStyle: React.CSSProperties = kbOpen
    ? { top: 0, height: `${Math.max(100, Math.min(noKbH || vpFallback, vpFallback))}px` }
    : { top: 0, height: "calc(100svh - 84px - env(safe-area-inset-bottom, 0px))" };

  // Shared input bar (used by idle + active). No microphone — text only.
  const inputBar = (
    <div style={{
      flexShrink: 0,
      padding: "8px 16px 12px",
      background: "var(--base)",
      display: "flex", flexDirection: "column", gap: 4,
      width: "100%", maxWidth: 760, margin: "0 auto",
    }}>
      {quickReplies && quickReplies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 2 }}>
          {quickReplies.map(q => (
            <button key={q} type="button" onClick={() => sendMessage(q)}
              style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500, background: "var(--accent-soft)", color: "var(--accent)", border: "0.5px solid var(--glass-border)" }}>
              {q}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: "var(--raised)", borderRadius: 24, padding: "4px 14px 4px 16px", border: "0.5px solid var(--glass-border)", minHeight: 44 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => window.scrollTo(0, 0)}
            onBlur={handleInputBlur}
            placeholder="Escribir mensaje a Neo…"
            // fontSize must be >= 16px: iOS Safari auto-zooms the page when focusing
            // an input smaller than 16px, which makes everything look bigger and shifted.
            style={{ flex: 1, fontSize: 16, background: "transparent", border: "none", outline: "none", color: "var(--ink)", padding: "6px 0" }}
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
    <div ref={containerRef} className="neo-chat-root" style={{
      position: "fixed",
      left: 0, right: 0,
      ...containerStyle,
      zIndex: 20,
      display: "flex", flexDirection: "column",
      background: "var(--void)",
    }}>

      {/* ── IDLE state — landing sin franja, avatar centrado moviéndose ── */}
      {!isActive && (
        <>
          {/* Welcome body — scrollable, no top strip */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
            background: "var(--void)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 18, padding: "calc(40px + env(safe-area-inset-top, 0px)) 20px 28px",
          } as React.CSSProperties}>
            {/* Avatar — living iridescent orb (floats + breathes + morphs) */}
            <div className="float-bob enter-up" style={{ position: "relative" }}>
              <NeoOrb size={104} alive />
            </div>

            <div className="enter-up" data-delay="1" style={{ textAlign: "center", maxWidth: 320 }}>
              <p style={{ fontSize: 23, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Hola, soy Neo</p>
              <p style={{ fontSize: 14.5, color: "var(--ink-muted)", marginTop: 6, lineHeight: 1.5 }}>
                Tu asistente personal de finanzas
              </p>
            </div>

            {!hasPhone && (
              <a href="/perfil" className="press enter-up" data-delay="2" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 18px", borderRadius: 999, fontSize: 13.5, fontWeight: 700, background: "var(--accent)", color: "#04130D", textDecoration: "none", boxShadow: "0 4px 18px var(--shadow-accent)" }}>
                Conectar WhatsApp →
              </a>
            )}

            <div style={{ width: "100%", maxWidth: 420, marginTop: 2 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} onClick={() => sendMessage(s)} className="glass press enter-up"
                    data-delay={Math.min(6, i + 3)}
                    style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", borderRadius: 16, fontSize: 14.5, fontWeight: 500, color: "var(--ink)", textAlign: "left", cursor: "pointer" }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent)", flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{s}</span>
                    <span aria-hidden style={{ color: "var(--ink-dim)", fontSize: 16 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {inputBar}
        </>
      )}

      {/* ── ACTIVE state ── */}
      {isActive && (
        <>
          {/* WhatsApp-style header strip */}
          <div className="glass" style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 10,
            padding: "calc(10px + env(safe-area-inset-top, 0px)) 16px 10px 8px",
            borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none",
          }}>
            <button
              onClick={() => setIsActive(false)}
              aria-label="Volver"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className={thinking ? "neo-avatar-thinking" : "neo-avatar-active"} style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 18px var(--accent-glow)", flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>Neo</p>
              <p style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {thinking ? "escribiendo…" : "asistente personal de finanzas"}
              </p>
            </div>
          </div>

          {/* Message list — the only scrollable area */}
          <div ref={listRef} className="neo-chat-list" style={{
            flex: 1, minHeight: 0, width: "100%",
            overflowY: "auto", WebkitOverflowScrolling: "touch",
            background: "var(--base)",
            padding: "8px 16px 12px",
            display: "flex", flexDirection: "column", gap: 2,
          } as React.CSSProperties}>
            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const showDate = !prevMsg || msg.ts.toDateString() !== prevMsg.ts.toDateString();
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                      <span style={{ fontSize: 13, color: "var(--ink-muted)", background: "var(--raised)", padding: "3px 10px", borderRadius: 8, border: "0.5px solid var(--glass-border)" }}>
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
                    onCreateInstallment={createInstallment}
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
  onConfirmPending, onDismissPending, onDelete, onDeleteGoal, onCancelInstallment, onCreateInstallment, onDismissAction,
}: {
  msg: ChatMessage;
  busyPending: string | null;
  onConfirmPending: (p: PendingTransaction) => void;
  onDismissPending: (p: PendingTransaction) => void;
  onDelete: (msgId: string, txId: string, txDesc: string) => void;
  onDeleteGoal: (msgId: string, goalId: string, goalName: string) => void;
  onCancelInstallment: (msgId: string, planId: string, planName: string) => void;
  onCreateInstallment: (msgId: string, data: { name: string; nInstallments: number; installmentAmount: number; firstPaymentDate: string }) => void;
  onDismissAction: (msgId: string) => void;
}) {
  const isUser = msg.role === "user";

  // WhatsApp bubble shapes
  const bubbleBg = isUser ? "var(--accent)" : "var(--raised)";
  const bubbleRadius = isUser ? "18px 2px 18px 18px" : "2px 18px 18px 18px";
  const textColor = isUser ? "#04130D" : "var(--ink)";
  const timeColor = isUser ? "rgba(4,19,13,0.55)" : "var(--ink-dim)";

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
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)", marginBottom: 3 }}>Neo</p>
        )}

        {/* Text */}
        <p style={{ fontSize: 14.5, color: textColor, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.text}
        </p>

        {/* Timestamp — inline at bottom right like WhatsApp */}
        <p style={{ fontSize: 12.5, color: timeColor, textAlign: "right", marginTop: 2, lineHeight: 1 }}>
          {fmtTime(msg.ts)}
        </p>

        {/* Pending transaction actions */}
        {msg.isPending && msg.pendingData && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => onConfirmPending(msg.pendingData!)} disabled={busyPending === msg.pendingData.id}
              style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#04130D", opacity: busyPending === msg.pendingData.id ? 0.5 : 1, border: "none" }}>
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
                  <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 1 }}>{fmt(c.amount, c.currency_code)} · {fmtDate(c.date)}</p>
                </div>
                <button onClick={() => onDelete(msg.id, c.id, c.description)} disabled={busyPending === c.id}
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(255,59,48,0.10)", color: "var(--negative)", border: "0.5px solid rgba(255,59,48,0.22)", flexShrink: 0 }}>
                  {busyPending === c.id ? "..." : "Eliminar"}
                </button>
              </div>
            ))}
            <button onClick={() => onDismissAction(msg.id)}
              style={{ padding: "7px", borderRadius: 10, fontSize: 13, color: "var(--ink-dim)", background: "transparent", border: "none" }}>
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

        {/* Installment form card */}
        {msg.action?.type === "installment_form" && !msg.action.resolved && (
          <InstallmentFormCard
            prefill={(msg.action as Extract<ChatAction, { type: "installment_form" }>).prefill}
            busy={!!busyPending}
            onSubmit={(data) => onCreateInstallment(msg.id, data)}
            onDismiss={() => onDismissAction(msg.id)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Installment form ─────────────────────────────────────────────────────────

function InstallmentFormCard({ prefill, busy, onSubmit, onDismiss }: {
  prefill?: { name?: string; nInstallments?: number; installmentAmount?: number };
  busy: boolean;
  onSubmit: (data: { name: string; nInstallments: number; installmentAmount: number; firstPaymentDate: string }) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(prefill?.name ?? "");
  const [n, setN] = useState(prefill?.nInstallments ? String(prefill.nInstallments) : "");
  const [amount, setAmount] = useState(prefill?.installmentAmount ? String(prefill.installmentAmount) : "");

  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const [date, setDate] = useState(nextMonth.toISOString().split("T")[0]);

  const nInt = parseInt(n);
  const amt = parseFloat(amount.replace(/\./g, "").replace(",", "."));
  const canSubmit = name.trim().length > 0 && !isNaN(nInt) && nInt > 0 && !isNaN(amt) && amt > 0;
  const total = canSubmit ? (nInt * amt).toLocaleString("es-AR", { maximumFractionDigits: 0 }) : null;

  const inp: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 10, fontSize: 16, // >=16px avoids iOS focus auto-zoom
    background: "var(--base)", border: "0.5px solid var(--glass-border)",
    color: "var(--ink)", outline: "none", width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre (ej: iPhone)" style={inp} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={n} onChange={e => setN(e.target.value)} placeholder="Cuotas" type="number" inputMode="numeric" min="1" style={{ ...inp, flex: "0 0 80px" }} />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto c/u" type="number" inputMode="decimal" style={{ ...inp, flex: 1 }} />
      </div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
      {total && (
        <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "right" }}>Total: ARS {total}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button onClick={onDismiss} style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "transparent", border: "0.5px solid var(--glass-border)", color: "var(--ink-muted)" }}>
          Cancelar
        </button>
        <button onClick={() => canSubmit && onSubmit({ name: name.trim(), nInstallments: nInt, installmentAmount: amt, firstPaymentDate: date })}
          disabled={!canSubmit || busy}
          style={{ flex: 2, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: canSubmit && !busy ? "var(--accent)" : "var(--raised)", color: canSubmit && !busy ? "#04130D" : "var(--ink-muted)", border: "none", transition: "background 140ms" }}>
          {busy ? "Creando..." : "Crear cuota"}
        </button>
      </div>
    </div>
  );
}
