const CACHE_NAME = 'nizam-v2'
const OFFLINE_URL = '/offline.html'
const NETWORK_TIMEOUT_MS = 6000

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/logo.png',
  OFFLINE_URL,
]

// Install — cache static assets + offline fallback page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Network fetch dengan timeout, supaya jaringan lemot tidak menggantung
// tanpa batas sebelum jatuh ke cache/fallback.
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network-timeout')), timeoutMs)
    fetch(request).then(
      (response) => {
        clearTimeout(timer)
        resolve(response)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

// Fetch — network-first, fallback ke cache, fallback ke halaman offline khusus navigasi
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Skip non-http(s) requests
  if (!request.url.startsWith('http')) return

  // API calls — network only
  if (request.url.includes('/api/')) return

  const isNavigation = request.mode === 'navigate'

  event.respondWith(
    fetchWithTimeout(request, NETWORK_TIMEOUT_MS)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached

        // Hanya request navigasi (buka halaman) yang mendapat halaman offline;
        // request aset (JS/CSS/gambar) dibiarkan gagal secara alami.
        if (isNavigation) {
          const offlinePage = await caches.match(OFFLINE_URL)
          if (offlinePage) return offlinePage
        }

        return new Response('Offline', { status: 503 })
      })
  )
})
