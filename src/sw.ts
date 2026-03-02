import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({ cacheName: 'supabase', networkTimeoutSeconds: 10 })
)

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() as { title?: string; body?: string; url?: string } | undefined
  const title = data?.title ?? 'Mileage Tracker Pro'
  const options: NotificationOptions = {
    body: data?.body ?? 'New update',
    icon: '/favicon.svg',
    data: { url: data?.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList[0]) {
        clientList[0].navigate(url)
        clientList[0].focus()
      } else if (self.clients.openWindow) {
        self.clients.openWindow(url)
      }
    })
  )
})
