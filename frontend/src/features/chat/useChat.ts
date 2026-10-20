import {
  MAX_CHAT_MESSAGES,
  type ChatIdea,
  type ChatMessage,
  type ChatResponse,
} from '@ecoclasifica/shared';
import { useEffect, useRef, useState } from 'react';
import type { ChatRequestInput, RequestOptions } from '../../api/client';
import { ApiError, errorMessage, type ApiErrorCode } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';

export type ChatRequest = (req: ChatRequestInput, opts?: RequestOptions) => Promise<ChatResponse>;

export type ChatStatus =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; code: ApiErrorCode; message: string };

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
  ideaIndex: number;
  idea: ChatIdea;
  scanId: string | null;
  /** Hilo en `photoStore` (el índice de la idea, o uno propio para las del historial). */
  threadKey: string;
  request: ChatRequest;
}

/**
 * HU-11: hilo del chat de una idea. Vive en `photoStore` (en memoria), así que se conserva al
 * volver a /ideas y se borra al cambiar de foto. Solo viajan los últimos 10 mensajes.
 */
export function useChat({ ideaIndex, idea, scanId, threadKey, request }: UseChatOptions) {
  const messages = usePhotoStore((s) => s.chats[threadKey] ?? EMPTY);
  const saveChat = usePhotoStore((s) => s.saveChat);
  // Si se salió de la pantalla antes de la respuesta, el hilo termina en una pregunta sin responder.
  const [status, setStatus] = useState<ChatStatus>(() =>
    messages.at(-1)?.role === 'user' ? errorStatus('ABORTED') : { kind: 'idle' },
  );
  // `id` distingue dos respuestas iguales seguidas para que el lector de pantalla las anuncie.
  const [lastReply, setLastReply] = useState({ id: 0, text: '' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function ask(thread: ChatMessage[]) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus({ kind: 'sending' });
    const body: ChatRequestInput = {
      ideaIndex,
      idea,
      messages: thread.slice(-MAX_CHAT_MESSAGES),
      ...(scanId ? { scanId } : {}),
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
        setStatus(errorStatus(err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE'));
      },
    );
  }

  /** Añade la pregunta al hilo (queda guardada aunque falle) y pide la respuesta. */
  function send(text: string) {
    const content = text.trim();
    if (!content || status.kind === 'sending') return;
    const thread: ChatMessage[] = [...messages, { role: 'user', content }];
    saveChat(threadKey, thread);
    ask(thread);
  }

  /** Reenvía el mismo hilo, que termina en la pregunta sin respuesta. */
  function retry() {
    if (messages.at(-1)?.role === 'user') ask(messages);
  }

  return { messages, status, lastReply, send, retry };
}
