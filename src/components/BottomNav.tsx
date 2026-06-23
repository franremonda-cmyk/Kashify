"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Fuse from "fuse.js";
import CategoryModal from "@/components/CategoryModal";
import { useIconStyle } from "@/context/IconStyleContext";

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "PYG", "BOB", "COP", "PEN", "GBP"];

interface Category { id: string; name: string; icon: string; }

// ─── A: Keyword map ───────────────────────────────────────────────────────────
const KEYWORD_MAP: Record<string, string[]> = {
  "Comida": [
    "almuerzo","cena","desayuno","pizza","sushi","resto","restaurant","comida","café","cafe",
    "rappi","pedidos","mcdo","burger","empanada","taco","medialunas","facturas","kiosco","kiosko","kioskero",
    "sandwich","ensalada","milanesa","asado","parrilla","bodegon","delivery","mcdonald","burguer king",
    "wendys","subway","starbucks","cafeteria","panaderia","pasteleria","heladeria","chocolateria",
    "soda","agua mineral","jugo","cerveza","vino","bar ","boliche","aperitivo","mate","yerba",
    "mercado","feria","verduleria","carniceria","polleria","pescaderia","super","superm",
    "nutricion","vegano","vegetariano","ramen","wok","fideos","pasta","lomito","hamburguer","tenedor",
  ],
  "Transporte": [
    "uber","cabify","taxi","nafta","combustible","subte","sube","colectivo","bus","peaje",
    "remis","gasoil","estacionamiento","tren","bicicleta","bici","moto","scooter","patineta",
    "shell","ypf","axion","petrobras","puma","esso","serviclub","autoexpreso","autopista",
    "gnc","aeroparque","ezeiza","aeropuerto","vuelo","lkbus","plataforma","omnilineas",
    "flecha","andesmar","via bariloche","coche","auto","seguro auto","patente","vehiculo",
    "lyft","didi","bemo","acercapp","turismo","transfer","shuttle",
    "rent a car","alquiler auto","alquiler de auto","metrobus","metrobús",
  ],
  "Ocio": [
    "netflix","spotify","cine","disney","hbo","amazon","youtube","steam","juego","teatro",
    "concierto","prime","apple tv","paramount","crunchyroll","mubi","flow","directv",
    "deezer","tidal","apple music","xbox","playstation","ps5","nintendo","switch",
    "twitch","kick","evento","festival","show","recital","espectaculo","circo","stand up",
    "bowling","laser","paintball","escape room","karting","go kart","arcade",
    "museo","exposicion","galeria","zoo","aquarium","parque","parque de diversiones",
    "tragamonedas","casino","apostas","bet","tennis","golf","paddle","squash",
  ],
  "Hogar": [
    "alquiler","expensas","luz","gas","agua","internet","wifi","cable","supermercado",
    "limpieza","jumbo","coto","carrefour","dia","ikea","sodimac","easy","homecenter",
    "pintura","plomero","electricista","gas natural","edesur","edenor","metrogas","aysa",
    "fibertel","cablevision","claro hogar","telecentro","arnet","personal hogar",
    "mueble","colchon","sillon","heladera","lavarropas","microondas","electrodomestico",
    "almohada","sabanas","toalla","detergente","lavandina","limpiador","escoba","trapeador",
    "portero","vigilancia","condominio","administracion","servicios","mantenimiento",
    "jardineria","planta","semilla","herramienta","ferreteria","cerrajero",
    "cochera","garaje","telefono","linea telefonica","streaming",
  ],
  "Salud": [
    "farmacia","médico","medico","medicamento","hospital","clínica","clinica","prepaga",
    "osde","swiss medical","galeno","medicus","hominis","omint","ioma","pami",
    "dentista","odontologia","psicologo","psicologa","psiquiatra","kinesiologo","nutricionista",
    "ginecologia","pediatria","cardiologia","dermatologia","oftalmologia","otorrinolaringologo",
    "analisis","laboratorio","radiografia","ecografia","resonancia","tomografia",
    "vacuna","inyeccion","operacion","internacion","urgencias","emergencia",
    "vitaminas","suplemento","proteina","creatina","omega","colesterol","presion",
    "gym","gimnasio","yoga","pilates","crossfit","running","actividad fisica","deporte",
  ],
  "Educación": [
    "curso","libro","udemy","coursera","escuela","facultad","clase","taller","universidad",
    "capacitacion","capacitación","maestria","doctorado","posgrado","grado","secundaria",
    "primaria","colegio","matricula","arancel","cuota colegio","guarderia","jardin",
    "educacion online","platzi","domestika","skillshare","linkedin learning","google",
    "material escolar","carpeta","cuaderno","lapiz","lapicera","regla","mochila",
    "examen","certificacion","cambridge","toefl","ielts","idiomas","ingles","frances",
    "piano","guitarra","canto","pintura","dibujo","arte","musica","danza","teatro",
  ],
  "Indumentaria": [
    "ropa","zapatillas","adidas","nike","zara","zapatos","buzo","remera","pantalon",
    "vestido","camisa","pollera","medias","ropa interior","pijama","traje","saco",
    "h&m","forever21","pull and bear","bershka","stradivarius","mango","topshop",
    "puma","reebok","new balance","converse","vans","timberland","dr martens",
    "bolso","cartera","billetera","cinturon","sombrero","gorra","bufanda","guantes",
    "joyeria","reloj","anteojos","lentes","bijou","aro","collar","pulsera","anillo",
    "lenceria","traje de bano","bikini","ropa deportiva","calza","shorts","campera",
  ],
  "Trabajo": [
    "coworking","oficina","dominio","hosting","suscripcion","software","papeleria",
    "tinta","impresora","computadora","notebook","monitor","teclado","mouse","camara",
    "microfono","auricular","escritorio","silla","ergonomia","ups","disco rigido","ssd",
    "aws","google cloud","azure","github","notion","slack","zoom","figma","adobe",
    "contador","estudio contable","sellado","ingresos brutos","monotributo","afip",
    "abogado","escribano","tramite","legalizacion","apostilla","traduccion",
    "marketing","publicidad","instagram ads","facebook ads","google ads","flyer",
    "hosting","dominio","vps","servidor","email corporativo","gsuite","microsoft 365",
    "factura","impuesto","sello","timbrado","impuestos","arca","rentas","municipalidad",
  ],
  "Suscripción": [
    "suscripcion","suscripción","subscripcion","subscripción","membresia","mensualidad",
    "plan mensual","plan anual","renovacion","auto renovacion","trial","free trial",
    "antivirus","vpn","nordvpn","expressvpn","dropbox","icloud","google one","onedrive",
    "canva","figma pro","notion pro","obsidian","todoist","things","bear","craft",
    "duolingo","babble","rosetta stone","pimsleur",
    "chatgpt","openai","claude","anthropic","apple one","apple storage","microsoft 365 personal",
  ],
  "Mascotas": [
    "veterinario","veterinaria","vet","perro","gato","mascota","hamster","conejo",
    "comida perro","comida gato","purina","pedigree","whiskas","royal canin","eukanuba",
    "accesorios mascota","collar","correa","juguete mascota","antiparasitario","vacuna mascota",
    "peluqueria canina","bano mascota","hotel mascota","guarderia mascota","petshop","pet shop",
  ],
  "Viajes": [
    "hotel","hostel","airbnb","booking","despegar","aerolinea","vuelo","avion",
    "aerolinas","latam","jetsmart","flybondi","american","united","lufthansa",
    "turismo","agencia","excursion","tour","crucero","ferry","barco","tren largo",
    "valija","mochila viaje","adaptador","seguro viaje","visa","pasaporte","tramite migratorio",
    "cambiaria","casa de cambio","dolar viaje","euro viaje","dolares",
    "pasaje","maleta","bolso viaje","equipaje","check in","embarque",
  ],
  "Ahorros e Inversiones": [
    "plazo fijo","fci","fondo comun","bono","accion","cripto","bitcoin","ethereum","usdt",
    "binance","lemon","belo","buenbit","ripio","bitso","coinbase","kraken",
    "inversion","ahorro","deposito","retiro","transferencia","envio",
    "cuenta bancaria","tarjeta","banco","bbva","santander","galicia","macro","nacion",
    "mercadopago","naranja","uala","brubank","bnext","wise","payoneer","paypal",
  ],
};

// ─── A: Concept→category name aliases ────────────────────────────────────────
const CONCEPT_NAME_ALIASES: Record<string, string[]> = {
  "Comida":                ["comida","aliment","comer","comest","gastro","cocin","restaur","mercado","super","feria","compras","viveres","diario","provisiones"],
  "Transporte":            ["transport","movil","vehicul","traslad","movilidad","auto","moto","combusti"],
  "Ocio":                  ["ocio","entretenim","diversi","recreac","esparcim","juego","deport","hobby","tiempo libre","placer","cultura","arte"],
  "Hogar":                 ["hogar","casa","viviend","domest","expens","alquil","renta","propiedad","servicio","mantenimi"],
  "Salud":                 ["salud","medic","sanit","clinic","farmac","bienestar","cuida","higiene","belleza"],
  "Educación":             ["educac","aprendiz","estudio","escuel","formac","univers","capacit","curso","colegio"],
  "Indumentaria":          ["indum","ropa","vestim","moda","calzad","accesorio","textil"],
  "Trabajo":               ["trabajo","laboral","ofic","profesion","negoc","empresa","freelance"],
  "Suscripción":           ["suscripc","subscripc","membres","plan","membresia","recurrente","mensual"],
  "Mascotas":              ["mascot","veterin","animal","perro","gato","mascota"],
  "Viajes":                ["viaj","turism","vacac","trip","aventura","exterior","excursion"],
  "Ahorros e Inversiones": ["ahorro","inversion","financ","banco","cripto","capital","fondo","plazo"],
};

// ─── B: Fuse.js fuzzy index (built once at module level) ─────────────────────
interface KwEntry { keyword: string; concept: string; }
const KW_INDEX: KwEntry[] = [];
for (const [concept, kws] of Object.entries(KEYWORD_MAP)) {
  for (const kw of kws) KW_INDEX.push({ keyword: kw, concept });
}
const fuse = new Fuse(KW_INDEX, {
  keys: ["keyword"],
  threshold: 0.25,   // 0 = exact, 1 = anything — 0.25 catches 1-2 char typos
  includeScore: true,
  minMatchCharLength: 3,
});

// ─── C: localStorage learned associations ────────────────────────────────────
const LEARNED_KEY = "kashify_cat_learned";
const STOP = new Set(["el","la","los","las","un","una","de","del","en","con","para","por","que","y","o","a","al","lo","se","me","mi","su","tu"]);

function loadLearned(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LEARNED_KEY) ?? "{}"); } catch { return {}; }
}

export function saveCorrection(description: string, categoryId: string) {
  if (!description || !categoryId) return;
  const learned = loadLearned();
  // Save full phrase
  learned[description.toLowerCase().trim()] = categoryId;
  // Save each significant word
  description.toLowerCase().split(/[\s,.\-/]+/).forEach(w => {
    if (w.length >= 3 && !STOP.has(w)) learned[w] = categoryId;
  });
  localStorage.setItem(LEARNED_KEY, JSON.stringify(learned));
}

function guessFromLearned(description: string, validIds: Set<string>): string {
  const learned = loadLearned();
  // Full phrase match first
  const full = learned[description.toLowerCase().trim()];
  if (full && validIds.has(full)) return full;
  // Word-by-word scoring
  const scores: Record<string, number> = {};
  description.toLowerCase().split(/[\s,.\-/]+/).forEach(w => {
    if (w.length < 3 || STOP.has(w)) return;
    const id = learned[w];
    if (id && validIds.has(id)) scores[id] = (scores[id] ?? 0) + 1;
  });
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "";
}

// ─── Concept → user category matching ────────────────────────────────────────
function findCategoryForConcept(concept: string, categories: Category[]): string {
  const aliases = CONCEPT_NAME_ALIASES[concept] ?? [concept.toLowerCase()];
  const m = categories.find(c => {
    const cn = c.name.toLowerCase();
    return cn === concept.toLowerCase() ||
      cn.includes(concept.toLowerCase()) ||
      concept.toLowerCase().includes(cn) ||
      aliases.some(a => cn.includes(a) || cn.startsWith(a.slice(0, 5)));
  });
  return m?.id ?? "";
}

// ─── Main guesser: C → exact keywords → B fuzzy ──────────────────────────────
function guessCategory(description: string, categories: Category[]): string {
  const validIds = new Set(categories.map(c => c.id));
  const lower = description.toLowerCase();

  // C: learned associations first
  const learned = guessFromLearned(description, validIds);
  if (learned) return learned;

  // A: exact substring keyword match
  for (const [concept, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const id = findCategoryForConcept(concept, categories);
      if (id) return id;
    }
  }

  // B: fuzzy match word-by-word with Fuse
  const words = lower.split(/[\s,.\-/]+/).filter(w => w.length >= 3 && !STOP.has(w));
  const conceptScores: Record<string, number> = {};
  for (const word of words) {
    const results = fuse.search(word, { limit: 3 });
    for (const r of results) {
      const score = 1 - (r.score ?? 1);
      conceptScores[r.item.concept] = (conceptScores[r.item.concept] ?? 0) + score;
    }
  }
  const bestConcept = Object.entries(conceptScores).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (bestConcept) {
    const id = findCategoryForConcept(bestConcept, categories);
    if (id) return id;
  }

  return "";
}

function QuickAddModal({ onClose, onSaved, initialType = "expense" }: { onClose: () => void; onSaved: () => void; initialType?: "expense" | "income" }) {
  const { iconStyle } = useIconStyle();
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [form, setForm] = useState({
    type: initialType as "expense" | "income",
    description: "",
    amount: "",
    currency_code: "ARS",
    category_id: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  // Auto-categorize on description change
  function handleDescriptionChange(val: string) {
    setForm((f) => ({ ...f, description: val }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (categories.length > 0) {
        const guessed = guessCategory(val, categories);
        if (guessed) {
          // Auto-apply unless user already manually picked
          setForm((f) => ({ ...f, category_id: f.category_id || guessed }));
          setSuggestion(guessed);
        } else {
          setSuggestion(null);
        }
      }
    }, 400);
  }

  const suggestedCat = suggestion ? categories.find((c) => c.id === suggestion) : null;
  const selectedCatName = form.category_id
    ? categories.find((c) => c.id === form.category_id)?.name
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount) {
      setError("Completá descripción y monto");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        category_id: form.category_id || null,  // never send empty string
      }),
    });
    if (res.ok) {
      window.dispatchEvent(new Event("transaction-added"));
      onSaved();
      onClose();
    } else { setError("Error al guardar"); setSaving(false); }
  }

  const inp: React.CSSProperties = {
    background: "var(--raised)",
    border: "0.5px solid var(--glass-border)",
    borderRadius: 12,
    padding: "11px 14px",
    color: "var(--ink)",
    fontSize: 15,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    outline: "none",
    display: "block",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm p-5 flex flex-col gap-4 mb-16 scale-up"
        style={{
          borderRadius: 24,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(48px) saturate(260%)",
          border: "0.5px solid var(--glass-border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 24px 80px rgba(0,0,0,0.80)",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="display font-semibold text-base" style={{ color: "var(--ink)" }}>
            Registrar
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--raised)",
              border: "0.5px solid var(--glass-border)",
              color: "var(--ink-muted)", fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3" style={{ width: "100%" }}>
          {/* Tipo */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--raised)" }}>
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: form.type === t
                    ? t === "expense" ? "rgba(255,59,48,0.10)" : "rgba(52,199,89,0.10)"
                    : "transparent",
                  color: form.type === t
                    ? t === "expense" ? "var(--negative)" : "var(--positive)"
                    : "var(--ink-muted)",
                }}
              >
                {t === "expense" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>

          {/* Descripción */}
          <div>
            <input
              style={inp}
              placeholder={form.type === "expense" ? "¿En qué gastaste?" : "¿Qué te ingresó?"}
              aria-label={form.type === "expense" ? "Descripción del gasto" : "Descripción del ingreso"}
              value={form.description}
              autoFocus
              onChange={(e) => handleDescriptionChange(e.target.value)}
            />
            {/* Neo auto-eligió */}
            {suggestedCat && form.category_id === suggestion && (
              <div className="flex items-center gap-1.5 mt-1.5 px-1" style={{ fontSize: 13 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--accent)", flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9"/><path d="M9 8v8M15 8v8"/>
                </svg>
                <span style={{ color: "var(--ink-dim)" }}>Neo eligió</span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{suggestedCat.name}</span>
                <span style={{ color: "var(--ink-dim)" }}>· podés cambiarlo</span>
              </div>
            )}
          </div>

          {/* Monto + Moneda */}
          <div className="flex gap-2">
            <input
              style={{ ...inp, width: "60%" }}
              placeholder="0.00"
              aria-label="Monto"
              type="number" inputMode="decimal"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <select
              style={{ ...inp, width: "40%" }}
              aria-label="Moneda"
              value={form.currency_code}
              onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Categoría */}
          <div style={{ display: "flex", gap: 6 }}>
            <select
              style={{
                ...inp,
                flex: 1,
                color: form.category_id ? "var(--ink)" : "var(--ink-dim)",
              }}
              value={form.category_id}
              onChange={(e) => {
                const id = e.target.value;
                setForm((f) => ({ ...f, category_id: id }));
                setSuggestion(null);
                // C: save manual correction so next time this description auto-selects this category
                if (id && form.description.trim().length >= 3) saveCorrection(form.description.trim(), id);
              }}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCat(true)}
              title="Nueva categoría"
              style={{ ...inp, width: 42, flexShrink: 0, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", padding: "0" }}
            >+</button>
          </div>

          {/* Fecha */}
          <input
            style={{ ...inp, WebkitAppearance: "none", appearance: "none" } as React.CSSProperties}
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />

          {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "#FFFFFF",
              boxShadow: "0 0 24px var(--accent-glow)",
              fontSize: 15,
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
      {showNewCat && (
        <CategoryModal
          existingColors={categories.map(c => (c as unknown as { color?: string }).color ?? "").filter(Boolean)}
          currentStyle={iconStyle}
          onSave={async (data) => {
            const res = await fetch("/api/categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: data.name, icon: data.icon ?? "", color: data.color ?? "#7B61FF" }),
            });
            if (res.ok) {
              const newCat = await res.json();
              const refreshed = await fetch("/api/categories").then(r => r.json());
              setCategories(Array.isArray(refreshed) ? refreshed : []);
              if (newCat?.id) {
                setForm(f => ({ ...f, category_id: newCat.id }));
                setSuggestion(null);
              }
            }
            setShowNewCat(false);
          }}
          onClose={() => setShowNewCat(false)}
        />
      )}
    </div>
  );
}

const LEFT_NAV = [
  { href: "/dashboard", label: "Inicio",     icon: HomeIcon },
  { href: "/historial", label: "Actividad",  icon: ActivityIcon },
];
const RIGHT_NAV = [
  { href: "/neo",    label: "Neo",    icon: NeoIcon,    badge: true },
  { href: "/perfil", label: "Perfil", icon: UserIcon,   badge: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"expense" | "income">("expense");
  const [neoBadge, setNeoBadge] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pending_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting")
      .then(({ count }) => setNeoBadge(count ?? 0))
      .then(undefined, () => {});
  }, []);

  useEffect(() => {
    function handleOpenQuickAdd(e: Event) {
      const type = (e as CustomEvent<{ type: string }>).detail?.type;
      setQuickAddType(type === "income" ? "income" : "expense");
      setShowAdd(true);
    }
    window.addEventListener("open-quick-add", handleOpenQuickAdd);
    return () => window.removeEventListener("open-quick-add", handleOpenQuickAdd);
  }, []);

  function handleSaved() {
    setShowAdd(false);
    router.refresh();
  }

  return (
    <>
      {showAdd && (
        <QuickAddModal onClose={() => setShowAdd(false)} onSaved={handleSaved} initialType={quickAddType} />
      )}

      <nav
        className="fixed z-40"
        style={{
          bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          left: 16,
          right: 16,
        }}
      >
        <div
          style={{
            maxWidth: 460,
            margin: "0 auto",
            borderRadius: 9999,
            background: "var(--glass-2)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "0.5px solid var(--glass-border)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            alignItems: "center",
            height: 60,
            overflow: "visible",
          }}
        >
          {/* Left items */}
          {LEFT_NAV.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label}
              Icon={item.icon} active={pathname === item.href} />
          ))}

          {/* FAB — center, pops above pill */}
          <button
            onClick={() => setShowAdd(true)}
            aria-label="Registrar"
            style={{
              position: "relative",
              top: -18,
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#04130D",
              border: "3px solid var(--void)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.40)",
              fontSize: 28,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease-out",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            +
          </button>

          {/* Right items */}
          {RIGHT_NAV.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              active={pathname === item.href}
              badge={item.badge ? neoBadge : 0}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavItem({ href, label, Icon, active, badge = 0 }: {
  href: string; label: string;
  Icon: (p: { active: boolean }) => React.ReactNode;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        minHeight: 48,
        color: active ? "var(--accent)" : "var(--ink-muted)",
        textDecoration: "none",
        position: "relative",
      }}
    >
      <div style={{ position: "relative" }}>
        <Icon active={active} />
        {badge > 0 && (
          <span style={{
            position: "absolute",
            top: -4,
            right: -5,
            minWidth: 17,
            height: 17,
            borderRadius: 999,
            background: "var(--negative)",
            border: "1.5px solid var(--base)",
            fontSize: 10,
            fontWeight: 700,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
          }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: "0.01em" }}>{label}</span>
    </Link>
  );
}

// ─── Icons ──────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}

function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function NeoIcon({ active }: { active: boolean }) {
  return (
    <div
      className={`neo-nav-avatar${active ? " neo-avatar-idle" : ""}`}
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: active ? "var(--accent)" : "var(--raised)",
        border: active ? "none" : "1.5px solid var(--ink-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: active ? "0 0 10px var(--accent-glow)" : "none",
        transition: "background 200ms ease, box-shadow 200ms ease",
        flexShrink: 0,
      }}
    >
      <span style={{
        fontSize: 13,
        fontWeight: 800,
        color: active ? "#FFFFFF" : "var(--ink-muted)",
        lineHeight: 1,
        letterSpacing: "-0.5px",
      }}>
        N
      </span>
    </div>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
