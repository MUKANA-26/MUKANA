"use client";

import { useEffect, useState } from "react";
import { FullLogo } from "@/components/brand/logo";

/** Branded splash shown once per session when the app is launched from the Home Screen. */
export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!standalone || sessionStorage.getItem("mukana:splash")) return;
      sessionStorage.setItem("mukana:splash", "1");
    } catch {
      return;
    }
    setVisible(true);
    const t1 = setTimeout(() => setFading(true), 1100);
    const t2 = setTimeout(() => setVisible(false), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-white transition-opacity duration-400 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <FullLogo size={260} priority />
    </div>
  );
}
