# Round 20752 — Cloudflare Version-only procedure

เป้าหมาย: สร้าง Worker R5 เป็น Version ใหม่โดยยังไม่เปลี่ยน Production traffic

## ห้ามทำ
- ห้าม Promote R4/R5 ก่อน smoke test
- ห้าม Split traffic ก่อนตรวจ Version preview
- ห้ามกด Deploy แบบ 100% จาก editor

## วิธีที่ต้องการ
### วิธี A — Dashboard
Cloudflare docs: Edit code -> แก้โค้ด -> ลูกศรข้าง Deploy -> Save เพื่อสร้าง Version โดยไม่ deploy ถ้า UI ใช้งานได้

### วิธี B — Wrangler fallback
ใช้ `wrangler versions upload` กับไฟล์ R5 เพื่อสร้าง Version-only ไม่ใช่ `wrangler deploy`

ตัวอย่าง:
`npx wrangler versions upload warehouse-vehicle-flow-api_v160_candidate_r5_round20751.js --name warehouse-vehicle-flow-api --message "Candidate R5 Round20751 constant-size active-version"`

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
