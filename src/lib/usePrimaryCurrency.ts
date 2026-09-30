"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Moneda principal del perfil, para que los formularios no arranquen fijos en
// ARS (quien cobra y gasta en USD tenía que cambiarla cada vez). null mientras
// carga o si falla: el formulario sigue con su default.
export function usePrimaryCurrency(): string | null {
  const [cur, setCur] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("primary_currency").eq("user_id", user.id).single();
        if (alive && data?.primary_currency) setCur(data.primary_currency as string);
      } catch { /* sin red: queda el default */ }
    })();
    return () => { alive = false; };
  }, []);
  return cur;
}
