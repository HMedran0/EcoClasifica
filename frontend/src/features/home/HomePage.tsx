import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AccountStatus } from '../auth/AccountStatus';
import { useAuthStore } from '../auth/authStore';
import { InstallButton } from '../../pwa/InstallButton';
import { useOnlineStatus } from '../../pwa/useOnlineStatus';
import { PRIVACY_PATH } from '../privacy/paths';
import { ServiceStatus } from './ServiceStatus';

const SCAN_BUTTON =
  'flex min-h-tactil w-full max-w-xs items-center justify-center rounded-2xl px-6 text-lg font-bold';

/** Aviso que llega por el estado de navegación (p. ej. «Contraseña actualizada»). */
function readNotice(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  const { notice } = state as { notice: unknown };
  return typeof notice === 'string' ? notice : null;
}

/** Se quita del estado de navegación para que no reaparezca al volver atrás o recargar. */
function useNotice(): string | null {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const fromState = readNotice(state);
  const [notice] = useState(fromState);

  useEffect(() => {
    if (fromState) navigate(pathname, { replace: true, state: null });
  }, [fromState, navigate, pathname]);

  return notice;
}

export function HomePage() {
  const online = useOnlineStatus();
  const signedIn = useAuthStore((s) => s.session !== null);
  const notice = useNotice();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/brand/logo.svg" alt="" width={160} height={160} className="size-40" />
      <h1 className="text-4xl font-extrabold tracking-tight">
        <span className="text-hoja">Eco</span>
        <span className="text-petroleo">Clasifica</span>
      </h1>
      <p className="max-w-xs text-base text-bosque">
        Clasifica tus residuos con IA y dales una segunda vida.
      </p>
      {notice && (
        <p role="status" className="max-w-xs rounded-2xl bg-bosque/10 p-4 text-petroleo">
          {notice}
        </p>
      )}
      {online ? (
        <Link to="/camara" className={`${SCAN_BUTTON} bg-lima text-petroleo`}>
          Escanear residuo
        </Link>
      ) : (
        <div className="flex w-full max-w-xs flex-col items-center gap-2">
          {/* aria-disabled (no `disabled`) para que siga siendo enfocable y TalkBack lea el motivo. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="scan-offline-reason"
            className={`${SCAN_BUTTON} cursor-not-allowed border-2 border-bosque/30 bg-bosque/10 text-bosque`}
          >
            Escanear residuo
          </button>
          <p id="scan-offline-reason" className="text-sm text-bosque">
            Escanear requiere internet
          </p>
        </div>
      )}
      {signedIn && (
        <Link
          to="/historial"
          className={`${SCAN_BUTTON} border-2 border-bosque text-base font-semibold text-bosque`}
        >
          Mi historial
        </Link>
      )}
      {signedIn && (
        <Link
          to="/favoritos"
          className={`${SCAN_BUTTON} border-2 border-bosque text-base font-semibold text-bosque`}
        >
          Mis favoritos
        </Link>
      )}
      <AccountStatus />
      <InstallButton />
      <ServiceStatus />
      <Link
        to={PRIVACY_PATH}
        className="min-h-tactil px-3 py-3 text-sm font-semibold text-bosque underline"
      >
        Política de privacidad
      </Link>
    </main>
  );
}
