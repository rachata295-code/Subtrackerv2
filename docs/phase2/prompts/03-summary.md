# Prompt 03 — สรุปการใช้เงิน (กราฟ)
Branch: `p2/03-summary` · เริ่มหลัง 00 merge · ไฟล์ของคุณ: `src/pages/entries/*`, `src/components/charts/*` (ใหม่)

ใช้ skill `dataviz` ก่อนเขียนกราฟ (ถ้า AGY ไม่มี: อ่าน SPEC §3 แล้วทำตามกฎ token/contrast ของ `PLAN.md`)

ทำ (SPEC §3):
1. `/entries` เพิ่ม SegmentedControl บนสุด `รายการ | สรุป` (state ใน URL `?view=summary` เพื่อกด back ได้) · แท็บรายการเดิมไม่เปลี่ยน
2. แท็บสรุป: เลือกรอบ (ค่าเริ่มต้นรอบปัจจุบัน) · หัว = ยอดใช้รวม + เทียบรอบก่อน · แท่งแนวนอนต่อหมวด (ยอด + %) เรียงมาก→น้อย กดแล้วไปแท็บรายการกรองหมวดนั้น · กราฟแท่งซ้อน 6 รอบ (SVG เอง ไม่เพิ่ม library) กดแท่งเลือกรอบ · บรรทัด "เก็บรอบนี้" และ "ลืมจด" · `<table>` ซ่อนสำหรับ screen reader
3. สีหมวดจาก hue token เดิม · หมวดเกิน 6 รวมเป็น "อื่นๆ" ในกราฟซ้อน
4. Desktop: แท่งแนวนอนซ้าย + กราฟ 6 รอบขวา · mobile เรียงลง · ตัวเลขใช้ `AnimatedMoney`
5. ใช้ `spendingByCategory` / `spendingHistory` จาก domain (ระหว่าง 01 ยังไม่ merge ให้ mock ใน test — ห้ามคำนวณเองในหน้า)
6. Test: render ด้วย mock domain, กดหมวดแล้วกรอง, กดแท่งเปลี่ยนรอบ, empty state (ไม่มีข้อมูล), 375/1280

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
