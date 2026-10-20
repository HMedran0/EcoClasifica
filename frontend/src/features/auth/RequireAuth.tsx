import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from './authStore';
import { RETURN_PARAM } from './returnPath';

/** Rutas con sesión (historial HU-13, favoritos HU-15): sin sesión lleva a /entrar y luego vuelve. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const ready = useAuthStore((s) => s.ready);
  const { pathname, search } = useLocation();

  if (!ready) {
    return (
      <p role="status" className="p-6 text-center text-bosque">
        Cargando tu sesión…
      </p>
    );
  }
  if (!session) {
    const back = encodeURIComponent(`${pathname}${search}`);
    return <Navigate to={`/entrar?${RETURN_PARAM}=${back}`} replace />;
  }
  return <>{children}</>;
}
