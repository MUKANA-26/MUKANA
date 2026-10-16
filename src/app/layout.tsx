import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Mukana — Your Opportunity Starts Here.", template: "%s · Mukana" },
  description:
    "Mukana connects attachees and graduate trainees in Zimbabwe with verified employers offering industrial attachment and graduate trainee programmes.",
  applicationName: "Mukana",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Mukana", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Mukana",
    title: "Mukana — Your Opportunity Starts Here.",
    description: "Industrial attachments and graduate trainee programmes in Zimbabwe.",
    images: [{ url: "/brand/logo-full.png", width: 800, height: 800, alt: "Mukana" }],
  },
  twitter: { card: "summary", title: "Mukana", description: "Your Opportunity Starts Here." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#032552" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1424" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {/* Decides before first paint whether to show the opening animation (home page only, once per session). */}
        <Script
          id="splash-init"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: "try{if(location.pathname==='/'&&!sessionStorage.getItem('mukana:splash')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.setAttribute('data-splash','on')}}catch(e){}",
          }}
        />
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
