# Prompt 06 — รวมงาน + ตรวจภาพทุกจอ (ทำหลังสุด คนเดียว)
Branch: `p15/06-integration` · เริ่มหลัง 00–05 merge ครบ · แก้ได้ทุกไฟล์ แต่เฉพาะจุดเพี้ยนที่เจอ

ทำ:
1. `VITE_USE_FIXTURES=1 npm run dev` · ถ่ายภาพทุกหน้า (`/`, `/entries`, `/bills` ทั้ง 3 แท็บ, `/settings`, `/login`) ที่ 375 / 768 / 1280 × ธีมสว่าง/มืด → เก็บใน `docs/phase1_5/screens/` (commit ได้)
2. เปิดฟอร์มทุกตัวที่ 375 (bottom sheet) และ 1280 (แผงขวา) · กด Esc / คลิก overlay ปิดได้ · โฟกัสกลับปุ่มที่เปิด
3. ตรวจ SPEC §5: เพิ่ม/ลบ/จ่าย แล้วเห็น row enter/exit + toast · ตัวเลขนับ · เปิด reduced-motion (DevTools → Rendering) แล้วเหลือแค่ fade · เปลี่ยนแท็บ/ย่อขยายหน้าต่างข้าม 1024px ไม่มี animation
4. ตรวจ: ไม่มี horizontal scroll ที่ 375 · SideNav ไม่ซ้อน TabBar ที่ 1024 พอดี · Toaster ไม่ทับ TabBar บนมือถือ
5. `npm run build && npm run preview` → taste-skill inspector (`node <taste-skill>/scripts/inspect.mjs --app ...`) ที่ 1280 สำหรับ `/` และ `/bills` · แก้ FAIL
6. อัปเดต README (สถานะเฟส 1.5) และ `docs/phase1_5/SPEC.md` ถ้ามีการตัดสินใจเปลี่ยน
7. PR รายงาน: รายการจุดที่แก้ + ภาพก่อน/หลัง

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
