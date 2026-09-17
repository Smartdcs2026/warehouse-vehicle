"use strict";
(function(){
  const BUILD="2026.09.17-r20750-d1-test-observer";
  const originalFetch=window.fetch.bind(window);
  const startedAt=Date.now();
  const stats={total:0,errors:0,byPath:{}};

  function pathOf(input){
    try{return new URL(typeof input==="string"?input:input?.url||String(input),location.href).pathname}catch{return "unknown"}
  }
  function tracked(path){
    return path==="/api/vehicles/active-version"||
      path==="/api/vehicles/active"||
      path==="/api/public/queue"||
      path==="/api/admin/data-usage"||
      path==="/api/admin/data-inspector"||
      path==="/api/admin/archive-history"||
      path==="/api/admin/cleanup-history";
  }
  function row(path){
    return stats.byPath[path]||(stats.byPath[path]={count:0,ok:0,error:0,totalMs:0,lastMs:0,lastStatus:0,lastAt:0});
  }
  function snapshot(){
    const now=Date.now(),minutes=Math.max(1/60,(now-startedAt)/60000),byPath={};
    for(const [path,item] of Object.entries(stats.byPath)){
      byPath[path]={...item,avgMs:item.count?Math.round(item.totalMs/item.count):0,perMinute:Number((item.count/minutes).toFixed(2))};
    }
    return {build:BUILD,startedAt,new DateStarted:new Date(startedAt).toISOString(),elapsedMinutes:Number(minutes.toFixed(2)),total:stats.total,errors:stats.errors,byPath};
  }
  function reset(){stats.total=0;stats.errors=0;stats.byPath={};return snapshot()}

  window.fetch=async function(input,init){
    const path=pathOf(input);
    if(!tracked(path))return originalFetch(input,init);
    const item=row(path),t0=performance.now();
    stats.total++;item.count++;item.lastAt=Date.now();
    try{
      const response=await originalFetch(input,init);
      const ms=Math.max(0,Math.round(performance.now()-t0));
      item.totalMs+=ms;item.lastMs=ms;item.lastStatus=response.status;
      if(response.ok)item.ok++;else{item.error++;stats.errors++}
      return response;
    }catch(error){
      const ms=Math.max(0,Math.round(performance.now()-t0));
      item.totalMs+=ms;item.lastMs=ms;item.lastStatus=0;item.error++;stats.errors++;
      throw error;
    }
  };

  window.WVF_D1_TEST_OBSERVER={build:BUILD,status:snapshot,reset};
})();
