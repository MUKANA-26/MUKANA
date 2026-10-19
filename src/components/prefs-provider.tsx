"use client";

import * as React from "react";
import { translate, type Lang } from "@/lib/i18n";

interface Prefs {
  lang: Lang;
  /** Low-data mode: photos and videos load only when tapped, and the opening animation is skipped. */
  lowData: boolean;
  t: (text: string) => string;
}

const Ctx = React.createContext<Prefs>({ lang: "en", lowData: false, t: (s) => s });

type NetworkInfo = { saveData?: boolean };

export function PrefsProvider({ lang, lowData, children }: { lang: Lang; lowData: boolean; children: React.ReactNode }) {
  // Also honour the phone's own "Data Saver" setting where the browser exposes it.
  const [saveData, setSaveData] = React.useState(false);
  React.useEffect(() => {
    const c = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    if (c?.saveData) setSaveData(true);
  }, []);
  const value = React.useMemo<Prefs>(() => ({ lang, lowData: lowData || saveData, t: (s) => translate(lang, s) }), [lang, lowData, saveData]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = () => React.useContext(Ctx);
/** Translate an English interface word (falls back to English when there is no translation yet). */
export const useT = () => React.useContext(Ctx).t;
export const useLowData = () => React.useContext(Ctx).lowData;
