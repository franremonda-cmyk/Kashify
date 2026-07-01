import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardShell from "@/components/DashboardShell";
import DashboardClient from "./DashboardClient";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import { computeBalances } from "@/lib/ledger/balances";
import { scopeForSpace, SPACE_COOKIE } from "@/lib/space-scope";
import type { ChartMonth } from "@/components/SpendingChart";
import type { Space } from "@/types";

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const yearAgo    = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];

  // Espacio activo (cookie sincronizada por SpaceContext). "total" = agregado de
  // los espacios con include_in_total; un uuid = solo ese espacio.
  const activeSpace = (await cookies()).get(SPACE_COOKIE)?.value ?? "total";
  const { data: spacesData } = await supabase.from("spaces").select("*").eq("user_id", user.id).order("sort_order").order("created_at");
  const spaces = (spacesData as Space[] | null) ?? [];
  const scopeIds = scopeForSpace(spaces, activeSpace);

  const [profileRes, pendingRes, txMonthRes, txHistoryRes, txAllRes, goalsRes, budgetsRes, installmentsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("pending_transactions").select("*").eq("user_id", user.id).eq("status", "waiting")
      .gt("expires_at", new Date().toISOString()),
    supabase.from("transactions")
      .select("id, category_id, amount, currency_code, type, description, date, space_id, categories(name, icon, color)")
      .eq("user_id", user.id).is("deleted_at", null).in("space_id", scopeIds)
      .gte("date", monthStart)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("transactions")
      .select("amount, currency_code, type, date")
      .eq("user_id", user.id).is("deleted_at", null).in("space_id", scopeIds)
      .gte("date", yearAgo)
      .order("date", { ascending: true }),
    // Balance: todos los movimientos no borrados del scope (incluye conversiones).
    // ponytail: scan O(n) sobre las tx del usuario; si alguien acumula decenas de
    // miles, reintroducir un cache de balance por espacio.
    supabase.from("transactions")
      .select("amount, currency_code, type, to_currency_code, to_amount, space_id")
      .eq("user_id", user.id).is("deleted_at", null).in("space_id", scopeIds),
    supabase.from("savings_goals").select("*").eq("user_id", user.id).in("space_id", scopeIds).neq("status", "archived").order("created_at", { ascending: false }).limit(3),
    supabase.from("category_budgets").select("*, categories(id, name, color, icon)").eq("user_id", user.id).in("space_id", scopeIds),
    supabase.from("installment_plans").select("id, name, currency_code, n_installments, installment_amount, status, installment_payments(status), categories(name, color, icon)").eq("user_id", user.id).in("space_id", scopeIds).eq("status", "active").order("created_at", { ascending: false }),
  ]);

  const balances   = computeBalances(txAllRes.data ?? []);
  const profile    = profileRes.data;
  const pending    = pendingRes.data ?? [];
  const txAll      = txMonthRes.data ?? [];
  const txHistory  = txHistoryRes.data ?? [];
  const goals      = goalsRes.data ?? [];
  const budgetsRaw = budgetsRes.data ?? [];
  // Cuotas activas (las que aún tienen pagos pendientes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const installments = (installmentsRes.data as any[] ?? [])
    .map((p) => {
      const paid = Array.isArray(p.installment_payments)
        ? p.installment_payments.filter((x: { status?: string }) => x.status === "paid").length
        : 0;
      return {
        id: p.id,
        name: p.name,
        currency_code: p.currency_code,
        n_installments: p.n_installments,
        installment_amount: Number(p.installment_amount),
        paid,
        color: p.categories?.color,
        icon: p.categories?.icon,
      };
    })
    .filter((p) => p.paid < p.n_installments)
    .slice(0, 2);

  if (!profile?.display_name) redirect("/onboarding");

  const primaryCurrency = profile?.primary_currency ?? "ARS";
  const sortedBalances  = [
    ...balances.filter((b) => b.currency_code === primaryCurrency),
    ...balances.filter((b) => b.currency_code !== primaryCurrency),
  ];

  const allCurrencies = [...new Set([
    ...txAll.map((t) => t.currency_code),
    ...balances.map((b) => b.currency_code),
  ])];

  const metrics = allCurrencies.map((currency) => ({
    currency_code: currency,
    income:  txAll.filter((t) => t.type === "income" && t.currency_code === currency)
                  .reduce((s, t) => s + Number(t.amount), 0),
    expense: txAll.filter((t) => ["expense","installment-payment"].includes(t.type) && t.currency_code === currency)
                  .reduce((s, t) => s + Number(t.amount), 0),
  }));

  const chartData: Record<string, ChartMonth[]> = {};
  for (const currency of allCurrencies) {
    const months: ChartMonth[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), mo = d.getMonth();
      const monthTxs = txHistory.filter((t) => {
        const td = new Date(t.date);
        return t.currency_code === currency && td.getFullYear() === y && td.getMonth() === mo;
      });
      months.push({
        label: MONTH_LABELS[mo],
        income:  monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
        expense: monthTxs.filter((t) => ["expense","installment-payment"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    chartData[currency] = months;
  }

  // Budget strip: join budgets with this-month spending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spentByCategory: Record<string, number> = {};
  for (const t of txAll) {
    if ((t.type === "expense" || t.type === "installment-payment") && t.category_id) {
      spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + Number(t.amount);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgets = (budgetsRaw as any[]).map((b) => ({
    id: b.id,
    category_id: b.category_id,
    name: b.categories?.name ?? "Sin nombre",
    color: b.categories?.color,
    icon: b.categories?.icon,
    monthly_limit: b.monthly_limit,
    currency_code: b.currency_code,
    spent: spentByCategory[b.category_id] ?? 0,
    period_type: b.period_type,
    applies_months: b.applies_months,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent = (txAll as any[]).slice(0, 5).map((t) => ({
    id:           t.id,
    description:  t.description,
    amount:       t.amount,
    currency_code: t.currency_code,
    type:         t.type,
    date:         t.date,
    categories:   t.categories ?? null,
  }));

  // Vista "Total": tarjetas por espacio (solo los incluidos; los aislados se ven
  // al seleccionarlos en el switcher). Cada card en su propia moneda (sin FX).
  const includedSpaces = spaces.filter((s) => s.include_in_total);
  const spacesOverview = activeSpace === "total" && includedSpaces.length > 1
    ? includedSpaces.map((sp) => {
        const spBalances = computeBalances((txAllRes.data ?? []).filter((t) => t.space_id === sp.id));
        const pick = spBalances.find((b) => b.currency_code === sp.primary_currency)
          ?? [...spBalances].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
        const cur = pick?.currency_code ?? sp.primary_currency;
        const spMonth = (txMonthRes.data ?? []).filter((t) => t.space_id === sp.id && t.currency_code === cur);
        return {
          id: sp.id, name: sp.name, icon: sp.icon, color: sp.color, currency: cur,
          balance: pick?.amount ?? 0,
          income:  spMonth.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
          expense: spMonth.filter((t) => ["expense", "installment-payment"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0),
        };
      })
    : [];

  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between enter-up">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--ink-muted)", textTransform: "capitalize" }}>
            {now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            Hola{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div
          className="rounded-full flex items-center justify-center font-bold"
          style={{ width: 44, height: 44, fontSize: 17, background: "var(--accent)", color: "#04130D", boxShadow: "0 2px 10px var(--shadow-accent)" }}
          role="img"
          aria-label={firstName ? `Tu perfil, ${firstName}` : "Tu perfil"}
        >
          {(firstName?.[0] ?? "K").toUpperCase()}
        </div>
      </div>

      {/* Selector de espacio (se autoesconde si hay uno solo) */}
      <SpaceSwitcher />

      {/* Pending Neo confirmations */}
      <DashboardClient pending={pending} userId={user.id} />

      {/* Shell: balance → metrics → recent → chart (all currency-synced) */}
      <DashboardShell
        balances={sortedBalances}
        primaryCurrency={primaryCurrency}
        spacesOverview={spacesOverview}
        metrics={metrics}
        chartData={chartData}
        recent={recent}
        goals={goals}
        budgets={budgets}
        installments={installments}
      />

      {/* Empty state */}
      {recent.length === 0 && balances.length === 0 && (
        <div className="glass p-8 text-center flex flex-col gap-3 enter-up" data-delay="3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--accent-soft)", border: "0.5px solid var(--glass-border-hover)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--accent)" }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium" style={{ color: "var(--ink)" }}>Neo te espera</p>
            <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
              Escribile a Neo por WhatsApp o usá el <span style={{ color: "var(--accent)" }}>+</span> para empezar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
