import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: "⊞" },
  { href: "/historial", label: "Historial", icon: "≡" },
  { href: "/categorias", label: "Categorías", icon: "◈" },
  { href: "/cuotas", label: "Cuotas", icon: "⊙" },
  { href: "/perfil", label: "Perfil", icon: "◯" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh pb-16">
      <main className="flex-1 px-4 pt-6 pb-2 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 px-4"
        style={{
          background: "rgba(15, 15, 26, 0.85)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
