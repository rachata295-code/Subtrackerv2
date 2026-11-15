# Prompt 02 — Data layer เฟส 2
Branch: `p2/02-data` · เริ่มหลัง 00 merge · ไฟล์ของคุณ: `src/data/*`, `src/hooks/useFinance.ts` (+ test)

ทำ:
1. Mapping row ↔ type ของ `balance_checks`, `plan_items`, `recurring_incomes` + คอลัมน์ใหม่ของ `transactions`/`bill_payments` (`created_at` → `createdAt`, numeric ↔ satang ใช้ helper เดิม)
2. `loadFinanceData` โหลด 3 ตารางใหม่พร้อมกัน (Promise.all เดิม) · error ข้อความไทยแบบเดิม
3. Mutations (Supabase จริง + fixture mode in-memory ให้พฤติกรรมเหมือนกัน):
   - `createTransactions(inputs)` — insert array ครั้งเดียว (atomic ระดับ request) · ว่าง → no-op
   - `createBalanceCheck({sourceId, actual, expectedBefore, adjustment})` — ถ้ามี adjustment: สร้าง tx `unknown` (date = checkedOn) **ก่อน** แล้วสร้างแถว check ผูก `adjustmentTxId` · แถวที่สองล้ม → ลบ tx ที่เพิ่งสร้าง (rollback เอง) แล้ว throw
   - `upsertPlanItem`, `deletePlanItem` · `completePlanItem(id)` — สร้าง tx out (save → `savings`, pay → category ของ item, potId null, date วันนี้) แล้วตั้ง `doneTxId` (rollback แบบเดียวกัน) · `uncompletePlanItem(id)` — ลบ tx แล้วตั้ง `doneTxId = null`
   - `upsertRecurringIncome`, `deleteRecurringIncome` · `confirmIncome({recurringIncomeId, incomeDueOn, amount, date})` — tx `in` หมวด `allowance`
4. Hooks คู่กันทุกตัว · invalidate `FINANCE_QUERY_KEY` · optimistic update สำหรับ `createTransactions` (hot bar ต้องรู้สึกทันที) พร้อม rollback เมื่อ error
5. Test: mapping round-trip, rollback ของ createBalanceCheck/completePlanItem (mock client ให้ล้มครั้งที่สอง), fixture mode ทำงานเหมือน Supabase

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
