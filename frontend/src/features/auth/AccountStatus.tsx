import { useState } from 'react';
import { Link } from 'react-router';
import { signOut } from './authActions';
import { sessionLabel, useAuthStore } from './authStore';

const ACTION = 'min-h-tactil rounded-2xl border-2 border-bosque px-6 text-base font-semibold';

/** Portada: «Iniciar sesión» o el nombre/correo del usuario con «Cerrar sesión». */
export function AccountStatus() {
  const session = useAuthStore((s) => s.session);
  const ready = useAuthStore((s) => s.ready);
  const [leaving, setLeaving] = useState(false);

  if (!ready) return null;
  if (!session) {
    return (
      <Link to="/entrar" className={`${ACTION} flex items-center bg-white text-bosque`}>
        Iniciar sesión
      </Link>
    );
  }

  async function leave() {
    setLeaving(true);
    await signOut();
    setLeaving(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-base text-bosque">
        Sesión iniciada como{' '}
        <span className="font-semibold text-petroleo">{sessionLabel(session)}</span>
      </p>
      <button
        type="button"
        disabled={leaving}
        onClick={() => void leave()}
        className={`${ACTION} bg-white text-bosque`}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
