# Prompt 00 — โครงหลัก responsive (ทำก่อน คนเดียว)
Branch: `p15/00-shell`

เป้าหมาย: วางของกลางตาม SPEC §2–§3 ให้ prompt 01–05 ทำขนานกันได้

ทำ:
1. Tokens (SPEC §3.1): `maxWidth.tablet` 640px, `maxWidth.content` 1120px, `spacing.sidebar` 240px, `spacing.panel` 420px ใน `tailwind.config.ts` (ค่าอ้าง CSS var ใน `tokens.css` แบบเดียวกับของเดิม)
2. `src/hooks/useMediaQuery.ts` ตาม SPEC §3.2 (อ่านค่า sync ตอน render แรก · subscribe `change` · cleanup) + test
3. `src/test/mockMatchMedia.ts` — `mockMatchMedia(width)` stub `window.matchMedia` ให้ตอบ `(min-width: Npx)` / `(max-width: Npx)` ตาม width, รองรับ `addEventListener('change')` · test ของตัวมันเอง
4. `src/components/layout/navItems.ts` — ย้าย `ITEMS` ออกจาก TabBar (TabBar ใช้ร่วม, test เดิมต้องผ่าน)
5. `src/components/layout/SideNav.tsx` ตาม SPEC §3.3 (ชื่อแอป, ปุ่ม "+ เพิ่มรายการ" → `navigate('/?add=1')`, เมนู 4 ข้อ `aria-current="page"`, `ThemeSwitch` ด้านล่าง, `aria-label="เมนูหลัก"`) + test
6. `AppShell`: mobile/tablet เดิม + `md:max-w-tablet` · desktop (`useIsDesktop()`) = SideNav + main (`lg:px-8`, เนื้อหา `mx-auto max-w-content`) — render TabBar **หรือ** SideNav อย่างใดอย่างหนึ่ง ไม่ซ้อน · test ที่ 375/768/1280
7. `BottomSheet` ตาม SPEC §3.4 (props เดิม · desktop = `direction="right"` แผง `w-panel` เต็มสูง ไม่มี handle) + override timing ใน `motion.css` ให้ทิศขวาใช้ `--dur-sheet`/`--ease-drawer` และ reduced-motion → fade · test: desktop render แผงขวา, Esc ปิดได้
8. `Toaster`: desktop ไม่ offset `--tabbar-h`
9. ห้ามแตะ `src/pages/*` (เป็นของ prompt 01–05) และ DesignPage

เสร็จเมื่อ: PR เปิดแล้ว · เจ้าของ merge แล้ว prompt 01–05 จึงเริ่ม

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
