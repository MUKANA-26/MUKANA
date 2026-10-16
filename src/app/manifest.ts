import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mukana",
    short_name: "Mukana",
    description: "Your Opportunity Starts Here.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#032552",
    background_color: "#FFFFFF",
    lang: "en",
    categories: ["education", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Browse opportunities", short_name: "Browse", url: "/opportunities" },
      { name: "My applications", short_name: "Applications", url: "/candidate/applications" },
    ],
  };
}
