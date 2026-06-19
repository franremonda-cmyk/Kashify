"use client";
import { useState, useEffect, useRef } from "react";

export function useModalTouchLock() {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (scrollRef.current && e.target instanceof Node && scrollRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [mounted]);

  return { mounted, overlayRef, scrollRef };
}
