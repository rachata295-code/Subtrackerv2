# Prompt 01 — ภาพรวม (responsive + animation)
Branch: `p15/01-overview` · เริ่มหลัง prompt 00 merge แล้ว · ไฟล์ของคุณ: `src/pages/overview/*`

ทำ:
1. Desktop ตาม SPEC §4: 2 คอลัมน์ (`lg:grid-cols-[minmax(0,1fr)_360px]`) · ซ้าย = หัวรอบ + การ์ดก้อนเงิน 2 ใบข้างกัน + AllocationBar · ขวา = "ใกล้ครบกำหนด" + "รายการล่าสุด" (5 รายการล่าสุดของรอบนี้ — ถ้ายังไม่มี section นี้ให้สร้าง ใช้ `ListRow`)
2. Tablet: คอลัมน์เดียว การ์ดก้อนเงิน 2 ใบข้างกัน (`md:grid-cols-2`) · Mobile: เหมือนเดิม
3. รับ `/?add=1` (SPEC §3.5): เปิด `QuickAddSheet` แล้ว `setSearchParams` ลบ `add` แบบ `replace` · test: เปิดครั้งเดียว, back ไม่เปิดซ้ำ
4. Animation (SPEC §5): `AnimatedMoney` ที่ left/budget/reserved ของก้อนเงิน · `AnimatedRow` ที่บิลใกล้ครบกำหนด (exit เมื่อกดจ่าย) และรายการล่าสุด (enter เมื่อเพิ่ม) — ไม่ animate ตอนโหลดแรก · toast "บันทึกแล้ว" หลัง quick add, "จ่าย<ชื่อบิล>แล้ว" หลังจ่าย, error toast เมื่อล้มเหลว (ถ้ามีอยู่แล้วให้คงไว้)
5. Test: layout ที่ 375 และ 1280, query param, toast, ไม่มี row animation ตอน mount แรก

## กติกาทุก prompt (อ่านก่อนเริ่ม)
- Repo: `~/Developer/subtracker` (GitHub `rachata295-code/Subtrackerv2`) · Stack: Vite 5 + React 18 + TS strict + Tailwind 3 + Vitest + Testing Library · Vaul · sonner · PWA
- **อ่านก่อน:** `docs/phase1_5/SPEC.md` (สัญญาเฟสนี้ — ชื่อ hook/token/component ต้องตรงเป๊ะ), `PLAN.md` §5–§7 (design system + motion), `README.md`
- ใช้ components จาก `src/components/ui/*` และ token เท่านั้น · ห้าม hex / arbitrary Tailwind value (ยกเว้น `grid-cols-[...]` ตาม SPEC §3.3) · animation เฉพาะ transform/opacity · เคารพ prefers-reduced-motion · ไม่มี animation ตอนเปลี่ยนแท็บ/route/breakpoint
- **มือถือ 375px ต้องไม่เปลี่ยนจากเดิม** (ยกเว้น animation ตาม SPEC §5)
- **แก้เฉพาะไฟล์ของคุณ** (SPEC §7) · ต้องการให้ไฟล์ของคนอื่นเปลี่ยน → เขียนในหัวข้อ "ขอเปลี่ยนสัญญา" ใน PR
- TDD: test ที่ล้มก่อน แล้วค่อยเขียนโค้ด · จำลองขนาดจอด้วย `mockMatchMedia(375 | 768 | 1280)` จาก `src/test/mockMatchMedia.ts`
- ก่อน commit: `npx vitest run` (output สะอาด) · `npx tsc --noEmit` · `npm run check:motion` · `npm run build` ผ่านทั้งหมด
- ภาพหน้าจอ: `VITE_USE_FIXTURES=1 npm run dev` แล้วถ่ายที่ 375 / 768 / 1280 แนบใน PR (ทั้งธีมสว่างและมืดอย่างน้อยที่ 1280)
- comment อธิบาย "ทำไม" เป็นภาษาอังกฤษ · ข้อความ UI ภาษาไทย · โค้ดใหม่มี error handling
- branch ของตัวเองจาก `main` ล่าสุด · push แล้วเปิด PR เข้า `main` · **ห้าม merge เอง ห้าม force-push**
- จบงานรายงาน: สิ่งที่ทำ · ผล test · ไฟล์ที่แตะ · สิ่งที่ไม่แน่ใจ/ขอเปลี่ยนสัญญา
