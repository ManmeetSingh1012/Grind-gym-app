"use client";

import { api } from "@/lib/api/client";
import { isoWeekday, toIsoDate } from "@/lib/dates";
import type { DaySummary } from "@/modules/nutrition/schemas";
import type { RoutineItem } from "@/modules/workouts/schemas";
import { motivationMessage, type DayContext, type Tone, type Window } from "./messages";

export type MotivationSettings = { enabled: boolean; tone: Tone };

const SETTINGS_KEY = "grind.motivation.v1";
const FIRED_KEY = "grind.motivation.fired";
/** The service worker can't read localStorage, so settings are mirrored into Cache Storage for it. */
const SW_CACHE = "grind-settings";
const SW_SETTINGS_URL = "/__grind/motivation-settings";
const PERIODIC_TAG = "grind-motivation";

export const DEFAULT_SETTINGS: MotivationSettings = { enabled: false, tone: "savage" };

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function readSettings(): MotivationSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(settings: MotivationSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore: the in-memory toggle still works this session
  }
  window.dispatchEvent(new Event("grind:motivation"));
  try {
    const cache = await caches.open(SW_CACHE);
    await cache.put(SW_SETTINGS_URL, new Response(JSON.stringify(settings), { headers: { "content-type": "application/json" } }));
  } catch {
    // Cache Storage unavailable (http, private mode): only the in-app scheduler runs.
  }
  await syncPeriodicRegistration(settings.enabled);
}

/** Best effort: lets an installed PWA (Chrome/Android) nudge even when the app is closed. */
async function syncPeriodicRegistration(enabled: boolean) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const periodic = (reg as (ServiceWorkerRegistration & { periodicSync?: PeriodicSync }) | undefined)?.periodicSync;
    if (!periodic) return;
    if (enabled) await periodic.register(PERIODIC_TAG, { minInterval: 60 * 60 * 1000 });
    else await periodic.unregister(PERIODIC_TAG);
  } catch {
    // Not supported or not permitted: fine.
  }
}
interface PeriodicSync {
  register(tag: string, opts: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}

export function firedToday(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as { date?: string; slots?: number[] };
    return raw.date === toIsoDate() ? (raw.slots ?? []) : [];
  } catch {
    return [];
  }
}

export function markFired(minute: number) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: toIsoDate(), slots: [...firedToday(), minute] }));
  } catch {
    // ignore
  }
}

/** What's done today, to tailor the message. Any failure just means a generic message. */
export async function dayContext(): Promise<DayContext> {
  const date = toIsoDate();
  const weekday = isoWeekday();
  const [food, routine] = await Promise.allSettled([
    api.get<DaySummary>(`/nutrition/summary?date=${date}`),
    weekday <= 6 ? api.get<RoutineItem[]>(`/routine?weekday=${weekday}&date=${date}`) : Promise.reject(new Error("rest day")),
  ]);
  return {
    proteinLeft: food.status === "fulfilled" ? food.value.targets.protein_g - food.value.totals.protein_g : undefined,
    kcalLeft: food.status === "fulfilled" ? food.value.targets.calories - food.value.totals.calories : undefined,
    trainedToday:
      routine.status === "fulfilled" && routine.value.length ? routine.value.some((i) => i.todaySets.length > 0) : undefined,
  };
}

/** Shows a notification through the service worker when possible (required on Android), else directly. */
export async function showNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "grind-motivation",
    data: { url: "/workouts" },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export async function sendMotivation(window: Window, tone: Tone) {
  const ctx = await dayContext().catch(() => ({}));
  const msg = motivationMessage(window, tone, ctx);
  return showNotification(msg.title, msg.body);
}
