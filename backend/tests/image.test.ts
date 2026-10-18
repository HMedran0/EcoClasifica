import { MAX_IMAGE_BYTES } from '@ecoclasifica/shared';
import { describe, expect, it } from 'vitest';
import { assertValidImage, detectImageMime } from '../src/utils/image';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(100),
]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(100),
]);

describe('detectImageMime', () => {
  it('reconoce JPEG, PNG y WebP por sus bytes', () => {
    expect(detectImageMime(jpeg)).toBe('image/jpeg');
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(webp)).toBe('image/webp');
  });

  it('devuelve null para otros formatos', () => {
    expect(detectImageMime(Buffer.from('GIF89a' + 'x'.repeat(50)))).toBeNull();
  });
});

describe('assertValidImage', () => {
  it('acepta una imagen cuyo tipo coincide con el declarado', () => {
    expect(() => assertValidImage(png.toString('base64'), 'image/png')).not.toThrow();
  });

  it('rechaza Base64 mal formado', () => {
    expect(() => assertValidImage('no es base64!!', 'image/jpeg')).toThrow(
      expect.objectContaining({ code: 'INVALID_IMAGE' }),
    );
  });

  it('rechaza imágenes de más de 4 MB', () => {
    const big = Buffer.concat([jpeg, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(() => assertValidImage(big.toString('base64'), 'image/jpeg')).toThrow(
      expect.objectContaining({ code: 'INVALID_IMAGE' }),
    );
  });
});
