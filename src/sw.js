const cacheVersion = 'v1'
const cacheName = `${registration.scope}!${cacheVersion}`

self.addEventListener('install', e => {
	console.log('[Service Worker] installed')
	e.waitUntil(self.skipWaiting())
})

self.addEventListener('fetch', e => {
	const url = new URL(e.request.url)
	if (!url.protocol.includes('http')) {
		return
	}
	e.respondWith(
		caches.open(cacheName).then(cache => {
			return cache.match(e.request).then(response => {
				if (response) {
					return response
				}

				return fetch(e.request).then(response => {
					const cacheResponse = response.clone()
					caches.open(cacheName).then(cache => {
						cache.put(e.request, cacheResponse)
					})
					return response
				})
			})
		})
	)
})
