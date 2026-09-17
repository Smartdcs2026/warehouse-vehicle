"use strict";
(function(){
  const BUILD="2026.09.17-r20750-d1-safe-guard";
  const DATA_USAGE_CACHE_KEY="wvf_admin_data_usage_cache_r20750";
  const INSPECTOR_CACHE_KEY="wvf_admin_inspector_cache_r20750";
  const DATA_USAGE_TTL_MS=10*60*1000;
  const INSPECTOR_TTL_MS=10*60*1000;
  const ADMIN_HISTORY_TTL_MS=60*1000;
  const INBOUND_VERSION_INTERVAL_MS=10*1000;
  const cfg=window.APP_CONFIG||{};
  const base=String(cfg.apiBaseUrl||"").replace(/\/$/,"");
  const originalFetch=window.fetch.bind(window);
  const originalSetInterval=window.setInterval.bind(window);
  let forceDataUsageUntil=0;
  let forceInspectorUntil=0;
  let forceAdminHistoryUntil=0;
  const adminHistoryCache=new Map();

  function urlOf(input){try{return new URL(typeof input==="string"?input:input?.url||String(input),location.href)}catch{return null}}
  function methodOf(input,init){return String(init?.method||input?.method||"GET").toUpperCase()}
  function apiOrigin(){try{return new URL(base||location.origin,location.href).origin}catch{return location.origin}}
  function dataUsageRequest(url,method){return method==="GET"&&url&&url.origin===apiOrigin()&&url.pathname==="/api/admin/data-usage"}
  function inspectorRequest(url,method){return method==="GET"&&url&&url.origin===apiOrigin()&&url.pathname==="/api/admin/data-inspector"}
  function authBoundaryRequest(url,method){return method==="POST"&&url&&["/api/auth/login","/api/auth/logout"].includes(url.pathname)}
  function adminHistoryRequest(url,method){return method==="GET"&&url&&url.origin===apiOrigin()&&["/api/admin/archive-history","/api/admin/cleanup-history"].includes(url.pathname)}
  function adminHistoryMutation(url,method){return method!=="GET"&&url&&url.origin===apiOrigin()&&(/^\/api\/admin\/archive(?:-|\/)/.test(url.pathname)||/^\/api\/admin\/cleanup(?:-|\/)/.test(url.pathname))}

  function cachedResponse(row,source){return new Response(row.body,{status:Number(row.status)||200,statusText:row.statusText||"OK",headers:{"content-type":row.contentType||"application/json","x-wvf-runtime-cache":source}})}

  function readDataUsageCache(){try{const row=JSON.parse(sessionStorage.getItem(DATA_USAGE_CACHE_KEY)||"null");if(!row||!row.body||Date.now()-Number(row.at||0)>DATA_USAGE_TTL_MS)return null;return row}catch{return null}}
  function writeDataUsageCache(response,body){try{sessionStorage.setItem(DATA_USAGE_CACHE_KEY,JSON.stringify({at:Date.now(),body,status:response.status,statusText:response.statusText,contentType:response.headers.get("content-type")||"application/json"}))}catch{}}
  function clearDataUsageCache(){try{sessionStorage.removeItem(DATA_USAGE_CACHE_KEY)}catch{}}

  function readInspectorStore(){try{const value=JSON.parse(sessionStorage.getItem(INSPECTOR_CACHE_KEY)||"{}");return value&&typeof value==="object"?value:{}}catch{return{}}}
  function readInspectorCache(url){const store=readInspectorStore(),row=store[url.href];if(!row||!row.body||Date.now()-Number(row.at||0)>INSPECTOR_TTL_MS){if(row){delete store[url.href];try{sessionStorage.setItem(INSPECTOR_CACHE_KEY,JSON.stringify(store))}catch{}}return null}return row}
  function writeInspectorCache(url,response,body){try{const store=readInspectorStore();store[url.href]={at:Date.now(),body,status:response.status,statusText:response.statusText,contentType:response.headers.get("content-type")||"application/json"};const keys=Object.keys(store).sort((a,b)=>Number(store[b]?.at||0)-Number(store[a]?.at||0)).slice(0,4),trimmed={};for(const key of keys)trimmed[key]=store[key];sessionStorage.setItem(INSPECTOR_CACHE_KEY,JSON.stringify(trimmed))}catch{}}
  function clearInspectorCache(){try{sessionStorage.removeItem(INSPECTOR_CACHE_KEY)}catch{}}

  function readAdminHistoryCache(url){const row=adminHistoryCache.get(url.href);if(!row||Date.now()-Number(row.at||0)>ADMIN_HISTORY_TTL_MS){adminHistoryCache.delete(url.href);return null}return row}
  function clearAdminHistoryCache(){adminHistoryCache.clear()}
  function clearAll(){clearDataUsageCache();clearInspectorCache();clearAdminHistoryCache()}

  window.fetch=async function(input,init){
    const url=urlOf(input),method=methodOf(input,init);
    if(authBoundaryRequest(url,method))clearAll();
    if(adminHistoryMutation(url,method))clearAdminHistoryCache();
    if(adminHistoryRequest(url,method)&&Date.now()>=forceAdminHistoryUntil){const cached=readAdminHistoryCache(url);if(cached)return cachedResponse(cached,"admin-history")}
    if(inspectorRequest(url,method)&&Date.now()>=forceInspectorUntil){const cached=readInspectorCache(url);if(cached)return cachedResponse(cached,"admin-inspector")}
    if(dataUsageRequest(url,method)&&Date.now()>=forceDataUsageUntil){const cached=readDataUsageCache();if(cached)return cachedResponse(cached,"admin-data-usage")}

    const response=await originalFetch(input,init);
    if(dataUsageRequest(url,method)&&response.ok){try{const body=await response.clone().text();if(body)writeDataUsageCache(response,body)}catch{}}
    if(inspectorRequest(url,method)&&response.ok){try{const body=await response.clone().text();if(body)writeInspectorCache(url,response,body)}catch{}}
    if(adminHistoryRequest(url,method)&&response.ok){try{const body=await response.clone().text();if(body)adminHistoryCache.set(url.href,{at:Date.now(),body,status:response.status,statusText:response.statusText,contentType:response.headers.get("content-type")||"application/json"})}catch{}}
    return response;
  };

  document.addEventListener("click",event=>{
    if(event.target?.closest?.("#refreshDataUsage,#retryDataUsage")){clearDataUsageCache();clearInspectorCache();forceDataUsageUntil=Date.now()+6000;forceInspectorUntil=Date.now()+6000}
    if(event.target?.closest?.("#retryDataInspector,#retrySecondaryDatabase")){clearInspectorCache();forceInspectorUntil=Date.now()+6000}
    if(event.target?.closest?.("#archiveHistoryRefresh")){clearAdminHistoryCache();forceAdminHistoryUntil=Date.now()+6000}
  },true);

  function isInboundPoll(callback,delay){if(typeof callback!=="function"||Number(delay)!==5000)return false;try{return Function.prototype.toString.call(callback).includes("checkInboundLiveUpdates(false)")}catch{return false}}
  window.setInterval=function(callback,delay,...args){if(isInboundPoll(callback,delay))return originalSetInterval(callback,INBOUND_VERSION_INTERVAL_MS,...args);return originalSetInterval(callback,delay,...args)};

  window.WVF_D1_SAFE_GUARD={build:BUILD,status:()=>({dataUsageCached:Boolean(readDataUsageCache()),inspectorCacheEntries:Object.keys(readInspectorStore()).length,adminHistoryCacheEntries:adminHistoryCache.size,inboundVersionIntervalMs:INBOUND_VERSION_INTERVAL_MS}),clearAll};
})();
