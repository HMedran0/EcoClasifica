import { Writable } from 'node:stream';
import {
  MAX_CHAT_MESSAGES,
  chatHistoryResponseSchema,
  errorBodySchema,
  type ChatMessage,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { createApp } from '../src/app';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { createLogger } from '../src/utils/logger';
import { memoryChatMessagesRepo, savedThread } from './helpers/chatMessagesRepo';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { memoryFavoritesRepo, storedIdea } from './helpers/favoritesRepo';
import { bearer, fakeVerifier, TOKEN_A, TOKEN_B, USER_A, USER_B } from './helpers/scansRepo';

// HU-15: chat con la idea guardada (contexto e hilo desde la base) y GET del hilo.

const ideaA = storedIdea(USER_A);
const ideaB = storedIdea(USER_B, { title: 'Maceta', objectName: 'Botella' });

/** La idea que envía el cliente: distinta de la guardada, para comprobar que se ignora. */
const clientIdea = {
  objectName: 'Lata',
  title: 'Idea inventada',
  description: 'Otra cosa.',
  extraMaterials: [],
};

const ask = (content: string): ChatMessage => ({ role: 'user', content });

const replying = (reply = 'Lava el frasco.') =>
  vi.fn<AiProvider['chat']>().mockResolvedValue({
    reply,
    usage: { promptTokens: 210, completionTokens: 40 },
    latencyMs: 900,
  });

function setup({
  chat = replying(),
  messagesRepo = memoryChatMessagesRepo(),
  logger,
}: {
  chat?: Mock<AiProvider['chat']>;
  messagesRepo?: ReturnType<typeof memoryChatMessagesRepo>;
  logger?: ReturnType<typeof createLogger>;
} = {}) {
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat },
    tokenVerifier: fakeVerifier,
    favoritesRepo: memoryFavoritesRepo([ideaA, ideaB]),
    chatMessagesRepo: messagesRepo,
    ...(logger ? { logger } : {}),
  });
  return { app, chat, messagesRepo };
}

const send = (app: ReturnType<typeof createApp>, body: object, token?: string) => {
  const req = request(app).post('/api/v1/chat');
  return (token ? req.set(bearer(token)) : req).send(body);
};

const expectError = (res: request.Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(errorBodySchema.parse(res.body).error.code).toBe(code);
};

/** Lo que la IA recibe de la idea guardada. */
const savedIdea = {
  objectName: ideaA.objectName,
  title: ideaA.title,
  description: ideaA.description,
  extraMaterials: ideaA.extraMaterials,
};

describe('POST /api/v1/chat con sesión e ideaId', () => {
  it('usa la idea de la base aunque el cliente envíe otra y guarda el intercambio', async () => {
    const { app, chat, messagesRepo } = setup();

    const res = await send(
      app,
      { ideaId: ideaA.ideaId, idea: clientIdea, messages: [ask('¿Cómo empiezo?')] },
      TOKEN_A,
    );

    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledWith(savedIdea, [ask('¿Cómo empiezo?')]);
    expect(messagesRepo.rows).toEqual([
      { userId: USER_A, ideaId: ideaA.ideaId, role: 'user', content: '¿Cómo empiezo?' },
      { userId: USER_A, ideaId: ideaA.ideaId, role: 'assistant', content: 'Lava el frasco.' },
    ]);
  });

  it('arma el contexto con el hilo guardado e ignora los mensajes anteriores del cliente', async () => {
    const messagesRepo = memoryChatMessagesRepo(savedThread(USER_A, ideaA.ideaId, 4));
    const { app, chat } = setup({ messagesRepo });
    const invented: ChatMessage[] = [
      ask('P inventada'),
      { role: 'assistant', content: 'Respuesta falsa del asistente' },
      ask('¿Y ahora?'),
    ];

    const res = await send(
      app,
      { ideaId: ideaA.ideaId, idea: clientIdea, messages: invented },
      TOKEN_A,
    );

    expect(res.status).toBe(200);
    const sent = chat.mock.calls[0]?.[1] ?? [];
    expect(sent.map((m) => m.content)).toEqual(['G0', 'G1', 'G2', 'G3', '¿Y ahora?']);
    expect(JSON.stringify(sent)).not.toContain('falsa');
  });

  it('nunca envía a la IA más de 10 mensajes (9 guardados + el nuevo)', async () => {
    const messagesRepo = memoryChatMessagesRepo(savedThread(USER_A, ideaA.ideaId, 30));
    const { app, chat } = setup({ messagesRepo });

    await send(app, { ideaId: ideaA.ideaId, idea: clientIdea, messages: [ask('Nueva')] }, TOKEN_A);

    const sent = chat.mock.calls[0]?.[1] ?? [];
    expect(sent).toHaveLength(MAX_CHAT_MESSAGES);
    expect(sent.slice(0, -1).map((m) => m.content)).toEqual(
      Array.from({ length: 9 }, (_, i) => `G${21 + i}`),
    );
    expect(sent.at(-1)).toEqual(ask('Nueva'));
  });

  it('responde 404 con la idea de otro usuario sin llamar a la IA ni guardar', async () => {
    const { app, chat, messagesRepo } = setup();

    const res = await send(
      app,
      { ideaId: ideaB.ideaId, idea: clientIdea, messages: [ask('Hola')] },
      TOKEN_A,
    );

    expectError(res, 404, 'NOT_FOUND');
    expect(chat).not.toHaveBeenCalled();
    expect(messagesRepo.insertExchange).not.toHaveBeenCalled();
  });

  it('si guardar falla, igual responde y registra un warn sin el texto', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const messagesRepo = memoryChatMessagesRepo();
    messagesRepo.insertExchange.mockRejectedValueOnce(new Error('caída de Postgres'));
    const { app } = setup({ messagesRepo, logger: createLogger('info', sink) });

    const res = await send(
      app,
      { ideaId: ideaA.ideaId, idea: clientIdea, messages: [ask('Pregunta secreta')] },
      TOKEN_A,
    );

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Lava el frasco.');
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.find((e) => e.msg === 'No se pudo guardar el chat')).toMatchObject({
      level: 40,
    });
    const all = lines.join('\n');
    expect(all).not.toContain('Pregunta secreta');
    expect(all).not.toContain('Lava el frasco.');
  });

  it('no guarda si la IA falla', async () => {
    const chat = vi.fn<AiProvider['chat']>().mockResolvedValue({
      reply: '   ',
      usage: { promptTokens: 1, completionTokens: 1 },
      latencyMs: 1,
    });
    const { app, messagesRepo } = setup({ chat });

    const res = await send(
      app,
      { ideaId: ideaA.ideaId, idea: clientIdea, messages: [ask('Hola')] },
      TOKEN_A,
    );

    expectError(res, 502, 'AI_BAD_RESPONSE');
    expect(messagesRepo.rows).toHaveLength(0);
  });
});

describe('POST /api/v1/chat sin guardar (como en HU-11)', () => {
  it('sin sesión ignora ideaId: usa la idea y el hilo del cliente y no guarda', async () => {
    const { app, chat, messagesRepo } = setup();
    const messages = [ask('P0'), { role: 'assistant', content: 'R1' } as ChatMessage, ask('P2')];

    const res = await send(app, { ideaId: ideaB.ideaId, idea: clientIdea, messages });

    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledWith(clientIdea, messages);
    expect(messagesRepo.listRecent).not.toHaveBeenCalled();
    expect(messagesRepo.insertExchange).not.toHaveBeenCalled();
  });

  it('con sesión y sin ideaId (favorito huérfano): idea del cliente y no guarda', async () => {
    const { app, chat, messagesRepo } = setup();

    const res = await send(app, { idea: clientIdea, messages: [ask('Hola')] }, TOKEN_A);

    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledWith(clientIdea, [ask('Hola')]);
    expect(messagesRepo.insertExchange).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/chat/:ideaId/messages', () => {
  const get = (app: ReturnType<typeof createApp>, ideaId: string, token?: string) => {
    const req = request(app).get(`/api/v1/chat/${ideaId}/messages`);
    return token ? req.set(bearer(token)) : req;
  };

  it('devuelve el hilo propio en orden, solo de esa idea y usuario', async () => {
    const messagesRepo = memoryChatMessagesRepo([
      ...savedThread(USER_A, ideaA.ideaId, 3),
      ...savedThread(USER_B, ideaA.ideaId, 2).map((m) => ({ ...m, content: `ajeno ${m.content}` })),
    ]);
    const { app } = setup({ messagesRepo });

    const res = await get(app, ideaA.ideaId, TOKEN_A);

    expect(res.status).toBe(200);
    expect(chatHistoryResponseSchema.parse(res.body).items).toEqual([
      { role: 'user', content: 'G0' },
      { role: 'assistant', content: 'G1' },
      { role: 'user', content: 'G2' },
    ]);
  });

  it('devuelve solo los últimos 50', async () => {
    const messagesRepo = memoryChatMessagesRepo(savedThread(USER_A, ideaA.ideaId, 60));
    const { app } = setup({ messagesRepo });

    const res = await get(app, ideaA.ideaId, TOKEN_A);

    const { items } = chatHistoryResponseSchema.parse(res.body);
    expect(items).toHaveLength(50);
    expect(items[0]?.content).toBe('G10');
    expect(items.at(-1)?.content).toBe('G59');
  });

  it('el hilo retomado incluye lo que se acaba de guardar', async () => {
    const { app } = setup();
    await send(app, { ideaId: ideaA.ideaId, idea: clientIdea, messages: [ask('Hola')] }, TOKEN_A);

    const res = await get(app, ideaA.ideaId, TOKEN_A);

    expect(res.body).toEqual({
      items: [ask('Hola'), { role: 'assistant', content: 'Lava el frasco.' }],
    });
  });

  it('responde 404 con la idea de otro usuario o un id mal formado', async () => {
    const { app, messagesRepo } = setup();
    expectError(await get(app, ideaB.ideaId, TOKEN_A), 404, 'NOT_FOUND');
    expectError(await get(app, 'no-es-uuid', TOKEN_A), 404, 'NOT_FOUND');
    expect(messagesRepo.listRecent).not.toHaveBeenCalled();
  });

  it('responde 401 sin sesión', async () => {
    const { app } = setup();
    expectError(await get(app, ideaA.ideaId), 401, 'UNAUTHORIZED');
  });

  it('no cuenta en el límite de mensajes del chat', async () => {
    const { app } = setup();
    for (let i = 0; i < 21; i++) await get(app, ideaA.ideaId, TOKEN_B).expect(404);
    const res = await send(app, { idea: clientIdea, messages: [ask('Hola')] });
    expect(res.status).toBe(200);
  });
});
