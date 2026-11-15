# Prompt 01 — Domain เฟส 2 (ตรรกะเงินทั้งหมด) · **Model: Argon**
Branch: `p2/01-domain` · เริ่มหลัง 00 merge · ไฟล์ของคุณ: `src/domain/{spending,hotbar,expression,balance,forecast,income}.ts` + test ของแต่ละไฟล์ + `src/domain/index.ts` (เฉพาะแทน stub)

ตัวเลขผิด = เจ้าของเลิกเชื่อแอป · ทุกกฎใน SPEC §3, §4, §5 ต้องมี test ที่อ้างหัวข้อ SPEC ในชื่อ test

ทำ (pure functions เท่านั้น ห้าม import React/Supabase):
1. `evaluateAmountExpression(text)` (SPEC §4 B1): `45+60+35` → 14000 · `1,200+45.50` → 124550 · `120-15` / `120−15` (U+2212) → 10500 · `45+` → error ไม่ throw · ผล ≤ 0 → error "ยอดต้องมากกว่า 0" · ใช้ `parseAmount` เดิมต่อตัวเลข · ไม่รับ × ÷ วงเล็บ
2. `spendingByCategory(data, periodKey)` + `spendingHistory(data, periodKey, n)` (SPEC §3): นับ tx out ตามหมวด + subscription charge (`subscription`) + installment charge (`installment`) ตาม `payPeriod(chargeDate)` · ไม่นับ BillPayment · `savings` แยกออกมาเป็น `saved` · `unknown` นับ · test: รอบ '2026-11' ของ fixtures ยอดต่อหมวดคำนวณมือแล้วตรง · ไม่มี subscription ถูกนับสองครั้ง
3. `hotbarItems(data, today, limit=8)` (SPEC §4 B3): 60 วัน, กลุ่ม (note normalize, amount, category, sourceId, potId), ≥ 2 ครั้ง, เรียงจำนวนครั้ง → ล่าสุด · test: ข้าวมันไก่ 45 มาก่อนชานม 85
4. `expectedBalance(sourceId, data)` (SPEC §5 C2): กฎ "อยู่หลังจุดอ้างอิง" รวมกรณี date = checkedOn เทียบ createdAt · BillPayment ผ่าน `payFromSourceId` · ไม่มีจุดอ้างอิง → `null` · test ทุกกรณีใน C2 (เช้าเช็ก/บ่ายซื้อ, จดย้อนหลังก่อนจุดเช็ก, tx ส่วนต่าง unknown ไม่นับซ้ำ, หลายเช็กวันเดียวกันใช้ล่าสุด)
5. `pendingIncomes(data, today)` (SPEC §5 C7): RecurringIncome ที่ถึงวัน (`dayOfMonth` เกิน → วันสุดท้าย) ในรอบที่ยังไม่มี tx ผูก `recurringIncomeId` + `incomeDueOn` นั้น · test: วันที่ 24 ยังไม่กด → ขึ้น · กดแล้ว → หาย · 31 ในเดือน 30 วัน
6. `forecast(data, sourceId, today)` (SPEC §5 C5): `start` (expectedBalance) + `incoming` (RecurringIncome ที่ยังไม่รับถึงสิ้นรอบ) − `bills` (เฉพาะส่วนที่ไม่อยู่ในก้อน, จ่ายจากบัญชีนี้, ยังไม่จ่าย, due ในช่วง) − `plans` (PlanItem รอบนี้ยังไม่ทำ, บัญชีนี้) − `potsLeft` (Σ max(0, potStatus.left)) = `available` · `timeline` เรียงวัน เงินออกก่อนเงินเข้าวันเดียวกัน · `low` = จุดต่ำสุด · **test สำคัญ:** บิลบัตร 1,077 ที่อยู่ในก้อนใช้ตามใจ ไม่ถูกหักทั้งใน bills และ potsLeft · ผ่อนที่ potId = null ถูกหักใน bills · รายได้ parttime ในอนาคตไม่ถูกนับ
7. `npm run test:tz` ต้องผ่าน (UTC และ New York)

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
