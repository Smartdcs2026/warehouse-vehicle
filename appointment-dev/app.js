(()=>{
  "use strict";
  const $=id=>document.getElementById(id), Core=window.AppointmentExcelCore;
  const BASE=window.APPOINTMENT_DEV_CONFIG||{};
  const STORAGE_KEY="warehouse_vehicle_appointment_dev_profile_v168";
  let lastResult=null;

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function loadConfig(){try{return {...clone(BASE),...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}}catch{return clone(BASE)}}
  let config=loadConfig();
  function saveConfig(){localStorage.setItem(STORAGE_KEY,JSON.stringify(config));renderConfigSummary()}
  function split(v){return String(v||"").split(/[\n,;|]+/).map(s=>s.trim()).filter(Boolean)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

  function bind(){
    $("fileInput").addEventListener("change",()=>parseFile($("fileInput").files?.[0]));
    $("saveSettings").addEventListener("click",readSettings);
    $("resetSettings").addEventListener("click",()=>{config=clone(BASE);saveConfig();populateSettings();showToast("คืนค่าเริ่มต้นแล้ว")});
    $("search").addEventListener("input",renderPreview);
    $("timeReference").addEventListener("change",()=>{$("refHint").textContent=`เวลาที่ใช้คำนวณเร็ว/สาย: ${$("timeReference").value}`});
    populateSettings();renderConfigSummary();runSelfTests();
  }

  function runSelfTests(){
    const tests=[
      Core.excelSerialToDate(1,false)==="1900-01-01",
      Core.excelSerialToDate(59,false)==="1900-02-28",
      Core.excelSerialToDate(61,false)==="1900-03-01",
      Core.excelSerialToDate(46252,false)==="2026-08-18",
      Core.parseDateCell({v:"18.08.2026"},{acceptedTextFormats:["DD.MM.YYYY"]}).value==="2026-08-18",
      Core.parseTimeCell({v:0.25}).value===360,
      Core.parseTimeCell({v:"14:30"}).value===870,
      Core.parseTextDate("08/09/26",["DD/MM/YYYY"]).ok===false
    ];
    const el=$("selfTest"),ok=tests.every(Boolean);el.textContent=ok?"Date/Time Parser: ผ่าน Self-test":"Date/Time Parser: ไม่ผ่าน Self-test";el.classList.toggle("bad",!ok);
  }

  function populateSettings(){
    $("sheetName").value=config.sheetName||"raw_data";$("sheetAliases").value=(config.sheetAliases||[]).join(", ");
    $("warehouseMode").value=config.warehouse?.matchMode||"STARTS_WITH";$("warehouseValues").value=(config.warehouse?.values||["906"]).join(", ");
    $("timeReference").value=config.timeReference||"PERIOD";$("refHint").textContent=`เวลาที่ใช้คำนวณเร็ว/สาย: ${$("timeReference").value}`;
    for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){
      $("h_"+key).value=config.fields?.[key]?.header||"";$("a_"+key).value=(config.fields?.[key]?.aliases||[]).join(", ");
    }
  }
  function readSettings(){
    const c=clone(config);c.sheetName=$("sheetName").value.trim()||"raw_data";c.sheetAliases=split($("sheetAliases").value);c.warehouse={...(c.warehouse||{}),matchMode:$("warehouseMode").value,values:split($("warehouseValues").value).map(x=>x.toUpperCase())};c.timeReference=$("timeReference").value;
    c.fields=c.fields||{};for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){c.fields[key]={...(c.fields[key]||{}),header:$("h_"+key).value.trim(),aliases:split($("a_"+key).value)}}
    config=Core.normalizeConfig(c);saveConfig();showToast("บันทึกค่าทดสอบแล้ว");
  }

  function renderConfigSummary(){
    $("build").textContent=BASE.build||"round168";
    $("profileSummary").textContent=`Sheet ${config.sheetName||"raw_data"} · คลัง ${(config.warehouse?.matchMode||"STARTS_WITH")==="EXACT"?"ตรงกับ":"ขึ้นต้นด้วย"} ${(config.warehouse?.values||[]).join(", ")} · อ้างอิง ${config.timeReference||"PERIOD"}`;
  }

  async function parseFile(file){
    if(!file)return;readSettings();
    if(!/\.(xlsb|xlsx)$/i.test(file.name)){showError("รองรับเฉพาะ .xlsb และ .xlsx ในรอบนี้");return}
    setBusy(true,"กำลังเตรียมไฟล์");clearResult();
    try{
      const buffer=await file.arrayBuffer();
      const worker=new Worker("./excel-worker.js?v=20260817-r168");
      worker.onmessage=e=>{
        const m=e.data||{};
        if(m.type==="PROGRESS")setBusy(true,m.message||"กำลังอ่านไฟล์");
        if(m.type==="ERROR"){worker.terminate();setBusy(false);showError(m.message||"อ่านไฟล์ไม่สำเร็จ")}
        if(m.type==="RESULT"){worker.terminate();setBusy(false);lastResult=m.result;renderResult()}
      };
      worker.onerror=e=>{worker.terminate();setBusy(false);showError(e.message||"Excel Worker ทำงานไม่สำเร็จ")};
      worker.postMessage({type:"PARSE",buffer,fileName:file.name,config},[buffer]);
    }catch(e){setBusy(false);showError(e.message||"เปิดไฟล์ไม่สำเร็จ")}
  }
  function setBusy(on,text=""){const box=$("progress");box.hidden=!on;if(on)box.textContent=text}
  function clearResult(){lastResult=null;$("result").hidden=true;$("errorBox").hidden=true}
  function showError(msg){$("errorBox").hidden=false;$("errorBox").textContent=msg}
  function showToast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.hidden=true,1800)}

  function modeText(obj){const entries=Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]);return entries.length?entries.map(([k,v])=>`${k} ${v.toLocaleString()}`).join(" · "):"-"}
  function renderResult(){
    const r=lastResult;if(!r)return;$("result").hidden=false;$("errorBox").hidden=true;
    $("fileMeta").textContent=`${r.fileName} · SHA-256 ${r.fileHash.slice(0,12)}…`;
    $("sheetMeta").textContent=`${r.sourceSheet} · หัวตารางแถว ${r.headerRow} · ${r.sheetResolution}`;
    $("dateSystem").textContent=r.workbookDate1904?"Excel 1904":"Excel 1900 / ข้อความ";
    $("sourceRows").textContent=r.stats.sourceRows.toLocaleString();$("warehouseRows").textContent=r.stats.warehouseRows.toLocaleString();$("appointmentCount").textContent=r.totalAppointments.toLocaleString();$("invalidRows").textContent=r.stats.invalidRows.toLocaleString();
    $("dateRange").textContent=r.dateRange?.length?`${Core.displayDate(r.dateRange[0])} – ${Core.displayDate(r.dateRange[1])}`:"-";
    $("dateModes").textContent=modeText(r.stats.dateModes);$("periodModes").textContent=modeText(r.stats.periodModes);$("fromModes").textContent=modeText(r.stats.fromModes);$("toModes").textContent=modeText(r.stats.toModes);
    const warnings=r.appointments.reduce((n,a)=>n+(a.warnings?.length?1:0),0);$("warningCount").textContent=warnings.toLocaleString();
    renderPreview();renderErrors();
  }
  function renderPreview(){
    const body=$("previewBody");if(!lastResult){body.innerHTML="";return}const q=$("search").value.trim().toLowerCase();
    const list=lastResult.appointments.filter(a=>!q||[a.appointment,a.dc,a.date,...a.vendors,...a.carriers,...a.pos].join(" ").toLowerCase().includes(q)).slice(0,300);
    body.innerHTML=list.map(a=>`<tr class="${a.warnings?.length?"warn-row":""}"><td>${esc(a.dc)}</td><td>${esc(a.appointment)}</td><td>${Core.displayDate(a.date)}</td><td>${Core.displayTime(a.period)}</td><td>${Core.displayTime(a.from)}</td><td>${Core.displayTime(a.to)}</td><td><b>${a.referenceType}</b><br>${Core.displayTime(a.referenceMinute)}</td><td>${esc(a.vendors.join(" / ")||"-")}</td><td>${esc(a.carriers.join(" / ")||"-")}</td><td>${a.pos.length}</td><td>${a.sourceRows}</td><td>${esc((a.warnings||[]).join(" · ")||"-")}</td></tr>`).join("")||`<tr><td colspan="12" class="empty">ไม่พบข้อมูล</td></tr>`;
    $("shownCount").textContent=`แสดง ${list.length.toLocaleString()} / ${lastResult.totalAppointments.toLocaleString()} Appointment`;
  }
  function renderErrors(){const body=$("errorBody"),errors=(lastResult?.errors||[]).slice(0,100);body.innerHTML=errors.map(e=>`<tr><td>${e.row}</td><td>${esc(e.dc||"-")}</td><td>${esc(e.appointment||"-")}</td><td>${esc(e.rawDate||"-")}</td><td>${esc(e.message)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty ok">ไม่พบแถวผิดรูปแบบของคลังที่เลือก</td></tr>`}

  document.addEventListener("DOMContentLoaded",bind);
})();
