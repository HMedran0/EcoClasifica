import { PRIVACY_VERSION, type ConsentResponse, type MeResponse } from '@ecoclasifica/shared';
import type { ProfilesRepo } from '../repositories/profiles.repo';
import { AppError } from '../utils/appError';
import type { AuthUser } from './auth.service';

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
