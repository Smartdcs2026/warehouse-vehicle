# Round 20751 — Worker R5 patch (เตรียมไว้ ยังไม่ Deploy)

ไฟล์นี้เป็น patch plan สำหรับ `worker.js` R4 ที่ตรวจจาก Cloudflare Production editor แล้ว

## 1) เปลี่ยน cache snapshot 15 → 65 วินาที

หา:

```js
const QUEUE_SNAPSHOT_CACHE_SECONDS=15;
```

เปลี่ยนเป็น:

```js
const QUEUE_SNAPSHOT_CACHE_SECONDS=65;
```

คง `QUEUE_SNAPSHOT_FALLBACK_SECONDS=300` และ `ACTIVE_VERSION_MEMORY_SECONDS=4` เดิม

## 2) เปลี่ยน `readActiveVersionData()` ให้ constant-size

แทน function เดิมทั้งหมดด้วย:

```js
async function readActiveVersionData(env,{force=false}={}){
  const now=unix(),cached=activeVersionMemoryCache;
  if(!force&&cached.data&&now-Number(cached.at||0)<ACTIVE_VERSION_MEMORY_SECONDS)return cached.data;
  if(activeVersionInflight)return await activeVersionInflight;
  activeVersionInflight=(async()=>{
    const settingRows=await env.DB.prepare("SELECT setting_key,setting_value,updated_at FROM system_settings WHERE setting_key IN ('queue_recall_settings','appointment_module_settings','queue_display_settings','voice_announcement_settings','queue_runtime_config_version','queue_data_version')").all();
    const calculatedAt=unix(),settings=new Map((settingRows.results||[]).map(row=>[String(row.setting_key||''),row]));
    const queueRecallValue=String(settings.get('queue_recall_settings')?.setting_value||'');
    const appointmentModuleValue=String(settings.get('appointment_module_settings')?.setting_value||'');
    const queueDisplayValue=String(settings.get('queue_display_settings')?.setting_value||'');
    const voiceValue=String(settings.get('voice_announcement_settings')?.setting_value||'');
    const queueConfigVersion=String(settings.get('queue_runtime_config_version')?.setting_value||'');
    const queueDataVersion=String(settings.get('queue_data_version')?.setting_value||'');
    const version=await sha256([queueRecallValue,appointmentModuleValue,queueDisplayValue,voiceValue,queueConfigVersion,queueDataVersion].join('\u001f'));
    const data={success:true,version,optimizedVersionCheck:true,constantSizeVersionCheck:true,queueDataVersioned:true,settingsValueDigest:true,memoryCacheSeconds:ACTIVE_VERSION_MEMORY_SECONDS,workerRevision:WORKER_REVISION};
    activeVersionMemoryCache={at:calculatedAt,data};return data
  })().finally(()=>{activeVersionInflight=null});
  return activeVersionInflight
}
```

ผล: ตัด `COUNT/MAX vehicles`, `MAX(queue_announcements.sequence)` และ `alertTick` ออกจาก hot path

## 3) ให้ queue notice bump data version

ใน `queueNoticeVehicle()` หา:

```js
if(changeCount(results[0])!==1)return reply({success:false,message:"สถานะรถมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่"},409,request,env);
const saved={call_id:callId,auto_id:autoId,call_type:type,reason_code:type,door_code:doorCode,previous_door_code:null,called_at:now};
```

เปลี่ยนเป็น:

```js
if(changeCount(results[0])!==1)return reply({success:false,message:"สถานะรถมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่"},409,request,env);
await bumpQueueDataVersion(env,auth.user,"เรียกเพิ่มเติมหน้าคิว");
const saved={call_id:callId,auto_id:autoId,call_type:type,reason_code:type,door_code:doorCode,previous_door_code:null,called_at:now};
```

## 4) Queue frontend ต้อง refresh Alert ตามเวลาเอง

เมื่อ Worker ไม่มี `alertTick` แล้ว ให้ `queue.js` branch ลด D1 เปลี่ยน:

```js
const SNAPSHOT_MAX_AGE_MS = 300000;
```

เป็น:

```js
const SNAPSHOT_MAX_AGE_MS = 60000;
```

เหตุผล: Alert level/color คำนวณจากเวลาที่ผ่านไป จึงยังต้องมี snapshot ใหม่ประมาณทุก 60 วินาที แต่ไม่ควรบังคับ Operations/Inbound reload ผ่าน active-version

## Expected behavior

- Queue checks version ทุก 5 วินาที แต่ version query อ่าน settings จำนวนคงที่
- Operations/Inbound ไม่ full reload ทุกนาทีเพราะ alert tick อีกต่อไป
- Queue full snapshot เมื่อ data/config เปลี่ยน หรือครบ 60 วินาที
- Snapshot cache 65 วินาทีช่วยให้ 3 จอ reuse snapshot เดียวกันเมื่อ key/cursor ตรงกัน
- Hidden queue tab ยังคงหยุด polling ตาม frontend guard

## ก่อน Deploy

1. สร้าง Worker version ใหม่ ไม่แก้ R4 ทับโดยไม่มี rollback
2. ตรวจ `/api/health/revision`
3. Login + active-version
4. Call / Recall / Door change / Notice ต้องเปลี่ยน version
5. Inbound submit/check/return ต้องเปลี่ยน version
6. Receiving start/complete/reject ต้องเปลี่ยน version
7. Gate sync ที่มี inserted/updated/closed ต้องเปลี่ยน version
8. เปิด Queue 1 จอ 30–60 นาทีและดู D1 Rows Read
9. ผ่านแล้วเปิด 3 จอ 30–60 นาที

**ห้าม Deploy จากเอกสารนี้โดยไม่ตรวจ syntax/source diff อีกครั้ง**
