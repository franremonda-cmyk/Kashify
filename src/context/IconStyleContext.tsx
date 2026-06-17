"use client";
import { createContext, useContext, useState, useEffect } from "react";

export type IconStyle = "line" | "solid" | "duotone" | "emoji";

interface IconStyleCtx {
  iconStyle: IconStyle;
  setIconStyle: (s: IconStyle) => void;
}

const Ctx = createContext<IconStyleCtx>({ iconStyle: "line", setIconStyle: () => {} });

export function IconStyleProvider({ children }: { children: React.ReactNode }) {
  const [iconStyle, setIconStyleState] = useState<IconStyle>("line");

  useEffect(() => {
    const saved = localStorage.getItem("kashify-icon-style") as IconStyle | null;
    if (saved) setIconStyleState(saved);
  }, []);

  function setIconStyle(s: IconStyle) {
    setIconStyleState(s);
    localStorage.setItem("kashify-icon-style", s);
  }

  return <Ctx.Provider value={{ iconStyle, setIconStyle }}>{children}</Ctx.Provider>;
}

export const useIconStyle = () => useContext(Ctx);
