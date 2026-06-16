"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard",  label: "Inicio",     icon: "⊞" },
  { href: "/historial",  label: "Historial",  icon: "≡" },
  { href: "/categorias", label: "Categorías", icon: "◈" },
  { href: "/cuotas",     label: "Cuotas",     icon: "⊙" },
  { href: "/perfil",     label: "Perfil",     icon: "◯" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 px-4"
      style={{
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center"
            style={{
              color: active ? "var(--accent)" : "var(--ink-muted)",
              textDecoration: "none",
            }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
