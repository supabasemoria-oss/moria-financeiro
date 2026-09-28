// Service Worker — Moriá Push Notifications
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()) })

self.addEventListener('push', (e) => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Moriá', {
      body: data.body ?? '',
      icon: '/logo-symbol.png',
      badge: '/logo-symbol.png',
      tag: data.tag ?? 'moria-lembrete',
      data: { url: data.url ?? '/lembretes' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/lembretes'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => c.url.includes(url))
      if (client) return client.focus()
      return self.clients.openWindow(url)
    })
  )
})
