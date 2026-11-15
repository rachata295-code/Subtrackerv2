# Prompt 08 — รวมงาน (ทำคนเดียว หลัง 01–07 merge)
Branch: `p1/08-integration`
ไฟล์ของคุณ: ทั้ง repo

ทำ:
1. ลบ stub/mock ที่ค้าง: screens ใช้ hooks + domain จริง · ต่อ `onSignOut` ถ้ายังเป็น prop
2. ใส่ app-level ErrorBoundary (ข้อความไทย + ปุ่มโหลดใหม่)
3. ตรวจสัญญาตรงกันทุกจุด (SPEC §3–§5) · แก้ "ขอเปลี่ยนสัญญา" ที่ PR อื่นทิ้งไว้ แล้วอัปเดต SPEC
4. ทดสอบ end-to-end ด้วย Supabase จริง: ล็อกอิน → เพิ่มรายจ่าย → จ่ายบิล → ยอดตรงตัวอย่าง SPEC §4 → ออกจากระบบ
5. GitHub Actions deploy ไป Pages (`VITE_BASE=/Subtrackerv2/`, Secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) โดย gate typecheck + test + check:motion ก่อน deploy
6. รัน taste-skill inspector (`node ~/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/scripts/inspect.mjs --app <url>`) ทุกจอ 390/768/1440 → 0 FAIL
7. อัปเดต PLAN/README: สถานะเฟส 1 + สิ่งที่ยกไปเฟส 2

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
