// Curated personal finance icon set using Phosphor Icons
import {
  ForkKnife, Coffee, ShoppingCart, Pizza, BeerStein, Hamburger, CookingPot, Wine, Cake, Bread, Orange, IceCream,
  Car, Bus, Train, Bicycle, Airplane, GasPump, Taxi, Motorcycle,
  House, Buildings, Key, Couch, Wrench, Broom, Toolbox, PaintBrush,
  Lightning, Drop, Flame, WifiHigh, Phone, Television, Broadcast,
  Heart, Heartbeat, Pill, Stethoscope, Barbell, Brain, Tooth, Eye, Baby,
  BookOpen, GraduationCap, PencilSimple, MusicNotes, Palette, Globe, Certificate,
  PlayCircle, FilmSlate, GameController, Headphones, Ticket, Trophy, Camera, Confetti,
  ShoppingBag, TShirt, Watch, Diamond, Gift, Package, Scissors,
  Briefcase, Laptop, Monitor, Printer, Envelope, Cloud, Code,
  TrendUp, PiggyBank, Wallet, CreditCard, Bank, Receipt, Coins, Money,
  PawPrint, Dog, Cat, Bird, Fish,
  MapPin, Suitcase, Compass, Sun, Tent,
  Sparkle, Star, Leaf, Flower, Shield, UserCircle, SmileyWink,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export interface IconDef {
  id: string;       // kebab-case name stored in DB
  label: string;    // human label for search
  emoji: string;    // emoji equivalent for emoji mode
  Component: Icon;  // Phosphor component
}

export interface IconGroup {
  group: string;
  icons: IconDef[];
}

export const ICON_GROUPS: IconGroup[] = [
  {
    group: "Comida y bebida",
    icons: [
      { id: "fork-knife",    label: "Cubiertos",     emoji: "🍽️", Component: ForkKnife },
      { id: "coffee",        label: "Café",           emoji: "☕", Component: Coffee },
      { id: "shopping-cart", label: "Supermercado",   emoji: "🛒", Component: ShoppingCart },
      { id: "pizza",         label: "Pizza",          emoji: "🍕", Component: Pizza },
      { id: "hamburger",     label: "Comida rápida",  emoji: "🍔", Component: Hamburger },
      { id: "beer-stein",    label: "Bar / Bebidas",  emoji: "🍺", Component: BeerStein },
      { id: "wine",          label: "Vino",           emoji: "🍷", Component: Wine },
      { id: "cooking-pot",   label: "Cocina casera",  emoji: "🍲", Component: CookingPot },
      { id: "cake",          label: "Pastelería",     emoji: "🎂", Component: Cake },
      { id: "bread",         label: "Panadería",      emoji: "🥖", Component: Bread },
      { id: "orange",        label: "Frutas",         emoji: "🍊", Component: Orange },
      { id: "ice-cream",     label: "Helados",        emoji: "🍦", Component: IceCream },
    ],
  },
  {
    group: "Transporte",
    icons: [
      { id: "car",        label: "Auto",           emoji: "🚗", Component: Car },
      { id: "gas-pump",   label: "Nafta",          emoji: "⛽", Component: GasPump },
      { id: "bus",        label: "Colectivo",      emoji: "🚌", Component: Bus },
      { id: "train",      label: "Tren / Subte",   emoji: "🚂", Component: Train },
      { id: "airplane",   label: "Avión",          emoji: "✈️", Component: Airplane },
      { id: "bicycle",    label: "Bicicleta",      emoji: "🚲", Component: Bicycle },
      { id: "taxi",       label: "Taxi / Uber",    emoji: "🚕", Component: Taxi },
      { id: "motorcycle", label: "Moto",           emoji: "🏍️", Component: Motorcycle },
    ],
  },
  {
    group: "Hogar",
    icons: [
      { id: "house",       label: "Casa / Hogar",    emoji: "🏠", Component: House },
      { id: "buildings",   label: "Depto / Edificio", emoji: "🏢", Component: Buildings },
      { id: "key",         label: "Alquiler / Llave", emoji: "🔑", Component: Key },
      { id: "couch",       label: "Muebles",          emoji: "🛋️", Component: Couch },
      { id: "wrench",      label: "Reparaciones",     emoji: "🔧", Component: Wrench },
      { id: "broom",       label: "Limpieza",         emoji: "🧹", Component: Broom },
      { id: "toolbox",     label: "Herramientas",     emoji: "🧰", Component: Toolbox },
      { id: "paint-brush", label: "Pintura / Deco",   emoji: "🎨", Component: PaintBrush },
    ],
  },
  {
    group: "Servicios",
    icons: [
      { id: "lightning",  label: "Electricidad",  emoji: "⚡", Component: Lightning },
      { id: "drop",       label: "Agua",          emoji: "💧", Component: Drop },
      { id: "flame",      label: "Gas",           emoji: "🔥", Component: Flame },
      { id: "wifi-high",  label: "Internet",      emoji: "📶", Component: WifiHigh },
      { id: "phone",      label: "Teléfono / Celular", emoji: "📱", Component: Phone },
      { id: "television", label: "TV / Cable",    emoji: "📺", Component: Television },
      { id: "broadcast",  label: "Streaming",     emoji: "📡", Component: Broadcast },
    ],
  },
  {
    group: "Salud",
    icons: [
      { id: "heart",       label: "Salud general",  emoji: "❤️", Component: Heart },
      { id: "heartbeat",   label: "Médico",         emoji: "💓", Component: Heartbeat },
      { id: "pill",        label: "Farmacia",       emoji: "💊", Component: Pill },
      { id: "stethoscope", label: "Doctor",         emoji: "🩺", Component: Stethoscope },
      { id: "barbell",     label: "Gym / Deporte",  emoji: "🏋️", Component: Barbell },
      { id: "brain",       label: "Salud mental",   emoji: "🧠", Component: Brain },
      { id: "tooth",       label: "Dentista",       emoji: "🦷", Component: Tooth },
      { id: "eye",         label: "Oftalmología",   emoji: "👁️", Component: Eye },
      { id: "baby",        label: "Pediatría",      emoji: "👶", Component: Baby },
    ],
  },
  {
    group: "Educación",
    icons: [
      { id: "book-open",      label: "Libros",         emoji: "📖", Component: BookOpen },
      { id: "graduation-cap", label: "Universidad",    emoji: "🎓", Component: GraduationCap },
      { id: "pencil-simple",  label: "Estudios",       emoji: "✏️", Component: PencilSimple },
      { id: "music-notes",    label: "Música",         emoji: "🎵", Component: MusicNotes },
      { id: "palette",        label: "Arte / Diseño",  emoji: "🎨", Component: Palette },
      { id: "globe",          label: "Idiomas",        emoji: "🌐", Component: Globe },
      { id: "certificate",    label: "Certificaciones",emoji: "📜", Component: Certificate },
    ],
  },
  {
    group: "Ocio y entretenimiento",
    icons: [
      { id: "play-circle",     label: "Streaming",     emoji: "▶️", Component: PlayCircle },
      { id: "film-slate",      label: "Cine",          emoji: "🎬", Component: FilmSlate },
      { id: "game-controller", label: "Videojuegos",   emoji: "🎮", Component: GameController },
      { id: "headphones",      label: "Música / Audio",emoji: "🎧", Component: Headphones },
      { id: "ticket",          label: "Eventos",       emoji: "🎫", Component: Ticket },
      { id: "trophy",          label: "Deportes",      emoji: "🏆", Component: Trophy },
      { id: "camera",          label: "Fotografía",    emoji: "📸", Component: Camera },
      { id: "confetti",        label: "Celebraciones", emoji: "🎉", Component: Confetti },
    ],
  },
  {
    group: "Compras",
    icons: [
      { id: "shopping-bag", label: "Compras",    emoji: "🛍️", Component: ShoppingBag },
      { id: "t-shirt",      label: "Ropa",       emoji: "👕", Component: TShirt },
      { id: "watch",        label: "Accesorios", emoji: "⌚", Component: Watch },
      { id: "diamond",      label: "Joyería",    emoji: "💎", Component: Diamond },
      { id: "gift",         label: "Regalos",    emoji: "🎁", Component: Gift },
      { id: "package",      label: "Paquetes",   emoji: "📦", Component: Package },
      { id: "scissors",     label: "Peluquería", emoji: "✂️", Component: Scissors },
    ],
  },
  {
    group: "Trabajo",
    icons: [
      { id: "briefcase", label: "Trabajo",        emoji: "💼", Component: Briefcase },
      { id: "laptop",    label: "Computadora",    emoji: "💻", Component: Laptop },
      { id: "monitor",   label: "Monitor",        emoji: "🖥️", Component: Monitor },
      { id: "printer",   label: "Impresora",      emoji: "🖨️", Component: Printer },
      { id: "envelope",  label: "Email / Correo", emoji: "📧", Component: Envelope },
      { id: "cloud",     label: "Cloud / Hosting",emoji: "☁️", Component: Cloud },
      { id: "code",      label: "Software / Dev", emoji: "💻", Component: Code },
    ],
  },
  {
    group: "Finanzas",
    icons: [
      { id: "trend-up",    label: "Inversiones",  emoji: "📈", Component: TrendUp },
      { id: "piggy-bank",  label: "Ahorros",      emoji: "🐷", Component: PiggyBank },
      { id: "wallet",      label: "Billetera",    emoji: "👛", Component: Wallet },
      { id: "credit-card", label: "Tarjeta",      emoji: "💳", Component: CreditCard },
      { id: "bank",        label: "Banco",        emoji: "🏛️", Component: Bank },
      { id: "receipt",     label: "Factura",      emoji: "🧾", Component: Receipt },
      { id: "coins",       label: "Monedas",      emoji: "🪙", Component: Coins },
      { id: "money",       label: "Dinero",       emoji: "💵", Component: Money },
    ],
  },
  {
    group: "Mascotas",
    icons: [
      { id: "paw-print", label: "Mascotas", emoji: "🐾", Component: PawPrint },
      { id: "dog",       label: "Perro",    emoji: "🐶", Component: Dog },
      { id: "cat",       label: "Gato",     emoji: "🐱", Component: Cat },
      { id: "bird",      label: "Pájaro",   emoji: "🐦", Component: Bird },
      { id: "fish",      label: "Pez",      emoji: "🐠", Component: Fish },
    ],
  },
  {
    group: "Viajes",
    icons: [
      { id: "map-pin",  label: "Destino",   emoji: "📍", Component: MapPin },
      { id: "suitcase", label: "Equipaje",  emoji: "🧳", Component: Suitcase },
      { id: "compass",  label: "Turismo",   emoji: "🧭", Component: Compass },
      { id: "sun",      label: "Vacaciones",emoji: "☀️", Component: Sun },
      { id: "tent",     label: "Camping",   emoji: "⛺", Component: Tent },
    ],
  },
  {
    group: "Personal",
    icons: [
      { id: "sparkle",     label: "Belleza",       emoji: "✨", Component: Sparkle },
      { id: "star",        label: "Favoritos",     emoji: "⭐", Component: Star },
      { id: "leaf",        label: "Naturaleza",    emoji: "🌿", Component: Leaf },
      { id: "flower",      label: "Flores",        emoji: "🌸", Component: Flower },
      { id: "shield",      label: "Seguro",        emoji: "🛡️", Component: Shield },
      { id: "user-circle", label: "Personal",      emoji: "👤", Component: UserCircle },
      { id: "smiley-wink", label: "Bienestar",     emoji: "😊", Component: SmileyWink },
    ],
  },
];

// Flat map for quick lookup by id
export const ICON_MAP = new Map<string, IconDef>(
  ICON_GROUPS.flatMap(g => g.icons).map(icon => [icon.id, icon])
);

// 12 distinct colors for auto-assignment — spaced for visual variety
export const CATEGORY_COLORS = [
  "#7B61FF", // violet
  "#00C853", // emerald
  "#FF3B30", // red
  "#FF9500", // amber
  "#0A84FF", // blue
  "#FF2D55", // pink
  "#AF52DE", // purple
  "#5AC8FA", // cyan
  "#FFD60A", // yellow
  "#30D158", // mint
  "#FF6B6B", // coral
  "#A2845E", // earth
];

// Returns the first color from CATEGORY_COLORS not already used in existingColors
export function suggestColor(existingColors: string[]): string {
  const used = new Set(existingColors.map(c => c.toLowerCase()));
  const free = CATEGORY_COLORS.find(c => !used.has(c.toLowerCase()));
  if (free) return free;
  // All 12 used — pick by cycling with offset
  return CATEGORY_COLORS[existingColors.length % CATEGORY_COLORS.length];
}
