// Service worker : notifications de révision
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Révision", body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || "Question de révision", {
      body: d.body || "Une question t'attend.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "revision",
      renotify: true,
      data: { url: d.url || "/reviser" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/reviser";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
