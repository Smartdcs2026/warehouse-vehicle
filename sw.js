const CACHE_PREFIX="wvf-static-";
const CACHE="wvf-static-round182-operational-display-integration";
const CORE=["./","./index.html","./styles.css","./config.js","./app.js","./sweetalert2.all.min.js","./jsqr.js","./manifest.webmanifest"];
const OPTIONAL=["./favicon.png","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./track.html","./track.css","./track.js","./queue.html","./queue.css","./queue.js","./voice-engine.js","./appointment-excel-worker.js","./appointment-public-display.js"];

async function cacheOne(cache,url){try{await cache.add(url);return true}catch(error){console.warn("sw_cache_failed",url,String(error?.message||error));return false}}
async function networkWithTimeout(request,timeoutMs=5000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(request,{cache:"no-store",signal:controller.signal})}finally{clearTimeout(timer)}}
async function cacheResponse(request,response){if(response?.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}return response}
async function cached(request){return await caches.match(request)||await caches.match(request,{ignoreSearch:true})}
async function navigationResponse(request){try{const response=await networkWithTimeout(request,6000);if(response.ok)await cacheResponse(request,response);return response}catch{const hit=await cached(request)||await caches.match("./index.html");return hit||new Response("Offline",{status:503,headers:{"content-type":"text/plain; charset=utf-8"}})}}
async function staticResponse(request){try{const response=await networkWithTimeout(request,5000);if(response.status>=500){const hit=await cached(request);if(hit)return hit}return await cacheResponse(request,response)}catch{const hit=await cached(request);return hit||new Response("Offline",{status:503,headers:{"content-type":"text/plain; charset=utf-8"}})}}

self.addEventListener("install",event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const url of CORE){const ok=await cacheOne(cache,url);if(!ok)throw new Error(`core_asset_missing:${url}`)}await Promise.allSettled(OPTIONAL.map(url=>cacheOne(cache,url)));await self.skipWaiting()})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==="navigate"){event.respondWith(navigationResponse(event.request));return}event.respondWith(staticResponse(event.request))});
