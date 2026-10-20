import type { ChatMessage, ClassifyResponse, UpcycleResponse } from '@ecoclasifica/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePhotoStore } from '../camera/photoStore';
import { clearFavorites, setFavorites, useFavoritesStore } from '../favorites/favoritesStore';
import { forgetDeleted } from './forgetDeleted';

const SCAN = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';
const OTHER_SCAN = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6d';
const IDEA = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c70';
const IDEA_2 = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c71';
const OTHER_IDEA = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c72';
const FAV = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c40';

const thread: ChatMessage[] = [{ role: 'user', content: '¿Cómo empiezo?' }];

const upcycle = (scanId: string | null): UpcycleResponse => ({
  scanId,
  mode: 'upcycle',
  saved: scanId !== null,
  result: {
    canUpcycle: true,
    objectName: 'frasco',
    difficulty: 'Fácil',
    ideas: [
      { ideaIndex: 0, ideaId: IDEA, title: 'A', description: 'a', extraMaterials: [] },
      { ideaIndex: 1, ideaId: IDEA_2, title: 'B', description: 'b', extraMaterials: [] },
      { ideaIndex: 2, title: 'C', description: 'c', extraMaterials: [] },
    ],
  },
});

const classify = (scanId: string | null): ClassifyResponse => ({
  scanId,
  mode: 'classify',
  saved: scanId !== null,
  result: {
    object: 'botella',
    material: 'plastico',
    materialDetail: 'PET',
    confidence: 0.9,
    lowConfidence: false,
    alternatives: [],
  },
  disposal: null,
});

const allChats = () => ({
  '0': thread,
  [`historial:${SCAN}:0`]: thread,
  [`historial:${OTHER_SCAN}:0`]: thread,
  [`idea:${IDEA}`]: thread,
  [`idea:${IDEA_2}`]: thread,
  [`idea:${OTHER_IDEA}`]: thread,
  [`favorito:${FAV}`]: thread,
});

const photo = { id: 1, previewUrl: 'blob:x', width: 768, height: 768, bytes: 10, dataUrl: '' };

beforeEach(() => {
  clearFavorites();
  setFavorites({ [IDEA]: FAV, [IDEA_2]: null, [OTHER_IDEA]: null });
  usePhotoStore.setState({
    photo: photo as never,
    results: { upcycle: { photoId: 1, data: upcycle(SCAN), withSession: true } },
    chats: allChats(),
  });
});

describe('forgetDeleted (HU-14)', () => {
  it('un escaneo: olvida sus ideas, sus hilos y la respuesta en caché de ese scanId', () => {
    forgetDeleted({ scanId: SCAN, ideaIds: [IDEA] });

    // IDEA_2 sale de la respuesta en caché del mismo escaneo.
    expect(useFavoritesStore.getState().byIdea).toEqual({ [IDEA_2]: null, [OTHER_IDEA]: null });
    const state = usePhotoStore.getState();
    expect(state.results).toEqual({});
    expect(Object.keys(state.chats).sort()).toEqual(
      [`historial:${OTHER_SCAN}:0`, `idea:${OTHER_IDEA}`, `favorito:${FAV}`].sort(),
    );
    expect(state.photo).not.toBeNull();
  });

  it('una respuesta en caché de otro escaneo (o sin guardar) se conserva con sus hilos', () => {
    usePhotoStore.setState({
      results: {
        upcycle: { photoId: 1, data: upcycle(OTHER_SCAN) },
        classify: { photoId: 1, data: classify(null) },
      },
      chats: { '0': thread, [`historial:${SCAN}:1`]: thread },
    });

    forgetDeleted({ scanId: SCAN, ideaIds: [] });

    const state = usePhotoStore.getState();
    expect(Object.keys(state.results).sort()).toEqual(['classify', 'upcycle']);
    expect(Object.keys(state.chats)).toEqual(['0']);
  });

  it('todo: vacía corazones, hilos guardados y respuestas guardadas; conserva lo no guardado', () => {
    usePhotoStore.setState({
      results: {
        upcycle: { photoId: 1, data: upcycle(SCAN) },
        classify: { photoId: 1, data: classify(null) },
      },
    });

    forgetDeleted('all');

    expect(useFavoritesStore.getState().byIdea).toEqual({});
    const state = usePhotoStore.getState();
    expect(Object.keys(state.results)).toEqual(['classify']);
    expect(Object.keys(state.chats)).toEqual([`favorito:${FAV}`]);
  });
});
