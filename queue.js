"use strict";

const cfg = window.APP_CONFIG || {};
const POLL_MS = 3000;
const FETCH_TIMEOUT_MS = 4500;
const ROTATE_MS = 10000;
const CALL_HOLD_MS = 20000;
const ANNOUNCEMENT_NO_AUDIO_HOLD_MS = 8000;
const ANNOUNCEMENT_POST_VOICE_HOLD_MS = 1200;
const ANNOUNCEMENT_CURSOR_KEY = "queueAnnouncementCursorR119";
const STALE_AFTER_MS = 20000;
const QUEUE_TOKEN_KEY = "wvfQueueDisplayToken";

let lastCallKey = sessionStorage.getItem("queueLastCallKey") || "";
let queueToken = sessionStorage.getItem(QUEUE_TOKEN_KEY) || "";
let runtimeStarted = false;
let audioEnabled = false;
let voiceSettings = null;
let voiceAdminEnabled = false;
const VOICE_SEEN_STORAGE = "queueVoiceSeenCallsR74";
let voiceSeenCalls = loadVoiceSeenCalls();
let loading = false;
let latestData = null;
let lastRotateAt = Date.now();
let holdRotationUntil = 0;
let lastSuccessfulLoad = 0;
let nextPage = 0;
let doorPage = 0;
let announcementCursor = sessionStorage.getItem(ANNOUNCEMENT_CURSOR_KEY);
announcementCursor = announcementCursor === null ? null : Math.max(0, Number(announcementCursor) || 0);
let announcementPending = [];
let announcementProcessing = false;
let currentAnnouncement = null;
let workPages = {
  RECEIVING_IN_PROGRESS: 0,
  WAITING_DOCUMENT_RETURN: 0,
  WAITING_GATE_OUT: 0
};

const $ = id => document.getElementById(id);

function setStableHTML(el, html) {
  if (!el) return false;
  const next = String(html ?? "");
  if (el.dataset.renderHtml === next) return false;
  el.innerHTML = next;
  el.dataset.renderHtml = next;
  return true;
}

function setStableText(el, text) {
  if (!el) return false;
  const next = String(text ?? "");
  if (el.textContent === next) return false;
  el.textContent = next;
  return true;
}

document.addEventListener("DOMContentLoaded", init);

function init() {
  $("queueLoginForm")?.addEventListener("submit", loginQueue);
  $("soundButton")?.addEventListener("click", toggleSound);
  $("fullButton")?.addEventListener("click", toggleFull);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resetPages();
      applyDensity();
      if (latestData) {
        renderNext(latestData);
        renderWork(latestData);
      }
    }, 140);
  });

  window.addEventListener("online", () => {
    setHealth("loading", "กำลังเชื่อมต่อ");
    loadQueue(true);
  });

  window.addEventListener("offline", () => {
    setHealth("offline", latestData ? "เครือข่ายขัดข้อง — แสดงข้อมูลล่าสุด" : "เครือข่ายขัดข้อง");
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadQueue(true);
  });

  document.addEventListener("fullscreenchange", () => {
    if ($("fullButton")) {
      $("fullButton").innerHTML = document.fullscreenElement
        ? '<span class="ui-full-mark" aria-hidden="true"></span> ออกจากเต็มหน้าจอ'
        : '<span class="ui-full-mark" aria-hidden="true"></span> เต็มหน้าจอ';
    }
    setTimeout(() => {
      resetPages();
      applyDensity();
      if (latestData) {
        renderNext(latestData);
        renderWork(latestData);
      }
    }, 120);
  });

  if (queueToken) {
    showQueueApp();
    startQueueRuntime();
  } else {
    showQueueLogin();
  }
}

function startQueueRuntime() {
  if (runtimeStarted) return;
  runtimeStarted = true;
  applyDensity();
  tick();
  setInterval(() => {
    tick();
    refreshHealthAge();
  }, 1000);

  loadQueue(true);
  setInterval(() => loadQueue(false), POLL_MS);
  setInterval(() => {
    if (
      latestData &&
      !document.hidden &&
      Date.now() >= holdRotationUntil &&
      Date.now() - lastRotateAt >= ROTATE_MS
    ) {
      rotatePages();
      lastRotateAt = Date.now();
    }
  }, 1000);
}

function showQueueLogin(message = "") {
  $("queueApp").hidden = true;
  $("queueLogin").hidden = false;
  const error = $("queueLoginError");
  error.textContent = message;
  error.hidden = !message;
  setTimeout(() => $("queueLoginName")?.focus(), 0);
}

function showQueueApp() {
  $("queueLogin").hidden = true;
  $("queueApp").hidden = false;
}

async function loginQueue(event) {
  event.preventDefault();
  const button = $("queueLoginButton");
  const username = $("queueLoginName").value.trim();
  const password = $("queueLoginPassword").value;
  const error = $("queueLoginError");
  error.hidden = true;
  button.disabled = true;
  button.textContent = "กำลังเข้าสู่ระบบ…";
  try {
    const base = String(cfg.apiBaseUrl || "").replace(/\/$/, "");
    if (!base) throw new Error("ไม่พบที่อยู่ระบบ");
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: username, password })
    });
    const raw = await response.json().catch(() => null);
    if (!response.ok || !raw?.success || !raw?.token) throw new Error(raw?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    const access = String(raw.user?.accessRights || "").toUpperCase();
    if (!new Set(["ADMIN", "USER"]).has(access)) throw new Error("บัญชีนี้ไม่มีสิทธิ์เปิดจอคิว");
    queueToken = raw.token;
    sessionStorage.setItem(QUEUE_TOKEN_KEY, queueToken);
    $("queueLoginPassword").value = "";
    showQueueApp();
    startQueueRuntime();
    loadQueue(true);
  } catch (err) {
    showQueueLogin(err?.message || "เข้าสู่ระบบไม่สำเร็จ");
  } finally {
    button.disabled = false;
    button.textContent = "เข้าสู่จอคิว";
  }
}

function expireQueueSession(message) {
  queueToken = "";
  sessionStorage.removeItem(QUEUE_TOKEN_KEY);
  latestData = null;
  showQueueLogin(message || "กรุณาเข้าสู่ระบบอีกครั้ง");
}

function resetPages() {
  nextPage = 0;
  doorPage = 0;
  Object.keys(workPages).forEach(key => (workPages[key] = 0));
  lastRotateAt = Date.now();
}

function tick() {
  const now = new Date();
  const tz = cfg.timezone || "Asia/Bangkok";
  if ($("queueDate")) {
    $("queueDate").textContent = new Intl.DateTimeFormat("th-TH", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(now);
  }
  if ($("queueClock")) {
    $("queueClock").textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
  }
}

async function loadQueue(force = false) {
  if (!queueToken) return;
  if (loading && !force) return;
  if (!navigator.onLine) {
    setHealth("offline", latestData ? "เครือข่ายขัดข้อง — แสดงข้อมูลล่าสุด" : "เครือข่ายขัดข้อง");
    return;
  }

  loading = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const base = String(cfg.apiBaseUrl || "").replace(/\/$/, "");
    if (!base) throw new Error("ไม่พบที่อยู่ระบบ");

    const queueUrl = new URL(base + "/api/public/queue");
    if (announcementCursor === null) queueUrl.searchParams.set("bootstrap", "1");
    else queueUrl.searchParams.set("afterSequence", String(announcementCursor));
    const response = await fetch(queueUrl.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${queueToken}` }
    });

    const raw = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      expireQueueSession(raw?.message || "กรุณาเข้าสู่ระบบอีกครั้ง");
      return;
    }
    if (!response.ok || !raw || raw.success === false) {
      throw new Error(raw?.message || "โหลดข้อมูลไม่สำเร็จ");
    }

    const data = normalizeQueueData(raw);
    latestData = data;
    lastSuccessfulLoad = Date.now();
    render(data);
    setHealth("ok", "พร้อมใช้งาน");
  } catch (error) {
    const message = error?.name === "AbortError" ? "การเชื่อมต่อตอบสนองช้า" : (error?.message || "เชื่อมต่อไม่ได้");
    if (latestData) {
      setHealth("error", "เชื่อมต่อไม่ได้ — แสดงข้อมูลล่าสุด", message);
    } else {
      renderUnavailable();
      setHealth("error", "เชื่อมต่อไม่ได้", message);
    }
  } finally {
    clearTimeout(timeout);
    loading = false;
  }
}

function normalizeQueueData(raw) {
  const validStatuses = new Set([
    "READY_FOR_RECEIVING",
    "RECEIVING_IN_PROGRESS",
    "WAITING_DOCUMENT_RETURN",
    "WAITING_GATE_OUT"
  ]);

  const items = Array.isArray(raw.items)
    ? raw.items
        .filter(item => item && typeof item === "object" && validStatuses.has(String(item.status || "")))
        .map(normalizeItem)
    : [];

  const byAuto = new Map(items.filter(item => item.autoId).map(item => [item.autoId, item]));
  const byAppointment = new Map();
  for (const item of items) if (item.appointmentNo && !byAppointment.has(item.appointmentNo)) byAppointment.set(item.appointmentNo, item);
  const withContext = input => {
    if (!input || typeof input !== "object") return null;
    const normalized = normalizeItem(input);
    const base = byAuto.get(normalized.autoId) || byAppointment.get(normalized.appointmentNo) || null;
    return mergeQueueDisplayContext(base, normalized);
  };

  const calling = withContext(raw.calling);
  const noticeCalling = withContext(raw.noticeCalling);
  const counts = raw.counts && typeof raw.counts === "object" ? raw.counts : {};

  const recentCalls = Array.isArray(raw.recentCalls)
    ? raw.recentCalls.map(withContext).filter(Boolean).sort((a,b)=>(a.calledAt||0)-(b.calledAt||0))
    : (calling ? [calling] : []);
  const recentNotices = Array.isArray(raw.recentNotices)
    ? raw.recentNotices.map(withContext).filter(Boolean).sort((a,b)=>(a.calledAt||0)-(b.calledAt||0))
    : (noticeCalling ? [noticeCalling] : []);

  return {
    success: true,
    generatedAt: raw.generatedAt ?? Date.now(),
    calling,
    noticeCalling,
    recentCalls,
    recentNotices,
    voice: raw.voice && typeof raw.voice === "object" ? raw.voice : null,
    doorSettings: raw.doorSettings && typeof raw.doorSettings === "object" ? raw.doorSettings : null,
    queueDisplay: raw.queueDisplay && typeof raw.queueDisplay === "object" ? raw.queueDisplay : {showDoorPanel:false,doorPanelEnabled:false},
    appointmentLive: raw.appointmentLive && typeof raw.appointmentLive === "object" ? raw.appointmentLive : null,
    announcementMode: cleanText(raw.announcementMode || "LEGACY"),
    latestAnnouncementSequence: Math.max(0, Number(raw.latestAnnouncementSequence) || 0),
    announcements: Array.isArray(raw.announcements)
      ? raw.announcements.map(item => {
          const normalized = normalizeAnnouncement(item);
          const base = byAuto.get(normalized.autoId) || byAppointment.get(normalized.appointmentNo) || null;
          return mergeQueueDisplayContext(base, normalized);
        }).sort((a,b)=>a.sequence-b.sequence)
      : [],
    doors: Array.isArray(raw.doors) ? raw.doors.filter(item=>item&&typeof item==="object").map(normalizeDoorLive) : [],
    items,
    counts: {
      READY_FOR_RECEIVING: safeCount(counts.READY_FOR_RECEIVING, items, "READY_FOR_RECEIVING"),
      RECEIVING_IN_PROGRESS: safeCount(counts.RECEIVING_IN_PROGRESS, items, "RECEIVING_IN_PROGRESS"),
      WAITING_DOCUMENT_RETURN: safeCount(counts.WAITING_DOCUMENT_RETURN, items, "WAITING_DOCUMENT_RETURN"),
      WAITING_GATE_OUT: safeCount(counts.WAITING_GATE_OUT, items, "WAITING_GATE_OUT")
    }
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];
}

function normalizeAppointmentEnrichment(item) {
  const raw = item?.appointmentEnrichment ?? item?.appointment_enrichment;
  if (!raw || typeof raw !== "object") return null;
  const projectionRaw = raw.projection && typeof raw.projection === "object" ? raw.projection : null;
  const projection = projectionRaw ? {
    ...projectionRaw,
    appointmentNo: cleanText(projectionRaw.appointmentNo),
    plannedAtDisplay: cleanText(projectionRaw.plannedAtDisplay),
    referenceType: cleanText(projectionRaw.referenceType),
    timingStatus: cleanText(projectionRaw.timingStatus),
    deltaMinutes: projectionRaw.deltaMinutes == null ? null : Number(projectionRaw.deltaMinutes),
    vendors: normalizeStringArray(projectionRaw.vendors),
    carriers: normalizeStringArray(projectionRaw.carriers),
    pos: normalizeStringArray(projectionRaw.pos)
  } : null;
  const companyRaw = raw.company && typeof raw.company === "object" ? raw.company : {};
  return {
    ...raw,
    matched: raw.matched === true,
    projection,
    company: {
      ...companyRaw,
      source: cleanText(companyRaw.source).toUpperCase(),
      effectiveName: cleanText(companyRaw.effectiveName),
      gateInName: cleanText(companyRaw.gateInName),
      appointmentName: cleanText(companyRaw.appointmentName)
    }
  };
}

function normalizeItem(item) {
  const enrichment = normalizeAppointmentEnrichment(item);
  const company = enrichment?.company || {};
  return {
    ...item,
    autoId: cleanText(item.autoId ?? item.auto_id),
    callId: cleanText(item.callId ?? item.call_id),
    callType: cleanText(item.callType ?? item.call_type),
    reasonCode: cleanText(item.reasonCode ?? item.reason_code),
    noticeLabel: cleanText(item.noticeLabel ?? item.notice_label),
    callCount: Math.max(0, Number(item.callCount ?? item.call_count) || 0),
    calledAt: Number(item.calledAt ?? item.called_at) || 0,
    previousDoorCode: cleanText(item.previousDoorCode ?? item.previous_door_code),
    appointmentNo: cleanText(item.appointmentNo ?? item.appointment_no),
    companyName: cleanText(item.companyName ?? item.company_name ?? company.effectiveName),
    companyNameGateIn: cleanText(item.companyNameGateIn ?? item.company_name_gate_in ?? company.gateInName),
    companyNameAppointment: cleanText(item.companyNameAppointment ?? item.company_name_appointment ?? company.appointmentName),
    companySource: cleanText(item.companySource ?? item.company_source ?? company.source).toUpperCase(),
    companyPolicyMode: cleanText(item.companyPolicyMode ?? item.company_policy_mode),
    vehiclePlate: cleanText(item.vehiclePlate ?? item.vehicle_plate),
    province: cleanText(item.province),
    doorCode: normalizeQueueDoorCode(item.doorCode ?? item.door_code),
    useDoor: item.useDoor !== false && item.use_door !== false,
    status: cleanText(item.status ?? item.current_status),
    elapsedSeconds: Math.max(0, Number(item.elapsedSeconds ?? item.elapsed_seconds) || 0),
    stageSince: Number(item.stageSince ?? item.stage_since) || 0,
    receivingStartedAt: Number(item.receivingStartedAt ?? item.receiving_started_at) || 0,
    appointmentEnrichment: enrichment,
    appointment_enrichment: enrichment
  };
}

function mergeQueueDisplayContext(base, item) {
  if (!base) return item;
  const enrichment = item.appointmentEnrichment || base.appointmentEnrichment || null;
  return {
    ...base,
    ...item,
    autoId: item.autoId || base.autoId,
    appointmentNo: item.appointmentNo || base.appointmentNo,
    companyName: base.companyName || item.companyName,
    companyNameGateIn: base.companyNameGateIn || item.companyNameGateIn,
    companyNameAppointment: base.companyNameAppointment || item.companyNameAppointment,
    companySource: base.companySource || item.companySource,
    companyPolicyMode: base.companyPolicyMode || item.companyPolicyMode,
    vehiclePlate: item.vehiclePlate || base.vehiclePlate,
    province: item.province || base.province,
    status: item.status || base.status,
    stageSince: item.stageSince || base.stageSince,
    receivingStartedAt: item.receivingStartedAt || base.receivingStartedAt,
    appointmentEnrichment: enrichment,
    appointment_enrichment: enrichment
  };
}

function normalizeAnnouncement(item){
  return normalizeItem({...item,sequence:Math.max(0,Number(item.sequence)||0),announcementId:cleanText(item.announcementId),doorCode:normalizeQueueDoorCode(item.doorCode),previousDoorCode:normalizeQueueDoorCode(item.previousDoorCode)});
}
function normalizeDoorLive(item){
  return{doorCode:normalizeQueueDoorCode(item.doorCode),status:cleanText(item.status),activityStatus:cleanText(item.activityStatus),isActive:item.isActive!==false,occupancyCount:Math.max(0,Number(item.occupancyCount)||0),appointmentNo:cleanText(item.appointmentNo),vehiclePlate:cleanText(item.vehiclePlate),province:cleanText(item.province),companyName:cleanText(item.companyName),items:Array.isArray(item.items)?item.items:[]};
}
function cleanText(value) {
  return String(value ?? "").trim();
}
function normalizeQueueDoorCode(value) {
  const text = cleanText(value).toUpperCase();
  if (!text) return "";
  const match = text.match(/^(SS|RR|SR|RS|S|R)0*(\d{1,3})$/);
  if (!match) return text;
  return `${match[1]}${Number(match[2])}`;
}
function queueDoorNaturalParts(value) {
  const code = normalizeQueueDoorCode(value);
  const match = code.match(/^(SS|RR|SR|RS|S|R)(\d+)$/);
  return match ? [match[1], Number(match[2])] : [code, Number.MAX_SAFE_INTEGER];
}

function safeCount(value, items, status) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return items.filter(item => item.status === status).length;
}

function render(data) {
  syncVoiceSettings(data.voice);
  renderSummary(data);
  renderNext(data);
  renderWork(data);
  renderDoorRail(data);
  if(data.announcementMode === "CANONICAL"){
    ingestCanonicalAnnouncements(data);
    if(!announcementProcessing&&!currentAnnouncement&&!announcementPending.length)renderCall(latestAnnouncement(data));
  }else{
    renderCall(latestAnnouncement(data));
    processVoiceCalls(data);
  }
  setStableText($("updatedAt"), "อัปเดตล่าสุด " + formatTime(data.generatedAt));
}

function latestAnnouncement(data){
  const call=data?.calling||null,notice=data?.noticeCalling||null;
  if(!call)return notice;if(!notice)return call;
  return Number(notice.calledAt||0)>=Number(call.calledAt||0)?notice:call;
}

function saveAnnouncementCursor(){if(announcementCursor==null)return;try{sessionStorage.setItem(ANNOUNCEMENT_CURSOR_KEY,String(announcementCursor))}catch{}}
function ingestCanonicalAnnouncements(data){
  const latest=Math.max(0,Number(data?.latestAnnouncementSequence)||0);
  if(announcementCursor===null){announcementCursor=latest;saveAnnouncementCursor();return}
  if(latest<announcementCursor){announcementCursor=latest;announcementPending=[];saveAnnouncementCursor();return}
  const currentSeq=Number(currentAnnouncement?.sequence||0),pendingSeq=new Set(announcementPending.map(item=>Number(item.sequence||0)));
  for(const item of data.announcements||[]){const seq=Number(item.sequence||0);if(!seq||seq<=announcementCursor||seq===currentSeq||pendingSeq.has(seq))continue;announcementPending.push(item);pendingSeq.add(seq)}
  announcementPending.sort((a,b)=>a.sequence-b.sequence);processCanonicalAnnouncementQueue();
}
async function processCanonicalAnnouncementQueue(){
  if(announcementProcessing)return;announcementProcessing=true;
  try{
    while(announcementPending.length){
      const item=announcementPending.shift();currentAnnouncement=item;renderCall(item);holdRotationUntil=Date.now()+CALL_HOLD_MS;
      let voiced=false;
      if(audioEnabled&&voiceAdminEnabled&&window.SmartQueueVoice){
        try{window.SmartQueueVoice.clearPending?.();await window.SmartQueueVoice.announceNow(item);voiced=true}catch(error){console.warn("canonical queue voice failed",error?.message||error);setHealth("error","เสียงประกาศขัดข้อง — ภาพยังทำงาน",error?.message||"")}
      }
      await sleepQueue(voiced?ANNOUNCEMENT_POST_VOICE_HOLD_MS:ANNOUNCEMENT_NO_AUDIO_HOLD_MS);
      announcementCursor=Math.max(Number(announcementCursor||0),Number(item.sequence||0));saveAnnouncementCursor();currentAnnouncement=null;
    }
  }finally{announcementProcessing=false;currentAnnouncement=null;if(latestData)renderCall(latestAnnouncement(latestData))}
}
function sleepQueue(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)))}

function doorPageSize(){
  const list=$("doorRailList");
  const h=Math.max(0,Number(list?.clientHeight||0));
  const viewport=window.innerHeight||800;
  const rowHeight=viewport<760?33:viewport<900?40:43;
  if(h>80)return Math.max(4,Math.floor((h+5)/rowHeight));
  if(viewport<650)return 6;
  if(viewport<780)return 8;
  if(viewport<900)return 9;
  if(viewport>=1050)return 13;
  return 10;
}
function renderDoorRail(data,animate=false){
  const rail=$("doorRail"),board=$("queueBoard");if(!rail||!board)return;
  const enabled=Boolean(data?.queueDisplay?.doorPanelEnabled),raw=Array.isArray(data?.doors)?data.doors:[];
  rail.hidden=!enabled;board.classList.toggle("has-door-rail",enabled);if(!enabled)return;
  const seen=new Map();
  for(const door of raw){const code=normalizeQueueDoorCode(door.doorCode);if(!code)continue;const prev=seen.get(code);if(!prev){seen.set(code,{...door,doorCode:code});continue}const prevRank=doorStatusRank(prev.status),nextRank=doorStatusRank(door.status);const merged=nextRank<prevRank?{...prev,...door,doorCode:code}:{...door,...prev,doorCode:code};merged.isActive=prev.isActive!==false||door.isActive!==false;merged.occupancyCount=Math.max(Number(prev.occupancyCount||0),Number(door.occupancyCount||0));seen.set(code,merged)}
  const doors=[...seen.values()].sort(compareQueueDoors),important=doors.filter(d=>String(d.status||"AVAILABLE")!=="AVAILABLE"),available=doors.filter(d=>String(d.status||"AVAILABLE")==="AVAILABLE");
  const capacity=Math.max(important.length,doorPageSize()),availableSlots=Math.max(0,capacity-important.length),pages=Math.max(1,availableSlots?Math.ceil(available.length/availableSlots):1);if(doorPage>=pages)doorPage=0;
  const shownAvailable=availableSlots?available.slice(doorPage*availableSlots,doorPage*availableSlots+availableSlots):[],shown=[...important,...shownAvailable];
  const counts={available:available.length,called:doors.filter(d=>d.status==="CALLED").length,inUse:doors.filter(d=>d.status==="IN_USE").length,draining:doors.filter(d=>d.status==="DRAINING").length};
  const stats=$("doorRailStats");setStableText(stats,`ใช้ ${counts.inUse} · เรียก ${counts.called} · ว่าง ${counts.available}`);
  const label=$("doorPageLabel");setStableText(label,doors.length?(pages>1?`${doorPage+1}/${pages} · ${doors.length} ประตู`:`${doors.length} ประตู`):"ไม่มีประตู");
  const list=$("doorRailList");const changed=setStableHTML(list,shown.length?shown.map(doorRailItem).join(""):'<div class="door-empty">ไม่มีประตูที่แสดงผล</div>');if(animate&&changed)fadePage(list);
}
function doorStatusRank(status){return({DRAINING:0,IN_USE:1,CALLED:2,AVAILABLE:3})[String(status||"AVAILABLE")]??9}
function compareQueueDoors(a,b){const status=doorStatusRank(a.status)-doorStatusRank(b.status);if(status)return status;const [ag,an]=queueDoorNaturalParts(a.doorCode),[bg,bn]=queueDoorNaturalParts(b.doorCode);return ag.localeCompare(bg,"en")||an-bn}
function doorRailItem(door){
  const status=String(door.status||"AVAILABLE"),labels={AVAILABLE:"ว่าง",CALLED:"เรียกเข้า",IN_USE:"กำลังใช้งาน",DRAINING:"ปิดหลังจบงาน"},count=Math.max(0,Number(door.occupancyCount)||0),code=normalizeQueueDoorCode(door.doorCode)||"-";
  return `<article class="door-live door-${esc(status.toLowerCase())}"><div class="door-code">${esc(code)}</div><div class="door-state"><i aria-hidden="true"></i><b>${esc(labels[status]||status)}</b></div><span class="door-count">${status==="DRAINING"?"–":count}</span></article>`;
}

function renderUnavailable() {
  if(!currentAnnouncement)renderCall(null);
  renderSummary({ counts: {} });
  renderNext({ items: [] });
  renderWork({ items: [] });
  if ($("updatedAt")) $("updatedAt").textContent = "ยังไม่ได้รับข้อมูลจากระบบ";
}

function renderSummary(data) {
  const c = data.counts || {};
  const defs = [
    ["รอ", "รอเข้าตรวจรับสินค้า", c.READY_FOR_RECEIVING || 0, "ready"],
    ["รับ", "กำลังตรวจรับสินค้า", c.RECEIVING_IN_PROGRESS || 0, "progress"],
    ["คืน", "รอรับเอกสารคืน", c.WAITING_DOCUMENT_RETURN || 0, "return"],
    ["ออก", "รอออกจากพื้นที่", c.WAITING_GATE_OUT || 0, "out"]
  ];

  setStableHTML($("summaryCards"), defs
    .map(
      ([icon, label, n, tone]) =>
        `<article class="summary-${tone}"><span class="summary-icon">${icon}</span><small>${label}</small><b>${Number(n).toLocaleString("th-TH")}</b><em>คัน</em></article>`
    )
    .join(""));
}

function comparableCompanyName(value) {
  return cleanText(value).toLocaleLowerCase("th-TH").replace(/[\s.,()\-_/]+/g, "");
}

function queueCompanyView(item) {
  const enrichmentCompany = item?.appointmentEnrichment?.company || item?.appointment_enrichment?.company || {};
  const gateIn = cleanText(item?.companyNameGateIn || enrichmentCompany.gateInName);
  const appointment = cleanText(item?.companyNameAppointment || enrichmentCompany.appointmentName);
  const source = cleanText(item?.companySource || enrichmentCompany.source || "GATE_IN").toUpperCase();
  const primary = cleanText(item?.companyName || enrichmentCompany.effectiveName || (source === "APPOINTMENT" ? appointment : gateIn) || appointment || gateIn || "ไม่ระบุบริษัท");
  const sourceLabel = source === "APPOINTMENT" ? "ข้อมูลนัดหมาย" : "ข้อมูล Gate In";
  const sourceShort = source === "APPOINTMENT" ? "นัดหมาย" : "Gate In";
  let alternate = null;
  if (source === "APPOINTMENT" && gateIn && comparableCompanyName(gateIn) !== comparableCompanyName(primary)) alternate = {label:"Gate In", value:gateIn};
  else if (source !== "APPOINTMENT" && appointment && comparableCompanyName(appointment) !== comparableCompanyName(primary)) alternate = {label:"นัดหมาย", value:appointment};
  else if (gateIn && appointment && comparableCompanyName(gateIn) !== comparableCompanyName(appointment)) {
    const useGate = comparableCompanyName(primary) === comparableCompanyName(gateIn);
    alternate = useGate ? {label:"นัดหมาย", value:appointment} : {label:"Gate In", value:gateIn};
  }
  const tooltip = [`${sourceLabel}: ${primary}`, alternate ? `${alternate.label}: ${alternate.value}` : ""].filter(Boolean).join("\n");
  return {primary, source, sourceLabel, sourceShort, alternate, tooltip};
}

function compactPlanDateTime(value) {
  const text = cleanText(value);
  return text.replace(/(\d{2}:\d{2}):\d{2}$/, "$1");
}

function summarizePlanValues(values, limit = 2) {
  const list = normalizeStringArray(values);
  if (!list.length) return {short:"", full:""};
  const shown = list.slice(0, limit);
  const more = list.length - shown.length;
  return {short:`${shown.join(", ")}${more > 0 ? ` +${more}` : ""}`, full:list.join(", ")};
}

function queuePlanEntries(item) {
  const enrichment = item?.appointmentEnrichment || item?.appointment_enrichment || null;
  const projection = enrichment?.projection || null;
  if (!projection) return [];
  const entries = [];
  const planned = compactPlanDateTime(projection.plannedAtDisplay);
  if (planned) entries.push({key:"time", label:"เวลา", value:planned, full:cleanText(projection.plannedAtDisplay)});
  const po = summarizePlanValues(projection.pos, 2);
  if (po.short) entries.push({key:"po", label:"PO", value:po.short, full:po.full});
  const carrier = summarizePlanValues(projection.carriers, 1);
  if (carrier.short) entries.push({key:"carrier", label:"Carrier", value:carrier.short, full:carrier.full});
  return entries;
}

function renderCallCompany(item) {
  const company = queueCompanyView(item);
  const source = $("callCompanySource"), alt = $("callCompanyAlt"), name = $("callCompany");
  if (name) { name.textContent = company.primary; name.title = company.tooltip; }
  if (source) {
    source.textContent = company.sourceLabel;
    source.dataset.source = company.source === "APPOINTMENT" ? "appointment" : "gate";
    source.hidden = !company.primary || company.primary === "ไม่ระบุบริษัท";
  }
  if (alt) {
    alt.textContent = company.alternate ? `${company.alternate.label}: ${company.alternate.value}` : "";
    alt.title = company.alternate?.value || "";
    alt.hidden = !company.alternate;
  }
}

function renderCallPlan(item) {
  const panel = $("callAppointmentPlan");
  if (!panel) return;
  const entries = queuePlanEntries(item);
  if (!entries.length) {
    panel.hidden = true;
    panel.innerHTML = "";
    panel.dataset.renderHtml = "";
    return;
  }
  const html = `<div class="call-plan-title"><small>ข้อมูลนัดหมาย</small><b>แผนนัดหมาย</b></div><div class="call-plan-items">${entries.map(entry=>`<span class="call-plan-item call-plan-${esc(entry.key)}" title="${esc(entry.full || entry.value)}"><small>${esc(entry.label)}</small><b>${esc(entry.value)}</b></span>`).join("")}</div>`;
  setStableHTML(panel, html);
  panel.hidden = false;
}

function queueCompanyInline(item) {
  const company = queueCompanyView(item);
  return `<span class="queue-company-line" title="${esc(company.tooltip)}"><b>${esc(company.primary)}</b><i class="queue-company-source-mini source-${company.source === "APPOINTMENT" ? "appointment" : "gate"}">${esc(company.sourceShort)}</i></span>`;
}

function renderCall(item) {
  const panel = $("callPanel");
  const num = $("callNumber");

  if (!item || !item.appointmentNo) {
    panel.classList.add("idle");
    num.textContent = "รอการเรียกคิว";
    fitAppointmentNumber(num, "รอการเรียกคิว");
    $("callCompany").textContent = "–";
    $("callCompany").removeAttribute("title");
    if ($("callCompanySource")) { $("callCompanySource").hidden = true; $("callCompanySource").textContent = ""; }
    if ($("callCompanyAlt")) { $("callCompanyAlt").hidden = true; $("callCompanyAlt").textContent = ""; }
    renderCallPlan(null);
    $("callPlate").textContent = "–";
    $("callProvince").textContent = "–";
    $("callDoor").textContent = "–";
    $("callDoorWrap")?.classList.add("is-empty");
    $("callStateText").textContent = "ยังไม่เรียก";
    $("callInstructionPrefix").textContent = "กรุณาตรวจสอบสถานะคิว";
    $("callInstruction").textContent = "รอการเรียกคิว";
    return;
  }

  panel.classList.remove("idle");
  const appt = item.appointmentNo || "–";
  num.textContent = appt;
  fitAppointmentNumber(num, appt);
  renderCallCompany(item);
  renderCallPlan(item);
  $("callPlate").textContent = item.vehiclePlate || "ไม่ระบุ";
  $("callProvince").textContent = item.province || "ไม่ระบุ";
  $("callDoor").textContent = item.doorCode || "–";
  $("callDoorWrap")?.classList.toggle("is-empty",!item.doorCode);
  const type=String(item.callType||"").toUpperCase(),changedDoor=type==="DOOR_CHANGED",recalled=type==="RECALL",count=Math.max(1,Number(item.callCount||1));
  if(type==="NOTICE_DOCUMENT_ROOM"){
    $("callStateText").textContent="เรียกเพิ่มเติม";
    $("callInstructionPrefix").textContent="พนักงานขับรถ กรุณาตรวจสอบข้อความ";
    $("callInstruction").textContent="กรุณาติดต่อที่ห้องเอกสาร";
  }else if(type==="NOTICE_DOOR"){
    $("callStateText").textContent="เรียกเพิ่มเติม";
    $("callInstructionPrefix").textContent="พนักงานขับรถ กรุณาตรวจสอบข้อความ";
    $("callInstruction").textContent=item.doorCode?`กรุณาติดต่อที่ประตู ${item.doorCode}`:"กรุณาติดต่อที่ประตู";
  }else if(type==="NOTICE_VEHICLE"){
    $("callStateText").textContent="เรียกเพิ่มเติม";
    $("callInstructionPrefix").textContent="พนักงานขับรถ กรุณาตรวจสอบข้อความ";
    $("callInstruction").textContent="กรุณาติดต่อที่รถของท่าน";
  }else{
    $("callStateText").textContent = changedDoor ? `เปลี่ยนประตู · เรียกครั้งที่ ${count}` : recalled ? `เรียกซ้ำครั้งที่ ${count}` : `เรียกแล้ว ${count} ครั้ง`;
    $("callInstructionPrefix").textContent = changedDoor ? "มีการเปลี่ยนประตู กรุณาเข้ารับการตรวจรับสินค้า" : recalled ? "เรียกอีกครั้ง กรุณาเข้ารับการตรวจรับสินค้า" : "กรุณาเข้ารับการตรวจรับสินค้า";
    $("callInstruction").textContent = item.doorCode ? `ที่ประตู ${item.doorCode}` : "ได้ทันที";
  }

  const key = item.callId || [item.appointmentNo, item.calledAt].join(":");
  if (key !== lastCallKey) {
    lastCallKey = key;
    sessionStorage.setItem("queueLastCallKey", key);
    resetPages();
    holdRotationUntil = Date.now() + CALL_HOLD_MS;
    panel.classList.remove("flash");
    void panel.offsetWidth;
    panel.classList.add("flash");
  }
}

function readyItems(data) {
  return (data.items || []).filter(item => item.status === "READY_FOR_RECEIVING");
}

function queuePageSize() {
  const h = window.innerHeight || 800;
  const w = window.innerWidth || 1280;
  if (h < 700 || w < 1050) return 4;
  if (h < 820 || w < 1350) return 5;
  if (h >= 1000 && w >= 1600) return 7;
  return 6;
}

function workPageSize() {
  const h = window.innerHeight || 800;
  const w = window.innerWidth || 1280;
  if (h < 700 || w < 1050) return 2;
  if (h < 820 || w < 1350) return 3;
  if (h >= 1000 && w >= 1600) return 5;
  return 4;
}

function applyDensity() {
  const h = window.innerHeight || 800;
  const w = window.innerWidth || 1280;
  document.documentElement.dataset.queueDensity = h < 700 || w < 1050 ? "compact" : h >= 1000 && w >= 1600 ? "wide" : "normal";
}

function renderNext(data, animate = false) {
  const items = readyItems(data);
  const size = queuePageSize();
  const pages = Math.max(1, Math.ceil(items.length / size));
  if (nextPage >= pages) nextPage = 0;

  const start = nextPage * size;
  const shown = items.slice(start, start + size);
  setStableText($("nextPageLabel"), items.length
    ? pages > 1
      ? `หน้า ${nextPage + 1}/${pages} · ${items.length} คัน`
      : `${items.length} คัน`
    : "ไม่มีรายการรอ");

  const list = $("nextQueue");
  const changed = setStableHTML(list, shown.length
    ? shown.map(nextItem).join("")
    : '<div class="queue-empty">ไม่มีรถรอเข้าตรวจรับสินค้า</div>');

  if (animate && changed) fadePage(list);
  setStableText($("rotationLabel"), pages > 1 ? `รอเข้าตรวจรับสินค้า ${nextPage + 1}/${pages}` : "");
}

function nextItem(item) {
  const called=Number(item.calledAt||0)>0,count=Math.max(1,Number(item.callCount||1));
  const callLabel=!called?shortDuration(item.elapsedSeconds):item.callType==="DOOR_CHANGED"?`เปลี่ยนประตู · ครั้งที่ ${count}`:item.callType==="RECALL"?`เรียกซ้ำครั้งที่ ${count}`:`เรียกแล้ว ${count} ครั้ง`;
  const doorBadge=item.doorCode
    ? `<span class="next-door-badge" title="ประตู ${esc(item.doorCode)}">${esc(item.doorCode)}</span>`
    : `<span class="next-door-badge is-placeholder" title="ยังไม่ระบุประตู">–</span>`;
  return `<article class="next-item ${called?"is-called":""}"><div class="next-appt">${esc(item.appointmentNo || "–")}</div><div class="next-vehicle">${queueCompanyInline(item)}<small>${esc(item.vehiclePlate || "–")}</small></div><div class="next-province">${esc(item.province || "–")}</div><div class="next-status">${doorBadge}<small>${esc(callLabel)}</small></div></article>`;
}

function renderWork(data, animate = false) {
  const all = data.items || [];
  const defs = [
    ["กำลังตรวจรับสินค้า", "RECEIVING_IN_PROGRESS", "progress"],
    ["รอรับเอกสารคืน", "WAITING_DOCUMENT_RETURN", "return"],
    ["รอออกจากพื้นที่", "WAITING_GATE_OUT", "out"]
  ];

  let total = 0;
  const workHtml = defs
    .map(([label, status, tone]) => {
      const items = all
        .filter(item => item.status === status)
        .sort((a, b) => (a.stageSince || 0) - (b.stageSince || 0));
      total += items.length;

      const size = workPageSize();
      const pages = Math.max(1, Math.ceil(items.length / size));
      if ((workPages[status] || 0) >= pages) workPages[status] = 0;
      const page = workPages[status] || 0;
      const shown = items.slice(page * size, page * size + size);

      return `<section class="work-group tone-${tone}"><header><h3>${label}</h3><b>${items.length} คัน${pages > 1 ? ` · ${page + 1}/${pages}` : ""}</b></header><div class="work-body">${
        shown.length ? shown.map(workItem).join("") : '<p class="work-empty">ไม่มีรายการ</p>'
      }</div></section>`;
    })
    .join("");

  const workChanged = setStableHTML($("workGroups"), workHtml);
  if (animate && workChanged) fadePage($("workGroups"));
  setStableText($("workCount"), `${total.toLocaleString("th-TH")} คัน`);
}

function workItem(item) {
  const door = normalizeQueueDoorCode(item.doorCode);
  const showDoor = door && item.status !== "WAITING_GATE_OUT";
  const doorHtml = showDoor ? `<span class="work-door" title="ประตู ${esc(door)}">${esc(door)}</span>` : "";
  return `<article class="work-item"><div class="work-item-head"><b>${esc(item.appointmentNo || "–")}</b>${doorHtml}</div><span class="work-company">${queueCompanyInline(item)}</span><small>${esc(plateText(item))}</small></article>`;
}

function rotatePages() {
  if (!latestData) return;

  const ready = readyItems(latestData);
  const nextPages = Math.ceil(ready.length / queuePageSize());
  if (nextPages > 1) nextPage = (nextPage + 1) % nextPages;

  const all = latestData.items || [];
  for (const status of Object.keys(workPages)) {
    const pages = Math.ceil(all.filter(item => item.status === status).length / workPageSize());
    if (pages > 1) workPages[status] = (workPages[status] + 1) % pages;
  }
  const allDoors=Array.isArray(latestData.doors)?latestData.doors:[],importantDoors=allDoors.filter(d=>String(d.status||"AVAILABLE")!=="AVAILABLE"),availableDoors=allDoors.filter(d=>String(d.status||"AVAILABLE")==="AVAILABLE"),availableSlots=Math.max(1,doorPageSize()-importantDoors.length),doorPages=Math.max(1,Math.ceil(availableDoors.length/availableSlots));if(doorPages>1)doorPage=(doorPage+1)%doorPages;

  renderNext(latestData, true);
  renderWork(latestData, true);
  renderDoorRail(latestData, true);
}

function fadePage(el) {
  if (!el) return;
  el.classList.remove("page-fade");
  void el.offsetWidth;
  el.classList.add("page-fade");
}

function plateText(item) {
  return [item.vehiclePlate, item.province].filter(Boolean).join(" ") || "ไม่ระบุทะเบียน";
}

function setHealth(state, text, detail = "") {
  const el = $("queueHealth");
  if (!el) return;
  el.classList.remove("error", "stale", "offline", "loading");
  if (state && state !== "ok") el.classList.add(state);
  el.textContent = text;
  el.title = detail || text;
  el.dataset.state = state || "ok";
}

function refreshHealthAge() {
  if (!navigator.onLine) {
    setHealth("offline", latestData ? "เครือข่ายขัดข้อง — แสดงข้อมูลล่าสุด" : "เครือข่ายขัดข้อง");
    return;
  }
  if (!lastSuccessfulLoad) return;

  const age = Date.now() - lastSuccessfulLoad;
  if (age > STALE_AFTER_MS) {
    setHealth("stale", "ข้อมูลกำลังรออัปเดต", `ไม่ได้รับข้อมูลใหม่ ${Math.floor(age / 1000)} วินาที`);
  }
}

function shortDuration(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value > 1e12 ? value : value * 1000);
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) {
    const n = Number(value);
    return new Date(n > 1e12 ? n : n * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(value) {
  const d = toDate(value);
  if (!d) return "–";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: cfg.timezone || "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function loadVoiceSeenCalls(){
  try{
    const raw=JSON.parse(localStorage.getItem(VOICE_SEEN_STORAGE)||"{}");
    const now=Date.now(),clean={};
    for(const [key,value] of Object.entries(raw||{}))if(key&&now-Number(value||0)<6*3600*1000)clean[key]=Number(value);
    return clean;
  }catch{return{}}
}
function saveVoiceSeenCalls(){
  const entries=Object.entries(voiceSeenCalls).sort((a,b)=>b[1]-a[1]).slice(0,100);
  voiceSeenCalls=Object.fromEntries(entries);
  try{localStorage.setItem(VOICE_SEEN_STORAGE,JSON.stringify(voiceSeenCalls))}catch{}
}
function voiceCallKey(item){return String(item?.callId||[item?.autoId||item?.appointmentNo||"",item?.calledAt||item?.receivingStartedAt||""].join(":"))}
function markVoiceCallSeen(item){const key=voiceCallKey(item);if(!key)return;voiceSeenCalls[key]=Date.now();saveVoiceSeenCalls()}
function isVoiceCallSeen(item){const key=voiceCallKey(item);return Boolean(key&&voiceSeenCalls[key])}
function markCurrentCallsSeen(){for(const item of [...(latestData?.recentCalls||[]),...(latestData?.recentNotices||[])])markVoiceCallSeen(item)}

function syncVoiceSettings(settings){
  const previous=voiceAdminEnabled;
  voiceSettings=settings||voiceSettings||{enabled:false};
  voiceAdminEnabled=voiceSettings?.enabled===true;
  if(window.SmartQueueVoice&&voiceSettings)window.SmartQueueVoice.configure({...voiceSettings,apiBaseUrl:cfg.apiBaseUrl});
  if(previous&&!voiceAdminEnabled){
    audioEnabled=false;
    window.SmartQueueVoice?.clearPending?.();
  }
  updateSoundButton();
}

function updateSoundButton(){
  const button=$("soundButton");if(!button)return;
  if(!voiceAdminEnabled){
    button.disabled=true;button.classList.remove("sound-on");
    button.innerHTML='<span class="ui-sound-mark off" aria-hidden="true"></span> เสียงถูกปิด';
    button.title="ผู้ดูแลระบบปิดเสียงประกาศ";
    return;
  }
  button.disabled=false;button.title="";
  if(audioEnabled){button.classList.add("sound-on");button.innerHTML='<span class="ui-sound-mark on" aria-hidden="true"></span> ระบบเสียงพร้อม'}
  else{button.classList.remove("sound-on");button.innerHTML='<span class="ui-sound-mark off" aria-hidden="true"></span> เปิดเสียง'}
}

async function toggleSound() {
  const button=$("soundButton");if(!button||!voiceAdminEnabled)return;
  if(audioEnabled){
    audioEnabled=false;window.SmartQueueVoice?.clearPending?.();updateSoundButton();return;
  }
  button.disabled=true;button.innerHTML='<span class="ui-sound-mark" aria-hidden="true"></span> กำลังเตรียมเสียง';
  try{
    if(!window.SmartQueueVoice)throw new Error("ไม่พบระบบเสียง");
    window.SmartQueueVoice.configure({...voiceSettings,apiBaseUrl:cfg.apiBaseUrl});
    await window.SmartQueueVoice.unlockAndPrepare();
    if(latestData?.announcementMode!=="CANONICAL")markCurrentCallsSeen();
    audioEnabled=true;
    updateSoundButton();
    if(voiceSettings?.playDing!==false)await window.SmartQueueVoice.playSequence(["ding"]);
  }catch(error){
    audioEnabled=false;updateSoundButton();
    setHealth("error","เปิดเสียงไม่สำเร็จ",error?.message||"โหลดชุดเสียงไม่สำเร็จ");
  }finally{button.disabled=!voiceAdminEnabled}
}

function processVoiceCalls(data){
  if(!audioEnabled||!voiceAdminEnabled||!window.SmartQueueVoice)return;
  const calls=[...(Array.isArray(data?.recentCalls)?data.recentCalls:[]),...(Array.isArray(data?.recentNotices)?data.recentNotices:[])].sort((a,b)=>Number(a.calledAt||0)-Number(b.calledAt||0));
  for(const item of calls){
    if(!item?.appointmentNo||isVoiceCallSeen(item))continue;
    const accepted=window.SmartQueueVoice.enqueue(item);
    if(accepted)markVoiceCallSeen(item);
  }
}

function announceCall(item){
  if(!audioEnabled||!voiceAdminEnabled||!window.SmartQueueVoice||!item)return false;
  if(isVoiceCallSeen(item))return false;
  const accepted=window.SmartQueueVoice.enqueue(item);if(accepted)markVoiceCallSeen(item);return accepted;
}

function fitAppointmentNumber(el, value) {
  const len = String(value || "").length;
  el.classList.remove("appt-long", "appt-xlong");
  if (len >= 11) el.classList.add("appt-xlong");
  else if (len >= 8) el.classList.add("appt-long");
}

async function toggleFull() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
}
