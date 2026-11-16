# Prompt 00 — แก้บั๊ก BottomSheet มือถือ (ใช้ Argon)
Branch: `p3/00-sheets` · ไฟล์ของคุณ: `src/components/ui/BottomSheet.tsx`, `src/hooks/useVisualViewportHeight.ts` (ใหม่), `src/lib/drafts.ts` หรือ `src/hooks/useDraft.ts` (ใหม่), และ **เฉพาะส่วน state/draft** ของฟอร์มใน sheet: `src/pages/overview/QuickAddSheet.tsx`, `src/pages/entries/EntrySheet.tsx`, `src/pages/bills/SubscriptionSheet.tsx`, `src/pages/bills/InstallmentSheet.tsx`, `src/pages/plan/PlanItemSheet.tsx`, `src/pages/plan/BalanceCheckSheet.tsx` (ถ้ามี), `src/pages/settings/RecurringIncomeSheet.tsx` (+ test)

ทำ (SPEC §A — อ่านอาการ/สาเหตุก่อน):
1. **A1 draft** — hook `useDraft(key, initial)` เก็บ draft ใน memory ระดับ module (ห้าม localStorage/sessionStorage) · เติมกลับเมื่อเปิดใหม่ · `clear()` เมื่อบันทึกสำเร็จ · ปิดด้วยลาก/แตะนอก/ESC ไม่ล้าง · editing ไม่ใช้ draft · ปุ่ม "ล้างฟอร์ม" เล็กๆ ใน QuickAddSheet · ทุก sheet ที่ผู้ใช้พิมพ์ในรายการข้างบนต้องไม่เสียงาน
2. **A2** `BottomSheet` มือถือใช้ Vaul `handleOnly` (ลากได้เฉพาะ handle/หัว) · เนื้อหาเลื่อนอิสระ · desktop ไม่เปลี่ยน · ตรวจว่า Escape/ปุ่ม ✕ ยังปิดได้ และ `onCloseAutoFocus` คืนโฟกัสเหมือนเดิม
3. **A3** hook `useVisualViewportHeight()` ตั้ง `--vvh` (px จาก `visualViewport.height`, fallback `innerHeight`) · `BottomSheet` ใช้ `max-height: calc(var(--vvh) * 0.9)` แทน `90dvh` · ยึดขอบล่างของ visual viewport (ฟัง `visualViewport` resize+scroll) · ลองตั้ง `repositionInputs={false}` แล้วจัดตำแหน่งเอง ถ้า Vaul ยังเพี้ยน · input โฟกัส `scrollIntoView({block:'center'})` หลัง resize · ห้ามมีช่องว่างเปล่าระหว่างเนื้อหากับคีย์บอร์ด
4. **A4** ปุ่มบันทึกเลื่อนถึงได้ตอนคีย์บอร์ดเปิด (sticky footer ถ้าจำเป็น)
5. Test: draft คงอยู่หลังปิด-เปิด / ล้างหลังบันทึก / editing ไม่เติม draft · hook `--vvh` ตอบ resize (mock visualViewport) · handleOnly ไม่ปิดเมื่อลากในเนื้อหา · QuickAddSheet พิมพ์ `45+60` → ปิด → เปิด ยังเห็น
6. Playwright/เบราว์เซอร์จริง: emulate viewport 375×667 แล้ว resize visualViewport จำลองคีย์บอร์ด (~300px) แนบ screenshot ก่อน/หลัง · **สิ่งที่ทดสอบจริงบน iPhone ไม่ได้ ให้ระบุใน PR ว่าเจ้าของต้องเช็ก**

## กติกาทุก prompt (อ่านก่อนเริ่ม)
- Repo: `~/Developer/subtracker` (GitHub `rachata295-code/Subtrackerv2`) · Stack: Vite 5 + React 18 + TS strict + Tailwind 3 + Vitest + Testing Library · TanStack Query · Supabase · Vaul · sonner · PWA
- **อ่านก่อน:** `docs/phase3/SPEC.md` (สัญญาเฟสนี้ — ชื่อ type/ฟังก์ชัน/ตารางต้องตรงเป๊ะ) · `docs/phase1/SPEC.md` §3–§5 (โมเดล/domain เดิม) · `docs/phase1_5/SPEC.md` (responsive) · `PLAN.md` §5–§7 (design system + motion)
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
