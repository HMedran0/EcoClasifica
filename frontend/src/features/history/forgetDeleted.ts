import { usePhotoStore, type ForgottenScans } from '../camera/photoStore';
import { forgetIdeas } from '../favorites/favoritesStore';

/**
 * HU-14: tras borrar en el servidor, olvida lo que quedaba en memoria de esos escaneos: corazones
 * de sus ideas, hilos del chat y la respuesta en caché si era de ese escaneo.
 */
export function forgetDeleted(target: ForgottenScans): void {
  forgetIdeas(target === 'all' ? 'all' : target.ideaIds);
  usePhotoStore.getState().forgetScans(target);
}
