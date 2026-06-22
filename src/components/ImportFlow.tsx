"use client";
import { useState, useRef, useCallback } from "react";
import { parseFile, autoDetectMapping, mapRows } from "@/lib/importParser";
import type { RawRow, ColumnMapping, ParsedTransaction } from "@/lib/importParser";

const KASHIFY_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean; desc: string }[] = [
  { key: "date",        label: "Fecha",        required: true,  desc: "Cuándo ocurrió" },
  { key: "description", label: "Descripción",  required: true,  desc: "Qué fue" },
  { key: "amount",      label: "Monto",        desc: "Importe (puede ser negativo)" },
  { key: "debit",       label: "Débito",       desc: "Columna de egresos (alternativa a Monto)" },
  { key: "credit",      label: "Crédito",      desc: "Columna de ingresos (alternativa a Monto)" },
  { key: "currency",    label: "Moneda",       desc: "ARS, USD, etc." },
  { key: "type",        label: "Tipo",         desc: "Gasto / Ingreso" },
  { key: "category",    label: "Categoría",    desc: "Se crea si no existe" },
  { key: "notes",       label: "Notas",        desc: "Comentario adicional" },
];

const TX_TYPE_LABELS = { expense: "Gasto", income: "Ingreso" };
const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "GBP"];

interface Props {
  defaultCurrency?: string;
  onDone?: (count: number) => void;
  onCancel?: () => void;
  inline?: boolean; // true = embedded in onboarding, no outer modal wrapper
}

type Step = "upload" | "map" | "preview" | "importing" | "result";

// ─── Step 1: Upload ────────────────────────────────────────────────────────────

function UploadStep({ onParsed, onCancel }: {
  onParsed: (headers: string[], rows: RawRow[]) => void;
  onCancel?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(""); setLoading(true);
    try {
      const { headers, rows } = await parseFile(file);
      if (rows.length === 0) throw new Error("El archivo está vacío o no tiene filas de datos.");
      onParsed(headers, rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: 14 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Importar movimientos</h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Subí tu planilla de banco o app de finanzas. Soportamos Excel y CSV.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        style={{
          border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--glass-border-hover)"}`,
          borderRadius: 16, padding: "32px 20px", textAlign: "center", cursor: "pointer",
          background: dragging ? "var(--accent-soft)" : "var(--raised)",
          transition: "all 180ms ease-out",
        }}
      >
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>Procesando...</p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: dragging ? "var(--accent)" : "var(--ink)" }}>
              {dragging ? "Soltá el archivo" : "Arrastrá tu archivo aquí"}
            </p>
            <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>o tocá para elegir</p>
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.04em" }}>CSV · XLSX · XLS</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,59,48,0.08)", border: "0.5px solid rgba(255,59,48,0.25)", color: "var(--negative)", fontSize: 12 }}>
          {error}
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--ink-dim)", textAlign: "center" }}>
        El archivo se procesa en tu dispositivo — nunca se sube al servidor.
      </p>

      {onCancel && (
        <button onClick={onCancel} style={{ fontSize: 13, color: "var(--ink-muted)", padding: "8px", borderRadius: 10, background: "transparent" }}>
          Cancelar
        </button>
      )}
    </div>
  );
}

// ─── Step 2: Column mapping ────────────────────────────────────────────────────

function MapStep({ headers, rows, mapping, onChange, onNext, onBack }: {
  headers: string[];
  rows: RawRow[];
  mapping: Partial<ColumnMapping>;
  onChange: (m: Partial<ColumnMapping>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const preview = rows.slice(0, 2);
  const hasAmount = mapping.amount || (mapping.debit && mapping.credit) || mapping.debit || mapping.credit;
  const canProceed = !!(mapping.date && mapping.description && hasAmount);

  function setField(key: keyof ColumnMapping, val: string) {
    onChange({ ...mapping, [key]: val || undefined });
  }

  const selStyle: React.CSSProperties = {
    background: "var(--raised)", border: "0.5px solid var(--glass-border)",
    borderRadius: 9, padding: "7px 10px", color: "var(--ink)", fontSize: 12,
    width: "100%", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Mapear columnas</h2>
        <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
          Decile a Kashify qué columna de tu archivo corresponde a cada campo.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {KASHIFY_FIELDS.map(f => (
          <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 90, flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: f.required ? "var(--ink)" : "var(--ink-muted)" }}>
                {f.label}{f.required ? " *" : ""}
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 1 }}>{f.desc}</p>
            </div>
            <select
              style={selStyle}
              value={mapping[f.key] ?? ""}
              onChange={e => setField(f.key, e.target.value)}
            >
              <option value="">— no usar —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Live preview */}
      {preview.length > 0 && mapping.date && mapping.description && (
        <div style={{ borderRadius: 10, background: "var(--raised)", border: "0.5px solid var(--glass-border)", overflow: "hidden" }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", padding: "8px 12px 4px" }}>
            Vista previa ({preview.length} filas)
          </p>
          {preview.map((row, i) => (
            <div key={i} style={{ padding: "8px 12px", borderTop: i > 0 ? "0.5px solid var(--glass-border-dim)" : "none", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {mapping.date && <span style={{ fontSize: 12, color: "var(--ink-muted)", background: "var(--base)", padding: "2px 6px", borderRadius: 5 }}>{row[mapping.date]}</span>}
              {mapping.description && <span style={{ fontSize: 12, color: "var(--ink)", flex: 1, minWidth: 80 }}>{row[mapping.description]}</span>}
              {mapping.amount && <span style={{ fontSize: 12, color: "var(--positive)", fontWeight: 600 }}>{row[mapping.amount]}</span>}
              {mapping.debit && <span style={{ fontSize: 12, color: "var(--negative)", fontWeight: 600 }}>D:{row[mapping.debit]}</span>}
              {mapping.credit && <span style={{ fontSize: 12, color: "var(--positive)", fontWeight: 600 }}>C:{row[mapping.credit]}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>← Atrás</button>
        <button onClick={onNext} disabled={!canProceed} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: canProceed ? 1 : 0.4 }}>
          Ver preview →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Preview editable ──────────────────────────────────────────────────

function PreviewStep({ transactions, onChange, onImport, onBack }: {
  transactions: ParsedTransaction[];
  onChange: (txs: ParsedTransaction[]) => void;
  onImport: () => void;
  onBack: () => void;
}) {
  const selected  = transactions.filter(t => t._selected);
  const withErrors = transactions.filter(t => t._errors.length > 0);

  function toggle(idx: number) {
    onChange(transactions.map((t, i) => i === idx ? { ...t, _selected: !t._selected } : t));
  }
  function toggleAll() {
    const allSelected = transactions.every(t => t._selected);
    onChange(transactions.map(t => ({ ...t, _selected: !allSelected })));
  }
  function updateField(idx: number, field: keyof ParsedTransaction, val: string) {
    onChange(transactions.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Revisar movimientos</h2>
        <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
          {transactions.length} detectados · {selected.length} seleccionados para importar
        </p>
      </div>

      {withErrors.length > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,149,0,0.08)", border: "0.5px solid rgba(255,149,0,0.25)", fontSize: 12, color: "var(--warning)" }}>
          {withErrors.length} fila{withErrors.length > 1 ? "s" : ""} con errores — revisalas antes de importar.
        </div>
      )}

      {/* Select all */}
      <button onClick={toggleAll} style={{ fontSize: 13, color: "var(--accent)", textAlign: "left", fontWeight: 600 }}>
        {transactions.every(t => t._selected) ? "Deseleccionar todo" : "Seleccionar todo"}
      </button>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "42dvh", overflowY: "auto" }}>
        {transactions.map((t, i) => {
          const hasError = t._errors.length > 0;
          return (
            <div key={i} style={{
              borderRadius: 12, border: `0.5px solid ${hasError ? "rgba(255,149,0,0.35)" : t._selected ? "var(--glass-border)" : "var(--glass-border-dim)"}`,
              background: t._selected ? "var(--raised)" : "transparent",
              opacity: t._selected ? 1 : 0.45,
              padding: "10px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* Checkbox */}
                <button onClick={() => toggle(i)} style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 2,
                  background: t._selected ? "var(--accent)" : "var(--raised)",
                  border: t._selected ? "none" : "1.5px solid var(--glass-border-hover)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {t._selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#FFF" strokeWidth="2"><polyline points="2 6 5 9 10 3"/></svg>}
                </button>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  {/* Description + type */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={t.description}
                      onChange={e => updateField(i, "description", e.target.value)}
                      style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--ink)", background: "transparent", border: "none", outline: "none", minWidth: 0 }}
                    />
                    <select
                      value={t.type}
                      onChange={e => updateField(i, "type", e.target.value)}
                      style={{ fontSize: 12, background: t.type === "income" ? "rgba(52,199,89,0.10)" : "rgba(255,59,48,0.07)", color: t.type === "income" ? "var(--positive)" : "var(--negative)", border: "none", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>
                      <option value="expense">Gasto</option>
                      <option value="income">Ingreso</option>
                    </select>
                  </div>

                  {/* Amount + currency + date + category */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={t.currency_code}
                      onChange={e => updateField(i, "currency_code", e.target.value)}
                      style={{ fontSize: 13, background: "transparent", border: "none", color: "var(--ink-muted)", outline: "none" }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      value={t.amount}
                      onChange={e => updateField(i, "amount", e.target.value)}
                      type="number" inputMode="decimal"
                      style={{ width: 80, fontSize: 13, fontWeight: 600, color: t.type === "income" ? "var(--positive)" : "var(--negative)", background: "transparent", border: "none", outline: "none" }}
                    />
                    <input
                      value={t.date}
                      onChange={e => updateField(i, "date", e.target.value)}
                      type="date"
                      style={{ fontSize: 12, color: "var(--ink-muted)", background: "transparent", border: "none", outline: "none" }}
                    />
                    <input
                      value={t.category_name}
                      onChange={e => updateField(i, "category_name", e.target.value)}
                      placeholder="Categoría"
                      style={{ flex: 1, minWidth: 60, fontSize: 12, color: "var(--ink-muted)", background: "transparent", border: "none", outline: "none" }}
                    />
                  </div>

                  {/* Errors */}
                  {hasError && (
                    <p style={{ fontSize: 12, color: "var(--warning)" }}>{t._errors.join(" · ")}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, background: "var(--raised)", color: "var(--ink-muted)", border: "0.5px solid var(--glass-border)" }}>← Atrás</button>
        <button onClick={onImport} disabled={selected.length === 0} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", opacity: selected.length > 0 ? 1 : 0.4 }}>
          Importar {selected.length} →
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Importing ─────────────────────────────────────────────────────────

function ImportingStep({ progress, total }: { progress: number; total: number }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "20px 0" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Importando...</p>
        <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>{progress} de {total}</p>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--raised)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, background: "var(--accent)", width: `${pct}%`, transition: "width 300ms ease-out" }}/>
      </div>
    </div>
  );
}

// ─── Step 5: Result ────────────────────────────────────────────────────────────

function ResultStep({ inserted, duplicates, errors, onDone }: {
  inserted: number; duplicates: number; errors: number;
  onDone: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "8px 0" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 40px var(--accent-glow)",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>¡Listo!</h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 6 }}>
          {inserted} movimiento{inserted !== 1 ? "s" : ""} importado{inserted !== 1 ? "s" : ""} correctamente.
        </p>
      </div>
      {(duplicates > 0 || errors > 0) && (
        <div style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: "var(--raised)", border: "0.5px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: 6 }}>
          {duplicates > 0 && <p style={{ fontSize: 12, color: "var(--ink-muted)" }}>· {duplicates} duplicado{duplicates !== 1 ? "s" : ""} omitido{duplicates !== 1 ? "s" : ""}</p>}
          {errors > 0 && <p style={{ fontSize: 12, color: "var(--negative)" }}>· {errors} con error</p>}
        </div>
      )}
      <button onClick={onDone} style={{ width: "100%", padding: "13px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: "var(--accent)", color: "#FFFFFF", boxShadow: "0 0 24px var(--accent-glow)" }}>
        Ver movimientos →
      </button>
    </div>
  );
}

// ─── Main ImportFlow ───────────────────────────────────────────────────────────

export default function ImportFlow({ defaultCurrency = "ARS", onDone, onCancel, inline }: Props) {
  const [step, setStep]               = useState<Step>("upload");
  const [headers, setHeaders]         = useState<string[]>([]);
  const [rawRows, setRawRows]         = useState<RawRow[]>([]);
  const [mapping, setMapping]         = useState<Partial<ColumnMapping>>({});
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult]           = useState({ inserted: 0, duplicates: 0, errors: 0 });

  const handleParsed = useCallback((h: string[], rows: RawRow[]) => {
    setHeaders(h);
    setRawRows(rows);
    setMapping(autoDetectMapping(h));
    setStep("map");
  }, []);

  const handleMapNext = useCallback(() => {
    const txs = mapRows(rawRows, mapping, defaultCurrency);
    setTransactions(txs);
    setStep("preview");
  }, [rawRows, mapping, defaultCurrency]);

  const handleImport = useCallback(async () => {
    const selected = transactions.filter(t => t._selected);
    setImportProgress(0);
    setStep("importing");

    const rows = selected.map(t => ({
      description:   t.description,
      amount:        Number(t.amount),
      currency_code: t.currency_code,
      date:          t.date,
      type:          t.type,
      category_name: t.category_name || undefined,
      notes:         t.notes || undefined,
    }));

    // Show progress in chunks
    const CHUNK = 50;
    let inserted = 0, duplicates = 0, errors = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: chunk }),
      });
      if (res.ok) {
        const json = await res.json();
        inserted   += json.inserted ?? 0;
        duplicates += json.duplicates ?? 0;
        errors     += json.errors ?? 0;
      } else {
        errors += chunk.length;
      }
      setImportProgress(Math.min(i + CHUNK, rows.length));
    }

    setResult({ inserted, duplicates, errors });
    setStep("result");
    window.dispatchEvent(new Event("transaction-added"));
  }, [transactions]);

  const content = () => {
    switch (step) {
      case "upload":
        return <UploadStep onParsed={handleParsed} onCancel={onCancel} />;
      case "map":
        return <MapStep headers={headers} rows={rawRows} mapping={mapping} onChange={setMapping} onNext={handleMapNext} onBack={() => setStep("upload")} />;
      case "preview":
        return <PreviewStep transactions={transactions} onChange={setTransactions} onImport={handleImport} onBack={() => setStep("map")} />;
      case "importing":
        return <ImportingStep progress={importProgress} total={transactions.filter(t => t._selected).length} />;
      case "result":
        return <ResultStep {...result} onDone={() => onDone?.(result.inserted)} />;
    }
  };

  // Step indicator
  const STEP_ORDER: Step[] = ["upload", "map", "preview", "importing", "result"];
  const stepIdx = STEP_ORDER.indexOf(step);

  if (inline) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* mini dots */}
        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: i === Math.min(stepIdx, 2) ? 20 : 5, height: 5, borderRadius: 999, background: i <= Math.min(stepIdx, 2) ? "var(--accent)" : "var(--glass-border)", transition: "all 260ms ease-out" }}/>
          ))}
        </div>
        {content()}
      </div>
    );
  }

  // Modal wrapper
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget && step !== "importing") onCancel?.(); }}
    >
      <div
        className="w-full max-w-sm flex flex-col scale-up"
        style={{
          borderRadius: "24px 24px 0 0",
          background: "var(--base)",
          border: "0.5px solid var(--glass-border)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.14)",
          maxHeight: "92dvh",
          overflow: "hidden",
        }}
      >
        {/* Handle + step dots */}
        <div style={{ padding: "12px 18px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--glass-border-hover)" }}/>
          <div style={{ display: "flex", gap: 5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i === Math.min(stepIdx, 2) ? 20 : 5, height: 5, borderRadius: 999, background: i <= Math.min(stepIdx, 2) ? "var(--accent)" : "var(--glass-border)", transition: "all 260ms ease-out" }}/>
            ))}
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 18px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          {content()}
        </div>
      </div>
    </div>
  );
}
