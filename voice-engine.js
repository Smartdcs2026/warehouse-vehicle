"use strict";
(function(){
  const ENGINE_BUILD="2026.08.10-r83.5-faster-no-door";
  const CACHE_PREFIX="smartdc-queue-voice-";
  const DEFAULTS={
    enabled:false,volume:80,repeatCount:1,repeatDelaySeconds:7,
    readDoor:true,readDoorLeadingZero:false,readPlate:true,readProvince:true,
    playDing:true,playThanks:true,speechPace:"normal",provinceAliases:[],
    packId:"th-TH-standard-01",assetBasePath:"/voice/queue/th-TH/standard-01/",apiBaseUrl:""
  };
  const PACE_SCALE={compact:0.58,normal:0.76,clear:1.0};
  const BUILTIN_PROVINCE_ALIASES=[
    ["กทม","กรุงเทพมหานคร"],["กท","กรุงเทพมหานคร"],["กรุงเทพ","กรุงเทพมหานคร"],["กรุงเทพฯ","กรุงเทพมหานคร"],
    ["อยุธยา","พระนครศรีอยุธยา"],["อย","พระนครศรีอยุธยา"]
  ];

  class QueueVoiceEngine{
    constructor(){
      this.settings={...DEFAULTS};this.manifest=null;this.manifestVersion="";this.ctx=null;this.masterGain=null;
      this.buffers=new Map();this.unlocked=false;this.ready=false;this.pending=[];this.processing=false;this.currentCallId="";
    }

    configure(settings={}){
      const previousPack=String(this.settings.packId||"")+"|"+String(this.settings.assetBasePath||"");
      this.settings={...this.settings,...settings};
      this.settings.volume=Math.max(10,Math.min(100,Number(this.settings.volume)||80));
      this.settings.repeatCount=Math.max(1,Math.min(3,Math.round(Number(this.settings.repeatCount)||1)));
      this.settings.repeatDelaySeconds=Math.max(3,Math.min(30,Math.round(Number(this.settings.repeatDelaySeconds)||7)));
      this.settings.speechPace=["compact","normal","clear"].includes(String(this.settings.speechPace||""))?String(this.settings.speechPace):"normal";
      this.settings.provinceAliases=Array.isArray(this.settings.provinceAliases)?this.settings.provinceAliases:[];
      const nextPack=String(this.settings.packId||"")+"|"+String(this.settings.assetBasePath||"");
      if(previousPack!==nextPack){this.manifest=null;this.manifestVersion="";this.buffers.clear();this.ready=false;this.clearPending()}
      if(this.masterGain)this.masterGain.gain.value=this.settings.volume/100;
      return this.settings;
    }

    baseApi(){return String(this.settings.apiBaseUrl||window.APP_CONFIG?.apiBaseUrl||"").replace(/\/$/,"")}
    assetBase(){const path=String(this.settings.assetBasePath||DEFAULTS.assetBasePath);return this.baseApi()+"/"+path.replace(/^\/+/,"").replace(/\/?$/,"/")}
    manifestUrl(){return this.assetBase()+"voice-manifest.json"}

    async unlock(){
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw new Error("เครื่องนี้ไม่รองรับระบบเสียง");
      this.ctx=this.ctx||new AudioContextClass();if(this.ctx.state!=="running")await this.ctx.resume();
      if(!this.masterGain){this.masterGain=this.ctx.createGain();this.masterGain.connect(this.ctx.destination)}
      this.masterGain.gain.value=this.settings.volume/100;this.unlocked=true;return true;
    }

    async loadManifest(force=false){
      if(this.manifest&&!force)return this.manifest;
      const response=await fetch(this.manifestUrl(),{cache:"no-store",headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("ไม่พบชุดเสียงส่วนกลาง");
      const manifest=await response.json(),f=manifest?.files||{};
      if(!manifest||!f.digits||!f.letters||!f.appointment||!f.pleaseEnterDeliveryAt||!f.pleaseEnterDelivery)throw new Error("ข้อมูลชุดเสียงไม่สมบูรณ์ กรุณาอัปเดตชุดเสียงล่าสุด");
      const version=String(manifest.version||"1");if(this.manifestVersion&&this.manifestVersion!==version){this.buffers.clear();this.ready=false}
      this.manifest=manifest;this.manifestVersion=version;return manifest;
    }

    async unlockAndPrepare(){await this.unlock();await this.loadManifest(true);await this.preload();this.ready=true;return true}

    clipMap(){
      const f=this.manifest?.files||{},map={
        ding:f.ding,appointment:f.appointment,vehicleRegistration:f.vehicleRegistration,
        please:f.please,pleaseAt:f.pleaseEnterDeliveryAt,pleaseNoDoor:f.pleaseEnterDelivery,
        repeat:f.repeatAgain,recall:f.recall||f.optional?.recall,
        changeDoor:f.changeDoor||f.optional?.changeDoor,thanks:f.thankYou
      };
      for(const [digit,file] of Object.entries(f.digits||{}))map["digit_"+digit]=file;
      for(const [letter,file] of Object.entries(f.letters||{}))map["letter_"+String(letter).toUpperCase()]=file;
      for(const [province,file] of Object.entries(f.provinces||{}))map["province_"+province]=file;
      return map;
    }

    cacheName(){const pack=String(this.settings.packId||"pack").replace(/[^A-Za-z0-9._-]/g,"_"),version=String(this.manifestVersion||"current").replace(/[^A-Za-z0-9._-]/g,"_");return CACHE_PREFIX+pack+"-"+version}
    clipUrl(file){return this.assetBase()+encodeURIComponent(file).replace(/%2F/gi,"/")+"?v="+encodeURIComponent(this.manifestVersion||"1")}

    async fetchArrayBuffer(file){
      const url=this.clipUrl(file);
      if("caches" in window){const cache=await caches.open(this.cacheName()),hit=await cache.match(url);if(hit)return await hit.arrayBuffer();const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error("โหลดไฟล์เสียงไม่สำเร็จ: "+file);try{await cache.put(url,response.clone())}catch{}return await response.arrayBuffer()}
      const response=await fetch(url,{cache:"force-cache"});if(!response.ok)throw new Error("โหลดไฟล์เสียงไม่สำเร็จ: "+file);return await response.arrayBuffer();
    }

    async fetchBuffer(key){if(this.buffers.has(key))return this.buffers.get(key);const file=this.clipMap()[key];if(!file)throw new Error("ไม่พบเสียง: "+key);const arrayBuffer=await this.fetchArrayBuffer(file),buffer=await this.ctx.decodeAudioData(arrayBuffer.slice(0));this.buffers.set(key,buffer);return buffer}

    async preload(){
      const map=this.clipMap();
      // ชุดทะเบียนมีไฟล์มากกว่า 130 ไฟล์ จึงโหลดเฉพาะเสียงหลักก่อน ส่วนพยัญชนะ/จังหวัดโหลดเมื่อถูกเรียกจริง
      const keys=Object.keys(map).filter(key=>map[key]&&(key==="ding"||key==="appointment"||key==="vehicleRegistration"||key==="please"||key==="pleaseAt"||key==="pleaseNoDoor"||key==="repeat"||key==="recall"||key==="changeDoor"||key==="thanks"||key.startsWith("digit_")||key==="letter_R"||key==="letter_S"));
      await Promise.all(keys.map(key=>this.fetchBuffer(key)));
      if("caches" in window){try{const keep=this.cacheName(),names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==keep).map(n=>caches.delete(n)))}catch{}}
      return keys.length;
    }

    appointmentKeys(value){return String(value??"").replace(/\D/g,"").split("").filter(Boolean).map(d=>"digit_"+d)}

    normalizeDoor(code){let raw=String(code??"").toUpperCase().replace(/\s+/g,"");if(/^\d{1,3}$/.test(raw))raw="R"+raw;const match=raw.match(/^([RS]+)(\d{1,3})$/);if(!match)return null;return{letters:match[1].split(""),digits:match[2]}}
    doorKeys(code){const parsed=this.normalizeDoor(code);if(!parsed)return[];let digits=parsed.digits;if(!this.settings.readDoorLeadingZero)digits=digits.replace(/^0+(?=\d)/,"")||"0";return[...parsed.letters.map(ch=>"letter_"+ch),...digits.split("").map(d=>"digit_"+d)]}

    normalizeProvinceText(value){
      return String(value??"")
        .trim()
        .replace(/^(?:จังหวัด|จว\.?|จ\.)\s*/u,"")
        .replace(/^province\s*/i,"")
        .replace(/[.\s\-_/()]+/g,"")
        .replace(/ฯ/g,"")
        .toLowerCase();
    }
    provinceAliasMap(){
      const map=new Map(),available=Object.keys(this.manifest?.files?.provinces||{});
      const canonicalByKey=new Map();
      for(const p of available){
        const key=this.normalizeProvinceText(p);
        if(key){map.set(key,p);canonicalByKey.set(key,p)}
      }
      // Built-in aliases are always available, even when an old Admin setting stored [].
      for(const [alias,target] of BUILTIN_PROVINCE_ALIASES){
        const key=this.normalizeProvinceText(alias),targetKey=this.normalizeProvinceText(target),province=canonicalByKey.get(targetKey);
        if(key&&province)map.set(key,province);
      }
      // Admin aliases override built-ins.
      for(const row of this.settings.provinceAliases||[]){
        const alias=this.normalizeProvinceText(row?.alias),targetKey=this.normalizeProvinceText(row?.province),province=canonicalByKey.get(targetKey);
        if(alias&&province)map.set(alias,province);
      }
      return map;
    }
    resolveProvince(value){
      const key=this.normalizeProvinceText(value);if(!key)return null;
      const map=this.provinceAliasMap(),direct=map.get(key);if(direct)return direct;
      // Safe fallback: accept a shortened form only when it identifies exactly one province.
      if(key.length>=3){
        const available=Object.keys(this.manifest?.files?.provinces||{}),matches=available.filter(p=>{
          const canonical=this.normalizeProvinceText(p);
          return canonical.startsWith(key)||canonical.endsWith(key);
        });
        if(matches.length===1)return matches[0];
      }
      return null;
    }

    plateKeys(value){
      const raw=String(value??"").trim().toUpperCase();if(!raw)return[];
      const f=this.manifest?.files||{},letters=f.letters||{},out=[];let meaningful=0;
      for(const ch of Array.from(raw)){
        if(/[0-9]/.test(ch)){out.push("digit_"+ch);meaningful++;continue}
        if(Object.prototype.hasOwnProperty.call(letters,ch)){out.push("letter_"+ch);meaningful++;continue}
        if(/[\s\-–—./]/.test(ch))continue;
        // ตัวอักษรที่ไม่มีเสียงอาจทำให้ทะเบียนผิดความหมาย จึงข้ามการอ่านทะเบียนทั้งชุด
        if(/[A-Z\u0E01-\u0E5B]/u.test(ch))return[];
      }
      return meaningful?out:[];
    }

    identitySequence(item){
      const seq=["appointment",...this.appointmentKeys(item?.appointmentNo)];
      this.lastProvinceRaw=String(item?.province??"").trim();this.lastProvinceResolved=null;
      if(this.settings.readPlate===false)return seq;
      const f=this.manifest?.files||{},plate=this.plateKeys(item?.vehiclePlate);
      if(!f.vehicleRegistration||!plate.length)return seq;
      seq.push("vehicleRegistration",...plate);
      if(this.settings.readProvince!==false&&f.provinces){
        const province=this.resolveProvince(item?.province);this.lastProvinceResolved=province;
        if(province)seq.push("province_"+province);
        else if(this.lastProvinceRaw)console.warn("queue voice province not resolved",this.lastProvinceRaw);
      }
      return seq;
    }

    bodySequence(item,{includeCallPrefix=true}={}){
      const type=String(item?.callType||"").toUpperCase(),seq=[];
      if(includeCallPrefix&&["RECALL","DOOR_CHANGED"].includes(type)&&this.clipMap().recall)seq.push("recall");
      seq.push(...this.identitySequence(item));
      const mayReadDoor=item?.useDoor!==false&&this.settings.readDoor!==false,doorKeys=mayReadDoor?this.doorKeys(item?.doorCode):[];
      if(type==="DOOR_CHANGED"&&doorKeys.length&&this.clipMap().changeDoor)seq.push("changeDoor",...doorKeys);
      else if(doorKeys.length){
        if(this.clipMap().please)seq.push("please");
        seq.push("pleaseAt",...doorKeys);
      }else{
        if(this.clipMap().please)seq.push("please");
        seq.push("pleaseNoDoor");
      }
      if(this.settings.playThanks&&this.clipMap().thanks)seq.push("thanks");
      return seq;
    }

    async playClip(key,gapMs=0){
      const buffer=await this.fetchBuffer(key);await new Promise((resolve,reject)=>{const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.masterGain);let settled=false;const done=()=>{if(settled)return;settled=true;resolve()};source.onended=done;source.start();setTimeout(()=>{if(!settled){settled=true;try{source.stop()}catch{}reject(new Error("เล่นเสียงใช้เวลานานเกินไป"))}},Math.max(5000,Math.ceil(buffer.duration*2500)))});if(gapMs>0)await this.sleep(gapMs);
    }

    gapFor(key,nextKey){
      const d=this.manifest?.playbackDefaults||{},scale=PACE_SCALE[this.settings.speechPace]||1;let gap;
      if(key.startsWith("digit_")&&nextKey?.startsWith("digit_"))gap=Number(d.digitGapMs)||115;
      else if(key.startsWith("letter_")&&nextKey?.startsWith("letter_"))gap=Number(d.letterGapMs)||105;
      else if((key.startsWith("letter_")&&nextKey?.startsWith("digit_"))||(key.startsWith("digit_")&&nextKey?.startsWith("letter_")))gap=Number(d.letterGapMs)||105;
      else if(key.startsWith("province_"))gap=Number(d.provinceGapMs)||150;
      else gap=Number(d.phraseGapMs)||170;
      return Math.max(35,Math.round(gap*scale));
    }
    async playSequence(keys){const usable=keys.filter(key=>Boolean(key&&this.clipMap()[key]));for(let i=0;i<usable.length;i++)await this.playClip(usable[i],i<usable.length-1?this.gapFor(usable[i],usable[i+1]):0)}

    async announceNow(item,{force=false}={}){
      if(!force&&!this.settings.enabled)return false;if(!this.unlocked)throw new Error("กรุณากดเปิดเสียงที่จอคิวก่อน");if(!this.manifest)await this.loadManifest();if(!this.ready){await this.preload();this.ready=true}
      for(let round=0;round<this.settings.repeatCount;round++){
        if(round>0){await this.sleep(this.settings.repeatDelaySeconds*1000);if(this.clipMap().repeat)await this.playSequence(["repeat"])}
        const body=this.bodySequence(item,{includeCallPrefix:round===0});
        const seq=round===0&&this.settings.playDing&&this.clipMap().ding?["ding",...body]:body;await this.playSequence(seq);
      }
      return true;
    }

    enqueue(item){if(!this.settings.enabled||!item)return false;const callId=String(item.callId||[item.autoId||item.appointmentNo||"",item.calledAt||item.receivingStartedAt||""].join(":"));if(callId&&this.pending.some(x=>x.callId===callId))return false;this.pending.push({callId,item:{...item}});this.processQueue();return true}
    async processQueue(){if(this.processing||!this.unlocked||!this.settings.enabled)return;this.processing=true;try{while(this.pending.length&&this.settings.enabled){const next=this.pending.shift();this.currentCallId=next.callId;try{await this.announceNow(next.item)}catch(error){console.warn("queue voice announce failed",error?.message||error)}}}finally{this.currentCallId="";this.processing=false}}
    clearPending(){this.pending.length=0}
    sleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)))}
    status(){return{unlocked:this.unlocked,ready:this.ready,processing:this.processing,pending:this.pending.length,manifestVersion:this.manifestVersion,engineBuild:ENGINE_BUILD,lastProvinceRaw:this.lastProvinceRaw||"",lastProvinceResolved:this.lastProvinceResolved||null,readProvince:this.settings.readProvince!==false}}
  }

  window.SmartQueueVoice=new QueueVoiceEngine();
})();
