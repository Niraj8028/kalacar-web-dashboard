// Shows new-order alerts when the dashboard is closed. Stores nothing and caches nothing.
self.addEventListener("push", event => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { message = {}; }
  event.waitUntil(self.registration.showNotification(message.title || "New Kalacar order", {
    body: message.body || "Open the dashboard to see it.",
    icon: "/favicon.svg",
    tag: message.tag || "kalacar-order",
    data: { path: message.path },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const path = event.notification.data?.path;
  // Only ever opens a page of this dashboard.
  const url = new URL(typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/orders", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (open[0]) {
      await open[0].focus();
      await open[0].navigate(url).catch(() => undefined);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
