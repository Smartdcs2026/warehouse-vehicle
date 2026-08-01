"use strict";

const cfg = window.APP_CONFIG;
const state = { token: sessionStorage.getItem("wvf_token") || "", user: null, view: "operations", vehicles: [], online: navigator.onLine };
const scannerState = { active:false, stream:null, detector:null, timer:0, reading:false };
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("online", () => setConnection(true));
window.addEventListener("offline", () => setConnection(false));
document.addEventListener("visibilitychange", () => { if (document.hidden) stopCamera(); });

async function init() {
  $("brandName").textContent = cfg.appName;
  $("loginForm").addEventListener("submit", login);
  $("logoutButton").addEventListener("click", logout);
  $("togglePassword").addEventListener("click", togglePassword);
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
  const waiting=countStatus("WAITING_DOCUMENT_SUBMISSION");
  $("pageContent").innerHTML = `<section class="inbound-summary"><div><small>รอยื่นเอกสาร</small><b>${waiting}</b></div><div><small>รถในพื้นที่</small><b>${state.vehicles.length}</b></div></section><section class="scanner-panel"><div class="scanner"><div id="scanFrame" class="scan-frame"><video id="qrVideo" class="qr-video" playsinline muted hidden></video><div id="scanPlaceholder" class="scan-placeholder">⌗<span>วาง QR Code ให้อยู่ในกรอบ</span></div><div id="scanBeam" class="scan-beam" hidden></div></div><div class="scan-actions"><button id="startCamera" class="primary">เปิดกล้องสแกน</button><button id="stopCamera" class="outline-button" hidden>ปิดกล้อง</button></div></div><div class="scan-side"><h2>บันทึกยื่นเอกสาร</h2><p>สแกน QR Code หรือกรอก Auto ID</p><div class="auto-input"><input id="autoSearch" autocomplete="off" autocapitalize="characters" placeholder="กรอก Auto ID"><button id="autoButton" class="primary">บันทึก</button></div><small class="input-hint">ตรวจสอบ Auto ID ก่อนยืนยันทุกครั้ง</small></div></section><section class="list-card"><header><h2>รถที่ยังอยู่ในพื้นที่</h2><span>${state.vehicles.length} รายการ</span></header><div id="inboundRows"></div></section>`;
  renderInboundRows(state.vehicles);
  const filter=()=>{const q=$("autoSearch").value.trim().toLowerCase();renderInboundRows(state.vehicles.filter(v=>searchable(v).includes(q)))};
  $("autoSearch").addEventListener("input",filter);
  $("autoSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();submitManualAutoId()}});
  $("autoButton").addEventListener("click",submitManualAutoId);
  $("startCamera").addEventListener("click",startCamera);
  $("stopCamera").addEventListener("click",stopCamera);
}

function renderInboundRows(items) { $("inboundRows").innerHTML = items.length ? items.map(v => `<div class="list-row"><b>${escapeHtml(v.appointment_no || v.auto_id)}</b><span>${escapeHtml(v.company_name || "ไม่ระบุ")}</span><span>${escapeHtml(joinText(v.vehicle_plate,v.province))}</span><span>${escapeHtml(v.door_code || "-")}</span><span class="badge">${statusLabel(v.current_status)}</span></div>`).join("") : `<div class="empty-state"><b>ไม่พบข้อมูล</b></div>`; }

function submitManualAutoId(){const input=$("autoSearch");const autoId=input?.value.trim();if(!autoId){showNotice("warning","กรุณากรอก Auto ID");input?.focus();return}confirmInboundSubmit(autoId,"manual")}

async function startCamera(){
  if(scannerState.active)return;
  if(!navigator.mediaDevices?.getUserMedia||!("BarcodeDetector" in window)){showNotice("info","อุปกรณ์นี้ยังไม่รองรับการอ่าน QR ผ่านกล้อง กรุณากรอก Auto ID");return}
  try{
    if(typeof BarcodeDetector.getSupportedFormats==="function"){const formats=await BarcodeDetector.getSupportedFormats();if(!formats.includes("qr_code")){showNotice("info","อุปกรณ์นี้ยังไม่รองรับ QR Code กรุณากรอก Auto ID");return}}
    scannerState.detector=new BarcodeDetector({formats:["qr_code"]});
    scannerState.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
    const video=$("qrVideo");if(!video){stopCamera();return}video.srcObject=scannerState.stream;video.hidden=false;$("scanPlaceholder").hidden=true;$("scanBeam").hidden=false;$("startCamera").hidden=true;$("stopCamera").hidden=false;$("scanFrame").classList.add("camera-on");await video.play();scannerState.active=true;scannerState.reading=false;scanCameraFrame();
  }catch(error){stopCamera();const denied=error?.name==="NotAllowedError"||error?.name==="PermissionDeniedError";showNotice("error",denied?"ไม่ได้รับอนุญาตให้เปิดกล้อง กรุณาอนุญาตกล้องแล้วลองใหม่":"เปิดกล้องไม่สำเร็จ กรุณากรอก Auto ID")}
}

async function scanCameraFrame(){
  if(!scannerState.active||scannerState.reading)return;
  const video=$("qrVideo");if(!video)return;
  try{const codes=await scannerState.detector.detect(video);const value=String(codes?.[0]?.rawValue||"").trim();if(value){scannerState.reading=true;stopCamera();if($("autoSearch"))$("autoSearch").value=value;await confirmInboundSubmit(value,"camera");return}}catch{}
  scannerState.timer=window.setTimeout(scanCameraFrame,180);
}

function stopCamera(){
  scannerState.active=false;scannerState.reading=false;if(scannerState.timer)window.clearTimeout(scannerState.timer);scannerState.timer=0;
  if(scannerState.stream)scannerState.stream.getTracks().forEach(track=>track.stop());scannerState.stream=null;scannerState.detector=null;
  const video=$("qrVideo");if(video){video.pause();video.srcObject=null;video.hidden=true}
  if($("scanPlaceholder"))$("scanPlaceholder").hidden=false;if($("scanBeam"))$("scanBeam").hidden=true;if($("startCamera"))$("startCamera").hidden=false;if($("stopCamera"))$("stopCamera").hidden=true;if($("scanFrame"))$("scanFrame").classList.remove("camera-on");
}

async function confirmInboundSubmit(autoId,source){
  const rawValue=String(autoId||"").trim();if(!rawValue)return;
  const vehicle=state.vehicles.find(item=>String(item.auto_id).toLowerCase()===rawValue.toLowerCase()),value=vehicle?String(vehicle.auto_id):rawValue;
  if(!window.Swal){if(!window.confirm(`ยืนยันยื่นเอกสาร Auto ID: ${value}`))return;try{const idempotencyKey=createIdempotencyKey(),result=await api("/api/workflow/inbound-submit",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:value,idempotencyKey,source}});window.alert(result.message||"บันทึกเรียบร้อย");await navigate("inbound")}catch(error){window.alert(error.message)}return}
  const details=vehicle?`<div class="confirm-grid"><span>Auto ID</span><b>${escapeHtml(value)}</b><span>เลขนัดหมาย</span><b>${escapeHtml(vehicle.appointment_no||"ไม่ระบุ")}</b><span>บริษัท</span><b>${escapeHtml(vehicle.company_name||"ไม่ระบุ")}</b><span>ทะเบียนรถ</span><b>${escapeHtml(joinText(vehicle.vehicle_plate,vehicle.province))}</b></div>`:`<div class="confirm-grid"><span>Auto ID</span><b>${escapeHtml(value)}</b></div>`;
  const confirmation=await Swal.fire({title:"ยืนยันยื่นเอกสาร",html:details,icon:"question",showCancelButton:true,confirmButtonText:"ยืนยันบันทึก",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:swalClasses(),buttonsStyling:false,width:420});
  if(!confirmation.isConfirmed)return;
  Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});
  const idempotencyKey=createIdempotencyKey();
  try{
    const result=await api("/api/workflow/inbound-submit",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:value,idempotencyKey,source}});
    await Swal.fire({icon:"success",title:result.duplicate?"บันทึกไว้แล้ว":"บันทึกเรียบร้อย",text:result.message||"บันทึกเวลายื่นเอกสารแล้ว",timer:1500,showConfirmButton:false,customClass:swalClasses(),width:350});
    await navigate("inbound");
  }catch(error){await Swal.fire({icon:"error",title:"บันทึกไม่สำเร็จ",text:error.message,confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:370})}
}

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
  const data=await response.json().catch(()=>({success:false,message:"ระบบตอบกลับไม่สมบูรณ์"})); if (!response.ok || data.success===false) { if(response.status===401&&path!=="/api/auth/login") clearSession(); throw new Error(data.message||"ดำเนินการไม่สำเร็จ"); } return data;
}

function setConnection(online) { state.online=online; $("connectionBanner").hidden=online; if($("syncStatus")) { $("syncStatus").textContent=online?"● พร้อมใช้งาน":"● รอเชื่อมต่อ"; $("syncStatus").style.color=online?"#08783a":"#a82020"; } }
function updateClocks() { const value=formatDate(Math.floor(Date.now()/1000)); if($("thaiClock")) $("thaiClock").textContent=value; if($("headerClock")) $("headerClock").textContent=value; }
function formatDate(seconds) { if(!seconds)return"-"; const parts=new Intl.DateTimeFormat("en-GB",{timeZone:cfg.timezone,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(new Date(Number(seconds)*1000)); const p=Object.fromEntries(parts.map(x=>[x.type,x.value])); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`; }
function countStatus(status){return state.vehicles.filter(v=>v.current_status===status).length} function summary(label,value){return `<div class="summary-card"><small>${label}</small><b>${value}</b></div>`} function dashboardCard(label,value){return `<article class="dashboard-card"><small>${label}</small><b>${value}</b></article>`}
function statusLabel(status){return ({WAITING_DOCUMENT_SUBMISSION:"รอยื่นเอกสาร",DOCUMENT_SUBMITTED:"ยื่นเอกสารแล้ว",READY_FOR_RECEIVING:"พร้อมตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",DOCUMENT_RETURNED:"รับเอกสารคืนแล้ว",WAITING_GATE_OUT:"รอออกจากพื้นที่",CLOSED:"ปิดงาน"})[status]||"กำลังดำเนินงาน"}
function roleLabel(role){return ({ADMIN:"ผู้ดูแลระบบ",USER:"แผนกรับสินค้า",INBOUND:"แผนก Inbound"})[role]||role} function joinText(a,b){return [a,b].filter(Boolean).join(" ")||"ไม่ระบุ"} function searchable(v){return [v.auto_id,v.appointment_no,v.company_name,v.vehicle_plate,v.province,v.door_code].filter(Boolean).join(" ").toLowerCase()} function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c])}
