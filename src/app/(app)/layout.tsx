import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh" style={{ paddingBottom: "96px" }}>
      <main className="flex-1 px-4 pt-6 pb-4 max-w-lg mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
