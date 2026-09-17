# Round 20751 — review Worker R4 ที่ใช้งานอยู่

แหล่งตรวจ: source `worker.js` จาก Cloudflare Production editor ที่ผู้ใช้ส่งมาเมื่อ 17/09/2026 และระบุ `WORKER_REVISION="d1-free-plan-v159-candidate-20260916-r4"`.

## สิ่งที่ R4 ทำได้ดีแล้ว

- `/api/vehicles/active-version` ไม่อ่าน `workflow_events` หรือ `queue_calls` ทั้งประวัติแบบรุ่นเก่าแล้ว
- มี memory cache 4 วินาทีและ in-flight dedupe สำหรับ active version
- มี persisted settings `queue_data_version` และ `queue_runtime_config_version`
- Queue snapshot ใช้ Cloudflare Cache API, cache ปกติ 15 วินาที, fallback 300 วินาที
- Queue snapshot มี in-flight dedupe และตรวจ version ซ้ำหลังประกอบ snapshot; ถ้า version เปลี่ยนจะตอบ 409 แทนการ cache ข้อมูลเก่า
- mutation หลักหลายจุด bump `queue_data_version`: Gate sync, exclude/restore, submit/check/return document, queue call, receiving start/complete/reject
- config หลัก workflow/doors/alerts bump `queue_runtime_config_version`

## จุดที่ยังทำให้ D1 ถูกอ่านเกินจำเป็น

### 1. active-version ยัง aggregate ทุกครั้งที่ cache 4 วินาทีหมด

ปัจจุบัน `readActiveVersionData()` ทำ 3 query:

1. `COUNT(*)` + `MAX(updated_at)` ของรถ active
2. `MAX(sequence)` จาก `queue_announcements`
3. อ่าน system settings 6 keys

ดังนั้นยังไม่ใช่ constant-size hot path เต็มรูปแบบ หาก index ของรถไม่ตรง query ค่า Rows Read สามารถโตตามข้อมูลได้

### 2. `alertTick` อยู่ใน active version

`alertTick=Math.floor(calculatedAt/60)` ทำให้ version เปลี่ยนทุก 60 วินาที แม้ไม่มีรถหรือ config เปลี่ยน

ผลคือ Queue ต้องโหลด snapshot ใหม่ทุกนาที และเพราะ Operations/Inbound ใช้ endpoint เดียวกัน ทั้งสองหน้าก็อาจ full reload ทุกนาทีโดยไม่จำเป็น

### 3. queue notice ยังไม่ bump `queue_data_version`

`queueNoticeVehicle()` เขียน `queue_calls`/`queue_announcements` แล้วตอบกลับทันที แต่ไม่มี `bumpQueueDataVersion()` ดังนั้น R4 ต้องพึ่ง `MAX(queue_announcements.sequence)` เพื่อจับการเปลี่ยนแปลงนี้

## Target R5 ที่แนะนำ

ใช้ persisted version ที่มีอยู่แล้วให้เต็มรูปแบบ โดยไม่เพิ่ม schema ใหม่:

1. `readActiveVersionData()` อ่านเฉพาะ system settings keys ที่จำเป็น (`queue_data_version`, `queue_runtime_config_version`, queue recall/display/voice/appointment settings)
2. ตัด `COUNT/MAX vehicles` ออกจาก version hot path
3. ตัด `MAX(queue_announcements.sequence)` ออกจาก version hot path
4. เพิ่ม `await bumpQueueDataVersion(env,auth.user,"เรียกเพิ่มเติมหน้าคิว")` หลัง `queueNoticeVehicle()` สำเร็จ
5. เอา `alertTick` ออกจาก active version เพื่อไม่ให้ Operations/Inbound reload ทุกนาที
6. ให้ Queue frontend refresh snapshot ตามเวลาเองทุก 60 วินาทีเพื่อคำนวณ Alert ใหม่
7. เพิ่ม Worker queue snapshot cache จาก 15 วินาทีเป็นประมาณ 65 วินาที เพื่อให้จอคิว 3 จอ reuse snapshot เดียวกันในรอบเวลาเดียวกัน; เมื่อ data version เปลี่ยน key ใหม่จะ bypass cache เดิมทันที
8. คง fallback snapshot 300 วินาที

## ทำไมแนวนี้ปลอดภัยกว่า

- active-version กลายเป็น query ขนาดคงที่ ไม่โตตามจำนวนรถย้อนหลัง
- Operations/Inbound โหลดข้อมูลเต็มเฉพาะเมื่อข้อมูลจริงเปลี่ยน
- Queue ยังอัปเดต Alert ตามเวลาได้ทุก 60 วินาที
- Queue 3 จอมีโอกาสใช้ snapshot เดียวกันมากขึ้น
- ไม่ต้อง migration ตารางใหม่

## สิ่งที่ยังต้องวัดก่อน Production

- D1 `rows_read` ของ version check หลังแก้
- D1 `rows_read` ของ queue snapshot 1 ครั้ง
- ทดสอบ Queue 1 จอ 30–60 นาที
- แล้วทดสอบ 3 จอ 30–60 นาที
- ทดสอบ call / recall / door change / notice / receiving start-complete-reject / Gate sync ว่า version เปลี่ยนทันที

## สถานะ

R4 source verification: **ผ่านการตรวจ source**

R4 พร้อมใช้เป็น final D1 design: **ยังไม่ผ่าน** เพราะ active-version ยัง aggregate รถ/announcement และมี time tick

Production action: **ยังไม่ Deploy/แก้ Cloudflare จาก branch นี้**
