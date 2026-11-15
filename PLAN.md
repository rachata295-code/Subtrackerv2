# SubTracker v2 · เฟส 0: Design System

**สถานะ: ✅ APPROVED โดยเจ้าของ (2026-11-15)**
วันที่: 2026-11-15

---

## 1. เจตนา (ทำไมต้องทำ)

SubTracker v1 (`qf6rrqnymb-dev.github.io`) เป็นแอปการเงินส่วนตัวที่ใช้งานจริงทุกวัน แต่โครงข้อมูล
รู้จักแค่ "เงินสด/บัตร" และหน้าตายังไม่ถึงระดับที่อยากใช้จริงจัง เจ้าของตัดสินใจ **สร้าง v2 ใหม่ทั้งหมด
ใน repo ใหม่ บนบัญชี GitHub อีกบัญชี** และขอเริ่มจาก **design system ก่อน** เพื่อให้ทุกหน้าที่จะสร้าง
ในเฟสถัดไป (ภาพรวม, รายการ, บิล & ผ่อน, ตั้งค่า) ใช้ภาษาภาพและการเคลื่อนไหวชุดเดียวกันตั้งแต่วันแรก

ผู้ใช้: คนเดียว (เจ้าของ) · เปิดบนมือถือเป็นหลักผ่าน PWA (Add to Home Screen บน iOS) · เปิดดูหลายครั้งต่อวัน
แบบแวบดู + จดรายการ

### เป้าหมาย
- ชุดค่ากลาง (tokens) สี ตัวอักษร ระยะ มุมโค้ง การเคลื่อนไหว — ทั้ง **โหมดสว่างและโหมดมืด**
- ชิ้นส่วน UI พื้นฐาน (components) ที่หน้าจอในเฟส 1 ต้องใช้ พร้อม state ครบ (hover/press/focus/disabled/empty/loading/error)
- **Animation** เป็นส่วนหนึ่งของ design system ไม่ใช่ของแต่งทีหลัง
- หน้า showcase หน้าเดียวที่เปิดดู/กดเล่นทุกชิ้นได้ และหน้า "ภาพรวม" ตัวอย่างที่ประกอบจากชิ้นส่วนจริง

### ไม่ใช่เป้าหมาย (เฟสนี้)
- โมเดลข้อมูล, Supabase, ล็อกอิน, หน้าจอจริงที่ใช้ข้อมูลจริง → เฟส 1
- ย้ายข้อมูลจาก v1 → เฟส 1
- การแจ้งเตือน, รายงาน → เฟส 2–3

### Anti-goals (ถ้าเป็นแบบนี้ถือว่าล้มเหลวแม้จะ "ทำงานได้")
- animation ที่ทำให้แอปรู้สึก **ช้าลง** สำหรับสิ่งที่ทำบ่อย (สลับแท็บ, เปิดแอป, จดรายการ)
- หน้าตาที่ดูเป็น template ทั่วไป (KPI การ์ดมีไอคอนในวงกลม, gradient, เงา, สีรุ้ง)
- โหมดมืดที่เป็นแค่ "กลับสี" แล้วอ่านยาก หรือ tile สีพาสเทลจ้าบนพื้นดำ
- ตัวอักษรไทยแสดงด้วยฟอนต์ fallback ของระบบ (ฟอนต์ไม่โหลดเมื่อออฟไลน์)

---

## 2. การตัดสินใจที่เจ้าของล็อกแล้ว

| # | เรื่อง | คำตอบ |
|---|---|---|
| D1 | แนวทางสร้าง | **ค.** repo ใหม่จากศูนย์ บนบัญชี GitHub อีกบัญชี |
| D2 | เริ่มจากอะไร | design system ก่อน |
| D3 | หน้าตา | **B · Pastel consumer** (เลือกจาก mockup 3 แบบ) |
| D4 | โหมดมืด | **มี** |
| D5 | Animation | **มี** และเป็นส่วนหนึ่งของ design system |

## 3. แนวทางที่พิจารณา (Approaches)

**หน้าตา** — มี 3 ตัวเลือกใน mockup (`.superpowers/brainstorm/.../visual-style.html`):
- A · Achromatic ledger — ขาวดำ สีเดียวบนข้อมูลหลัก: นิ่ง จริงจัง แต่แยกช่องทางจ่ายด้วยสีไม่ได้
- **B · Pastel consumer — เลือก:** สีอ่อนรายช่องทาง (บัตร/SPayLater/ใช้เล่น) ทำให้คำถามหลักของแอป
  "เงินก้อนนี้ไปไหนบ้าง" อ่านออกด้วยสีทันที
- C · ต่อยอดสีเดิม (หินอุ่น + เขียวหม่น): คุ้นเคย แต่ไม่ได้แยกช่องทางด้วยสี

**การสร้าง** — เจ้าของเลือก repo ใหม่ (ค.) แทนการต่อเติม v1 (ก.) หรือเขียนใหม่ใน repo เดิม (ข.)

---

## 4. Stack (การตัดสินใจของผม — แก้ได้)

- Vite + React 18 + TypeScript (strict) + Tailwind CSS v3 — ตาม v1 ที่เจ้าของคุ้นเคย
- **ค่ากลางอยู่ที่ CSS custom properties ที่เดียว** (`src/styles/tokens.css`) แล้ว Tailwind config อ้างถึง
  ตัวแปรเหล่านั้น (`colors: { ground: 'rgb(var(--ground) / <alpha-value>)' ... }`) — โหมดมืดจึงเป็นแค่
  การสลับชุดตัวแปร ไม่ต้องเขียน `dark:` ทุก class
- ฟอนต์ self-host ผ่าน `@fontsource` (Manrope + Anuphan) เพื่อให้ทำงานออฟไลน์ใน PWA — ไม่ใช้ Google Fonts CDN
- Bottom sheet: **Vaul** · Toast: **Sonner** (ทั้งคู่สร้างตามหลักที่ใช้ในเฟสนี้อยู่แล้ว ไม่ต้องเขียน gesture เอง)
- animation อื่นทั้งหมดใช้ **CSS transition** (ไม่ใส่ Motion/Framer เว้นแต่ builder พิสูจน์ได้ว่าจำเป็น)
- Vitest + Testing Library สำหรับ logic ของ components (format เงิน, theme)
- **PWA ขั้นพื้นฐานอยู่ในเฟสนี้** **[การตัดสินใจของผม]:** `vite-plugin-pwa` (manifest + service worker precache รวมไฟล์ฟอนต์)
  + meta tag สำหรับ Add to Home Screen บน iOS — จำเป็นต่อเกณฑ์ "ฟอนต์ไทยแสดงตอนออฟไลน์" และ safe-area ของ TabBar
- **Deploy:** ยังไม่รู้ชื่อ repo → ตั้ง Vite `base` จาก env (`VITE_BASE`, ค่าเริ่มต้น `/`) และใช้ HashRouter
  เพื่อให้ย้ายไป GitHub Pages แบบ sub-path หรือ root ได้โดยไม่ต้องแก้โค้ด
- **จอกว้าง (768 / 1440)** **[การตัดสินใจของผม]:** แอปนี้ออกแบบสำหรับมือถือ จอกว้างแสดงเป็นคอลัมน์กลางกว้างสูงสุด 480px
  บนพื้น `ground` (TabBar อยู่ล่างคอลัมน์เหมือนมือถือ) ไม่ทำ layout แท็บเล็ต/เดสก์ท็อปแยก — ถ้า `inspect.mjs`
  เตือนเรื่องพื้นที่ว่างด้านข้าง ให้ใช้ `--allow` เฉพาะกฎนั้นและบันทึกเหตุผลไว้
- เครื่องมือตรวจ: `taste-skill` `lint.mjs --app` และ `inspect.mjs --app` บนหน้า showcase

---

## 5. Tokens

### 5.1 สี — โหมดสว่าง (จาก sheet `pastel-consumer` seed 1704861195)

| Role | ค่า | ใช้กับ |
|---|---|---|
| `ground` | `#f3f5f7` | พื้นแอป |
| `surface` | `#ffffff` | การ์ด, แถบเมนูล่าง |
| `raised` | `#f2f8fd` | พื้นที่ยกเล็กน้อยในการ์ด |
| `border` | `#e6e6e6` | ขอบการ์ด 1px |
| `rule` | `#f4f4f4` | เส้นแบ่งแถว (ถ้ามี) |
| `control` | `#d6d9dd` | ขอบ input / control |
| `text` | `#1b1d1f` | ตัวหนังสือหลัก, ตัวเลขเงิน |
| `muted` | `#5c6064` | ตัวหนังสือรอง |
| `accent` | `#1d5fd6` | ปุ่มหลัก 1 ปุ่มต่อจอ, focus ring |
| `positive` | `#2f7a45` | รายรับ (มี `+` เสมอ) |
| `negative` | `#c41c29` | **เฉพาะ** เกินงบ / error — ไม่ใช้กับรายจ่ายปกติ |
| `warning` | `#92400e` | ใกล้เกินงบ |

### 5.2 สี — โหมดมืด (ผมเสนอ — builder ตรวจ contrast แล้วปรับได้ภายในกติกา)

กติกา: พื้นเป็นเทากลางจริง (ห้ามน้ำเงินเข้ม/navy) · แยกชั้นด้วยความสว่าง ไม่ใช้เงา · tile ใช้สีเข้มของเฉดนั้น
กับตัวหนังสือสีอ่อนของเฉดเดียวกัน (กลับด้านกับโหมดสว่าง)

| Role | ค่า |
|---|---|
| `ground` | `#111214` |
| `surface` | `#1a1c1f` |
| `raised` | `#222529` |
| `border` | `#2a2d31` |
| `rule` | `#222529` |
| `control` | `#3a3e44` |
| `text` | `#eceef0` |
| `muted` | `#9aa0a6` |
| `accent` | `#5b95ec` |
| `positive` | `#5cc285` |
| `negative` | `#f0646e` |
| `warning` | `#f0a35c` |

### 5.3 สีช่องทาง / หมวด (tile tints)

แต่ละ "ช่องทางจ่าย" หรือ "ก้อน" มี 1 เฉด ประกอบด้วย 3 ค่า: `bg` (พื้น tile), `ink` (ตัวหนังสือบน tile),
`mark` (สีบนแถบสัดส่วน/จุด ต้อง ≥3:1 กับ surface)

| เฉด | ใช้เริ่มต้นกับ | สว่าง bg / ink / mark | มืด bg / ink / mark |
|---|---|---|---|
| `sky` | บัตรเครดิต | `#dcf1ff` / `#0a3a80` / `#4d8fe0` | `#12304f` / `#cfe6ff` / `#5b9ae8` |
| `apricot` | SPayLater | `#ffeedd` / `#7a3306` / `#e58a3c` | `#43240c` / `#ffd9b8` / `#ee9a50` |
| `teal` | ก้อนใช้เล่น | `#dcf5ee` / `#0e4a3c` / `#2a8798` | `#0f3a33` / `#c6efe4` / `#3fa3b3` |
| `stone` | บัญชี / ใช้ไปแล้ว | `#eef1f4` / `#3a3d40` / `#c3c8ce` | `#24272b` / `#d5d9de` / `#6b7178` |
| `lilac`* | สำรอง ช่องทางที่ 5 | builder เลือก | builder เลือก |
| `rose`* | สำรอง ช่องทางที่ 6 | builder เลือก | builder เลือก |

**[การตัดสินใจของผม]** ค่า `mark` ในตารางเป็นค่าตั้งต้น — `stone` (#c3c8ce ≈1.7:1) และ `apricot` (#e58a3c ≈2.9:1)
บนพื้นขาวยังไม่ถึง 3:1 builder **ต้องปรับค่า mark ทั้งสองธีมให้ ≥3:1 กับ surface** โดยคงเฉดสี (hue) เดิม
(เช่น ทำ stone ให้เข้มขึ้นเป็นเทากลาง, apricot ให้เข้มขึ้นเป็นส้มอิฐ) ค่า `bg`/`ink` ของ tile ปรับได้เท่าที่จำเป็นเพื่อผ่าน 4.5:1

\* เฉดสำรองต้องห่างจากเฉดอื่น ≥40° บนวงสี · **ห้าม violet/indigo** (กติกาของ taste-skill)
· สีเฉดถูกผูกกับ "ช่องทาง" ไม่ใช่ "หมวดรายจ่าย" (หมวดอาหาร/เดินทางไม่มีสีของตัวเอง)

### 5.4 ตัวอักษร

- ตัวเลขและภาษาอังกฤษ: **Manrope** 400/500/600 · ภาษาไทย: **Anuphan** 400/500/600
- `font-family: "Manrope", "Anuphan", system-ui, sans-serif` (Manrope ไม่มีตัวไทย → ตัวไทยตกไป Anuphan เอง)
- ขนาด (มือถือ): title 26 · section 18 · money-xl 36 · money 17 · body 16 · small 14 · meta 12 (ห้ามต่ำกว่า 12)
- ตัวเลขทุกจุดใช้ `font-variant-numeric: tabular-nums` และชิดขวาเมื่ออยู่ในคอลัมน์
- สตางค์แสดงเล็กลงและเป็นสี muted ในตัวเลขใหญ่ (`฿662` `.07`)

### 5.5 ระยะ มุมโค้ง ขนาด

- มุม: การ์ด 20 · tile/control 12 · ป้าย (pill) 8 · จุด 2 — ใช้เท่านี้เท่านั้น
- gap หลักระหว่างการ์ด: 14 · padding การ์ด: 16 · ขอบจอ: 16
- ปุ่ม/แถวกดได้สูง ≥44px · ไม่มีเงาบนอะไรที่อยู่นิ่ง (เงาเฉพาะ sheet, toast, menu)

### 5.6 Motion tokens

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);    /* เข้า/ออก, feedback */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* ของที่ขยับบนจอ */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* bottom sheet */
--dur-press: 140ms;  --dur-fast: 180ms;  --dur-base: 240ms;  --dur-sheet: 360ms;
```

---

## 6. Animation — กติกา

ตัดสินจาก "ผู้ใช้เห็นบ่อยแค่ไหน" ก่อนเสมอ แอปนี้เปิดหลายครั้งต่อวัน → **เร็ว เบา และมีเหตุผลทุกจุด**

| จุด | ความถี่ | ทำอะไร |
|---|---|---|
| กดปุ่ม / tile / แถว | บ่อยมาก | `scale(0.97)` ตอนกด `--dur-press` ease-out — feedback อย่างเดียว |
| สลับแท็บล่าง | บ่อยมาก | **ไม่ animate เนื้อหา** — เปลี่ยนทันที; มีแค่สีไอคอนเปลี่ยน |
| เปิดแอป / โหลดหน้า | บ่อยมาก | **ไม่มี entrance** ไม่มี stagger ตอนโหลด |
| Segmented control (เช่น ทั้งหมด/บัตร/SPayLater) | บ่อย | ก้อนพื้นหลังเลื่อนตาม (transform) `--dur-fast` ease-in-out |
| Bottom sheet (เพิ่มรายการ, ดูรายละเอียด) | ปานกลาง | เลื่อนขึ้น `translateY(100%)→0` `--dur-sheet` ease-drawer, ปิดเร็วกว่าเปิด, ปัด/สะบัดลงเพื่อปิดได้ (Vaul) |
| ตัวเลขเงินเปลี่ยน (เช่น หลังกด "จ่ายแล้ว") | ปานกลาง | crossfade + blur 2px `--dur-base` — บอกว่าค่าเปลี่ยน |
| แถบสัดส่วนเปลี่ยน | ปานกลาง | แต่ละช่วงขยับด้วย transform `--dur-base` ease-in-out |
| แถวใหม่ที่ผู้ใช้เพิ่ม / แถวที่ลบ | ปานกลาง | เข้า: opacity + `translateY(8px)` `--dur-fast`; ออก: เร็วกว่าเข้า |
| Toast (บันทึกแล้ว / เลิกทำ) | ปานกลาง | Sonner ค่าเริ่มต้น (400ms ease) ปัดทิ้งได้ |
| กด "จ่ายแล้ว" ครบงวด | นานๆ ครั้ง | ช่วงเดียวที่ให้ "ดีใจ" ได้นิดหนึ่ง: ไอคอนเช็ควาดตัว + แถวยุบออก ≤500ms |
| ลบรายการ | นานๆ ครั้ง | กดค้างเพื่อลบ (overlay `clip-path` 1.2s linear ตอนกด, ปล่อยแล้วถอย 200ms ease-out) |
| สลับธีม สว่าง/มืด | นานๆ ครั้ง | เปลี่ยนทันที ไม่ animate สี |

กติกาเทคนิค:
- animate ได้แค่ `transform` และ `opacity` (ยกเว้น `clip-path` / `filter: blur` ในจุดที่ระบุ)
- ห้าม `transition: all` · ห้าม `ease-in` · ห้ามเริ่มจาก `scale(0)`
- hover effect ต้องอยู่ใต้ `@media (hover: hover) and (pointer: fine)`
- `prefers-reduced-motion: reduce` → ตัดการเคลื่อนที่ทั้งหมด เหลือ opacity สั้นๆ
- ใช้ CSS transition (หยุดกลางทางได้) แทน keyframes สำหรับสิ่งที่กดซ้ำเร็วๆ

---

## 7. Components ที่ต้องมี

แต่ละชิ้นต้องมีครบ: ทั้งสองธีม · default/hover/press/focus-visible/disabled · และ state ข้อมูลที่เกี่ยวข้อง

| Component | หมายเหตุ |
|---|---|
| `Button` | primary (accent, 1 ต่อจอ), secondary (stone tint), ghost, danger · ขนาด md/lg · icon-only ต้องมี aria-label |
| `IconButton` | ปุ่ม `+` บนหัวจอ |
| `Card` | surface + border + มุม 20 · ไม่มีเงา |
| `Tile` | พื้น tint ตามเฉด + ink เฉดเดียวกัน · label + ยอดเงิน · กดได้/กดไม่ได้ |
| `Pill` | ป้ายช่องทาง (บัตร/SPayLater) ใช้เฉดของช่องทาง |
| `Money` | แสดงเงินบาท: `฿` + คั่นหลักพัน + สตางค์ 2 หลัก · ขนาด xl/md/sm · สตางค์เล็ก+muted ใน xl · รายรับ `+` สีเขียว · รายจ่ายสีหมึก · ศูนย์แสดง `฿0.00` สี muted · ไม่มีค่าแสดง `—` |
| `AllocationBar` | แถบสัดส่วนหลายช่วง (เช่น บิลบัตร / SPayLater / ใช้ไปแล้ว / เหลือ) · ช่วงที่ 0 ไม่แสดง · เกิน 100% แสดงสถานะเกินชัดเจน |
| `ListRow` | 2 บรรทัด: ชื่อ + รายละเอียด (Pill ได้) · ยอดชิดขวา · leading เป็นวันที่หรือจุดสี · กดได้ |
| `DateBadge` | วัน + เดือนย่อไทย · รองรับช่วง "≤10" |
| `SectionHeader` | หัวข้อ + ลิงก์ "ดูทั้งหมด" |
| `SegmentedControl` | ก้อนพื้นหลังเลื่อนตาม · role=tablist |
| `TabBar` | 4 แท็บ (ภาพรวม / รายการ / บิล & ผ่อน / ตั้งค่า) · safe-area ด้านล่างสำหรับ PWA บน iOS |
| `BottomSheet` | ห่อ Vaul · มีหัว + ปุ่มปิด · โฟกัสถูกขังใน sheet |
| `TextField` / `CurrencyField` | label ด้านบน · ข้อความ error ใต้ช่อง ผูกด้วย `aria-describedby` · ช่องเงินเปิดแป้นตัวเลข (`inputmode="decimal"`) และรับคอมม่าได้ |
| `Switch` | เช่น "นับรวมในวงเงินใช้ตามใจ" |
| `Toast` | ห่อ Sonner + ปุ่ม "เลิกทำ" |
| `EmptyState` | ประโยคเดียวในกรอบเดิม ไม่มีภาพประกอบ ไม่มี emoji |
| `Skeleton` | สำหรับโหลด · ไม่กระพริบเร็ว |
| `ThemeProvider` + ตัวสลับธีม | ระบบ / สว่าง / มืด · จำค่าใน localStorage (ห่อ try/catch) · ตั้ง `<meta name="theme-color">` ตามธีม |

---

## 8. หน้า showcase (สิ่งที่ส่งมอบให้เห็นได้)

1. **`/#/design`** — ทุก component ทุก state ทั้งสองธีม (สลับธีมได้บนหน้า) พร้อม token ทั้งหมด
2. **`/#/preview-home`** — หน้า "ภาพรวม" ตัวอย่าง ประกอบจาก component จริงล้วน ใช้ข้อมูลตัวอย่างชุดเดียวกับ mockup:
   รอบ 10 พ.ย.–10 ธ.ค. · ก้อน 3,000 + ยกมา 541 = 3,541.00 · บิลบัตร 1,077.00 · SPayLater (AirPods 3/10) 1,381.93
   · ใช้เล่นไปแล้ว 420.00 · **เหลือใช้เล่น 662.07** (ต้องคำนวณจากแถว ไม่พิมพ์ตัวเลขตาย และ assert ว่ารวมได้ 3,541.00)
   · มีปุ่ม "จ่ายแล้ว" บนบิล 1 รายการเพื่อสาธิต animation ตัวเลขและแถบเปลี่ยน
   · **ความหมายของ "จ่ายแล้ว"** (ตามวิธีคิดเงินของเจ้าของ: เงินถูก "กันไว้" ตั้งแต่ต้นรอบ):
     กดจ่ายบิลบัตร 1,077.00 → ช่วงนั้นบนแถบเปลี่ยนจาก "กันไว้ (ยังไม่จ่าย)" เป็น "จ่ายแล้ว" (สีจางลง + เช็ค)
     แถวหายจากลิสต์ "เงินออก 30 วันข้างหน้า" · **"เหลือใช้เล่น" ไม่เปลี่ยน (662.07)** เพราะถูกกันไว้แล้ว
     · ตัวเลขที่ animate คือ "ยังต้องจ่ายอีก" (2,458.93 → 1,381.93) · ผลรวมยังคง 3,541.00
   · **`DateBadge` "≤10"** หมายถึง "จ่ายภายในวันที่ 10" (บิล SPayLater ที่มีกำหนดเป็นช่วง ไม่ใช่วันเดียว)
     API: `{ day, month, dueBy?: boolean }` → แสดง `≤10 ธ.ค.`

---

## 9. เกณฑ์ว่าเสร็จ (Definition of Done)

- [x] `npm run typecheck`, `npm run test:run`, `npm run test:tz`, `npm run check:motion`, `npm run build` ผ่าน
- [ ] ข้อความทุกคู่ (text บน surface, ink บน tile bg) contrast ≥4.5:1 · mark บน surface ≥3:1 — **ทั้งสองธีม** (มี test หรือสคริปต์ตรวจ)
- [x] `lint.mjs --app` และ `inspect.mjs --app` บน build จริง: 0 FAIL ที่ 390 / 768 / 1440
- [x] ฟอนต์ไทยแสดงถูกเมื่อปิดเน็ต (หลังโหลดครั้งแรก)
- [x] `npm run check:motion` ไม่พบ `transition: all` / `transition-all` / `scale(0)` · reduced-motion CSS ใน `src/styles/motion.css`
- [ ] ใช้งานด้วยคีย์บอร์ดได้ทุก control · focus มองเห็นชัดทั้งสองธีม (ยังต้องตรวจ VoiceOver + HoldToDelete บนอุปกรณ์จริง)
- [ ] เปิดบน iPhone (PWA) แล้ว TabBar ไม่ทับ home indicator

## 10. สถานะเฟส 1 และสิ่งที่ยกไปเฟส 2

### สถานะเฟส 1 (Complete — `p1/08-integration`)
- **Backend & Auth**: Supabase schema + RLS (`supabase/schema.sql`), `seed_defaults()` (`supabase/seed.sql`), email+password auth + route guard (`src/auth/`), repo & TanStack Query hooks (`src/data/financeRepo.ts`, `src/hooks/useFinance.ts` รวม `refetch` และ `useDeleteBillPayment`).
- **Domain logic**: ฟังก์ชันบริสุทธิ์ครบตาม `docs/phase1/SPEC.md §4` (`payPeriod`, `statementFor`, `subscriptionCharges`, `installmentSchedule`, `billAmount`, `upcomingOutflows`, `potStatus`) พร้อม test ตัวเลขจริง พ.ย. 2026 (`฿662.07`) และ timezone test (`Asia/Bangkok`, `UTC`).
- **หน้าจอหลักทั้ง 5 จอ**: ภาพรวม (`/#/`), บิล & ผ่อน (`/#/bills`), รายการ (`/#/entries`), ตั้งค่า (`/#/settings`), เข้าสู่ระบบ (`/#/login`) + app-level `ErrorBoundary` และ shared `SelectField` · เชื่อม hooks จริงและ domain จริง ไม่มี stub ค้าง.
- **CI/CD & Testing**: GitHub Actions deploy ไป GitHub Pages (`.github/workflows/deploy.yml` ตรวจ typecheck + test + test:tz + check:motion ก่อน deploy) และมี full-stack in-memory E2E test (`src/e2e/specFlow.test.tsx`); การทดสอบกับ Supabase จริงต้องใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env.local` / GitHub Secrets และสร้าง user ใน Auth.

### สิ่งที่ยกไปเฟส 2
- Export / Import ข้อมูลสำรอง (JSON) · รายงาน/กราฟเปรียบเทียบรายเดือน · นำเข้า statement อัตโนมัติ · แจ้งเตือนก่อนครบกำหนดบิล · รองรับหลายผู้ใช้/ก้อนเงินร่วมกัน
- เก็บงาน UX/PWA เชิงลึก: ทดสอบ safe-area บน iPhone PWA จริง · ปรับ VoiceOver activation บน `HoldToDelete` · ตัด font subset ให้เล็กลง · เปลี่ยน PWA placeholder icon เป็นไอคอนจริง

---

## 11. ที่ปล่อยให้ builder ตัดสินใจ

- โครงโฟลเดอร์ภายใน `src/`, ชื่อไฟล์, การแยก component
- ค่าเฉดสำรอง (lilac/rose) ภายในกติกา §5.3
- ปรับค่าสีโหมดมืดเล็กน้อยเพื่อให้ผ่าน contrast โดยคงกติกา §5.2
- ชุดไอคอน (outline 16–20px ชุดเดียว เช่น Lucide)

## 12. งานที่เจ้าของต้องทำเอง

- สร้าง repo ใหม่ในบัญชี GitHub อีกบัญชี แล้วส่งชื่อ repo มา (ระหว่างนี้งานอยู่ที่ `~/Developer/subtracker`
  และ init git ไว้ในเครื่องก่อน)
- ใส่ `.superpowers/` และ `.taste-skill/` ใน `.gitignore`
