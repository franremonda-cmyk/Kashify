// Shared SF-Symbol-style category icons used across Dashboard and Actividad
interface Props { name?: string; size?: number; }

export default function CategoryIcon({ name, size = 16 }: Props) {
  const n = (name ?? "").toLowerCase();
  const p: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, width: size, height: size,
  };

  if (n.includes("comida") || n.includes("aliment") || n.includes("restaur") || n.includes("café") || n.includes("cafe") || n.includes("food") || n.includes("bar "))
    return <svg {...p}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;

  if (n.includes("transport") || n.includes("uber") || n.includes("nafta") || n.includes("combusti") || n.includes("auto ") || n.includes("taxi") || n.includes("cabify") || n.includes("subte") || n.includes("colect") || n.includes("tren") || n.includes("bus ") || n.includes("peaje") || n.includes("gasoil") || n.includes("estacion"))
    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h3l2 3v3h-5z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;

  if (n.includes("ocio") || n.includes("entret") || n.includes("netflix") || n.includes("cine") || n.includes("disney") || n.includes("hbo") || n.includes("amazon") || n.includes("youtube") || n.includes("steam") || n.includes("juego") || n.includes("teatro") || n.includes("concierto") || n.includes("prime") || n.includes("spotify"))
    return <svg {...p}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;

  if (n.includes("hogar") || n.includes("casa") || n.includes("alquil") || n.includes("expensa") || n.includes("supermercado") || n.includes("limpieza") || n.includes("mueble") || n.includes("deco"))
    return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;

  if (n.includes("salud") || n.includes("médic") || n.includes("medic") || n.includes("farmacia") || n.includes("hospital") || n.includes("clínica") || n.includes("prepaga") || n.includes("dentista") || n.includes("psic") || n.includes("ginec") || n.includes("turno"))
    return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;

  if (n.includes("educaci") || n.includes("curso") || n.includes("libro") || n.includes("escuela") || n.includes("facultad") || n.includes("univers") || n.includes("udemy") || n.includes("coursera") || n.includes("taller") || n.includes("capacit"))
    return <svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;

  if (n.includes("ropa") || n.includes("indument") || n.includes("zapatilla") || n.includes("vestido") || n.includes("camisa") || n.includes("pantalon") || n.includes("calzado") || n.includes("adidas") || n.includes("nike") || n.includes("zara"))
    return <svg {...p}><path d="M20.38 3.46L16 2l-4 4-4-4-4.38 1.46A2 2 0 002 5.24l1 6.46a2 2 0 001.93 1.69h14.14a2 2 0 001.93-1.69l1-6.46a2 2 0 00-1.62-1.78z"/></svg>;

  if (n.includes("trabajo") || n.includes("oficina") || n.includes("hosting") || n.includes("dominio") || n.includes("software") || n.includes("papeler") || n.includes("cowork"))
    return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;

  if (n.includes("suscripci") || n.includes("subscripci") || n.includes("membres") || n.includes("mensualid") || n.includes("abono"))
    return <svg {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;

  if (n.includes("viaje") || n.includes("hotel") || n.includes("turismo") || n.includes("vuelo") || n.includes("airbnb") || n.includes("booking") || n.includes("avion") || n.includes("aerol"))
    return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;

  if (n.includes("mascota") || n.includes("perro") || n.includes("gato") || n.includes("vet"))
    return <svg {...p}><path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 7.65l1.06 1.06L12 21.23l7.36-7.36 1.06-1.06a5.4 5.4 0 000-7.23z"/></svg>;

  if (n.includes("ahorro") || n.includes("inversion") || n.includes("plazo fijo") || n.includes("cripto") || n.includes("banca") || n.includes("banco") || n.includes("finanz"))
    return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;

  if (n.includes("regalo") || n.includes("cumple") || n.includes("present") || n.includes("festejo"))
    return <svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;

  if (n.includes("ingreso") || n.includes("sueldo") || n.includes("salario") || n.includes("cobro") || n.includes("pago recibid"))
    return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;

  // Default: activity pulse
  return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}
