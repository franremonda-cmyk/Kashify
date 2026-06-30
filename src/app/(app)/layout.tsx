import { Suspense } from "react";
import { cookies } from "next/headers";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import NeoBanner from "@/components/NeoBanner";
import { createClient } from "@/lib/supabase/server";
import { SpaceProvider } from "@/context/SpaceContext";
import { SPACE_COOKIE } from "@/lib/space-scope";
import type { Space } from "@/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Espacios + espacio activo (cookie) para inicializar el SpaceProvider sin flash.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let spaces: Space[] = [];
  if (user) {
    const { data } = await supabase.from("spaces").select("*").eq("user_id", user.id)
      .order("sort_order").order("created_at");
    spaces = (data as Space[] | null) ?? [];
  }
  const activeSpace = (await cookies()).get(SPACE_COOKIE)?.value ?? "total";

  return (
    <SpaceProvider initialSpaces={spaces} initialActive={activeSpace}>
      <div className="app-layout" style={{ display: "flex", minHeight: "100dvh" }}>
        <NeoBanner />
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
      </div>
    </SpaceProvider>
  );
}
