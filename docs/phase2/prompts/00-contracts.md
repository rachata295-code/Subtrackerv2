# Prompt 00 — สัญญากลางเฟส 2 (ทำก่อน คนเดียว) · **Model: Argon**
Branch: `p2/00-contracts`

เป้าหมาย: วางของกลางตาม SPEC §6 ให้ prompt 01–05 ทำขนานกันได้ ทุกตัวสร้างบนนี้ — ชื่อผิดตัวเดียวพังทั้งเฟส

ทำ:
1. `src/types/finance.ts`: ขยาย `Category` (+ `savings`, `unknown`, `allowance`, `parttime`, `freelance`) · `Transaction` + `createdAt`, `recurringIncomeId`, `incomeDueOn` · `BillPayment` + `createdAt` · type ใหม่ `BalanceCheck`, `PlanItem`, `RecurringIncome` ตาม SPEC §6 เป๊ะ · `FinanceData` + `balanceChecks`, `planItems`, `recurringIncomes` · input types: `CreateBalanceCheckInput`, `UpsertPlanItemInput`, `UpsertRecurringIncomeInput`, `CreateTransactionsInput = CreateTransactionInput[]` · `OUT_CATEGORIES` / `IN_CATEGORIES` + ป้ายภาษาไทย (`CATEGORY_LABELS`) ในไฟล์เดียว
2. SQL: `supabase/migrations/2026-11-16-phase2.sql` (idempotent: `if not exists`, drop/re-add check constraint ของ category) + อัปเดต `supabase/schema.sql` ให้ตรง · ตาราง `balance_checks`, `plan_items`, `recurring_incomes` (RLS `user_id = auth.uid()` ทั้ง select/insert/update/delete, index `user_id`) · `transactions.recurring_income_id uuid null references recurring_incomes on delete set null`, `transactions.income_due_on date null` · (`created_at` มีอยู่แล้วในทุกตาราง — map เข้า type)
3. `src/fixtures/finance.ts`: เพิ่มข้อมูลให้ทุก prompt ทดสอบได้ — RecurringIncome "เงินจากแม่" วันที่ 10 และ 24 (ยอดตัวอย่าง 5,100 ต่อครั้ง) เข้าบัญชี · BalanceCheck เริ่มต้นของบัญชี วันที่ 10 พ.ย. 2026 · PlanItem 2 อัน (pay "ค่าหอ" 1,500 · save "เก็บ" 2,000) รอบ '2026-11' · transactions ซ้ำๆ ให้ hot bar มีของ (ข้าวมันไก่ 45 ×3, ชานม 85 ×2) · `createdAt` ทุกแถว · test เดิมต้องผ่าน (ตัวเลขเฟส 1 เช่น left 662.07 ห้ามเปลี่ยน)
4. Domain stubs ใน `src/domain/index.ts` (+ ไฟล์ว่าง `src/domain/{spending,hotbar,expression,balance,forecast,income}.ts`) ตาม signature SPEC §6 เป๊ะ body `throw new Error('not implemented: <name>')` · type ผลลัพธ์ทุกตัว export (เช่น `Forecast`, `ForecastEvent`, `HotbarItem`, `CategorySpend`)
5. Repo/hook **signature + stub**: `src/data/financeRepo.ts` (`createTransactions`, `createBalanceCheck`, `upsertPlanItem`, `deletePlanItem`, `completePlanItem`, `uncompletePlanItem`, `upsertRecurringIncome`, `deleteRecurringIncome`, `confirmIncome`) และ hooks คู่กันใน `src/hooks/useFinance.ts` (`useCreateTransactions`, …) · fixture mode ทำงานได้จริง (in-memory) เพื่อให้ prompt UI ทดสอบได้ · `loadFinanceData` โหลด 3 ตารางใหม่ (prompt 02 เติม mapping จริง)
6. Route `/plan` (`src/pages/plan/index.tsx` placeholder h1 "แผน") · `navItems.ts` เป็น 5 ข้อ: ภาพรวม · รายการ · แผน · บิล & ผ่อน · ตั้งค่า (ไอคอน lucide `Target` หรือใกล้เคียง) · ตรวจ TabBar ที่ 375 ไม่ล้น
7. Test: type-check fixtures, route render, nav 5 ข้อ, migration SQL มีทุกตาราง/คอลัมน์ (อ่านไฟล์เป็น string)

เสร็จเมื่อ: PR เปิดแล้ว · เจ้าของ merge แล้ว 01–05 จึงเริ่ม · **ก่อนใช้จริง เจ้าของต้องรัน migration ใน Supabase SQL Editor**

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
