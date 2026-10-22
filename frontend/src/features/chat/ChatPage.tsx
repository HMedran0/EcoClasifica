import {
  CHAT_MESSAGE_MAX,
  chatIdeaSchema,
  type ChatIdea,
  type ChatMessage,
} from '@ecoclasifica/shared';
import { z } from 'zod';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { isUntilTomorrow } from '../../api/errors';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { PRIMARY, SECONDARY, TITLE } from '../scan/ScanScreen';
import { toChatIdea } from './chatIdea';
import { MessageText } from './MessageText';
import { useChat, type ChatRequest, type ChatStatus, type ChatThreadRequest } from './useChat';

export const STARTERS = [
  '¿Cómo empiezo?',
  '¿Qué herramientas necesito?',
  '¿Es seguro hacerlo con niños?',
] as const;

export const ORPHAN_NOTICE = 'El escaneo original se eliminó; esta conversación no se guardará.';

/**
 * Estado de navegación con el que se abre el chat: /ideas envía solo `ideaIndex`, el detalle del
 * historial `saved` y la lista de favoritos `favorite`.
 */
export type ChatLocationState =
  | { ideaIndex: number }
  /** HU-13: idea de un escaneo guardado; no depende de la foto actual. */
  | { ideaIndex: number; saved: { scanId: string; ideaId?: string; idea: ChatIdea } }
  /** HU-15: copia de un favorito; `ideaId` es `null` si el escaneo original se borró. */
  | { favorite: { id: string; ideaId: string | null; idea: ChatIdea } };

const savedIdeaSchema = z.object({
  ideaIndex: z.number().int(),
  saved: z.object({
    scanId: z.string().uuid(),
    ideaId: z.string().uuid().optional(),
    idea: chatIdeaSchema,
  }),
});

const favoriteIdeaSchema = z.object({
  favorite: z.object({
    id: z.string().uuid(),
    ideaId: z.string().uuid().nullable(),
    idea: chatIdeaSchema,
  }),
});

interface ChatPageProps {
  chat?: ChatRequest;
  loadThread?: ChatThreadRequest;
}

/** HU-10, HU-11 y HU-15: chat paso a paso sobre la idea elegida en /ideas, historial o favoritos. */
export function ChatPage({ chat = api.chat, loadThread = api.chatMessages }: ChatPageProps) {
  const context = useIdeaContext();
  const signedIn = useAuthStore((s) => s.session !== null);
  if (!context) return <Navigate to="/camara" replace />;
  // Solo con sesión el hilo de una idea guardada vive en el servidor.
  const savedIdeaId = signedIn ? context.ideaId : null;
  const threadKey = savedIdeaId ? `idea:${savedIdeaId}` : context.threadKey;
  // `key`: otra idea es otro hilo y otro estado.
  return (
    <ChatView
      key={threadKey}
      {...context}
      threadKey={threadKey}
      savedIdeaId={savedIdeaId}
      request={chat}
      loadThread={loadThread}
    />
  );
}

interface IdeaContext {
  ideaIndex?: number;
  idea: ChatIdea;
  scanId: string | null;
  /** Id de la idea en `scan_ideas`, si el escaneo se guardó (y sigue existiendo). */
  ideaId: string | null;
  /** Clave del hilo en memoria (sin sesión): los del historial no se mezclan con los de la foto. */
  threadKey: string;
  back: { to: string; label: string };
  notice?: string;
}

/**
 * La idea sale del favorito o del escaneo guardado que abrió el chat (historial), o de la
 * respuesta de upcycle de la foto actual; sin ninguna no hay chat.
 */
function useIdeaContext(): IdeaContext | null {
  const { state } = useLocation();
  const photo = usePhotoStore((s) => s.photo);
  const upcycle = usePhotoStore((s) => s.results.upcycle);
  const favorite = favoriteIdeaSchema.safeParse(state);
  if (favorite.success) {
    const { id, ideaId, idea } = favorite.data.favorite;
    return {
      idea,
      scanId: null,
      ideaId,
      threadKey: `favorito:${id}`,
      back: { to: '/favoritos', label: 'Volver a mis favoritos' },
      // Sin la idea original no hay dónde guardar: contexto desde la copia, solo en memoria.
      ...(ideaId === null ? { notice: ORPHAN_NOTICE } : {}),
    };
  }
  const saved = savedIdeaSchema.safeParse(state);
  if (saved.success) {
    const {
      ideaIndex,
      saved: { scanId, ideaId, idea },
    } = saved.data;
    return {
      ideaIndex,
      idea,
      scanId,
      ideaId: ideaId ?? null,
      threadKey: `historial:${scanId}:${ideaIndex}`,
      back: { to: `/historial/${scanId}`, label: 'Volver al escaneo' },
    };
  }
  const ideaIndex = readIdeaIndex(state);
  if (!photo || ideaIndex === null || upcycle?.photoId !== photo.id) return null;
  const { result, scanId } = upcycle.data;
  if (!result.canUpcycle) return null;
  const idea = result.ideas.find((i) => i.ideaIndex === ideaIndex);
  if (!idea) return null;
  return {
    ideaIndex,
    idea: toChatIdea(result.objectName, idea),
    scanId,
    ideaId: idea.ideaId ?? null,
    threadKey: String(ideaIndex),
    back: { to: '/ideas', label: 'Volver a las ideas' },
  };
}

function readIdeaIndex(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('ideaIndex' in state)) return null;
  const { ideaIndex } = state as { ideaIndex: unknown };
  return typeof ideaIndex === 'number' ? ideaIndex : null;
}

type ChatViewProps = Omit<IdeaContext, 'ideaId'> & {
  savedIdeaId: string | null;
  request: ChatRequest;
  loadThread: ChatThreadRequest;
};

function ChatView({ back, notice, ...context }: ChatViewProps) {
  const navigate = useNavigate();
  const { messages, status, lastReply, ready, send, retry } = useChat(context);
  const [draft, setDraft] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const busy = !ready || status.kind === 'sending';

  useEffect(() => headingRef.current?.focus(), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <IdeaHeader idea={context.idea} headingRef={headingRef} />
      {notice && (
        <p className="rounded-2xl border-2 border-bosque/30 bg-white p-3 text-base text-bosque">
          {notice}
        </p>
      )}

      {messages.length === 0 && !busy && (
        <section aria-labelledby="starters-title" className="flex flex-col gap-2">
          <h2 id="starters-title" className="text-base font-semibold text-bosque">
            Puedes empezar con:
          </h2>
          {STARTERS.map((text) => (
            <button key={text} type="button" className={SECONDARY} onClick={() => send(text)}>
              {text}
            </button>
          ))}
        </section>
      )}

      <Thread messages={messages} />
      {/* Solo la respuesta nueva se anuncia; el hilo completo no se relee. */}
      <p aria-live="polite" className="sr-only">
        <span key={lastReply.id}>{lastReply.text}</span>
      </p>
      <StatusView status={status} onRetry={retry} />

      <form onSubmit={submit} className="mt-auto flex flex-col gap-3">
        <label htmlFor="chat-input" className="text-base font-semibold text-petroleo">
          Tu pregunta
        </label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MESSAGE_MAX}
          rows={2}
          placeholder="Escribe tu duda sobre la manualidad"
          className="min-h-tactil rounded-2xl border-2 border-bosque bg-white p-3 text-base text-petroleo"
        />
        <button type="submit" className={PRIMARY} disabled={busy || !draft.trim()}>
          Enviar
        </button>
        <button type="button" className={SECONDARY} onClick={() => navigate(back.to)}>
          {back.label}
        </button>
      </form>
    </main>
  );
}

function IdeaHeader({
  idea,
  headingRef,
}: {
  idea: ChatIdea;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-base text-bosque">{idea.objectName}</p>
      <h1 ref={headingRef} tabIndex={-1} className={TITLE}>
        {idea.title}
      </h1>
      {idea.extraMaterials.length > 0 && (
        <p className="text-sm text-bosque">
          <span className="font-semibold">Necesitas además:</span> {idea.extraMaterials.join(', ')}
        </p>
      )}
    </header>
  );
}

function Thread({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <ol aria-label="Conversación" className="flex flex-col gap-3">
      {messages.map((m, i) => (
        <li
          key={i}
          className={
            m.role === 'user'
              ? 'ml-8 rounded-2xl bg-petroleo p-3 text-base text-white'
              : 'mr-8 rounded-2xl border-2 border-bosque/30 bg-white p-3 text-base text-bosque'
          }
        >
          <span className="sr-only">{m.role === 'user' ? 'Tú: ' : 'EcoClasifica: '}</span>
          <MessageText text={m.content} />
        </li>
      ))}
    </ol>
  );
}

function StatusView({ status, onRetry }: { status: ChatStatus; onRetry: () => void }) {
  if (status.kind === 'sending' || status.kind === 'loading') {
    return (
      <p role="status" className="text-base text-bosque italic">
        {status.kind === 'sending' ? 'Escribiendo…' : 'Cargando la conversación…'}
      </p>
    );
  }
  if (status.kind !== 'error') return null;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 border-bosque p-4">
      <p className="text-base text-bosque">{status.message}</p>
      {status.code !== 'UNSAFE_REQUEST' && !isUntilTomorrow(status.code) && (
        <button type="button" className={SECONDARY} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
