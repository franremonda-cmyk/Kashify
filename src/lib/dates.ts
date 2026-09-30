import type { SupabaseClient } from "@supabase/supabase-js";

// Fechas en la hora del usuario, no en UTC. `new Date().toISOString()` da el
// día UTC: en Argentina (UTC−3) lo cargado después de las 21 quedaba fechado
// mañana, y el 31 a la noche caía en el mes siguiente. El servidor (Vercel)
// corre en UTC y WhatsApp no trae zona, así que Neo usa la guardada en el
// perfil; la web usa la del dispositivo (y la sincroniza al perfil).
export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

// "YYYY-MM-DD" de `d` en esa zona. Sin zona = la del dispositivo.
export function isoDay(d: Date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Un Date cuyos getFullYear/getMonth/getDate/getDay son la fecha de pared en
// esa zona (medianoche local del proceso), para reusar la aritmética de fechas
// existente (`new Date(y, m, 1)`, etc.) sin pensar en UTC.
export function wallToday(timeZone: string): Date {
  const [y, m, d] = isoDay(new Date(), timeZone).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Día local de un Date armado con componentes locales (new Date(y, m, d)):
// a diferencia de toISOString(), no se corre de día en husos positivos.
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Zona del perfil. Si la columna todavía no existe (migración 015 sin correr)
// o viene vacía o inválida, Argentina.
export async function userTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  const tz = !error ? (data as { timezone?: string } | null)?.timezone : undefined;
  if (!tz) return DEFAULT_TZ;
  try { isoDay(new Date(), tz); return tz; } catch { return DEFAULT_TZ; }
}
