import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { translateAuthError, useAuth } from '../../auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';

function resolveReturnPath(state: unknown): string {
  if (!state || typeof state !== 'object' || !('from' in state)) return '/';
  const from = (state as { from?: unknown }).from;
  if (typeof from === 'string') {
    return from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : '/';
  }
  if (from && typeof from === 'object' && 'pathname' in from) {
    const loc = from as { pathname?: unknown; search?: unknown; hash?: unknown };
    if (typeof loc.pathname === 'string' && loc.pathname.startsWith('/') && !loc.pathname.startsWith('/login')) {
      const search = typeof loc.search === 'string' ? loc.search : '';
      const hash = typeof loc.hash === 'string' ? loc.hash : '';
      return `${loc.pathname}${search}${hash}`;
    }
  }
  return '/';
}

export default function LoginPage() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const returnTo = resolveReturnPath(location.state);

  if (status === 'signedIn') {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signIn(trimmedEmail, password);
      navigate(returnTo, { replace: true });
    } catch (error) {
      setErrorMessage(translateAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col justify-center bg-ground px-screen py-6">
      {/* Cap card width at max-w-sm (384px <= 400px) so desktop/tablet viewports stay compact while 375px remains full-width. */}
      <main className="mx-auto w-full max-w-sm">
        <Card>
          <header className="mb-5">
            <h1 className="text-title font-semibold text-text">เข้าสู่ระบบ</h1>
            <p className="mt-1 text-sm text-muted">SubTracker สำหรับใช้งานส่วนตัว</p>
          </header>

          <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <TextField
              label="อีเมล"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={submitting}
              required
            />
            <TextField
              label="รหัสผ่าน"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={submitting}
              required
            />
            <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-1 w-full">
              เข้าสู่ระบบ
            </Button>
          </form>

          {errorMessage ? (
            <p role="alert" className="mt-3 text-sm text-negative">
              {errorMessage}
            </p>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
