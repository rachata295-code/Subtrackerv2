import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient, isFixturesMode, isSupabaseConfigured, supabase } from './supabase';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabase client config', () => {
  it('detects fixture mode from VITE_USE_FIXTURES', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    expect(isFixturesMode()).toBe(true);

    vi.stubEnv('VITE_USE_FIXTURES', '0');
    expect(isFixturesMode()).toBe(false);
  });

  it('throws a clear error when env vars are missing outside fixture mode', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabaseClient()).toThrow(/VITE_SUPABASE_URL/);
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_URL/);
  });

  it('throws mentioning VITE_SUPABASE_ANON_KEY when only URL is provided', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabaseClient()).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('does not throw on import or config check in fixture mode even without env vars', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    expect(isFixturesMode()).toBe(true);
    expect(() => isSupabaseConfigured()).not.toThrow();
  });

  it('creates and caches a client when both env vars are present', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-example');

    expect(isSupabaseConfigured()).toBe(true);
    const first = getSupabaseClient();
    const second = getSupabaseClient();
    expect(first).toBe(second);
    expect(first.auth).toBeDefined();
  });
});
