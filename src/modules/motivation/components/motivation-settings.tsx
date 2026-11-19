"use client";

import { Bell, BellOff, Flame, Send, Smile } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { notificationsSupported, readSettings, sendMotivation, writeSettings, type MotivationSettings } from "../client";
import { WINDOWS, windowAt, type Tone } from "../messages";

export function MotivationSettingsCard() {
  const [settings, setSettings] = useState<MotivationSettings>(readSettings);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    notificationsSupported() ? Notification.permission : "unsupported",
  );

  async function update(next: MotivationSettings) {
    setSettings(next);
    await writeSettings(next);
  }

  async function toggle() {
    if (settings.enabled) return update({ ...settings, enabled: false });
    if (permission === "unsupported") return toast.error("This browser can't show notifications.");
    const result = permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return toast.error("Allow notifications in your browser settings to get nudges.");
    await update({ ...settings, enabled: true });
    toast.success("Motivation on. Nudges arrive 12–3 pm and 5–10 pm.");
  }

  async function test() {
    const ok = await sendMotivation(windowAt(new Date()) ?? "evening", settings.tone);
    if (!ok) toast.error("Couldn't show a notification. Check permission.");
  }

  const tones: { id: Tone; label: string; hint: string; icon: typeof Flame }[] = [
    { id: "savage", label: "Savage", hint: "Gaand faad Hinglish", icon: Flame },
    { id: "clean", label: "Clean", hint: "Family friendly", icon: Smile },
  ];

  return (
    <Card>
      <CardTitle>Motivation nudges</CardTitle>
      <button onClick={toggle} className="flex w-full items-center gap-3 text-left">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            settings.enabled ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
          )}
        >
          {settings.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{settings.enabled ? "On" : "Off"}</span>
          <span className="block text-xs text-muted">
            {WINDOWS.afternoon.label} and {WINDOWS.evening.label}, based on what you&apos;ve done today
          </span>
        </span>
        <span
          role="switch"
          aria-checked={settings.enabled}
          className={cn("relative h-7 w-12 shrink-0 rounded-full transition", settings.enabled ? "bg-accent" : "bg-surface-2")}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-background transition-all",
              settings.enabled ? "left-6" : "left-1 bg-muted",
            )}
          />
        </span>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {tones.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            onClick={() => update({ ...settings, tone: id })}
            className={cn(
              "flex items-center gap-2 rounded-2xl border p-3 text-left transition",
              settings.tone === id ? "border-accent bg-accent/10" : "border-border bg-surface-2",
            )}
          >
            <Icon className={cn("h-4 w-4", settings.tone === id ? "text-accent" : "text-muted")} />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {settings.enabled ? (
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={test}>
          <Send className="h-4 w-4" /> Send a test nudge
        </Button>
      ) : null}
      {permission === "denied" ? (
        <p className="mt-2 text-xs text-danger">Notifications are blocked. Allow them for this site in browser settings.</p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted">
        Install the app (⋮ → Install) for nudges while it&apos;s closed. Your phone decides exactly when background ones arrive.
      </p>
    </Card>
  );
}
