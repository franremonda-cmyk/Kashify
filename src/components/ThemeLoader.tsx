"use client";
import { useEffect } from "react";

export default function ThemeLoader() {
  useEffect(() => {
    const saved = localStorage.getItem("kashify-theme");
    if (saved && saved !== "arctic") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);
  return null;
}
