import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekProvider } from '../src/services/ai/deepseek.provider';

const cfg = {
  apiKey: 'test-key',
  baseUrl: 'https://ai.example.test',
  model: 'deepseek-flash',
  maxTokens: 384,
  chatMaxTokens: 512,
  timeoutMs: 1000,
};
const image = { base64: 'QUJD'.repeat(30), mimeType: 'image/jpeg' as const };

const completion = (content: string, finish = 'stop') =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finish }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }),
    { status: 200 },
  );

const goodClassify = JSON.stringify({
  is_waste: true,
  object: 'Botella',
  material: 'plastico',
  material_detail: 'PET',
  confidence: 0.93,
  alternatives: [],
});

afterEach(() => vi.unstubAllGlobals());

describe('DeepSeekProvider', () => {
  it('envía el payload esperado (modelo, max_tokens, JSON y data URI)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion(goodClassify));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new DeepSeekProvider(cfg).classify(image);

    expect(result.data.material).toBe('plastico');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://ai.example.test/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-flash');
    expect(body.max_tokens).toBe(384);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('reintenta una vez si el JSON es inválido y suma los tokens', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion('no es json'))
      .mockResolvedValueOnce(completion(goodClassify));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new DeepSeekProvider(cfg).classify(image);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 40 });
  });

  it('lanza AI_BAD_RESPONSE si falla dos veces', async () => {
    // Cada llamada necesita su propio Response (el cuerpo solo se puede leer una vez).
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => completion('{"x":1}')),
    );
    await expect(new DeepSeekProvider(cfg).classify(image)).rejects.toMatchObject({
      code: 'AI_BAD_RESPONSE',
    });
  });

  it('trata un JSON truncado (finish_reason length) como error recuperable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion('{"is_waste": tr', 'length'))
      .mockResolvedValueOnce(completion(goodClassify));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new DeepSeekProvider(cfg).classify(image);
    expect(result.data.object).toBe('Botella');
  });

  it('convierte un material desconocido en "otro"', async () => {
    const odd = JSON.stringify({ ...JSON.parse(goodClassify), material: 'titanio' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion(odd)));
    const result = await new DeepSeekProvider(cfg).classify(image);
    expect(result.data.material).toBe('otro');
  });
});
