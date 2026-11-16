# Prompt 01 — ปัดซ้ายลบ + ล้างข้อมูลทั้งหมด
Branch: `p3/01-swipe-clear` · ไฟล์ของคุณ: `src/components/ui/SwipeToDelete.tsx` (ใหม่), `src/components/ui/ListRow.tsx` (ถ้าจำเป็น), การห่อแถวในลิสต์ของ `src/pages/entries/index.tsx`, `src/pages/bills/index.tsx`, `src/pages/plan/index.tsx`, `src/pages/settings/index.tsx` (เฉพาะแถวลิสต์ + ท้ายหน้าตั้งค่า), `src/pages/settings/ClearDataSheet.tsx` (ใหม่), `src/data/financeRepo.ts`, `src/hooks/useFinance.ts` (+ test) · **ห้ามแตะโค้ดฟอร์มใน sheet** (เป็นของ prompt 00)

ทำ (SPEC §B, §C):
1. `SwipeToDelete` ตาม §B ทุกข้อ (pointer events, `touch-action: pan-y`, ล็อกแกน 8px, velocity, rubber-band, เปิดทีละแถว, ปุ่ม "ลบ" จริงเข้าถึงด้วยคีย์บอร์ด, reduced-motion, ปิดการปัดบน `(pointer: fine)`) · อ่านสกิล/หลักการ gesture ให้ติดนิ้ว 1:1 และขัดจังหวะได้
2. ห่อแถวใน: รายการ, บิล/สมาชิก/ผ่อน, แผนรอบนี้, ตั้งค่า (เงินประจำ/ก้อน/ช่องทาง) · ลบ → toast "ลบ…แล้ว · เลิกทำ" 5 วิ (เลิกทำ = สร้างกลับ) · ช่องทาง/ก้อนที่ถูกอ้างอิง ใช้กติกาเดิมของ handleDeleteSource/handleDeletePot (ลบไม่ได้ → toast อธิบาย แถวเด้งกลับ)
3. `financeRepo.clearAllData({ includeSetup })` ตาม §C · ลำดับลบกันชน FK · ใช้ session ผู้ใช้ ห้าม service_role · hook `useClearAllData` + fixture mode · ล้มกลางทาง → toast error + invalidate
4. `ClearDataSheet`: นับรายการจริงจากข้อมูล · ต้องพิมพ์ `ล้างข้อมูล` + `HoldToDelete` · สวิตช์ "ล้างการตั้งค่าด้วย" ปิดเป็นค่าเริ่มต้น · วางปุ่มแดงท้ายหน้าตั้งค่า (โซนอันตราย)
5. Test: gesture (ปัดเปิด/ปิด/ลบสุด, แนวตั้งไม่ปัด), ปุ่มลบคีย์บอร์ด, เลิกทำ, ลบที่ถูกอ้างอิง, clearAllData ทั้งสองโหมด (fixture + repo mock ตรวจลำดับตาราง), ยืนยันต้องพิมพ์ถูก, 375/1280 ไม่ overflow

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
