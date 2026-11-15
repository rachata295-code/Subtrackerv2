# SubTracker v2 · เฟส 1 — แกนหลักใช้งานจริง (SPEC)

สถานะ: ร่างโดย Claude 2026-11-15 จากข้อมูลที่เจ้าของเล่าไว้ (ดู §1) · ทุกข้อที่มี **[call]** คือการตัดสินใจของ Claude ที่เจ้าของแก้ได้
Base: branch `main` หลัง merge PR #1 (design system) — ห้ามเริ่มก่อน merge

---

## 1. สิ่งที่เจ้าของล็อกไว้แล้ว (ห้ามเปลี่ยน)

- เงินเดือน **฿10,200** เข้าวันที่ **10** → **รอบเงินเดือน = วันที่ 10 ถึงก่อนวันที่ 10 เดือนถัดไป**
- ช่องทางจ่าย:
  - **บัญชีธนาคาร** — ใช้จ่ายรายวันเป็นหลัก ไม่มีรอบบิล
  - **บัตรเครดิต** — ใช้กับ subscription · รอบบิล 10 → 10 · **ครบกำหนดจ่ายวันที่ 24**
  - **SPayLater** — ใช้กับของผ่อน · นับยอด **1–31 ของเดือน** · **จ่ายภายในวันที่ 10 เดือนถัดไป** (จ่ายจากบัญชี)
- **ก้อนใช้ตามใจ ฿3,000 ต่อรอบ** ใช้จ่าย: บิลบัตร + บิล SPayLater + เงินใช้เล่น · **เหลือเท่าไหร่ยกไปเพิ่มก้อนรอบหน้า**
- รายการผ่อนแต่ละรายการ **เลือกได้** ว่านับรวมในก้อนใช้ตามใจหรือแยก (สวิตช์ "นับรวมในวงเงินใช้ตามใจ")
- เพิ่มช่องทางจ่าย / บัตรใบใหม่ได้เองโดยไม่แก้โค้ด
- หน้าตา/animation ใช้ design system เฟส 0 เท่านั้น (`src/components/ui/*`, tokens) — ห้ามสร้างสไตล์ใหม่นอก token

## 2. การตัดสินใจของ Claude **[call]** (แก้ได้)

- **ล็อกอิน:** Supabase Auth แบบ email + password (ปิด "Confirm email") — ไม่ต้องใช้ระบบส่งอีเมล · เปิด RLS ทุกตาราง ด้วย `user_id = auth.uid()` · มีผู้ใช้คนเดียวแต่ข้อมูลไม่เปิด public แบบ v1 อีกต่อไป
- **Supabase project ใหม่** (ไม่ใช้ของ v1) · v1 ย้ายข้อมูลด้วยสคริปต์ครั้งเดียว (§7 prompt 07)
- เงินเก็บเป็น **satang (integer)** ในโค้ด domain · ฐานข้อมูลเก็บ `numeric(12,2)` แล้วแปลงที่ data layer
- วันที่: เขตเวลา **Asia/Bangkok** เสมอ · domain รับ `now` เป็นพารามิเตอร์ (test ได้ ไม่ขึ้นกับ TZ เครื่อง)
- เงิน "ยกยอด" **คำนวณจากประวัติ** ไม่เก็บเป็นตัวเลขตาย (ป้องกันเลขเพี้ยนเมื่อแก้รายการย้อนหลัง)
- **กฎกันนับซ้ำ:** ค่า subscription ที่ตัดบัตรแสดงในปฏิทินเป็น "เข้าบิล" (ข้อมูล) แต่ **ยอดรวมเงินออกนับเฉพาะบิลบัตร** ไม่นับ charge ซ้ำ

---

## 3. โมเดลข้อมูล (สัญญากลาง — ห้ามแก้ชื่อโดยไม่อัปเดตไฟล์นี้)

TypeScript อยู่ที่ `src/types/finance.ts` (สร้างโดย prompt 00) · SQL อยู่ที่ `supabase/schema.sql` (prompt 01)

```ts
type Satang = number;            // integer
type ISODate = string;           // 'YYYY-MM-DD' (Asia/Bangkok)
type PeriodKey = string;         // 'YYYY-MM' = เดือนที่รอบ "เริ่ม" เช่น รอบ 10 พ.ย.–9 ธ.ค. = '2026-11'
type Hue = 'sky'|'apricot'|'teal'|'stone'|'lilac'|'rose';

interface Settings { userId: string; salary: Satang; payDay: number /*1-31, =10*/; }

type SourceKind = 'bank' | 'credit_card' | 'paylater';
interface PaymentSource {
  id: string; name: string; kind: SourceKind; hue: Hue; archived: boolean;
  // รอบบิล: bank = null ทั้งหมด
  statementCloseDay: number | null;   // บัตร = 10 · SPayLater = null (ใช้ทั้งเดือนปฏิทิน)
  dueDay: number | null;              // บัตร = 24 · SPayLater = 10
  dueMonthOffset: 0 | 1 | null;       // เดือนของวันครบกำหนดเทียบกับเดือนที่รอบบิลปิด: บัตร 0 (ปิด 10 → จ่าย 24 เดือนเดียวกัน) · SPayLater 1
  payFromSourceId: string | null;     // บิลนี้จ่ายจากบัญชีไหน (บัญชีธนาคาร)
}

interface Pot { id: string; name: string; perPeriod: Satang; rollover: boolean; hue: Hue; }
// ค่าเริ่มต้น: 'ใช้ตามใจ' 3,000 rollover=true teal · 'ใช้จ่ายจำเป็น' 7,200 rollover=false stone

interface Subscription {
  id: string; name: string; amount: Satang; frequency: 'monthly'|'yearly';
  billingDay: number; billingMonth: number | null /*yearly only, 1-12*/;
  sourceId: string; potId: string | null; active: boolean;
}

interface Installment {
  id: string; name: string; perInstallment: Satang; count: number; // เช่น 10 งวด
  firstChargeDate: ISODate;        // วันที่งวดแรกถูกนับในรอบบิลของ source
  sourceId: string; potId: string | null; // potId = null → "แยก" ไม่นับในก้อน
}

interface Transaction {           // รายจ่าย/รายรับที่จดเอง
  id: string; date: ISODate; amount: Satang; direction: 'out'|'in';
  sourceId: string; potId: string | null; category: Category; note: string;
}
type Category = 'food'|'transport'|'shopping'|'entertainment'|'health'|'bills'|'other';

interface BillPayment {           // กด "จ่ายแล้ว"
  id: string; sourceId: string; statementKey: PeriodKey; amount: Satang; paidOn: ISODate;
}
```

## 4. Domain (ฟังก์ชันบริสุทธิ์ — `src/domain/*`, prompt 02)

| ฟังก์ชัน | ไฟล์ | สัญญา |
|---|---|---|
| `payPeriod(date: ISODate, payDay: number): { key: PeriodKey; start: ISODate; end: ISODate }` | `period.ts` | end = วันก่อน payDay เดือนถัดไป · payDay 31 ในเดือนสั้น → วันสุดท้ายของเดือน |
| `statementFor(src: PaymentSource, chargeDate: ISODate): { key; start; end; dueDate: ISODate }` | `statement.ts` | **key = เดือนที่รอบบิลปิด ('YYYY-MM')** · บัตร (closeDay 10): รอบ = 10 เดือน M ถึง 9 เดือน M+1, ปิด 10 เดือน M+1, due = 24 เดือน M+1 (offset 0 จากเดือนปิด) — เช่น charge 25 ต.ค., 1 พ.ย., 3 พ.ย. → key '2026-11', due 24 พ.ย. · charge วันที่ 10 พ.ย. → key '2026-12' · SPayLater (closeDay null): รอบ = เดือนปฏิทินของ chargeDate, key = เดือนนั้น, due = 10 เดือนถัดไป (offset 1) · ผลข้างต้นต้องเป็น test |
| `subscriptionCharges(sub, from, to): {date; amount}[]` | `subscription.ts` | รายเดือน/รายปี · billingDay เกินวันในเดือน → วันสุดท้าย |
| `installmentSchedule(inst): {n; chargeDate; amount}[]` | `installment.ts` | n = 1..count ทุกเดือน วันเดิม |
| `billAmount(src, statementKey, data): Satang` | `bills.ts` | Σ transactions(out) + subscription charges + installment charges ที่ตกในรอบบิลนั้น |
| `upcomingOutflows(data, today, days=30): Outflow[]` | `bills.ts` | รายการบิล (นับในยอด) + charge ข้อมูล (`counted:false`) เรียงตามวัน · บิลที่จ่ายแล้วไม่แสดง · `Outflow = {date, dueBy:boolean, title, amount, sourceId, kind:'bill'|'charge', counted:boolean, statementKey?}` |
| `potStatus(pot, periodKey, data): { carryIn; budget; reserved; spent; left; over:boolean }` | `pots.ts` | budget = perPeriod + carryIn · reserved = บิลที่ครบกำหนดในรอบนี้ซึ่ง charge ถูกนับใน pot นี้และยังไม่จ่าย · spent = รายจ่ายจดเองใน pot + บิลที่จ่ายแล้ว · left = budget − reserved − spent · carryIn = left ของรอบก่อน (ถ้า rollover; ติดลบก็ยกไป) · รอบแรกที่มีข้อมูล carryIn = 0 · **บิลอยู่ในรอบเงินเดือนไหน = `payPeriod(dueDate − 1 วัน)`** เพราะ due "ภายในวันที่ 10" ต้องจ่ายด้วยเงินเดือนก่อนหน้า (SPayLater due 10 ธ.ค. → รอบ '2026-11') |

`data` = `FinanceData { settings; sources; pots; subscriptions; installments; transactions; payments }`

**ตัวอย่างที่ต้องเป็น test (ตัวเลขจริงของเจ้าของ):** รอบ '2026-11' (10 พ.ย.–9 ธ.ค.) ก้อนใช้ตามใจ carryIn 541 → budget 3,541.00 · บิลบัตรจ่าย 24 พ.ย. = 1,077.00 (Claude 699 + Gemini 279 + iCloud 99) · SPayLater AirPods งวด 3/10 = 1,381.93 จ่ายภายใน 10 ธ.ค. · ใช้เล่น 420.00 → **left = 662.07** · กดจ่ายบิลบัตร → reserved ลด 1,077 · spent เพิ่ม 1,077 · left ยัง 662.07

## 5. Data layer (`src/data/*`, prompt 01)

- `src/lib/supabase.ts` client จาก `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `src/data/financeRepo.ts`: `loadFinanceData(): Promise<FinanceData>` + CRUD ต่อ entity (`createX`, `updateX`, `deleteX`) แปลง snake_case ↔ camelCase และ numeric ↔ Satang
- `src/hooks/useFinance.ts` (TanStack Query): `useFinanceData()` → `{ data?: FinanceData; isLoading; error }` + mutation hooks `useCreateTransaction()`, `usePayBill()`, `useUpsertSource()` ฯลฯ — ทุก mutation invalidate `['finance']`
- **Screens ใช้แค่ hooks เหล่านี้** · ระหว่างพัฒนาใช้ `src/fixtures/finance.ts` (prompt 00) ผ่าน `VITE_USE_FIXTURES=1`

## 6. หน้าจอ (ใช้ components เฟส 0 เท่านั้น)

| แท็บ | route | prompt | คำถามหลักของจอ |
|---|---|---|---|
| ภาพรวม | `/#/` | 04 | "รอบนี้เหลือใช้เล่นเท่าไหร่ และเงินจะออกเมื่อไหร่" (โครงเดียวกับ `/#/preview-home`) |
| บิล & ผ่อน | `/#/bills` | 05 | "บิลไหนต้องจ่ายเมื่อไหร่ ผ่อนเหลือกี่งวด" + เพิ่ม/แก้ subscription, รายการผ่อน |
| รายการ | `/#/entries` | 06 | ประวัติรายจ่าย/รับ กรองตามช่องทาง + เพิ่ม/แก้/ลบ (HoldToDelete) |
| ตั้งค่า | `/#/settings` | 06 | เงินเดือน, payDay, ช่องทางจ่าย (เพิ่มบัตรใหม่), ก้อนเงิน, ธีม, ออกจากระบบ |
| เข้าสู่ระบบ | `/#/login` | 03 | email + password |

`/#/design` และ `/#/preview-home` คงไว้ (ใช้อ้างอิง)

## 7. การแบ่งงาน (ไฟล์ของใครของมัน — ห้ามแก้ไฟล์ของ prompt อื่น)

| Prompt | ทำอะไร | เป็นเจ้าของไฟล์ | รอใคร |
|---|---|---|---|
| **00** contracts | types + fixtures + routes ว่าง | `src/types/finance.ts`, `src/fixtures/finance.ts`, `src/App.tsx` (routes), `src/pages/*/index.tsx` (placeholder) | — **ทำก่อนคนเดียว** |
| **01** Supabase + data | SQL + RLS + repo + hooks | `supabase/`, `src/lib/supabase.ts`, `src/data/`, `src/hooks/useFinance.ts` | 00 |
| **02** domain | ฟังก์ชัน §4 + test | `src/domain/` | 00 |
| **03** auth + shell | login, session guard, AppShell ใช้ TabBar | `src/auth/`, `src/pages/login/`, `src/components/layout/AppShell.tsx` | 00 |
| **04** ภาพรวม | จอ ภาพรวม | `src/pages/overview/` | 00 (ใช้ fixtures + domain stub) |
| **05** บิล & ผ่อน | จอ + ฟอร์ม sub/ผ่อน | `src/pages/bills/` | 00 |
| **06** รายการ + ตั้งค่า | 2 จอ + ฟอร์ม | `src/pages/entries/`, `src/pages/settings/` | 00 |
| **07** ย้ายข้อมูล v1 | สคริปต์ Node อ่าน export v1 → insert v2 | `scripts/migrate-v1/` | 00, 01 (schema) |
| **08** รวมงาน | ต่อ screens เข้า hooks จริง + domain จริง, ลบ stub, e2e ด่วน | ทุกไฟล์ (คนเดียว) | 01–07 |

**ลำดับ:** 00 → (01, 02, 03, 04, 05, 06 พร้อมกัน) → 07 → 08

## 8. Definition of Done (ทุก prompt)

- `npx vitest run` ผ่าน (output สะอาด) · `npx tsc --noEmit` · `npm run check:motion` · `npm run build`
- ไม่มี hex/arbitrary value ใน component · ไม่แก้ไฟล์นอกความเป็นเจ้าของ (§7)
- comment อธิบาย "ทำไม" เป็นภาษาอังกฤษ · ข้อความ UI ภาษาไทย
- commit บน branch ของตัวเอง (`p1/<เลข>-<ชื่อ>`) แล้วเปิด PR เข้า `main` · ไม่ merge เอง
