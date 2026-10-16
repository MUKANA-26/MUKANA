"use client";

import { useEffect } from "react";
import { AnimatedMark } from "@/components/brand/animated-mark";

const SHOW_MS = 8000;

/**
 * Opening animation: the logo's two figures shake hands, then the name appears and the screen fades.
 * Shown on the home page (the app's start page), once per browser session, and tapping skips it. A tiny inline script in the layout decides (before first paint)
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

  const skip = () => {
    document.documentElement.setAttribute("data-splash", "fading");
    setTimeout(() => document.documentElement.removeAttribute("data-splash"), 450);
  };

  return (
    <div className="mukana-splash" aria-hidden onClick={skip}>
      <div className="flex flex-col items-center">
        <AnimatedMark size={150} />
        <p className="mukana-splash-name mt-4 font-heading text-4xl font-bold tracking-tight text-navy">Mukana</p>
        <p className="mukana-splash-tag mt-1 text-sm text-[#4a5a73]">Your Opportunity Starts Here.</p>
        <p className="mukana-splash-tag mt-8 text-xs text-[#8a97ad]">Tap anywhere to skip</p>
      </div>
    </div>
  );
}