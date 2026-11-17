// Bump this version whenever changing any app-shell file.
const CACHE = 'aligner-tracker-shell-v2';
const FILES = ['./','./index.html','./style.css','./app.mjs','./core.mjs','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aligner-tracker-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return cache.match('./index.html');throw error;}
  }));
});

// Local storage belongs to the page. Open it for a reviewed, validated stop.
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const params=new URLSearchParams({break:event.notification.data?.breakId??'',action:event.action==='stop'?'stop':'open',at:String(Date.now())});
  const url=new URL('./',self.registration.scope);url.hash=params.toString();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(client){await client.navigate(url.href);await client.focus();}
    else await self.clients.openWindow(url.href);
  })());
});
