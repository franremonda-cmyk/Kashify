export const FALLBACK_COLORS = [
  "#C8820A","#7B61FF","#34C759","#FF9500","#5AC8FA",
  "#BF5AF2","#FF6B6B","#30D158","#FFD60A","#64D2FF",
];

/** Color de la categoría, o uno estable derivado del nombre si no tiene. */
export function catColorOrFallback(color: string | undefined | null, name: string): string {
  if (color) return color;
  // hash del nombre → color consistente por categoría
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}
