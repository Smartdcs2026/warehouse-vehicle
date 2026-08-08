"use strict";
const cfg=window.APP_CONFIG||{};
const $=id=>document.getElementById(id);
let timer=0,lastOk=0,inFlight=false,lastFingerprint="",hasRendered=false;

document.addEventListener("DOMContentLoaded",()=>{
  loadTrack(true);
  window.addEventListener("online",()=>loadTrack(true));
  window.addEventListener("offline",()=>{setFresh("off","เครือข่ายขัดข้อง");schedule(30000)});
  document.addEventListener("visibilitychange",()=>{
    clearTimeout(timer);
    if(document.hidden){setFresh("wait","พักการอัปเดต");return}
    loadTrack(true);
  });
  window.addEventListener("pageshow",()=>{if(!document.hidden)loadTrack(true)});
});

function token(){return new URLSearchParams(location.search).get("t")||""}
function schedule(ms){clearTimeout(timer);if(document.hidden)return;timer=setTimeout(()=>loadTrack(false),Math.max(8000,Number(ms)||20000))}

async function loadTrack(force){
  if(document.hidden||inFlight)return;
  const t=token();
  if(!t){showError("ไม่พบลิงก์สำหรับตรวจสอบสถานะ");return}
  inFlight=true;
  try{
    const controller=new AbortController();
    const cut=setTimeout(()=>controller.abort(),6000);
    const response=await fetch(`${cfg.apiBaseUrl}/api/public/track?t=${encodeURIComponent(t)}`,{
      cache:"no-store",signal:controller.signal,headers:{"accept":"application/json"}
    });
    clearTimeout(cut);
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success){
      const error=new Error(data.message||"ตรวจสอบสถานะไม่สำเร็จ");
      error.expired=Boolean(data.expired);error.disabled=Boolean(data.disabled);throw error;
    }
    lastOk=Date.now();
    const fingerprint=JSON.stringify({v:data.vehicle,t:data.timeline,closed:data.closed,expiresAt:data.expiresAt,instruction:data.instruction});
    if(force||fingerprint!==lastFingerprint||!hasRendered){render(data);lastFingerprint=fingerprint;hasRendered=true}
    setFresh("","ข้อมูลล่าสุด");
    $("trackUpdated").textContent=`อัปเดต ${timeText(data.generatedAt)}`;
    const seconds=Math.max(10,Math.min(60,Number(data.refreshSeconds)||20));
    schedule(seconds*1000);
  }catch(error){
    if(hasRendered||lastOk){
      setFresh("wait",navigator.onLine?"รออัปเดตข้อมูล":"เครือข่ายขัดข้อง");
      schedule(navigator.onLine?15000:30000);
    }else{
      showError(error.name==="AbortError"?"การเชื่อมต่อใช้เวลานานเกินไป":error.message);
      schedule(error.expired||error.disabled?60000:15000);
    }
  }finally{inFlight=false}
}

function render(data){
  const v=data.vehicle||{},steps=data.timeline||[],currentIndex=currentStepIndex(steps,v.status);
  const instruction=String(data.instruction||instructionFor(v.status,v.doorCode));
  const expiry=data.expiresAt?dateText(data.expiresAt):"-";
  $("trackMain").innerHTML=`<article class="track-card">
    <section class="track-status ${data.closed?"closed":""}">
      <small>สถานะปัจจุบัน</small><h1>${esc(v.statusLabel||"กำลังดำเนินการ")}</h1>
      <p>${data.closed?"รายการนี้ดำเนินการเสร็จสิ้นแล้ว":"ข้อมูลจะอัปเดตอัตโนมัติ"}</p>
    </section>
    <section class="track-instruction"><small>สิ่งที่ต้องทำ</small><b>${esc(instruction)}</b></section>
    <section class="track-summary">
      <div><small>หมายเลขนัดหมาย</small><b>${esc(v.appointmentNo||"-")}</b></div>
      <div><small>บริษัท</small><b>${esc(v.companyName||"ไม่ระบุ")}</b></div>
      <div><small>ทะเบียนรถ</small><b>${esc([v.vehiclePlate,v.province].filter(Boolean).join(" ")||"ไม่ระบุ")}</b></div>
      <div><small>เข้าพื้นที่</small><b>${esc(dateText(v.gateInAt))}</b></div>
    </section>
    ${v.doorCode?`<section class="track-door"><span>ประตูรับสินค้า</span><b>${esc(v.doorCode)}</b></section>`:""}
    <section class="track-timeline"><h2>ความคืบหน้า</h2>${steps.map((step,index)=>`<div class="track-step ${step.done?"done":""} ${!step.done&&index===currentIndex?"current":""}"><i aria-hidden="true"></i><b>${esc(step.label)}</b><span>${step.at?timeText(step.at):"รอดำเนินการ"}</span></div>`).join("")}</section>
    <section class="track-expiry"><span>ติดตามได้ถึง</span><b>${esc(expiry)}</b></section>
  </article>`;
}

function instructionFor(status,door){
  if(status==="WAITING_DOCUMENT_SUBMISSION")return"กรุณายื่นเอกสารที่จุดบริการ";
  if(status==="READY_FOR_RECEIVING")return"กรุณารอการเรียกเข้าตรวจรับ";
  if(status==="RECEIVING_IN_PROGRESS")return door?`กรุณาดำเนินการตรวจรับที่ประตู ${door}`:"กำลังตรวจรับสินค้า";
  if(status==="WAITING_DOCUMENT_RETURN")return"กรุณารอรับเอกสารคืน";
  if(status==="WAITING_GATE_OUT")return"รับเอกสารแล้ว กรุณาดำเนินการออกจากพื้นที่";
  if(status==="CLOSED")return"รายการเสร็จสิ้นแล้ว";
  return"กรุณาตรวจสอบสถานะบนหน้านี้";
}
function currentStepIndex(steps,status){const map={WAITING_DOCUMENT_SUBMISSION:1,READY_FOR_RECEIVING:2,RECEIVING_IN_PROGRESS:3,WAITING_DOCUMENT_RETURN:4,WAITING_GATE_OUT:5,CLOSED:6},idx=map[status]??0;return Math.max(0,Math.min(steps.length-1,idx))}
function showError(message){$("trackMain").innerHTML=`<div class="track-error"><b>ไม่สามารถแสดงสถานะได้</b><span>${esc(message)}</span><button id="trackRetry" type="button">ลองใหม่</button></div>`;$("trackRetry")?.addEventListener("click",()=>loadTrack(true));setFresh("off","ตรวจสอบไม่สำเร็จ")}
function setFresh(cls,text){const el=$("trackFresh");el.className=`track-fresh ${cls||""}`;el.textContent=text}
function dateText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(Number(ts)*1000))}
function timeText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(Number(ts)*1000))}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
