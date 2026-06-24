"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type IconStyle = "line" | "solid" | "duotone" | "emoji";

interface IconStyleCtx {
  iconStyle: IconStyle;
  setIconStyle: (s: IconStyle) => void;
}

const Ctx = createContext<IconStyleCtx>({ iconStyle: "emoji", setIconStyle: () => {} });

export function IconStyleProvider({ children }: { children: React.ReactNode }) {
  // Emoji por defecto: todo gasto/ingreso/categoría muestra su emoji.
  const [iconStyle, setIconStyleState] = useState<IconStyle>("emoji");

  useEffect(() => {
    // localStorage = caché rápido para evitar parpadeo en el primer render.
    const saved = localStorage.getItem("kashify-icon-style-v2") as IconStyle | null;
    if (saved) setIconStyleState(saved);

    // DB = fuente de verdad: sigue al usuario entre dispositivos y sobrevive la
    // evicción de localStorage (Safari/PWA lo borra tras ~7 días sin uso).
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles").select("icon_style").eq("user_id", user.id).single();
        const dbStyle = data?.icon_style as IconStyle | null;
        if (dbStyle) {
          setIconStyleState(dbStyle);
          localStorage.setItem("kashify-icon-style-v2", dbStyle);
        }
      } catch { /* sin perfil/columna aún: degradar al caché local */ }
    })();
  }, []);

  function setIconStyle(s: IconStyle) {
    setIconStyleState(s);
    localStorage.setItem("kashify-icon-style-v2", s);
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from("profiles").update({ icon_style: s }).eq("user_id", user.id);
      } catch { /* no-op: el caché local ya guardó */ }
    })();
  }

  return <Ctx.Provider value={{ iconStyle, setIconStyle }}>{children}</Ctx.Provider>;
}

export const useIconStyle = () => useContext(Ctx);
