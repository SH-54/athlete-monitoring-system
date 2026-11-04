// Never cache authenticated HTML, API responses, health records, or Supabase requests.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
