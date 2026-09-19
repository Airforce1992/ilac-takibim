
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "İlaç Takibim",
      body: event.data ? event.data.text() : "İlaç hatırlatıcın var."
    };
  }

  const title = data.title || "İlaç Takibim";
  const options = {
    body: data.body || "İlaç hatırlatıcın var.",
    icon: "./icon.png",
    badge: "./icon.png",
    tag: data.tag || "ilac-hatirlatma",
    data: {
      url: "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "./")
  );
});
