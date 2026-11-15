# Prompt 04 — ตั้งค่า + ล็อกอิน + ข้อความ error
Branch: `p15/04-settings-login` · เริ่มหลัง prompt 00 merge แล้ว · ไฟล์ของคุณ: `src/pages/settings/*`, `src/pages/login/*`, `src/auth/errors.ts` (+ test)

ทำ:
1. ตั้งค่า desktop: การ์ด section เรียง 2 คอลัมน์ (`lg:grid-cols-2`, จัดให้การ์ดยาวไม่ทิ้งช่องโหว่ — ลำดับ: เงินเดือน & รอบ | ช่องทางจ่าย · ก้อนเงิน | ธีม & บัญชี) · tablet/mobile คอลัมน์เดียวเหมือนเดิม
2. Animation: `AnimatedRow` เพิ่ม/ลบ/เก็บถาวร ช่องทางจ่ายและก้อนเงิน · toast บันทึก/ลบ + error toast
3. ล็อกอิน: ตรวจที่ 375/768/1280 ว่าการ์ดกลางจอกว้างไม่เกิน 400px — แก้เฉพาะถ้าเพี้ยน
4. `src/auth/errors.ts` ตาม SPEC §6: `email_provider_disabled` → "ยังไม่ได้เปิดการล็อกอินด้วยอีเมลใน Supabase" · `invalid_api_key` หรือ status 401 ที่ไม่ใช่ invalid_credentials → "ตั้งค่า Supabase key ไม่ถูกต้อง" + test ทุกกรณี (กรณีเดิมต้องผ่าน)
5. Test: layout 375/1280, toast, error mapping

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
