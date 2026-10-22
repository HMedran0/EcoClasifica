import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuthStore } from '../auth/authStore';
import { DELETE_BUTTON } from '../history/deleteCopy';
import { useConfirmedDelete } from '../history/useConfirmedDelete';
import { PRIVACY_PATH } from '../privacy/paths';
import { SECONDARY, TITLE } from '../scan/ScanScreen';
import { deleteAccount as deleteAccountRequest, endDeletedSession } from './accountActions';
import { ACCOUNT_DELETED } from './paths';

export const DELETE_ACCOUNT_WARNING =
  'Se borrarán para siempre tu cuenta, tu historial, tus fotos, tus favoritos y tus conversaciones. No se puede deshacer.';

interface AccountPageProps {
  deleteAccount?: () => Promise<void>;
}

/** HU-22: correo, enlace a la política y «Eliminar mi cuenta» con confirmación escrita. */
export function AccountPage({ deleteAccount = deleteAccountRequest }: AccountPageProps) {
  const email = useAuthStore((s) => s.session?.user.email ?? null);
  const navigate = useNavigate();
  const deleted = useRef(false);
  const flow = useConfirmedDelete(deleteAccount, () => {
    deleted.current = true;
    void navigate('/', { replace: true, state: { notice: ACCOUNT_DELETED } });
  });

  // La sesión se cierra al salir de /cuenta, ya en la portada: si se cerrara antes de que la
  // navegación se aplique, `RequireAuth` mandaría a /entrar.
  useEffect(
    () => () => {
      if (deleted.current) void endDeletedSession();
    },
    [],
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <h1 className={TITLE}>Mi cuenta</h1>
      {email && (
        <p className="text-base text-bosque">
          Correo: <span className="font-semibold text-petroleo">{email}</span>
        </p>
      )}
      <Link
        to={PRIVACY_PATH}
        className="flex min-h-tactil items-center text-base font-semibold text-bosque underline"
      >
        Política de privacidad
      </Link>
      <div className="mt-auto flex flex-col gap-3">
        <button type="button" className={DELETE_BUTTON} onClick={flow.ask}>
          Eliminar mi cuenta
        </button>
        <Link to="/" className={SECONDARY}>
          Volver al inicio
        </Link>
      </div>
      {flow.open && (
        <ConfirmDialog
          title="¿Eliminar tu cuenta?"
          message={DELETE_ACCOUNT_WARNING}
          confirmLabel="Eliminar mi cuenta"
          confirmText="ELIMINAR"
          onConfirm={flow.confirm}
          onCancel={flow.cancel}
          busy={flow.busy}
          error={flow.error}
        />
      )}
    </main>
  );
}
