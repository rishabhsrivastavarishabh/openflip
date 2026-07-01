// Openflip web push service worker
// Handles background push notifications for messages and incoming calls.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Openflip', body: event.data ? event.data.text() : '' };
  }

  const {
    title = 'Openflip',
    body = '',
    icon = '/favicon.ico',
    badge = '/favicon.ico',
    tag,
    data = {},
    requireInteraction = false,
    actions = [],
    silent = false,
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,
    data,
    requireInteraction,
    actions,
    silent,
    vibrate: payload.type === 'call' ? [400, 200, 400, 200, 400] : [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/';
  const action = event.action;

  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // If a client is already open, focus it and post a message.
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.postMessage({
            type: 'push-notification-click',
            payload: { ...data, action },
          });
          try {
            await client.focus();
            if (url && client.url && !client.url.endsWith(url)) {
              await client.navigate(url).catch(() => {});
            }
            return;
          } catch (_) {}
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
