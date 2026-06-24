// Modo "tabla mensual" (matriz pivote): planillas donde las filas son categorías,
// las columnas son meses (Jan–Dec) y las celdas son montos agregados por mes.
// Las desdobla (unpivot) en movimientos individuales que el importador entiende.
//
// Nota: archivos exportados de Excel a veces traen mojibake de codificación
// (ej. "$Â 1.337,00" = UTF-8 leído como Latin-1). parseAmount descarta los
// símbolos no numéricos, así que los montos parsean bien igual.

import { parseAmount, autoCategory } from "./importParser";
import type { SheetData, ParsedTransaction } from "./importParser";

// ─── Tabla de meses (ES/EN, abreviado y completo) ──────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, ene: 1, enero: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  apr: 4, abr: 4, abril: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  aug: 8, ago: 8, agosto: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dec: 12, dic: 12, diciembre: 12, december: 12,
};

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Reconoce una celda de encabezado de mes. Acepta:
//  - fecha ISO (2024-01-01) → mes + año (caso Excel con celdas-fecha)
//  - nombre de mes (Jan / Enero / ene) → solo mes
function parseMonthCell(cell: string): { month: number; year: number | null } | null {
  const s = cell.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return { month: parseInt(iso[2], 10), year: parseInt(iso[1], 10) };
  const m = MONTH_MAP[normalize(s)];
  return m ? { month: m, year: null } : null;
}

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Tipos ──────────────────────────────────────────────────────────────────────

export interface HeaderInfo {
  headerRow: number;                                        // índice de la fila de encabezado
  labelCol: number;                                          // columna con el nombre de categoría
  monthCols: { col: number; month: number; year: number | null }[]; // columnas que son meses
}

export interface LooseItem {
  description: string;
  amount: number;
  sourceLabel: string;                 // bloque de origen, ej. "Compras diferenciadas"
  type: "income" | "expense";          // inferido del título del bloque
}

export interface MatrixDetectionResult {
  hasMatrix: boolean;
  matrixSheets: { sheet: SheetData; header: HeaderInfo; type: "income" | "expense" }[];
  looseItems: LooseItem[];
  suggestedYear: number | null; // año inferido de los encabezados-fecha, si hay
}

// ─── Detección ──────────────────────────────────────────────────────────────────

const MIN_MONTHS = 3; // umbral conservador para no romper imports de banco

// Localiza la fila de encabezado (≥MIN_MONTHS nombres de mes) dentro de una hoja.
export function findHeaderRow(rows: string[][]): HeaderInfo | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const monthCols: HeaderInfo["monthCols"] = [];
    let labelCol = -1;
    for (let c = 0; c < row.length; c++) {
      const parsed = parseMonthCell(row[c]);
      if (parsed) monthCols.push({ col: c, month: parsed.month, year: parsed.year });
      else if (labelCol === -1 && row[c].trim() !== "") labelCol = c;
    }
    if (monthCols.length >= MIN_MONTHS) {
      return { headerRow: r, labelCol: labelCol === -1 ? 0 : labelCol, monthCols };
    }
  }
  return null;
}

export function sheetType(sheetName: string): "income" | "expense" | null {
  const n = normalize(sheetName);
  if (/entrada|ingreso|income/.test(n)) return "income";
  if (/salida|gasto|egreso|expense/.test(n)) return "expense";
  return null;
}

// Año desde el nombre del archivo (ej. "Finanzas 2025.xlsx" → 2025).
export function resolveYear(fileName: string): number | null {
  const m = fileName.match(/20\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

const TOTAL_RE = /^(total|totales|suma)/i;

export function detectMatrix(sheets: SheetData[]): MatrixDetectionResult {
  const matrixSheets: MatrixDetectionResult["matrixSheets"] = [];
  const looseItems: LooseItem[] = [];
  const years: number[] = [];

  for (const sheet of sheets) {
    const header = findHeaderRow(sheet.rows);
    const type = sheetType(sheet.name);
    if (header) years.push(...header.monthCols.map(c => c.year).filter((y): y is number => y !== null));

    if (header && type) {
      // Solo se auto-importan hojas con tipo claro (Entrada/Salida).
      matrixSheets.push({ sheet, header, type });
    } else {
      // Resto (ej. "Diferencia", que es resumen + bloques sueltos): no se
      // auto-importa la matriz (evita duplicar totales); solo ítems sueltos.
      looseItems.push(...extractLooseItems(sheet));
    }
  }

  // Año más frecuente entre los encabezados-fecha.
  const suggestedYear = years.length
    ? [...years].sort((a, b) =>
        years.filter(y => y === b).length - years.filter(y => y === a).length)[0]
    : null;

  return { hasMatrix: matrixSheets.length > 0, matrixSheets, looseItems, suggestedYear };
}

// ─── Unpivot ──────────────────────────────────────────────────────────────────

// Desdobla una hoja matriz: por cada (categoría × mes con monto > 0) un movimiento.
export function unpivotMatrix(
  sheet: SheetData,
  header: HeaderInfo,
  type: "income" | "expense",
  fallbackYear: number,
  defaultCurrency: string,
): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let idx = 0;

  for (let r = header.headerRow + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    const label = (row[header.labelCol] ?? "").trim();
    if (!label) continue;            // fila vacía
    if (TOTAL_RE.test(label)) continue; // fila de totales

    for (const { col, month, year } of header.monthCols) {
      const parsed = parseAmount(row[col] ?? "");
      if (parsed === null || parsed === 0) continue;

      const mm = String(month).padStart(2, "0");
      const yy = year ?? fallbackYear;
      out.push({
        _rowIndex: idx++,
        description: label,
        amount: Math.abs(parsed),
        currency_code: defaultCurrency,
        date: `${yy}-${mm}-01`,
        type,
        category_name: autoCategory(label) || label,
        notes: "",
        _errors: [],
        _selected: true,
      });
    }
  }

  return out;
}

// Desdobla todas las hojas matriz de una detección.
export function unpivotAll(
  matrixSheets: MatrixDetectionResult["matrixSheets"],
  fallbackYear: number,
  defaultCurrency: string,
): ParsedTransaction[] {
  return matrixSheets.flatMap(({ sheet, header, type }) =>
    unpivotMatrix(sheet, header, type, fallbackYear, defaultCurrency),
  );
}

// ─── Bloques sueltos (Compras/Ingresos diferenciados) ──────────────────────────

// Detecta sub-tablas con encabezado "Articulo / Precio" y lee cada una por su
// columna hacia abajo hasta su fila TOTAL. El título del bloque está una fila
// arriba del encabezado (ej. "Compras diferenciadas" / "Ingresos Diferenciados").
// Ignora otros números sueltos (sub-totales sin encabezado Articulo/Precio).
export function extractLooseItems(sheet: SheetData): LooseItem[] {
  const items: LooseItem[] = [];
  const rows = sheet.rows;

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (normalize(rows[r][c] ?? "") !== "articulo") continue;
      // Encabezado de sub-tabla: descripción en col c, precio en col c+1.
      const priceCol = c + 1;
      const title = (rows[r - 1]?.[c] ?? "").trim() || sheet.name;
      const type: "income" | "expense" =
        /ingreso|devoluci|reintegro|cobro|sueldo|entrada/i.test(normalize(title)) ? "income" : "expense";

      for (let rr = r + 1; rr < rows.length; rr++) {
        const desc = (rows[rr][c] ?? "").trim();
        if (!desc) continue;                 // hueco entre ítems → seguir
        if (TOTAL_RE.test(desc)) break;       // fila de total del bloque → fin
        const amount = parseAmount(rows[rr][priceCol] ?? "");
        if (amount === null || amount === 0) continue;
        items.push({ description: desc, amount: Math.abs(amount), sourceLabel: title, type });
      }
    }
  }

  return items;
}

// ─── Helper para la UI: construir un movimiento desde un loose item ────────────

export function looseItemToTransaction(
  item: LooseItem,
  type: "income" | "expense",
  year: number,
  month: number,
  defaultCurrency: string,
  rowIndex: number,
): ParsedTransaction {
  const mm = String(month).padStart(2, "0");
  return {
    _rowIndex: rowIndex,
    description: item.description,
    amount: item.amount,
    currency_code: defaultCurrency,
    date: `${year}-${mm}-01`,
    type,
    category_name: autoCategory(item.description) || item.sourceLabel,
    notes: "",
    _errors: [],
    _selected: true,
  };
}

export { MONTH_NAMES_ES };
