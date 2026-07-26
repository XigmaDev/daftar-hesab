/*
  Service Worker — دفتر تراکنش
  استراتژی: Cache First برای App Shell، تا برنامه کاملاً بدون اینترنت اجرا شود.
  هیچ درخواست شبکه‌ای به بیرون (API خارجی) در این پروژه وجود ندارد.
*/

const CACHE_VERSION = 'daftar-tarakonesh-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/smsParser.js',
  './js/charts.js',
  './js/seed.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// نصب: پیش‌ذخیره‌سازی کامل پوسته برنامه
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// فعال‌سازی: پاک‌سازی نسخه‌های قدیمی کش
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// واکشی: همیشه اول از کش (Offline First)، در صورت نبود، تلاش برای شبکه (فقط برای توسعه محلی)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
