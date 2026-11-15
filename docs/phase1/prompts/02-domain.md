# Prompt 02 — Domain logic (ฟังก์ชันบริสุทธิ์)
Branch: `p1/02-domain` · เริ่มหลัง 00 merge แล้ว
ไฟล์ของคุณ: `src/domain/**` (แทนที่ stub ใน `src/domain/index.ts` ด้วย re-export จากไฟล์แยกตาม SPEC §4)

ทำ: implement ทุกฟังก์ชันใน SPEC §4 **signature ห้ามเปลี่ยน** · ไม่ import React/Supabase · ทุกฟังก์ชันรับ `today`/`now` เป็นพารามิเตอร์ · คิดเงินเป็น satang integer เท่านั้น
Test ที่ต้องมี (ใช้ `src/fixtures/finance.ts`):
- payPeriod: 15 พ.ย. 2026 payDay 10 → key 2026-11, 10 พ.ย.–9 ธ.ค. · 9 พ.ย. → 2026-10 · payDay 31 ใน ก.พ.
- statementFor ตัวอย่างทุกบรรทัดใน SPEC §4 (บัตร 25 ต.ค./1 พ.ย./3 พ.ย. → 2026-11 due 24 พ.ย. · 10 พ.ย. → 2026-12 · SPayLater พ.ย. → due 10 ธ.ค.)
- subscriptionCharges: billingDay 31 ในเดือน 30 วัน · yearly
- installmentSchedule: 10 งวด วันที่ถูก · งวดสุดท้าย
- billAmount บัตร key 2026-11 = 107700 · SPayLater 2026-11 = 138193
- upcomingOutflows(today 15 พ.ย., 30 วัน): บิลบัตร 24 พ.ย. counted · Gemini 25 พ.ย. / Claude 1 ธ.ค. / iCloud 3 ธ.ค. เป็น charge counted:false · SPayLater ≤10 ธ.ค. dueBy counted · **Σ counted = 245893** · หลังจ่ายบิลบัตรแล้วบิลนั้นหายไป
- potStatus ใช้ตามใจ 2026-11: carryIn 54100, budget 354100, reserved 245893, spent 42000, left 66207 · หลังจ่ายบัตร: reserved 138193, spent 149700, left 66207 (ไม่เปลี่ยน) · กรณีติดลบ over=true และยกยอดติดลบไปรอบหน้า
- installment ที่ potId=null ไม่เข้า pot แต่ยังอยู่ใน billAmount และ upcomingOutflows
- TZ: รัน test ภายใต้ `TZ=UTC` และ `TZ=America/New_York` ได้ผลเท่ากัน (เพิ่ม script `test:tz`)

## กติกาทุก prompt (อ่านก่อนเริ่ม)
- Repo: `~/Developer/subtracker` (GitHub `rachata295-code/Subtrackerv2`) · Stack: Vite 5 + React 18 + TS strict + Tailwind 3 + Vitest + Testing Library · PWA
- **อ่านก่อน:** `docs/phase1/SPEC.md` (สัญญากลาง — ชื่อ type/ฟังก์ชันต้องตรงทุกตัว), `PLAN.md` §5–§7 (design system), `README.md`
- ใช้ components จาก `src/components/ui/*` และ token ใน `src/styles/tokens.css` เท่านั้น · ห้าม hex / arbitrary Tailwind value (`text-[#..]`, `rounded-[..]`) ใน component · animation เฉพาะ transform/opacity · เคารพ prefers-reduced-motion
- **แก้เฉพาะไฟล์ที่ระบุว่าเป็นของคุณ** (SPEC §7) · ต้องการให้ไฟล์ของคนอื่นเปลี่ยน → เขียนไว้ในหัวข้อ "ขอเปลี่ยนสัญญา" ใน PR แทนการแก้เอง
- TDD: เขียน test ที่ล้มก่อน แล้วค่อยเขียนโค้ด
- ก่อน commit: `npx vitest run` (output สะอาด) · `npx tsc --noEmit` · `npm run check:motion` · `npm run build` ต้องผ่านทั้งหมด
- comment อธิบาย "ทำไม" เป็นภาษาอังกฤษ · ข้อความ UI ภาษาไทย
- ทำงานบน branch ของตัวเองจาก `main` ล่าสุด · push แล้วเปิด PR เข้า `main` · **ห้าม merge เอง ห้าม force-push**
- จบงานให้รายงาน: สิ่งที่ทำ · ผล test · ไฟล์ที่แตะ · สิ่งที่ไม่แน่ใจ/ขอเปลี่ยนสัญญา
