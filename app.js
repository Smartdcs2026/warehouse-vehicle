"use strict";

const cfg = window.APP_CONFIG;
const state = { token: sessionStorage.getItem("wvf_token") || "", user: null, view: "operations", vehicles: [], online: navigator.onLine };
const scannerState = { active:false, stream:null, detector:null, timer:0, reading:false, canvas:null, context:null, lastValue:"", lastSeenAt:0, repeatCount:0 };
const submitState = { busy:false };
const uiState = { detailsOpen:false };
let audioContext = null;
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("online", () => setConnection(true));
window.addEventListener("offline", () => setConnection(false));
document.addEventListener("visibilitychange", () => { if (!document.hidden && scannerState.active) $("qrVideo")?.play().catch(() => undefined); });

async function init() {
  $("brandName").textContent = cfg.appName;
  $("loginForm").addEventListener("submit", login);
  $("logoutButton").addEventListener("click", logout);
  $("togglePassword").addEventListener("click", togglePassword);
  document.addEventListener("fullscreenchange",updateFullscreenButton);
  setInterval(updateClocks, 1000); updateClocks(); setConnection(navigator.onLine);
  setInterval(refreshLiveData, Math.max(15, Number(cfg.refreshSeconds) || 30) * 1000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  if (state.token) { try { const me = await api("/api/auth/me"); state.user = me.user; openApp(); } catch { clearSession(); } }
}

async function login(event) {
  event.preventDefault();
  const button = event.submitter; button.disabled = true; button.textContent = "กำลังเข้าสู่ระบบ"; $("loginMessage").textContent = "";
  try {
    const result = await api("/api/auth/login", { method:"POST", auth:false, body:{ name:$("loginName").value.trim(), password:$("loginPassword").value } });
    state.token = result.token; state.user = result.user; sessionStorage.setItem("wvf_token", state.token); openApp();
  } catch (error) { $("loginMessage").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "เข้าสู่ระบบ"; }
}

function openApp() {
  $("loginView").hidden = true; $("appView").hidden = false; $("accountName").textContent = state.user.name; $("accountRole").textContent = roleLabel(state.user.accessRights);
  $("appView").classList.toggle("inbound-kiosk-shell",state.user.accessRights==="INBOUND");
  window.scrollTo(0, 0);
  state.view = state.user.accessRights === "INBOUND" ? "inbound" : "operations"; renderNavigation(); navigate(state.view);
}

function renderNavigation() {
  const role = state.user.accessRights;
  const items = [];
  if (role !== "INBOUND") items.push(["operations","▣","งานรับสินค้า"]);
  if (role === "ADMIN" || role === "INBOUND") items.push(["inbound","▦","แผนก Inbound"]);
  if (role !== "INBOUND") items.push(["dashboard","▥","Dashboard"]);
  if (role === "ADMIN") items.push(["admin","⚙","ตั้งค่าระบบ"]);
  $("sideNav").innerHTML = items.map(i => `<button class="nav-button" data-view="${i[0]}">${i[1]} ${i[2]}</button>`).join("");
  $("mobileNav").innerHTML = items.map(i => `<button data-view="${i[0]}">${i[1]}<small>${i[2]}</small></button>`).join("");
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
}

async function navigate(view) {
  if(scannerState.active&&state.view==="inbound"){if(view!=="inbound")showNotice("info","กรุณาปิดกล้องก่อนเปลี่ยนหน้า");return}
  stopCamera();
  state.view = view; const titles = { operations:"งานรับสินค้า", inbound:"แผนก Inbound", dashboard:"ภาพรวมการปฏิบัติงาน", admin:"ตั้งค่าระบบ" };
  $("pageTitle").textContent = titles[view]; document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("pageContent").innerHTML = `<div class="loading">กำลังโหลดข้อมูล</div>`;
  if (view === "admin") return renderAdmin();
  try { const data = await api("/api/vehicles/active"); state.vehicles = data.items || []; renderCurrentView(); }
  catch (error) { $("pageContent").innerHTML = `<div class="empty-state"><b>โหลดข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span></div>`; }
}

function renderCurrentView() { if (state.view === "operations") renderOperations(); else if (state.view === "inbound") renderInbound(); else if (state.view === "dashboard") renderDashboard(); }

async function refreshLiveData(){
  if(!state.user||document.hidden||scannerState.active||!["operations","dashboard"].includes(state.view)||document.activeElement?.tagName==="INPUT")return;
  try{const data=await api("/api/vehicles/active");state.vehicles=data.items||[];renderCurrentView()}catch{}
}

function renderOperations() {
  const items = state.vehicles.filter(v => ["READY_FOR_RECEIVING","RECEIVING_IN_PROGRESS"].includes(v.current_status));
  $("pageContent").innerHTML = `<section class="summary-strip">${summary("พร้อมตรวจรับ",countStatus("READY_FOR_RECEIVING"))}${summary("กำลังตรวจรับ",countStatus("RECEIVING_IN_PROGRESS"))}${summary("ล่าช้า",0)}${summary("รถในพื้นที่",state.vehicles.length)}</section><div class="toolbar"><input id="jobSearch" placeholder="ค้นหาเลขนัดหมาย บริษัท ทะเบียนรถ หรือประตู"><button id="refreshButton">โหลดใหม่</button></div><section id="jobGrid" class="job-grid"></section>`;
  renderJobCards(items); $("jobSearch").addEventListener("input", e => renderJobCards(items.filter(v => searchable(v).includes(e.target.value.toLowerCase())))); $("refreshButton").addEventListener("click", () => navigate("operations"));
}

function renderJobCards(items) {
  $("jobGrid").innerHTML = items.length ? items.map(v => `<article class="job-card"><div class="job-head"><div><small>เลขนัดหมาย</small><h2>${escapeHtml(v.appointment_no || "ไม่ระบุ")}</h2></div><span class="badge">${statusLabel(v.current_status)}</span></div><div class="dense-grid"><div class="wide"><small>บริษัท</small><b>${escapeHtml(v.company_name || "ไม่ระบุ")}</b></div><div><small>ทะเบียนรถ</small><b>${escapeHtml(joinText(v.vehicle_plate,v.province))}</b></div><div><small>ประตู</small><b>${escapeHtml(v.door_code || "ไม่ต้องระบุ")}</b></div><div><small>Gate In</small><b>${formatDate(v.gate_in_at)}</b></div><div><small>สถานะ</small><b>${statusLabel(v.current_status)}</b></div></div></article>`).join("") : `<div class="empty-state"><b>ไม่มีรถที่พร้อมตรวจรับ</b><span>รายการใหม่จะแสดงเมื่อผ่านขั้นตอนที่กำหนด</span></div>`;
}

function renderInbound() {
  const counts=statusCounts();
  const kioskLogout=state.user.accessRights==="INBOUND"?`<button id="kioskLogout" class="quiet-button">ออกจากระบบ</button>`:"";
  $("pageContent").innerHTML = `<section class="inbound-controlbar"><div class="inbound-kiosk-title"><b>จุดบริการคนขับรถ</b><span>ระบบพร้อมรับ QR Code ต่อเนื่อง</span></div><div class="inbound-page-actions"><button id="fullscreenButton" class="quiet-button">เต็มหน้าจอ</button>${kioskLogout}</div></section><section class="scanner-panel"><div class="scanner"><div id="scanFrame" class="scan-frame"><video id="qrVideo" class="qr-video" playsinline muted hidden></video><canvas id="qrCanvas" hidden></canvas><div id="scanPlaceholder" class="scan-placeholder">⌗<span>วาง QR Code ให้อยู่ในกรอบ</span></div><div id="scanBeam" class="scan-beam" hidden></div></div><div class="scan-actions"><button id="startCamera" class="primary">เปิดกล้องสแกน</button><button id="stopCamera" class="outline-button" hidden>ปิดกล้อง</button></div></div><div class="scan-side"><div class="scan-input-block"><h2>บันทึกยื่นเอกสาร</h2><p>ใช้เครื่องสแกน กล้อง หรือกรอก Auto ID</p><div class="auto-input"><input id="autoSearch" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="สแกนหรือกรอก Auto ID"><button id="autoButton" class="primary">บันทึก</button></div><small class="input-hint">เครื่องสแกนที่ส่ง Enter จะบันทึกอัตโนมัติ</small></div><div class="inbound-metrics">${inboundMetric("metricWaiting","รอยื่นเอกสาร",counts.WAITING_DOCUMENT_SUBMISSION,"metric-orange")}${inboundMetric("metricReady","พร้อมตรวจรับ",counts.READY_FOR_RECEIVING,"metric-green")}${inboundMetric("metricProgress","กำลังตรวจรับ",counts.RECEIVING_IN_PROGRESS,"metric-blue")}${inboundMetric("metricReturn","รอรับเอกสารคืน",counts.WAITING_DOCUMENT_RETURN,"metric-pink")}${inboundMetric("metricGateout","รอออกจากพื้นที่",counts.WAITING_GATE_OUT,"metric-sky")}${inboundMetric("metricTotal","รถในพื้นที่",state.vehicles.length,"metric-magenta")}</div></div></section><section class="list-card"><header><h2>รถที่ยังอยู่ในพื้นที่</h2><span id="inboundListCount">${state.vehicles.length} รายการ</span></header><div id="inboundRows"></div></section>`;
  renderInboundRows(state.vehicles);
  const filter=()=>{const q=$("autoSearch").value.trim().toLowerCase();renderInboundRows(state.vehicles.filter(v=>searchable(v).includes(q)))};
  $("autoSearch").addEventListener("input",filter);
  $("autoSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();if(submitState.busy)return;playFeedbackSound("scan");submitManualAutoId("scanner")}});
  $("autoButton").addEventListener("click",()=>submitManualAutoId("manual"));
  $("startCamera").addEventListener("click",startCamera);
  $("stopCamera").addEventListener("click",stopCamera);
  $("fullscreenButton").addEventListener("click",toggleFullscreen);
  $("kioskLogout")?.addEventListener("click",logout);
  $("inboundRows").addEventListener("click",event=>{const row=event.target.closest("[data-auto-id]");if(row)showInboundVehicleDetails(row.dataset.autoId)});
  $("inboundRows").addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;const row=event.target.closest("[data-auto-id]");if(row){event.preventDefault();showInboundVehicleDetails(row.dataset.autoId)}});
  updateFullscreenButton();
  window.setTimeout(()=>$("autoSearch")?.focus({preventScroll:true}),50);
}

function renderInboundRows(items) { $("inboundRows").innerHTML = items.length ? items.map(v => `<div class="list-row status-row ${statusTone(v.current_status)}" data-auto-id="${escapeHtml(v.auto_id)}" role="button" tabindex="0" aria-label="เปิดรายละเอียด ${escapeHtml(v.appointment_no||v.auto_id)}"><b>${escapeHtml(v.appointment_no || v.auto_id)}</b><span>${escapeHtml(v.company_name || "ไม่ระบุ")}</span><span>${escapeHtml(joinText(v.vehicle_plate,v.province))}</span><span>${escapeHtml(v.door_code || "-")}</span><span class="badge status-badge">${statusLabel(v.current_status)}</span></div>`).join("") : `<div class="empty-state"><b>ไม่พบข้อมูล</b></div>`; }
function inboundMetric(id,label,value,tone){return `<article class="inbound-metric ${tone}"><small>${label}</small><b id="${id}">${Number(value)||0}</b></article>`}

function submitManualAutoId(source="manual"){const input=$("autoSearch");const autoId=normalizeAutoId(input?.value);if(!autoId){playFeedbackSound("error");showNotice("warning","กรุณากรอก Auto ID");input?.focus();return}if(input)input.value=autoId;if(source!=="scanner")playFeedbackSound("scan");confirmInboundSubmit(autoId,source)}

async function startCamera(){
  if(scannerState.active)return;
  unlockAudio();
  if(!navigator.mediaDevices?.getUserMedia){showNotice("info","อุปกรณ์นี้ยังไม่พร้อมใช้งานกล้อง กรุณาใช้เครื่องสแกนหรือกรอก Auto ID");return}
  try{
    scannerState.detector=null;
    if("BarcodeDetector" in window){
      const formats=typeof BarcodeDetector.getSupportedFormats==="function"?await BarcodeDetector.getSupportedFormats():["qr_code"];
      if(formats.includes("qr_code"))scannerState.detector=new BarcodeDetector({formats:["qr_code"]});
    }
    if(!scannerState.detector&&typeof window.jsQR!=="function"){showNotice("info","อุปกรณ์นี้ยังไม่พร้อมอ่าน QR Code กรุณาใช้เครื่องสแกนหรือกรอก Auto ID");return}
    scannerState.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
    const track=scannerState.stream.getVideoTracks()[0];
    try{const capabilities=track?.getCapabilities?.();if(capabilities?.focusMode?.includes("continuous"))await track.applyConstraints({advanced:[{focusMode:"continuous"}]})}catch{}
    const video=$("qrVideo"),canvas=$("qrCanvas");if(!video||!canvas){stopCamera();return}
    scannerState.canvas=canvas;scannerState.context=canvas.getContext("2d",{willReadFrequently:true});scannerState.lastValue="";scannerState.lastSeenAt=0;scannerState.repeatCount=0;
    video.srcObject=scannerState.stream;video.hidden=false;$("scanPlaceholder").hidden=true;$("scanBeam").hidden=false;$("startCamera").hidden=true;$("stopCamera").hidden=false;$("scanFrame").classList.add("camera-on");await video.play();scannerState.active=true;scannerState.reading=false;scanCameraFrame();
  }catch(error){stopCamera();const denied=error?.name==="NotAllowedError"||error?.name==="PermissionDeniedError";showNotice("error",denied?"ไม่ได้รับอนุญาตให้เปิดกล้อง กรุณาอนุญาตกล้องแล้วลองใหม่":"เปิดกล้องไม่สำเร็จ กรุณากรอก Auto ID")}
}

async function scanCameraFrame(){
  if(!scannerState.active||scannerState.reading)return;
  if(uiState.detailsOpen){scannerState.timer=window.setTimeout(scanCameraFrame,250);return}
  const video=$("qrVideo");if(!video)return;
  try{
    let rawValue="";
    if(scannerState.detector){const codes=await scannerState.detector.detect(video);rawValue=String(codes?.[0]?.rawValue||"")}
    if(!rawValue&&typeof window.jsQR==="function"&&video.readyState>=2&&scannerState.context){
      const width=video.videoWidth,height=video.videoHeight;
      if(width&&height){scannerState.canvas.width=width;scannerState.canvas.height=height;scannerState.context.drawImage(video,0,0,width,height);const pixels=scannerState.context.getImageData(0,0,width,height);rawValue=window.jsQR(pixels.data,width,height,{inversionAttempts:"attemptBoth"})?.data||""}
    }
    if(uiState.detailsOpen){scannerState.timer=window.setTimeout(scanCameraFrame,250);return}
    const value=normalizeAutoId(rawValue),now=Date.now();
    if(value){
      if(value===scannerState.lastValue&&now-scannerState.lastSeenAt<1500)scannerState.repeatCount+=1;else scannerState.repeatCount=1;
      scannerState.lastValue=value;scannerState.lastSeenAt=now;
      if(scannerState.repeatCount>=2){
        scannerState.reading=true;playFeedbackSound("scan");if($("autoSearch"))$("autoSearch").value=value;
        try{await confirmInboundSubmit(value,"camera")}
        finally{scannerState.reading=false;scannerState.lastValue="";scannerState.lastSeenAt=0;scannerState.repeatCount=0;if(scannerState.active)scannerState.timer=window.setTimeout(scanCameraFrame,300)}
        return;
      }
    }
  }catch{}
  scannerState.timer=window.setTimeout(scanCameraFrame,120);
}

function stopCamera(){
  scannerState.active=false;scannerState.reading=false;if(scannerState.timer)window.clearTimeout(scannerState.timer);scannerState.timer=0;
  if(scannerState.stream)scannerState.stream.getTracks().forEach(track=>track.stop());scannerState.stream=null;scannerState.detector=null;scannerState.canvas=null;scannerState.context=null;scannerState.lastValue="";scannerState.lastSeenAt=0;scannerState.repeatCount=0;
  const video=$("qrVideo");if(video){video.pause();video.srcObject=null;video.hidden=true}
  if($("scanPlaceholder"))$("scanPlaceholder").hidden=false;if($("scanBeam"))$("scanBeam").hidden=true;if($("startCamera"))$("startCamera").hidden=false;if($("stopCamera"))$("stopCamera").hidden=true;if($("scanFrame"))$("scanFrame").classList.remove("camera-on");
}

async function confirmInboundSubmit(autoId,source){
  const rawValue=normalizeAutoId(autoId);if(!rawValue||submitState.busy)return;
  const vehicle=state.vehicles.find(item=>String(item.auto_id).toLowerCase()===rawValue.toLowerCase()),value=vehicle?String(vehicle.auto_id):rawValue,automatic=["scanner","camera"].includes(source);
  if(!window.Swal){
    if(!automatic&&!window.confirm(`ยืนยันยื่นเอกสาร Auto ID: ${value}`))return;
    submitState.busy=true;
    try{const idempotencyKey=createIdempotencyKey(),result=await api("/api/workflow/inbound-submit",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:value,idempotencyKey,source}});playFeedbackSound(result.duplicate?"duplicate":"success");showKioskMessage(result.message||"บันทึกเรียบร้อย",true);if(scannerState.active&&state.view==="inbound")await refreshInboundKioskData();else await navigate("inbound")}
    catch(error){playFeedbackSound("error");showKioskMessage(error.message,false)}
    finally{submitState.busy=false;if(automatic&&$("autoSearch"))$("autoSearch").value="";$("autoSearch")?.focus()}
    return;
  }
  const details=vehicleDetailsHtml(vehicle,value);
  submitState.busy=true;
  if(!automatic){
    const confirmation=await Swal.fire({title:"ยืนยันยื่นเอกสาร",html:details,icon:"question",showCancelButton:true,confirmButtonText:"ยืนยันบันทึก",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:swalClasses(),buttonsStyling:false,width:420});
    if(!confirmation.isConfirmed){submitState.busy=false;$("autoSearch")?.focus();return}
  }
  Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});
  const idempotencyKey=createIdempotencyKey();
  try{
    const result=await api("/api/workflow/inbound-submit",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:value,idempotencyKey,source}});
    const duplicate=Boolean(result.duplicate);playFeedbackSound(duplicate?"duplicate":"success");
    await Swal.fire({icon:duplicate?"warning":"success",title:duplicate?"ยื่นเอกสารแล้ว":"บันทึกเรียบร้อย",html:`<p class="swal-message${duplicate?" duplicate-message":""}">${escapeHtml(result.message||"บันทึกเวลายื่นเอกสารแล้ว")}</p>${vehicleDetailsHtml(result.vehicle||vehicle,value)}`,timer:duplicate?4200:(automatic?2600:2200),timerProgressBar:automatic,showConfirmButton:false,allowOutsideClick:!automatic,allowEscapeKey:!automatic,customClass:swalClasses(),width:420});
    if(scannerState.active&&state.view==="inbound")await refreshInboundKioskData();else await navigate("inbound");
  }catch(error){playFeedbackSound("error");const errorVehicle=error.data?.vehicle||vehicle;await Swal.fire({icon:"error",title:"บันทึกไม่สำเร็จ",html:`<p class="swal-message">${escapeHtml(error.message)}</p>${vehicleDetailsHtml(errorVehicle,value)}`,timer:automatic?5000:undefined,timerProgressBar:automatic,showConfirmButton:!automatic,confirmButtonText:"ตกลง",allowOutsideClick:!automatic,allowEscapeKey:!automatic,customClass:swalClasses(),buttonsStyling:false,width:420})}
  finally{submitState.busy=false;if(automatic&&$("autoSearch"))$("autoSearch").value="";$("autoSearch")?.focus()}
}

function vehicleDetailsHtml(vehicle,autoId){
  const read=(snake,camel)=>vehicle?.[snake]??vehicle?.[camel]??"";
  const driver=read("driver_name","driverName")||joinText(read("driver_title","driverTitle"),read("driver_first_name","driverFirstName"),read("driver_last_name","driverLastName"));
  return `<div class="confirm-grid"><span>Auto ID</span><b>${escapeHtml(autoId||read("auto_id","autoId")||"ไม่ระบุ")}</b><span>เลขนัดหมาย</span><b>${escapeHtml(read("appointment_no","appointmentNo")||"ไม่พบข้อมูล")}</b><span>บริษัท</span><b>${escapeHtml(read("company_name","companyName")||"ไม่พบข้อมูล")}</b><span>ชื่อคนขับรถ</span><b>${escapeHtml(driver||"ไม่พบข้อมูล")}</b><span>ทะเบียนรถ</span><b>${escapeHtml(joinText(read("vehicle_plate","vehiclePlate"),read("province","province")))}</b></div>`;
}

async function showInboundVehicleDetails(autoId){
  if(uiState.detailsOpen||submitState.busy)return;
  const vehicle=state.vehicles.find(item=>String(item.auto_id)===String(autoId));if(!vehicle)return;
  uiState.detailsOpen=true;
  const driver=vehicle.driver_name||"ไม่ระบุ",status=statusLabel(vehicle.current_status);
  const html=`<div class="vehicle-detail-status ${statusTone(vehicle.current_status)}"><span></span><b>${escapeHtml(status)}</b></div><div class="confirm-grid vehicle-detail-grid"><span>Auto ID</span><b>${escapeHtml(vehicle.auto_id)}</b><span>เลขนัดหมาย</span><b>${escapeHtml(vehicle.appointment_no||"ไม่ระบุ")}</b><span>บริษัท</span><b>${escapeHtml(vehicle.company_name||"ไม่ระบุ")}</b><span>ชื่อคนขับรถ</span><b>${escapeHtml(driver)}</b><span>ทะเบียนรถ</span><b>${escapeHtml(joinText(vehicle.vehicle_plate,vehicle.province))}</b><span>ประเภทรถ</span><b>${escapeHtml(vehicle.vehicle_type||"ไม่ระบุ")}</b><span>ประตู</span><b>${escapeHtml(vehicle.door_code||"ไม่ระบุ")}</b><span>Gate In</span><b>${escapeHtml(formatDate(vehicle.gate_in_at))}</b><span>ยื่นเอกสาร</span><b>${escapeHtml(formatDate(vehicle.document_submitted_at))}</b></div>`;
  try{if(window.Swal)await Swal.fire({title:"รายละเอียดรถ",html,confirmButtonText:"ปิด",customClass:swalClasses(),buttonsStyling:false,width:440});else window.alert(`${vehicle.appointment_no||vehicle.auto_id} — ${status}`)}
  finally{uiState.detailsOpen=false}
}

async function toggleFullscreen(){
  try{if(!document.fullscreenElement){if(!document.documentElement.requestFullscreen)throw new Error("unsupported");await document.documentElement.requestFullscreen()}else await document.exitFullscreen()}
  catch{showNotice("info","เบราว์เซอร์นี้ไม่รองรับการเปิดเต็มหน้าจอ")}
  updateFullscreenButton();
}
function updateFullscreenButton(){const button=$("fullscreenButton");if(button)button.textContent=document.fullscreenElement?"ออกจากเต็มหน้าจอ":"เต็มหน้าจอ"}

function normalizeAutoId(value){return String(value??"").replace(/[\r\n\t]/g,"").trim()}
function unlockAudio(){try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==="suspended")audioContext.resume()}catch{}}
function playFeedbackSound(kind){
  unlockAudio();if(!audioContext)return;
  const notes=kind==="success"?[[660,0,.09],[880,.11,.13]]:kind==="duplicate"?[[520,0,.1],[520,.15,.1],[390,.3,.16]]:kind==="error"?[[220,0,.12],[180,.15,.16]]:[[940,0,.09]];
  notes.forEach(([frequency,delay,duration])=>{const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+delay;oscillator.type="sine";oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.13,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+duration+.02)});
}
function showKioskMessage(text,success){const toast=$("toast");if(!toast)return;toast.hidden=false;toast.classList.toggle("toast-error",!success);const label=toast.querySelector("span"),mark=toast.querySelector("b");if(label)label.textContent=text;if(mark)mark.textContent=success?"✓":"!";window.setTimeout(()=>{toast.hidden=true;toast.classList.remove("toast-error")},success?2600:5000)}
async function refreshInboundKioskData(){const data=await api("/api/vehicles/active");state.vehicles=data.items||[];renderInboundRows(state.vehicles);updateInboundMetrics();if($("inboundListCount"))$("inboundListCount").textContent=`${state.vehicles.length} รายการ`}
function updateInboundMetrics(){const counts=statusCounts(),values={metricWaiting:counts.WAITING_DOCUMENT_SUBMISSION,metricReady:counts.READY_FOR_RECEIVING,metricProgress:counts.RECEIVING_IN_PROGRESS,metricReturn:counts.WAITING_DOCUMENT_RETURN,metricGateout:counts.WAITING_GATE_OUT,metricTotal:state.vehicles.length};Object.entries(values).forEach(([id,value])=>{if($(id))$(id).textContent=Number(value)||0})}
function statusCounts(){return state.vehicles.reduce((counts,vehicle)=>{counts[vehicle.current_status]=(counts[vehicle.current_status]||0)+1;return counts},{})}

function showNotice(icon,text){if(window.Swal)return Swal.fire({icon,title:text,confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:360});window.alert(text)}
function swalClasses(){return{popup:"wfv-swal",confirmButton:"wfv-swal-confirm",cancelButton:"wfv-swal-cancel"}}
function createIdempotencyKey(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`}

function renderDashboard() {
  $("pageContent").innerHTML = `<div class="dashboard-tools"><button class="outline-button">วันนี้</button><button class="outline-button">ทุกกะ</button></div><section class="dashboard-grid">${dashboardCard("รถอยู่ในพื้นที่",state.vehicles.length)}${dashboardCard("รอยื่นเอกสาร",countStatus("WAITING_DOCUMENT_SUBMISSION"))}${dashboardCard("พร้อมตรวจรับ",countStatus("READY_FOR_RECEIVING"))}${dashboardCard("กำลังตรวจรับ",countStatus("RECEIVING_IN_PROGRESS"))}${dashboardCard("รอรับเอกสารคืน",countStatus("WAITING_DOCUMENT_RETURN"))}${dashboardCard("รอออกจากพื้นที่",countStatus("WAITING_GATE_OUT"))}</section><section class="list-card"><header><h2>สถานะปัจจุบัน</h2><span>รายการล่าสุด</span></header>${state.vehicles.slice(0,20).map(v => `<div class="list-row"><b>${escapeHtml(v.appointment_no || v.auto_id)}</b><span>${escapeHtml(v.company_name || "ไม่ระบุ")}</span><span>${escapeHtml(v.door_code || "-")}</span><span>${statusLabel(v.current_status)}</span><span>${formatDate(v.gate_in_at)}</span></div>`).join("") || `<div class="empty-state"><b>ไม่มีรถอยู่ในพื้นที่</b></div>`}</section>`;
}

function renderAdmin() { $("pageContent").innerHTML = `<section class="settings-grid"><article class="settings-card"><h2>สถานะระบบ</h2><p>ระบบพร้อมใช้งานและตรวจสอบสิทธิ์ก่อนแสดงข้อมูลทุกครั้ง</p><span class="badge">พร้อมใช้งาน</span></article><article class="settings-card"><h2>การตั้งค่าการทำงาน</h2><p>จัดการขั้นตอนการทำงาน กะ ประตูรับสินค้า และเงื่อนไขการแจ้งเตือน</p></article></section>`; }

async function logout() { try { await api("/api/auth/logout",{method:"POST"}); } catch {} clearSession(); }
function clearSession() { stopCamera(); sessionStorage.removeItem("wvf_token"); state.token=""; state.user=null; $("appView").hidden=true; $("loginView").hidden=false; $("loginPassword").value=""; window.scrollTo(0, 0); }
function togglePassword() { const input=$("loginPassword"); input.type=input.type==="password"?"text":"password"; $("togglePassword").textContent=input.type==="password"?"ดู":"ซ่อน"; }

async function api(path, options={}) {
  if (!cfg.apiBaseUrl || cfg.apiBaseUrl.includes("PUT-YOUR-WORKER")) throw new Error("ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล");
  const headers={"content-type":"application/json",...(options.headers||{})}; if (options.auth !== false && state.token) headers.authorization=`Bearer ${state.token}`;
  let response; try { response=await fetch(cfg.apiBaseUrl.replace(/\/$/,"")+path,{method:options.method||"GET",headers,body:options.body?JSON.stringify(options.body):undefined}); setConnection(true); } catch { setConnection(false); throw new Error("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง"); }
  const data=await response.json().catch(()=>({success:false,message:"ระบบตอบกลับไม่สมบูรณ์"})); if (!response.ok || data.success===false) { if(response.status===401&&path!=="/api/auth/login") clearSession(); const error=new Error(data.message||"ดำเนินการไม่สำเร็จ");error.status=response.status;error.data=data;throw error; } return data;
}

function setConnection(online) { state.online=online; $("connectionBanner").hidden=online; if($("syncStatus")) { $("syncStatus").textContent=online?"● พร้อมใช้งาน":"● รอเชื่อมต่อ"; $("syncStatus").style.color=online?"#08783a":"#a82020"; } }
function updateClocks() { const value=formatDate(Math.floor(Date.now()/1000)); if($("thaiClock")) $("thaiClock").textContent=value; if($("headerClock")) $("headerClock").textContent=value; }
function formatDate(seconds) { if(!seconds)return"-"; const parts=new Intl.DateTimeFormat("en-GB",{timeZone:cfg.timezone,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(new Date(Number(seconds)*1000)); const p=Object.fromEntries(parts.map(x=>[x.type,x.value])); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`; }
function countStatus(status){return state.vehicles.filter(v=>v.current_status===status).length} function summary(label,value){return `<div class="summary-card"><small>${label}</small><b>${value}</b></div>`} function dashboardCard(label,value){return `<article class="dashboard-card"><small>${label}</small><b>${value}</b></article>`}
function statusLabel(status){return ({WAITING_DOCUMENT_SUBMISSION:"รอยื่นเอกสาร",DOCUMENT_SUBMITTED:"ยื่นเอกสารแล้ว",READY_FOR_RECEIVING:"พร้อมตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",DOCUMENT_RETURNED:"รับเอกสารคืนแล้ว",WAITING_GATE_OUT:"รอออกจากพื้นที่",CLOSED:"ปิดงาน"})[status]||"กำลังดำเนินงาน"}
function statusTone(status){return ({WAITING_DOCUMENT_SUBMISSION:"tone-waiting",DOCUMENT_SUBMITTED:"tone-submitted",READY_FOR_RECEIVING:"tone-ready",RECEIVING_IN_PROGRESS:"tone-progress",WAITING_DOCUMENT_RETURN:"tone-return",DOCUMENT_RETURNED:"tone-returned",WAITING_GATE_OUT:"tone-gateout",CLOSED:"tone-closed"})[status]||"tone-default"}
function roleLabel(role){return ({ADMIN:"ผู้ดูแลระบบ",USER:"แผนกรับสินค้า",INBOUND:"แผนก Inbound"})[role]||role} function joinText(...parts){return parts.filter(Boolean).join(" ")||"ไม่ระบุ"} function searchable(v){return [v.auto_id,v.appointment_no,v.company_name,v.driver_name,v.vehicle_plate,v.province,v.door_code].filter(Boolean).join(" ").toLowerCase()} function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c])}
