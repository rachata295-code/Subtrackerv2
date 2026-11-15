# Prompt 03 — รายการ (responsive + animation)
Branch: `p15/03-entries` · เริ่มหลัง prompt 00 merge แล้ว · ไฟล์ของคุณ: `src/pages/entries/*`

ทำ:
1. Desktop ตาม SPEC §4: ซ้าย 240px (`lg:grid-cols-[240px_minmax(0,1fr)]`) = แผงตัวกรอง sticky (รอบเงินเดือน, ก้อน, ช่องทาง — ใช้ SelectField/SegmentedControl เดิม) · ขวา = รายการจัดกลุ่มตามวัน พร้อมยอดรวมต่อวัน
2. Tablet/Mobile: ตัวกรองเป็นแถว chip ด้านบน (ถ้าตอนนี้ยังไม่มีตัวกรอง ให้เพิ่มแบบเดียวกันทั้งสองแบบ — state เดียว แสดงต่างกันตาม breakpoint ด้วย CSS ไม่ใช่ render สองชุด ยกเว้นจำเป็นจริง)
3. ตรรกะกรอง/จัดกลุ่มอยู่ใน `entriesUtils.ts` (pure + test)
4. Animation (SPEC §5): `AnimatedRow` เพิ่ม/ลบรายการ (ไม่ animate ตอนโหลดแรกหรือตอนเปลี่ยนตัวกรอง) · toast บันทึก/แก้/ลบ + error toast
5. Test: กรอง/จัดกลุ่ม, layout 375/1280, ไม่มี row animation ตอนเปลี่ยนตัวกรอง

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
