export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "var(--void)" }}
    >
      {/* Ambient top glow */}
      <div
        className="fixed top-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 100% at 50% -20%, rgba(0,200,83,0.10) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex-1 flex flex-col justify-center px-6 py-12 max-w-sm mx-auto w-full">
        {children}
      </div>
    </div>
  );
}
