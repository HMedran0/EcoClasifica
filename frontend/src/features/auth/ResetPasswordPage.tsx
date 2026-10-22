import { useEffect, useState, type FormEvent } from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { MIN_PASSWORD_LENGTH, updatePassword } from './authActions';
import {
  authErrorCode,
  authErrorMessage,
  RECOVERY_LINK_MESSAGES,
  recoveryLinkErrorCode,
  recoveryLinkProblem,
  type RecoveryLinkProblem,
} from './authErrors';
import { BUTTON, FORGOT_PARAM, INPUT } from './authForm';
import { useAuthStore } from './authStore';

export const RECOVERY_TIMEOUT_MS = 10_000;
export const PASSWORD_UPDATED = 'Contraseña actualizada. Ya iniciaste sesión con la nueva.';

// Según la versión de supabase-js, el canje del `?code=` de recuperación emite uno u otro.
const RECOVERY_EVENTS = new Set<AuthChangeEvent>(['PASSWORD_RECOVERY', 'SIGNED_IN']);

/**
 * supabase-js quita el `?code=` de la barra de direcciones solo si lo canjeó. Si sigue ahí (no hay
 * «code verifier»: el enlace se pidió en otro navegador), una sesión presente es la que ya había
 * abierta, no la de recuperación, y no debe permitir cambiar la contraseña.
 */
function codeExchanged(): boolean {
  return !new URLSearchParams(window.location.search).has('code');
}

type Phase = 'waiting' | 'form' | RecoveryLinkProblem;

/** Validación propia (no la del navegador) para que los mensajes estén en español. */
function validate(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

/**
 * Espera a que supabase-js canjee el `?code=` por la sesión de recuperación (lo hace solo al cargar
 * la app). Cuenta como recuperación el evento o, si llegó antes de suscribirse, la sesión que deja
 * `initialize()`; en ambos casos solo si el código se canjeó de verdad.
 */
function useRecoveryPhase(hasCode: boolean, linkError: string | null): Phase {
  const [phase, setPhase] = useState<Phase>(() =>
    linkError === null ? 'waiting' : recoveryLinkProblem(linkError),
  );

  useEffect(() => {
    if (!hasCode || linkError !== null) return;
    let settled = false;
    const settle = (next: Phase) => {
      if (settled) return;
      settled = true;
      setPhase(next);
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && RECOVERY_EVENTS.has(event) && codeExchanged()) settle('form');
    });
    supabase.auth
      .initialize()
      .then(async ({ error }) => {
        if (error) return settle(recoveryLinkProblem(authErrorCode(error)));
        if (!codeExchanged()) return settle('otherDevice');
        const { data: current } = await supabase.auth.getSession();
        settle(current.session ? 'form' : 'otherDevice');
      })
      .catch(() => settle('invalid'));
    const timer = setTimeout(() => settle('invalid'), RECOVERY_TIMEOUT_MS);

    return () => {
      settled = true;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [hasCode, linkError]);

  return phase;
}

export function ResetPasswordPage() {
  const { search, hash } = useLocation();
  // Se leen una sola vez: supabase-js quita el `?code=` de la barra de direcciones tras canjearlo.
  const [hasCode] = useState(() => new URLSearchParams(search).has('code'));
  const [linkError] = useState(() => recoveryLinkErrorCode(search, hash));
  const phase = useRecoveryPhase(hasCode, linkError);
  const signedIn = useAuthStore((s) => s.session !== null);
  const ready = useAuthStore((s) => s.ready);

  if (!hasCode && linkError === null) {
    if (!ready) return null;
    return <Navigate to={signedIn ? '/' : '/entrar'} replace />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <h1 className="text-3xl font-extrabold text-petroleo">Nueva contraseña</h1>
      {phase === 'waiting' && (
        <p role="status" className="text-base text-bosque">
          Revisando el enlace…
        </p>
      )}
      {phase === 'form' && <NewPasswordForm />}
      {phase !== 'waiting' && phase !== 'form' && <LinkProblem problem={phase} />}
    </main>
  );
}

function LinkProblem({ problem }: { problem: RecoveryLinkProblem }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border-2 border-bosque p-4 text-petroleo"
    >
      <p>{RECOVERY_LINK_MESSAGES[problem]}</p>
      <Link to={`/entrar?${FORGOT_PARAM}=1`} className={`${BUTTON} bg-lima text-petroleo`}>
        Pedir otro enlace
      </Link>
    </div>
  );
}

function NewPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validate(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      navigate('/', { replace: true, state: { notice: PASSWORD_UPDATED } });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <p className="text-base text-bosque">
        Elige una contraseña nueva. Se cerrará la sesión en tus otros dispositivos.
      </p>
      <label htmlFor="new-password" className="text-base font-semibold text-petroleo">
        Contraseña nueva
      </label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        aria-describedby="new-password-hint"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={INPUT}
      />
      <p id="new-password-hint" className="text-sm text-bosque">
        Mínimo {MIN_PASSWORD_LENGTH} caracteres.
      </p>
      <label htmlFor="confirm-password" className="text-base font-semibold text-petroleo">
        Repite la contraseña
      </label>
      <input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className={INPUT}
      />
      <button type="submit" disabled={busy} className={`${BUTTON} bg-lima text-petroleo`}>
        {busy ? 'Un momento…' : 'Guardar contraseña'}
      </button>
      {error && (
        <p role="alert" className="rounded-2xl border-2 border-bosque p-4 text-petroleo">
          {error}
        </p>
      )}
    </form>
  );
}
