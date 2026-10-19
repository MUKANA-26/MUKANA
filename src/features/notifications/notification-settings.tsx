"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { usePwa } from "@/components/pwa/pwa-provider";
import { createClient } from "@/lib/supabase/client";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/firebase/messaging";

interface Prefs {
  push_enabled: boolean;
  email_enabled: boolean;
  whatsapp_opt_in: boolean;
  whatsapp_number: string | null;
  cat_network: boolean;
  cat_messages: boolean;
  cat_feed: boolean;
  cat_jobs: boolean;
  weekly_digest: boolean;
}

const DEFAULT_PREFS: Prefs = { push_enabled: true, email_enabled: true, whatsapp_opt_in: false, whatsapp_number: null, cat_network: true, cat_messages: true, cat_feed: true, cat_jobs: true, weekly_digest: true };

export function NotificationSettings({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { standalone, isIosSafari } = usePwa();
  const [state, setState] = React.useState<PushState | "loading">("loading");
  const [busy, setBusy] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [numberError, setNumberError] = React.useState<string | null>(null);

  const isIos = isIosSafari || (typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent));

  React.useEffect(() => {
    void currentPushState().then(setState);
  }, []);

  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs", userId],
    queryFn: async (): Promise<Prefs> => {
      const { data } = await supabase.from("notification_preferences").select("push_enabled, email_enabled, whatsapp_opt_in, whatsapp_number, cat_network, cat_messages, cat_feed, cat_jobs, weekly_digest").eq("user_id", userId).maybeSingle();
      return (data as Prefs | null) ?? DEFAULT_PREFS;
    },
  });

  React.useEffect(() => {
    if (prefs?.whatsapp_number) setNumber(prefs.whatsapp_number);
  }, [prefs?.whatsapp_number]);

  const save = async (patch: Partial<Prefs>) => {
    const next = { ...DEFAULT_PREFS, ...(prefs ?? {}), ...patch };
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, ...next });
    if (error) return toast.error("Could not save your preference");
    await queryClient.invalidateQueries({ queryKey: ["notification-prefs", userId] });
    toast.success("Saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Status changes, interviews, offers and deadline reminders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Push */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-foreground">
              {state === "granted" ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Push notifications on this device</p>
              <p className="text-sm text-muted-foreground">
                {state === "granted"
                  ? "Enabled. You'll get alerts even when Mukana is closed."
                  : state === "denied"
                    ? "Blocked in your browser or phone settings. Allow notifications for Mukana there, then come back."
                    : state === "unconfigured"
                      ? "Push isn't set up for this site yet."
                      : state === "unsupported"
                        ? "This browser doesn't support push notifications."
                        : "Get an alert the moment something changes. We only ask when you tap the button."}
              </p>
            </div>
          </div>
          {state === "default" || state === "denied" ? (
            <Button
              variant="cta"
              loading={busy}
              disabled={state === "denied"}
              onClick={async () => {
                setBusy(true);
                const r = await enablePush();
                setBusy(false);
                setState(await currentPushState());
                if (r.ok) toast.success("Notifications enabled on this device");
                else toast.error(r.error ?? "Could not enable notifications");
              }}
            >
              <Bell aria-hidden /> Enable notifications
            </Button>
          ) : null}
          {state === "granted" ? (
            <Button
              variant="outline"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await disablePush();
                setBusy(false);
                toast.success("Notifications turned off on this device. To fully block them, use your browser settings.");
              }}
            >
              Turn off on this device
            </Button>
          ) : null}
          {isIos ? (
            <div role="note" className="flex gap-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                <strong>iPhone and iPad:</strong> web push works on iOS 16.4 and later, and <strong>only after you add Mukana to your Home Screen</strong>
                {" "}(tap Share, then Add to Home Screen) and open it from there. {standalone ? "You're using the installed app, so you're all set." : "You're in Safari right now, so install the app first."}
              </p>
            </div>
          ) : null}
        </div>

        {/* Channels */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">What we send you</legend>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={prefs?.push_enabled ?? true} onChange={(e) => void save({ push_enabled: e.target.checked })} />
            <span>
              <span className="font-medium">Push notifications</span>
              <span className="block text-muted-foreground">Alerts on devices where you enabled them above.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={prefs?.email_enabled ?? true} onChange={(e) => void save({ email_enabled: e.target.checked })} />
            <span>
              <span className="font-medium">Email for key events</span>
              <span className="block text-muted-foreground">Interview invitations and job offers are also sent to your email.</span>
            </span>
          </label>
        </fieldset>

        {/* Categories */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Choose what to be notified about</legend>
          {(
            [
              ["cat_messages", "Messages", "New chat messages."],
              ["cat_network", "Network", "Connection invitations, follows and recommendations."],
              ["cat_feed", "Feed", "Tags, comments, likes and reposts."],
              ["cat_jobs", "Opportunities", "Job alerts, invitations to apply, deadline reminders and your weekly picks."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={prefs?.[key] ?? true} onChange={(e) => void save({ [key]: e.target.checked })} />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={prefs?.weekly_digest ?? true} onChange={(e) => void save({ weekly_digest: e.target.checked })} />
            <span>
              <span className="font-medium">Weekly digest (candidates)</span>
              <span className="block text-muted-foreground">Every Monday morning: your best new matches from the past week.</span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">Application updates, interviews and offers are always sent, because you would not want to miss them.</p>
        </fieldset>

        {/* WhatsApp opt-in */}
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="font-semibold">WhatsApp (coming soon)</p>
          <p className="text-sm text-muted-foreground">
            We will only ever message you on WhatsApp if you explicitly opt in. Tick this to be among the first to get WhatsApp updates once it launches.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={prefs?.whatsapp_opt_in ?? false}
              onChange={(e) => {
                if (e.target.checked && !/^\+[0-9]{8,15}$/.test(number)) {
                  setNumberError("Enter your WhatsApp number first, e.g. +263771234567");
                  return;
                }
                setNumberError(null);
                void save({ whatsapp_opt_in: e.target.checked, whatsapp_number: e.target.checked ? number : prefs?.whatsapp_number ?? null });
              }}
            />
            <span className="font-medium">Yes, I agree to receive WhatsApp messages from Mukana</span>
          </label>
          <Field label="WhatsApp number" htmlFor="wa-number" error={numberError ?? undefined} hint="International format, e.g. +263771234567">
            <Input id="wa-number" inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d+]/g, ""))} />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
