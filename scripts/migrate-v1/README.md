# ย้ายข้อมูลจาก SubTracker v1 → v2

สคริปต์นี้อ่านไฟล์ CSV ที่ export จาก Supabase โปรเจกต์ v1 (4 ตาราง) แล้วแปลงเป็นข้อมูลในโครงสร้าง v2 โดยทำงานแบบ **dry-run เป็นค่าเริ่มต้น** และจะเขียนลงฐานข้อมูลเฉพาะเมื่อระบุ `--apply` (ล็อกอินด้วย email/password ของเจ้าของผ่าน `anon` key + RLS)

## 1. Export ข้อมูลจาก Supabase v1

เปิด Supabase Dashboard ของโปรเจกต์ **v1** → **Table Editor** → เลือกแต่ละตารางแล้วกด **Export → Export as CSV** จากนั้นนำทั้ง 4 ไฟล์มาวางในโฟลเดอร์ `scripts/migrate-v1/input/` (โฟลเดอร์นี้ถูก gitignore ไว้แล้ว):

1. `scripts/migrate-v1/input/subscriptions.csv`
2. `scripts/migrate-v1/input/budget_settings.csv`
3. `scripts/migrate-v1/input/budget_entries.csv`
4. `scripts/migrate-v1/input/transfer_entries.csv`

> หมายเหตุ: หากตารางใดไม่มีข้อมูลเลย สามารถข้ามได้ (สคริปต์จะแจ้งเตือนและถือว่ามี 0 แถว) แต่ควรมีอย่างน้อย 1 ไฟล์ในโฟลเดอร์ `input/`

## 2. ทดสอบแปลงและตรวจยอด (Dry-run)

รันด้วย Node 22+:

```sh
node scripts/migrate-v1/migrate.mjs
```

หากใน `subscriptions.csv` มีรายการที่มีคำว่า `Airpod` (ไม่สนตัวพิมพ์เล็ก/ใหญ่) สคริปต์จะย้ายไปเป็น `Installment` บน `SPayLater` โดยระบุจำนวนงวดและวันคิดค่างวดแรกได้ผ่าน flag หรือตอบใน prompt:

```sh
node scripts/migrate-v1/migrate.mjs --airpods-count 10 --airpods-first 2026-09-01
```

(รองรับ `--airpods-first` ทั้งแบบ `YYYY-MM-DD` และ `YYYY-MM` ซึ่งจะใช้วันที่ `billing_day` ของแถวนั้นโดยอัตโนมัติ)

## 3. เขียนข้อมูลลง Supabase v2 (`--apply`)

ตั้งค่าตัวแปรสภาพแวดล้อมของโปรเจกต์ **v2** ใน `.env.local` หรือส่งผ่าน shell (ห้ามใช้ `service_role` key):

```sh
export VITE_SUPABASE_URL="https://<your-v2-project>.supabase.co"
export VITE_SUPABASE_ANON_KEY="<your-v2-anon-key>"
export MIGRATE_EMAIL="owner@example.com"
export MIGRATE_PASSWORD="your-password"

node scripts/migrate-v1/migrate.mjs --apply --airpods-count 10 --airpods-first 2026-09-01
```

## กฎการแปลงข้อมูล (Mapping)

| v1 ตาราง / เงื่อนไข | v2 ตาราง / ช่องทาง |
|---|---|
| `subscriptions` (ทั่วไป) | `subscriptions` · ช่องทาง `บัตรเครดิต` · ก้อน `ใช้ตามใจ` |
| `subscriptions` (ชื่อมี `Airpod`) | `installments` · ช่องทาง `SPayLater` · ก้อน `ใช้ตามใจ` |
| `budget_entries` (`payment_type = cash`) | `transactions` (`out`) · ช่องทาง `บัญชี` · ก้อน `ใช้ตามใจ` · `category` ตรงชื่อ |
| `budget_entries` (`payment_type = card`) | `transactions` (`out`) · ช่องทาง `บัตรเครดิต` · ก้อน `ใช้ตามใจ` · `category` ตรงชื่อ |
| `transfer_entries` (`direction = incoming`) | `transactions` (`in`) · ช่องทาง `บัญชี` · `category = other` |
| `transfer_entries` (`direction != incoming`) | ข้ามและรายงานในสรุป |
| `budget_settings.monthly_income` (> 0) | `settings.salary` |

## Idempotency (รันซ้ำได้ไม่สร้างซ้ำ)

- ทุกแถวสร้าง deterministic UUID (`id`) ผูกกับ `user_id` และคีย์จาก v1 (`row.id` หรือแฮชข้อมูลเมื่อไม่มีคอลัมน์ `id`)
- รายการ `transactions` จะต่อท้าย marker `[v1:budget:<id>]` หรือ `[v1:transfer:<id>]` ใน `note`
- ก่อน insert สคริปต์จะตรวจทั้ง `id` และ marker ในฐานข้อมูลเดิมเสมอ จึงรัน `--apply` ซ้ำได้โดยไม่เกิดข้อมูลซ้ำ
