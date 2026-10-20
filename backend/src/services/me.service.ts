import type { MeResponse } from '@ecoclasifica/shared';
import type { ProfilesRepo } from '../repositories/profiles.repo';
import type { AuthUser } from './auth.service';

export interface MeDeps {
  profiles: ProfilesRepo;
}

export async function getMe({ profiles }: MeDeps, user: AuthUser): Promise<MeResponse> {
  const profile = await profiles.findById(user.id);
  return { id: user.id, email: user.email, displayName: profile?.displayName ?? null };
}
