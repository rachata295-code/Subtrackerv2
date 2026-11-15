# Prompt 07 — ย้ายข้อมูลจาก v1
Branch: `p1/07-migrate` · เริ่มหลัง 00 และ 01 merge แล้ว
ไฟล์ของคุณ: `scripts/migrate-v1/**`, ส่วน "Migration" ใน README

v1 (repo `qf6rrqnymb-dev/qf6rrqnymb-dev.github.io`, `supabase/schema.sql`) มีตาราง: `subscriptions(name, price, frequency monthly|yearly, billing_day, notify_days_before)`, `budget_settings(cash_monthly_limit, card_monthly_limit, reset_day, warning_threshold, monthly_income)`, `budget_entries(name, amount, payment_type cash|card, category food|transport|shopping|entertainment|health|other, entry_date, note)`, `transfer_entries(name, amount, direction, entry_date, note)`

ทำ:
1. `scripts/migrate-v1/README.md`: เจ้าของ export 4 ตารางจาก Supabase v1 เป็น CSV (Table editor → Export) วางใน `scripts/migrate-v1/input/` (gitignore)
2. `scripts/migrate-v1/migrate.mjs` (Node 22, ไม่ลง lib เพิ่มนอกจาก `@supabase/supabase-js` ที่มีอยู่): อ่าน CSV → map → **dry-run เป็นค่าเริ่มต้น** พิมพ์สรุป (จำนวนแถว, ยอดรวมต่อตาราง เทียบก่อน/หลัง) · `--apply` จึง insert ด้วย email/password ของเจ้าของ (รับจาก env ไม่ hardcode) ผ่าน anon key + RLS
3. Mapping: v1 subscriptions → Subscription บนบัตร pot ใช้ตามใจ **ยกเว้นชื่อที่มี "Airpod"** → Installment (ถามจำนวนงวด/งวดแรกผ่าน flag `--airpods-count 10 --airpods-first 2026-09-xx` หรือ prompt) บน SPayLater · budget_entries cash → source บัญชี, card → บัตร, category ตรงชื่อ · transfer_entries incoming → Transaction in บนบัญชี · monthly_income → settings.salary
4. idempotent: รันซ้ำไม่สร้างซ้ำ (ใส่ marker `note` หรือ external id)
5. test: mapper ด้วย CSV ตัวอย่างใน `scripts/migrate-v1/__fixtures__`

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
