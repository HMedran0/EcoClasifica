import { Link } from 'react-router';
import { InstallButton } from '../../pwa/InstallButton';
import { useOnlineStatus } from '../../pwa/useOnlineStatus';
import { ServiceStatus } from './ServiceStatus';

const SCAN_BUTTON =
  'flex min-h-tactil w-full max-w-xs items-center justify-center rounded-2xl px-6 text-lg font-bold';

export function HomePage() {
  const online = useOnlineStatus();
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
      <InstallButton />
      <ServiceStatus />
    </main>
  );
}
