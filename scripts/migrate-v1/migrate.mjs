#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  applyMigration,
  formatDryRunReport,
  hasAirpodsSubscription,
  mapV1CsvSet,
} from './mapper.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../..');
const DEFAULT_INPUT_DIR = join(SCRIPT_DIR, 'input');

const CSV_FILES = {
  subscriptions: 'subscriptions.csv',
  budget_settings: 'budget_settings.csv',
  budget_entries: 'budget_entries.csv',
  transfer_entries: 'transfer_entries.csv',
};

function printHelp() {
  console.log(`SubTracker v1 -> v2 Migration CLI (Node 22+)

การใช้งาน:
  node scripts/migrate-v1/migrate.mjs [options]

ตัวเลือก:
  --dry-run                  แสดงสรุปการแปลงข้อมูลโดยไม่เขียนลงฐานข้อมูล (ค่าเริ่มต้น)
  --apply                    ล็อกอินผ่าน Supabase Auth แล้วเขียนข้อมูลลงฐานข้อมูล v2
  --input <dir>              โฟลเดอร์ที่เก็บไฟล์ CSV ทั้ง 4 ตาราง (ค่าเริ่มต้น: scripts/migrate-v1/input)
  --airpods-count <จำนวน>    จำนวนงวดผ่อน AirPods (เช่น 10)
  --airpods-first <วันที่>   วันคิดค่างวดแรกของ AirPods (YYYY-MM-DD หรือ YYYY-MM เช่น 2026-09-01)
  -h, --help                 แสดงวิธีใช้งาน

ตัวแปรสภาพแวดล้อมสำหรับ --apply (อ่านจาก shell หรือ .env.local):
  VITE_SUPABASE_URL          (หรือ SUPABASE_URL)
  VITE_SUPABASE_ANON_KEY     (หรือ SUPABASE_ANON_KEY)
  MIGRATE_EMAIL              อีเมลเจ้าของบัญชี v2 (หรือ SUPABASE_USER_EMAIL)
  MIGRATE_PASSWORD           รหัสผ่านเจ้าของบัญชี v2 (หรือ SUPABASE_USER_PASSWORD)
`);
}

export function parseCliArgs(argv) {
  const args = {
    apply: false,
    help: false,
    inputDir: DEFAULT_INPUT_DIR,
    airpodsCount: undefined,
    airpodsFirst: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--apply') {
      args.apply = true;
    } else if (token === '--dry-run') {
      args.apply = false;
    } else if (token === '-h' || token === '--help') {
      args.help = true;
    } else if (token === '--input') {
      const next = argv[++i];
      if (!next) throw new Error('--input ต้องระบุพาธโฟลเดอร์');
      args.inputDir = resolve(process.cwd(), next);
    } else if (token.startsWith('--input=')) {
      args.inputDir = resolve(process.cwd(), token.slice('--input='.length));
    } else if (token === '--airpods-count') {
      const next = argv[++i];
      if (!next) throw new Error('--airpods-count ต้องระบุจำนวนงวด');
      args.airpodsCount = next;
    } else if (token.startsWith('--airpods-count=')) {
      args.airpodsCount = token.slice('--airpods-count='.length);
    } else if (token === '--airpods-first') {
      const next = argv[++i];
      if (!next) throw new Error('--airpods-first ต้องระบุวันที่งวดแรก');
      args.airpodsFirst = next;
    } else if (token.startsWith('--airpods-first=')) {
      args.airpodsFirst = token.slice('--airpods-first='.length);
    } else {
      throw new Error(`ไม่รู้จัก argument: ${token} (ใช้ --help เพื่อดูตัวเลือกทั้งหมด)`);
    }
  }

  return args;
}

/**
 * Load .env and .env.local without overwriting values already exported in the shell.
 */
export function loadEnvFiles(rootDir = REPO_ROOT) {
  for (const filename of ['.env', '.env.local']) {
    const filePath = join(rootDir, filename);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
}

function readInputCsvs(inputDir) {
  if (!existsSync(inputDir)) {
    throw new Error(`ไม่พบโฟลเดอร์ input: ${inputDir}`);
  }

  const csvTexts = {};
  const missingFiles = [];
  let foundCount = 0;

  for (const [key, filename] of Object.entries(CSV_FILES)) {
    const fullPath = join(inputDir, filename);
    if (existsSync(fullPath)) {
      csvTexts[key] = readFileSync(fullPath, 'utf8');
      foundCount++;
    } else {
      csvTexts[key] = '';
      missingFiles.push(filename);
    }
  }

  if (foundCount === 0) {
    throw new Error(
      `ไม่พบไฟล์ CSV ใน ${inputDir}\nกรุณา export 4 ตารางจาก Supabase v1 (subscriptions.csv, budget_settings.csv, budget_entries.csv, transfer_entries.csv) มาวางในโฟลเดอร์นี้`,
    );
  }

  return { csvTexts, missingFiles };
}

async function promptAirpodsIfNeeded(csvTexts, args) {
  if (!hasAirpodsSubscription(csvTexts.subscriptions)) {
    return { airpodsCount: args.airpodsCount, airpodsFirst: args.airpodsFirst };
  }

  let { airpodsCount, airpodsFirst } = args;
  if (airpodsCount !== undefined && airpodsFirst !== undefined) {
    return { airpodsCount, airpodsFirst };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'พบรายการ AirPods ใน subscriptions.csv — ในโหมด non-interactive ต้องระบุ --airpods-count <จำนวนงวด> และ --airpods-first <YYYY-MM-DD>',
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\nพบรายการ AirPods ใน subscriptions.csv (จะย้ายเป็น Installment บน SPayLater)');
    if (airpodsCount === undefined) {
      const answer = await rl.question('จำนวนงวดทั้งหมด (เช่น 10): ');
      airpodsCount = answer.trim();
    }
    if (airpodsFirst === undefined) {
      const answer = await rl.question('วันที่คิดค่างวดแรก (YYYY-MM-DD หรือ YYYY-MM เช่น 2026-09-01): ');
      airpodsFirst = answer.trim();
    }
  } finally {
    rl.close();
  }

  return { airpodsCount, airpodsFirst };
}

function readApplyConfigFromEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const email = (
    process.env.MIGRATE_EMAIL ||
    process.env.SUPABASE_USER_EMAIL ||
    process.env.SUPABASE_EMAIL ||
    ''
  ).trim();
  const password =
    process.env.MIGRATE_PASSWORD ||
    process.env.SUPABASE_USER_PASSWORD ||
    process.env.SUPABASE_PASSWORD ||
    '';

  const missing = [];
  if (!url) missing.push('VITE_SUPABASE_URL (หรือ SUPABASE_URL)');
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY (หรือ SUPABASE_ANON_KEY)');
  if (!email) missing.push('MIGRATE_EMAIL (หรือ SUPABASE_USER_EMAIL)');
  if (!password) missing.push('MIGRATE_PASSWORD (หรือ SUPABASE_USER_PASSWORD)');

  if (missing.length > 0) {
    throw new Error(
      `โหมด --apply ต้องตั้งค่าตัวแปรสภาพแวดล้อมให้ครบ:\n  - ${missing.join('\n  - ')}`,
    );
  }

  return { url, anonKey, email, password };
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  loadEnvFiles();
  const { csvTexts, missingFiles } = readInputCsvs(args.inputDir);
  if (missingFiles.length > 0) {
    console.warn(`หมายเหตุ: ไม่พบไฟล์ ${missingFiles.join(', ')} — ถือว่ามี 0 แถว`);
  }

  const { airpodsCount, airpodsFirst } = await promptAirpodsIfNeeded(csvTexts, args);

  if (!args.apply) {
    const mapped = mapV1CsvSet(csvTexts, { airpodsCount, airpodsFirst });
    console.log(formatDryRunReport(mapped, { applyMode: false }));
    console.log('\nหากตรวจสอบยอดถูกต้องแล้ว ให้รันด้วย --apply เพื่อเขียนลง Supabase v2');
    return;
  }

  const { url, anonKey, email, password } = readApplyConfigFromEnv();
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !authData.user) {
    throw new Error(`เข้าสู่ระบบ Supabase ไม่สำเร็จ: ${authError?.message ?? 'ไม่พบผู้ใช้'}`);
  }

  try {
    const mapped = mapV1CsvSet(csvTexts, {
      airpodsCount,
      airpodsFirst,
      userId: authData.user.id,
    });
    console.log(formatDryRunReport(mapped, { applyMode: true }));

    const result = await applyMigration(mapped, client, authData.user.id);
    console.log('\nผลการย้ายข้อมูล (--apply):');
    console.log(`  - settings        : ${result.settingsAction}`);
    console.log(
      `  - subscriptions   : เพิ่ม ${result.inserted.subscriptions} | ข้ามซ้ำ ${result.skipped.subscriptions}`,
    );
    console.log(
      `  - installments    : เพิ่ม ${result.inserted.installments} | ข้ามซ้ำ ${result.skipped.installments}`,
    );
    console.log(
      `  - transactions    : เพิ่ม ${result.inserted.transactions} | ข้ามซ้ำ ${result.skipped.transactions}`,
    );
  } finally {
    await client.auth.signOut();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  runCli().catch((err) => {
    console.error(`\n[ERROR] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
