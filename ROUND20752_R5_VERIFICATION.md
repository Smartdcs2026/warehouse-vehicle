# Round 20752 — Worker R5 verification

ตรวจเทียบ source R4 ที่คัดลอกจาก Cloudflare Production editor กับ Candidate R5 แบบ line-by-line หลัง normalize line endings แล้ว

## ผลตรวจ
- `node --check warehouse-vehicle-flow-api_v160_candidate_r5_round20751.js` = PASS
- SHA-256 Worker R5 = `9067349c2fa066a473321121d395591612b2792d50e374d677a97dfad96ceb20`
- ความต่าง R4 -> R5 มีเฉพาะจุดที่ตั้งใจแก้เรื่อง D1 hot path และ revision metadata

## การเปลี่ยนแปลงที่ยืนยันแล้ว
1. `BUILD_VERSION` -> `2026.09.17-round207.51-d1-constant-version`
2. `WORKER_REVISION` -> `d1-free-plan-v160-candidate-20260917-r5`
3. `QUEUE_SNAPSHOT_CACHE_SECONDS` 15 -> 65
4. `/api/health` เพิ่ม `activeVersionConstantSize:true`
5. `queueNoticeVehicle()` เรียก `bumpQueueDataVersion(...)` หลังบันทึกสำเร็จ
6. `readActiveVersionData()` ตัด `COUNT/MAX` active vehicles ออกจาก hot path
7. `readActiveVersionData()` ตัด `MAX(queue_announcements.sequence)` ออกจาก hot path
8. `readActiveVersionData()` ตัด `alertTick` ที่เคยเปลี่ยน version ตามเวลา
9. version ใหม่คำนวณจาก system settings/runtime version 6 keys เท่านั้น

## สิ่งที่ไม่ได้เปลี่ยน
- Workflow Inbound / Receiving logic
- Gate sync transaction logic ยกเว้นยังคง bump version หลังข้อมูลเปลี่ยน
- Authentication / session policy
- Dashboard / Datatable backend
- Queue media / voice / R2 behavior
- D1 schema ไม่มี migration ใหม่ใน R5

## Cloudflare state ที่ต้องรักษาระหว่างทดสอบ
- Production เดิมต้องคงรับ traffic 100%
- Candidate R3/R4 ที่เป็น version-only ห้าม Promote
- R5 ต้องสร้างเป็น Version-only ก่อน และทดสอบผ่าน Preview URL / version target ก่อนสร้าง deployment

## Gate ก่อน Queue pilot
ต้องผ่าน `/api/health/revision`, login, active-version, queue call/recall/notice, inbound, receiving, gate sync และดู D1 rows_read ก่อนเปิด Queue pilot 1 จอ 30–60 นาที
