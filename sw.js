/* ==========================================================
   JEADAS.INSIGHTS
   SERVICE WORKER
   Version: 2.0.6

   Gestión:
   - Caché de aplicación
   - Navegación offline
   - Recursos CSS y JavaScript
   - Favicon SVG
   - Iconos PNG
   - Manifiesto PWA
   ========================================================== */


/* ==========================================================
   01. CONFIGURACIÓN
   ========================================================== */

const CACHE_NAME = 'jdi-shell-v2.0.6';

const CACHE_PREFIX = 'jdi-shell-';

const APP_SHELL = './';


/* ==========================================================
   02. INSTALACIÓN
   ========================================================== */

self.addEventListener('install', event => {

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(cache => {

                return cache.add(APP_SHELL);

            })

    );

    self.skipWaiting();

});


/* ==========================================================
   03. ACTIVACIÓN
   ========================================================== */

self.addEventListener('activate', event => {

    event.waitUntil(

        caches.keys()

            .then(keys => {

                return Promise.all(

                    keys

                        .filter(key => {

                            return (
                                key.startsWith(CACHE_PREFIX) &&
                                key !== CACHE_NAME
                            );

                        })

                        .map(key => {

                            return caches.delete(key);

                        })

                );

            })

            .then(() => {

                return self.clients.claim();

            })

    );

});


/* ==========================================================
   04. IDENTIFICAR RECURSOS ESTÁTICOS
   ========================================================== */

function esRecursoEstatico(request) {

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return false;
    }

    if (request.method !== 'GET') {
        return false;
    }

    return /\.(html|css|js|svg|png|webmanifest)$/i
        .test(url.pathname);

}


/* ==========================================================
   05. ESTRATEGIA NETWORK FIRST
   ========================================================== */

async function obtenerRecurso(request) {

    const cache = await caches.open(CACHE_NAME);

    try {

        const response = await fetch(request);

        if (
            response &&
            response.ok &&
            response.type === 'basic'
        ) {

            await cache.put(
                request,
                response.clone()
            );

        }

        return response;

    } catch (error) {

        const recursoGuardado = await cache.match(request);

        if (recursoGuardado) {
            return recursoGuardado;
        }

        throw error;

    }

}


/* ==========================================================
   06. NAVEGACIÓN Y RECURSOS
   ========================================================== */

self.addEventListener('fetch', event => {

    const request = event.request;

    if (request.method !== 'GET') {
        return;
    }

    /* NAVEGACIÓN */

    if (request.mode === 'navigate') {

        event.respondWith(

            obtenerRecurso(request)

                .catch(async () => {

                    return (
                        await caches.match(request) ||
                        await caches.match(APP_SHELL)
                    );

                })

        );

        return;

    }

    /* RECURSOS ESTÁTICOS */

    if (esRecursoEstatico(request)) {

        event.respondWith(

            obtenerRecurso(request)

                .catch(() => {

                    return caches.match(request);

                })

        );

    }

});


/* ==========================================================
   FIN SERVICE WORKER
   JEADAS.INSIGHTS
   ========================================================== */
