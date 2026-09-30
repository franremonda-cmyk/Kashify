"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function applyTheme(theme: string) {
  if (theme && theme !== "arctic") document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

export default function ThemeLoader() {
  useEffect(() => {
    // localStorage = caché rápido (sin parpadeo); DB = fuente de verdad.
    const saved = localStorage.getItem("kashify-theme");
    if (saved) applyTheme(saved);

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Zona horaria del celular → perfil, para que Neo (servidor en UTC,
        // WhatsApp sin zona) feche en tu hora. Solo escribe si cambió; sin la
        // migración 015 falla en silencio.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) supabase.from("profiles").update({ timezone: tz }).eq("user_id", user.id).neq("timezone", tz).then(() => {});
        const { data } = await supabase
          .from("profiles").select("theme").eq("user_id", user.id).single();
        const dbTheme = data?.theme as string | null;
        if (dbTheme) {
          applyTheme(dbTheme);
          localStorage.setItem("kashify-theme", dbTheme);
        }
      } catch { /* sin perfil/columna aún: degradar al caché local */ }
    })();
  }, []);
  return null;
}
