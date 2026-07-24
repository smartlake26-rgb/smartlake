// ============================================================
//  public/firebase-messaging-sw.js
//  Push bildirishnomalar uchun Service Worker.
//  Ilova yopiq (fon rejim) bo'lganda ham bildirishnoma ko'rsatadi.
// ============================================================

/* eslint-env serviceworker */
/* global firebase */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA2JgIbG_kJCLSEjsU142kWyMqTBrUlTdE',
  authDomain: 'smartlake-6ce23.firebaseapp.com',
  projectId: 'smartlake-6ce23',
  storageBucket: 'smartlake-6ce23.firebasestorage.app',
  messagingSenderId: '920951270016',
  appId: '1:920951270016:web:0c2d2b0032149b08245465',
});

const messaging = firebase.messaging();

// Fon rejimda push kelganda (ilova yopiq)
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Background message:', payload);

  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || 'SmartLake';
  const body  = notification.body  || data.body  || '';
  const icon  = '/favicon.svg';
  const badge = '/favicon.svg';

  // Bildirishnoma ko'rsatish
  self.registration.showNotification(title, {
    body,
    icon,
    badge,
    tag: data.tag || 'smartlake-alert',
    data: {
      url: data.url || '/',
      lakeId: data.lakeId || null,
      type: data.type || 'alert',
    },
    // Vibratsiya (mobil)
    vibrate: [200, 100, 200],
    // Amallar
    actions: [
      { action: 'open', title: "Ko'rish" },
      { action: 'dismiss', title: 'Yopish' },
    ],
  });
});

// Bildirishnoma bosilganda — ilovani ochish
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  if (event.action === 'dismiss') return;

  // Ilovani ochish yoki mavjud tabga fokus qilish
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Mavjud tab bormi
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({ type: 'PUSH_CLICK', data });
            return;
          }
        }
        // Yangi tab ochish
        return self.clients.openWindow(url);
      })
  );
});
