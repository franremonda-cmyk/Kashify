// Fallback de navegación (Suspense del App Router): se muestra al instante al
// entrar a una ruta mientras el server component resuelve sus datos — sobre todo
// el dashboard, que hace await a varias queries. Las barras usan .skel (late) y
// respetan prefers-reduced-motion. Genérico: sirve para cualquier ruta de (app).
export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {/* Título */}
      <div className="skel" style={{ width: 160, height: 26, borderRadius: 8 }} aria-hidden />
      {/* Banda de resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-solid" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 78 }}>
            <div className="skel" style={{ width: "60%", height: 12 }} />
            <div className="skel" style={{ width: "80%", height: 20 }} />
          </div>
        ))}
      </div>
      {/* Bloques de contenido */}
      {[0, 1].map((i) => (
        <div key={i} className="skel" style={{ width: "100%", height: 120, borderRadius: 16 }} aria-hidden />
      ))}
    </div>
  );
}
