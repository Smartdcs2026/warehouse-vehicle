(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const Core=window.AppointmentExcelCore;
  const BASE=window.APPOINTMENT_DEV_CONFIG||{};
  const STORAGE_KEY="warehouse_vehicle_appointment_dev_profile_v176";
  const OLD_STORAGE_KEY="warehouse_vehicle_appointment_dev_profile_v175";
  const TARGET_KEYS=["inbound","receiving","datatable","dashboard","queue","track"];
  const TARGET_FIELDS=["enabled","timing","vendor","carrier","po"];
  const TOKEN_KEY="warehouse_vehicle_appointment_dev_token";
  let lastResult=null;
  let lastPreview=null;

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
      const combined=deepMerge(BASE,JSON.parse(saved));
      const merged=Core.normalizeConfig(combined);
      // การเชื่อมต่อระบบบันทึกมาจากไฟล์ config เท่านั้น ไม่ให้ค่าค้างใน Browser ทับค่าใหม่
      merged.importApi=clone(BASE.importApi||{});
      merged.displayTargets=clone(combined.displayTargets||BASE.displayTargets||{});
      return merged;
    }catch{
      const merged=Core.normalizeConfig(clone(BASE));
      merged.importApi=clone(BASE.importApi||{});
      merged.displayTargets=clone(BASE.displayTargets||{});
      return merged;
    }
  }
  let config=loadConfig();
  function saveConfig(){
    const saved=clone(config);
    delete saved.importApi;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));
    renderConfigSummary();applyControls();
  }
  function split(v){return String(v||"").split(/[\n,;|]+/).map(s=>s.trim()).filter(Boolean)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

  function bind(){
    $("fileInput").addEventListener("change",()=>parseFile($("fileInput").files?.[0]));
    $("saveSettings").addEventListener("click",readSettings);
    $("resetSettings").addEventListener("click",()=>{config=Core.normalizeConfig(clone(BASE));config.importApi=clone(BASE.importApi||{});config.displayTargets=clone(BASE.displayTargets||{});saveConfig();populateSettings();clearResult();showToast("คืนค่าเริ่มต้นแล้ว")});
    $("search").addEventListener("input",renderPreview);
    $("previewButton").addEventListener("click",previewData);
    $("importButton").addEventListener("click",importData);
    $("snapshotDate").addEventListener("change",invalidatePreview);
    $("snapshotTime").addEventListener("change",invalidatePreview);
    $("matchButton").addEventListener("click",matchGatePreview);
    $("failOpenButton").addEventListener("click",runGateContinuityUat);
    $("integrationButton").addEventListener("click",runGateIntegrationSimulator);
    $("adapterButton").addEventListener("click",runPreProductionAdapterUat);
    $("matchAppointment").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();matchGatePreview()}});
    populateSettings();renderConfigSummary();applyControls();setDefaultGateIn();
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
    $("matchTestEnabled").checked=c.matchTestEnabled!==false;
    $("integrationSimulatorEnabled").checked=c.integrationSimulatorEnabled!==false;
    $("preProductionAdapterEnabled").checked=c.preProductionAdapterEnabled!==false;
    $("sheetName").value=config.sheetName||"raw_data";
    $("sheetAliases").value=(config.sheetAliases||[]).join(", ");
    $("warehouseMode").value=config.warehouse?.matchMode||"STARTS_WITH";
    $("warehouseValues").value=(config.warehouse?.values||["906"]).join(", ");
    $("timeReference").value=config.timeReference||"PERIOD";
    $("searchWindowHours").value=String(Math.max(1,Math.min(168,Number(config.matching?.searchWindowHours)||36)));
    $("lookupTargetMs").value=String(Math.max(20,Math.min(2000,Number(config.matching?.lookupTargetMs)||150)));
    $("adapterTimeoutMs").value=String(Math.max(50,Math.min(3000,Number(config.matching?.adapterTimeoutMs)||250)));
    for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){
      $("h_"+key).value=config.fields?.[key]?.header||"";
      $("a_"+key).value=(config.fields?.[key]?.aliases||[]).join(", ");
    }
    for(const key of ["Period","From","To","Vendor","Carrier","Po"])$("show"+key).checked=d["show"+key]!==false;
    const targets=config.displayTargets||{};
    for(const page of TARGET_KEYS){
      const rule=targets[page]||{};
      for(const field of TARGET_FIELDS){
        const el=$("target_"+page+"_"+field);
        if(el)el.checked=field==="enabled"?rule.enabled!==false:!!rule[field];
      }
    }
  }

  function readSettings(){
    const c=clone(config);
    c.controls={moduleEnabled:$("moduleEnabled").checked,uploadEnabled:$("uploadEnabled").checked,useImportedData:$("useImportedData").checked,matchTestEnabled:$("matchTestEnabled").checked,integrationSimulatorEnabled:$("integrationSimulatorEnabled").checked,preProductionAdapterEnabled:$("preProductionAdapterEnabled").checked};
    c.sheetName=$("sheetName").value.trim()||"raw_data";
    c.sheetAliases=split($("sheetAliases").value);
    c.warehouse={...(c.warehouse||{}),matchMode:$("warehouseMode").value,values:split($("warehouseValues").value).map(x=>x.toUpperCase())};
    c.timeReference=$("timeReference").value;
    c.matching={...(c.matching||{}),searchWindowHours:Math.max(1,Math.min(168,Math.round(Number($("searchWindowHours").value)||36))),lookupTargetMs:Math.max(20,Math.min(2000,Math.round(Number($("lookupTargetMs").value)||150))),adapterTimeoutMs:Math.max(50,Math.min(3000,Math.round(Number($("adapterTimeoutMs").value)||250)))};
    c.fields=c.fields||{};
    for(const key of ["dc","date","period","from","to","po","appointment","vendor","carrier"]){
      c.fields[key]={...(c.fields[key]||{}),header:$("h_"+key).value.trim(),aliases:split($("a_"+key).value)};
    }
    c.display={showPeriod:$("showPeriod").checked,showFrom:$("showFrom").checked,showTo:$("showTo").checked,showVendor:$("showVendor").checked,showCarrier:$("showCarrier").checked,showPo:$("showPo").checked};
    c.displayTargets={};
    for(const page of TARGET_KEYS){
      c.displayTargets[page]={};
      for(const field of TARGET_FIELDS){
        const el=$("target_"+page+"_"+field);
        c.displayTargets[page][field]=!!el?.checked;
      }
    }
    config=Core.normalizeConfig(c);config.controls=c.controls;config.display=c.display;config.displayTargets=c.displayTargets;config.matching=c.matching;config.importApi=c.importApi||BASE.importApi||{};
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
    $("workModeNotice").hidden=!moduleOn;
    $("uploadPanel").hidden=!moduleOn;
    $("fileButton").classList.toggle("disabled",!uploadOn);
    $("fileInput").disabled=!uploadOn;
    if(!moduleOn)clearResult();
    const api=config.importApi||{};
    const apiReady=!!(api.enabled&&String(api.baseUrl||"").trim());
    $("importPanel").hidden=!(moduleOn&&uploadOn&&apiReady&&lastResult&&getIssueCount()===0);
    $("matchTestPanel").hidden=!(moduleOn&&c.matchTestEnabled!==false&&apiReady);
    $("integrationButton").hidden=!(moduleOn&&c.integrationSimulatorEnabled!==false&&apiReady);
    $("adapterButton").hidden=!(moduleOn&&c.preProductionAdapterEnabled!==false&&apiReady);
  }

  async function parseFile(file){
    if(!file)return;
    readSettings();
    if(config.controls?.moduleEnabled===false||config.controls?.uploadEnabled===false){showError("ขณะนี้ปิดการอัปโหลด");return}
    if(!/\.(xlsb|xlsx)$/i.test(file.name)){showError("ไฟล์นี้ไม่รองรับ");return}
    setBusy(true,"กำลังอ่านข้อมูล");clearResult();
    try{
      const buffer=await file.arrayBuffer();
      const worker=new Worker("./excel-worker.js?v=20260818-r171");
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
  function clearResult(){lastResult=null;lastPreview=null;$("result").hidden=true;$("errorBox").hidden=true;$("importButton").disabled=true;applyControlsSafe()}
  function applyControlsSafe(){try{const api=config.importApi||{};$("importPanel").hidden=!(api.enabled&&api.baseUrl&&lastResult&&getIssueCount()===0)}catch{}}

  function swalBase(){
    return {
      width:390,
      buttonsStyling:false,
      customClass:{popup:"swal-small",title:"swal-small-title",htmlContainer:"swal-small-html",confirmButton:"swal-btn",cancelButton:"swal-btn swal-btn-secondary",actions:"swal-small-actions"}
    };
  }

  function showError(msg){
    $("errorBox").hidden=true;
    if(window.Swal){
      return Swal.fire({...swalBase(),icon:"error",title:"ไม่สำเร็จ",text:String(msg||"เกิดข้อผิดพลาด"),confirmButtonText:"ตกลง"});
    }
    $("errorBox").hidden=false;$("errorBox").textContent=msg;
  }

  function showToast(msg){
    if(window.Swal){
      return Swal.fire({toast:true,position:"top-end",icon:"success",title:String(msg||"บันทึกแล้ว"),showConfirmButton:false,timer:1500,timerProgressBar:true,width:300,customClass:{popup:"swal-toast-small"}});
    }
  }

  function countsHtml(counts={}){
    const rows=[
      ["เพิ่มใหม่",Number(counts.inserted||0)],
      ["ปรับข้อมูล",Number(counts.updated||0)],
      ["เดิม",Number(counts.unchanged||0)]
    ];
    if(Number(counts.olderSkipped||0)>0)rows.push(["ข้อมูลเก่ากว่า",Number(counts.olderSkipped||0)]);
    if(Number(counts.conflicts||0)>0)rows.push(["ต้องตรวจ",Number(counts.conflicts||0)]);
    return `<div class="swal-stats">${rows.map(([label,value])=>`<div class="swal-stat"><span>${label}</span><strong>${value.toLocaleString()}</strong></div>`).join("")}</div>`;
  }
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
    setSnapshotSuggestion(r.fileName);
    invalidatePreview();
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

  function setSnapshotSuggestion(fileName){
    const found=inferSnapshot(fileName);
    $("snapshotDate").value=found?.date||"";
    $("snapshotTime").value=found?.time||"";
  }

  function inferSnapshot(fileName){
    const name=String(fileName||"");
    const m=name.match(/(?:^|\D)(\d{2})(\d{2})(\d{4}|\d{2})[_\-\s]+(\d{1,2})[.:](\d{2})(?:\D|$)/);
    if(!m)return null;
    const d=Number(m[1]),mo=Number(m[2]),y=m[3].length===4?Number(m[3]):2000+Number(m[3]);
    const h=Number(m[4]),mi=Number(m[5]);
    const dt=new Date(Date.UTC(y,mo-1,d));
    if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d||h<0||h>23||mi<0||mi>59)return null;
    return {date:`${String(y).padStart(4,"0")}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`,time:`${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}`};
  }

  function snapshotForImport(){
    const snapshotDate=$("snapshotDate").value;
    const snapshotTime=$("snapshotTime").value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)||!/^\d{2}:\d{2}$/.test(snapshotTime))throw new Error("กรุณาระบุวันที่และเวลาของชุดข้อมูล");
    return {snapshotDate,snapshotTime};
  }

  function previewKey(snapshot){
    return [lastResult?.fileHash||"",snapshot.snapshotDate,snapshot.snapshotTime].join("|");
  }

  function invalidatePreview(){
    lastPreview=null;
    $("errorBox").hidden=true;
    $("importButton").disabled=true;
  }

  function addCounts(total,part){
    for(const key of ["inserted","updated","unchanged","olderSkipped","conflicts"])total[key]+=Number(part?.[key]||0);
    return total;
  }

  async function previewData(){
    if(!lastResult||getIssueCount()>0)return;
    let snapshot;
    try{snapshot=snapshotForImport()}catch(e){showError(e.message);return}
    const token=await getToken();if(!token)return;
    const btn=$("previewButton");btn.disabled=true;$("errorBox").hidden=true;
    try{
      const batchSize=Math.max(10,Math.min(100,Number(config.importApi?.batchSize)||50));
      const items=lastResult.appointments.map(itemForImport);
      const total={inserted:0,updated:0,unchanged:0,olderSkipped:0,conflicts:0};
      for(let offset=0;offset<items.length;offset+=batchSize){
        const batch=items.slice(offset,offset+batchSize);
        setBusy(true,`กำลังตรวจ ${Math.min(offset+batch.length,items.length).toLocaleString()} / ${items.length.toLocaleString()}`);
        const part=await apiPost("/import/preview",{snapshotDate:snapshot.snapshotDate,snapshotTime:snapshot.snapshotTime,items:batch},token);
        if(part.blockedOlder)throw new Error(part.message||"ชุดข้อมูลนี้เก่ากว่าข้อมูลที่มีอยู่");
        addCounts(total,part.counts);
      }
      setBusy(false);
      lastPreview={key:previewKey(snapshot),counts:total};
      showPreviewResult(total);
      const hasChanges=Number(total.inserted||0)+Number(total.updated||0)>0;
      $("importButton").disabled=!hasChanges||total.olderSkipped>0||total.conflicts>0;
    }catch(e){setBusy(false);lastPreview=null;$("importButton").disabled=true;showError(e.name==="AbortError"?"การเชื่อมต่อนานเกินไป กรุณาลองอีกครั้ง":e.message)}
    finally{btn.disabled=false}
  }

  function showPreviewResult(counts){
    const blocked=Number(counts.olderSkipped||0)>0||Number(counts.conflicts||0)>0;
    const hasChanges=Number(counts.inserted||0)+Number(counts.updated||0)>0;
    if(window.Swal){
      const icon=blocked?"warning":hasChanges?"success":"info";
      const title=blocked?"ยังไม่พร้อมนำเข้า":hasChanges?"พร้อมนำเข้า":"ไม่มีข้อมูลเปลี่ยนแปลง";
      const note=!blocked&&!hasChanges?`<div class="swal-note">ข้อมูลทั้ง ${Number(counts.unchanged||0).toLocaleString()} นัดหมายตรงกับข้อมูลปัจจุบันแล้ว</div>`:"";
      return Swal.fire({...swalBase(),icon,title,html:countsHtml(counts)+note,confirmButtonText:blocked?"รับทราบ":"ตกลง"});
    }
  }

  function apiUrl(path){return String(config.importApi?.baseUrl||"").replace(/\/+$/,"")+path}
  async function getToken(){
    let token=sessionStorage.getItem(TOKEN_KEY)||"";
    if(token)return token;
    if(window.Swal){
      const result=await Swal.fire({...swalBase(),title:"รหัสสำหรับการทดสอบ",input:"password",inputPlaceholder:"กรอกรหัส",showCancelButton:true,confirmButtonText:"ตกลง",cancelButtonText:"ยกเลิก",inputAttributes:{autocomplete:"off"}});
      token=String(result.value||"").trim();
    }else{
      token=window.prompt("รหัสสำหรับการทดสอบ")||"";
    }
    if(token)sessionStorage.setItem(TOKEN_KEY,token);
    return token;
  }
  async function apiPost(path,body,token){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
    try{
      const res=await fetch(apiUrl(path),{method:"POST",headers:{"Content-Type":"application/json","X-Dev-Token":token},body:JSON.stringify(body),signal:ctrl.signal});
      const data=await res.json().catch(()=>({}));
      if(!res.ok){
        if(res.status===401)sessionStorage.removeItem(TOKEN_KEY);
        throw new Error(data.message||"ดำเนินการไม่สำเร็จ");
      }
      return data;
    }finally{clearTimeout(timer)}
  }

  function itemForImport(a){return {dc:a.dc,appointment:a.appointment,date:a.date,period:a.period,from:a.from,to:a.to,referenceType:a.referenceType,referenceMinute:a.referenceMinute,vendors:a.vendors,carriers:a.carriers,lines:a.lines||[],raw:a.raw||{}}}

  async function importData(){
    if(!lastResult||getIssueCount()>0)return;
    let snapshot;
    try{snapshot=snapshotForImport()}catch(e){showError(e.message);return}
    if(!lastPreview||lastPreview.key!==previewKey(snapshot)){showError("กรุณาตรวจการเปลี่ยนแปลงก่อนนำเข้า");return}
    if(Number(lastPreview.counts?.olderSkipped||0)>0||Number(lastPreview.counts?.conflicts||0)>0){showError("ยังมีรายการที่ต้องตรวจ จึงยังนำเข้าไม่ได้");return}
    if(Number(lastPreview.counts?.inserted||0)+Number(lastPreview.counts?.updated||0)===0){
      if(window.Swal)await Swal.fire({...swalBase(),icon:"info",title:"ไม่มีข้อมูลเปลี่ยนแปลง",html:`<div class="swal-note">ข้อมูลทั้งหมดตรงกับข้อมูลปัจจุบันแล้ว จึงไม่ต้องนำเข้าอีกครั้ง</div>`,confirmButtonText:"ตกลง"});
      return;
    }
    if(window.Swal){
      const confirm=await Swal.fire({...swalBase(),icon:"question",title:"ยืนยันนำเข้าข้อมูล?",html:countsHtml(lastPreview.counts),showCancelButton:true,confirmButtonText:"ยืนยันนำเข้า",cancelButtonText:"ยกเลิก"});
      if(!confirm.isConfirmed)return;
    }
    const token=await getToken();if(!token)return;
    const btn=$("importButton");btn.disabled=true;$("errorBox").hidden=true;
    try{
      setBusy(true,"กำลังเตรียมนำเข้า");
      const start=await apiPost("/import/start",{fileHash:lastResult.fileHash,fileName:lastResult.fileName,sourceSheet:lastResult.sourceSheet,dateFrom:lastResult.dateRange?.[0]||null,dateTo:lastResult.dateRange?.[1]||null,totalAppointments:lastResult.totalAppointments,warehouseRule:{mode:config.warehouse?.matchMode,values:config.warehouse?.values},timeReference:config.timeReference,snapshotDate:snapshot.snapshotDate,snapshotTime:snapshot.snapshotTime},token);
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
    const duplicate=String(title||"").includes("เคยนำเข้า");
    if(window.Swal){
      return Swal.fire({...swalBase(),icon:duplicate?"info":"success",title:String(title||"เรียบร้อย"),html:countsHtml(counts),confirmButtonText:"ตกลง"});
    }
  }


  function setDefaultGateIn(){
    const input=$("matchGateIn");
    if(!input||input.value)return;
    const parts={};
    for(const p of new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date())){
      if(p.type!=="literal")parts[p.type]=p.value;
    }
    input.value=`${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  function cleanAppointmentInput(value){return String(value||"").replace(/\s+/g,"").trim()}
  function parseDisplayDateTime(value){
    const m=String(value||"").trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if(!m)return null;
    const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]),h=Number(m[4]),mi=Number(m[5]),sec=Number(m[6]);
    if(h>23||mi>59||sec>59)return null;
    const dt=new Date(Date.UTC(y,mo-1,d));
    if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return null;
    return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
  }
  function gateInputMachine(){
    const machine=parseDisplayDateTime($("matchGateIn").value);
    if(!machine)throw new Error("กรุณาระบุวันเวลาเป็น dd/MM/yyyy HH:mm:ss");
    return machine;
  }
  function displayDateTime(value){
    const s=String(value||"").trim();
    if(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    return m?`${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]||"00"}`:(s||"-");
  }
  function displayPlannedDateTime(date,time){
    const d=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const t=String(time||"").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    return d&&t?`${d[3]}/${d[2]}/${d[1]} ${t[1]}:${t[2]}:${t[3]||"00"}`:"-";
  }
  function formatDelta(minutes){
    const n=Number(minutes||0),abs=Math.abs(n),h=Math.floor(abs/60),m=abs%60;
    const parts=[];if(h)parts.push(`${h} ชม.`);if(m||!h)parts.push(`${m} นาที`);
    return n>0?`ช้า ${parts.join(" ")}`:n<0?`มาก่อน ${parts.join(" ")}`:"ตรงเวลา";
  }
  function matchInfoHtml(data){
    const a=data.appointment||{};
    const pos=(a.pos||[]).slice(0,12).map(esc).join(", ")||"-";
    const vendor=esc(a.vendorsText||"-");
    const carrier=esc(a.carriersText||"-");
    return `<div class="match-swal-grid">
      <div><span>Appointment</span><strong>${esc(a.appointmentNo||"-")}</strong></div>
      <div><span>อ้างอิง</span><strong>${esc(data.referenceMode||"-")}</strong></div>
      <div><span>เวลานัด</span><strong>${esc(data.plannedDateTimeDisplay||displayPlannedDateTime(a.appointmentDate,data.plannedTime))}</strong></div>
      <div><span>Gate In</span><strong>${esc(data.gateInDisplay||displayDateTime(data.gateInLocal))}</strong></div>
    </div>
    <div class="match-result-line ${data.status==="LATE"?"late":data.status==="EARLY"?"early":"ontime"}">${esc(formatDelta(data.deltaMinutes))}</div>
    <div class="match-swal-detail"><span>บริษัท</span><b>${vendor}</b></div>
    <div class="match-swal-detail"><span>Carrier</span><b>${carrier}</b></div>
    <div class="match-swal-detail"><span>PO</span><b>${pos}</b></div>`;
  }
  function candidateListHtml(items=[]){
    return `<div class="match-candidates">${items.slice(0,5).map(c=>`<div><b>${esc(c.dcCode||"-")}</b><span>${esc(c.plannedDateTimeDisplay||displayPlannedDateTime(c.appointmentDate,c.plannedTime))} · ${esc(formatDelta(c.deltaMinutes))}</span></div>`).join("")}</div>`;
  }

  async function matchGatePreview(){
    const appointmentNo=cleanAppointmentInput($("matchAppointment").value);
    let gateInLocal;
    if(!appointmentNo){showError("กรุณาระบุเลข Appointment");return}
    try{gateInLocal=gateInputMachine()}catch(e){showError(e.message);return}
    const token=await getToken();if(!token)return;
    const btn=$("matchButton");btn.disabled=true;
    try{
      const data=await apiPost("/match/preview",{
        appointmentNo,
        gateInLocal,
        referenceMode:config.timeReference||"PERIOD",
        searchWindowHours:Math.max(1,Math.min(168,Number(config.matching?.searchWindowHours)||36))
      },token);
      if(!window.Swal)return;
      if(data.matched){
        const icon=data.status==="LATE"?"warning":data.status==="ON_TIME"?"success":"info";
        const title=data.status==="LATE"?"ช้ากว่าเวลานัด":data.status==="EARLY"?"มาก่อนเวลานัด":"ตรงเวลานัด";
        await Swal.fire({...swalBase(),icon,title,html:matchInfoHtml(data),confirmButtonText:"ตกลง"});
        return;
      }
      if(data.ambiguous){
        await Swal.fire({...swalBase(),icon:"warning",title:"พบมากกว่า 1 รายการ",html:`<div class="swal-note">ยังไม่เลือกให้อัตโนมัติ กรุณาตรวจรายการที่ใกล้เคียง</div>${candidateListHtml(data.candidates||[])}`,confirmButtonText:"รับทราบ"});
        return;
      }
      if(data.reason==="OUTSIDE_WINDOW"){
        await Swal.fire({...swalBase(),icon:"warning",title:"เวลาห่างจากรอบนัดหมาย",html:`<div class="swal-note">พบ Appointment แต่เวลา Gate In อยู่นอกช่วงค้นหาที่ตั้งไว้</div>${candidateListHtml(data.candidates||[])}`,confirmButtonText:"รับทราบ"});
        return;
      }
      await Swal.fire({...swalBase(),icon:"info",title:"ไม่พบข้อมูลนัดหมาย",html:`<div class="swal-note">ยังไม่พบ Appointment ${esc(appointmentNo)} ในข้อมูลที่นำเข้า</div>`,confirmButtonText:"ตกลง"});
    }catch(e){showError(e.name==="AbortError"?"การเชื่อมต่อนานเกินไป กรุณาลองอีกครั้ง":e.message)}
    finally{btn.disabled=false}
  }


  function integrationStateLabel(state){
    return ({MATCHED:"พบข้อมูลนัดหมาย",NOT_FOUND:"ไม่พบ Appointment",NO_REFERENCE:"ไม่มีเวลาอ้างอิง",OUTSIDE_WINDOW:"อยู่นอกช่วงค้นหา",AMBIGUOUS:"พบมากกว่า 1 รายการ",DISABLED:"ปิดการใช้ข้อมูล",UNAVAILABLE:"ข้อมูลนัดหมายไม่พร้อม"})[String(state||"")]||String(state||"-");
  }
  function integrationHtml(data){
    const perf=data?.performance||{};
    const enrich=data?.appointmentEnrichment||{};
    const timing=data?.timing||{};
    const gate=data?.gate||{};
    const ms=Number(perf.lookupMs||0);
    const total=Number(perf.totalMs||0);
    const target=Number(perf.targetMs||0);
    const perfClass=perf.withinTarget===false?"late":"ontime";
    const timingLine=enrich.state==="MATCHED"?`<div class="match-result-line ${timing.status==="LATE"?"late":timing.status==="EARLY"?"early":"ontime"}">${esc(formatDelta(timing.deltaMinutes))}</div>`:"";
    const appt=enrich.data?.appointment||{};
    return `<div class="integration-contract">
      <div class="integration-state"><span>สถานะ</span><b>${esc(integrationStateLabel(enrich.state))}</b><em>${data.gateProceed===true?"Gate In ทำงานต่อ":"Gate In ถูกหยุด"}</em></div>
      <div class="integration-metrics">
        <div><span>ค้นข้อมูล</span><strong>${ms.toFixed(1)} ms</strong></div>
        <div><span>รวมทั้งหมด</span><strong>${total.toFixed(1)} ms</strong></div>
        <div><span>เป้าหมาย</span><strong>≤ ${target} ms</strong></div>
      </div>
      <div class="match-result-line ${perfClass}">${perf.withinTarget===false?"ช้ากว่าเป้าหมายที่ตั้งไว้":"ความเร็วอยู่ในเป้าหมาย"}</div>
      ${timingLine}
      <div class="integration-lines">
        <div><span>Auto ID</span><b>${esc(gate.autoId||"-")}</b></div>
        <div><span>Appointment</span><b>${esc(gate.appointmentNo||"-")}</b></div>
        <div><span>เวลานัด</span><b>${esc(timing.plannedDateTimeDisplay||displayPlannedDateTime(appt.appointmentDate,timing.plannedTime))}</b></div>
        <div><span>Gate In</span><b>${esc(gate.gateInDisplay||displayDateTime(gate.gateInLocal))}</b></div>
        <div><span>บริษัท</span><b>${esc(appt.vendorsText||"-")}</b></div>
        <div><span>Carrier</span><b>${esc(appt.carriersText||"-")}</b></div>
        <div><span>PO</span><b>${esc((appt.pos||[]).join(", ")||"-")}</b></div>
      </div>
      <div class="swal-note">ข้อมูลนี้เป็นผลจำลอง Contract ก่อนเชื่อม Gate In งานจริง และไม่มีการแก้ข้อมูล Gate In</div>
    </div>`;
  }
  async function runGateIntegrationSimulator(){
    const appointmentNo=cleanAppointmentInput($("matchAppointment").value);
    let gateInLocal;
    if(!appointmentNo){showError("กรุณาระบุเลข Appointment");return}
    try{gateInLocal=gateInputMachine()}catch(e){showError(e.message);return}
    const token=await getToken();if(!token)return;
    const btn=$("integrationButton");btn.disabled=true;
    try{
      const data=await apiPost("/gate/integration-sim",{
        gateRecord:{
          autoId:`DEV-${Date.now()}`,
          timestamp:gateInLocal,
          appointmentNo,
          company:"DEV TEST",driver:"DEV TEST",plate:"DEV-0000",province:"ปทุมธานี",vehicleType:"DEV"
        },
        useAppointmentData:true,
        referenceMode:config.timeReference||"PERIOD",
        searchWindowHours:Math.max(1,Math.min(168,Number(config.matching?.searchWindowHours)||36)),
        lookupTargetMs:Math.max(20,Math.min(2000,Number(config.matching?.lookupTargetMs)||150))
      },token);
      if(window.Swal){
        const icon=data.gateProceed!==true?"error":data.performance?.withinTarget===false?"warning":"success";
        await Swal.fire({...swalBase(),width:420,icon,title:data.gateProceed===true?"Gate In Integration พร้อมทดสอบ":"Integration ไม่ผ่าน",html:integrationHtml(data),confirmButtonText:"ตกลง"});
      }
    }catch(e){showError(e.name==="AbortError"?"การเชื่อมต่อนานเกินไป กรุณาลองอีกครั้ง":e.message)}
    finally{btn.disabled=false}
  }


  function continuityRow(label,data,expectedState){
    const proceed=data?.gateProceed===true;
    const state=String(data?.enrichmentState||"");
    const stateOk=!expectedState||state===expectedState;
    const pass=proceed&&stateOk;
    const ms=Number(data?.performance?.lookupMs||0);
    const detail=(state==="MATCHED"?"พบข้อมูลนัดหมาย":state==="NOT_FOUND"?"ไม่พบข้อมูล แต่รถทำงานต่อ":state==="UNAVAILABLE"?"ข้อมูลนัดหมายขัดข้อง แต่รถทำงานต่อ":state==="DISABLED"?"ปิดการใช้ข้อมูล แต่รถทำงานต่อ":state||"ไม่ทราบผล")+` · ${ms.toFixed(1)} ms`;
    return {label,pass,detail};
  }
  function continuityHtml(rows){
    return `<div class="continuity-list">${rows.map(r=>`<div class="continuity-row ${r.pass?"pass":"fail"}"><span>${esc(r.label)}</span><b>${r.pass?"ผ่าน":"ไม่ผ่าน"}</b><small>${esc(r.detail)}</small></div>`).join("")}</div>`;
  }
  async function runGateContinuityUat(){
    let gateInLocal;
    try{gateInLocal=gateInputMachine()}catch(e){showError(e.message);return}
    const appointmentNo=cleanAppointmentInput($("matchAppointment").value)||"2012960";
    if(!$("matchAppointment").value)$("matchAppointment").value=appointmentNo;
    const token=await getToken();if(!token)return;
    const btn=$("failOpenButton");btn.disabled=true;
    const gateRecord=no=>({autoId:`UAT-${Date.now()}-${no}`,timestamp:gateInLocal,appointmentNo:no,company:"DEV TEST",driver:"DEV TEST",plate:"DEV-UAT",province:"ปทุมธานี",vehicleType:"DEV"});
    const common={referenceMode:config.timeReference||"PERIOD",searchWindowHours:Math.max(1,Math.min(168,Number(config.matching?.searchWindowHours)||36)),lookupTargetMs:Math.max(20,Math.min(2000,Number(config.matching?.lookupTargetMs)||150)),useAppointmentData:true};
    try{
      const normal=await apiPost("/gate/integration-sim",{...common,gateRecord:gateRecord(appointmentNo)},token);
      const missing=await apiPost("/gate/integration-sim",{...common,gateRecord:gateRecord("999999999999999")},token);
      const unavailable=await apiPost("/gate/integration-sim",{...common,gateRecord:gateRecord(appointmentNo),simulateFailure:true},token);
      const disabled=await apiPost("/gate/integration-sim",{...common,useAppointmentData:false,gateRecord:gateRecord(appointmentNo)},token);
      const rows=[
        continuityRow("กรณีปกติ",normal,null),
        continuityRow("ไม่พบ Appointment",missing,"NOT_FOUND"),
        continuityRow("ข้อมูลนัดหมายขัดข้อง",unavailable,"UNAVAILABLE"),
        continuityRow("Admin ปิดการใช้ข้อมูล",disabled,"DISABLED")
      ];
      const pass=rows.every(r=>r.pass);
      if(window.Swal){
        await Swal.fire({...swalBase(),icon:pass?"success":"error",title:pass?"Gate In ทำงานต่อได้ครบ":"พบกรณีที่ต้องแก้",html:continuityHtml(rows)+`<div class="swal-note">การตรวจข้อมูลนัดหมายเป็นส่วนเสริม และต้องไม่หยุดขั้นตอน Gate In</div>`,confirmButtonText:"ตกลง"});
      }
    }catch(e){showError(e.name==="AbortError"?"การเชื่อมต่อนานเกินไป กรุณาลองอีกครั้ง":e.message)}
    finally{btn.disabled=false}
  }


  function machineToBangkokEpoch(machine){
    const ms=Date.parse(String(machine||"")+"+07:00");
    if(!Number.isFinite(ms))throw new Error("วันเวลา Gate In ไม่ถูกต้อง");
    return Math.floor(ms/1000);
  }
  function adapterStateLabel(state){
    return ({MATCHED:"พบข้อมูล",NOT_FOUND:"ไม่พบ Appointment",DISABLED:"Admin ปิดใช้ข้อมูล",NO_APPOINTMENT_NUMBER:"ไม่มีเลข Appointment",TIMEOUT:"ตอบช้าเกินกำหนด",UNAVAILABLE:"ข้อมูลนัดหมายขัดข้อง",OUTSIDE_WINDOW:"นอกช่วงค้นหา",AMBIGUOUS:"พบมากกว่า 1 รายการ",NO_REFERENCE:"ไม่มีเวลาอ้างอิง",INVALID_INPUT:"ข้อมูล Gate In ไม่ครบ"})[String(state||"")]||String(state||"-");
  }
  function adapterUatRow(label,data,expectedState,expectedQuery){
    const state=String(data?.adapter?.state||"");
    const proceed=data?.gateProceed===true;
    const query=data?.adapter?.queryAttempted===true;
    const stateOk=!expectedState||state===expectedState;
    const queryOk=expectedQuery===undefined||query===expectedQuery;
    const pass=proceed&&stateOk&&queryOk;
    const ms=Number(data?.performance?.lookupMs||0);
    return {label,pass,detail:`${adapterStateLabel(state)} · ${query?"ค้น D1":"ไม่ค้น D1"} · ${ms.toFixed(1)} ms`};
  }
  function adapterProjectionHtml(projection={}){
    const labels={inbound:"Inbound",receiving:"Receiving",datatable:"Datatable",dashboard:"Dashboard",queue:"จอคิว",track:"Track"};
    return `<div class="adapter-pages">${TARGET_KEYS.map(page=>{const p=projection[page]||{},keys=Object.keys(p.fields||{});return `<div class="adapter-page ${p.enabled?"on":"off"}"><span>${esc(labels[page]||page)}</span><b>${p.enabled?"เปิด":"ปิด"}</b><small>${p.enabled?(keys.length?keys.map(k=>({timing:"เวลา",vendor:"บริษัท",carrier:"Carrier",po:"PO"}[k]||k)).join(" · "):"ไม่แสดงรายละเอียด"):"ไม่แสดงข้อมูลนัดหมาย"}</small></div>`}).join("")}</div>`;
  }
  async function runPreProductionAdapterUat(){
    let gateInLocal;
    try{gateInLocal=gateInputMachine()}catch(e){showError(e.message);return}
    const appointmentNo=cleanAppointmentInput($("matchAppointment").value)||"2012960";
    if(!$("matchAppointment").value)$("matchAppointment").value=appointmentNo;
    const token=await getToken();if(!token)return;
    const btn=$("adapterButton");btn.disabled=true;
    const gateEpoch=machineToBangkokEpoch(gateInLocal);
    const makeGate=no=>({auto_id:`PREPROD-${Date.now()}-${no||"NONE"}`,appointment_no:no||"",gate_in_at:gateEpoch,company_name:"DEV TEST",driver_name:"DEV TEST",vehicle_plate:"DEV-0000",province:"ปทุมธานี",vehicle_type:"DEV"});
    const common={
      moduleEnabled:true,useAppointmentData:true,referenceMode:config.timeReference||"PERIOD",
      searchWindowHours:Math.max(1,Math.min(168,Number(config.matching?.searchWindowHours)||36)),
      lookupTargetMs:Math.max(20,Math.min(2000,Number(config.matching?.lookupTargetMs)||150)),
      adapterTimeoutMs:Math.max(50,Math.min(3000,Number(config.matching?.adapterTimeoutMs)||250)),
      displayPolicy:config.displayTargets||{}
    };
    try{
      const matched=await apiPost("/adapter/preprod",{...common,gateRecord:makeGate(appointmentNo)},token);
      const missing=await apiPost("/adapter/preprod",{...common,gateRecord:makeGate("999999999999999")},token);
      const disabled=await apiPost("/adapter/preprod",{...common,useAppointmentData:false,gateRecord:makeGate(appointmentNo)},token);
      const noNumber=await apiPost("/adapter/preprod",{...common,gateRecord:makeGate("")},token);
      const timeout=await apiPost("/adapter/preprod",{...common,simulateTimeout:true,gateRecord:makeGate(appointmentNo)},token);
      const rows=[
        adapterUatRow("พบ Appointment",matched,"MATCHED",true),
        adapterUatRow("ไม่พบ Appointment",missing,"NOT_FOUND",true),
        adapterUatRow("Admin ปิดใช้ข้อมูล",disabled,"DISABLED",false),
        adapterUatRow("ไม่มีเลข Appointment",noNumber,"NO_APPOINTMENT_NUMBER",false),
        adapterUatRow("ข้อมูลตอบช้าเกินกำหนด",timeout,"TIMEOUT",true)
      ];
      const pass=rows.every(r=>r.pass);
      const zeroQueryPass=disabled?.adapter?.zeroQuery===true&&noNumber?.adapter?.zeroQuery===true&&Number(disabled?.performance?.lookupMs||0)===0&&Number(noNumber?.performance?.lookupMs||0)===0;
      const html=continuityHtml(rows)+`<div class="adapter-zero ${zeroQueryPass?"pass":"fail"}"><span>ปิดใช้ข้อมูลแล้วไม่ Query Appointment</span><b>${zeroQueryPass?"ผ่าน":"ไม่ผ่าน"}</b></div>`+adapterProjectionHtml(matched?.pageProjection||{})+`<div class="swal-note">Adapter รับรูปแบบข้อมูลรถแบบระบบหลัก แต่รอบนี้ยังไม่แก้ไฟล์ Production และไม่เขียน Gate In</div>`;
      if(window.Swal)await Swal.fire({...swalBase(),width:440,icon:pass&&zeroQueryPass?"success":"error",title:pass&&zeroQueryPass?"Adapter ก่อนรวมระบบ ผ่าน 5/5":"Adapter ยังมีจุดต้องแก้",html,confirmButtonText:"ตกลง"});
    }catch(e){showError(e.name==="AbortError"?"การเชื่อมต่อนานเกินไป กรุณาลองอีกครั้ง":e.message)}
    finally{btn.disabled=false}
  }


  document.addEventListener("DOMContentLoaded",bind);
})();
