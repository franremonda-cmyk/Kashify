import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardShell from "@/components/DashboardShell";
import DashboardClient from "./DashboardClient";
import NeoImg from "@/components/NeoImg";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import SpacesHintCard from "@/components/SpacesHintCard";
import { computeBalances } from "@/lib/ledger/balances";
import { detectRecurring, type RecTx } from "@/lib/recurring";
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
      .select("amount, currency_code, type, date, space_id, description")
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
    supabase.from("installment_plans").select("id, name, currency_code, n_installments, installment_amount, status, installment_payments(status, due_date, amount), categories(name, color, icon)").eq("user_id", user.id).in("space_id", scopeIds).eq("status", "active").order("created_at", { ascending: false }),
  ]);

  const balances   = computeBalances(txAllRes.data ?? []);
  const profile    = profileRes.data;
  const pending    = pendingRes.data ?? [];
  const txAll      = txMonthRes.data ?? [];
  const txHistory  = txHistoryRes.data ?? [];
  const goals      = goalsRes.data ?? [];
  const budgetsRaw = budgetsRes.data ?? [];

  // Próximos pagos: cuotas pendientes que vencen este mes, por moneda.
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
  const upcomingMap: Record<string, { total: number; count: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (installmentsRes.data as any[] ?? [])) {
    const pays = Array.isArray(p.installment_payments) ? p.installment_payments : [];
    for (const pay of pays) {
      if (pay.status === "pending" && pay.due_date >= monthStart && pay.due_date < nextMonthStart) {
        const cur = p.currency_code;
        if (!upcomingMap[cur]) upcomingMap[cur] = { total: 0, count: 0 };
        upcomingMap[cur].total += Number(pay.amount ?? p.installment_amount ?? 0);
        upcomingMap[cur].count += 1;
      }
    }
  }
  const upcoming = Object.entries(upcomingMap).map(([currency_code, v]) => ({ currency_code, ...v }));

  // Gastos recurrentes / suscripciones: detectados de los últimos 4 meses del histórico.
  const recurringStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0];
  const recurring = detectRecurring((txHistoryRes.data ?? []).filter((t) => t.date >= recurringStart) as unknown as RecTx[]);

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

  // Mes anterior (para deltas): rango [prevMonthStart, monthStart) sobre el histórico.
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const isExp = (t: { type: string }) => t.type === "expense" || t.type === "installment-payment";
  const metrics = allCurrencies.map((currency) => {
    const prevTx = txHistory.filter((t) => t.currency_code === currency && t.date >= prevMonthStart && t.date < monthStart);
    return {
      currency_code: currency,
      income:  txAll.filter((t) => t.type === "income" && t.currency_code === currency).reduce((s, t) => s + Number(t.amount), 0),
      expense: txAll.filter((t) => isExp(t) && t.currency_code === currency).reduce((s, t) => s + Number(t.amount), 0),
      prevIncome:  prevTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
      prevExpense: prevTx.filter(isExp).reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  // Para el ritmo/proyección de gasto (pace lineal sobre el mes).
  const dayOfMonth  = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

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
        return {
          id: sp.id, name: sp.name, icon: sp.icon, color: sp.color,
          currency: pick?.currency_code ?? sp.primary_currency,
          balance: pick?.amount ?? 0,
        };
      })
    : [];

  // Series de gasto mensual por espacio (para el modo "Por espacio" del gráfico).
  // Por moneda → por espacio → 12 valores mensuales (alineados con chartData).
  // Solo en Total con >1 espacio incluido; se omiten espacios sin gasto en la moneda.
  const spaceStacksData: Record<string, { id: string; name: string; color: string; expense: number[] }[]> = {};
  if (activeSpace === "total" && includedSpaces.length > 1) {
    for (const currency of allCurrencies) {
      const series = includedSpaces.map((sp) => {
        const expense: number[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const y = d.getFullYear(), mo = d.getMonth();
          const sum = (txHistoryRes.data ?? [])
            .filter((t) => t.space_id === sp.id && t.currency_code === currency
              && (t.type === "expense" || t.type === "installment-payment")
              && new Date(t.date).getFullYear() === y && new Date(t.date).getMonth() === mo)
            .reduce((s, t) => s + Number(t.amount), 0);
          expense.push(sum);
        }
        return { id: sp.id, name: sp.name, color: sp.color, expense };
      });
      const withData = series.filter((s) => s.expense.some((v) => v > 0));
      if (withData.length > 1) spaceStacksData[currency] = withData;
    }
  }

  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-5 dash-page">
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
          className="rounded-full flex items-center justify-center"
          style={{ width: 52, height: 52, background: "var(--accent-soft)", border: "1px solid var(--accent-glow)", overflow: "hidden" }}
          role="img"
          aria-label={firstName ? `Neo te saluda, ${firstName}` : "Neo te saluda"}
        >
          <NeoImg
            mood="happy"
            size={44}
            fallback={
              <span className="font-bold" style={{ fontSize: 17, color: "var(--accent)" }}>
                {(firstName?.[0] ?? "K").toUpperCase()}
              </span>
            }
          />
        </div>
      </div>

      {/* Selector de espacio (se autoesconde si hay uno solo) */}
      <SpaceSwitcher />

      {/* Aviso de descubrimiento de espacios (solo con 1 espacio, descartable) */}
      <SpacesHintCard />

      {/* Pending Neo confirmations */}
      <DashboardClient pending={pending} userId={user.id} />

      {/* Shell: balance → metrics → recent → chart (all currency-synced) */}
      <DashboardShell
        balances={sortedBalances}
        primaryCurrency={primaryCurrency}
        usdRate={profile?.usd_rate ? Number(profile.usd_rate) : null}
        spacesOverview={spacesOverview}
        metrics={metrics}
        dayOfMonth={dayOfMonth}
        daysInMonth={daysInMonth}
        upcoming={upcoming}
        recurring={recurring}
        chartData={chartData}
        spaceStacksData={spaceStacksData}
        recent={recent}
        goals={goals}
        budgets={budgets}
      />
    </div>
  );
}
