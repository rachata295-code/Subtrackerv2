# SubTracker v2 · เฟส 1.5 — Responsive (มือถือ + คอม) และ animation ในหน้าจริง (SPEC)

สถานะ: ✅ APPROVED โดยเจ้าของ 2026-11-15 · ทุกข้อที่มี **[call]** คือการตัดสินใจของ Claude ที่เจ้าของแก้ได้
Base: `main` หลัง merge PR #11 · กติกา design system เดิมยังบังคับทั้งหมด (`PLAN.md` §5–§7, `docs/phase1/SPEC.md`)

---

## 1. เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย**
- ใช้งานได้ดีทั้ง **มือถือ** และ **คอม** (เจ้าของใช้ทั้งสอง) — บนคอมต้องไม่ใช่แถบ 480px กลางจอ
- ใส่ animation ที่ design system มีแล้วลงในหน้าจริงให้ครบ (row enter/exit, ตัวเลขเงินนับ, toast)
- เก็บตก: ข้อความ error ล็อกอินชัดขึ้น, ลดขนาดฟอนต์ precache

**ไม่ใช่เป้าหมาย:** ฟีเจอร์ใหม่ (กราฟ, แจ้งเตือน, backup — เฟส 2) · เปลี่ยน domain logic / schema · เปลี่ยนสี/ฟอนต์/token เดิม

**Anti-goal:** มือถือต้องไม่เปลี่ยนไปจากตอนนี้ (นอกจาก animation ที่เพิ่ม) · ไม่มี animation ตอนเปลี่ยนแท็บ/โหลดหน้า/เปลี่ยน breakpoint

## 2. Breakpoints **[call]**

| ชื่อ | ความกว้าง | เลย์เอาต์ |
|---|---|---|
| mobile | `< 768px` | เหมือนเดิมทุกอย่าง: คอลัมน์ `max-w-phone` (480) + TabBar ล่าง + BottomSheet |
| tablet | `768–1023px` (`md:`) | คอลัมน์เดียว `max-w-tablet` (640) + TabBar ล่าง + BottomSheet |
| desktop | `≥ 1024px` (`lg:`) | SideNav ซ้าย 240px + เนื้อหา `max-w-content` (1120) + ฟอร์มเป็นแผงขวา 420px |

- ใช้ Tailwind screens ค่าเริ่มต้น (`md` 768, `lg` 1024) — **ห้ามเพิ่ม screen ใหม่**
- เลย์เอาต์ทำด้วย CSS (`md:`/`lg:`) เป็นหลัก · ใช้ `useIsDesktop()` เฉพาะที่ต้องเปลี่ยน *component* (TabBar↔SideNav, BottomSheet↔แผงขวา) เพื่อไม่ให้ DOM ซ้ำสองชุด

## 3. สัญญากลาง (prompt 00 สร้าง — ทุก prompt ใช้ชื่อนี้เป๊ะ)

### 3.1 Tokens (`tailwind.config.ts`, `src/styles/tokens.css`)
- `maxWidth`: `phone: 480px` (เดิม) · **`tablet: 640px`** · **`content: 1120px`**
- `width`/`spacing`: **`sidebar: 240px`** · **`panel: 420px`**
- ไม่มีสี/radius/เงาใหม่

### 3.2 Hook — `src/hooks/useMediaQuery.ts`
```ts
export const DESKTOP_QUERY = '(min-width: 1024px)';
export function useMediaQuery(query: string): boolean; // matchMedia + 'change' listener; false เมื่อไม่มี matchMedia
export function useIsDesktop(): boolean;               // = useMediaQuery(DESKTOP_QUERY)
```
- ค่าเริ่มต้นอ่านจาก `matchMedia` แบบ sync ตอน render แรก (ไม่กระพริบ mobile→desktop)
- **test helper** `src/test/mockMatchMedia.ts`: `mockMatchMedia(width: number)` ใช้ใน test ทุก prompt เพื่อจำลองจอ 375 / 768 / 1280

### 3.3 Layout
- `src/components/layout/SideNav.tsx` — `export function SideNav(): JSX.Element`
  - รายการเมนูเดียวกับ TabBar (ย้าย `ITEMS` ไป `src/components/layout/navItems.ts` ให้ทั้งสองใช้ร่วม)
  - ด้านบน: ชื่อ "SubTracker" · ปุ่มหลัก **"+ เพิ่มรายการ"** → `navigate('/?add=1')` · ด้านล่าง: `ThemeSwitch`
  - active = สีเท่านั้น ไม่มี motion (กฎเดียวกับ TabBar)
- `AppShell`:
  - mobile/tablet: เหมือนเดิม แต่ `max-w-phone md:max-w-tablet`
  - desktop: `SideNav` (sticky เต็มสูง, border ขวา) + `<main>` เลื่อนเอง, เนื้อหาใน `mx-auto max-w-content`, padding แนวนอน 32px (`lg:px-8`)
  - Toaster: desktop ไม่ต้องเว้น `--tabbar-h` (offset ล่างปกติ)
- **Page container:** แต่ละหน้าจัด grid ของตัวเองภายใน `<main>` · ใช้ `lg:grid lg:grid-cols-[...]` ได้เฉพาะค่าที่อ้าง token (เช่น `lg:grid-cols-[minmax(0,1fr)_360px]` อนุญาต **[call]** — เป็นข้อยกเว้นเดียวของกฎ arbitrary value: ใช้ได้เฉพาะ `grid-cols-*`)

### 3.4 ฟอร์ม — `BottomSheet` เปลี่ยนตามจอ (API เดิม ไม่เปลี่ยน props)
- mobile/tablet: bottom sheet เหมือนเดิม
- desktop: Vaul `direction="right"` · แผงสูงเต็มจอ ชิดขวา กว้าง `w-panel` · มุมซ้าย `rounded-l-card` · ไม่มี handle bar · Esc / คลิก overlay ปิดได้
- focus: บันทึก element ที่เปิด (`document.activeElement` ตอน `open` เปลี่ยนเป็น `true`) และคืนโฟกัสกลับผ่าน `onCloseAutoFocus` ตอนปิด (Esc / คลิก overlay / ปุ่มปิด) เพราะ controlled drawer ไม่มี `<Drawer.Trigger>`
- motion: แผงเลื่อนจากขวา (transform เท่านั้น) ใช้ `--dur-sheet` / `--ease-drawer` เหมือนเดิม · reduced-motion → fade
- ทุกหน้าที่ใช้ `BottomSheet` ได้ผลนี้อัตโนมัติ — ห้ามหน้าไหนสร้าง dialog เอง

> หมายเหตุจากการตรวจภาพ (`06-integration`): `SegmentedControl` ที่มี 4 ตัวเลือกขึ้นไป (เช่น ตัวกรองช่องทางใน `/entries`) ใช้ `truncate px-1.5 text-sm` บน `<768px` และกลับเป็น `px-3 text-base` บน `md` ขึ้นไป เพื่อไม่ให้ป้ายตัดบรรทัดหรือล้นขอบบนจอ `375px` (กลุ่ม 2–3 ตัวเลือกคงเดิมทุกประการ)

### 3.5 Quick add จาก SideNav
- `/?add=1` → หน้าภาพรวมเปิด `QuickAddSheet` แล้วลบ `add` ออกจาก URL (`replace`) เพื่อกด back ไม่เปิดซ้ำ (prompt 01 ทำฝั่งรับ)

## 4. หน้าจอบนคอม **[call]**

| หน้า | desktop (≥1024) | tablet | mobile |
|---|---|---|---|
| ภาพรวม `/` | 2 คอลัมน์: ซ้าย = หัวรอบ + การ์ดก้อนเงิน (2 ใบเรียงข้างกัน) + AllocationBar · ขวา 360px = "ใกล้ครบกำหนด" + "รายการล่าสุด" (5 รายการ) | คอลัมน์เดียว, การ์ดก้อนเงิน 2 ใบข้างกัน | เดิม |
| บิล & ผ่อน `/bills` | SegmentedControl ด้านบน · ซ้าย = รายการ (แถวเดียวมีครบ: วันที่, ชื่อ, ช่องทาง, ก้อน, ยอด) · ขวา 360px = สรุปยอดต่อช่องทางในรอบนี้ | คอลัมน์เดียว | เดิม |
| รายการ `/entries` | ซ้าย 240px = ตัวกรอง (รอบ, ก้อน, ช่องทาง) แบบ sticky · ขวา = รายการจัดกลุ่มตามวัน | ตัวกรองเป็น chip ด้านบน (เหมือนมือถือ) | เดิม |
| ตั้งค่า `/settings` | การ์ด section เรียง 2 คอลัมน์ (`lg:grid-cols-2`) | คอลัมน์เดียว | เดิม |
| ล็อกอิน `/login` | การ์ดกลางจอ กว้าง 400px (ทำอยู่แล้ว — ตรวจเฉย ๆ) | เดิม | เดิม |

- hover บนแถว/การ์ดที่กดได้: ใช้ `hover-fine:` ที่มีอยู่ (เปลี่ยนสีพื้น) เท่านั้น
- ตัวเลขเงินบนคอมใช้ขนาดเดิม — ห้ามขยาย font เพิ่ม

## 5. Animation ในหน้าจริง

ใช้ของที่มีแล้วเท่านั้น (`src/components/ui/AnimatedRow.tsx`, `AnimatedMoney.tsx`, `.pressable`, `notify` / Toaster)

| ที่ | อะไร |
|---|---|
| ทุกลิสต์ที่เพิ่ม/ลบได้ (รายการ, subscription, ผ่อน, บิลที่กดจ่าย, ช่องทาง, ก้อน) | `AnimatedRow` enter เมื่อเพิ่ม · exit เมื่อลบ/จ่าย · **ไม่ animate ตอนโหลดครั้งแรก** (มีแค่แถวที่เพิ่มหลัง mount) |
| ยอด left/budget ของก้อนเงิน, ยอดรวมบิลรอบนี้, สรุปยอดต่อช่องทาง | `AnimatedMoney` |
| บันทึก / แก้ / ลบ / จ่ายบิล สำเร็จ | toast สั้น ภาษาไทย ("บันทึกแล้ว", "ลบแล้ว", "จ่ายบิลบัตรแล้ว") · ล้มเหลว → toast error พร้อมข้อความจาก repo |
| ปุ่ม/แถวที่กดได้ทั้งหมด | `.pressable` (ตรวจว่ามีครบ) |

กฎ: transform/opacity เท่านั้น · `prefers-reduced-motion` → opacity อย่างเดียว · ไม่มี animation ตอนเปลี่ยนแท็บ/route/breakpoint · `npm run check:motion` ต้องผ่าน

## 6. เก็บตก
- `src/auth/errors.ts`: แปล `email_provider_disabled` → "ยังไม่ได้เปิดการล็อกอินด้วยอีเมลใน Supabase" · `invalid_api_key`/401 → "ตั้งค่า Supabase key ไม่ถูกต้อง" + test
- ฟอนต์: precache เฉพาะ subset `thai` + `latin` ของ Manrope/Anuphan (ตอนนี้ 606 KiB ทุก subset) — เป้า < 300 KiB · ภาษาไทยต้องยังแสดงตอน offline

## 7. ความเป็นเจ้าของไฟล์ (ห้ามแตะไฟล์ของคนอื่น)

| Prompt | Branch | ไฟล์ของตัวเอง |
|---|---|---|
| 00 โครงหลัก | `p15/00-shell` | `tailwind.config.ts`, `src/styles/tokens.css`, `src/styles/motion.css`, `src/hooks/useMediaQuery.ts`, `src/test/mockMatchMedia.ts`, `src/components/layout/*`, `src/components/ui/BottomSheet.tsx`, `src/components/ui/Toaster.tsx` (+ test ของไฟล์เหล่านี้) |
| 01 ภาพรวม | `p15/01-overview` | `src/pages/overview/*` |
| 02 บิล & ผ่อน | `p15/02-bills` | `src/pages/bills/*` |
| 03 รายการ | `p15/03-entries` | `src/pages/entries/*` |
| 04 ตั้งค่า + ล็อกอิน | `p15/04-settings-login` | `src/pages/settings/*`, `src/pages/login/*`, `src/auth/errors.ts` (+ test) |
| 05 ฟอนต์ + PWA | `p15/05-perf` | `src/main.tsx` (เฉพาะ import ฟอนต์), `src/styles/fonts.css` (ถ้าต้องสร้าง), `vite.config.ts` (เฉพาะส่วน PWA), `README.md` §PWA |
| 06 รวม + ตรวจ | `p15/06-integration` | แก้ได้ทุกไฟล์ แต่เฉพาะจุดเพี้ยนที่เจอจากภาพหน้าจอ |

ลำดับ: **00 → merge → 01–05 พร้อมกัน → merge ทั้งหมด → 06**

## 8. Definition of Done (ทุก prompt)
- test ใหม่จำลองจอด้วย `mockMatchMedia` อย่างน้อย 375 และ 1280 สำหรับหน้าที่ทำ
- `npx vitest run` · `npx tsc --noEmit` · `npm run check:motion` · `npm run build` ผ่านทั้งหมด
- มือถือ 375px ต้องไม่เปลี่ยนจากเดิม (ยกเว้น animation) — แนบภาพหน้าจอ 375 / 768 / 1280 ใน PR
- PR เข้า `main` · ห้าม merge เอง ห้าม force-push
