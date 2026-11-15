# Prompt 01 — Supabase schema + data layer
Branch: `p1/01-data` · เริ่มหลัง 00 merge แล้ว
ไฟล์ของคุณ: `supabase/**`, `src/lib/supabase.ts`, `src/data/**`, `src/hooks/useFinance.ts` (แทน body stub — **ห้ามเปลี่ยน signature**), `.env.example`

ทำ:
1. `supabase/schema.sql` — ตารางตาม SPEC §3 (snake_case): settings, payment_sources, pots, subscriptions, installments, transactions, bill_payments · ทุกตารางมี `user_id uuid not null default auth.uid() references auth.users` · เงิน `numeric(12,2)` + check > 0 ตามสมควร · enum ด้วย check constraint · index ที่ date/source · **RLS เปิดทุกตาราง** 4 policy (select/insert/update/delete) `using (user_id = auth.uid())` + `with check` · `supabase/seed.sql` สร้างค่าเริ่มต้น (settings, ช่องทาง 3, ก้อน 2) ผ่านฟังก์ชัน `seed_defaults()` ที่เรียกครั้งแรกหลังล็อกอิน
2. `src/lib/supabase.ts` — client จาก `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (throw ข้อความชัดเจนถ้าขาด ยกเว้นโหมด fixtures)
3. `src/data/financeRepo.ts` — `loadFinanceData()` + CRUD ทุก entity · แปลง snake↔camel และ numeric string ↔ Satang (`Math.round(Number(x)*100)`) · error ห่อเป็น `Error` ข้อความไทยสั้น + `cause`
4. `src/hooks/useFinance.ts` — TanStack Query (เพิ่ม dependency `@tanstack/react-query@5` และ QueryClientProvider ใน `src/main.tsx` — อนุญาตแก้ไฟล์นี้เฉพาะส่วน provider) · โหมด fixtures ยังทำงาน · mutation invalidate `["finance"]` · `usePayBill` ต้อง idempotent (ห้ามสร้าง bill_payment ซ้ำ sourceId+statementKey — มี unique constraint ใน DB ด้วย)
5. test: mapper แปลงไป-กลับไม่เพี้ยน (เช่น "1381.93" ↔ 138193) · hooks ในโหมด fixtures คืนข้อมูล · repo ด้วย supabase client ที่ mock
6. README: ขั้นตอนตั้ง Supabase project ใหม่ (region Singapore, ปิด Confirm email, รัน schema + seed, ใส่ env, GitHub Secrets)

ห้าม: ใส่ service_role key ที่ไหนก็ตาม

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
