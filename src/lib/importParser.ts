import Papa from "papaparse";

export interface RawRow { [key: string]: string }

// Una hoja cruda: filas como matriz de celdas string, sin asumir encabezado.
// La usa el modo "tabla mensual" (matrixImport) para inspeccionar estructura.
export interface SheetData { name: string; rows: string[][] }

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  debit: string;       // alternative: separate debit column
  credit: string;      // alternative: separate credit column
  currency: string;
  type: string;
  category: string;
  notes: string;
}

export interface ParsedTransaction {
  _rowIndex: number;
  description: string;
  amount: number;
  currency_code: string;
  date: string;
  type: "expense" | "income";
  category_name: string;
  notes: string;
  // validation
  _errors: string[];
  _duplicate?: boolean;
  _selected: boolean;
}

// ─── File parsing ──────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseExcel(file);
  throw new Error("Formato no soportado. Usá CSV, XLSX o XLS.");
}

function parseCsv(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        resolve({ headers, rows: result.data });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

async function parseExcel(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (raw.length < 2) return { headers: [], rows: [] };

  const headers = (raw[0] as unknown[]).map(String);
  const rows: RawRow[] = raw.slice(1).map((r) => {
    const row: RawRow = {};
    headers.forEach((h, i) => { row[h] = String((r as unknown[])[i] ?? ""); });
    return row;
  }).filter(r => Object.values(r).some(v => v.trim() !== ""));

  return { headers, rows };
}

// ─── Todas las hojas (modo tabla mensual) ──────────────────────────────────────

// Convierte una celda a string. Las fechas (cellDates) se vuelven ISO YYYY-MM-DD
// usando la fecha LOCAL (sin shift de timezone), para que los encabezados de mes
// con valor de fecha sean reconocibles por matrixImport.
function cellToString(c: unknown): string {
  if (c instanceof Date && !isNaN(c.getTime())) {
    const y = c.getFullYear();
    const m = String(c.getMonth() + 1).padStart(2, "0");
    const d = String(c.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(c ?? "");
}

// Devuelve TODAS las hojas del archivo como filas crudas (sin asumir encabezado),
// para que matrixImport pueda detectar el formato matriz. Para CSV devuelve una
// sola "hoja" con el nombre del archivo.
export async function parseAllSheets(file: File): Promise<SheetData[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
    const rows = (result.data ?? []).map(r => (r as unknown[]).map(c => String(c ?? "")));
    return [{ name: file.name, rows }];
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    return wb.SheetNames.map((sheetName) => {
      const sheet = wb.Sheets[sheetName];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const rows = raw.map(r => (r as unknown[]).map(cellToString));
      return { name: sheetName, rows };
    });
  }
  throw new Error("Formato no soportado. Usá CSV, XLSX o XLS.");
}

// ─── Auto-detect column mapping ────────────────────────────────────────────────

const DATE_PATTERNS        = /^(fecha|date|f\.|dia|día|when|periodo)/i;
const DESC_PATTERNS        = /^(descripci[oó]n|concepto|detalle|description|detail|texto|narr)/i;
const AMOUNT_PATTERNS      = /^(monto|importe|amount|valor|total|suma)/i;
const DEBIT_PATTERNS       = /^(d[eé]bito|debit|debe|egreso|salida|gasto)/i;
const CREDIT_PATTERNS      = /^(cr[eé]dito|credit|haber|ingreso|entrada)/i;
const CURRENCY_PATTERNS    = /^(moneda|currency|divisa)/i;
const TYPE_PATTERNS        = /^(tipo|type|clase|clase)/i;
const CATEGORY_PATTERNS    = /^(categor[ií]a|category|rubro|etiqueta)/i;
const NOTES_PATTERNS       = /^(nota|notas|note|notes|observaci[oó]n|comentario)/i;

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  for (const h of headers) {
    if (!mapping.date        && DATE_PATTERNS.test(h))     mapping.date = h;
    else if (!mapping.description && DESC_PATTERNS.test(h))    mapping.description = h;
    else if (!mapping.amount      && AMOUNT_PATTERNS.test(h))  mapping.amount = h;
    else if (!mapping.debit       && DEBIT_PATTERNS.test(h))   mapping.debit = h;
    else if (!mapping.credit      && CREDIT_PATTERNS.test(h))  mapping.credit = h;
    else if (!mapping.currency    && CURRENCY_PATTERNS.test(h)) mapping.currency = h;
    else if (!mapping.type        && TYPE_PATTERNS.test(h))    mapping.type = h;
    else if (!mapping.category    && CATEGORY_PATTERNS.test(h)) mapping.category = h;
    else if (!mapping.notes       && NOTES_PATTERNS.test(h))   mapping.notes = h;
  }
  // If no plain amount but debit+credit found, that's the bank pattern — leave amount empty
  return mapping;
}

// ─── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();

  // ISO already: 2024-03-15
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YYYY (US format, less common here)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    // Heuristic: if month > 12, swap
    const mn = parseInt(m), dn = parseInt(d);
    if (mn > 12) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try native Date as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

export function parseAmount(raw: string): number | null {
  if (!raw?.trim()) return null;
  // Remove currency symbols, spaces, quotes
  let s = raw.replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  // If both . and , present: determine which is decimal separator
  if (s.includes(".") && s.includes(",")) {
    const lastDot   = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // 1.234,56 → European format
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 → US format
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Could be 1234,56 (decimal) or 1,234 (thousands)
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(",", "."); // decimal comma
    } else {
      s = s.replace(/,/g, ""); // thousands separator
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Auto-categorization keywords ─────────────────────────────────────────────

const AUTO_CATEGORIES: [RegExp, string][] = [
  [/super|mercado|carrefour|coto|jumbo|dia|disco|walmart|lidl|walmart/i, "Supermercado"],
  [/rapipago|pagofacil|pago f[aá]cil|abitab|servicio|luz|gas |agua |edesur|edenor|metrogas/i, "Servicios"],
  [/uber|cabify|taxi|subte|colectivo|sube|tren|metrobus/i, "Transporte"],
  [/restauran|almuerzo|cena|desayuno|delivery|rappi|pedidos|mcdonalds|burger|pizza|sushi/i, "Comida"],
  [/farmacia|remedio|medicamento|drogueria/i, "Farmacia"],
  [/médico|medico|doctor|clínica|clinica|hospital|prepaga|osde|galeno/i, "Salud"],
  [/spotify|netflix|disney|hbo|prime|youtube|apple|streaming/i, "Entretenimiento"],
  [/gym|gimnasio|fitness|sport/i, "Salud"],
  [/hotel|airbnb|booking|vuelo|aeropuerto|viaje/i, "Viajes"],
  [/amazon|mercadolibre|meli|tienda|ropa|zapatilla|indument/i, "Compras"],
  [/sueldo|salario|haberes|cobro|ingreso/i, "Ingreso"],
];

export function autoCategory(description: string): string {
  const d = description.toLowerCase();
  for (const [re, cat] of AUTO_CATEGORIES) {
    if (re.test(d)) return cat;
  }
  return "";
}

// ─── Row → ParsedTransaction ──────────────────────────────────────────────────

export function mapRows(
  rows: RawRow[],
  mapping: Partial<ColumnMapping>,
  defaultCurrency: string
): ParsedTransaction[] {
  return rows.map((row, i) => {
    const errors: string[] = [];

    // Date
    const rawDate  = mapping.date ? row[mapping.date] ?? "" : "";
    const date     = parseDate(rawDate);
    if (!date) errors.push("Fecha inválida");

    // Description
    const description = (mapping.description ? row[mapping.description] : "")?.trim() ?? "";
    if (!description) errors.push("Sin descripción");

    // Amount + type
    let amount = 0;
    let type: "expense" | "income" = "expense";

    const hasDebitCredit = mapping.debit || mapping.credit;
    if (hasDebitCredit) {
      const debitRaw  = mapping.debit  ? row[mapping.debit]  : "";
      const creditRaw = mapping.credit ? row[mapping.credit] : "";
      const debit     = parseAmount(debitRaw ?? "");
      const credit    = parseAmount(creditRaw ?? "");
      if (credit && credit > 0) { amount = credit; type = "income"; }
      else if (debit && debit > 0) { amount = debit; type = "expense"; }
      else errors.push("Monto vacío");
    } else {
      const rawAmt = mapping.amount ? row[mapping.amount] ?? "" : "";
      const parsed = parseAmount(rawAmt);
      if (parsed === null) { errors.push("Monto inválido"); }
      else {
        amount = Math.abs(parsed);
        type   = parsed < 0 ? "expense" : "income";
      }
    }

    // Override type if column present
    if (mapping.type) {
      const t = (row[mapping.type] ?? "").toLowerCase();
      if (/ingreso|income|credit|entrada|haber/.test(t)) type = "income";
      if (/gasto|expense|debit|salida|debe/.test(t)) type = "expense";
    }

    // Currency
    const currency_code = (
      (mapping.currency ? row[mapping.currency] : "") ||
      defaultCurrency
    ).trim().toUpperCase() || defaultCurrency;

    // Category
    const category_name = (
      (mapping.category ? row[mapping.category] : "") ||
      autoCategory(description)
    ).trim();

    // Notes
    const notes = (mapping.notes ? row[mapping.notes] : "")?.trim() ?? "";

    return {
      _rowIndex: i,
      description,
      amount,
      currency_code,
      date: date ?? "",
      type,
      category_name,
      notes,
      _errors: errors,
      _selected: errors.length === 0,
    };
  });
}
