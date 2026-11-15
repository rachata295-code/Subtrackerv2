# Prompt 00 — สัญญากลาง (ทำก่อน คนเดียว)
Branch: `p1/00-contracts`

เป้าหมาย: วางของกลางที่ทุก prompt ถัดไปใช้ เพื่อให้ทำงานขนานกันได้โดยไม่ชนกัน

ทำ:
1. `src/types/finance.ts` — type ทั้งหมดใน SPEC §3 ตามชื่อเป๊ะ + `FinanceData` (§4) + `Outflow` (§4) + `PotStatus = { carryIn; budget; reserved; spent; left; over }` + type ของ hooks ใน §5 (`UseFinanceData = { data?: FinanceData; isLoading: boolean; error: Error | null }`)
2. `src/fixtures/finance.ts` — `FinanceData` ตัวอย่างจากตัวเลขจริงใน SPEC §4 (salary 10,200 payDay 10 · บัญชี, บัตร closeDay 10 due 24 payFrom บัญชี, SPayLater due 10 offset 1 · ก้อนใช้ตามใจ 3,000 rollover / ใช้จ่ายจำเป็น 7,200 · subs Claude 699 day 1, Gemini+YouTube 279 day 25, iCloud 99 day 3 บนบัตร pot ใช้ตามใจ · AirPods ผ่อน 10 งวด 1,381.93 บน SPayLater pot ใช้ตามใจ เริ่มให้งวดที่ 3 ตก พ.ย. 2026 · รายจ่ายใช้เล่น หนัง 220 ชานม 85 เกม 115 ในรอบ พ.ย. · ข้อมูลรอบ ต.ค. ที่ทำให้ carryIn รอบ พ.ย. = 541.00) — เงินเป็น satang integer
3. `src/domain/index.ts` — **stub** ของทุกฟังก์ชันใน SPEC §4 ด้วย signature เป๊ะ, body `throw new Error("not implemented: <name>")` (prompt 02 จะเติม)
4. `src/hooks/useFinance.ts` — **stub** ที่คืนค่า fixtures เมื่อ `import.meta.env.VITE_USE_FIXTURES === "1"` และ signature mutation hooks ตาม SPEC §5 (no-op + TODO) (prompt 01 จะแทนที่ body)
5. routes ใน `src/App.tsx`: `/` ภาพรวม, `/bills`, `/entries`, `/settings`, `/login` (+ คง `/design`, `/preview-home`) · สร้าง `src/pages/{overview,bills,entries,settings,login}/index.tsx` เป็น placeholder ที่มี h1 ชื่อจอ
6. อัปเดต TabBar links ให้ชี้ `/`, `/entries`, `/bills`, `/settings` (ไฟล์ `src/components/layout/TabBar.tsx` + test)
7. test: fixtures type-check และรวมเงินถูก (Σ subs บนบัตร = 107700 satang) · routes render h1 ทุกจอ

เสร็จเมื่อ: merge เข้า main แล้ว (เจ้าของ merge) — prompt 01–06 เริ่มจาก main หลังจากนั้น

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
