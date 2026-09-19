self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Sağlık Cepte",
      body: event.data ? event.data.text() : "İlaç hatırlatıcın var."
    };
  }

  const title = data.title || "Sağlık Cepte";
  const options = {
    body: data.body || "İlaç hatırlatıcın var.",
    tag: data.tag || "ilac-hatirlatma",
    renotify: true,
    data: { url: "./" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "./";

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
