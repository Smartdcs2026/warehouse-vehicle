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
const VIDEO_AUDIO_PREF_KEY = "wvfQueueVideoAudioEnabled";

let lastCallKey = sessionStorage.getItem("queueLastCallKey") || "";
let queueToken = sessionStorage.getItem(QUEUE_TOKEN_KEY) || "";
let runtimeStarted = false;
let audioEnabled = false;
let videoAudioEnabled = loadVideoAudioPreference();
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
let currentDisplayMode = "CLASSIC";
let currentVisualTheme = "DARK";
let visualRuntimeFailed = false;
let trafficRuntimeFailed = false;
let queueVideoSettings = normalizeQueueDisplaySettings(null);
let queueVideoActiveElement = null;
let queueVideoCurrentTime = 0;
let queueVideoVoiceDepth = 0;
let queueVideoResumeTimer = 0;
let queueVideoFailureUrl = "";
let queueVideoFailureAt = 0;
let workPages = {
  RECEIVING_IN_PROGRESS: 0,
  WAITING_DOCUMENT_RETURN: 0,
  WAITING_GATE_OUT: 0
};
let trafficPages = {
  READY_FOR_RECEIVING: 0,
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
  $("videoSoundButton")?.addEventListener("click", toggleVideoSound);
  $("fullButton")?.addEventListener("click", toggleFull);
  window.addEventListener("smartqueuevoice:start",()=>{queueVideoVoiceDepth++;syncQueueVideoAudioState()});
  window.addEventListener("smartqueuevoice:end",()=>{queueVideoVoiceDepth=Math.max(0,queueVideoVoiceDepth-1);clearTimeout(queueVideoResumeTimer);queueVideoResumeTimer=setTimeout(syncQueueVideoAudioState,380)});
  $("queueVisualView")?.addEventListener("click", event => {
    const action=event.target.closest("[data-visual-action]")?.dataset.visualAction;
    if(action==="sound")void toggleSound();
    if(action==="video-sound")void toggleVideoSound();
    if(action==="full")void toggleFull();
  });
  $("queueTrafficView")?.addEventListener("click", event => {
    const action=event.target.closest("[data-traffic-action]")?.dataset.trafficAction;
    if(action==="sound")void toggleSound();
    if(action==="video-sound")void toggleVideoSound();
    if(action==="full")void toggleFull();
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resetPages();
      applyDensity();
      if (latestData) {
        if(currentDisplayMode==="TRAFFIC")renderTraffic(latestData);
        else if(currentDisplayMode==="VISUAL")renderVisual(latestData);
        else{renderNext(latestData);renderWork(latestData)}
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
    const visualFull=$("visualFullButton");if(visualFull)visualFull.textContent=document.fullscreenElement?"ออกจากเต็มจอ":"เต็มจอ";
    const trafficFull=$("trafficFullButton");if(trafficFull)trafficFull.textContent=document.fullscreenElement?"ออกจากเต็มจอ":"เต็มจอ";
    setTimeout(() => {
      resetPages();
      applyDensity();
      if (latestData) {
        if(currentDisplayMode==="TRAFFIC")renderTraffic(latestData);
        else if(currentDisplayMode==="VISUAL")renderVisual(latestData);
        else{renderNext(latestData);renderWork(latestData)}
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
  Object.keys(trafficPages).forEach(key => (trafficPages[key] = 0));
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
  const timeText = new Intl.DateTimeFormat("en-GB", {timeZone:tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);
  const dateText = new Intl.DateTimeFormat("th-TH", {timeZone:tz,day:"numeric",month:"short",year:"numeric"}).format(now);
  if ($("queueClock")) $("queueClock").textContent = timeText;
  if ($("visualQueueClock")) $("visualQueueClock").textContent = timeText;
  if ($("visualQueueDate")) $("visualQueueDate").textContent = dateText;
  if ($("trafficQueueClock")) $("trafficQueueClock").textContent = timeText;
  if ($("trafficQueueDate")) $("trafficQueueDate").textContent = dateText;
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
    queueDisplay: normalizeQueueDisplaySettings(raw.queueDisplay),
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
    alertLevel: cleanText(item.alertLevel ?? item.alert_level ?? "NORMAL").toUpperCase() || "NORMAL",
    alertColor: cleanText(item.alertColor ?? item.alert_color),
    alertSource: cleanText(item.alertSource ?? item.alert_source).toUpperCase(),
    totalElapsedSeconds: Math.max(0, Number(item.totalElapsedSeconds ?? item.total_elapsed_seconds) || 0),
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
function normalizeQueueDisplaySettings(value){
  const raw=value&&typeof value==="object"?value:{},media=raw.video&&typeof raw.video==="object"?raw.video:raw,mode=cleanText(raw.displayMode).toUpperCase(),theme=cleanText(raw.visualTheme).toUpperCase(),font=cleanText(raw.fontFamily).toUpperCase(),videoSize=cleanText(media.videoSize||media.size).toUpperCase();
  const volume=Math.max(0,Math.min(100,Number(media.videoVolume??media.volume??70)||0));
  return{showDoorPanel:raw.showDoorPanel!==false,doorPanelEnabled:raw.doorPanelEnabled===true,displayMode:["VISUAL","TRAFFIC"].includes(mode)?mode:"CLASSIC",visualTheme:["LIGHT","DARK","NEON"].includes(theme)?theme:"DARK",fontFamily:["NOTO_SANS_THAI","SARABUN","PROMPT","NOTO_SANS_THAI_LOOPED"].includes(font)?font:"NOTO_SANS_THAI",videoEnabled:media.videoEnabled===true||media.enabled===true,videoUrl:cleanText(media.videoUrl||media.url),videoSize:videoSize==="LARGE"?"LARGE":"STANDARD",videoSoundEnabled:media.videoSoundEnabled!==false&&media.soundEnabled!==false,videoVolume:volume,videoLoop:media.videoLoop!==false&&media.loop!==false,videoAutoplay:media.videoAutoplay!==false&&media.autoplay!==false,videoClassicEnabled:media.videoClassicEnabled!==false&&media.classicEnabled!==false,videoVisualEnabled:media.videoVisualEnabled!==false&&media.visualEnabled!==false,videoTrafficEnabled:media.videoTrafficEnabled!==false&&media.trafficEnabled!==false};
}
function cleanText(value) {
  return String(value ?? "").trim();
}
function loadVideoAudioPreference(){
  try{return localStorage.getItem(VIDEO_AUDIO_PREF_KEY)==="1"}catch{return false}
}
function saveVideoAudioPreference(){
  try{localStorage.setItem(VIDEO_AUDIO_PREF_KEY,videoAudioEnabled?"1":"0")}catch{}
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
  queueVideoSettings=normalizeQueueDisplaySettings(data.queueDisplay);
  applyQueueDisplayMode(queueVideoSettings);
  syncVoiceSettings(data.voice);
  if(currentDisplayMode==="TRAFFIC"){
    try{renderTraffic(data)}catch(error){trafficRuntimeFailed=true;console.warn("traffic queue render failed",error?.message||error);applyQueueDisplayMode({...queueVideoSettings,displayMode:"CLASSIC"});renderClassic(data);setHealth("error","จอสัญญาณไฟขัดข้อง — ใช้จอเดิม",error?.message||"")}
  }else if(currentDisplayMode==="VISUAL"){
    try{renderVisual(data)}catch(error){visualRuntimeFailed=true;console.warn("visual queue render failed",error?.message||error);applyQueueDisplayMode({...queueVideoSettings,displayMode:"CLASSIC"});renderClassic(data);setHealth("error","จอ Visual ขัดข้อง — ใช้จอเดิม",error?.message||"")}
  }else renderClassic(data);
  syncQueueVideo(queueVideoSettings);
  if(data.announcementMode === "CANONICAL"){
    ingestCanonicalAnnouncements(data);
    if(!announcementProcessing&&!currentAnnouncement&&!announcementPending.length)renderCall(latestAnnouncement(data));
  }else{
    renderCall(latestAnnouncement(data));
    processVoiceCalls(data);
  }
  setStableText($("updatedAt"), "ล่าสุด " + formatTime(data.generatedAt));
  setStableText($("visualUpdatedAt"), "ล่าสุด " + formatTime(data.generatedAt));
  setStableText($("trafficUpdatedAt"), "ล่าสุด " + formatTime(data.generatedAt));
}
function renderClassic(data){renderSummary(data);renderNext(data);renderWork(data);renderDoorRail(data)}
function queueFontStack(value){return({NOTO_SANS_THAI:'"Noto Sans Thai","Tahoma",system-ui,sans-serif',SARABUN:'"Sarabun","Noto Sans Thai","Tahoma",system-ui,sans-serif',PROMPT:'"Prompt","Noto Sans Thai","Tahoma",system-ui,sans-serif',NOTO_SANS_THAI_LOOPED:'"Noto Sans Thai Looped","Noto Sans Thai","Tahoma",system-ui,sans-serif'})[value]||'"Noto Sans Thai","Tahoma",system-ui,sans-serif'}
function applyQueueDisplayMode(settings){
  const normalized=normalizeQueueDisplaySettings(settings),app=$("queueApp"),visual=$("queueVisualView"),traffic=$("queueTrafficView");
  let requested=normalized.displayMode;if(requested==="VISUAL"&&visualRuntimeFailed)requested="CLASSIC";if(requested==="TRAFFIC"&&trafficRuntimeFailed)requested="CLASSIC";currentDisplayMode=requested;currentVisualTheme=normalized.visualTheme;
  document.documentElement.style.setProperty("--queue-font-family",queueFontStack(normalized.fontFamily));document.documentElement.dataset.queueFont=normalized.fontFamily.toLowerCase();
  if(app){app.classList.toggle("queue-visual-mode",currentDisplayMode==="VISUAL");app.classList.toggle("queue-traffic-mode",currentDisplayMode==="TRAFFIC");app.dataset.queueTheme=currentVisualTheme.toLowerCase();app.dataset.queueFont=normalized.fontFamily.toLowerCase()}
  if(visual)visual.hidden=currentDisplayMode!=="VISUAL";
  if(traffic)traffic.hidden=currentDisplayMode!=="TRAFFIC";
}

function queueVideoAllowed(settings=queueVideoSettings,mode=currentDisplayMode){const failed=queueVideoFailureUrl&&queueVideoFailureUrl===settings.videoUrl&&Date.now()-queueVideoFailureAt<60000;if(!(settings.videoEnabled===true&&Boolean(settings.videoUrl)&&!failed))return false;if(mode==="VISUAL")return settings.videoVisualEnabled!==false;if(mode==="TRAFFIC")return settings.videoTrafficEnabled!==false;return settings.videoClassicEnabled!==false}
function queueVideoAudioAvailable(){return queueVideoAllowed()&&queueVideoSettings.videoSoundEnabled!==false&&Number(queueVideoSettings.videoVolume||0)>0}
function queueAudioAvailable(){return voiceAdminEnabled}
function queueVideoNodes(){return[{mode:"CLASSIC",panel:$("classicQueueVideoPanel"),video:$("classicQueueVideo")},{mode:"VISUAL",panel:$("visualQueueVideoPanel"),video:$("visualQueueVideo")},{mode:"TRAFFIC",panel:$("trafficQueueVideoPanel"),video:$("trafficQueueVideo")}]}
function queueVideoSetSource(video,url,resumeAt=0){if(!video||!url)return;if(video.dataset.queueVideoUrl===url)return;video.pause();video.src=url;video.dataset.queueVideoUrl=url;video.onerror=()=>{if(video.dataset.queueVideoUrl!==url)return;queueVideoFailureUrl=url;queueVideoFailureAt=Date.now();video.pause();video.removeAttribute("src");video.dataset.queueVideoUrl="";video.load();syncQueueVideo(queueVideoSettings)};video.oncanplay=()=>{if(queueVideoFailureUrl===url){queueVideoFailureUrl="";queueVideoFailureAt=0}};video.load();if(resumeAt>0)video.addEventListener("loadedmetadata",()=>{try{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(resumeAt,Math.max(0,video.duration-.25))}catch{}},{once:true})}
function queueVideoPlayback(video){
  if(!video)return;
  video.loop=queueVideoSettings.videoLoop!==false;
  video.volume=Math.max(0,Math.min(1,Number(queueVideoSettings.videoVolume||0)/100));
  video.muted=!(videoAudioEnabled&&queueVideoAudioAvailable()&&queueVideoVoiceDepth===0);
  if(queueVideoSettings.videoAutoplay!==false){
    const promise=video.play();
    if(promise?.catch)promise.catch(error=>{
      video.muted=true;
      if(error?.name==="NotAllowedError"&&videoAudioEnabled){videoAudioEnabled=false;saveVideoAudioPreference();updateVideoSoundButton()}
      video.play().catch(()=>{});
    });
  }
}
function syncQueueVideoAudioState(){
  const video=queueVideoActiveElement;
  if(!video)return;
  video.volume=Math.max(0,Math.min(1,Number(queueVideoSettings.videoVolume||0)/100));
  video.muted=!(videoAudioEnabled&&queueVideoAudioAvailable()&&queueVideoVoiceDepth===0);
}
function syncQueueVideo(settings){queueVideoSettings=normalizeQueueDisplaySettings(settings);const app=$("queueApp"),classicPanel=$("callPanel"),instruction=$("callInstructionPanel"),visualRoot=$("queueVisualView"),trafficRoot=$("queueTrafficView"),allowed=queueVideoAllowed(queueVideoSettings,currentDisplayMode),size=queueVideoSettings.videoSize==="LARGE"?"large":"standard";
  if(app){app.classList.toggle("queue-video-on",allowed);app.classList.toggle("queue-video-large",allowed&&size==="large");app.classList.toggle("queue-video-standard",allowed&&size!=="large")}
  if(classicPanel){classicPanel.classList.toggle("has-queue-video",allowed&&currentDisplayMode==="CLASSIC");classicPanel.classList.toggle("queue-video-large",allowed&&currentDisplayMode==="CLASSIC"&&size==="large");classicPanel.classList.toggle("queue-video-standard",allowed&&currentDisplayMode==="CLASSIC"&&size!=="large")}
  if(instruction)instruction.hidden=allowed&&currentDisplayMode==="CLASSIC";
  if(visualRoot){visualRoot.classList.toggle("has-queue-video",allowed&&currentDisplayMode==="VISUAL");visualRoot.classList.toggle("queue-video-large",allowed&&currentDisplayMode==="VISUAL"&&size==="large");visualRoot.classList.toggle("queue-video-standard",allowed&&currentDisplayMode==="VISUAL"&&size!=="large")}
  if(trafficRoot){trafficRoot.classList.toggle("has-queue-video",allowed&&currentDisplayMode==="TRAFFIC");trafficRoot.classList.toggle("queue-video-large",allowed&&currentDisplayMode==="TRAFFIC"&&size==="large");trafficRoot.classList.toggle("queue-video-standard",allowed&&currentDisplayMode==="TRAFFIC"&&size!=="large")}
  const nodes=queueVideoNodes();let next=null;for(const node of nodes){const use=allowed&&node.mode===currentDisplayMode;if(node.panel)node.panel.hidden=!use;if(use)next=node.video;else if(node.video){if(node.video===queueVideoActiveElement&&Number.isFinite(node.video.currentTime))queueVideoCurrentTime=node.video.currentTime;node.video.pause()}}
  if(!next){queueVideoActiveElement=null;updateSoundButton();updateVideoSoundButton();return}
  if(queueVideoActiveElement&&queueVideoActiveElement!==next&&Number.isFinite(queueVideoActiveElement.currentTime))queueVideoCurrentTime=queueVideoActiveElement.currentTime;queueVideoActiveElement=next;queueVideoSetSource(next,queueVideoSettings.videoUrl,queueVideoCurrentTime);queueVideoPlayback(next);updateSoundButton();updateVideoSoundButton();syncQueueVideoCallOverlay(currentAnnouncement||latestAnnouncement(latestData||{}));
}
function syncQueueVideoCallOverlay(item){const active=Boolean(item?.appointmentNo),instruction=visualCallInstructionText(item||{}),pairs=[{overlay:$("classicQueueVideoOverlay"),number:$("classicQueueVideoNumber"),plate:$("classicQueueVideoPlate"),door:$("classicQueueVideoDoor"),text:$("classicQueueVideoInstruction")},{overlay:$("visualQueueVideoOverlay"),number:$("visualQueueVideoNumber"),plate:$("visualQueueVideoPlate"),door:$("visualQueueVideoDoor"),text:$("visualQueueVideoInstruction")},{overlay:$("trafficQueueVideoOverlay"),number:$("trafficQueueVideoNumber"),plate:$("trafficQueueVideoPlate"),door:$("trafficQueueVideoDoor"),text:$("trafficQueueVideoInstruction")}];for(const row of pairs){if(!row.overlay)continue;row.overlay.hidden=!active;setStableText(row.number,item?.appointmentNo||"–");setStableText(row.plate,item?.vehiclePlate?`${item.vehiclePlate}${item.province?` ${item.province}`:""}`:"–");setStableText(row.door,item?.doorCode?`ประตู ${item.doorCode}`:"เข้าตรวจรับสินค้า");setStableText(row.text,instruction)}}

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
  if(currentDisplayMode==="TRAFFIC")renderTraffic({items:[],counts:{},doors:[],queueDisplay:{displayMode:"TRAFFIC",visualTheme:currentVisualTheme,doorPanelEnabled:false},generatedAt:Date.now()});
  else if(currentDisplayMode==="VISUAL")renderVisual({items:[],counts:{},doors:[],queueDisplay:{displayMode:"VISUAL",visualTheme:currentVisualTheme,doorPanelEnabled:false},generatedAt:Date.now()});
  else{renderSummary({ counts: {} });renderNext({ items: [] });renderWork({ items: [] })}
  if ($("updatedAt")) $("updatedAt").textContent = "กรุณารอสักครู่";
  if ($("visualUpdatedAt")) $("visualUpdatedAt").textContent = "กรุณารอสักครู่";
  if ($("trafficUpdatedAt")) $("trafficUpdatedAt").textContent = "กรุณารอสักครู่";
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
  const sourceLabel = source === "APPOINTMENT" ? "ข้อมูลนัดหมาย" : "ข้อมูลรถเข้า";
  const sourceShort = source === "APPOINTMENT" ? "นัดหมาย" : "รถเข้า";
  let alternate = null;
  if (source === "APPOINTMENT" && gateIn && comparableCompanyName(gateIn) !== comparableCompanyName(primary)) alternate = {label:"รถเข้า", value:gateIn};
  else if (source !== "APPOINTMENT" && appointment && comparableCompanyName(appointment) !== comparableCompanyName(primary)) alternate = {label:"นัดหมาย", value:appointment};
  else if (gateIn && appointment && comparableCompanyName(gateIn) !== comparableCompanyName(appointment)) {
    const useGate = comparableCompanyName(primary) === comparableCompanyName(gateIn);
    alternate = useGate ? {label:"นัดหมาย", value:appointment} : {label:"รถเข้า", value:gateIn};
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
    num.textContent = "รอเรียกคิว";
    fitAppointmentNumber(num, "รอเรียกคิว");
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
    $("callInstruction").textContent = "รอเรียกคิว";
    if(currentDisplayMode==="VISUAL")renderVisualCall(null);
    if(currentDisplayMode==="TRAFFIC")renderTrafficCall(null);
    syncQueueVideoCallOverlay(null);
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
  if(currentDisplayMode==="VISUAL")renderVisualCall(item);
  if(currentDisplayMode==="TRAFFIC")renderTrafficCall(item);
  syncQueueVideoCallOverlay(item);
}

function readyItems(data) {
  return (data.items || []).filter(item => item.status === "READY_FOR_RECEIVING");
}

function queuePageSize() {
  const h = window.innerHeight || 800;
  const w = window.innerWidth || 1280;
  const videoOn = queueVideoAllowed(queueVideoSettings,currentDisplayMode);
  if (videoOn) {
    if (h < 700 || w < 1050) return 3;
    return 4;
  }
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
  const all=latestData.items||[],pageSize=currentDisplayMode==="VISUAL"?visualStagePageSize():null;
  const ready=readyItems(latestData),nextPages=Math.ceil(ready.length/(pageSize||queuePageSize()));if(nextPages>1)nextPage=(nextPage+1)%nextPages;
  for(const status of Object.keys(workPages)){const pages=Math.ceil(all.filter(item=>item.status===status).length/(pageSize||workPageSize()));if(pages>1)workPages[status]=(workPages[status]+1)%pages}
  if(currentDisplayMode==="TRAFFIC"){
    for(const def of TRAFFIC_STAGE_DEFS){const count=all.filter(item=>item.status===def.status).length,pages=Math.max(1,Math.ceil(count/trafficStagePageSize()));if(pages>1)trafficPages[def.status]=(trafficPages[def.status]+1)%pages}
    renderTraffic(latestData,true);
  }else if(currentDisplayMode==="VISUAL"){
    const doorInfo=visualDoorSelection(latestData);if(doorInfo.pages>1)doorPage=(doorPage+1)%doorInfo.pages;renderVisual(latestData,true);
  }else{
    const allDoors=Array.isArray(latestData.doors)?latestData.doors:[],importantDoors=allDoors.filter(d=>String(d.status||"AVAILABLE")!=="AVAILABLE"),availableDoors=allDoors.filter(d=>String(d.status||"AVAILABLE")==="AVAILABLE"),availableSlots=Math.max(1,doorPageSize()-importantDoors.length),doorPages=Math.max(1,Math.ceil(availableDoors.length/availableSlots));if(doorPages>1)doorPage=(doorPage+1)%doorPages;
    renderNext(latestData,true);renderWork(latestData,true);renderDoorRail(latestData,true);
  }
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
  const publicText=state==="ok"?"พร้อมใช้งาน":state==="loading"?"กำลังเตรียมข้อมูล":latestData?"แสดงข้อมูลล่าสุด":"กรุณารอสักครู่";
  el.classList.remove("error", "stale", "offline", "loading");
  if (state && state !== "ok") el.classList.add(state);
  el.textContent = publicText;
  el.removeAttribute("title");
  el.dataset.state = state || "ok";
  const visual=$("visualQueueHealth");if(visual){visual.textContent=publicText;visual.removeAttribute("title");visual.dataset.state=state||"ok"}
  const traffic=$("trafficQueueHealth");if(traffic){traffic.textContent=publicText;traffic.removeAttribute("title");traffic.dataset.state=state||"ok"}
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


const VISUAL_STAGE_DEFS=[
  {status:"READY_FOR_RECEIVING",number:"1",label:"รอเข้าตรวจรับสินค้า",tone:"ready"},
  {status:"RECEIVING_IN_PROGRESS",number:"2",label:"กำลังตรวจรับสินค้า",tone:"progress"},
  {status:"WAITING_DOCUMENT_RETURN",number:"3",label:"รอรับเอกสารคืน",tone:"return"},
  {status:"WAITING_GATE_OUT",number:"4",label:"รอออกจากพื้นที่",tone:"out"}
];
let visualStatusSnapshot=new Map();
const VISUAL_SHELL_VERSION="20710";
function visualStagePageSize(){const h=window.innerHeight||800,w=window.innerWidth||1280,videoOn=$("queueVisualView")?.classList.contains("has-queue-video");if(videoOn){if(h<680||w<1050)return 2;if(h>=980&&w>=1700)return 4;return 3}if(h<680||w<1050)return 4;if(h>=980&&w>=1700)return 8;return 6}
function visualPageFor(status){return status==="READY_FOR_RECEIVING"?nextPage:(workPages[status]||0)}
function visualSetPage(status,value){if(status==="READY_FOR_RECEIVING")nextPage=value;else workPages[status]=value}
function visualStageItems(data,status){return(data.items||[]).filter(item=>item.status===status).sort((a,b)=>(a.stageSince||0)-(b.stageSince||0))}
function visualTruckSvg(){return `<svg class="visual-truck-svg" viewBox="0 0 72 46" aria-hidden="true"><path d="M5 9h41v26H5z" fill="currentColor" opacity=".20"/><path d="M46 17h12l9 10v8H46z" fill="currentColor" opacity=".33"/><path d="M8 12h35v19H8z" fill="currentColor" opacity=".72"/><path d="M48 20h9l6 7v4H48z" fill="currentColor" opacity=".88"/><path d="M4 35h64" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="36" r="5" fill="#09131e" stroke="currentColor" stroke-width="2"/><circle cx="55" cy="36" r="5" fill="#09131e" stroke="currentColor" stroke-width="2"/><path d="M12 16h24M12 21h24" stroke="rgba(255,255,255,.38)" stroke-width="1.4" stroke-linecap="round"/></svg>`}
function visualRearTruckSvg(){return `<svg class="visual-rear-truck-svg" viewBox="0 0 76 64" aria-hidden="true"><rect x="13" y="9" width="50" height="43" rx="3" fill="currentColor" opacity=".72"/><rect x="18" y="14" width="40" height="31" rx="2" fill="#c8d3de" opacity=".72"/><path d="M38 14v31M20 21h36M20 29h36M20 37h36" stroke="#5b6976" stroke-width="1.5" opacity=".75"/><rect x="10" y="49" width="56" height="7" rx="2" fill="#222d37"/><circle cx="22" cy="57" r="5" fill="#080d12"/><circle cx="54" cy="57" r="5" fill="#080d12"/><rect x="13" y="50" width="7" height="3" rx="1" fill="#ff3b30"/><rect x="56" y="50" width="7" height="3" rx="1" fill="#ff3b30"/></svg>`}
function visualWaitText(item){const sec=Math.max(0,Number(item?.elapsedSeconds)||0);return sec<60?"< 1 นาที":shortDuration(sec)}
function visualStatusLabel(status){return({READY_FOR_RECEIVING:"รอเข้าตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",WAITING_GATE_OUT:"รอออกจากพื้นที่"})[status]||status||"–"}
function visualChangedAutos(data){const changed=new Set(),next=new Map();for(const item of data.items||[]){if(item.autoId){next.set(item.autoId,item.status);if(visualStatusSnapshot.has(item.autoId)&&visualStatusSnapshot.get(item.autoId)!==item.status)changed.add(item.autoId)}}visualStatusSnapshot=next;return changed}
let visualDoorPrioritySignature="";
function visualDoorHasVehicle(door){
  if(!door||typeof door!=="object")return false;
  if(Math.max(0,Number(door.occupancyCount)||0)>0)return true;
  if(Array.isArray(door.items)&&door.items.length>0)return true;
  return Boolean(cleanText(door.appointmentNo)||cleanText(door.vehiclePlate));
}
function compareVisualQueueDoors(a,b){
  const occupied=Number(visualDoorHasVehicle(b))-Number(visualDoorHasVehicle(a));
  if(occupied)return occupied;
  const status=doorStatusRank(a.status)-doorStatusRank(b.status);if(status)return status;
  const [ag,an]=queueDoorNaturalParts(a.doorCode),[bg,bn]=queueDoorNaturalParts(b.doorCode);return ag.localeCompare(bg,"en")||an-bn;
}
function visualDoorSelection(data){
  const raw=Array.isArray(data?.doors)?data.doors:[],seen=new Map();
  for(const door of raw){
    const code=normalizeQueueDoorCode(door.doorCode);if(!code)continue;
    const prev=seen.get(code);
    if(!prev){seen.set(code,{...door,doorCode:code});continue}
    const merged={...prev,...door,doorCode:code};
    merged.isActive=prev.isActive!==false||door.isActive!==false;
    merged.occupancyCount=Math.max(Number(prev.occupancyCount||0),Number(door.occupancyCount||0));
    merged.items=[...(Array.isArray(prev.items)?prev.items:[]),...(Array.isArray(door.items)?door.items:[])];
    if(doorStatusRank(prev.status)<doorStatusRank(door.status))merged.status=prev.status;
    if(!merged.appointmentNo)merged.appointmentNo=prev.appointmentNo||door.appointmentNo;
    if(!merged.vehiclePlate)merged.vehiclePlate=prev.vehiclePlate||door.vehiclePlate;
    seen.set(code,merged);
  }
  const doors=[...seen.values()].sort(compareVisualQueueDoors),limit=(window.innerWidth||1280)>=1450?6:4;
  const occupiedDoors=doors.filter(visualDoorHasVehicle),otherDoors=doors.filter(door=>!visualDoorHasVehicle(door));
  const prioritySignature=occupiedDoors.map(door=>door.doorCode).join("|");
  if(prioritySignature!==visualDoorPrioritySignature){visualDoorPrioritySignature=prioritySignature;doorPage=0}
  let pages=1,shown=[],showingOccupied=false,filledEmpty=0;
  if(occupiedDoors.length){
    pages=Math.max(1,Math.ceil(occupiedDoors.length/limit));if(doorPage>=pages)doorPage=0;
    const occupiedShown=occupiedDoors.slice(doorPage*limit,doorPage*limit+limit),remaining=Math.max(0,limit-occupiedShown.length);
    const fillers=remaining?otherDoors.slice(0,remaining):[];
    shown=[...occupiedShown,...fillers];showingOccupied=true;filledEmpty=fillers.length;
  }else{
    pages=Math.max(1,Math.ceil(otherDoors.length/limit));if(doorPage>=pages)doorPage=0;
    shown=otherDoors.slice(doorPage*limit,doorPage*limit+limit);
  }
  return{all:doors,shown,pages,occupiedPages:occupiedDoors.length?pages:0,showingOccupied,occupiedCount:occupiedDoors.length,filledEmpty};
}
function visualDoorBay(door){const status=String(door.status||"AVAILABLE"),labels={AVAILABLE:"ว่าง",CALLED:"เรียกเข้า",IN_USE:"กำลังตรวจรับ",DRAINING:"ปิดหลังจบงาน"},occupied=Math.max(0,Number(door.occupancyCount)||0),primary=door.items?.[0]||door;return `<article class="visual-door-bay door-${esc(status.toLowerCase())}"><div class="visual-garage"><span class="visual-garage-code">${esc(door.doorCode||"–")}</span><span class="visual-garage-status">${esc(labels[status]||status)}</span>${occupied?`<span class="visual-garage-truck">${visualRearTruckSvg()}<small>${esc(primary.appointmentNo||"")} ${esc(primary.vehiclePlate||"")}</small></span>`:""}</div><div class="visual-door-bay-foot"><b>${esc(labels[status]||status)}</b><small>${status==="DRAINING"?"ปิดหลังจบงาน":`${occupied} คัน`}</small></div></article>`}
function visualSummaryStatic(def){return `<article class="visual-summary-card tone-${def.tone}"><span class="visual-summary-icon">${def.number}</span><div><small>${esc(def.label)}</small><b id="visualSummary_${def.status}">0</b><em>คัน</em></div></article>`}
function ensureVisualShell(root){
  if(root.dataset.visualShellVersion===VISUAL_SHELL_VERSION&&root.querySelector(".visual-queue-shell"))return;
  root.innerHTML=`<div class="visual-queue-shell">
    <header class="visual-queue-header"><div class="visual-brand"><img src="./icon-192.png" alt=""><div><h1>สถานะคิวรถขนส่ง</h1><small>ระบบบริหารจัดการคิวรถขนส่ง</small></div></div><div class="visual-head-actions"><div class="visual-datetime"><b id="visualQueueClock">--:--:--</b><span id="visualQueueDate">--</span></div><span id="visualQueueHealth" class="visual-health">พร้อมใช้งาน</span><button id="visualSoundButton" data-visual-action="sound" type="button">เปิดเสียงคิว</button><button id="visualVideoSoundButton" data-visual-action="video-sound" type="button" hidden>เปิดเสียงวิดีโอ</button><button id="visualFullButton" data-visual-action="full" type="button">เต็มจอ</button></div></header>
    <section class="visual-top"><article id="visualCallHero" class="visual-call-hero is-idle"><div class="visual-call-signal"><span class="visual-signal-ring">${visualTruckSvg()}</span><b id="visualCallState">รอเรียกคิว</b></div><div class="visual-call-main"><small>หมายเลขนัดหมาย</small><strong id="visualCallNumber">รอเรียกคิว</strong><b id="visualCallCompany">–</b><span id="visualCallPlan" class="visual-call-plan"></span></div><div class="visual-call-vehicle"><small>ทะเบียนรถ</small><b id="visualCallPlate">–</b><span id="visualCallProvince">–</span></div><div class="visual-call-door"><small>ประตู</small><b id="visualCallDoor">–</b><span id="visualCallInstruction">รอเจ้าหน้าที่เรียกคิว</span></div></article><div class="visual-summary-grid">${VISUAL_STAGE_DEFS.map(visualSummaryStatic).join("")}</div></section>
    <aside id="visualQueueVideoPanel" class="visual-queue-video-panel" hidden aria-label="สื่อประชาสัมพันธ์"><video id="visualQueueVideo" playsinline preload="metadata"></video><div id="visualQueueVideoOverlay" class="queue-video-call-overlay visual-video-call-overlay" hidden><small>กำลังเรียกคิว</small><strong id="visualQueueVideoNumber">–</strong><div><span id="visualQueueVideoPlate">–</span><b id="visualQueueVideoDoor">–</b></div><em id="visualQueueVideoInstruction">–</em></div></aside>
    <section class="visual-stage-wrap"><div class="visual-stage-grid">${VISUAL_STAGE_DEFS.map((def,index)=>`${index?'<i class="visual-flow-arrow">›</i>':''}<section id="visualLane_${def.status}" class="visual-stage-lane tone-${def.tone}"><header><span>${def.number}</span><div><b>${esc(def.label)}</b><small id="visualLaneMeta_${def.status}">0 คัน</small></div></header><div id="visualLaneList_${def.status}" class="visual-stage-list"></div><footer id="visualLaneFooter_${def.status}" class="is-clear">ไม่มีรถในขั้นตอนนี้</footer></section>`).join("")}</div></section>
    <section class="visual-lower-grid"><aside id="visualDoorPanel" class="visual-door-panel"><header><div><small>ประตูรับสินค้า</small><b>สถานะประตู</b></div><span id="visualDoorMeta">–</span></header><div id="visualDoorGrid" class="visual-door-grid"></div><footer id="visualDoorFooter">–</footer></aside><aside class="visual-wait-panel"><header><div><small>ติดตามงาน</small><b>รถที่รอนาน</b></div><span>ตามเวลาที่อยู่ในขั้นตอน</span></header><div id="visualWaitList" class="visual-wait-list"></div></aside></section>
    <footer class="visual-queue-footer"><span>โปรดตรวจสอบหมายเลขนัดหมายและประตู</span><b id="visualUpdatedAt">ล่าสุด –</b><span>ขับขี่ปลอดภัย</span></footer>
  </div>`;
  root.dataset.visualShellVersion=VISUAL_SHELL_VERSION;
}
function createVisualVehicleElement(item,tone){
  const article=document.createElement("article");article.className=`visual-vehicle-card tone-${tone}`;article.innerHTML=`<div class="visual-vehicle-icon">${visualTruckSvg()}</div><div class="visual-vehicle-copy"><div class="visual-vehicle-top"><b data-role="appointment">–</b><span data-role="plate">–</span></div><strong data-role="company">–</strong><small><span data-role="province"></span><i data-role="door" hidden></i></small></div><time data-role="wait">–</time>`;return article;
}
function updateVisualVehicleElement(article,item,tone,changed=false){
  const company=queueCompanyView(item),door=normalizeQueueDoorCode(item.doorCode),key=item.autoId||item.appointmentNo||`${item.vehiclePlate||""}:${item.stageSince||0}`;
  article.dataset.visualKey=key;article.className=`visual-vehicle-card tone-${tone}${Number(item.calledAt||0)>0?" is-called":""}`;
  setStableText(article.querySelector('[data-role="appointment"]'),item.appointmentNo||"–");setStableText(article.querySelector('[data-role="plate"]'),item.vehiclePlate||"–");setStableText(article.querySelector('[data-role="company"]'),company.primary||"ไม่ระบุบริษัท");article.querySelector('[data-role="company"]').title=company.tooltip||company.primary||"";setStableText(article.querySelector('[data-role="province"]'),item.province||"");const doorEl=article.querySelector('[data-role="door"]');doorEl.hidden=!door;setStableText(doorEl,door);setStableText(article.querySelector('[data-role="wait"]'),visualWaitText(item));
  if(changed&&!article.classList.contains("is-transitioning")){article.classList.add("is-transitioning");setTimeout(()=>article.classList.remove("is-transitioning"),700)}
}
function syncVisualStage(data,def,changedAutos){
  const items=visualStageItems(data,def.status),size=visualStagePageSize(),pages=Math.max(1,Math.ceil(items.length/size));let page=visualPageFor(def.status);if(page>=pages){page=0;visualSetPage(def.status,0)}const shown=items.slice(page*size,page*size+size),list=$("visualLaneList_"+def.status),meta=$("visualLaneMeta_"+def.status),footer=$("visualLaneFooter_"+def.status);if(!list)return;
  setStableText(meta,`${items.length.toLocaleString("th-TH")} คัน${pages>1?` · ${page+1}/${pages}`:""}`);
  const existing=new Map([...list.querySelectorAll(".visual-vehicle-card")].map(el=>[el.dataset.visualKey,el]));let empty=list.querySelector(".visual-stage-empty");if(shown.length&&empty)empty.remove();
  const keep=new Set();for(const item of shown){const key=item.autoId||item.appointmentNo||`${item.vehiclePlate||""}:${item.stageSince||0}`;keep.add(key);let card=existing.get(key);if(!card){card=createVisualVehicleElement(item,def.tone);list.appendChild(card)}updateVisualVehicleElement(card,item,def.tone,changedAutos.has(item.autoId));list.appendChild(card)}
  for(const [key,el] of existing)if(!keep.has(key))el.remove();if(!shown.length&&!list.querySelector(".visual-stage-empty")){const div=document.createElement("div");div.className="visual-stage-empty";div.innerHTML=`<span>${def.number}</span><b>ไม่มีรถในขั้นตอนนี้</b>`;list.appendChild(div)}
  const remaining=Math.max(0,items.length-shown.length);footer.classList.toggle("is-clear",remaining===0);setStableText(footer,remaining?`+ อีก ${remaining.toLocaleString("th-TH")} คัน`:items.length?"แสดงรายการปัจจุบัน":"ไม่มีรถในขั้นตอนนี้");
}
function syncVisualDoors(data){
  const panel=$("visualDoorPanel"),grid=$("visualDoorGrid"),meta=$("visualDoorMeta"),footer=$("visualDoorFooter"),doorInfo=visualDoorSelection(data),show=Boolean(data?.queueDisplay?.doorPanelEnabled)&&doorInfo.all.length>0;if(panel)panel.hidden=!show;if(!show)return;
  setStableText(meta,doorInfo.occupiedCount?`มีรถ ${doorInfo.occupiedCount.toLocaleString("th-TH")} · รวม ${doorInfo.all.length.toLocaleString("th-TH")} ประตู`:`${doorInfo.all.length.toLocaleString("th-TH")} ประตู`);
  setStableHTML(grid,doorInfo.shown.map(visualDoorBay).join(""));
  const priorityText=doorInfo.showingOccupied?`ประตูที่มีรถ · ${doorPage+1}/${Math.max(1,doorInfo.pages)}${doorInfo.filledEmpty?` · เติมประตูว่าง ${doorInfo.filledEmpty}`:""}`:`ประตูว่าง/พร้อมใช้งาน${doorInfo.pages>1?` · ${doorPage+1}/${doorInfo.pages}`:""}`;
  setStableText(footer,doorInfo.pages>1?`${priorityText} · หมุนอัตโนมัติ`:priorityText);
}
function syncVisualWaitPanel(data){
  const list=$("visualWaitList");if(!list)return;const defByStatus=new Map(VISUAL_STAGE_DEFS.map(def=>[def.status,def]));const items=[...(data.items||[])].sort((a,b)=>Number(b.elapsedSeconds||0)-Number(a.elapsedSeconds||0)).slice(0,3);const html=items.length?items.map((item,index)=>{const def=defByStatus.get(item.status)||{tone:"ready"},company=queueCompanyView(item);return `<article class="visual-wait-item tone-${def.tone}"><span>${index+1}</span><div><b>${esc(item.appointmentNo||"–")}</b><small>${esc(company.primary||"ไม่ระบุบริษัท")}${item.doorCode?` · ${esc(item.doorCode)}`:""}</small></div><em>${esc(visualStatusLabel(item.status))}</em><time>${esc(visualWaitText(item))}</time></article>`}).join(""):'<div class="visual-wait-empty">ไม่มีรถค้างในขั้นตอนปัจจุบัน</div>';setStableHTML(list,html);
}
function renderVisual(data,animate=false){
  const root=$("queueVisualView");if(!root)return;ensureVisualShell(root);const changedAutos=visualChangedAutos(data),call=currentAnnouncement||latestAnnouncement(data);root.hidden=false;renderVisualCall(call);for(const def of VISUAL_STAGE_DEFS){setStableText($("visualSummary_"+def.status),Number(data.counts?.[def.status]||0).toLocaleString("th-TH"));syncVisualStage(data,def,changedAutos)}syncVisualDoors(data);syncVisualWaitPanel(data);syncVisualControls();
}
function visualPlanText(item){const p=item?.appointmentEnrichment?.projection||item?.appointment_enrichment?.projection||null;if(!p)return"";const bits=[];if(p.plannedAtDisplay)bits.push(`นัด ${p.plannedAtDisplay}`);if(Array.isArray(p.pos)&&p.pos.length)bits.push(`PO ${p.pos.slice(0,2).join(", ")}${p.pos.length>2?"…":""}`);return bits.join(" · ")}
function visualCallInstructionText(item){if(!item?.appointmentNo)return"รอเจ้าหน้าที่เรียกคิว";const type=String(item.callType||"").toUpperCase();if(type==="NOTICE_DOCUMENT_ROOM")return"กรุณาติดต่อห้องเอกสาร";if(type==="NOTICE_DOOR")return item.doorCode?`กรุณาติดต่อประตู ${item.doorCode}`:"กรุณาติดต่อที่ประตู";if(type==="NOTICE_VEHICLE")return"กรุณาติดต่อที่รถของท่าน";return item.doorCode?`กรุณาเข้าประตู ${item.doorCode}`:"กรุณาเข้าตรวจรับสินค้า"}
function renderVisualCall(item){
  const hero=$("visualCallHero");if(!hero)return;const company=queueCompanyView(item||{});hero.classList.toggle("is-active",Boolean(item?.appointmentNo));hero.classList.toggle("is-idle",!item?.appointmentNo);setStableText($("visualCallNumber"),item?.appointmentNo||"รอเรียกคิว");setStableText($("visualCallCompany"),company.primary||"–");setStableText($("visualCallPlan"),visualPlanText(item));setStableText($("visualCallPlate"),item?.vehiclePlate||"–");setStableText($("visualCallProvince"),item?.province||"–");setStableText($("visualCallDoor"),item?.doorCode||"–");setStableText($("visualCallInstruction"),visualCallInstructionText(item));const type=String(item?.callType||"").toUpperCase();setStableText($("visualCallState"),!item?.appointmentNo?"รอเรียกคิว":type.startsWith("NOTICE_")?"เรียกเพิ่มเติม":type==="RECALL"?"กำลังเรียกซ้ำ":type==="DOOR_CHANGED"?"เปลี่ยนประตูและเรียก":"กำลังเรียก");
}
function syncVisualControls(){
  tick();updateSoundButton();const source=$("queueHealth"),visual=$("visualQueueHealth");if(source&&visual){setStableText(visual,source.textContent);visual.dataset.state=source.dataset.state||"ok";visual.title=source.title||source.textContent}const visualFull=$("visualFullButton");if(visualFull)setStableText(visualFull,document.fullscreenElement?"ออกจากเต็มจอ":"เต็มจอ");
}


/* Round 207.12 — Traffic Signal queue display */
const TRAFFIC_STAGE_DEFS=[
  {status:"READY_FOR_RECEIVING",number:"1",label:"รอเข้าตรวจรับสินค้า",baseLamp:"green",tone:"green"},
  {status:"RECEIVING_IN_PROGRESS",number:"2",label:"กำลังตรวจรับสินค้า",baseLamp:"amber",tone:"amber"},
  {status:"WAITING_DOCUMENT_RETURN",number:"3",label:"รอรับเอกสารคืน",baseLamp:"red",tone:"red"},
  {status:"WAITING_GATE_OUT",number:"4",label:"รอออกจากคลัง",baseLamp:"green",tone:"green"}
];
const TRAFFIC_SHELL_VERSION="20712";
function trafficAlertRank(level){return({NORMAL:0,WATCH:1,WARNING:2,URGENT:3,CRITICAL:4})[String(level||"NORMAL").toUpperCase()]??0}
function trafficStagePageSize(){const h=window.innerHeight||800,w=window.innerWidth||1280;if(h<690||w<1120)return 2;return 3}
function trafficSignalState(items,baseLamp){
  if(!items.length)return{lamp:"off",motion:"",level:"NORMAL"};
  let level="NORMAL",rank=0;for(const item of items){const r=trafficAlertRank(item.alertLevel);if(r>rank){rank=r;level=String(item.alertLevel||"NORMAL").toUpperCase()}}
  if(rank>=3)return{lamp:"red",motion:"blink-fast",level};
  if(rank===2)return{lamp:"amber",motion:"blink",level};
  if(rank===1)return{lamp:baseLamp,motion:"pulse",level};
  return{lamp:baseLamp,motion:"",level};
}
function trafficLightHtml(lamp="off",motion="",extra=""){
  const active=lamp==="red"||lamp==="amber"||lamp==="green"?lamp:"off";
  return `<div class="traffic-light ${motion?`is-${motion}`:""} ${extra}" data-lamp="${esc(active)}" aria-hidden="true"><i class="lamp-red"></i><i class="lamp-amber"></i><i class="lamp-green"></i><span class="traffic-pole"></span></div>`;
}
function trafficStatusLabel(status){return({READY_FOR_RECEIVING:"รอเข้าตรวจรับสินค้า",RECEIVING_IN_PROGRESS:"กำลังตรวจรับสินค้า",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",WAITING_GATE_OUT:"รอออกจากคลัง"})[status]||"กำลังดำเนินการ"}
function trafficAlertLabel(level){return({WATCH:"เฝ้าระวัง",WARNING:"เตือน",URGENT:"เร่งด่วน",CRITICAL:"วิกฤต"})[String(level||"").toUpperCase()]||""}
function trafficStageStatic(def){return `<article id="trafficStage_${def.status}" class="traffic-stage traffic-tone-${def.tone}"><header><span>${def.number}</span><div><b>${esc(def.label)}</b><small id="trafficStageMeta_${def.status}">0 คัน</small></div><strong id="trafficStageCount_${def.status}">0</strong><em>คัน</em></header><div class="traffic-stage-body"><div id="trafficSignal_${def.status}" class="traffic-stage-signal">${trafficLightHtml("off")}</div><div id="trafficStageList_${def.status}" class="traffic-stage-list"></div></div><footer id="trafficStageFooter_${def.status}">ไม่มีรถในขั้นตอนนี้</footer></article>`}
function ensureTrafficShell(root){
  if(root.dataset.trafficShellVersion===TRAFFIC_SHELL_VERSION&&root.querySelector(".traffic-queue-shell"))return;
  root.innerHTML=`<div class="traffic-queue-shell">
    <header class="traffic-header"><div class="traffic-brand"><img src="./icon-192.png" alt=""><div><small>ระบบบริหารรถขนส่งคลังสินค้า</small><h1>สถานะคิวรถขนส่ง</h1></div></div><div class="traffic-head-actions"><div class="traffic-datetime"><b id="trafficQueueClock">--:--:--</b><span id="trafficQueueDate">--</span></div><span id="trafficQueueHealth" class="traffic-health">พร้อมใช้งาน</span><button id="trafficSoundButton" data-traffic-action="sound" type="button">เปิดเสียงคิว</button><button id="trafficVideoSoundButton" data-traffic-action="video-sound" type="button" hidden>เปิดเสียงวิดีโอ</button><button id="trafficFullButton" data-traffic-action="full" type="button">เต็มจอ</button></div></header>
    <section class="traffic-top"><article id="trafficCallHero" class="traffic-call-hero is-idle"><div id="trafficCallSignal" class="traffic-call-signal">${trafficLightHtml("green","pulse","traffic-light-large")}<b id="trafficCallState">รอเรียกคิว</b></div><div class="traffic-call-main"><small>คิวปัจจุบัน</small><strong id="trafficCallNumber">รอเรียกคิว</strong><b id="trafficCallCompany">–</b><div class="traffic-call-meta"><span><small>ทะเบียนรถ</small><b id="trafficCallPlate">–</b></span><span><small>จังหวัด</small><b id="trafficCallProvince">–</b></span><span><small>ประตู</small><b id="trafficCallDoor">–</b></span></div><em id="trafficCallInstruction">รอเจ้าหน้าที่เรียกคิว</em></div></article>
      <aside id="trafficQueueVideoPanel" class="traffic-video-panel" hidden aria-label="สื่อประชาสัมพันธ์"><video id="trafficQueueVideo" playsinline preload="metadata" tabindex="-1" aria-hidden="true"></video></aside>
    </section>
    <section class="traffic-stage-grid">${TRAFFIC_STAGE_DEFS.map(trafficStageStatic).join("")}</section>
    <section id="trafficBottomGrid" class="traffic-bottom-grid"><section id="trafficDoorPanel" class="traffic-door-panel"><header><div><small>ประตูรับสินค้า</small><b>สถานะประตู</b></div><span id="trafficDoorMeta">–</span></header><div id="trafficDoorList" class="traffic-door-list"></div><footer><span><i class="door-dot available"></i>ว่าง</span><span><i class="door-dot called"></i>เรียกเข้า</span><span><i class="door-dot inuse"></i>กำลังใช้งาน</span><span><i class="door-dot draining"></i>ปิดหลังจบงาน</span></footer></section><section class="traffic-activity-panel"><header><div><small>หน้างาน</small><b>ความเคลื่อนไหวล่าสุด</b></div></header><div id="trafficActivityList" class="traffic-activity-list"></div></section><section class="traffic-wait-panel"><header><div><small>ติดตามงาน</small><b>รถที่รอนาน</b></div></header><div id="trafficWaitList" class="traffic-wait-list"></div></section></section>
    <footer class="traffic-footer"><span>โปรดตรวจสอบหมายเลขนัดหมายและประตู</span><b id="trafficUpdatedAt">ล่าสุด –</b><span>ขับขี่ปลอดภัย</span></footer>
  </div>`;
  root.dataset.trafficShellVersion=TRAFFIC_SHELL_VERSION;
}
function trafficCallSignalFor(item){
  if(!item?.appointmentNo)return{lamp:"green",motion:"pulse",label:"รอเรียกคิว"};
  const type=String(item.callType||"").toUpperCase();
  if(type.startsWith("NOTICE_"))return{lamp:"red",motion:"blink",label:"แจ้งผู้ขับรถ"};
  if(type==="RECALL"||type==="DOOR_CHANGED")return{lamp:"amber",motion:"blink",label:type==="DOOR_CHANGED"?"เปลี่ยนประตู":"เรียกซ้ำ"};
  return{lamp:"green",motion:"pulse",label:"กำลังเรียกคิว"};
}
function renderTrafficCall(item){
  const hero=$("trafficCallHero");if(!hero)return;const company=queueCompanyView(item||{}),signal=trafficCallSignalFor(item);hero.classList.toggle("is-idle",!item?.appointmentNo);hero.classList.toggle("is-active",Boolean(item?.appointmentNo));setStableHTML($("trafficCallSignal"),`${trafficLightHtml(signal.lamp,signal.motion,"traffic-light-large")}<b id="trafficCallState">${esc(signal.label)}</b>`);setStableText($("trafficCallNumber"),item?.appointmentNo||"รอเรียกคิว");setStableText($("trafficCallCompany"),company.primary||"–");setStableText($("trafficCallPlate"),item?.vehiclePlate||"–");setStableText($("trafficCallProvince"),item?.province||"–");setStableText($("trafficCallDoor"),item?.doorCode||"–");setStableText($("trafficCallInstruction"),visualCallInstructionText(item||{}));
}
function trafficStageItem(item){
  const company=queueCompanyView(item),door=normalizeQueueDoorCode(item.doorCode),alert=trafficAlertLabel(item.alertLevel),called=Number(item.calledAt||0)>0;
  return `<article class="traffic-vehicle ${called?"is-called":""} ${alert?"has-alert":""}"><div class="traffic-vehicle-main"><b>${esc(item.appointmentNo||"–")}</b><span>${esc(item.vehiclePlate||"–")}</span></div><strong title="${esc(company.tooltip||company.primary)}">${esc(company.primary||"ไม่ระบุบริษัท")}</strong><div class="traffic-vehicle-foot"><small>${esc(item.province||"–")}</small>${door?`<i>${esc(door)}</i>`:""}<time>${esc(visualWaitText(item))}</time>${alert?`<em>${esc(alert)}</em>`:""}</div></article>`;
}
function syncTrafficStage(data,def,animate=false){
  const items=(data.items||[]).filter(item=>item.status===def.status).sort((a,b)=>trafficAlertRank(b.alertLevel)-trafficAlertRank(a.alertLevel)||Number(b.elapsedSeconds||0)-Number(a.elapsedSeconds||0)),size=trafficStagePageSize(),pages=Math.max(1,Math.ceil(items.length/size));let page=trafficPages[def.status]||0;if(page>=pages){page=0;trafficPages[def.status]=0}const shown=items.slice(page*size,page*size+size),signal=trafficSignalState(items,def.baseLamp);setStableText($("trafficStageCount_"+def.status),items.length.toLocaleString("th-TH"));setStableText($("trafficStageMeta_"+def.status),`${items.length.toLocaleString("th-TH")} คัน`);setStableHTML($("trafficSignal_"+def.status),trafficLightHtml(signal.lamp,signal.motion));const list=$("trafficStageList_"+def.status),changed=setStableHTML(list,shown.length?shown.map(trafficStageItem).join(""):'<div class="traffic-stage-empty">ไม่มีรถในขั้นตอนนี้</div>');if(animate&&changed)fadePage(list);const alertLabel=trafficAlertLabel(signal.level);setStableText($("trafficStageFooter_"+def.status),alertLabel?`${alertLabel} · ตามเกณฑ์เวลาที่กำหนด`:items.length?(items.length>shown.length?`อีก ${(items.length-shown.length).toLocaleString("th-TH")} คัน`:`รายการปัจจุบัน`):"ไม่มีรถในขั้นตอนนี้");
}
function trafficDoorCard(door){const status=String(door.status||"AVAILABLE"),label={AVAILABLE:"ว่าง",CALLED:"เรียกเข้า",IN_USE:"กำลังใช้งาน",DRAINING:"ปิดหลังจบงาน"}[status]||status,code=normalizeQueueDoorCode(door.doorCode)||"–",count=Math.max(0,Number(door.occupancyCount)||0);return `<article class="traffic-door door-${esc(status.toLowerCase())}"><div><b>${esc(code)}</b><span><i></i>${esc(label)}</span></div><strong>${status==="DRAINING"?"–":count}</strong></article>`}
function syncTrafficDoors(data){const panel=$("trafficDoorPanel"),bottom=$("trafficBottomGrid"),enabled=Boolean(data?.queueDisplay?.doorPanelEnabled),doors=(Array.isArray(data?.doors)?data.doors:[]).slice().sort(compareQueueDoors);panel.hidden=!enabled;bottom?.classList.toggle("no-doors",!enabled);if(!enabled)return;const important=doors.filter(d=>String(d.status||"AVAILABLE")!=="AVAILABLE"),available=doors.filter(d=>String(d.status||"AVAILABLE")==="AVAILABLE"),shown=[...important,...available].slice(0,8);setStableText($("trafficDoorMeta"),`${important.length?`ใช้งาน ${important.length} · `:""}รวม ${doors.length} ประตู`);setStableHTML($("trafficDoorList"),shown.length?shown.map(trafficDoorCard).join(""):'<div class="traffic-panel-empty">ไม่มีข้อมูลประตู</div>')}
function trafficActivityItem(item){const status=trafficStatusLabel(item.status),door=item.doorCode?` · ${item.doorCode}`:"";return `<article><time>${esc(formatTime(item.stageSince||Date.now()))}</time><div><b>${esc(item.appointmentNo||"–")}</b><small>${esc(status)}${esc(door)}</small></div><span class="level-${esc(String(item.alertLevel||"NORMAL").toLowerCase())}">${esc(trafficAlertLabel(item.alertLevel)||"ปกติ")}</span></article>`}
function syncTrafficActivity(data){const items=[...(data.items||[])].filter(item=>item.stageSince).sort((a,b)=>Number(b.stageSince||0)-Number(a.stageSince||0)).slice(0,4);setStableHTML($("trafficActivityList"),items.length?items.map(trafficActivityItem).join(""):'<div class="traffic-panel-empty">ยังไม่มีความเคลื่อนไหว</div>')}
function trafficWaitItem(item,index){const company=queueCompanyView(item);return `<article><span>${index+1}</span><div><b>${esc(item.appointmentNo||"–")}</b><small>${esc(company.primary||"ไม่ระบุบริษัท")}${item.doorCode?` · ${esc(item.doorCode)}`:""}</small></div><time>${esc(visualWaitText(item))}</time></article>`}
function syncTrafficWait(data){const items=[...(data.items||[])].sort((a,b)=>Number(b.elapsedSeconds||0)-Number(a.elapsedSeconds||0)).slice(0,4);setStableHTML($("trafficWaitList"),items.length?items.map(trafficWaitItem).join(""):'<div class="traffic-panel-empty">ไม่มีรถค้างในขั้นตอนปัจจุบัน</div>')}
function syncTrafficControls(){tick();updateSoundButton();updateVideoSoundButton();const source=$("queueHealth"),traffic=$("trafficQueueHealth");if(source&&traffic){setStableText(traffic,source.textContent);traffic.dataset.state=source.dataset.state||"ok"}const full=$("trafficFullButton");if(full)setStableText(full,document.fullscreenElement?"ออกจากเต็มจอ":"เต็มจอ")}
function renderTraffic(data,animate=false){const root=$("queueTrafficView");if(!root)return;ensureTrafficShell(root);root.hidden=false;renderTrafficCall(currentAnnouncement||latestAnnouncement(data));for(const def of TRAFFIC_STAGE_DEFS)syncTrafficStage(data,def,animate);syncTrafficDoors(data);syncTrafficActivity(data);syncTrafficWait(data);syncTrafficControls()}

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
    window.SmartQueueVoice?.clearPending?.();
    audioEnabled=false;
  }
  updateSoundButton();
}

function updateSoundButton(){
  const button=$("soundButton"),visual=$("visualSoundButton"),traffic=$("trafficSoundButton"),available=queueAudioAvailable();
  const apply=(target,compact=false)=>{
    if(!target)return;
    if(!available){target.disabled=true;target.classList.remove("sound-on");target.innerHTML=compact?"เสียงคิวปิด":'<span class="ui-sound-mark off" aria-hidden="true"></span> เสียงคิวปิด';target.title="";return}
    target.disabled=false;target.title="";
    if(audioEnabled){target.classList.add("sound-on");target.innerHTML=compact?"เสียงคิวพร้อม":'<span class="ui-sound-mark on" aria-hidden="true"></span> เสียงคิวพร้อม'}
    else{target.classList.remove("sound-on");target.innerHTML=compact?"เปิดเสียงคิว":'<span class="ui-sound-mark off" aria-hidden="true"></span> เปิดเสียงคิว'}
  };
  apply(button,false);apply(visual,true);apply(traffic,true);
}

function updateVideoSoundButton(){
  const available=queueVideoAudioAvailable(),shown=queueVideoAllowed(queueVideoSettings,currentDisplayMode);
  const apply=(target,compact=false)=>{
    if(!target)return;
    target.hidden=!shown||!available;
    if(target.hidden)return;
    target.disabled=false;
    target.title=videoAudioEnabled?"ปิดเฉพาะเสียงวิดีโอ":"เปิดเฉพาะเสียงวิดีโอ";
    if(videoAudioEnabled){target.classList.add("sound-on");target.innerHTML=compact?"เสียงวิดีโอ":'<span class="ui-sound-mark on" aria-hidden="true"></span> เสียงวิดีโอ'}
    else{target.classList.remove("sound-on");target.innerHTML=compact?"เปิดเสียงวิดีโอ":'<span class="ui-sound-mark off" aria-hidden="true"></span> เปิดเสียงวิดีโอ'}
  };
  apply($("videoSoundButton"),false);apply($("visualVideoSoundButton"),true);apply($("trafficVideoSoundButton"),true);
}

async function toggleSound() {
  const button=$("soundButton");if(!button||!queueAudioAvailable())return;
  if(audioEnabled){
    audioEnabled=false;window.SmartQueueVoice?.clearPending?.();updateSoundButton();return;
  }
  button.disabled=true;button.innerHTML='<span class="ui-sound-mark" aria-hidden="true"></span> กำลังเตรียมเสียงคิว';
  try{
    if(!window.SmartQueueVoice)throw new Error("ไม่พบระบบเสียง");
    window.SmartQueueVoice.configure({...voiceSettings,apiBaseUrl:cfg.apiBaseUrl});
    await window.SmartQueueVoice.unlockAndPrepare();
    if(latestData?.announcementMode!=="CANONICAL")markCurrentCallsSeen();
    audioEnabled=true;updateSoundButton();
    if(voiceSettings?.playDing!==false){queueVideoVoiceDepth++;syncQueueVideoAudioState();try{await window.SmartQueueVoice.playSequence(["ding"])}finally{queueVideoVoiceDepth=Math.max(0,queueVideoVoiceDepth-1);syncQueueVideoAudioState()}}
  }catch(error){
    audioEnabled=false;updateSoundButton();
    setHealth("error","เปิดเสียงคิวไม่สำเร็จ",error?.message||"โหลดเสียงไม่สำเร็จ");
  }finally{button.disabled=!queueAudioAvailable()}
}

async function toggleVideoSound(){
  if(!queueVideoAudioAvailable())return;
  if(videoAudioEnabled){
    videoAudioEnabled=false;saveVideoAudioPreference();syncQueueVideoAudioState();updateVideoSoundButton();return;
  }
  videoAudioEnabled=true;saveVideoAudioPreference();syncQueueVideoAudioState();
  try{
    if(queueVideoActiveElement){queueVideoActiveElement.muted=queueVideoVoiceDepth>0;await queueVideoActiveElement.play()}
    updateVideoSoundButton();
  }catch(error){
    videoAudioEnabled=false;saveVideoAudioPreference();syncQueueVideoAudioState();updateVideoSoundButton();
    if(error?.name!=="NotAllowedError")setHealth("error","เปิดเสียงวิดีโอไม่สำเร็จ",error?.message||"ไม่สามารถเล่นเสียงวิดีโอได้");
  }
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
