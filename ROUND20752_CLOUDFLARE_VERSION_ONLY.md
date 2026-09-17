# Round 20752 — Cloudflare Version-only procedure

เป้าหมาย: สร้าง Worker R5 เป็น Version ใหม่โดยยังไม่เปลี่ยน Production traffic

## ห้ามทำ
- ห้าม Promote R4/R5 ก่อน smoke test
- ห้าม Split traffic ก่อนตรวจ Version preview
- ห้ามกด Deploy แบบ 100% จาก editor

## วิธีที่ต้องการ
### วิธี A — Dashboard
Cloudflare docs: Edit code -> แก้โค้ด -> ลูกศรข้าง Deploy -> Save เพื่อสร้าง Version โดยไม่ deploy ถ้า UI ใช้งานได้

### วิธี B — API/Wrangler fallback
ถ้า Dashboard Save ใช้ไม่ได้ ต้องรักษา Bindings ของ Worker เดิมให้ครบก่อนสร้าง R5 version เพราะ Version เก็บทั้ง code, bindings และ compatibility settings

ก่อน upload ให้ตรวจหน้า Cloudflare > Worker > Bindings และจดชื่อ bindings ที่ใช้งานจริง โดย source R5 อ้างชื่อที่เป็นไปได้ เช่น `DB`, `VOICE_BUCKET`, `QUEUE_MEDIA_BUCKET`, `ARCHIVE_BUCKET`, `SYNC_SECRET`, `ALLOWED_ORIGINS`, `TRACKING_TOKEN_SECRET` และ optional appointment/secondary DB bindings

Cloudflare Version Upload API รองรับ binding ชนิด `inherit` และ `bindings_inherit=strict` เพื่อให้ version ใหม่ inherit binding จาก version ก่อนหน้าและ fail แทนการสร้าง version ที่ binding ขาด

ไม่ควรใช้คำสั่ง upload แบบไม่มี binding/config จนกว่าจะยืนยัน bindings จริงของ Worker นี้

## หลัง Upload สำเร็จ
1. Version ใหม่ต้องปรากฏใน Version History แต่ Active deployment เดิมยัง 100%
2. เปิด Preview URL ของ Version นั้น
3. GET `/api/health/revision` ต้องแสดง `d1-free-plan-v160-candidate-20260917-r5`
4. ทดสอบ login และ `/api/vehicles/active-version`
5. idle เกิน 60 วินาที version ต้องไม่เปลี่ยนเอง
6. ทดสอบ queue call / recall / notice, Inbound, Receiving และ Gate sync
7. ตรวจ D1 Rows Read/observability
8. ผ่านแล้ว Queue pilot 1 จอ 30–60 นาที
9. ผ่านแล้ว Queue 3 จอ 30–60 นาที
10. ยังไม่ Merge GitHub `main` จน Worker + frontend ผ่าน UAT

## Rollback
Production เดิมไม่ถูกแตะในขั้น Version-only จึง rollback หลักคือหยุดใช้ Preview/R5 และคง Active deployment เดิม 100%
