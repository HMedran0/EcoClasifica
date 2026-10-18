import { MAX_IMAGE_BYTES, type ImageMime } from '@ecoclasifica/shared';
import { AppError } from './appError';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Longitud máxima en Base64 de una imagen de 4 MB (4 caracteres por cada 3 bytes). */
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

/** Detecta el tipo real por los primeros bytes (firma del archivo). */
export function detectImageMime(bytes: Buffer): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Comprueba que el Base64 sea válido, ≤ 4 MB y que el tipo declarado coincida con los bytes. */
export function assertValidImage(base64: string, declaredMime: ImageMime): void {
  // Antes de la regex y de decodificar, para no gastar CPU ni memoria en imágenes enormes.
  if (base64.length > MAX_BASE64_LENGTH) {
    throw new AppError('INVALID_IMAGE', 'La imagen supera el máximo de 4 MB');
  }
  if (base64.length % 4 !== 0 || !BASE64_PATTERN.test(base64)) {
    throw new AppError('INVALID_IMAGE', 'La imagen no está codificada correctamente');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new AppError('INVALID_IMAGE', 'La imagen supera el máximo de 4 MB');
  }
  if (detectImageMime(bytes) !== declaredMime) {
    throw new AppError('INVALID_IMAGE', 'El archivo no es una imagen JPEG, PNG o WebP válida');
  }
}
