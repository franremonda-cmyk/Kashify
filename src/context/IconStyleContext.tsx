"use client";
import { createContext, useContext, useState, useEffect } from "react";

export type IconStyle = "line" | "solid" | "duotone" | "emoji";

interface IconStyleCtx {
  iconStyle: IconStyle;
  setIconStyle: (s: IconStyle) => void;
}

const Ctx = createContext<IconStyleCtx>({ iconStyle: "emoji", setIconStyle: () => {} });

export function IconStyleProvider({ children }: { children: React.ReactNode }) {
  // Emoji por defecto: todo gasto/ingreso/categoría muestra su emoji.
  const [iconStyle, setIconStyleState] = useState<IconStyle>("emoji");

  useEffect(() => {
    const saved = localStorage.getItem("kashify-icon-style-v2") as IconStyle | null;
    if (saved) setIconStyleState(saved);
  }, []);

  function setIconStyle(s: IconStyle) {
    setIconStyleState(s);
    localStorage.setItem("kashify-icon-style-v2", s);
  }

  return <Ctx.Provider value={{ iconStyle, setIconStyle }}>{children}</Ctx.Provider>;
}

export const useIconStyle = () => useContext(Ctx);
