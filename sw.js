const CACHE="wvf-static-round127-datatable-mobile-date-row-20260814-r127";
const SHELL=["./","./index.html","./styles.css","./config.js","./app.js","./sweetalert2.all.min.js","./jsqr.js","./manifest.webmanifest","./favicon.png","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./track.html","./track.css","./track.js","./queue.html","./queue.css","./queue.js","./voice-engine.js"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  const isQueue=/\/(queue\.html|queue\.css|queue\.js|voice-engine\.js|track\.html|track\.css|track\.js)$/.test(url.pathname);
  if(isQueue){
    event.respondWith(fetch(event.request,{cache:"no-store"}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(response=>response||caches.match("./index.html"))));
});
