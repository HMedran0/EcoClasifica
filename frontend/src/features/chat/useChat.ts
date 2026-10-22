import {
  MAX_CHAT_MESSAGES,
  type ChatHistoryResponse,
  type ChatIdea,
  type ChatMessage,
  type ChatResponse,
} from '@ecoclasifica/shared';
import { useEffect, useRef, useState } from 'react';
import type { ChatRequestInput, RequestOptions } from '../../api/client';
import { ApiError, errorMessage, isUntilTomorrow, type ApiErrorCode } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';

export type ChatRequest = (req: ChatRequestInput, opts?: RequestOptions) => Promise<ChatResponse>;
export type ChatThreadRequest = (
  ideaId: string,
  opts?: RequestOptions,
) => Promise<ChatHistoryResponse>;

export type ChatStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'sending' }
  | { kind: 'error'; code: ApiErrorCode; message: string };

const LOAD_FAILED = 'No pudimos cargar la conversación guardada. Intenta de nuevo.';

const EMPTY: ChatMessage[] = [];

// Los mensajes genéricos hablan de «escaneos» y «la foto»; en el chat se ajustan.
const CHAT_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  AI_BAD_RESPONSE: 'No pudimos responder. Intenta de nuevo.',
  AI_TIMEOUT: 'La respuesta tardó demasiado. Intenta de nuevo.',
  RATE_LIMITED: 'Enviaste muchos mensajes seguidos. Espera un minuto e intenta de nuevo.',
  ABORTED: 'La respuesta se interrumpió. Intenta de nuevo.',
};

export function chatErrorMessage(code: ApiErrorCode): string {
  return CHAT_MESSAGES[code] ?? errorMessage(code);
}

const errorStatus = (code: ApiErrorCode): ChatStatus => ({
  kind: 'error',
  code,
  message: chatErrorMessage(code),
});

interface UseChatOptions {
  ideaIndex?: number;
  idea: ChatIdea;
  scanId: string | null;
  /** HU-15: idea guardada con sesión. El hilo se carga y se guarda en el servidor. */
  savedIdeaId: string | null;
  /** Hilo en `photoStore` (el índice de la idea, o uno propio para las del historial). */
  threadKey: string;
  request: ChatRequest;
  loadThread: ChatThreadRequest;
}

/**
 * HU-11: hilo del chat de una idea. Vive en `photoStore` (en memoria), así que se conserva al
 * volver a /ideas y se borra al cambiar de foto. Solo viajan los últimos 10 mensajes.
 * HU-15: con `savedIdeaId`, el hilo se carga del servidor al abrir y solo viaja la pregunta nueva:
 * el servidor arma el contexto con lo guardado.
 */
export function useChat({
  ideaIndex,
  idea,
  scanId,
  savedIdeaId,
  threadKey,
  request,
  loadThread,
}: UseChatOptions) {
  const messages = usePhotoStore((s) => s.chats[threadKey] ?? EMPTY);
  const saveChat = usePhotoStore((s) => s.saveChat);
  // Si se salió de la pantalla antes de la respuesta, el hilo termina en una pregunta sin responder.
  const [status, setStatus] = useState<ChatStatus>(() => {
    if (savedIdeaId) return { kind: 'loading' };
    return messages.at(-1)?.role === 'user' ? errorStatus('ABORTED') : { kind: 'idle' };
  });
  const [loaded, setLoaded] = useState(savedIdeaId === null);
  // `loadAttempt` cambia con «Reintentar» si falló la carga del hilo.
  const [loadAttempt, setLoadAttempt] = useState(0);
  // `id` distingue dos respuestas iguales seguidas para que el lector de pantalla las anuncie.
  const [lastReply, setLastReply] = useState({ id: 0, text: '' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!savedIdeaId) return;
    const controller = new AbortController();
    loadThread(savedIdeaId, { signal: controller.signal }).then(
      ({ items }) => {
        if (controller.signal.aborted) return;
        saveChat(threadKey, items);
        setLoaded(true);
        setStatus({ kind: 'idle' });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const code = err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE';
        setStatus({ kind: 'error', code, message: LOAD_FAILED });
      },
    );
    return () => controller.abort();
  }, [savedIdeaId, loadAttempt, loadThread, saveChat, threadKey]);

  function ask(thread: ChatMessage[]) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus({ kind: 'sending' });
    const body: ChatRequestInput = {
      idea,
      // Con la idea guardada, el servidor pone los mensajes anteriores.
      messages: thread.slice(savedIdeaId ? -1 : -MAX_CHAT_MESSAGES),
      ...(ideaIndex === undefined ? {} : { ideaIndex }),
      ...(scanId ? { scanId } : {}),
      ...(savedIdeaId ? { ideaId: savedIdeaId } : {}),
    };
    request(body, { signal: controller.signal }).then(
      ({ reply }) => {
        if (controller.signal.aborted) return;
        saveChat(threadKey, [...thread, { role: 'assistant', content: reply }]);
        setLastReply((prev) => ({ id: prev.id + 1, text: reply }));
        setStatus({ kind: 'idle' });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        if (!(err instanceof ApiError)) return setStatus(errorStatus('UNEXPECTED_RESPONSE'));
        // HU-20: el backend dice qué límite se alcanzó; el resto usa los textos del chat.
        setStatus(
          isUntilTomorrow(err.code)
            ? { kind: 'error', code: err.code, message: err.message }
            : errorStatus(err.code),
        );
      },
    );
  }

  /** Añade la pregunta al hilo (queda guardada aunque falle) y pide la respuesta. */
  function send(text: string) {
    const content = text.trim();
    if (!content || !loaded || status.kind === 'sending') return;
    const thread: ChatMessage[] = [...messages, { role: 'user', content }];
    saveChat(threadKey, thread);
    ask(thread);
  }

  /** Vuelve a cargar el hilo guardado, o reenvía el hilo que termina en la pregunta sin respuesta. */
  function retry() {
    if (!loaded) {
      setStatus({ kind: 'loading' });
      setLoadAttempt((n) => n + 1);
    } else if (messages.at(-1)?.role === 'user') ask(messages);
  }

  /** `ready`: sin hilo guardado pendiente de cargar (antes no se puede enviar). */
  return { messages, status, lastReply, ready: loaded, send, retry };
}
