// AGAHF Service Worker — handles push notifications and offline caching

const CACHE_NAME = "agahf-v1"
const OFFLINE_URL = "/"

// ── Install: cache shell ──────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/agahflogo.svg", "/agahflogo.png"]),
    ),
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

// ── Fetch: network-first, fallback to cache ──────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && event.request.url.includes("/agahf")) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((r) => r ?? caches.match(OFFLINE_URL))),
  )
})

// ── Push: show notification ──────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "AGAHF", body: "You have a new notification." }

  try {
    if (event.data) data = event.data.json()
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/agahflogo.png",
      badge: "/agahflogo.png",
      data: data.url ? { url: data.url } : undefined,
      vibrate: [200, 100, 200],
    }),
  )
})

// ── Notification click: open app ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) => c.url === url && "focus" in c)
        if (existing) return existing.focus()
        return clients.openWindow(url)
      }),
  )
})
