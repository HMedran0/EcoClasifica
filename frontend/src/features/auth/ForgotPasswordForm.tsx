import { useState, type FormEvent } from 'react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { requestPasswordReset } from './authActions';
import { authErrorCode, authErrorMessage } from './authErrors';
import { BUTTON, EMAIL_PATTERN, INPUT, INVALID_EMAIL } from './authForm';

export const RESET_SENT =
  'Si el correo está registrado, te enviamos un enlace para elegir una contraseña nueva.';
export const RESET_RATE_LIMITED =
  'Ya pediste un enlace hace poco. Espera unos minutos e intenta de nuevo.';

const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);
const INPUT_CODES = new Set(['email_address_invalid', 'validation_failed']);

/**
 * Qué mostrar si falla el envío. Solo se avisa lo que no depende de la cuenta (espera, red, correo
 * mal escrito); cualquier otro error se muestra como enviado para no revelar qué correos existen.
 */
function failureOutcome(err: unknown): { error: string } | { notice: string } {
  const code = authErrorCode(err);
  if (code && RATE_LIMIT_CODES.has(code)) return { error: RESET_RATE_LIMITED };
  if (isAuthRetryableFetchError(err) || (code && INPUT_CODES.has(code))) {
    return { error: authErrorMessage(err) };
  }
  return { notice: RESET_SENT };
}

interface Props {
  initialEmail: string;
  onBack: () => void;
}

export function ForgotPasswordForm({ initialEmail, onBack }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    setNotice(null);
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(INVALID_EMAIL);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(trimmed);
      setNotice(RESET_SENT);
    } catch (err) {
      const outcome = failureOutcome(err);
      if ('error' in outcome) setError(outcome.error);
      else setNotice(outcome.notice);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="forgot-title" className="flex flex-col gap-3">
      <h2 id="forgot-title" className="text-2xl font-bold text-petroleo">
        Recuperar contraseña
      </h2>
      <p className="text-base text-bosque">
        Escribe tu correo y te enviaremos un enlace para elegir una contraseña nueva. Ábrelo en este
        mismo dispositivo y navegador.
      </p>
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label htmlFor="forgot-email" className="text-base font-semibold text-petroleo">
          Correo
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
        <button type="submit" disabled={busy} className={`${BUTTON} bg-lima text-petroleo`}>
          {busy ? 'Un momento…' : 'Enviar enlace'}
        </button>
      </form>
      {error && (
        <p role="alert" className="rounded-2xl border-2 border-bosque p-4 text-petroleo">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-2xl bg-bosque/10 p-4 text-petroleo">
          {notice}
        </p>
      )}
      <button
        type="button"
        onClick={onBack}
        className={`${BUTTON} border-2 border-bosque bg-white text-bosque`}
      >
        Volver a iniciar sesión
      </button>
    </section>
  );
}
