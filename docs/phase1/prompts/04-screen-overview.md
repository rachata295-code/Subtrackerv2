# Prompt 04 — จอ ภาพรวม
Branch: `p1/04-overview` · เริ่มหลัง 00 merge แล้ว
ไฟล์ของคุณ: `src/pages/overview/**` เท่านั้น

ข้อมูล: `useFinanceData()` จาก `src/hooks/useFinance.ts` + ฟังก์ชันใน `src/domain` (ตอนนี้อาจยังเป็น stub — ให้เขียน test ด้วย `vi.mock("../../domain")` คืนค่าตามตัวอย่าง SPEC §4 และรัน dev ด้วย `VITE_USE_FIXTURES=1`; ถ้า domain ยัง throw ให้จอแสดง ErrorState แทนพัง)
อ้างอิงหน้าตา: `src/pages/preview/PreviewHome.tsx` (`/#/preview-home`) — **ทำซ้ำโครงเดียวกันแต่ดึงจาก data จริง** (ห้ามแก้ไฟล์ preview)

ทำ:
1. หัวจอ "ภาพรวม" + "รอบ 10 พ.ย. – 9 ธ.ค. · อีก N วัน" (จาก payPeriod) + IconButton "+" เปิด BottomSheet เพิ่มรายจ่ายด่วน (CurrencyField, เลือกช่องทาง SegmentedControl, เลือกก้อน, หมวด, Switch ไม่ต้อง) → `useCreateTransaction` → toast "บันทึกแล้ว" + เลิกทำ
2. การ์ดหลัก: "เหลือใช้เล่น" (Money xl จาก potStatus ก้อนใช้ตามใจ) · บรรทัดเฉลี่ยต่อวัน · AllocationBar (บิลต่อช่องทาง reserved / ใช้ไปแล้ว / เหลือ) · Tile ต่อช่องทาง (สี hue ของ source) · "ยังต้องจ่ายอีก" AnimatedMoney · over → สีสถานะตาม design system
3. "เงินออก 30 วันข้างหน้า": upcomingOutflows · บิล = ListRow strong + ปุ่ม "จ่ายแล้ว" → `usePayBill` (focus ไป region ยอด ด้วย preventScroll) · charge = ListRow ปกติ + Pill ช่องทาง + "เข้าบิล <เดือน>" · cap 5 แถว + "ดูทั้งหมด" ไป `/bills`
4. "ใช้จ่ายจำเป็น": แถวเดียว ใช้ไป / งบ / เหลือ (potStatus ก้อนที่ 2)
5. state: loading = Skeleton, error = ข้อความ + ปุ่มลองใหม่, ไม่มีข้อมูล = EmptyState ชวนไปตั้งค่า
6. test: แสดง 662.07 จาก fixtures · กดจ่ายแล้วเรียก mutation ครั้งเดียวแม้ double-tap · Σ เงินออกไม่นับ charge · loading/error/empty

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
