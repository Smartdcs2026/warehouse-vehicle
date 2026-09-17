# Round 20752 — Cloudflare Version-only procedure

เป้าหมาย: สร้าง Worker R5 เป็น Version ใหม่โดยยังไม่เปลี่ยน Production traffic

## ห้ามทำ
- ห้าม Promote R4/R5 ก่อน smoke test
- ห้าม Split traffic ก่อนตรวจ Version preview
- ห้ามกด Deploy แบบ 100% จาก editor

## สถานะอ้างอิง
หน้า Deployments แสดงแนวคิด Version แยกจาก Deployment และ Production เดิมต้องคง 100% ระหว่างเตรียม R5

## วิธีที่ต้องการ
### วิธี A — Dashboard
Cloudflare docs: Edit code -> แก้โค้ด -> ลูกศรข้าง Deploy -> Save เพื่อสร้าง Version โดยไม่ deploy ถ้า UI ใช้งานได้

### วิธี B — Wrangler (fallback ที่ชัดเจนกว่า)
ใช้ `wrangler versions upload` กับไฟล์ R5 เพื่อสร้าง Version-only ไม่ใช่ `wrangler deploy`

หลักการคำสั่ง:
`npx wrangler versions upload <R5_FILE> --name warehouse-vehicle-flow-api --message "Candidate R5 Round20751 constant-size active-version"`

ต้องใช้ account/login ที่มีสิทธิ์ Editor ของ Worker และต้องรักษา bindings/config ของ Worker ให้ตรงกับ version เดิมก่อนใช้จริง

## หลัง Upload สำเร็จ
1. ยืนยัน Version ใหม่ปรากฏใน Deployments / Version History และยังไม่เป็น Active deployment
2. เปิด Preview URL ของ Version นั้น
3. GET `/api/health/revision` ต้องแสดง `d1-free-plan-v160-candidate-20260917-r5`
4. ทดสอบ login และ `/api/vehicles/active-version`
5. ทดสอบ queue call / recall / notice แล้วตรวจว่า version เปลี่ยนเมื่อข้อมูลเปลี่ยน
6. ปล่อย idle เกิน 60 วินาทีแล้ว active-version ต้องไม่เปลี่ยนเอง
7. ตรวจ D1 Rows Read/observability
8. ผ่านแล้วจึง Queue pilot 1 จอ 30–60 นาที
9. ผ่านแล้วจึง 3 จอ 30–60 นาที
10. ยังไม่ Merge GitHub `main` จน Worker + frontend ผ่าน UAT

## Rollback
Production เดิมไม่ถูกแตะในขั้น Version-only จึง rollback หลักคือหยุดใช้ Preview/R5 และคง Active deployment เดิม 100%
