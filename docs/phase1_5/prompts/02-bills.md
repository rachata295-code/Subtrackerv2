# Prompt 02 — บิล & ผ่อน (responsive + animation)
Branch: `p15/02-bills` · เริ่มหลัง prompt 00 merge แล้ว · ไฟล์ของคุณ: `src/pages/bills/*`

ทำ:
1. Desktop ตาม SPEC §4: SegmentedControl ด้านบน · ซ้าย = รายการ แถวเดียวมีครบ (วันที่ครบกำหนด/วันตัด, ชื่อ, ช่องทาง, ก้อน, ยอด) · ขวา 360px = การ์ด "สรุปรอบนี้" ยอดรวมต่อช่องทาง (บัตร, SPayLater, …) + ยอดรวมทั้งหมด — คำนวณจาก helper ใน `billsLogic.ts` (pure + test) ห้ามนับซ้ำ subscription บนบัตรกับบิลบัตร (ใช้ bill amount ตาม SPEC เฟส 1 §4)
2. Tablet/Mobile: คอลัมน์เดียว (การ์ดสรุปอยู่บนสุดในแท็บ "บิล" สำหรับ tablet; mobile เหมือนเดิม)
3. Animation (SPEC §5): `AnimatedRow` เมื่อเพิ่ม/ลบ subscription, เพิ่ม/ลบผ่อน, จ่ายบิล · `AnimatedMoney` ที่ยอดในการ์ดสรุป · toast บันทึก/ลบ/จ่าย + error toast
4. Test: helper สรุปยอด (ใช้ตัวเลข fixtures: บิลบัตร 1,077.00, SPayLater 1,381.93), layout 375/1280, toast

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
