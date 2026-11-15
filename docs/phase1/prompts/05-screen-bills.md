# Prompt 05 — จอ บิล & ผ่อน
Branch: `p1/05-bills` · เริ่มหลัง 00 merge แล้ว
ไฟล์ของคุณ: `src/pages/bills/**` เท่านั้น
ข้อมูล: `useFinanceData()` + mutation hooks (SPEC §5) + `src/domain` (mock ใน test ถ้ายังเป็น stub · dev ด้วย `VITE_USE_FIXTURES=1`)

ทำ:
1. หัวจอ "บิล & ผ่อน" · SegmentedControl: "บิล" / "ผ่อน" / "สมาชิก"
2. **บิล:** ต่อช่องทางที่มีรอบบิล (บัตร, SPayLater): Card สี hue · ยอดรอบปัจจุบัน (billAmount) · วันครบกำหนด (DateBadge, dueBy สำหรับ SPayLater) · สถานะ จ่ายแล้ว/ยังไม่จ่าย · ปุ่ม "จ่ายแล้ว" · รายการ charge ในรอบ (ListRow) · ประวัติ 3 รอบก่อน (ยุบได้)
3. **ผ่อน:** ต่อรายการ: ชื่อ · งวด n/count (คำนวณจาก installmentSchedule กับวันนี้) · ต่องวด · เหลือรวม · วันจบ · Pill ช่องทาง · ป้าย "นับในใช้ตามใจ" หรือ "แยก" · กดเปิด BottomSheet แก้ไข
4. **สมาชิก:** subscriptions เรียงตามยอดต่อเดือน · รายปีแสดงต่อเดือน + ต่อปี · รวมต่อเดือน + % ของเงินเดือน
5. ฟอร์ม (BottomSheet) เพิ่ม/แก้ **รายการผ่อน**: ชื่อ, ต่องวด (CurrencyField), จำนวนงวด, วันที่งวดแรก, ช่องทาง, Switch "นับรวมในวงเงินใช้ตามใจ" (on → potId ก้อนใช้ตามใจ, off → null) · ก่อนบันทึกแสดงคำเตือนถ้าจะทำให้รอบไหน over (ใช้ potStatus กับข้อมูลจำลองที่รวมรายการใหม่) · ลบด้วย HoldToDelete
6. ฟอร์ม เพิ่ม/แก้ **subscription**: ชื่อ, ยอด, รายเดือน/รายปี, วันตัด (และเดือนถ้ารายปี), ช่องทาง, ก้อน · ลบด้วย HoldToDelete
7. validation ภาษาไทยใต้ช่อง (aria-describedby) · ทุกฟอร์ม toast + เลิกทำ
8. test: งวด 3/10 ของ AirPods ในวันที่ 15 พ.ย. 2026 · สวิตช์ map เป็น potId ถูก · คำเตือน over · validation · ลบต้องกดค้าง

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
