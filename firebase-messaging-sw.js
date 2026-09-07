/* Firebase Cloud Messaging background service worker for Adey Bonda. */
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBpLcSFmn1gNTklHu2eiebDYtXpq0qIhlM",
  authDomain: "adey-bonda.firebaseapp.com",
  projectId: "adey-bonda",
  storageBucket: "adey-bonda.firebasestorage.app",
  messagingSenderId: "820555835547",
  appId: "1:820555835547:web:efc14ad017ab4d206f7e3e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};
  const title = data.title || "Adey Bonda";
  const body = data.body || "You have a new notification.";
  const url = data.url || "home.html";

  self.registration.showNotification(title, {
    body,
    icon: "Image/Icon.jpg",
    badge: "Image/Icon.jpg",
    tag: data.tag || data.type || "adey-bonda",
    renotify: true,
    data: { url }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "home.html";

  event.waitUntil((async () => {
    const target = new URL(url, self.location.origin).href;
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clients) {
      if ("focus" in client) {
        try {
          await client.navigate(target);
        } catch (_) {}
        return client.focus();
      }
    }

    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
