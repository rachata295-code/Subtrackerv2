# Prompt 04 — จดเร็ว (ช่องคิดเลข · หลายรายการ · hot bar)
Branch: `p2/04-quickadd` · เริ่มหลัง 00 merge · ไฟล์ของคุณ: `src/components/ui/CurrencyField.tsx`, `src/components/HotBar.tsx` (ใหม่), `src/pages/overview/QuickAddSheet.tsx`, `src/pages/overview/index.tsx` (เฉพาะวาง HotBar ใต้ปุ่มเพิ่ม) (+ test)

ทำ (SPEC §4):
1. `CurrencyField` รับนิพจน์ผ่าน `evaluateAmountExpression` · แสดง "= ฿140.00" ใต้ช่องเมื่อมี `+`/`−` · error ใต้ช่อง · `onChange` ส่งค่า satang ที่คำนวณแล้ว (props เดิมไม่เปลี่ยน — ทุกฟอร์มได้ความสามารถนี้อัตโนมัติ) · แถบปุ่ม `+` `−` เล็กใต้ช่องบน touch device (`pointer: coarse`)
2. `QuickAddSheet`: สลับ "รายจ่าย / เงินเข้า" (หมวดตาม `OUT_CATEGORIES` / `IN_CATEGORIES`) · ปุ่ม "+ เพิ่มอีกรายการ" (แถว: โน้ต, ยอด, หมวด · วันที่/ช่องทาง/ก้อนร่วมจากหัว) · ปุ่มบันทึก "บันทึก N รายการ · ฿รวม" → `useCreateTransactions` ครั้งเดียว · ล้ม → ไม่บันทึกเลย + toast · ลบแถวได้ (`AnimatedRow`)
3. `HotBar`: แถวปุ่มเลื่อนแนวนอนจาก `hotbarItems` · กด = บันทึกวันนี้ทันที + toast "บันทึก<ชื่อ> ฿X · เลิกทำ" 5 วิ (เลิกทำ = ลบ) · กดค้าง 500ms / คลิกขวา = เปิด QuickAddSheet เติมค่าไว้ · ไม่มีของ → ไม่แสดงแถบ · วางในหัว QuickAddSheet และหน้าภาพรวมใต้ปุ่มเพิ่ม · ปุ่มใช้ `.pressable` · ขนาดกด ≥ 44px
4. คำเตือนวันที่ก่อนเช็กยอดล่าสุด (SPEC §5 C2) ในฟอร์มเมื่อช่องทางเป็นบัญชีที่มี BalanceCheck
5. Test: นิพจน์ใน CurrencyField, หลายแถวบันทึกครั้งเดียว, hot bar กดแล้ว mutation ถูกเรียกด้วยค่าที่ถูก, เลิกทำ, long-press เปิดฟอร์ม, 375/1280

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
