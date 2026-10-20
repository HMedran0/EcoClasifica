export const MATERIALS = [
  'plastico',
  'papel',
  'carton',
  'vidrio',
  'metal',
  'organico',
  'textil',
  'electronico',
  'peligroso',
  'madera',
  'mixto',
  'otro',
] as const;
export type MaterialCode = (typeof MATERIALS)[number];

export const BIN_CODES = ['WHITE', 'BLACK', 'GREEN', 'DROP_OFF', 'BULKY'] as const;
export type BinCode = (typeof BIN_CODES)[number];

export const DIFFICULTIES = ['Fácil', 'Medio', 'Difícil'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

/** Por debajo de este valor el resultado se marca como `lowConfidence`. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
/** Máximo de mensajes de chat que se envían a la IA. */
export const MAX_CHAT_MESSAGES = 10;
/** Tamaño máximo de la imagen (bytes, ya decodificada). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Longitud máxima en Base64 de una imagen de 4 MB (4 caracteres por cada 3 bytes). */
export const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
/** Longitud máxima de una etiqueta de idioma BCP 47 (p. ej. `es-CO`). */
export const MAX_LOCALE_LENGTH = 35;
export const UPCYCLE_IDEAS_COUNT = 3;
/** Límites de lo que se entrega al cliente en upcycle (el backend recorta en palabra completa). */
export const UPCYCLE_TITLE_MAX = 60;
export const UPCYCLE_DESCRIPTION_MAX = 120;
export const UPCYCLE_REASON_MAX = 160;
export const UPCYCLE_EXTRA_MATERIALS_MAX = 5;
export const DEFAULT_MUNICIPALITY = 'DEFAULT';
