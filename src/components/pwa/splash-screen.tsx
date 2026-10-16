"use client";

import { useEffect } from "react";
import { AnimatedMark } from "@/components/brand/animated-mark";

const SHOW_MS = 5200;

/**
 * Opening animation: the logo's two figures shake hands, then the name appears and the screen fades.
 * Shown once per browser session. A tiny inline script in the layout decides (before first paint)
 * whether to show it, so there is no flash.
 */
export function SplashScreen() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-splash") !== "on") return;
    try {
      sessionStorage.setItem("mukana:splash", "1");
    } catch {
      /* optional */
    }
    const fade = setTimeout(() => root.setAttribute("data-splash", "fading"), SHOW_MS);
    const done = setTimeout(() => root.removeAttribute("data-splash"), SHOW_MS + 450);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);

  return (
    <div className="mukana-splash" aria-hidden>
      <div className="flex flex-col items-center">
        <AnimatedMark size={150} />
        <p className="mukana-splash-name mt-4 font-heading text-4xl font-bold tracking-tight text-navy">Mukana</p>
        <p className="mukana-splash-tag mt-1 text-sm text-[#4a5a73]">Your Opportunity Starts Here.</p>
      </div>
    </div>
  );
}