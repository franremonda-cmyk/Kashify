// SF-Symbol-style thin-stroke icons for personal finance categories
// Covers the most common categories in Argentine/Latam household budgets
interface Props { name?: string; size?: number; }

export default function CategoryIcon({ name, size = 16 }: Props) {
  const n = (name ?? "").toLowerCase();
  const p: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, width: size, height: size,
  };

  // INGRESOS — salary, freelance, income received
  if (n.includes("ingreso") || n.includes("sueldo") || n.includes("salario") || n.includes("cobro") || n.includes("pago recibid") || n.includes("honorario"))
    return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;

  // COMIDA — restaurants, cafés, food delivery, bakeries
  if (n.includes("comida") || n.includes("restaur") || n.includes("café") || n.includes("cafe") || n.includes("food") || n.includes("medialunas") || n.includes("panaderia") || n.includes("pizzeria") || n.includes("hamburgues") || n.includes("sushi") || n.includes("delivery") || n.includes("rappi") || n.includes("pedidosya") || n.includes("kiosco") || n.includes("bar ") || n.includes("aliment") || n.includes("almuerzo") || n.includes("cena"))
    return <svg {...p}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;

  // SUPERMERCADO — groceries, markets, chains
  if (n.includes("supermercado") || n.includes("almacen") || n.includes("verduleria") || n.includes("carrefour") || n.includes("coto") || n.includes("jumbo") || n.includes("mercado ") || n.includes("fiambreria") || n.includes("mini market") || n.includes("chino") || n.includes("walmart") || n.includes("disco ") || n.includes("vea "))
    return <svg {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.98-1.68l1.62-9.7H6"/></svg>;

  // TRANSPORTE — fuel, rideshare, public transit, parking
  if (n.includes("transport") || n.includes("uber") || n.includes("nafta") || n.includes("combusti") || n.includes("taxi") || n.includes("cabify") || n.includes("subte") || n.includes("colect") || n.includes("tren ") || n.includes("peaje") || n.includes("gasoil") || n.includes("shell") || n.includes("ypf") || n.includes("axion") || n.includes("gnc") || n.includes("estacion de servicio") || n.includes("estacionamiento") || n.includes("autopista") || n.includes("sube"))
    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h3l2 3v3h-5z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;

  // SALUD — doctors, prepaid health insurance, medical appointments
  if (n.includes("salud") || n.includes("médic") || n.includes("medic") || n.includes("hospital") || n.includes("clínica") || n.includes("clinic") || n.includes("prepaga") || n.includes("dentista") || n.includes("psic") || n.includes("ginec") || n.includes("turno") || n.includes("osde") || n.includes("swiss medical") || n.includes("galeno") || n.includes("hominis") || n.includes("omint") || n.includes("ioma") || n.includes("medicus"))
    return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;

  // FARMACIA — pharmacy, medicine, remedies
  if (n.includes("farmacia") || n.includes("remedio") || n.includes("medicamento") || n.includes("drogueria") || n.includes("pastilla") || n.includes("comprimido") || n.includes("suplemento"))
    return <svg {...p}><rect x="2" y="8.5" width="20" height="7" rx="3.5"/><line x1="12" y1="8.5" x2="12" y2="15.5"/></svg>;

  // GYM / DEPORTE — fitness, training, sports
  if (n.includes("gimnasio") || n.includes("gym") || n.includes("deporte") || n.includes("running") || n.includes("fitness") || n.includes("pilates") || n.includes("yoga") || n.includes("natacion") || n.includes("crossfit") || n.includes("entrenamiento") || n.includes("spinning"))
    return <svg {...p}><line x1="6" y1="12" x2="18" y2="12"/><path d="M4 9v6M8 7v10M16 7v10M20 9v6"/></svg>;

  // BELLEZA / ESTÉTICA — hair, beauty, personal care services
  if (n.includes("belleza") || n.includes("peluqui") || n.includes("estétic") || n.includes("estetica") || n.includes("cosmet") || n.includes("maquillaje") || n.includes("manicura") || n.includes("pedicura") || n.includes("depilacion") || n.includes("salón") || n.includes("salon de") || n.includes("cabellos"))
    return <svg {...p}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;

  // FIESTA / CELEBRACIÓN — party, birthday, weddings, social events
  if (n.includes("fiesta") || n.includes("party") || n.includes("cumpleaños") || n.includes("cumple") || n.includes("celebraci") || n.includes("festejo") || n.includes("boda") || n.includes("casamiento") || n.includes("15 años") || n.includes("evento social") || n.includes("reunion") || n.includes("social"))
    return <svg {...p}><circle cx="12" cy="8" r="6"/><path d="M12 14v4"/><path d="M10 18l2 2 2-2"/></svg>;

  // HOGAR — rent, utilities included, home maintenance
  if (n.includes("hogar") || n.includes("casa") || n.includes("alquil") || n.includes("expensa") || n.includes("limpieza") || n.includes("mueble") || n.includes("deco") || n.includes("electrodomestico") || n.includes("sodimac") || n.includes("ferreteria") || n.includes("easy ") || n.includes("pintura"))
    return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;

  // SERVICIOS / UTILITIES — phone, internet, electricity, gas, water
  if (n.includes("edesur") || n.includes("edenor") || n.includes("aysa") || n.includes("metrogas") || n.includes("luz ") || n.includes("gas ") || n.includes("agua ") || n.includes("internet") || n.includes("wifi") || n.includes("telefon") || n.includes("celular") || n.includes("personal ") || n.includes("claro") || n.includes("movistar") || n.includes("fibra") || n.includes("servicio"))
    return <svg {...p}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>;

  // OCIO / ENTRETENIMIENTO — streaming, cinema, concerts, gaming
  if (n.includes("ocio") || n.includes("entret") || n.includes("netflix") || n.includes("cine") || n.includes("disney") || n.includes("hbo") || n.includes("amazon prime") || n.includes("youtube") || n.includes("steam") || n.includes("juego") || n.includes("teatro") || n.includes("concierto") || n.includes("prime") || n.includes("deezer") || n.includes("twitch"))
    return <svg {...p}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;

  // EDUCACIÓN — courses, books, schools, universities
  if (n.includes("educaci") || n.includes("curso") || n.includes("libro") || n.includes("escuela") || n.includes("facultad") || n.includes("univers") || n.includes("udemy") || n.includes("coursera") || n.includes("taller") || n.includes("capacit") || n.includes("colegio") || n.includes("jardin "))
    return <svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;

  // INDUMENTARIA / ROPA — clothing, shoes, accessories
  if (n.includes("ropa") || n.includes("indument") || n.includes("zapatilla") || n.includes("vestido") || n.includes("camisa") || n.includes("pantalon") || n.includes("calzado") || n.includes("adidas") || n.includes("nike") || n.includes("zara") || n.includes("h&m") || n.includes("shopping") || n.includes("boutique") || n.includes("jean") || n.includes("remera"))
    return <svg {...p}><path d="M20.38 3.46L16 2l-4 4-4-4-4.38 1.46A2 2 0 002 5.24l1 6.46a2 2 0 001.93 1.69h14.14a2 2 0 001.93-1.69l1-6.46a2 2 0 00-1.62-1.78z"/></svg>;

  // SUSCRIPCIONES — renewals, memberships, monthly subscriptions
  if (n.includes("suscripci") || n.includes("subscripci") || n.includes("membres") || n.includes("mensualid") || n.includes("abono") || n.includes("spotify") || n.includes("apple") || n.includes("adobe") || n.includes("microsoft"))
    return <svg {...p}><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>;

  // TRABAJO / FREELANCE / OFICINA — work expenses
  if (n.includes("trabajo") || n.includes("oficina") || n.includes("hosting") || n.includes("dominio") || n.includes("software") || n.includes("papeler") || n.includes("cowork") || n.includes("freelance") || n.includes("material de trabajo"))
    return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;

  // AHORROS / INVERSIONES / FINANZAS — savings growth, investments
  if (n.includes("ahorro") || n.includes("inversion") || n.includes("plazo fijo") || n.includes("cripto") || n.includes("banco") || n.includes("finanz") || n.includes("wallet") || n.includes("billetera") || n.includes("fondo") || n.includes("bursatil") || n.includes("cedear") || n.includes("accion"))
    return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;

  // VIAJES — flights, hotels, tourism
  if (n.includes("viaje") || n.includes("hotel") || n.includes("turismo") || n.includes("vuelo") || n.includes("airbnb") || n.includes("booking") || n.includes("avion") || n.includes("aerol") || n.includes("aeroparque") || n.includes("ezeiza") || n.includes("crucero") || n.includes("hostel"))
    return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;

  // MASCOTAS — vet, pet supplies, pet food
  if (n.includes("mascota") || n.includes("perro") || n.includes("gato") || n.includes("vet") || n.includes("petshop") || n.includes("pet shop") || n.includes("comida para"))
    return <svg {...p}><path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 7.65l1.06 1.06L12 21.23l7.36-7.36 1.06-1.06a5.4 5.4 0 000-7.23z"/></svg>;

  // REGALOS — gifts, presents
  if (n.includes("regalo") || n.includes("present") || n.includes("obsequio") || n.includes("souven"))
    return <svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;

  // Default: tag icon (generic "labeled expense")
  return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
