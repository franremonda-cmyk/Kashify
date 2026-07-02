import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

type GRow = { keyword: string; category_name: string; type: string; taught_by: number; updated_at: string };
type CRow = { pattern: string; corrected_count: number; updated_at: string; categories: { name: string } | { name: string }[] | null };

// Cron semanal: le manda a Fran (OPERATOR_EMAIL) el resumen de lo que Neo
// aprendió/corrigió (todos los usuarios). Solo a él. Best-effort si falta 011.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const to = process.env.OPERATOR_EMAIL;
  if (!to) return NextResponse.json({ error: "OPERATOR_EMAIL no configurado" }, { status: 400 });

  const supabase = await createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const g = await supabase.from("neo_global_rules")
    .select("keyword, category_name, type, taught_by, updated_at")
    .order("taught_by", { ascending: false }).limit(50);
  const globalRules = (g.data ?? []) as GRow[];

  const n = await supabase.from("parser_rules")
    .select("id", { count: "exact", head: true }).gte("created_at", weekAgo);
  const newRules = n.count ?? 0;

  const c = await supabase.from("parser_rules")
    .select("pattern, corrected_count, updated_at, categories(name)")
    .gt("corrected_count", 0).gte("updated_at", weekAgo).limit(50);
  const corrections = (c.data ?? []) as CRow[];

  const recentGlobal = globalRules.filter((r) => r.updated_at >= weekAgo);
  const catName = (c: CRow) => (Array.isArray(c.categories) ? c.categories[0] : c.categories)?.name ?? "—";

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; color: #14211a; line-height: 1.5;">
      <h2 style="margin-bottom: 4px;">Neo · resumen semanal 🧠</h2>
      <p style="color:#666; margin-top: 0;">Lo que Neo aprendió y corrigió esta semana (todos los usuarios).</p>

      <h3>📚 Promovidas a la biblioteca global (${recentGlobal.length})</h3>
      ${recentGlobal.length
        ? `<ul>${recentGlobal.map((r) => `<li><b>${r.keyword}</b> → ${r.category_name} <span style="color:#999">(${r.taught_by} usuarios · ${r.type})</span></li>`).join("")}</ul>`
        : `<p style="color:#999">Ninguna nueva esta semana.</p>`}

      <h3>✏️ Correcciones de usuarios (${corrections.length})</h3>
      ${corrections.length
        ? `<ul>${corrections.slice(0, 30).map((c) => `<li><b>${c.pattern.split("|")[0]}</b> → ${catName(c)} <span style="color:#999">(×${c.corrected_count})</span></li>`).join("")}</ul>`
        : `<p style="color:#999">Sin correcciones esta semana.</p>`}

      <h3>📊 Números</h3>
      <ul>
        <li>Reglas personales nuevas esta semana: <b>${newRules}</b></li>
        <li>Total reglas en la biblioteca global: <b>${globalRules.length}</b></li>
      </ul>

      <h3>🏆 Top biblioteca global</h3>
      <ul>${globalRules.slice(0, 10).map((r) => `<li>${r.keyword} → ${r.category_name} <span style="color:#999">(${r.taught_by})</span></li>`).join("") || "<li style='color:#999'>vacía</li>"}</ul>

      <p style="color:#999; font-size: 13px;">¿Una regla global rara? Borrala en Supabase → tabla <code>neo_global_rules</code>. Neo la re-aprende sola si vuelve a haber consenso.</p>
    </div>`;

  const sent = await sendEmail({ to, subject: "Neo · resumen semanal", html });
  return NextResponse.json({ sent, recentGlobal: recentGlobal.length, corrections: corrections.length, newRules, totalGlobal: globalRules.length });
}
