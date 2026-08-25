// Contraste WCAG de los tokens de color. Lee globals.css de verdad: si alguien
// cambia un token y baja de AA, este test falla.
// Correr: npx tsx cloudflare-worker/test/contraste.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../src/app/globals.css"), "utf8");

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  pass++;
}

// ── color: hex o rgba() sobre un fondo opaco ──
type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const v = h.replace("#", "");
  const f = v.length === 3 ? v.split("").map(c => c + c).join("") : v;
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)) as RGB;
};
const over = (fg: RGB, bg: RGB, a: number): RGB =>
  fg.map((c, i) => c * a + bg[i] * (1 - a)) as RGB;
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Resuelve un token a color plano sobre `bg` (soporta rgba con alpha).
function color(token: string, scope: "dark" | "light", bg: RGB): RGB {
  const block = scope === "dark"
    ? css.slice(css.indexOf(":root {"), css.indexOf('[data-theme="light"]'))
    : css.slice(css.indexOf('[data-theme="light"] {'));
  const m = block.match(new RegExp(`--${token}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --${token} no encontrado en ${scope}`);
  const raw = m[1].trim();
  const rgba = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (rgba) {
    const c: RGB = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    return over(c, bg, rgba[4] ? Number(rgba[4]) : 1);
  }
  return hex(raw);
}

const AA_TEXT = 4.5;

// ── Fondos reales de cada tema ──
const BG = {
  dark:  { void: hex("#121517"), base: hex("#1B2123"), raised: hex("#232A2C") },
  light: { void: hex("#EEF1EA"), base: hex("#FFFFFF"), raised: hex("#E7EBE2") },
};
for (const scope of ["dark", "light"] as const) {
  for (const [surface, bg] of Object.entries(BG[scope])) {
    // El fondo declarado en el CSS tiene que seguir siendo el que testeamos.
    const declared = color(surface === "void" ? "void" : surface, scope, bg);
    ok(declared.join() === bg.join(), `${scope}/--${surface} sigue siendo el fondo que testeamos`);

    // Texto: cuerpo, secundario y terciario contra cada superficie.
    for (const ink of ["ink", "ink-muted", "ink-dim"]) {
      const r = ratio(color(ink, scope, bg), bg);
      ok(r >= AA_TEXT, `${scope}: --${ink} sobre --${surface} = ${r.toFixed(2)} (mín ${AA_TEXT})`);
    }
    // Color semántico usado como TEXTO (importes, links, porcentajes).
    for (const sem of ["accent", "positive", "negative", "warning"]) {
      const r = ratio(color(sem, scope, bg), bg);
      ok(r >= AA_TEXT, `${scope}: --${sem} como texto sobre --${surface} = ${r.toFixed(2)} (mín ${AA_TEXT})`);
    }
  }
  // Tinta ENCIMA de un relleno de color. --on-accent se usa sobre los cuatro
  // (botón primario, FAB, burbuja del chat, botón de reintentar); la variante
  // soft solo sobre el acento (la hora en la burbuja de Neo).
  for (const fill of ["accent", "positive", "negative", "warning"]) {
    const bgFill = color(fill, scope, BG[scope].base);
    const r = ratio(color("on-accent", scope, bgFill), bgFill);
    ok(r >= AA_TEXT, `${scope}: --on-accent sobre --${fill} = ${r.toFixed(2)} (mín ${AA_TEXT})`);
  }
  const accentFill = color("accent", scope, BG[scope].base);
  const rSoft = ratio(color("on-accent-soft", scope, accentFill), accentFill);
  ok(rSoft >= AA_TEXT, `${scope}: --on-accent-soft sobre --accent = ${rSoft.toFixed(2)} (mín ${AA_TEXT})`);
}

console.log(`✓ contraste: ${pass} asserts OK`);
