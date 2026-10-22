import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { RESET_PATH } from '../auth/authActions';
import { useAuthStore } from '../auth/authStore';
import { RETURN_PARAM } from '../auth/returnPath';
import { checkConsent, useConsentStore } from './consentStore';
import { CONSENT_PATH, PRIVACY_PATH } from './paths';

/**
 * Se pueden leer la política y decidir sin haber aceptado. `/restablecer`: el enlace de recuperación
 * crea una sesión, y cambiar la contraseña no debe esperar a la autorización.
 */
const OPEN_PATHS: ReadonlySet<string> = new Set([PRIVACY_PATH, CONSENT_PATH, RESET_PATH]);

/**
 * HU-21: con sesión, si no autorizó la versión vigente de la política, lleva a `/autorizacion` antes
 * de seguir. Sin sesión no hace nada: escanear no requiere cuenta.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id ?? null;
  const needed = useConsentStore((s) => s.userId === userId && s.status === 'needed');
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (session) void checkConsent(session);
    // `pathname`: tras `unverified` se reintenta al navegar.
  }, [session, pathname]);

  if (!session || !needed || OPEN_PATHS.has(pathname)) return <>{children}</>;
  const back = encodeURIComponent(`${pathname}${search}`);
  return <Navigate to={`${CONSENT_PATH}?${RETURN_PARAM}=${back}`} replace />;
}
