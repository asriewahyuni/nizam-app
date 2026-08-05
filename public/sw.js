const CACHE_NAME = 'nizam-v2'
const OFFLINE_URL = '/offline.html'
const NETWORK_TIMEOUT_MS = 15000

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
    fetch(request)
      .then((response) => {
        // Simpan ke cache jika sukses (untuk fallback nanti)
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(async (error) => {
        // Request akan masuk ke .catch() JIKA koneksi internet benar-benar terputus/offline,
        // bukan karena server lambat merespons.
        
        // Coba cari di cache terlebih dahulu
        const cached = await caches.match(request)
        if (cached) return cached

        // Jika tidak ada di cache dan ini adalah request navigasi (pindah halaman),
        // barulah kita tampilkan halaman offline.html
        if (isNavigation) {
          const offlinePage = await caches.match(OFFLINE_URL)
          if (offlinePage) return offlinePage
        }

        // Jika aset lain (gambar/js/css) gagal dan tidak ada di cache, biarkan error alami
        throw error
      })
  )
})
