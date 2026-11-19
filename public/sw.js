// Grind service worker: makes the app installable and usable on flaky gym Wi-Fi.
// - Static assets: cache-first (they are content-hashed by Next.js).
// - Pages: network-first, falling back to the cached copy, then /offline.
// - API calls are never cached (always live data).
const VERSION = "grind-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== "grind-settings").map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/offline"))),
    );
  }
});

// ---- Motivation nudges ------------------------------------------------------
// Settings are mirrored by the app into Cache Storage (the SW can't read localStorage).
// periodicsync only fires for an installed PWA, and the browser decides the exact timing.
const SETTINGS_CACHE = "grind-settings";
const SETTINGS_URL = "/__grind/motivation-settings";
const NUDGES = {
  savage: {
    afternoon: [
      "Lunch ke baad sona nahi hai. Protein maar, aur shaam ko gaand faad workout ki tayyari kar. 🔥",
      "Aadha din gaya. Excuses wahi purane, body bhi wahi purani. Utth aur kuch kar.",
      "Tu thaka nahi hai, tu bored hai. Bored log body nahi banate. Chal grind kar.",
    ],
    evening: [
      "Gym ka time ho gaya. Gaand faad de aaj, weights wait kar rahe hain. 🏋️",
      "Koi nahi aayega tujhe bachane. Tu khud hi apna hero hai. Rack pe chal.",
      "Phone neeche, dumbbell upar. Aaj PR todna hai.",
    ],
  },
  clean: {
    afternoon: ["Halfway through the day. Hit your protein and plan tonight's session."],
    evening: ["Training time. Show up and beat last week's numbers.", "Discipline beats motivation. Get to the gym."],
  },
};

async function maybeNudge() {
  const res = await caches.open(SETTINGS_CACHE).then((c) => c.match(SETTINGS_URL));
  if (!res) return;
  const settings = await res.json().catch(() => null);
  if (!settings?.enabled) return;
  const h = new Date().getHours();
  const window = h >= 12 && h < 15 ? "afternoon" : h >= 17 && h < 22 ? "evening" : null;
  if (!window) return;
  // Skip if the app is open: the in-app scheduler handles it there.
  const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (open.some((c) => c.visibilityState === "visible")) return;
  const list = NUDGES[settings.tone === "clean" ? "clean" : "savage"][window];
  const body = list[Math.floor(Math.random() * list.length)];
  await self.registration.showNotification(settings.tone === "clean" ? "Grind" : "GRIND TIME 🔥", {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "grind-motivation",
    data: { url: "/workouts" },
  });
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "grind-motivation") event.waitUntil(maybeNudge());
});

// Server push (if a push backend is added later): show whatever it sends.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "GRIND TIME 🔥", {
      body: data.body || "Gaand faad de aaj. 🏋️",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "grind-motivation",
      data: { url: data.url || "/workouts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) return existing.navigate(url).then((c) => (c || existing).focus());
      return self.clients.openWindow(url);
    }),
  );
});
