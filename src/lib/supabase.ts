import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedKey = '';
let cachedClient: SupabaseClient | null = null;

function readEnv(): { url: string; anonKey: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  return { url, anonKey };
}

/** True when running against local fixture data instead of a live Supabase backend. */
export function isFixturesMode(): boolean {
  return import.meta.env.VITE_USE_FIXTURES === '1';
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readEnv();
  return url.length > 0 && anonKey.length > 0;
}

export function getSupabaseConfigError(): Error | null {
  const { url, anonKey } = readEnv();
  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length === 0) return null;
  return new Error(
    `ยังไม่ได้ตั้งค่า ${missing.join(' และ ')} สำหรับเชื่อมต่อ Supabase (ดู .env.example หรือใช้ VITE_USE_FIXTURES=1)`,
  );
}

/**
 * Lazily instantiates and caches the Supabase client so fixture mode and test suites
 * can import this module without requiring live environment variables up front.
 */
export function getSupabaseClient(): SupabaseClient {
  const configError = getSupabaseConfigError();
  if (configError) throw configError;

  const { url, anonKey } = readEnv();
  const key = `${url}\n${anonKey}`;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = createClient(url, anonKey);
    cachedKey = key;
  }
  return cachedClient;
}

/**
 * Lazy proxy over getSupabaseClient() so callers importing `supabase` do not fail
 * at module evaluation time when running in fixture mode.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
