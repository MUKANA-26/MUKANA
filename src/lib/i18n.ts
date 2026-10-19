export type Lang = "en" | "sn" | "nd";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "sn", label: "chiShona" },
  { value: "nd", label: "isiNdebele" },
];

export const LANG_COOKIE = "mukana-lang";
export const LOWDATA_COOKIE = "mukana-lowdata";

export const isLang = (v: unknown): v is Lang => v === "en" || v === "sn" || v === "nd";

type Dict = Record<string, string>;

/**
 * Core interface words. English text is the key, so any screen can call t("Home") and screens
 * that have no translation yet simply stay in English. Translations should be reviewed by native speakers
 * before launch; add more entries here (or move them to files per language) as screens are translated.
 */
const SN: Dict = {
  Home: "Pamba",
  Feed: "Nhau",
  Network: "Vanhu vangu",
  Messages: "Mameseji",
  Explore: "Tsvaga",
  Browse: "Tarisa",
  Applications: "Zvikumbiro",
  Saved: "Zvakachengetwa",
  Recommended: "Zvakurudzirwa",
  Settings: "Marongero",
  "Settings & privacy": "Marongero nekuchengetedza data",
  Notifications: "Zviziviso",
  "Sign out": "Buda",
  "Sign in": "Pinda",
  Password: "Pasiwedhi",
  Email: "Email",
  Opportunities: "Mikana",
  "Job alerts": "Zviziviso zvemabasa",
  Events: "Zviitiko",
  Groups: "Mapoka",
  Learn: "Dzidza",
  Mentors: "Varairidzi",
  Help: "Rubatsiro",
  "Help & support": "Rubatsiro",
  More: "Zvimwe",
  "For you": "Zvauchada",
  Latest: "Zvitsva",
  Following: "Dzaunotevera",
  Search: "Tsvaga",
  "Search posts": "Tsvaga nhau",
  Like: "Ndinoda",
  Comment: "Taura",
  Share: "Govera",
  Repost: "Govera zvakare",
  Post: "Tumira",
  Photo: "Mufananidzo",
  Video: "Vhidhiyo",
  Connect: "Batana",
  Message: "Mesaji",
  Discover: "Tsvaga",
  Invitations: "Kudaidzwa",
  Connections: "Vanhu vaunoziva",
  Sent: "Zvakatumirwa",
  Accept: "Gamuchira",
  Decline: "Ramba",
  Cancel: "Rega",
  Save: "Chengeta",
  Refresh: "Vandudza",
  "Load more": "Ona zvimwe",
  Overview: "Pfupiso",
  Profile: "Profile",
  "How others see me": "Zvinoonekwa nevamwe",
};

const ND: Dict = {
  Home: "Ikhaya",
  Feed: "Izindaba",
  Network: "Abantu bami",
  Messages: "Imilayezo",
  Explore: "Hlola",
  Browse: "Phequlula",
  Applications: "Izicelo",
  Saved: "Okugciniweyo",
  Recommended: "Okuncomekayo",
  Settings: "Izilungiselelo",
  "Settings & privacy": "Izilungiselelo lobumfihlo",
  Notifications: "Izaziso",
  "Sign out": "Phuma",
  "Sign in": "Ngena",
  Password: "Iphasiwedi",
  Email: "Email",
  Opportunities: "Amathuba",
  "Job alerts": "Izaziso zemisebenzi",
  Events: "Imicimbi",
  Groups: "Amaqembu",
  Learn: "Funda",
  Mentors: "Abeluleki",
  Help: "Usizo",
  "Help & support": "Usizo",
  More: "Okunye",
  "For you": "Kuwe",
  Latest: "Okusha",
  Following: "Abalandelwayo",
  Search: "Sesha",
  "Search posts": "Sesha izindaba",
  Like: "Ngiyathanda",
  Comment: "Phawula",
  Share: "Yabelana",
  Repost: "Yabelana kutsha",
  Post: "Thumela",
  Photo: "Isithombe",
  Video: "Ividiyo",
  Connect: "Xhumana",
  Message: "Umlayezo",
  Discover: "Thola",
  Invitations: "Izimemo",
  Connections: "Abantu obaziyo",
  Sent: "Okuthunyelweyo",
  Accept: "Yamukela",
  Decline: "Phika",
  Cancel: "Khansela",
  Save: "Gcina",
  Refresh: "Vuselela",
  "Load more": "Bona okunye",
  Overview: "Isifinyezo",
  Profile: "Profile",
  "How others see me": "Indlela abanye abangibona ngayo",
};

const DICTS: Record<Lang, Dict> = { en: {}, sn: SN, nd: ND };

export function translate(lang: Lang, text: string): string {
  return DICTS[lang][text] ?? text;
}
