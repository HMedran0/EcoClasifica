import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import {
  MIN_PASSWORD_LENGTH,
  resendVerification,
  signIn,
  signInWithGoogle,
  signUp,
} from './authActions';
import { authErrorCode, authErrorMessage, EMAIL_NOT_CONFIRMED } from './authErrors';
import { useAuthStore } from './authStore';
import { RETURN_PARAM, safeReturnPath } from './returnPath';

type Tab = 'signin' | 'signup';

const TABS: Record<Tab, string> = { signin: 'Iniciar sesión', signup: 'Crear cuenta' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIGNUP_SENT = 'Te enviamos un correo para verificar tu cuenta. Ábrelo y luego inicia sesión.';
const RESENT = 'Te enviamos de nuevo el correo de verificación.';

const BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl px-6 text-lg font-bold';
const INPUT =
  'min-h-tactil rounded-2xl border-2 border-bosque bg-white p-3 text-base text-petroleo';

/** Validación propia (no la del navegador) para que los mensajes estén en español. */
function validate(tab: Tab, email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email)) return 'Escribe un correo válido, por ejemplo ana@correo.com.';
  if (tab === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!password) return 'Escribe tu contraseña.';
  return null;
}

export function LoginPage() {
  const session = useAuthStore((s) => s.session);
  const [params] = useSearchParams();
  const back = safeReturnPath(params.get(RETURN_PARAM));

  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  if (session) return <Navigate to={back} replace />;

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setNotice(null);
    setCanResend(false);
  }

  async function run(action: () => Promise<void>, onSuccess?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (onSuccess) setNotice(onSuccess);
      setCanResend(false);
    } catch (err) {
      setError(authErrorMessage(err));
      setCanResend(authErrorCode(err) === EMAIL_NOT_CONFIRMED);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    const invalid = validate(tab, trimmed, password);
    if (invalid) {
      setError(invalid);
      setNotice(null);
      setCanResend(false);
      return;
    }
    const credentials = { email: trimmed, password };
    if (tab === 'signin') void run(() => signIn(credentials));
    else void run(() => signUp(credentials, back), SIGNUP_SENT);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <Link to="/" className="min-h-tactil self-start py-3 text-base font-semibold text-petroleo">
        ← Volver
      </Link>
      <h1 className="text-3xl font-extrabold text-petroleo">Tu cuenta</h1>
      <p className="text-base text-bosque">
        Inicia sesión para guardar tu historial y tus ideas favoritas. Escanear no lo necesita.
      </p>

      <div role="tablist" aria-label="Tipo de acceso" className="grid grid-cols-2 gap-2">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls="auth-panel"
            onClick={() => switchTab(key)}
            className={`min-h-tactil rounded-2xl border-2 border-bosque px-3 text-base font-semibold ${
              tab === key ? 'bg-bosque text-white' : 'bg-white text-bosque'
            }`}
          >
            {TABS[key]}
          </button>
        ))}
      </div>

      <form
        id="auth-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-3"
      >
        <label htmlFor="auth-email" className="text-base font-semibold text-petroleo">
          Correo
        </label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
        <label htmlFor="auth-password" className="text-base font-semibold text-petroleo">
          Contraseña
        </label>
        <input
          id="auth-password"
          type="password"
          autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
          aria-describedby={tab === 'signup' ? 'password-hint' : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
        {tab === 'signup' && (
          <p id="password-hint" className="text-sm text-bosque">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        )}
        <button type="submit" disabled={busy} className={`${BUTTON} bg-lima text-petroleo`}>
          {busy ? 'Un momento…' : TABS[tab]}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border-2 border-bosque p-4 text-petroleo"
        >
          <p>{error}</p>
          {canResend && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => resendVerification(email.trim(), back), RESENT)}
              className={`${BUTTON} border-2 border-bosque bg-white text-bosque`}
            >
              Reenviar correo
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-2xl bg-bosque/10 p-4 text-petroleo">
          {notice}
        </p>
      )}

      <p className="text-center text-base text-bosque">o</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => signInWithGoogle(back))}
        className={`${BUTTON} border-2 border-bosque bg-white text-petroleo`}
      >
        Continuar con Google
      </button>
    </main>
  );
}
