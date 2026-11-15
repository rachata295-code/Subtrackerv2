import type { AuthErrorLike } from './types';

function readErrorDetails(error: unknown): { message: string; code?: string; status?: number; name?: string } {
  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object') {
    const e = error as Partial<AuthErrorLike> & { name?: unknown };
    return {
      message: typeof e.message === 'string' ? e.message : '',
      code: typeof e.code === 'string' ? e.code : undefined,
      status: typeof e.status === 'number' ? e.status : undefined,
      name: typeof e.name === 'string' ? e.name : undefined,
    };
  }
  return { message: '' };
}

/** Translates Supabase Auth and fetch errors into clear Thai copy for the login form alert. */
export function translateAuthError(error: unknown): string {
  const { message, code, status, name } = readErrorDetails(error);
  const lower = message.toLowerCase();
  const lowerCode = code?.toLowerCase();

  // Check offline / network errors first because fetch failures carry no HTTP status.
  if (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    name === 'AuthRetryableFetchError' ||
    status === 0 ||
    (error instanceof TypeError && /fetch|network|load failed/i.test(lower)) ||
    /failed to fetch|networkerror|network request failed|load failed|err_network|timeout|econnrefused|enotfound/.test(lower)
  ) {
    return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่อีกครั้ง';
  }

  if (
    lowerCode === 'invalid_credentials' ||
    lowerCode === 'invalid_grant' ||
    /invalid login credentials|invalid email or password/.test(lower)
  ) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  }

  if (
    lowerCode === 'email_provider_disabled' ||
    /email logins are disabled|email provider.*disabled|email_provider_disabled/.test(lower)
  ) {
    return 'ยังไม่ได้เปิดการล็อกอินด้วยอีเมลใน Supabase';
  }

  // Check after invalid_credentials so a 401 credential failure is not mislabelled as a bad API key.
  if (
    lowerCode === 'invalid_api_key' ||
    status === 401 ||
    /invalid api key|invalid_api_key|no api key found in request/.test(lower)
  ) {
    return 'ตั้งค่า Supabase key ไม่ถูกต้อง';
  }

  if (lowerCode === 'email_not_confirmed' || /email not confirmed/.test(lower)) {
    return 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล';
  }

  if (status === 429 || lowerCode === 'over_request_rate_limit' || /rate limit|too many requests/.test(lower)) {
    return 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  }

  if (/not configured/.test(lower)) {
    return 'ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง';
  }

  return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}
