# Prompt 06 — จอ รายการ + ตั้งค่า
Branch: `p1/06-entries-settings` · เริ่มหลัง 00 merge แล้ว
ไฟล์ของคุณ: `src/pages/entries/**`, `src/pages/settings/**` เท่านั้น
ข้อมูล: `useFinanceData()` + mutation hooks (SPEC §5) · dev ด้วย `VITE_USE_FIXTURES=1`

**รายการ (`/entries`):**
1. หัวจอ "รายการ" + "+" (BottomSheet เดียวกับภาพรวม: ยอด, รับ/จ่าย, ช่องทาง, ก้อน, หมวด, วันที่ default วันนี้, โน้ต)
2. ตัวเลือกรอบเงินเดือน (รอบนี้ / ก่อน / 2 รอบก่อน — payPeriod) · SegmentedControl กรองช่องทาง "ทั้งหมด" + ทุก source
3. ลิสต์จัดกลุ่มตามวัน (หัววันที่ไทย) · ListRow: ชื่อหมวด/โน้ต · Pill ช่องทาง · Money (รายรับ income สีเขียว +) · รวมรายวันชิดขวา
4. กดแถว → แก้ไขใน BottomSheet · ลบ HoldToDelete · toast เลิกทำ
5. EmptyState "ยังไม่มีรายการในรอบนี้"

**ตั้งค่า (`/settings`):**
1. เงินเดือน (CurrencyField) + วันเงินเดือนเข้า (1–31)
2. ช่องทางจ่าย: ลิสต์ + เพิ่ม/แก้ (ชื่อ, ประเภท bank/credit_card/paylater, สี hue เลือกจาก 6 เฉด ที่ยังไม่ใช้ก่อน, วันปิดรอบ, วันครบกำหนด, offset, จ่ายจากบัญชีไหน) — ฟิลด์รอบบิลซ่อนเมื่อเป็น bank · archive แทนลบถ้ามีรายการผูกอยู่
3. ก้อนเงิน: ชื่อ, ต่อรอบ, ยกยอดไหม
4. ธีม (ThemeSwitch ที่มีอยู่) · ออกจากระบบ (`useAuth().signOut` — ถ้า prompt 03 ยังไม่ merge ให้รับ prop `onSignOut` แล้ว 08 ต่อสาย)
5. test: กรองตามช่องทาง · รวมรายวันถูก · ฟิลด์รอบบิลซ่อนสำหรับ bank · validation วัน 1–31 · archive เมื่อมีรายการผูก

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
