"use client";
import { useState, useEffect, useRef } from "react";

export function useModalTouchLock() {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // iOS Safari ignores overflow:hidden on body — must use position:fixed + save/restore scroll.
  useEffect(() => {
    if (!mounted) return;
    const scrollY = window.scrollY;
    const prev = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width, overflow: document.body.style.overflow };
    document.body.style.position = "fixed";
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.width    = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top      = prev.top;
      document.body.style.width    = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [mounted]);

  // Prevent touch-scroll on the backdrop; allow it only inside scrollRef.
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
