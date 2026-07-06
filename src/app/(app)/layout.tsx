import { Suspense } from "react";
import { cookies } from "next/headers";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import NeoBanner from "@/components/NeoBanner";
import NeoMascot from "@/components/NeoMascot";
import RememberEmail from "@/components/RememberEmail";
import UndoToast from "@/components/UndoToast";
import { createClient } from "@/lib/supabase/server";
import { SpaceProvider } from "@/context/SpaceContext";
import { SPACE_COOKIE } from "@/lib/space-scope";
import type { Space } from "@/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Espacios + espacio activo (cookie) para inicializar el SpaceProvider sin flash.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let spaces: Space[] = [];
  let hasPhone = false;
  if (user) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("spaces").select("*").eq("user_id", user.id)
        .order("sort_order").order("created_at"),
      supabase.from("user_phones").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    spaces = (data as Space[] | null) ?? [];
    hasPhone = (count ?? 0) > 0;
  }
  const activeSpace = (await cookies()).get(SPACE_COOKIE)?.value ?? "total";

  return (
    <SpaceProvider initialSpaces={spaces} initialActive={activeSpace}>
      <div className="app-layout" style={{ display: "flex", minHeight: "100dvh" }}>
        {/* Nudge de WhatsApp: solo para quien todavía no vinculó su número */}
        {!hasPhone && <NeoBanner />}
        {/* Desktop sidebar — hidden on mobile via CSS */}
        <Suspense fallback={<aside className="app-sidebar" style={{ display: "none" }} />}>
          <DesktopSidebar />
        </Suspense>

        {/* Main content */}
        <main
          className="app-main"
          style={{
            flex: 1,
            padding: "24px 16px",
            paddingBottom: "104px", /* space for mobile pill nav */
            maxWidth: 520,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {children}
        </main>

        {/* Mobile bottom nav — hidden on desktop via CSS */}
        <div className="app-bottom-nav">
          <BottomNav />
        </div>

        {/* Personaje Neo — fijo, vive en el sidebar (≥768) y vuela a /neo */}
        <NeoMascot />
        <RememberEmail email={user?.email} />
        <UndoToast />
      </div>
    </SpaceProvider>
  );
}
