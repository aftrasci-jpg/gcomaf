const CACHE_NAME = 'crm-gcomaf-v1';
const STATIC_CACHE = 'crm-gcomaf-static-v1';
const DYNAMIC_CACHE = 'crm-gcomaf-dynamic-v1';

// Ressources à mettre en cache lors de l'installation
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/argon/css/argon-dashboard.css',
  '/assets/argon/css/custom.css',
  '/assets/argon/js/core/bootstrap.min.js',
  '/assets/argon/js/core/popper.min.js',
  '/assets/argon/js/argon-dashboard.min.js',
  '/assets/js/firebase.js',
  '/assets/js/auth.js',
  '/assets/js/menu.js',
  '/assets/argon/img/logo.png',
  '/public/favicon.ico',
  '/public/android-chrome-192x192.png',
  '/public/android-chrome-512x512.png'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Service Worker: Erreur lors de la mise en cache', error);
      })
  );
  // Forcer l'activation immédiate
  self.skipWaiting();
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Service Worker: Suppression de l\'ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prendre le contrôle immédiatement
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Stratégie Cache First pour les ressources statiques
  if (STATIC_ASSETS.includes(url.pathname) || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((response) => {
            // Ne pas mettre en cache les réponses d'erreur
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            return response;
          });
        })
    );
  }
  // Stratégie Network First pour les pages HTML
  else if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre en cache la réponse réussie
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback vers le cache si réseau indisponible
          return caches.match(request)
            .then((response) => {
              if (response) {
                return response;
              }
              // Page d'erreur hors ligne
              return caches.match('/index.html');
            });
        })
    );
  }
  // Stratégie Network First pour les autres ressources
  else {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});

// Gestion des messages depuis l'application principale
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});