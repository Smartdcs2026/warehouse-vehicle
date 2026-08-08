"use strict";
const cfg=window.APP_CONFIG||{};
const $=id=>document.getElementById(id);
let timer=0,lastOk=0,inFlight=false,lastFingerprint="",hasRendered=false,terminalError=false;

document.addEventListener("DOMContentLoaded",()=>{
  loadTrack(true);
  window.addEventListener("online",()=>{if(!terminalError)loadTrack(true)});
  window.addEventListener("offline",()=>{setFresh("off","เครือข่ายขัดข้อง");schedule(30000)});
  document.addEventListener("visibilitychange",()=>{
    clearTimeout(timer);
    if(document.hidden){setFresh("wait","พักการอัปเดต");return}
    if(!terminalError)loadTrack(true);
  });
  window.addEventListener("pageshow",()=>{if(!document.hidden&&!terminalError)loadTrack(true)});
});

function token(){return new URLSearchParams(location.search).get("t")||""}
function schedule(ms){clearTimeout(timer);if(document.hidden||terminalError)return;timer=setTimeout(()=>loadTrack(false),Math.max(8000,Number(ms)||20000))}

async function loadTrack(force){
  if(document.hidden||inFlight||terminalError)return;
  const t=token();
  if(!t){showTerminal("ไม่พบลิงก์ติดตาม","กรุณาสแกน QR Code จากจุดบริการ Inbound อีกครั้ง");return}
  inFlight=true;
  try{
    const controller=new AbortController();
    const cut=setTimeout(()=>controller.abort(),6000);
    const response=await fetch(`${cfg.apiBaseUrl}/api/public/track?t=${encodeURIComponent(t)}`,{cache:"no-store",signal:controller.signal,headers:{"accept":"application/json"}});
    clearTimeout(cut);
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success){
      if(data.expired||data.reason==="LINK_EXPIRED")return showTerminal("การติดตามรายการนี้สิ้นสุดแล้ว","ลิงก์หมดอายุตามระยะเวลาที่ระบบกำหนด");
      if(data.disabled||data.reason==="TRACKING_DISABLED")return showTerminal("การติดตามถูกปิดใช้งานชั่วคราว","กรุณาติดต่อจุดบริการหากต้องการตรวจสอบสถานะ");
      if(data.reason==="INVALID_LINK"||data.reason==="TRACK_NOT_FOUND")return showTerminal("ไม่สามารถใช้ลิงก์นี้ได้",data.message||"กรุณาสแกน QR Code ใหม่จากจุดบริการ");
      throw new Error(data.message||"ตรวจสอบสถานะไม่สำเร็จ");
    }
    lastOk=Date.now();
    const fingerprint=JSON.stringify({v:data.vehicle,t:data.timeline,closed:data.closed,expiresAt:data.expiresAt,instruction:data.instruction,lifecycle:data.lifecycle});
    if(force||fingerprint!==lastFingerprint||!hasRendered){render(data);lastFingerprint=fingerprint;hasRendered=true}
    setFresh(data.closed?"done":"",data.closed?"เสร็จสิ้น":"ข้อมูลล่าสุด");
    $("trackUpdated").textContent=`อัปเดต ${timeText(data.generatedAt)}`;
    const seconds=Math.max(10,Math.min(60,Number(data.refreshSeconds)||20));
    schedule(seconds*1000);
  }catch(error){
    if(hasRendered||lastOk){setFresh("wait",navigator.onLine?"รออัปเดตข้อมูล":"เครือข่ายขัดข้อง");schedule(navigator.onLine?15000:30000)}
    else{showRetry(error.name==="AbortError"?"การเชื่อมต่อใช้เวลานานเกินไป":error.message);schedule(15000)}
  }finally{inFlight=false}
}

function render(data){
  const v=data.vehicle||{},steps=data.timeline||[],currentIndex=currentStepIndex(steps,v.status);
  const instruction=String(data.instruction||instructionFor(v.status,v.doorCode));
  const expiry=data.expiresAt?dateText(data.expiresAt):"-";
  const plate=[v.vehiclePlate,v.province].filter(Boolean).join(" ")||"ไม่ระบุ";
  const gateOut=v.gateOutAt?dateText(v.gateOutAt):"";
  $("trackMain").innerHTML=`<article class="track-card">
    <section class="track-status ${data.closed?"closed":""}">
      <small>สถานะปัจจุบัน</small><h1>${esc(v.statusLabel||"กำลังดำเนินการ")}</h1>
      <p>${data.closed?"รถออกจากพื้นที่และสิ้นสุดขั้นตอนแล้ว":"หน้านี้อัปเดตสถานะให้อัตโนมัติ"}</p>
    </section>
    <section class="track-identity"><div><small>หมายเลขนัดหมาย</small><strong>${esc(v.appointmentNo||"-")}</strong></div><span>${esc(v.companyName||"ไม่ระบุบริษัท")}</span><em>${esc(plate)}</em></section>
    <section class="track-instruction ${v.status==="READY_FOR_RECEIVING"?"attention":""}"><small>สิ่งที่ต้องทำ</small><b>${esc(instruction)}</b></section>
    ${v.doorCode?`<section class="track-door"><span>ประตูรับสินค้า</span><b>${esc(v.doorCode)}</b></section>`:""}
    <section class="track-timeline"><h2>ความคืบหน้า</h2>${steps.map((step,index)=>`<div class="track-step ${step.done?"done":""} ${!step.done&&index===currentIndex?"current":""}"><i aria-hidden="true"></i><b>${esc(step.label)}</b><span>${step.at?timeText(step.at):"รอดำเนินการ"}</span></div>`).join("")}</section>
    ${data.closed&&gateOut?`<section class="track-complete"><small>ออกจากพื้นที่</small><b>${esc(gateOut)}</b></section>`:""}
    <section class="track-expiry"><span>${data.closed?"ลิงก์นี้ใช้ตรวจสอบย้อนหลังได้ถึง":"ติดตามได้ถึง"}</span><b>${esc(expiry)}</b></section>
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
function showRetry(message){$("trackMain").innerHTML=`<div class="track-error"><b>ยังไม่สามารถอัปเดตสถานะได้</b><span>${esc(message)}</span><button id="trackRetry" type="button">ลองใหม่</button></div>`;$("trackRetry")?.addEventListener("click",()=>loadTrack(true));setFresh("off","ตรวจสอบไม่สำเร็จ")}
function showTerminal(title,message){terminalError=true;clearTimeout(timer);$("trackMain").innerHTML=`<div class="track-terminal"><div class="terminal-mark" aria-hidden="true"></div><b>${esc(title)}</b><span>${esc(message)}</span><small>ข้อมูลการปฏิบัติงานหลักไม่ได้รับผลกระทบ</small></div>`;setFresh("off","สิ้นสุดการติดตาม")}
function setFresh(cls,text){const el=$("trackFresh");el.className=`track-fresh ${cls||""}`;el.textContent=text}
function dateText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(Number(ts)*1000))}
function timeText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(Number(ts)*1000))}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
