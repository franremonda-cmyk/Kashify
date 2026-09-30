"use client";
import { useEffect, useRef } from "react";

// Escape cierra la ventana de ARRIBA, no todas: el formulario de categoría se
// abre encima del + y del detalle de un movimiento, y con un listener por
// ventana un Escape cerraba las dos. Pila global: solo actúa la última abierta.
const stack: { current: () => void }[] = [];
let listening = false;
function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.preventDefault();
  stack[stack.length - 1].current();
}

export function useEscape(onClose: () => void, active = true) {
  const handler = useRef(onClose);
  useEffect(() => { handler.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!active) return;
    const entry = handler;
    stack.push(entry);
    if (!listening) { window.addEventListener("keydown", onKey); listening = true; }
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
