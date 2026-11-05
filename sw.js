
/* ==========================================================
   JEADAS.INSIGHTS
   SERVICE WORKER
   Version: 1.0.0
   ========================================================== */

const CACHE_NAME = 'jdi-shell-v1';

const APP_SHELL = './';

/* INSTALACIÓN */

self.addEventListener('install', event => {

    event.waitUntil(

        caches.open(CACHE_NAME).then(cache => {
            return cache.add(APP_SHELL);
        })

    );

    self.skipWaiting();

});

/* ACTIVACIÓN */

self.addEventListener('activate', event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))

            );

        })

    );

    self.clients.claim();

});

/* NAVEGACIÓN */

self.addEventListener('fetch', event => {

    const request = event.request;

    if (
        request.method !== 'GET' ||
        request.mode !== 'navigate'
    ) {
        return;
    }

    event.respondWith(

        fetch(request)
            .then(response => {

                if (response.ok) {

                    const copy = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, copy);
                    });

                }

                return response;

            })
            .catch(async () => {

                return (
                    await caches.match(request) ||
                    await caches.match(APP_SHELL)
                );

            })

    );

});
