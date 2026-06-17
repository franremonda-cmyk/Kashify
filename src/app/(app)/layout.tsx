import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout" style={{ display: "flex", minHeight: "100dvh" }}>
      {/* Desktop sidebar — hidden on mobile via CSS */}
      <DesktopSidebar />

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
  );
}
