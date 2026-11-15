# Prompt 05 — หน้าแผน · เช็กยอด · เงินเข้า
Branch: `p2/05-plan` · เริ่มหลัง 00 merge · ไฟล์ของคุณ: `src/pages/plan/*`, `src/pages/settings/*` (เฉพาะ section "เงินประจำ" ใหม่), `src/components/IncomeDueCard.tsx`, `src/components/AvailableCard.tsx` (ใหม่) (+ test) · ขอวางการ์ดในภาพรวม: เพิ่มบรรทัด import + วาง 2 การ์ดบนสุดของ `src/pages/overview/index.tsx` (บรรทัดเดียวต่อการ์ด — แจ้งใน PR เพราะ 04 แตะไฟล์นี้ด้วย)

ทำ (SPEC §5):
1. `/plan` บนลงล่าง: เลือกบัญชี (ถ้ามี bank > 1) · การ์ดบัญชี "ในแอปควรเหลือ ฿X · เช็กล่าสุด N วันก่อน" + ปุ่ม "เช็กกับยอดจริง" (ไม่มีจุดอ้างอิง → "ตั้งยอดเริ่มต้น") · การ์ด **ใช้ได้จริง** ตามสูตร C5 ทุกบรรทัด + ไทม์ไลน์ + จุดต่ำสุด (ติดลบ = สีเตือน) · แผนรอบนี้ (PlanItem + บิลอัตโนมัติป้าย "บิล") · ประวัติเช็กยอด
2. Sheet เช็กยอด (C3): ช่องยอดจริง (คิดเลขได้) → ตรง / หายไป (+ HotBar จาก prompt 04 ถ้า merge แล้ว ไม่งั้นปุ่มเปิด QuickAddSheet + 5 รายการล่าสุด) / เกินมา (+ ปุ่มจดเงินเข้า) · ส่วนต่างอัปเดตสดเมื่อจดเพิ่ม · ปุ่ม "บันทึกส่วนต่างเป็น ลืมจด" / "แค่บันทึกยอด" → `createBalanceCheck`
3. แผน (C4): เพิ่ม/แก้/ลบ PlanItem (บัญชีธนาคารเท่านั้น, เตือนชื่อซ้ำบิล) · กด "จ่ายแล้ว"/"เก็บแล้ว" → `completePlanItem` · ยกเลิก → `uncompletePlanItem` · "ใช้แผนรอบก่อน" · `AnimatedRow` + toast
4. `IncomeDueCard` (C7): จาก `pendingIncomes` · "เงินจากแม่เข้าแล้ว? ฿X" → กด = `confirmIncome` (แก้ยอด/วันได้ผ่าน sheet) · "ยังไม่เข้า" ซ่อนถึงพรุ่งนี้ (localStorage ห่อ try/catch)
5. `AvailableCard` (C6): "ใช้ได้จริง ฿X · เช็กยอด N วันก่อน" + ป้าย "ถึงเวลาเช็กยอดแล้ว" > 7 วัน → ลิงก์ `/plan`
6. ตั้งค่า: section "เงินประจำ" เพิ่ม/แก้/ลบ RecurringIncome (ชื่อ, ยอด, วันที่, บัญชี)
7. ทุกตัวเลขมาจาก domain (`expectedBalance`, `forecast`, `pendingIncomes`) — ห้ามคำนวณในหน้า · ระหว่าง 01 ยังไม่ merge ให้ mock ใน test
8. Desktop: การ์ดบัญชี + ใช้ได้จริง ซ้าย · แผน + ไทม์ไลน์ ขวา · Test: flow เช็กยอดทั้ง 3 กรณี, complete/uncomplete, income card, 375/1280

## กติกาทุก prompt (อ่านก่อนเริ่ม)
- Repo: `~/Developer/subtracker` (GitHub `rachata295-code/Subtrackerv2`) · Stack: Vite 5 + React 18 + TS strict + Tailwind 3 + Vitest + Testing Library · TanStack Query · Supabase · Vaul · sonner · PWA
- **อ่านก่อน:** `docs/phase2/SPEC.md` (สัญญาเฟสนี้ — ชื่อ type/ฟังก์ชัน/ตารางต้องตรงเป๊ะ) · `docs/phase1/SPEC.md` §3–§5 (โมเดล/domain เดิม) · `docs/phase1_5/SPEC.md` (responsive) · `PLAN.md` §5–§7 (design system + motion)
- เงินเป็น satang integer ใน domain/UI · วันที่ Asia/Bangkok · domain รับ `today` เป็นพารามิเตอร์ (ห้ามเรียก `new Date()` ใน domain)
- ใช้ components จาก `src/components/ui/*` และ token เท่านั้น · ห้าม hex / arbitrary Tailwind value (ยกเว้น `grid-cols-[...]`) · animation เฉพาะ transform/opacity + reduced-motion · ไม่มี animation ตอนเปลี่ยนแท็บ/route/breakpoint
- Responsive ตาม `docs/phase1_5/SPEC.md` (375 / 768 / 1280) · มือถือมาก่อน
- **แก้เฉพาะไฟล์ของคุณ** (ตารางใน prompt) · ต้องการให้ไฟล์ของคนอื่นเปลี่ยน → เขียนในหัวข้อ "ขอเปลี่ยนสัญญา" ใน PR
- TDD: test ที่ล้มก่อน แล้วค่อยเขียนโค้ด · ตัวเลขใน test ใช้ fixtures จาก `src/fixtures/finance.ts`
- ก่อน commit: `npx vitest run` (output สะอาด) · `npm run test:tz` · `npx tsc --noEmit` · `npm run check:motion` · `npm run build` ผ่านทั้งหมด
- ภาพหน้าจอ (ถ้าแตะ UI): `VITE_USE_FIXTURES=1 npm run dev` ที่ 375 และ 1280 แนบใน PR
- comment อธิบาย "ทำไม" เป็นภาษาอังกฤษ · ข้อความ UI ภาษาไทย · โค้ดใหม่มี error handling (repo/mutation ล้ม → toast error ภาษาไทย ไม่ crash)
- branch ของตัวเองจาก `main` ล่าสุด · push แล้วเปิด PR เข้า `main` · **ห้าม merge เอง ห้าม force-push**
- จบงานรายงาน: สิ่งที่ทำ · ผล test · ไฟล์ที่แตะ · สิ่งที่ไม่แน่ใจ/ขอเปลี่ยนสัญญา
