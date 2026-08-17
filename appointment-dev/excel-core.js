(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.AppointmentExcelCore=api;
})(typeof self!=="undefined"?self:globalThis,function(){
  "use strict";

  const DAY_MS=86400000;

  function cleanText(value){
    return String(value??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
  }
  function normalizeHeader(value){return cleanText(value).toUpperCase()}
  function uniqueStrings(value){
    const arr=Array.isArray(value)?value:String(value??"").split(/[\n,;|]+/),out=[],seen=new Set();
    for(const item of arr){const s=cleanText(item);if(!s)continue;const k=s.toUpperCase();if(seen.has(k))continue;seen.add(k);out.push(s)}
    return out;
  }
  function fieldCandidates(field){return uniqueStrings([field?.header,...(field?.aliases||[])])}
  function pad2(n){return String(n).padStart(2,"0")}
  function isLeap(y){return y%4===0&&(y%100!==0||y%400===0)}
  function daysInMonth(y,m){return [31,isLeap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m-1]||0}
  function validYmd(y,m,d){return Number.isInteger(y)&&Number.isInteger(m)&&Number.isInteger(d)&&y>=1900&&y<=2200&&m>=1&&m<=12&&d>=1&&d<=daysInMonth(y,m)}
  function ymd(y,m,d){return `${String(y).padStart(4,"0")}-${pad2(m)}-${pad2(d)}`}

  function excelSerialToDate(serial,date1904){
    const n=Number(serial);if(!Number.isFinite(n))return null;
    const whole=Math.floor(n);
    if(date1904){
      const dt=new Date(Date.UTC(1904,0,1)+whole*DAY_MS);
      return ymd(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
    }
    if(whole===60)return null; // Excel's fictitious 1900-02-29: reject instead of guessing.
    const adjusted=whole>60?whole-1:whole;
    const dt=new Date(Date.UTC(1899,11,31)+adjusted*DAY_MS);
    return ymd(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
  }

  function parseTextDate(text,acceptedFormats){
    const s=cleanText(text),formats=new Set(acceptedFormats||["DD.MM.YYYY","DD/MM/YYYY","YYYY-MM-DD"]);
    let m;
    if(formats.has("DD.MM.YYYY")&&(m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))){
      const d=+m[1],mo=+m[2],y=+m[3];return validYmd(y,mo,d)?{ok:true,value:ymd(y,mo,d),mode:"TEXT_DD.MM.YYYY"}:{ok:false,reason:"วันที่ไม่ถูกต้อง"};
    }
    if(formats.has("DD/MM/YYYY")&&(m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))){
      const d=+m[1],mo=+m[2],y=+m[3];return validYmd(y,mo,d)?{ok:true,value:ymd(y,mo,d),mode:"TEXT_DD/MM/YYYY"}:{ok:false,reason:"วันที่ไม่ถูกต้อง"};
    }
    if(formats.has("YYYY-MM-DD")&&(m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){
      const y=+m[1],mo=+m[2],d=+m[3];return validYmd(y,mo,d)?{ok:true,value:ymd(y,mo,d),mode:"TEXT_YYYY-MM-DD"}:{ok:false,reason:"วันที่ไม่ถูกต้อง"};
    }
    return {ok:false,reason:s?"รูปแบบวันที่ไม่อยู่ในรายการที่อนุญาต":"วันที่ว่าง"};
  }

  function parseDateCell(cell,opts={}){
    const v=cell?.v;
    if(v instanceof Date&&!Number.isNaN(v.getTime())){
      const y=v.getUTCFullYear(),m=v.getUTCMonth()+1,d=v.getUTCDate();
      return validYmd(y,m,d)?{ok:true,value:ymd(y,m,d),mode:"DATE_OBJECT",raw:safeRaw(cell)}:{ok:false,reason:"Date object ไม่ถูกต้อง",raw:safeRaw(cell)};
    }
    if(typeof v==="number"&&Number.isFinite(v)){
      if(Number.isInteger(v)&&v>=19000101&&v<=22001231){
        const s=String(v),y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6,8);
        if(validYmd(y,m,d))return {ok:true,value:ymd(y,m,d),mode:"NUMBER_YYYYMMDD",raw:safeRaw(cell)};
      }
      const ds=String(opts.dateSystem||"AUTO").toUpperCase();
      const date1904=ds==="1904"?true:ds==="1900"?false:!!opts.workbookDate1904;
      const value=excelSerialToDate(v,date1904);
      return value?{ok:true,value,mode:date1904?"EXCEL_SERIAL_1904":"EXCEL_SERIAL_1900",raw:safeRaw(cell)}:{ok:false,reason:"Excel serial date ไม่ถูกต้องหรือเป็น 1900-02-29",raw:safeRaw(cell)};
    }
    const parsed=parseTextDate(v,opts.acceptedTextFormats);
    return {...parsed,raw:safeRaw(cell)};
  }

  function parseTimeText(text){
    const s=cleanText(text);if(!s)return {ok:false,reason:"เวลาว่าง"};
    let m=s.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
    if(!m)return {ok:false,reason:"รูปแบบเวลาไม่ถูกต้อง"};
    const h=+m[1],min=+m[2],sec=+(m[3]||0);
    if(h<0||h>23||min<0||min>59||sec<0||sec>59)return {ok:false,reason:"เวลาอยู่นอกช่วง 00:00-23:59"};
    return {ok:true,value:h*60+min,mode:"TEXT_TIME",seconds:sec};
  }
  function looksLikeTimeFormat(z){return /(^|[^a-z])[hms]+([^a-z]|$)/i.test(String(z||""))}
  function parseTimeCell(cell){
    const v=cell?.v;
    if(typeof v==="number"&&Number.isFinite(v)){
      if(v>=0&&v<1){
        let mins=Math.round(v*1440);if(mins===1440)mins=0;
        return {ok:true,value:mins,mode:"EXCEL_FRACTION",raw:safeRaw(cell)};
      }
      const frac=((v%1)+1)%1;
      if(frac>0&&looksLikeTimeFormat(cell?.z)){
        let mins=Math.round(frac*1440);if(mins===1440)mins=0;
        return {ok:true,value:mins,mode:"EXCEL_DATETIME_FRACTION",raw:safeRaw(cell)};
      }
      return {ok:false,reason:"ค่าตัวเลขเวลาไม่ใช่ Excel time fraction",raw:safeRaw(cell)};
    }
    const p=parseTimeText(v);return {...p,raw:safeRaw(cell)};
  }

  function safeRaw(cell){
    const v=cell?.v;
    if(v instanceof Date)return v.toISOString();
    if(v===undefined||v===null)return "";
    if(typeof v==="number")return Number.isFinite(v)?String(v):"";
    return cleanText(v);
  }

  function identityCell(cell){
    const v=cell?.v,w=cleanText(cell?.w);
    if(typeof v==="number"&&Number.isFinite(v)){
      if(Number.isInteger(v)){
        if(w&&/^\d+$/.test(w.replace(/,/g,""))&&!/[eE][+-]?\d/.test(w))return w.replace(/,/g,"");
        return String(Math.trunc(v));
      }
      return cleanText(w||String(v));
    }
    return cleanText(v);
  }
  function displayTime(minute){if(!Number.isInteger(minute)||minute<0||minute>1439)return "-";return `${pad2(Math.floor(minute/60))}:${pad2(minute%60)}`}
  function displayDate(iso){const m=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:"-"}

  function normalizeConfig(input){
    const cfg=JSON.parse(JSON.stringify(input||{}));
    cfg.sheetName=cleanText(cfg.sheetName||"raw_data");cfg.sheetAliases=uniqueStrings(cfg.sheetAliases||[]);
    cfg.warehouse=cfg.warehouse||{};cfg.warehouse.matchMode=String(cfg.warehouse.matchMode||"STARTS_WITH").toUpperCase();cfg.warehouse.values=uniqueStrings(cfg.warehouse.values||["906"]).map(v=>v.toUpperCase());
    cfg.timeReference=String(cfg.timeReference||"PERIOD").toUpperCase()==="FROM"?"FROM":"PERIOD";
    cfg.date=cfg.date||{};cfg.date.dateSystem=String(cfg.date.dateSystem||"AUTO").toUpperCase();cfg.date.acceptedTextFormats=uniqueStrings(cfg.date.acceptedTextFormats||["DD.MM.YYYY","DD/MM/YYYY","YYYY-MM-DD"]);
    cfg.fields=cfg.fields||{};
    for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){cfg.fields[key]=cfg.fields[key]||{};cfg.fields[key].header=cleanText(cfg.fields[key].header);cfg.fields[key].aliases=uniqueStrings(cfg.fields[key].aliases||[])}
    return cfg;
  }
  function warehouseMatches(dc,cfg){
    const value=cleanText(dc).toUpperCase(),values=cfg?.warehouse?.values||[];if(!value||!values.length)return false;
    if(cfg.warehouse.matchMode==="EXACT")return values.includes(value);
    return values.some(prefix=>value.startsWith(prefix));
  }

  function buildHeaderMap(headerCells,cfg){
    const normalized=headerCells.map(c=>normalizeHeader(c?.v));const map={},missing=[];
    for(const [key,field] of Object.entries(cfg.fields)){
      const candidates=fieldCandidates(field).map(normalizeHeader).filter(Boolean);let idx=-1;
      for(const candidate of candidates){idx=normalized.indexOf(candidate);if(idx>=0)break}
      if(idx>=0)map[key]=idx;else missing.push(key);
    }
    return {map,missing,headers:normalized};
  }
  function headerScore(headerCells,cfg){
    const {map}=buildHeaderMap(headerCells,cfg),keys=Object.keys(map),required=["dc","date","appointment"],requiredHits=required.filter(k=>k in map).length;
    return {score:keys.length,requiredHits,map};
  }

  function aggregateNormalizedRows(rows,cfg){
    const groups=new Map(),errors=[],stats={sourceRows:0,warehouseRows:0,validRows:0,invalidRows:0,dateModes:{},periodModes:{},fromModes:{},toModes:{}};
    const refKey=cfg.timeReference==="FROM"?"from":"period";
    for(const row of rows){
      stats.sourceRows++;
      const dc=identityCell(row.dc);if(!warehouseMatches(dc,cfg))continue;stats.warehouseRows++;
      const appointment=identityCell(row.appointment),po=identityCell(row.po),vendor=cleanText(row.vendor?.v),carrier=cleanText(row.carrier?.v);
      const date=parseDateCell(row.date,{dateSystem:cfg.date.dateSystem,workbookDate1904:cfg.workbookDate1904,acceptedTextFormats:cfg.date.acceptedTextFormats});
      const period=parseTimeCell(row.period),from=parseTimeCell(row.from),to=parseTimeCell(row.to),ref=refKey==="from"?from:period;
      const rowNo=row.__row||0,rowErrors=[];
      if(!dc)rowErrors.push("รหัสคลังว่าง");if(!appointment)rowErrors.push("Appointment ว่าง");if(!date.ok)rowErrors.push(`DATE: ${date.reason}`);if(!ref.ok)rowErrors.push(`${cfg.timeReference}: ${ref.reason}`);
      if(rowErrors.length){stats.invalidRows++;errors.push({row:rowNo,appointment,dc,message:rowErrors.join(" · "),rawDate:date.raw||""});continue}
      stats.validRows++;inc(stats.dateModes,date.mode);if(period.ok)inc(stats.periodModes,period.mode);if(from.ok)inc(stats.fromModes,from.mode);if(to.ok)inc(stats.toModes,to.mode);
      const key=`${dc}\u001f${date.value}\u001f${appointment}`;
      let g=groups.get(key);
      if(!g){g={key,dc,appointment,date:date.value,period:period.ok?period.value:null,from:from.ok?from.value:null,to:to.ok?to.value:null,referenceType:cfg.timeReference,referenceMinute:ref.value,pos:new Set(),vendors:new Set(),carriers:new Set(),sourceRows:0,warnings:[],raw:{date:date.raw,period:period.raw,from:from.raw,to:to.raw}};groups.set(key,g)}
      else{
        checkConflict(g,"period",period.ok?period.value:null,rowNo);checkConflict(g,"from",from.ok?from.value:null,rowNo);checkConflict(g,"to",to.ok?to.value:null,rowNo);
        if(g.referenceMinute!==ref.value&&!g.warnings.some(w=>w.includes("เวลาอ้างอิง")))g.warnings.push(`เวลาอ้างอิงไม่ตรงกันใน Appointment เดียวกัน (พบที่แถว ${rowNo})`);
      }
      g.sourceRows++;if(po)g.pos.add(po);if(vendor)g.vendors.add(vendor);if(carrier)g.carriers.add(carrier);
    }
    const appointments=[...groups.values()].map(g=>({...g,pos:[...g.pos],vendors:[...g.vendors],carriers:[...g.carriers]})).sort((a,b)=>a.date.localeCompare(b.date)||a.referenceMinute-b.referenceMinute||a.appointment.localeCompare(b.appointment,undefined,{numeric:true}));
    return {appointments,errors,stats};
  }
  function checkConflict(g,key,value,rowNo){if(value===null||value===undefined)return;if(g[key]===null||g[key]===undefined){g[key]=value;return}if(g[key]!==value&&!g.warnings.some(w=>w.startsWith(key)))g.warnings.push(`${key.toUpperCase()} ไม่ตรงกันใน Appointment เดียวกัน (พบที่แถว ${rowNo})`)}
  function inc(obj,key){obj[key]=(obj[key]||0)+1}

  return {cleanText,normalizeHeader,uniqueStrings,fieldCandidates,excelSerialToDate,parseTextDate,parseDateCell,parseTimeText,parseTimeCell,identityCell,displayTime,displayDate,normalizeConfig,warehouseMatches,buildHeaderMap,headerScore,aggregateNormalizedRows,safeRaw};
});
