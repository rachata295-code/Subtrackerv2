# Prompt 03 — ล็อกอิน + App shell
Branch: `p1/03-auth` · เริ่มหลัง 00 merge แล้ว
ไฟล์ของคุณ: `src/auth/**`, `src/pages/login/**`, `src/components/layout/AppShell.tsx`, การห่อ route ด้วย guard ใน `src/App.tsx` (แก้เฉพาะส่วน guard/shell — ห้ามลบ route)

ทำ:
1. `src/auth/AuthProvider.tsx` + `useAuth(): { session; user; status: "loading"|"signedIn"|"signedOut"; signIn(email,password); signOut() }` ใช้ `supabase.auth` (import client จาก `src/lib/supabase.ts` — ถ้า prompt 01 ยังไม่ merge ให้ทำ adapter interface `AuthClient` แล้ว inject เพื่อ test ด้วย fake) · โหมด `VITE_USE_FIXTURES=1` = signedIn เสมอ
2. `RequireAuth` ห่อ `/`, `/bills`, `/entries`, `/settings` → ไม่ล็อกอินพาไป `/login` แล้วกลับจอเดิมหลังเข้าได้ · `/design`, `/preview-home` ไม่ต้องล็อกอิน
3. `/#/login`: Card กลางจอ · TextField email (`autocomplete=email`, `inputmode=email`) + password (`autocomplete=current-password`) · Button primary "เข้าสู่ระบบ" มี loading · error ภาษาไทยใต้ฟอร์ม (`role=alert`) แปลจาก error ของ Supabase (รหัสผิด / เน็ตหลุด) · ไม่มีปุ่มสมัคร (ผู้ใช้คนเดียว สร้าง user ใน Supabase dashboard)
4. `AppShell`: คอลัมน์ 480px กลางจอ, main เลื่อนได้, TabBar sticky ล่าง, `<AppToaster/>` อยู่แล้วใน App — ห้ามซ้ำ · หัวจอแต่ละหน้าให้ page ทำเอง
5. หลังล็อกอินครั้งแรก เรียก `seed_defaults()` (ถ้ามี) ผ่าน callback ที่ inject ได้
6. test: redirect เมื่อไม่ล็อกอิน · กลับจอเดิมหลังล็อกอิน · error แสดง · signOut กลับ /login · fixtures mode ข้ามล็อกอิน

## กติกาทุก prompt (อ่านก่อนเริ่ม)
- Repo: `~/Developer/subtracker` (GitHub `rachata295-code/Subtrackerv2`) · Stack: Vite 5 + React 18 + TS strict + Tailwind 3 + Vitest + Testing Library · PWA
- **อ่านก่อน:** `docs/phase1/SPEC.md` (สัญญากลาง — ชื่อ type/ฟังก์ชันต้องตรงทุกตัว), `PLAN.md` §5–§7 (design system), `README.md`
- ใช้ components จาก `src/components/ui/*` และ token ใน `src/styles/tokens.css` เท่านั้น · ห้าม hex / arbitrary Tailwind value (`text-[#..]`, `rounded-[..]`) ใน component · animation เฉพาะ transform/opacity · เคารพ prefers-reduced-motion
- **แก้เฉพาะไฟล์ที่ระบุว่าเป็นของคุณ** (SPEC §7) · ต้องการให้ไฟล์ของคนอื่นเปลี่ยน → เขียนไว้ในหัวข้อ "ขอเปลี่ยนสัญญา" ใน PR แทนการแก้เอง
- TDD: เขียน test ที่ล้มก่อน แล้วค่อยเขียนโค้ด
- ก่อน commit: `npx vitest run` (output สะอาด) · `npx tsc --noEmit` · `npm run check:motion` · `npm run build` ต้องผ่านทั้งหมด
- comment อธิบาย "ทำไม" เป็นภาษาอังกฤษ · ข้อความ UI ภาษาไทย
- ทำงานบน branch ของตัวเองจาก `main` ล่าสุด · push แล้วเปิด PR เข้า `main` · **ห้าม merge เอง ห้าม force-push**
- จบงานให้รายงาน: สิ่งที่ทำ · ผล test · ไฟล์ที่แตะ · สิ่งที่ไม่แน่ใจ/ขอเปลี่ยนสัญญา
