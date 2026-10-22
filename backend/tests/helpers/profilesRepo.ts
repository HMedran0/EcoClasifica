import { PRIVACY_VERSION } from '@ecoclasifica/shared';
import { vi } from 'vitest';
import type { Profile, ProfilesRepo } from '../../src/repositories/profiles.repo';

export interface StoredProfile extends Profile {
  privacyAcceptedAt: Date | null;
}

/**
 * Perfiles en memoria que filtran por usuario. Un `userId` sin entrada inicial obtiene un perfil
 * con la versión vigente autorizada (`consentByDefault`), para que las pruebas que no tratan de
 * HU-21 guarden como antes.
 */
export function memoryProfilesRepo(
  initial: Record<string, Partial<StoredProfile>> = {},
  { consentByDefault = true } = {},
) {
  const rows = new Map<string, StoredProfile>(
    Object.entries(initial).map(([id, p]) => [
      id,
      { displayName: null, privacyVersion: null, privacyAcceptedAt: null, ...p },
    ]),
  );
  const row = (userId: string): StoredProfile | undefined =>
    rows.get(userId) ??
    (consentByDefault
      ? { displayName: null, privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: new Date(0) }
      : undefined);

  return {
    rows,
    findById: vi.fn<ProfilesRepo['findById']>(async (userId) => {
      const found = row(userId);
      return found
        ? { displayName: found.displayName, privacyVersion: found.privacyVersion }
        : null;
    }),
    saveConsent: vi.fn<ProfilesRepo['saveConsent']>(async (userId, version, acceptedAt) => {
      const found = row(userId);
      if (!found) return null;
      // Como el repo real: la misma versión conserva la primera fecha.
      if (found.privacyVersion === version && found.privacyAcceptedAt) {
        return found.privacyAcceptedAt;
      }
      rows.set(userId, { ...found, privacyVersion: version, privacyAcceptedAt: acceptedAt });
      return acceptedAt;
    }),
  } satisfies ProfilesRepo & { rows: Map<string, StoredProfile> };
}
