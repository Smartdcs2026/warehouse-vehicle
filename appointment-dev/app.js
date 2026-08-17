(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const Core=window.AppointmentExcelCore;
  const BASE=window.APPOINTMENT_DEV_CONFIG||{};
  const STORAGE_KEY="warehouse_vehicle_appointment_dev_profile_v169";
  const OLD_STORAGE_KEY="warehouse_vehicle_appointment_dev_profile_v168";
  const TOKEN_KEY="warehouse_vehicle_appointment_dev_token";
  let lastResult=null;

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function deepMerge(base,extra){
    if(!extra||typeof extra!=="object"||Array.isArray(extra))return extra===undefined?clone(base):clone(extra);
    const out=(base&&typeof base==="object"&&!Array.isArray(base))?clone(base):{};
    for(const [k,v] of Object.entries(extra))out[k]=(v&&typeof v==="object"&&!Array.isArray(v))?deepMerge(out[k],v):clone(v);
    return out;
  }
  function loadConfig(){
    try{
      const saved=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY)||"{}";
      return Core.normalizeConfig(deepMerge(BASE,JSON.parse(saved)));
    }catch{return Core.normalizeConfig(clone(BASE))}
  }
  let config=loadConfig();
  function saveConfig(){localStorage.setItem(STORAGE_KEY,JSON.stringify(config));renderConfigSummary();applyControls()}
  function split(v){return String(v||"").split(/[\n,;|]+/).map(s=>s.trim()).filter(Boolean)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

  function bind(){
    $("fileInput").addEventListener("change",()=>parseFile($("fileInput").files?.[0]));
    $("saveSettings").addEventListener("click",readSettings);
    $("resetSettings").addEventListener("click",()=>{config=Core.normalizeConfig(clone(BASE));saveConfig();populateSettings();clearResult();showToast("คืนค่าเริ่มต้นแล้ว")});
    $("search").addEventListener("input",renderPreview);
    $("importButton").addEventListener("click",importData);
    populateSettings();renderConfigSummary();applyControls();
    if(!runSelfTests())showError("การตรวจวันที่และเวลาไม่ผ่าน กรุณาหยุดใช้งานหน้านี้ก่อน");
  }

  function runSelfTests(){
    try{
      return [
        Core.excelSerialToDate(1,false)==="1900-01-01",
        Core.excelSerialToDate(59,false)==="1900-02-28",
        Core.excelSerialToDate(61,false)==="1900-03-01",
        Core.excelSerialToDate(46252,false)==="2026-08-18",
        Core.parseDateCell({v:"18.08.2026"},{acceptedTextFormats:["DD.MM.YYYY"]}).value==="2026-08-18",
        Core.parseTimeCell({v:0.25}).value===360,
        Core.parseTimeCell({v:"14:30"}).value===870,
        Core.parseTextDate("08/09/26",["DD/MM/YYYY"]).ok===false
      ].every(Boolean);
    }catch{return false}
  }

  function populateSettings(){
    const c=config.controls||{},d=config.display||{};
    $("moduleEnabled").checked=c.moduleEnabled!==false;
    $("uploadEnabled").checked=c.uploadEnabled!==false;
    $("useImportedData").checked=!!c.useImportedData;
    $("sheetName").value=config.sheetName||"raw_data";
    $("sheetAliases").value=(config.sheetAliases||[]).join(", ");
    $("warehouseMode").value=config.warehouse?.matchMode||"STARTS_WITH";
    $("warehouseValues").value=(config.warehouse?.values||["906"]).join(", ");
    $("timeReference").value=config.timeReference||"PERIOD";
    for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){
      $("h_"+key).value=config.fields?.[key]?.header||"";
      $("a_"+key).value=(config.fields?.[key]?.aliases||[]).join(", ");
    }
    for(const key of ["Period","From","To","Vendor","Carrier","Po"])$("show"+key).checked=d["show"+key]!==false;
  }

  function readSettings(){
    const c=clone(config);
    c.controls={moduleEnabled:$("moduleEnabled").checked,uploadEnabled:$("uploadEnabled").checked,useImportedData:$("useImportedData").checked};
    c.sheetName=$("sheetName").value.trim()||"raw_data";
    c.sheetAliases=split($("sheetAliases").value);
    c.warehouse={...(c.warehouse||{}),matchMode:$("warehouseMode").value,values:split($("warehouseValues").value).map(x=>x.toUpperCase())};
    c.timeReference=$("timeReference").value;
    c.fields=c.fields||{};
    for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){
      c.fields[key]={...(c.fields[key]||{}),header:$("h_"+key).value.trim(),aliases:split($("a_"+key).value)};
    }
    c.display={showPeriod:$("showPeriod").checked,showFrom:$("showFrom").checked,showTo:$("showTo").checked,showVendor:$("showVendor").checked,showCarrier:$("showCarrier").checked,showPo:$("showPo").checked};
    config=Core.normalizeConfig(c);config.controls=c.controls;config.display=c.display;config.importApi=c.importApi||BASE.importApi||{};
    saveConfig();showToast("บันทึกแล้ว");
    if(lastResult)renderResult();
  }

  function renderConfigSummary(){
    const mode=config.warehouse?.matchMode==="EXACT"?"ตรงกับ":"ขึ้นต้นด้วย";
    $("profileSummary").textContent=`คลัง ${mode} ${(config.warehouse?.values||[]).join(", ")} · เทียบเวลาจาก ${config.timeReference||"PERIOD"}`;
  }

  function applyControls(){
    const c=config.controls||{};
    const moduleOn=c.moduleEnabled!==false,uploadOn=moduleOn&&c.uploadEnabled!==false;
    $("moduleOff").hidden=moduleOn;
    $("uploadPanel").hidden=!moduleOn;
    $("fileButton").classList.toggle("disabled",!uploadOn);
    $("fileInput").disabled=!uploadOn;
    if(!moduleOn)clearResult();
    const api=config.importApi||{};
    $("importPanel").hidden=!(moduleOn&&uploadOn&&api.enabled&&String(api.baseUrl||"").trim()&&lastResult&&getIssueCount()===0);
  }

  async function parseFile(file){
    if(!file)return;
    readSettings();
    if(config.controls?.moduleEnabled===false||config.controls?.uploadEnabled===false){showError("ขณะนี้ปิดการอัปโหลด");return}
    if(!/\.(xlsb|xlsx)$/i.test(file.name)){showError("ไฟล์นี้ไม่รองรับ");return}
    setBusy(true,"กำลังอ่านข้อมูล");clearResult();
    try{
      const buffer=await file.arrayBuffer();
      const worker=new Worker("./excel-worker.js?v=20260817-r169");
      worker.onmessage=e=>{
        const m=e.data||{};
        if(m.type==="PROGRESS")setBusy(true,m.message||"กำลังตรวจข้อมูล");
        if(m.type==="ERROR"){worker.terminate();setBusy(false);showError(m.message||"อ่านไฟล์ไม่สำเร็จ")}
        if(m.type==="RESULT"){worker.terminate();setBusy(false);lastResult=m.result;renderResult()}
      };
      worker.onerror=e=>{worker.terminate();setBusy(false);showError(e.message||"อ่านไฟล์ไม่สำเร็จ")};
      worker.postMessage({type:"PARSE",buffer,fileName:file.name,config},[buffer]);
    }catch(e){setBusy(false);showError(e.message||"เปิดไฟล์ไม่สำเร็จ")}
  }

  function setBusy(on,text=""){const box=$("progress");box.hidden=!on;if(on)box.textContent=text}
  function clearResult(){lastResult=null;$("result").hidden=true;$("errorBox").hidden=true;$("importResult").hidden=true;applyControlsSafe()}
  function applyControlsSafe(){try{const api=config.importApi||{};$("importPanel").hidden=!(api.enabled&&api.baseUrl&&lastResult&&getIssueCount()===0)}catch{}}
  function showError(msg){$("errorBox").hidden=false;$("errorBox").textContent=msg}
  function showToast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.hidden=true,1800)}
  function getWarningCount(){return (lastResult?.appointments||[]).reduce((n,a)=>n+(a.warnings?.length?1:0),0)}
  function getIssueCount(){return (lastResult?.stats?.invalidRows||0)+getWarningCount()}

  function renderResult(){
    const r=lastResult;if(!r)return;
    $("result").hidden=false;$("errorBox").hidden=true;
    $("sourceRows").textContent=r.stats.sourceRows.toLocaleString();
    $("warehouseRows").textContent=r.stats.warehouseRows.toLocaleString();
    $("appointmentCount").textContent=r.totalAppointments.toLocaleString();
    const issues=getIssueCount();$("issueCount").textContent=issues.toLocaleString();
    $("fileName").textContent=r.fileName;
    $("fileRange").textContent=r.dateRange?.length?`${Core.displayDate(r.dateRange[0])} – ${Core.displayDate(r.dateRange[1])} · ${r.sourceSheet}`:r.sourceSheet;
    $("fileStatus").textContent=issues?"มีรายการต้องตรวจ":"พร้อมใช้งาน";
    $("fileStatus").classList.toggle("warn",!!issues);
    $("issuePanel").hidden=!issues;
    $("issueSummary").textContent=issues?`${issues.toLocaleString()} รายการ`:"";
    renderPreview();renderErrors();applyControls();
  }

  function visibleColumns(){
    const d=config.display||{};
    return [
      ["appointment","Appointment",a=>esc(a.appointment)],
      ["date","วันที่",a=>Core.displayDate(a.date)],
      ...(d.showPeriod!==false?[["period","PERIOD",a=>Core.displayTime(a.period)]]:[]),
      ...(d.showFrom!==false?[["from","FROM",a=>Core.displayTime(a.from)]]:[]),
      ...(d.showTo!==false?[["to","TO",a=>Core.displayTime(a.to)]]:[]),
      ...(d.showVendor!==false?[["vendor","บริษัท",a=>esc(a.vendors.join(" / ")||"-")]]:[]),
      ...(d.showCarrier!==false?[["carrier","Carrier",a=>esc(a.carriers.join(" / ")||"-")]]:[]),
      ...(d.showPo!==false?[["po","PO",a=>a.pos.length.toLocaleString()]]:[])
    ];
  }

  function renderPreview(){
    const body=$("previewBody");if(!lastResult){body.innerHTML="";return}
    const q=$("search").value.trim().toLowerCase();
    const list=lastResult.appointments.filter(a=>!q||[a.appointment,a.dc,a.date,...a.vendors,...a.carriers,...a.pos].join(" ").toLowerCase().includes(q)).slice(0,400);
    const cols=visibleColumns();$("previewHead").innerHTML=cols.map(c=>`<th>${c[1]}</th>`).join("");
    body.innerHTML=list.map(a=>`<tr class="${a.warnings?.length?"warn-row":""}">${cols.map(c=>`<td>${c[2](a)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${cols.length}" class="empty">ไม่พบข้อมูล</td></tr>`;
    $("shownCount").textContent=`แสดง ${list.length.toLocaleString()} จาก ${lastResult.totalAppointments.toLocaleString()} นัดหมาย`;
  }

  function renderErrors(){
    const body=$("errorBody"),errors=(lastResult?.errors||[]).slice(0,150);
    const warnRows=(lastResult?.appointments||[]).filter(a=>a.warnings?.length).slice(0,150).map(a=>({row:"-",dc:a.dc,appointment:a.appointment,rawDate:Core.displayDate(a.date),message:a.warnings.join(" · ")}));
    const all=[...errors,...warnRows];
    body.innerHTML=all.map(e=>`<tr><td>${esc(e.row)}</td><td>${esc(e.dc||"-")}</td><td>${esc(e.appointment||"-")}</td><td>${esc(e.rawDate||"-")}</td><td>${esc(e.message)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">ไม่มีรายการที่ต้องตรวจ</td></tr>`;
  }

  function apiUrl(path){return String(config.importApi?.baseUrl||"").replace(/\/+$/,"")+path}
  function getToken(){
    let token=sessionStorage.getItem(TOKEN_KEY)||"";
    if(!token){token=window.prompt("รหัสสำหรับการทดสอบ")||"";if(token)sessionStorage.setItem(TOKEN_KEY,token)}
    return token;
  }
  async function apiPost(path,body,token){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
    try{
      const res=await fetch(apiUrl(path),{method:"POST",headers:{"Content-Type":"application/json","X-Dev-Token":token},body:JSON.stringify(body),signal:ctrl.signal});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"บันทึกข้อมูลไม่สำเร็จ");
      return data;
    }finally{clearTimeout(timer)}
  }

  function itemForImport(a){return {dc:a.dc,appointment:a.appointment,date:a.date,period:a.period,from:a.from,to:a.to,referenceType:a.referenceType,referenceMinute:a.referenceMinute,vendors:a.vendors,carriers:a.carriers,lines:a.lines||[],raw:a.raw||{}}}

  async function importData(){
    if(!lastResult||getIssueCount()>0)return;
    const token=getToken();if(!token)return;
    const btn=$("importButton");btn.disabled=true;$("importResult").hidden=true;
    try{
      setBusy(true,"กำลังเตรียมนำเข้า");
      const start=await apiPost("/import/start",{fileHash:lastResult.fileHash,fileName:lastResult.fileName,sourceSheet:lastResult.sourceSheet,dateFrom:lastResult.dateRange?.[0]||null,dateTo:lastResult.dateRange?.[1]||null,totalAppointments:lastResult.totalAppointments,warehouseRule:{mode:config.warehouse?.matchMode,values:config.warehouse?.values},timeReference:config.timeReference},token);
      if(start.duplicate&&start.status==="COMPLETE"){
        setBusy(false);showImportResult("ไฟล์นี้เคยนำเข้าแล้ว",start.counts);return;
      }
      const batchSize=Math.max(10,Math.min(100,Number(config.importApi?.batchSize)||50));
      const items=lastResult.appointments.map(itemForImport);let batchNo=start.nextBatch||0;
      for(let offset=batchNo*batchSize;offset<items.length;offset+=batchSize,batchNo++){
        const batch=items.slice(offset,offset+batchSize);
        setBusy(true,`กำลังบันทึก ${Math.min(offset+batch.length,items.length).toLocaleString()} / ${items.length.toLocaleString()}`);
        await apiPost("/import/batch",{importId:start.importId,batchNo,items:batch},token);
      }
      const done=await apiPost("/import/complete",{importId:start.importId},token);
      setBusy(false);showImportResult("นำเข้าข้อมูลเรียบร้อย",done.counts);
    }catch(e){setBusy(false);showError(e.name==="AbortError"?"การเชื่อมต่อนานเกินไป กรุณาลองอีกครั้ง":e.message)}
    finally{btn.disabled=false}
  }

  function showImportResult(title,counts={}){
    const el=$("importResult");el.hidden=false;
    el.innerHTML=`<b>${esc(title)}</b><span>เพิ่มใหม่ ${(counts.inserted||0).toLocaleString()} · ปรับข้อมูล ${(counts.updated||0).toLocaleString()} · เดิม ${(counts.unchanged||0).toLocaleString()}</span>`;
  }

  document.addEventListener("DOMContentLoaded",bind);
})();
