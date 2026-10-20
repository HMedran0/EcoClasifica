import { describe, expect, it } from 'vitest';
import { toChatIdea } from './chatIdea';
import { toBlocks } from './MessageText';

const idea = { ideaIndex: 0, title: 'Maceta', description: 'Siembra.', extraMaterials: [] };

describe('toChatIdea', () => {
  it('capitaliza el objeto y quita materiales vacíos', () => {
    expect(toChatIdea(' frasco ', { ...idea, extraMaterials: ['Tierra', '  '] })).toEqual({
      objectName: 'Frasco',
      title: 'Maceta',
      description: 'Siembra.',
      extraMaterials: ['Tierra'],
    });
  });

  it('recorta lo que excede el contrato del chat y rellena vacíos', () => {
    const chatIdea = toChatIdea('x'.repeat(100), {
      ...idea,
      title: ' ',
      extraMaterials: ['m'.repeat(70)],
    });
    expect(chatIdea.objectName).toHaveLength(80);
    expect(chatIdea.objectName.endsWith('…')).toBe(true);
    expect(chatIdea.extraMaterials[0]).toHaveLength(60);
    expect(chatIdea.title).toBe('Idea sin título');
    expect(toChatIdea('', idea).objectName).toBe('Residuo');
  });
});

describe('toBlocks', () => {
  it('agrupa listas numeradas y párrafos, conservando el número inicial', () => {
    expect(toBlocks('Hola\n\n1. Uno\n2) Dos\nNota final\n3. Tres')).toEqual([
      { kind: 'paragraph', text: 'Hola' },
      { kind: 'list', items: ['Uno', 'Dos'], start: 1 },
      { kind: 'paragraph', text: 'Nota final' },
      { kind: 'list', items: ['Tres'], start: 3 },
    ]);
  });
});
