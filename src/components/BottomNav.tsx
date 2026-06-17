"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const CURRENCIES = ["ARS", "USD", "EUR", "CHF", "BRL", "UYU", "CLP", "PYG", "BOB", "COP", "PEN", "GBP"];

interface Category { id: string; name: string; icon: string; }

// Keyword-to-category matcher
const KEYWORD_MAP: Record<string, string[]> = {
  "Comida": [
    "almuerzo","cena","desayuno","pizza","sushi","resto","restaurant","comida","café","cafe",
    "rappi","pedidos","mcdo","burger","empanada","taco","medialunas","facturas","kiosco","kioskero",
    "sandwich","ensalada","milanesa","asado","parrilla","bodegon","delivery","mcdonald","burguer king",
    "wendys","subway","starbucks","cafeteria","panaderia","pasteleria","heladeria","chocolateria",
    "soda","agua mineral","jugo","cerveza","vino","bar ","boliche","aperitivo","mate","yerba",
    "mercado","feria","verduleria","carniceria","polleria","pescaderia","super","superm",
    "nutricion","vegano","vegetariano","sushi","ramen","wok","fideos","pasta","pizza",
  ],
  "Transporte": [
    "uber","cabify","taxi","nafta","combustible","subte","sube","colectivo","bus","peaje",
    "remis","gasoil","estacionamiento","tren","bicicleta","moto","scooter","patineta",
    "shell","ypf","axion","petrobras","puma","esso","serviclub","autoexpreso","autopista",
    "gnc","aeroparque","ezeiza","aeropuerto","vuelo","lkbus","plataforma","omnilineas",
    "flecha","andesmar","via bariloche","coche","auto","seguro auto","patente","vehiculo",
    "lyft","didi","bemo","acercapp","turismo","transfer","shuttle",
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
  ],
  "Suscripción": [
    "suscripcion","suscripción","subscripcion","subscripción","membresia","mensualidad",
    "plan mensual","plan anual","renovacion","auto renovacion","trial","free trial",
    "antivirus","vpn","nordvpn","expressvpn","dropbox","icloud","google one","onedrive",
    "canva","figma pro","notion pro","obsidian","todoist","things","bear","craft",
    "duolingo","babble","rosetta stone","pimsleur",
  ],
  "Mascotas": [
    "veterinario","veterinaria","vet","perro","gato","mascota","hamster","conejo",
    "comida perro","comida gato","purina","pedigree","whiskas","royal canin","eukanuba",
    "accesorios mascota","collar","correa","juguete mascota","antiparasitario","vacuna mascota",
    "peluqueria canina","bano mascota","hotel mascota","guarderia mascota",
  ],
  "Viajes": [
    "hotel","hostel","airbnb","booking","despegar","aerolinea","vuelo","avion",
    "aerolinas","latam","jetsmart","flybondi","american","united","lufthansa",
    "turismo","agencia","excursion","tour","crucero","ferry","barco","tren largo",
    "valija","mochila viaje","adaptador","seguro viaje","visa","pasaporte","tramite migratorio",
    "cambiaria","casa de cambio","dolar viaje","euro viaje","dolares",
  ],
  "Ahorros e Inversiones": [
    "plazo fijo","fci","fondo comun","bono","accion","cripto","bitcoin","ethereum","usdt",
    "binance","lemon","belo","buenbit","ripio","bitso","coinbase","kraken",
    "inversion","ahorro","deposito","retiro","transferencia","envio",
    "cuenta bancaria","tarjeta","banco","bbva","santander","galicia","macro","nacion",
    "mercadopago","naranja","uala","brubank","bnext","wise","payoneer","paypal",
  ],
};

function guessCategory(description: string, categories: Category[]): string {
  const lower = description.toLowerCase();
  for (const [catName, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const match = categories.find((c) => c.name.toLowerCase().includes(catName.toLowerCase()));
      if (match) return match.id;
    }
  }
  return "";
}

function QuickAddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "expense" as "expense" | "income",
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
    fontSize: 14,
    width: "100%",
    outline: "none",
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              placeholder="¿En qué gastaste?"
              value={form.description}
              autoFocus
              onChange={(e) => handleDescriptionChange(e.target.value)}
            />
            {/* Neo auto-eligió */}
            {suggestedCat && form.category_id === suggestion && (
              <div className="flex items-center gap-1.5 mt-1.5 px-1" style={{ fontSize: 11 }}>
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
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <select
              style={{ ...inp, width: "40%" }}
              value={form.currency_code}
              onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Categoría */}
          <select
            style={{
              ...inp,
              color: form.category_id ? "var(--ink)" : "var(--ink-dim)",
            }}
            value={form.category_id}
            onChange={(e) => {
              setForm((f) => ({ ...f, category_id: e.target.value }));
              setSuggestion(null);
            }}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>

          {/* Fecha */}
          <input
            style={inp}
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

  function handleSaved() {
    setShowAdd(false);
    router.refresh();
  }

  return (
    <>
      {showAdd && (
        <QuickAddModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />
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
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "0.5px solid var(--glass-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
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
              color: "#FFFFFF",
              border: "3px solid var(--void)",
              boxShadow: "0 0 0 1px var(--accent-glow), 0 6px 20px var(--accent-glow)",
              fontSize: 26,
              fontWeight: 300,
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
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        minHeight: 48,
        color: active ? "var(--accent)" : "var(--ink-dim)",
        textDecoration: "none",
        position: "relative",
      }}
    >
      <div style={{ position: "relative" }}>
        <Icon active={active} />
        {badge > 0 && (
          <span style={{
            position: "absolute",
            top: -3,
            right: -4,
            minWidth: 15,
            height: 15,
            borderRadius: 999,
            background: "var(--negative)",
            border: "1.5px solid rgba(255,255,255,0.88)",
            fontSize: 8,
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
      <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.01em" }}>{label}</span>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 8v8M15 8v8" />
        </>
      )}
    </svg>
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
