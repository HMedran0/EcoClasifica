import {
  IDEA_EXTRA_MATERIAL_MAX,
  IDEA_OBJECT_NAME_MAX,
  type ChatIdea,
  type Idea,
} from '@ecoclasifica/shared';
import { capitalizeFirst } from '../classify/materialLabels';

/**
 * Adapta una idea de upcycle (o la copia de un favorito) al contrato de /chat: el nombre del objeto
 * y los materiales de la IA no tienen los mismos límites, así que se limpian y recortan aquí para
 * no recibir un 400.
 */
export function toChatIdea(
  objectName: string,
  idea: Pick<Idea, 'title' | 'description' | 'extraMaterials'>,
): ChatIdea {
  return {
    objectName: cut(capitalizeFirst(objectName.trim()) || 'Residuo', IDEA_OBJECT_NAME_MAX),
    title: idea.title.trim() || 'Idea sin título',
    description: idea.description.trim(),
    extraMaterials: idea.extraMaterials
      .map((m) => cut(m.trim(), IDEA_EXTRA_MATERIAL_MAX))
      .filter(Boolean),
  };
}

function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
