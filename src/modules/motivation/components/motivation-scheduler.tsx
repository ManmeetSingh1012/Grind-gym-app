"use client";

import { useEffect } from "react";
import { firedToday, markFired, readSettings, sendMotivation } from "../client";
import { dueSlot } from "../messages";

/**
 * Fires motivation notifications in the 12–3 pm and 5–10 pm windows while the app
 * is open or in the background. Renders nothing.
 */
export function MotivationScheduler() {
  useEffect(() => {
    let running = false;
    async function tick() {
      if (running) return;
      const settings = readSettings();
      if (!settings.enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const slot = dueSlot(new Date(), firedToday());
      if (!slot) return;
      running = true;
      markFired(slot.minute);
      await sendMotivation(slot.window, settings.tone).finally(() => {
        running = false;
      });
    }
    tick();
    const id = setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("grind:motivation", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("grind:motivation", tick);
    };
  }, []);
  return null;
}
