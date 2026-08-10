"use strict";

const cfg = window.APP_CONFIG || {};
const POLL_MS = 5000;
const FETCH_TIMEOUT_MS = 4500;
const ROTATE_MS = 10000;
const CALL_HOLD_MS = 20000;
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
let workPages = {
  RECEIVING_IN_PROGRESS: 0,
  WAITING_DOCUMENT_RETURN: 0,
  WAITING_GATE_OUT: 0
};

const $ = id => document.getElementById(id);

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

    const response = await fetch(base + "/api/public/queue", {
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

  const calling = raw.calling && typeof raw.calling === "object" ? normalizeItem(raw.calling) : null;
  const noticeCalling = raw.noticeCalling && typeof raw.noticeCalling === "object" ? normalizeItem(raw.noticeCalling) : null;
  const counts = raw.counts && typeof raw.counts === "object" ? raw.counts : {};

  const recentCalls = Array.isArray(raw.recentCalls)
    ? raw.recentCalls.filter(item => item && typeof item === "object").map(normalizeItem).sort((a,b)=>(a.calledAt||0)-(b.calledAt||0))
    : (calling ? [calling] : []);
  const recentNotices = Array.isArray(raw.recentNotices)
    ? raw.recentNotices.filter(item => item && typeof item === "object").map(normalizeItem).sort((a,b)=>(a.calledAt||0)-(b.calledAt||0))
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
    items,
    counts: {
      READY_FOR_RECEIVING: safeCount(counts.READY_FOR_RECEIVING, items, "READY_FOR_RECEIVING"),
      RECEIVING_IN_PROGRESS: safeCount(counts.RECEIVING_IN_PROGRESS, items, "RECEIVING_IN_PROGRESS"),
      WAITING_DOCUMENT_RETURN: safeCount(counts.WAITING_DOCUMENT_RETURN, items, "WAITING_DOCUMENT_RETURN"),
      WAITING_GATE_OUT: safeCount(counts.WAITING_GATE_OUT, items, "WAITING_GATE_OUT")
    }
  };
}

function normalizeItem(item) {
  return {
    ...item,
    autoId: cleanText(item.autoId),
    callId: cleanText(item.callId),
    callType: cleanText(item.callType),
    reasonCode: cleanText(item.reasonCode),
    noticeLabel: cleanText(item.noticeLabel),
    callCount: Math.max(0, Number(item.callCount) || 0),
    calledAt: Number(item.calledAt) || 0,
    previousDoorCode: cleanText(item.previousDoorCode),
    appointmentNo: cleanText(item.appointmentNo),
    companyName: cleanText(item.companyName),
    vehiclePlate: cleanText(item.vehiclePlate),
    province: cleanText(item.province),
    doorCode: cleanText(item.doorCode),
    useDoor: item.useDoor !== false,
    status: cleanText(item.status),
    elapsedSeconds: Math.max(0, Number(item.elapsedSeconds) || 0),
    stageSince: Number(item.stageSince) || 0,
    receivingStartedAt: Number(item.receivingStartedAt) || 0
  };
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function safeCount(value, items, status) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return items.filter(item => item.status === status).length;
}

function render(data) {
  syncVoiceSettings(data.voice);
  const announcement=latestAnnouncement(data);
  renderCall(announcement);
  renderSummary(data);
  renderNext(data);
  renderWork(data);
  processVoiceCalls(data);
  if ($("updatedAt")) $("updatedAt").textContent = "อัปเดตล่าสุด " + formatTime(data.generatedAt);
}

function latestAnnouncement(data){
  const call=data?.calling||null,notice=data?.noticeCalling||null;
  if(!call)return notice;if(!notice)return call;
  return Number(notice.calledAt||0)>=Number(call.calledAt||0)?notice:call;
}

function renderUnavailable() {
  renderCall(null);
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

  $("summaryCards").innerHTML = defs
    .map(
      ([icon, label, n, tone]) =>
        `<article class="summary-${tone}"><span class="summary-icon">${icon}</span><small>${label}</small><b>${Number(n).toLocaleString("th-TH")}</b><em>คัน</em></article>`
    )
    .join("");
}

function renderCall(item) {
  const panel = $("callPanel");
  const num = $("callNumber");

  if (!item || !item.appointmentNo) {
    panel.classList.add("idle");
    num.textContent = "รอการเรียกคิว";
    fitAppointmentNumber(num, "รอการเรียกคิว");
    $("callCompany").textContent = "–";
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
  $("callCompany").textContent = item.companyName || "ไม่ระบุบริษัท";
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
  $("nextPageLabel").textContent = items.length
    ? pages > 1
      ? `หน้า ${nextPage + 1}/${pages} · ${items.length} คัน`
      : `${items.length} คัน`
    : "ไม่มีรายการรอ";

  const list = $("nextQueue");
  list.innerHTML = shown.length
    ? shown.map(nextItem).join("")
    : '<div class="queue-empty">ไม่มีรถรอเข้าตรวจรับสินค้า</div>';

  if (animate) fadePage(list);
  $("rotationLabel").textContent = pages > 1 ? `รอเข้าตรวจรับสินค้า ${nextPage + 1}/${pages}` : "";
}

function nextItem(item) {
  const called=Number(item.calledAt||0)>0,count=Math.max(1,Number(item.callCount||1));
  const callLabel=!called?shortDuration(item.elapsedSeconds):item.callType==="DOOR_CHANGED"?`เปลี่ยนประตู · ครั้งที่ ${count}`:item.callType==="RECALL"?`เรียกซ้ำครั้งที่ ${count}`:`เรียกแล้ว ${count} ครั้ง`;
  const doorBadge=item.doorCode
    ? `<span class="next-door-badge" title="ประตู ${esc(item.doorCode)}">${esc(item.doorCode)}</span>`
    : `<span class="next-door-badge is-placeholder" title="ยังไม่ระบุประตู">ประตู</span>`;
  return `<article class="next-item ${called?"is-called":""}"><div class="next-appt">${esc(item.appointmentNo || "–")}</div><div class="next-company">${esc(item.companyName || "ไม่ระบุบริษัท")}</div><div class="next-plate">${esc(item.vehiclePlate || "–")}</div><div class="next-province">${esc(item.province || "–")}</div><div class="next-status"><span>${esc(callLabel)}</span>${doorBadge}</div></article>`;
}

function renderWork(data, animate = false) {
  const all = data.items || [];
  const defs = [
    ["กำลังตรวจรับสินค้า", "RECEIVING_IN_PROGRESS", "progress"],
    ["รอรับเอกสารคืน", "WAITING_DOCUMENT_RETURN", "return"],
    ["รอออกจากพื้นที่", "WAITING_GATE_OUT", "out"]
  ];

  let total = 0;
  $("workGroups").innerHTML = defs
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

  if (animate) fadePage($("workGroups"));
  $("workCount").textContent = `${total.toLocaleString("th-TH")} คัน`;
}

function workItem(item) {
  return `<article class="work-item"><b>${esc(item.appointmentNo || "–")}</b><span class="work-company">${esc(
    item.companyName || "ไม่ระบุบริษัท"
  )}</span><small>${esc(plateText(item))}${item.doorCode ? ` · ประตู ${esc(item.doorCode)}` : ""}</small></article>`;
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

  renderNext(latestData, true);
  renderWork(latestData, true);
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
    markCurrentCallsSeen();
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
