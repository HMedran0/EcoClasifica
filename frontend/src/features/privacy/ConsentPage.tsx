import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { signOut } from '../auth/authActions';
import { BUTTON } from '../auth/authForm';
import { useAuthStore } from '../auth/authStore';
import { RETURN_PARAM, safeReturnPath } from '../auth/returnPath';
import { ConsentCheckbox } from './ConsentCheckbox';
import { markConsented } from './consentStore';

export const DECLINED_NOTICE = 'Cerraste sesión. Puedes seguir escaneando sin cuenta.';
const SAVE_FAILED = 'No pudimos guardar tu autorización. Intenta de nuevo.';

/** HU-21: autorización tras iniciar sesión (Google, o versión de la política desactualizada). */
export function ConsentPage() {
  const session = useAuthStore((s) => s.session);
  const ready = useAuthStore((s) => s.ready);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = safeReturnPath(params.get(RETURN_PARAM));
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // «No acepto» cierra la sesión y lleva a la portada: no se redirige a `back` en medio.
  const [declined, setDeclined] = useState(false);

  if (ready && !session && !declined) return <Navigate to={back} replace />;

  async function accept() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.acceptPrivacy();
      markConsented(session.user.id);
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : SAVE_FAILED);
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setDeclined(true);
    await signOut();
    navigate('/', { replace: true, state: { notice: DECLINED_NOTICE } });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <h1 className="text-3xl font-extrabold text-petroleo">Autoriza el uso de tus datos</h1>
      <p className="text-base text-bosque">
        Para guardar tu historial, tus favoritos y tus conversaciones necesitamos tu autorización.
        Lee la política para saber qué datos tratamos, con quién y cómo ejercer tus derechos.
      </p>
      <ConsentCheckbox checked={accepted} onChange={setAccepted} />
      {error && (
        <p role="alert" className="rounded-2xl border-2 border-bosque p-4 text-petroleo">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!accepted || busy}
        onClick={() => void accept()}
        className={`${BUTTON} bg-lima text-petroleo disabled:opacity-50`}
      >
        {busy ? 'Un momento…' : 'Continuar'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void decline()}
        className={`${BUTTON} border-2 border-bosque bg-white text-bosque`}
      >
        No acepto
      </button>
      <p className="text-sm text-bosque">
        Si no aceptas, cerramos tu sesión y puedes seguir escaneando sin cuenta.
      </p>
    </main>
  );
}
