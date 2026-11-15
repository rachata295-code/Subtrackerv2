# Prompt 05 — ลดขนาดฟอนต์ precache
Branch: `p15/05-perf` · เริ่มหลัง prompt 00 merge แล้ว · ไฟล์ของคุณ: `src/main.tsx` (เฉพาะ import ฟอนต์), `src/styles/fonts.css` (ถ้าต้องสร้าง), `vite.config.ts` (เฉพาะส่วน PWA/workbox), `README.md` §PWA notes

ปัญหา: `src/main.tsx` import `@fontsource/{manrope,anuphan}/{400,500,600}.css` ซึ่งดึงทุก subset (cyrillic, vietnamese, …) → precache 606 KiB

ทำ:
1. ใช้เฉพาะ subset ที่ต้องใช้: Anuphan `thai` + `latin`, Manrope `latin` (เช่น import ไฟล์ `latin-400.css`/`thai-400.css` ของ fontsource หรือเขียน `fonts.css` เองด้วย `@font-face` + `unicode-range`) — น้ำหนัก 400/500/600 ครบ
2. ปรับ workbox `globPatterns`/`globIgnores` ให้ precache เฉพาะไฟล์ฟอนต์ที่ใช้
3. วัดก่อน/หลัง: `npm run build` แล้วรายงานขนาด precache (บรรทัด `precache ... KiB` ของ vite-plugin-pwa) — เป้า < 300 KiB
4. ตรวจ: ภาษาไทยแสดงด้วย Anuphan ทั้ง online และ offline (`npm run build && npm run preview` → DevTools offline → reload) · ตัวเลข/อังกฤษเป็น Manrope · แนบภาพหน้าจอ
5. อัปเดต README §PWA notes (คำสั่งตรวจ woff2 ใน `dist/sw.js` ให้ตรงของใหม่)

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
