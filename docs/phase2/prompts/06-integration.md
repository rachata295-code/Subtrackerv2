# Prompt 06 — รวม + ตรวจกับตัวเลขจริง (ทำหลังสุด คนเดียว) · **Model: Argon**
Branch: `p2/06-integration` · เริ่มหลัง 00–05 merge ครบ · แก้ได้ทุกไฟล์ แต่เฉพาะจุดเพี้ยนที่เจอ

ทำ:
1. ไล่ "วันจริง" ใน fixture mode แล้วจดตัวเลขทุกจอลงตารางใน PR: จดข้าว 3 อย่างด้วย `45+60+35` → hot bar → เช็กยอดเจอหายไป ฿130 → จดที่ลืม → บันทึกส่วนต่าง → แผนรอบนี้ กดเก็บแล้ว → เงินจากแม่เข้า · **ตัวเลข "ใช้ได้จริง" ในภาพรวม = หน้าแผน** · ก้อนเงินในภาพรวมไม่เปลี่ยนจากการเก็บเงิน/ลืมจด · บิล 1,077 ไม่ถูกหักซ้ำ
2. ภาพหน้าจอ `/`, `/entries` (รายการ + สรุป), `/plan`, sheet เช็กยอด, QuickAdd หลายรายการ ที่ 375 / 768 / 1280 × สว่าง/มืด → `docs/phase2/screens/`
3. ตรวจ TabBar 5 ข้อที่ 375 ไม่ล้น · reduced-motion · keyboard (Tab/Esc) ใน sheet ใหม่
4. ตรวจ migration: รัน `supabase/migrations/2026-11-16-phase2.sql` สองรอบติดบนฐานทดสอบ (หรืออ่านให้แน่ใจว่า idempotent) · README: ขั้นตอนรัน migration + สถานะเฟส 2
5. PR รายงาน: ตารางตัวเลข, จุดที่แก้, ภาพก่อน/หลัง

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
