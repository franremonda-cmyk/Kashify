"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP", "PYG", "BOB", "COP", "PEN"];

interface Category { id: string; name: string; icon: string; }

function QuickAddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    type: "expense" as "expense" | "income",
    description: "",
    amount: "",
    currency_code: "ARS",
    category_id: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.category_id) {
      setError("Completá todos los campos");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) { onSaved(); onClose(); }
    else { setError("Error al guardar"); setSaving(false); }
  }

  const inp: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid var(--glass-border)",
    borderRadius: 12,
    padding: "11px 14px",
    color: "var(--ink)",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 scale-up"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong w-full max-w-sm p-5 flex flex-col gap-4 mb-2">
        <div className="flex items-center justify-between">
          <h2 className="display font-semibold text-base" style={{ color: "var(--ink)" }}>
            Registrar
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
            style={{ background: "var(--glass-1)", color: "var(--ink-muted)" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: form.type === t
                    ? t === "expense" ? "rgba(255,83,112,0.20)" : "rgba(105,255,218,0.15)"
                    : "transparent",
                  color: form.type === t
                    ? t === "expense" ? "var(--negative)" : "var(--positive)"
                    : "var(--ink-muted)",
                  transition: "all 160ms ease-out",
                }}
              >
                {t === "expense" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>

          <input style={inp} placeholder="Descripción" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          <div className="flex gap-2">
            <input style={{ ...inp, width: "58%" }} placeholder="0.00" type="number"
              step="0.01" min="0" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            <select style={{ ...inp, width: "42%" }} value={form.currency_code}
              onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <select style={inp} value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
            <option value="">Categoría...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>

          <input style={inp} type="date" value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />

          {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#060C09" }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const LEFT_NAV = [
  { href: "/dashboard",  label: "Inicio",    icon: HomeIcon },
  { href: "/historial",  label: "Historial", icon: ListIcon },
];
const RIGHT_NAV = [
  { href: "/cuotas", label: "Cuotas",  icon: CuotasIcon },
  { href: "/perfil", label: "Perfil",  icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      {showAdd && (
        <QuickAddModal
          onClose={() => setShowAdd(false)}
          onSaved={() => setShowAdd(false)}
        />
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: "rgba(6, 12, 9, 0.85)",
          backdropFilter: "blur(24px) saturate(180%)",
          borderTop: "0.5px solid var(--glass-border)",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        <div className="flex items-center justify-around max-w-lg mx-auto px-2 h-[60px]">
          {LEFT_NAV.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label}
              Icon={item.icon} active={pathname === item.href} />
          ))}

          {/* FAB central */}
          <button
            onClick={() => setShowAdd(true)}
            className="relative -top-5 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light"
            style={{
              background: "var(--accent)",
              color: "#060C09",
              boxShadow: "0 0 0 4px #060C09, 0 8px 24px var(--accent-glow), var(--shadow-lg)",
            }}
            aria-label="Registrar transacción"
          >
            +
          </button>

          {RIGHT_NAV.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label}
              Icon={item.icon} active={pathname === item.href} />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavItem({ href, label, Icon, active }: {
  href: string; label: string;
  Icon: (p: { active: boolean }) => React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 min-w-[48px] min-h-[48px] justify-center"
      style={{ color: active ? "var(--accent)" : "var(--ink-dim)", textDecoration: "none" }}
    >
      <Icon active={active} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <line x1="8" y1="6"  x2="21" y2="6"  />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6"  x2="3.01" y2="6"  />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function CuotasIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h2" />
      <path d="M11 15h2" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
