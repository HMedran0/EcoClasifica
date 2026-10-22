import { PRIVACY_VERSION, type ConsentResponse, type MeResponse } from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import type { AccountsRepo } from '../repositories/accounts.repo';
import type { ProfilesRepo } from '../repositories/profiles.repo';
import type { ScansRepo } from '../repositories/scans.repo';
import { SupabaseOpError } from '../repositories/supabase';
import { AppError } from '../utils/appError';
import type { AuthUser } from './auth.service';
import { IMAGE_DELETE_BATCH } from './history.service';

export interface MeDeps {
  profiles: ProfilesRepo;
}

export async function getMe({ profiles }: MeDeps, user: AuthUser): Promise<MeResponse> {
  const profile = await profiles.findById(user.id);
  return {
    id: user.id,
    email: user.email,
    displayName: profile?.displayName ?? null,
    privacyVersion: profile?.privacyVersion ?? null,
  };
}

/** HU-21: la versión es siempre la vigente del servidor; el cliente no envía nada. */
export async function acceptPrivacy(
  { profiles }: MeDeps,
  user: AuthUser,
  now = new Date(),
): Promise<ConsentResponse> {
  const acceptedAt = await profiles.saveConsent(user.id, PRIVACY_VERSION, now);
  if (!acceptedAt) throw new AppError('NOT_FOUND', 'No encontramos tu perfil');
  return { privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: acceptedAt.toISOString() };
}

/** HU-21: con sesión, solo se guardan datos si autorizó la versión vigente de la política. */
export async function hasCurrentConsent({ profiles }: MeDeps, user: AuthUser): Promise<boolean> {
  const profile = await profiles.findById(user.id);
  return profile?.privacyVersion === PRIVACY_VERSION;
}

/** HU-21: el usuario si autorizó la versión vigente; si no, `undefined` (se trata como anónimo). */
export async function consentedUser(
  deps: MeDeps,
  user: AuthUser | undefined,
): Promise<AuthUser | undefined> {
  return user && (await hasCurrentConsent(deps, user)) ? user : undefined;
}

/** HU-21: los favoritos solo existen con sesión; sin autorización → 403 CONSENT_REQUIRED. */
export async function requireConsent(deps: MeDeps, user: AuthUser): Promise<void> {
  if (!(await hasCurrentConsent(deps, user))) {
    throw new AppError(
      'CONSENT_REQUIRED',
      'Autoriza el tratamiento de tus datos para guardar en tu cuenta',
    );
  }
}

export interface AccountDeletionDeps {
  scans: ScansRepo;
  accounts: AccountsRepo;
}

const DELETE_FAILED_MESSAGE = 'No pudimos eliminar tu cuenta. Intenta de nuevo.';

/**
 * HU-22: primero las fotos y solo después el usuario de Auth, para que no queden fotos de una
 * cuenta borrada. Si Storage falla o quedan imágenes al volver a listar, la cuenta no se toca.
 * Un escaneo guardado desde otro dispositivo entre la verificación y `deleteUser` lo limpia el
 * script de imágenes huérfanas (ADR-22).
 */
export async function deleteAccount(
  { scans, accounts }: AccountDeletionDeps,
  user: AuthUser,
  log: Logger,
): Promise<void> {
  await removeAllImages(scans, user.id, log);
  try {
    await accounts.deleteUser(user.id);
  } catch (err) {
    log.error({ code: errorCode(err) }, 'No se pudo borrar el usuario de Auth');
    throw new AppError('ACCOUNT_DELETE_FAILED', DELETE_FAILED_MESSAGE);
  }
}

async function removeAllImages(scans: ScansRepo, userId: string, log: Logger): Promise<void> {
  let remaining: string[];
  try {
    const paths = await scans.listImagePaths(userId);
    for (let i = 0; i < paths.length; i += IMAGE_DELETE_BATCH) {
      await scans.removeImages(paths.slice(i, i + IMAGE_DELETE_BATCH));
    }
    remaining = await scans.listImagePaths(userId);
  } catch (err) {
    log.error({ code: errorCode(err) }, 'No se pudieron borrar las imágenes de la cuenta');
    throw new AppError('ACCOUNT_DELETE_FAILED', DELETE_FAILED_MESSAGE);
  }
  if (remaining.length > 0) {
    // Solo el conteo: ni rutas ni ids, que identifican al usuario.
    log.warn({ remainingImages: remaining.length }, 'Quedaron imágenes; la cuenta no se borró');
    throw new AppError('ACCOUNT_DELETE_FAILED', DELETE_FAILED_MESSAGE);
  }
}

/** Solo el código de Supabase: su mensaje puede citar rutas `<userId>/…` o el uuid. */
const errorCode = (err: unknown) => (err instanceof SupabaseOpError ? err.code : 'desconocido');
