import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, LOWDATA_COOKIE, isLang, translate, type Lang } from "@/lib/i18n";

/** Language and low-data choice of the current visitor (cookies, so they also work before signing in). */
export async function getPrefs(): Promise<{ lang: Lang; lowData: boolean }> {
  const jar = await cookies();
  const lang = jar.get(LANG_COOKIE)?.value;
  return { lang: isLang(lang) ? lang : "en", lowData: jar.get(LOWDATA_COOKIE)?.value === "1" };
}

export async function getT() {
  const { lang } = await getPrefs();
  return (text: string) => translate(lang, text);
}
