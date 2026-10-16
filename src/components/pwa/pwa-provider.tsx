"use client";

import * as React from "react";
import { Download, RefreshCw, Share, SquarePlus, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { firebasePublicConfig } from "@/lib/firebase/config";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** True when the app is running installed (standalone). */
  standalone: boolean;
  /** Android / Chrome / Edge can show the native install prompt. */
  canPrompt: boolean;
  /** iPhone / iPad Safari needs the manual "Add to Home Screen" guide. */
  isIosSafari: boolean;
  /** Show an "Install Mukana" button at all. */
  canInstall: boolean;
  online: boolean;
  install: () => Promise<void>;
  registration: ServiceWorkerRegistration | null;
}

const PwaContext = React.createContext<PwaState | null>(null);

export function usePwa() {
  const ctx = React.useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}

function detectStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  return iOS && safari;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [standalone, setStandalone] = React.useState(false);
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isIosSafari, setIsIosSafari] = React.useState(false);
  const [iosGuideOpen, setIosGuideOpen] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null);
  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = React.useState(false);

  // --- Install state -----------------------------------------------------------------
  React.useEffect(() => {
    setStandalone(detectStandalone());
    setIsIosSafari(detectIosSafari());
    setOnline(navigator.onLine);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMq = () => setStandalone(detectStandalone());
    mq.addEventListener("change", onMq);

    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      mq.removeEventListener("change", onMq);
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // --- Service worker registration + update detection ---------------------------------
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let cancelled = false;

    const fb = firebasePublicConfig();
    const url = fb ? `/sw.js?fb=${encodeURIComponent(JSON.stringify(fb))}` : "/sw.js";

    const trackWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const incoming = reg.installing;
        incoming?.addEventListener("statechange", () => {
          if (incoming.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(incoming);
            setUpdateDismissed(false);
          }
        });
      });
    };

    navigator.serviceWorker
      .register(url, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        setRegistration(reg);
        trackWaiting(reg);
      })
      .catch(() => undefined);

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void navigator.serviceWorker.getRegistration().then((r) => r?.update());
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (isIosSafari) {
      setIosGuideOpen(true);
    }
  }, [deferred, isIosSafari]);

  const canInstall = !standalone && (deferred !== null || isIosSafari);

  const value = React.useMemo<PwaState>(
    () => ({ standalone, canPrompt: deferred !== null, isIosSafari, canInstall, online, install, registration }),
    [standalone, deferred, isIosSafari, canInstall, online, install, registration],
  );

  return (
    <PwaContext.Provider value={value}>
      {!online ? (
        <div
          role="status"
          className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-center text-xs font-semibold text-warning-foreground"
        >
          <WifiOff className="size-4" aria-hidden /> You are offline. Saved items are shown read-only.
        </div>
      ) : null}
      {children}
      {waiting && !updateDismissed ? (
        <div
          role="alert"
          className="fixed inset-x-3 bottom-20 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-primary px-4 py-3 text-primary-foreground shadow-xl md:bottom-4"
        >
          <RefreshCw className="size-5 shrink-0" aria-hidden />
          <p className="flex-1 text-sm font-medium">New version available.</p>
          <Button
            size="sm"
            variant="cta"
            onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          >
            Refresh
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setUpdateDismissed(true)}
            className="grid size-8 place-items-center rounded-md hover:bg-white/10"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
      <Dialog
        open={iosGuideOpen}
        onClose={() => setIosGuideOpen(false)}
        title="Install Mukana on iPhone or iPad"
        description="Add Mukana to your Home Screen to use it like an app and receive notifications."
      >
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
              <Share className="size-4" aria-hidden />
            </span>
            <span>
              Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
              <SquarePlus className="size-4" aria-hidden />
            </span>
            <span>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
              <Download className="size-4" aria-hidden />
            </span>
            <span>
              Tap <strong>Add</strong>, then open Mukana from your Home Screen.
            </span>
          </li>
        </ol>
        <Button className="mt-5 w-full" onClick={() => setIosGuideOpen(false)}>
          Got it
        </Button>
      </Dialog>
    </PwaContext.Provider>
  );
}

/** "Install Mukana" button. Renders nothing once installed or when the platform can't install. */
export function InstallButton({
  className,
  variant = "cta",
  size = "default",
}: {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { canInstall, install } = usePwa();
  if (!canInstall) return null;
  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={() => void install()}>
      <Download aria-hidden /> Install Mukana
    </Button>
  );
}
