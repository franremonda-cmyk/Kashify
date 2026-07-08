// ─── Verbos de acción ────────────────────────────────────────────────────────

export const SPEND_VERBS = [
  // Compra directa
  "compre", "comprar", "compré",
  // Pago
  "pague", "pagar", "pagué", "le pague", "le pagué",
  // Gasto
  "gaste", "gastar", "gasté", "me gaste", "me gasté", "gaste en", "gasté en",
  // Salida / costo
  "sali", "salir", "salí", "me salio", "me salió", "me costo", "me costó", "costo", "costó", "cuesta",
  // Fui
  "fui a", "fui al", "fui",
  // Consumo / pedido
  "tome", "tomé", "pedi", "pedí", "comi", "comí", "cene", "cené", "desayune", "desayuné",
  "almorce", "almorcé",
  // Combustible
  "cargue", "cargué", "llene", "llené",
  // Consumo general
  "consumi", "consumí",
  // Contratación
  "contraté", "contrate", "contratar",
  // Renovación
  "renove", "renovar", "renové",
  // Abono
  "abono", "abone", "aboné",
  // Invitación
  "invite", "invité", "invitar",
  // Sacar / retirar (gasto)
  "saque", "saqué", "sacar",
  // Me debitaron / cobraron
  "me debitan", "me debitaron", "me cobran", "me cobraron",
  // Me cayó / me cargaron
  "me cayo", "me cayó", "me cargo", "me cargaron",
  // Adquirir
  "adquiri", "adquirí", "adquirir",
  // Conseguir
  "consegui", "conseguí", "conseguir",
  // Traer
  "traje", "traer",
  // Dar / donar
  "di", "le di", "done", "doné", "donar", "aporte", "aporté",
  // Usar / utilizar
  "use", "usé", "usar", "utilice", "utilicé", "utilizar",
  // Reservar
  "reserve", "reservé", "reservar",
  // Suscribir
  "me suscribi", "me suscribí",
  // Arrancar (coloquial)
  "arranque", "arranqué",
  // Puse (coloquial para pagar)
  "puse",
  // Jerga argentina de gasto
  "me clavaron", "me clavo", "me clavó",
  "me mande", "me mandé",
  "tire", "tiré",
  "banque", "banqué",
  "fie", "fié", "saque fiado", "saqué fiado",
  "lo puse yo", "puse yo",
  "me sale", "me salen",
];

export const INCOME_VERBS = [
  // Cobrar
  "cobre", "cobré", "cobrar", "cobré de",
  // Recibir
  "recibi", "recibí", "recibir",
  // Me pagaron / depositaron
  "me pagaron", "me deposito", "me depositó", "me transfirieron",
  // Me dieron / me regalaron
  "me dieron", "me dio",
  "me regalaron", "me regalo", "me regaló",
  "me prestaron", "me presto", "me prestó",
  // Entró
  "entre", "entré", "entro plata", "entró plata", "me entraron",
  // Gané / vendí / facturé
  "gane", "gané", "ganar",
  "me acreditaron",
  "vendí", "vendi",
  "facture", "facturé",
  // Deposité / transferí
  "deposite", "deposité", "depositar",
  "transfiero", "transferi", "transferí", "transferir",
  // Me llegó
  "me llego", "me llegó",
  // Liquidé / junte
  "liquide", "liquidé", "liquidar",
  "junte", "junté", "juntar",
  // Saqué del banco
  "saque del banco", "saqué del banco",
  // Retiré
  "retiro", "retiré", "retire",
  // Ingresé
  "ingrese", "ingresé",
  // Me cobré
  "me deposito el", "me depositó el",
  // Jerga argentina de ingreso
  "me bancaron", "me banco", "me bancó",
  "me devolvieron", "me devolvio", "me devolvió",
  "me fiaron",
  "cobre la jubilacion", "cobré la jubilación",
  "me llego la beca", "me llegó la beca",
  "me pagaron la changa", "cobre la changa", "cobré la changa",
  "hice una changa",
];

// ─── keyword → categoría ──────────────────────────────────────────────────────

export const KEYWORD_TO_CATEGORY: Record<string, string> = {
  // ── Comida ────────────────────────────────────────────────────────────────
  // Comidas preparadas
  almuerzo:"Comida", cena:"Comida", desayuno:"Comida", pizza:"Comida",
  sushi:"Comida", resto:"Comida", restaurant:"Comida", restaurante:"Comida", comida:"Comida",
  cafe:"Comida", rappi:"Comida", pedidos:"Comida", pedidosya:"Comida",
  glovo:"Comida", ifood:"Comida",
  mcdo:"Comida", mcdonald:"Comida", mcdonalds:"Comida",
  burger:"Comida", burgerking:"Comida",
  wendys:"Comida", subway:"Comida", kfc:"Comida",
  dominos:"Comida", papajohns:"Comida",
  empanada:"Comida", empanadas:"Comida",
  taco:"Comida", tacos:"Comida",
  medialunas:"Comida", kiosco:"Comida", kiosko:"Comida",
  sandwich:"Comida", ensalada:"Comida",
  milanesa:"Comida", milanesas:"Comida",
  asado:"Comida", parrilla:"Comida", bodegon:"Comida",
  delivery:"Comida",
  starbucks:"Comida", cafeteria:"Comida", panaderia:"Comida", pasteleria:"Comida",
  heladeria:"Comida", helado:"Comida", helados:"Comida", chocolateria:"Comida",
  soda:"Comida", jugo:"Comida", cerveza:"Comida", vino:"Comida",
  bar:"Comida", aperitivo:"Comida", mate:"Comida", yerba:"Comida",
  mercado:"Comida", verduleria:"Comida", carniceria:"Comida", polleria:"Comida",
  pescaderia:"Comida", super:"Comida", supermercado:"Comida",
  ramen:"Comida", fideos:"Comida", pasta:"Comida",
  lomito:"Comida", hamburguesa:"Comida",
  pochoclos:"Comida", pancho:"Comida",
  choripan:"Comida", bondiola:"Comida", bife:"Comida", costilla:"Comida",
  // Supermercados argentinos
  jumbo:"Comida", coto:"Comida", carrefour:"Comida", dia:"Comida",
  disco:"Comida", vea:"Comida", walmart:"Comida", lidl:"Comida",
  anonima:"Comida", changomas:"Comida", bernat:"Comida", tia:"Comida",
  // Panadería / cafetería
  croissant:"Comida", tostadas:"Comida", factura:"Comida", facturas:"Comida",
  alfajor:"Comida", alfajores:"Comida", galletitas:"Comida",
  // Almacén
  arroz:"Comida", aceite:"Comida", harina:"Comida", azucar:"Comida", sal:"Comida",
  manteca:"Comida", leche:"Comida", yogur:"Comida", yogurt:"Comida",
  queso:"Comida", jamon:"Comida", fiambre:"Comida", salame:"Comida",
  atun:"Comida", sardina:"Comida", mayonesa:"Comida", ketchup:"Comida",
  mostaza:"Comida", mermelada:"Comida", dulce:"Comida",
  // Verdulería / frutería
  fruta:"Comida", verdura:"Comida", papa:"Comida", tomate:"Comida",
  lechuga:"Comida", zanahoria:"Comida", cebolla:"Comida", ajo:"Comida",
  manzana:"Comida", banana:"Comida", naranja:"Comida", limon:"Comida",
  pera:"Comida", durazno:"Comida", ciruela:"Comida", uva:"Comida",
  // Carnicería
  pollo:"Comida", carne:"Comida", nalga:"Comida", peceto:"Comida",
  molida:"Comida", churrasco:"Comida", lomo:"Comida", vacio:"Comida",
  cerdo:"Comida", chorizo:"Comida", salchicha:"Comida",
  // Bebidas
  gaseosa:"Comida", coca:"Comida", pepsi:"Comida", fanta:"Comida",
  sprite:"Comida",
  // Lácteos
  mantequilla:"Comida", crema:"Comida", ricota:"Comida", muzarella:"Comida",
  // Jerga / bebida argentina
  birra:"Comida", birras:"Comida", chela:"Comida", chelas:"Comida",
  fernet:"Comida", vermut:"Comida", picada:"Comida", milanga:"Comida", mila:"Comida",
  tostado:"Comida", submarino:"Comida", criollos:"Comida", bizcochos:"Comida",
  escabio:"Comida", facu:"Comida", lagrimita:"Comida",

  // ── Transporte ────────────────────────────────────────────────────────────
  uber:"Transporte", cabify:"Transporte", taxi:"Transporte", didi:"Transporte",
  nafta:"Transporte", combustible:"Transporte", naftera:"Transporte",
  subte:"Transporte", sube:"Transporte", colectivo:"Transporte", bus:"Transporte",
  peaje:"Transporte", remis:"Transporte", gasoil:"Transporte",
  estacionamiento:"Transporte", tren:"Transporte",
  bicicleta:"Transporte", bici:"Transporte", moto:"Transporte",
  scooter:"Transporte", patineta:"Transporte",
  shell:"Transporte", ypf:"Transporte", axion:"Transporte",
  petrobras:"Transporte", puma:"Transporte", gnc:"Transporte",
  aeroparque:"Transporte", ezeiza:"Transporte", aeropuerto:"Transporte",
  autopista:"Transporte", autoexpreso:"Transporte",
  patente:"Transporte", seguro:"Transporte", vtv:"Transporte",
  // Mecánica / repuestos
  mecanico:"Transporte", neumatico:"Transporte", goma:"Transporte",
  repuesto:"Transporte", bateria:"Transporte", lavadero:"Transporte",
  trapito:"Transporte", grua:"Transporte",

  // ── Ocio ─────────────────────────────────────────────────────────────────
  netflix:"Ocio", spotify:"Ocio", cine:"Ocio", disney:"Ocio",
  hbo:"Ocio", amazon:"Ocio", youtube:"Ocio", steam:"Ocio",
  juego:"Ocio", teatro:"Ocio", concierto:"Ocio", prime:"Ocio",
  paramount:"Ocio", crunchyroll:"Ocio", mubi:"Ocio", flow:"Ocio",
  directv:"Ocio", deezer:"Ocio", xbox:"Ocio", playstation:"Ocio",
  nintendo:"Ocio", twitch:"Ocio", evento:"Ocio", festival:"Ocio",
  recital:"Ocio", bowling:"Ocio", casino:"Ocio", golf:"Ocio",
  paddle:"Ocio", tenis:"Ocio", squash:"Ocio", paintball:"Ocio",
  max:"Ocio", vix:"Ocio", pluto:"Ocio",

  // ── Hogar ─────────────────────────────────────────────────────────────────
  alquiler:"Hogar", expensas:"Hogar", consorcio:"Hogar",
  luz:"Hogar", gas:"Hogar", internet:"Hogar", wifi:"Hogar", cable:"Hogar",
  limpieza:"Hogar", ikea:"Hogar", sodimac:"Hogar", easy:"Hogar",
  pintura:"Hogar", plomero:"Hogar", electricista:"Hogar", gasista:"Hogar",
  carpintero:"Hogar", pintor:"Hogar", portero:"Hogar",
  edesur:"Hogar", edenor:"Hogar", metrogas:"Hogar", aysa:"Hogar",
  fibertel:"Hogar", cablevision:"Hogar", telecentro:"Hogar",
  naturgy:"Hogar", camuzzi:"Hogar", abl:"Hogar", rentas:"Hogar",
  municipalidad:"Hogar", personal:"Hogar", claro:"Hogar", movistar:"Hogar",
  tuenti:"Hogar", recarga:"Hogar",
  mueble:"Hogar", colchon:"Hogar", heladera:"Hogar", lavarropas:"Hogar",
  microondas:"Hogar", electrodomestico:"Hogar",
  detergente:"Hogar", lavandina:"Hogar",
  ferreteria:"Hogar", cerrajero:"Hogar",
  cochera:"Hogar", garaje:"Hogar",
  reparacion:"Hogar", arreglo:"Hogar",
  obra:"Hogar", refaccion:"Hogar", construccion:"Hogar",
  ceramica:"Hogar", porcelanato:"Hogar",

  // ── Salud ─────────────────────────────────────────────────────────────────
  farmacia:"Salud", medico:"Salud", medicamento:"Salud",
  hospital:"Salud", clinica:"Salud", prepaga:"Salud",
  osde:"Salud", galeno:"Salud", ioma:"Salud", pami:"Salud",
  farmacity:"Salud", "swiss medical":"Salud", medicus:"Salud", omint:"Salud",
  "sancor salud":"Salud", "obra social":"Salud",
  dentista:"Salud", odontologo:"Salud",
  psicologo:"Salud", kinesiologo:"Salud", nutricionista:"Salud",
  oftalmologo:"Salud", dermatologo:"Salud", cardiologo:"Salud",
  traumatologo:"Salud", pediatra:"Salud", ginecologo:"Salud",
  fonoaudiologo:"Salud", fisiatra:"Salud",
  analisis:"Salud", laboratorio:"Salud", ecografia:"Salud",
  radiografia:"Salud", resonancia:"Salud", estudios:"Salud",
  vacuna:"Salud", turno:"Salud",
  vitaminas:"Salud", suplemento:"Salud", proteina:"Salud", creatina:"Salud",
  ibuprofeno:"Salud", paracetamol:"Salud", aspirina:"Salud",
  gym:"Salud", gimnasio:"Salud", yoga:"Salud", pilates:"Salud",
  crossfit:"Salud", running:"Salud",

  // ── Educación ─────────────────────────────────────────────────────────────
  curso:"Educación", libro:"Educación", udemy:"Educación",
  coursera:"Educación", escuela:"Educación", facultad:"Educación",
  clase:"Educación", taller:"Educación", universidad:"Educación",
  capacitacion:"Educación", maestria:"Educación", colegio:"Educación",
  matricula:"Educación", guarderia:"Educación", jardin:"Educación",
  platzi:"Educación", domestika:"Educación",
  ingles:"Educación", idioma:"Educación", academia:"Educación",
  repaso:"Educación", tutor:"Educación", examen:"Educación",
  inscripcion:"Educación",

  // ── Indumentaria ──────────────────────────────────────────────────────────
  ropa:"Indumentaria", zapatillas:"Indumentaria",
  adidas:"Indumentaria", nike:"Indumentaria", zara:"Indumentaria",
  zapatos:"Indumentaria", buzo:"Indumentaria", remera:"Indumentaria",
  pantalon:"Indumentaria", vestido:"Indumentaria", camisa:"Indumentaria",
  pollera:"Indumentaria", medias:"Indumentaria", pijama:"Indumentaria",
  campera:"Indumentaria", reebok:"Indumentaria", converse:"Indumentaria",
  vans:"Indumentaria", bolso:"Indumentaria", cartera:"Indumentaria",
  billetera:"Indumentaria", reloj:"Indumentaria", anteojos:"Indumentaria",
  lentes:"Indumentaria",

  // ── Trabajo / Tech ────────────────────────────────────────────────────────
  coworking:"Trabajo", dominio:"Trabajo", hosting:"Trabajo",
  suscripcion:"Trabajo", software:"Trabajo", papeleria:"Trabajo",
  impresora:"Trabajo", computadora:"Trabajo", notebook:"Trabajo",
  monitor:"Trabajo", teclado:"Trabajo", mouse:"Trabajo",
  auricular:"Trabajo", escritorio:"Trabajo", silla:"Trabajo",
  aws:"Trabajo", github:"Trabajo", notion:"Trabajo", slack:"Trabajo",
  zoom:"Trabajo", figma:"Trabajo", adobe:"Trabajo",
  contador:"Trabajo", monotributo:"Trabajo", afip:"Trabajo",
  vercel:"Trabajo", railway:"Trabajo", digitalocean:"Trabajo",
  render:"Trabajo", supabase:"Trabajo",
  linear:"Trabajo", jira:"Trabajo", confluence:"Trabajo",
  loom:"Trabajo", miro:"Trabajo", airtable:"Trabajo",

  // ── Suscripciones ─────────────────────────────────────────────────────────
  membresia:"Suscripción", mensualidad:"Suscripción",
  nordvpn:"Suscripción", dropbox:"Suscripción", icloud:"Suscripción",
  canva:"Suscripción", chatgpt:"Suscripción", openai:"Suscripción",
  anthropic:"Suscripción", claude:"Suscripción", duolingo:"Suscripción",
  apple:"Suscripción", appletv:"Suscripción", arcade:"Suscripción",

  // ── Mascotas ──────────────────────────────────────────────────────────────
  veterinario:"Mascotas", veterinaria:"Mascotas", vet:"Mascotas",
  perro:"Mascotas", gato:"Mascotas", mascota:"Mascotas",
  purina:"Mascotas", pedigree:"Mascotas", petshop:"Mascotas",
  arena:"Mascotas", alimento:"Mascotas",
  collar:"Mascotas", correa:"Mascotas", jaula:"Mascotas",
  acuario:"Mascotas", pez:"Mascotas", hamster:"Mascotas", pajaro:"Mascotas",

  // ── Viajes ────────────────────────────────────────────────────────────────
  hotel:"Viajes", hostel:"Viajes", airbnb:"Viajes", booking:"Viajes",
  despegar:"Viajes", aerolinea:"Viajes", avion:"Viajes",
  latam:"Viajes", jetsmart:"Viajes", flybondi:"Viajes",
  excursion:"Viajes", tour:"Viajes", crucero:"Viajes",
  valija:"Viajes", pasaje:"Viajes", maleta:"Viajes",
  renta:"Viajes", transfer:"Viajes",
  balneario:"Viajes", camping:"Viajes", glamping:"Viajes",
  surf:"Viajes",

  // ── Regalos / Celebraciones ───────────────────────────────────────────────
  regalo:"Regalos", cumple:"Regalos", casamiento:"Regalos",
  boda:"Regalos", flores:"Regalos", torta:"Regalos",
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

// Infer a category from free text (no verb required). Scans words + bigrams.
export function categoryForText(text: string): string | null {
  const words = norm(text).split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (KEYWORD_TO_CATEGORY[word]) return KEYWORD_TO_CATEGORY[word];
  }
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + " " + words[i + 1];
    if (KEYWORD_TO_CATEGORY[bigram]) return KEYWORD_TO_CATEGORY[bigram];
  }
  return null;
}

export function detectPurchaseIntent(normalized: string): PurchaseIntent {
  const notFound: PurchaseIntent = { found: false, txType: "expense", item: "", suggestedCategory: null, amount: null };

  let txType: "income" | "expense" = "expense";
  let rest = normalized;
  let verbFound = false;

  // Combine verbs, sort longest first to avoid partial matches
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
    .replace(/^(un|una|unos|unas|el|la|los|las|mi|mis|al|del|este|esta|ese|esa)\s+/, "")
    .trim();

  // Extract amount — try multiple patterns in order
  let amount: number | null = null;

  // 1. Number at very start of rest, con moneda opcional antes o después:
  //    "gaste 10" → "10"; "recibi 500" → "500"; "usd 500 hosting" → "500"
  //    (normalize ya convirtió "u$s"→"usd" y sacó el "$").
  const leadNum = rest.match(/^(?:pesos?|ars|usd|eur|uyu)?\s*(\d[\d.,]*)\s*(?:pesos?|ars|usd|eur|uyu)?(?:\s|$)/i);
  if (leadNum) {
    const parsed = parseFloat(leadNum[1].replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
      rest = rest.slice(leadNum[0].length).trim();
    }
  }

  // 2. Number after preposition: "nafta por 8000", "nafta de 5000 pesos"
  if (amount === null) {
    const amtMatch = rest.match(/(?:por|de|a|x)\s+(\d[\d.,]*)\s*(?:pesos?|ars|usd|eur|uyu)?/i);
    if (amtMatch) {
      const parsed = parseFloat(amtMatch[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        rest = rest.replace(amtMatch[0], "").trim();
      }
    }
  }

  // 3. Standalone number at end: "milanesa 1500"
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

  // IMPORTANT: do NOT fall back to the whole message. If only verb+amount was
  // given ("gasté 20"), item stays empty so the caller asks "¿en qué?" instead
  // of assuming a description.
  // Strip a leading preposition left over after the amount ("en almuerzo" → "almuerzo").
  const item = rest.replace(/^(en|de|del|por|para|a|al)\s+/, "").trim();

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
