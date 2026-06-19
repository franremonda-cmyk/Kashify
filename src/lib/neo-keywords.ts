// ─── Verbos de acción ────────────────────────────────────────────────────────

export const SPEND_VERBS = [
  "compre", "comprar", "pague", "pagar", "gaste", "gastar",
  "sali", "salir", "me salio", "me costo", "costo", "cuesta",
  "fui a", "fui al", "tome", "pedi", "comi", "cene", "desayune",
  "almorcé", "almorcé", "almorce", "cargue", "llene", "consumi",
  "contraté", "contrate", "renove", "renovar", "abono", "abone",
];

export const INCOME_VERBS = [
  "cobre", "cobrar", "recibi", "recibir", "me pagaron",
  "me deposito", "me transfirieron", "entre", "gane", "ganar",
  "me acreditaron", "vendí", "vendi", "facture",
];

// ─── keyword → categoría (invertido del KEYWORD_MAP de BottomNav) ────────────

export const KEYWORD_TO_CATEGORY: Record<string, string> = {
  // Comida
  almuerzo:"Comida", cena:"Comida", desayuno:"Comida", pizza:"Comida",
  sushi:"Comida", resto:"Comida", restaurant:"Comida", comida:"Comida",
  cafe:"Comida", rappi:"Comida", pedidos:"Comida",
  mcdo:"Comida", burger:"Comida", empanada:"Comida", empanadas:"Comida",
  taco:"Comida", tacos:"Comida", medialunas:"Comida", kiosco:"Comida",
  kiosko:"Comida", sandwich:"Comida", ensalada:"Comida", milanesa:"Comida",
  milanesas:"Comida", asado:"Comida", parrilla:"Comida", bodegon:"Comida",
  delivery:"Comida", mcdonald:"Comida", wendys:"Comida", subway:"Comida",
  starbucks:"Comida", cafeteria:"Comida", panaderia:"Comida", pasteleria:"Comida",
  heladeria:"Comida", helado:"Comida", helados:"Comida", chocolateria:"Comida",
  soda:"Comida", jugo:"Comida", cerveza:"Comida", vino:"Comida",
  bar:"Comida", aperitivo:"Comida", mate:"Comida", yerba:"Comida",
  mercado:"Comida", verduleria:"Comida", carniceria:"Comida", polleria:"Comida",
  pescaderia:"Comida", super:"Comida", supermercado:"Comida", ramen:"Comida",
  fideos:"Comida", pasta:"Comida", lomito:"Comida", hamburguesa:"Comida",
  pochoclos:"Comida", pancho:"Comida",
  choripan:"Comida", bondiola:"Comida", bife:"Comida", costilla:"Comida",
  jumbo:"Comida", coto:"Comida", carrefour:"Comida", dia:"Comida",
  disco:"Comida", vea:"Comida", walmart:"Comida", lidl:"Comida",

  // Transporte
  uber:"Transporte", cabify:"Transporte", taxi:"Transporte", nafta:"Transporte",
  combustible:"Transporte", subte:"Transporte", sube:"Transporte",
  colectivo:"Transporte", bus:"Transporte", peaje:"Transporte",
  remis:"Transporte", gasoil:"Transporte", estacionamiento:"Transporte",
  tren:"Transporte", bicicleta:"Transporte", bici:"Transporte",
  moto:"Transporte", scooter:"Transporte", patineta:"Transporte",
  shell:"Transporte", ypf:"Transporte", axion:"Transporte",
  petrobras:"Transporte", puma:"Transporte", gnc:"Transporte",
  aeroparque:"Transporte", ezeiza:"Transporte", aeropuerto:"Transporte",
  autopista:"Transporte", autoexpreso:"Transporte", didi:"Transporte",
  patente:"Transporte", seguro:"Transporte", vtv:"Transporte",

  // Ocio
  netflix:"Ocio", spotify:"Ocio", cine:"Ocio", disney:"Ocio",
  hbo:"Ocio", amazon:"Ocio", youtube:"Ocio", steam:"Ocio",
  juego:"Ocio", teatro:"Ocio", concierto:"Ocio", prime:"Ocio",
  paramount:"Ocio", crunchyroll:"Ocio", mubi:"Ocio", flow:"Ocio",
  directv:"Ocio", deezer:"Ocio", xbox:"Ocio", playstation:"Ocio",
  nintendo:"Ocio", twitch:"Ocio", evento:"Ocio", festival:"Ocio",
  recital:"Ocio", bowling:"Ocio", casino:"Ocio", golf:"Ocio",
  paddle:"Ocio", tenis:"Ocio", squash:"Ocio", paintball:"Ocio",

  // Hogar
  alquiler:"Hogar", expensas:"Hogar", luz:"Hogar", gas:"Hogar",
  agua:"Hogar", internet:"Hogar", wifi:"Hogar", cable:"Hogar",
  limpieza:"Hogar", ikea:"Hogar", sodimac:"Hogar", easy:"Hogar",
  pintura:"Hogar", plomero:"Hogar", electricista:"Hogar",
  edesur:"Hogar", edenor:"Hogar", metrogas:"Hogar", aysa:"Hogar",
  fibertel:"Hogar", cablevision:"Hogar", telecentro:"Hogar",
  mueble:"Hogar", colchon:"Hogar", heladera:"Hogar", lavarropas:"Hogar",
  microondas:"Hogar", electrodomestico:"Hogar", detergente:"Hogar",
  lavandina:"Hogar", ferreteria:"Hogar", cerrajero:"Hogar",
  cochera:"Hogar", garaje:"Hogar",

  // Salud
  farmacia:"Salud", medico:"Salud", medicamento:"Salud",
  hospital:"Salud", clinica:"Salud", prepaga:"Salud",
  osde:"Salud", galeno:"Salud", ioma:"Salud", pami:"Salud",
  dentista:"Salud", psicologo:"Salud", kinesiologo:"Salud",
  nutricionista:"Salud", analisis:"Salud", laboratorio:"Salud",
  ecografia:"Salud", vacuna:"Salud", vitaminas:"Salud",
  suplemento:"Salud", proteina:"Salud", creatina:"Salud",
  gym:"Salud", gimnasio:"Salud", yoga:"Salud", pilates:"Salud",
  crossfit:"Salud", running:"Salud",

  // Educación
  curso:"Educación", libro:"Educación", udemy:"Educación",
  coursera:"Educación", escuela:"Educación", facultad:"Educación",
  clase:"Educación", taller:"Educación", universidad:"Educación",
  capacitacion:"Educación", maestria:"Educación", colegio:"Educación",
  matricula:"Educación", guarderia:"Educación", jardin:"Educación",
  platzi:"Educación", domestika:"Educación",

  // Indumentaria
  ropa:"Indumentaria", zapatillas:"Indumentaria", adidas:"Indumentaria",
  nike:"Indumentaria", zara:"Indumentaria", zapatos:"Indumentaria",
  buzo:"Indumentaria", remera:"Indumentaria", pantalon:"Indumentaria",
  vestido:"Indumentaria", camisa:"Indumentaria", pollera:"Indumentaria",
  medias:"Indumentaria", pijama:"Indumentaria", campera:"Indumentaria",
  reebok:"Indumentaria", converse:"Indumentaria", vans:"Indumentaria",
  bolso:"Indumentaria", cartera:"Indumentaria", billetera:"Indumentaria",
  reloj:"Indumentaria", anteojos:"Indumentaria", lentes:"Indumentaria",

  // Trabajo / tech
  coworking:"Trabajo", dominio:"Trabajo", hosting:"Trabajo",
  suscripcion:"Trabajo", software:"Trabajo", papeleria:"Trabajo",
  impresora:"Trabajo", computadora:"Trabajo", notebook:"Trabajo",
  monitor:"Trabajo", teclado:"Trabajo", mouse:"Trabajo",
  auricular:"Trabajo", escritorio:"Trabajo", silla:"Trabajo",
  aws:"Trabajo", github:"Trabajo", notion:"Trabajo", slack:"Trabajo",
  zoom:"Trabajo", figma:"Trabajo", adobe:"Trabajo",
  contador:"Trabajo", monotributo:"Trabajo", afip:"Trabajo",

  // Suscripciones
  membresia:"Suscripción", mensualidad:"Suscripción",
  nordvpn:"Suscripción", dropbox:"Suscripción", icloud:"Suscripción",
  canva:"Suscripción", chatgpt:"Suscripción", openai:"Suscripción",
  claude:"Suscripción", duolingo:"Suscripción",

  // Mascotas
  veterinario:"Mascotas", veterinaria:"Mascotas", vet:"Mascotas",
  perro:"Mascotas", gato:"Mascotas", mascota:"Mascotas",
  purina:"Mascotas", pedigree:"Mascotas", petshop:"Mascotas",

  // Viajes
  hotel:"Viajes", hostel:"Viajes", airbnb:"Viajes", booking:"Viajes",
  despegar:"Viajes", aerolinea:"Viajes", avion:"Viajes",
  latam:"Viajes", jetsmart:"Viajes", flybondi:"Viajes",
  excursion:"Viajes", tour:"Viajes", crucero:"Viajes",
  valija:"Viajes", pasaje:"Viajes", maleta:"Viajes",
};

// ─── Función principal de detección ──────────────────────────────────────────

export interface PurchaseIntent {
  found: boolean;
  txType: "income" | "expense";
  item: string;
  suggestedCategory: string | null;
  amount: number | null;
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function detectPurchaseIntent(normalized: string): PurchaseIntent {
  const notFound: PurchaseIntent = { found: false, txType: "expense", item: "", suggestedCategory: null, amount: null };

  let txType: "income" | "expense" = "expense";
  let rest = normalized;
  let verbFound = false;

  // Check spend verbs first (longer ones first to avoid partial matches)
  const allVerbs = [
    ...SPEND_VERBS.map(v => ({ v: norm(v), type: "expense" as const })),
    ...INCOME_VERBS.map(v => ({ v: norm(v), type: "income" as const })),
  ].sort((a, b) => b.v.length - a.v.length);

  for (const { v, type } of allVerbs) {
    if (normalized.startsWith(v + " ") || normalized === v) {
      txType = type;
      rest = normalized.slice(v.length).trim();
      verbFound = true;
      break;
    }
  }

  if (!verbFound) return notFound;
  if (!rest) return notFound;

  // Remove common filler words after the verb
  rest = rest
    .replace(/^(un|una|unos|unas|el|la|los|las|mi|mis|al|del)\s+/, "")
    .trim();

  // Extract amount if present: "nafta por 8000", "nafta de 5000 pesos", "nafta 8000"
  let amount: number | null = null;
  const amtMatch = rest.match(/(?:por|de|a|x|\s)\s*(\d[\d.,]*)\s*(?:pesos?|ars|usd|eur|uyu)?/i);
  if (amtMatch) {
    const parsed = parseFloat(amtMatch[1].replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
      // Clean amount from item description
      rest = rest.replace(amtMatch[0], "").trim();
    }
  }
  // Also check standalone number at end: "milanesa 1500"
  if (amount === null) {
    const trailNum = rest.match(/\s(\d[\d.,]+)$/);
    if (trailNum) {
      const parsed = parseFloat(trailNum[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        rest = rest.slice(0, rest.length - trailNum[0].length).trim();
      }
    }
  }

  const item = rest || normalized;

  // Find category by checking each word in the item against the keyword map
  let suggestedCategory: string | null = null;
  const words = item.split(/\s+/);
  for (const word of words) {
    const w = norm(word);
    if (KEYWORD_TO_CATEGORY[w]) {
      suggestedCategory = KEYWORD_TO_CATEGORY[w];
      break;
    }
  }
  // Also check multi-word matches (2-word combos)
  if (!suggestedCategory) {
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = norm(words[i] + " " + words[i + 1]);
      if (KEYWORD_TO_CATEGORY[bigram]) {
        suggestedCategory = KEYWORD_TO_CATEGORY[bigram];
        break;
      }
    }
  }

  return { found: true, txType, item, suggestedCategory, amount };
}
