// Skeleton genérico de lista: N filas con ícono + dos líneas, dentro de una
// tarjeta. Reemplaza los "Cargando..." de texto plano (categorías, metas,
// modales) para que la espera se sienta más corta y no salte el layout.
// La lista de transacciones usa su propio skeleton (calca TxRow).
export default function RowsSkeleton({ rows = 4, card = true }: { rows?: number; card?: boolean }) {
  const list = (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="list-row" aria-hidden>
          <div className="skel list-row__icon" style={{ borderRadius: "var(--radius-control)" }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            <div className="skel" style={{ width: `${60 - i * 4}%`, height: 13 }} />
            <div className="skel" style={{ width: `${38 - i * 3}%`, height: 11 }} />
          </div>
        </div>
      ))}
    </>
  );
  // role=status + texto sr-only anuncia "Cargando" al lector; las barras van
  // aria-hidden (decorativas). aria-hidden en el contenedor lo silenciaba entero.
  const sr = <span className="sr-only">Cargando…</span>;
  if (!card) return <div role="status" aria-busy="true">{sr}{list}</div>;
  return (
    <div className="card-solid" style={{ overflow: "hidden" }} role="status" aria-busy="true">
      {sr}{list}
    </div>
  );
}
