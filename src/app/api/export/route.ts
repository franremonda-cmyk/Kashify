import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  let query = supabase
    .from("transactions")
    .select("*, categories(name)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (category) query = query.eq("category_id", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data?.length) {
    return NextResponse.json({ error: "Sin resultados para exportar" }, { status: 404 });
  }

  if (format === "xlsx") {
    return exportXLSX(data);
  }
  return exportCSV(data);
}

function exportCSV(rows: Record<string, unknown>[]): Response {
  const headers = ["Fecha", "Descripción", "Monto", "Moneda", "Tipo", "Categoría", "Tarjeta", "Notas"];
  const typeLabels: Record<string, string> = {
    expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => [
      r.date,
      `"${String(r.description ?? "").replace(/"/g, '""')}"`,
      r.amount,
      r.currency_code,
      typeLabels[r.type as string] ?? r.type,
      `"${(r.categories as { name: string } | null)?.name ?? ""}"`,
      `"${String(r.card_name ?? "").replace(/"/g, '""')}"`,
      `"${String(r.notes ?? "").replace(/"/g, '""')}"`,
    ].join(",")),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="neo-transacciones.csv"`,
    },
  });
}

async function exportXLSX(rows: Record<string, unknown>[]): Promise<Response> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Transacciones");

  ws.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Descripción", key: "description", width: 30 },
    { header: "Monto", key: "amount", width: 14 },
    { header: "Moneda", key: "currency_code", width: 8 },
    { header: "Tipo", key: "type", width: 14 },
    { header: "Categoría", key: "category", width: 16 },
    { header: "Tarjeta", key: "card_name", width: 16 },
    { header: "Notas", key: "notes", width: 24 },
  ];

  const typeLabels: Record<string, string> = {
    expense: "Gasto", income: "Ingreso", conversion: "Conversión", "installment-payment": "Cuota",
  };

  rows.forEach((r) => {
    ws.addRow({
      date: r.date,
      description: r.description,
      amount: r.amount,
      currency_code: r.currency_code,
      type: typeLabels[r.type as string] ?? r.type,
      category: (r.categories as { name: string } | null)?.name ?? "",
      card_name: r.card_name ?? "",
      notes: r.notes ?? "",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="neo-transacciones.xlsx"`,
    },
  });
}
