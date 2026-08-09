"use strict";
(function(){
  const CACHE_PREFIX="smartdc-queue-voice-";
  const DEFAULTS={
    enabled:false,volume:80,repeatCount:1,repeatDelaySeconds:7,
    readDoor:true,readDoorLeadingZero:false,playDing:true,playThanks:true,
    packId:"th-TH-standard-01",assetBasePath:"/voice/queue/th-TH/standard-01/",apiBaseUrl:""
  };

  class QueueVoiceEngine{
    constructor(){
      this.settings={...DEFAULTS};
      this.manifest=null;
      this.manifestVersion="";
      this.ctx=null;
      this.masterGain=null;
      this.buffers=new Map();
      this.unlocked=false;
      this.ready=false;
      this.pending=[];
      this.processing=false;
      this.currentCallId="";
    }

    configure(settings={}){
      const previousPack=String(this.settings.packId||"")+"|"+String(this.settings.assetBasePath||"");
      this.settings={...this.settings,...settings};
      this.settings.volume=Math.max(10,Math.min(100,Number(this.settings.volume)||80));
      this.settings.repeatCount=Math.max(1,Math.min(3,Math.round(Number(this.settings.repeatCount)||1)));
      this.settings.repeatDelaySeconds=Math.max(3,Math.min(30,Math.round(Number(this.settings.repeatDelaySeconds)||7)));
      const nextPack=String(this.settings.packId||"")+"|"+String(this.settings.assetBasePath||"");
      if(previousPack!==nextPack){this.manifest=null;this.manifestVersion="";this.buffers.clear();this.ready=false;this.clearPending()}
      if(this.masterGain)this.masterGain.gain.value=this.settings.volume/100;
      return this.settings;
    }

    baseApi(){return String(this.settings.apiBaseUrl||window.APP_CONFIG?.apiBaseUrl||"").replace(/\/$/,"")}
    assetBase(){
      const path=String(this.settings.assetBasePath||DEFAULTS.assetBasePath);
      return this.baseApi()+"/"+path.replace(/^\/+/,"").replace(/\/?$/,"/");
    }
    manifestUrl(){return this.assetBase()+"voice-manifest.json"}

    async unlock(){
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass)throw new Error("เครื่องนี้ไม่รองรับระบบเสียง");
      this.ctx=this.ctx||new AudioContextClass();
      if(this.ctx.state!=="running")await this.ctx.resume();
      if(!this.masterGain){this.masterGain=this.ctx.createGain();this.masterGain.connect(this.ctx.destination)}
      this.masterGain.gain.value=this.settings.volume/100;
      this.unlocked=true;
      return true;
    }

    async loadManifest(force=false){
      if(this.manifest&&!force)return this.manifest;
      const response=await fetch(this.manifestUrl(),{cache:"no-store",headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("ไม่พบชุดเสียงส่วนกลาง");
      const manifest=await response.json();
      if(!manifest||!manifest.files||!manifest.files.digits||!manifest.files.letters||!manifest.files.appointment||!manifest.files.pleaseEnterDeliveryAt||!manifest.files.pleaseEnterDelivery||!manifest.files.door)throw new Error("ข้อมูลชุดเสียงไม่สมบูรณ์ กรุณาอัปเดตชุดเสียงล่าสุด");
      const version=String(manifest.version||"1");
      if(this.manifestVersion&&this.manifestVersion!==version){this.buffers.clear();this.ready=false}
      this.manifest=manifest;this.manifestVersion=version;
      return manifest;
    }

    async unlockAndPrepare(){
      await this.unlock();
      await this.loadManifest(true);
      await this.preload();
      this.ready=true;
      return true;
    }

    clipMap(){
      const f=this.manifest?.files||{},map={
        ding:f.ding,appointment:f.appointment,pleaseAt:f.pleaseEnterDeliveryAt,pleaseNoDoor:f.pleaseEnterDelivery,door:f.door,
        repeat:f.repeatAgain,thanks:f.thankYou
      };
      for(const [digit,file] of Object.entries(f.digits||{}))map["digit_"+digit]=file;
      for(const [letter,file] of Object.entries(f.letters||{}))map["letter_"+String(letter).toUpperCase()]=file;
      return map;
    }

    cacheName(){const pack=String(this.settings.packId||"pack").replace(/[^A-Za-z0-9._-]/g,"_"),version=String(this.manifestVersion||"current").replace(/[^A-Za-z0-9._-]/g,"_");return CACHE_PREFIX+pack+"-"+version}
    clipUrl(file){return this.assetBase()+encodeURIComponent(file).replace(/%2F/gi,"/")+"?v="+encodeURIComponent(this.manifestVersion||"1")}

    async fetchArrayBuffer(file){
      const url=this.clipUrl(file);
      if("caches" in window){
        const cache=await caches.open(this.cacheName());
        const hit=await cache.match(url);
        if(hit)return await hit.arrayBuffer();
        const response=await fetch(url,{cache:"no-store"});
        if(!response.ok)throw new Error("โหลดไฟล์เสียงไม่สำเร็จ: "+file);
        try{await cache.put(url,response.clone())}catch{}
        return await response.arrayBuffer();
      }
      const response=await fetch(url,{cache:"force-cache"});
      if(!response.ok)throw new Error("โหลดไฟล์เสียงไม่สำเร็จ: "+file);
      return await response.arrayBuffer();
    }

    async fetchBuffer(key){
      if(this.buffers.has(key))return this.buffers.get(key);
      const file=this.clipMap()[key];
      if(!file)throw new Error("ไม่พบเสียง: "+key);
      const arrayBuffer=await this.fetchArrayBuffer(file);
      const buffer=await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      this.buffers.set(key,buffer);
      return buffer;
    }

    async preload(){
      const map=this.clipMap();
      const keys=Object.keys(map).filter(k=>map[k]);
      await Promise.all(keys.map(key=>this.fetchBuffer(key)));
      if("caches" in window){
        try{const keep=this.cacheName(),names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==keep).map(n=>caches.delete(n)))}catch{}
      }
      return keys.length;
    }

    appointmentKeys(value){
      return String(value??"").replace(/\D/g,"").split("").filter(Boolean).map(d=>"digit_"+d);
    }

    normalizeDoor(code){
      let raw=String(code??"").toUpperCase().replace(/\s+/g,"");
      if(/^\d{1,3}$/.test(raw))raw="R"+raw;
      const match=raw.match(/^([RS]+)(\d{1,3})$/);
      if(!match)return null;
      return{letters:match[1].split(""),digits:match[2]};
    }

    doorKeys(code){
      const parsed=this.normalizeDoor(code);if(!parsed)return[];
      let digits=parsed.digits;
      if(!this.settings.readDoorLeadingZero){digits=digits.replace(/^0+(?=\d)/,"")||"0"}
      return[...parsed.letters.map(ch=>"letter_"+ch),...digits.split("").map(d=>"digit_"+d)];
    }

    bodySequence(item){
      const isRecall=["RECALL","DOOR_CHANGED"].includes(String(item?.callType||"").toUpperCase());
      const seq=[...(isRecall&&this.manifest?.files?.repeatAgain?["repeat"]:[]),"appointment",...this.appointmentKeys(item?.appointmentNo)];
      const mayReadDoor=item?.useDoor!==false&&this.settings.readDoor!==false;
      const doorKeys=mayReadDoor?this.doorKeys(item?.doorCode):[];
      if(doorKeys.length)seq.push("pleaseAt",...doorKeys);
      else seq.push("pleaseNoDoor");
      if(this.settings.playThanks)seq.push("thanks");
      return seq;
    }

    async playClip(key,gapMs=0){
      const buffer=await this.fetchBuffer(key);
      await new Promise((resolve,reject)=>{
        const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.masterGain);
        let settled=false;const done=()=>{if(settled)return;settled=true;resolve()};
        source.onended=done;source.start();
        setTimeout(()=>{if(!settled){settled=true;try{source.stop()}catch{}reject(new Error("เล่นเสียงใช้เวลานานเกินไป"))}},Math.max(5000,Math.ceil(buffer.duration*2500)));
      });
      if(gapMs>0)await this.sleep(gapMs);
    }

    gapFor(key,nextKey){
      const d=this.manifest?.playbackDefaults||{};
      if(key.startsWith("digit_")&&nextKey?.startsWith("digit_"))return Number(d.digitGapMs)||115;
      if(key.startsWith("letter_")&&nextKey?.startsWith("letter_"))return Number(d.letterGapMs)||105;
      if((key.startsWith("letter_")&&nextKey?.startsWith("digit_"))||(key.startsWith("digit_")&&nextKey?.startsWith("letter_")))return Number(d.letterGapMs)||105;
      return Number(d.phraseGapMs)||170;
    }

    async playSequence(keys){
      const usable=keys.filter(Boolean);
      for(let i=0;i<usable.length;i++)await this.playClip(usable[i],i<usable.length-1?this.gapFor(usable[i],usable[i+1]):0);
    }

    async announceNow(item,{force=false}={}){
      if(!force&&!this.settings.enabled)return false;
      if(!this.unlocked)throw new Error("กรุณากดเปิดเสียงที่จอคิวก่อน");
      if(!this.manifest)await this.loadManifest();
      if(!this.ready){await this.preload();this.ready=true}
      const body=this.bodySequence(item);
      for(let round=0;round<this.settings.repeatCount;round++){
        if(round>0){await this.sleep(this.settings.repeatDelaySeconds*1000);await this.playSequence(["repeat"])}
        const roundBody=round>0&&body[0]==="repeat"?body.slice(1):body;
        const seq=round===0&&this.settings.playDing?["ding",...roundBody]:roundBody;
        await this.playSequence(seq);
      }
      return true;
    }

    enqueue(item){
      if(!this.settings.enabled||!item)return false;
      const callId=String(item.callId||[item.autoId||item.appointmentNo||"",item.calledAt||item.receivingStartedAt||""].join(":"));
      if(callId&&this.pending.some(x=>x.callId===callId))return false;
      this.pending.push({callId,item:{...item}});
      this.processQueue();
      return true;
    }

    async processQueue(){
      if(this.processing||!this.unlocked||!this.settings.enabled)return;
      this.processing=true;
      try{
        while(this.pending.length&&this.settings.enabled){
          const next=this.pending.shift();this.currentCallId=next.callId;
          try{await this.announceNow(next.item)}catch(error){console.warn("queue voice announce failed",error?.message||error)}
        }
      }finally{this.currentCallId="";this.processing=false}
    }

    clearPending(){this.pending.length=0}
    sleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)))}
    status(){return{unlocked:this.unlocked,ready:this.ready,processing:this.processing,pending:this.pending.length,manifestVersion:this.manifestVersion}}
  }

  window.SmartQueueVoice=new QueueVoiceEngine();
})();
