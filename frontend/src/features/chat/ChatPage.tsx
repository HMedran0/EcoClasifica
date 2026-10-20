import { CHAT_MESSAGE_MAX, type ChatIdea, type ChatMessage } from '@ecoclasifica/shared';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { usePhotoStore } from '../camera/photoStore';
import { PRIMARY, SECONDARY, TITLE } from '../scan/ScanScreen';
import { toChatIdea } from './chatIdea';
import { MessageText } from './MessageText';
import { useChat, type ChatRequest, type ChatStatus } from './useChat';

export const STARTERS = [
  '¿Cómo empiezo?',
  '¿Qué herramientas necesito?',
  '¿Es seguro hacerlo con niños?',
] as const;

/** Estado de navegación con el que /ideas abre el chat. */
export interface ChatLocationState {
  ideaIndex: number;
}

interface ChatPageProps {
  chat?: ChatRequest;
}

/** HU-10 y HU-11: chat paso a paso sobre la idea elegida en /ideas. */
export function ChatPage({ chat = api.chat }: ChatPageProps) {
  const context = useIdeaContext();
  if (!context) return <Navigate to="/camara" replace />;
  // `key`: otra idea es otro hilo y otro estado.
  return <ChatView key={context.ideaIndex} {...context} request={chat} />;
}

interface IdeaContext {
  ideaIndex: number;
  idea: ChatIdea;
  scanId: string | null;
}

/** La idea sale de la respuesta de upcycle de la foto actual; sin ella no hay chat. */
function useIdeaContext(): IdeaContext | null {
  const { state } = useLocation();
  const photo = usePhotoStore((s) => s.photo);
  const upcycle = usePhotoStore((s) => s.results.upcycle);
  const ideaIndex = readIdeaIndex(state);
  if (!photo || ideaIndex === null || upcycle?.photoId !== photo.id) return null;
  const { result, scanId } = upcycle.data;
  if (!result.canUpcycle) return null;
  const idea = result.ideas.find((i) => i.ideaIndex === ideaIndex);
  return idea ? { ideaIndex, idea: toChatIdea(result.objectName, idea), scanId } : null;
}

function readIdeaIndex(state: unknown): number | null {
  if (typeof state !== 'object' || state === null || !('ideaIndex' in state)) return null;
  const { ideaIndex } = state as { ideaIndex: unknown };
  return typeof ideaIndex === 'number' ? ideaIndex : null;
}

function ChatView({ request, ...context }: IdeaContext & { request: ChatRequest }) {
  const navigate = useNavigate();
  const { messages, status, lastReply, send, retry } = useChat({ ...context, request });
  const [draft, setDraft] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sending = status.kind === 'sending';

  useEffect(() => headingRef.current?.focus(), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    send(draft);
    setDraft('');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <IdeaHeader idea={context.idea} headingRef={headingRef} />

      {messages.length === 0 && !sending && (
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
        <button type="submit" className={PRIMARY} disabled={sending || !draft.trim()}>
          Enviar
        </button>
        <button type="button" className={SECONDARY} onClick={() => navigate('/ideas')}>
          Volver a las ideas
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
  if (status.kind === 'sending') {
    return (
      <p role="status" className="text-base text-bosque italic">
        Escribiendo…
      </p>
    );
  }
  if (status.kind !== 'error') return null;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 border-bosque p-4">
      <p className="text-base text-bosque">{status.message}</p>
      {status.code !== 'UNSAFE_REQUEST' && (
        <button type="button" className={SECONDARY} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
