"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SPACE_COOKIE } from "@/lib/space-scope";
import type { Space } from "@/types";

interface SpaceCtx {
  spaces: Space[];
  activeId: string;            // "total" o un uuid
  activeSpace: Space | null;   // el espacio seleccionado, null si "total"
  setActiveSpace: (id: string) => void;
  reloadSpaces: () => Promise<void>;
}

const Ctx = createContext<SpaceCtx>({
  spaces: [], activeId: "total", activeSpace: null,
  setActiveSpace: () => {}, reloadSpaces: async () => {},
});

export function SpaceProvider({
  initialSpaces, initialActive, children,
}: { initialSpaces: Space[]; initialActive: string; children: React.ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [activeId, setActiveId] = useState<string>(initialActive);
  const router = useRouter();

  const setActiveSpace = useCallback((id: string) => {
    setActiveId(id);
    // Cookie = fuente de verdad para los server components (la leen al re-renderizar).
    document.cookie = `${SPACE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  const reloadSpaces = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("spaces").select("*").eq("user_id", user.id)
      .order("sort_order").order("created_at");
    if (data) setSpaces(data as Space[]);
    router.refresh();
  }, [router]);

  const activeSpace = spaces.find((s) => s.id === activeId) ?? null;

  return (
    <Ctx.Provider value={{ spaces, activeId, activeSpace, setActiveSpace, reloadSpaces }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSpaces = () => useContext(Ctx);
