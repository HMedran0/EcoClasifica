/** Lado largo máximo de la foto que se envía al backend. */
export const MAX_SIDE_PX = 768;
/** Tamaño objetivo del JPEG; por encima se baja la calidad. */
export const MAX_BYTES = 300 * 1024;
// En décimas para evitar errores de coma flotante (0,7 → 0,6 → 0,5).
const START_QUALITY_TENTHS = 7;
const MIN_QUALITY_TENTHS = 5;

const UNREADABLE_IMAGE =
  'No pudimos abrir esa imagen. Elige otra foto en formato JPEG, PNG o WebP.';
const ENCODE_FAILED = 'No pudimos procesar la foto. Intenta de nuevo.';
const CAMERA_NOT_READY = 'La cámara aún no está lista. Espera un momento e intenta de nuevo.';

/** Error de la preparación de la foto; `message` ya está en español para mostrarlo tal cual. */
export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}

export interface CompressedPhoto {
  /** Base64 sin prefijo `data:` (forma que espera `scanRequestSchema`). */
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  bytes: number;
  /** El JPEG final, para la vista previa con una object URL. */
  blob: Blob;
}

/** Imagen ya decodificada y lista para dibujar en un canvas. */
export interface Drawable {
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
}

export type JpegEncoder = (quality: number) => Promise<Blob>;
export type EncoderFactory = (drawable: Drawable, width: number, height: number) => JpegEncoder;

export interface CompressDeps {
  decodeFile: (file: Blob) => Promise<Drawable>;
  createEncoder: EncoderFactory;
}

/** Escala para que el lado largo no pase de `maxSide`, sin agrandar nunca la imagen. */
export function fitWithin(
  width: number,
  height: number,
  maxSide = MAX_SIDE_PX,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Codifica a 0,7 y baja de 0,1 en 0,1 hasta 0,5 mientras supere `maxBytes`. */
export async function encodeWithinBudget(encode: JpegEncoder, maxBytes = MAX_BYTES): Promise<Blob> {
  for (let tenths = START_QUALITY_TENTHS; ; tenths--) {
    const blob = await encode(tenths / 10);
    if (blob.size <= maxBytes || tenths <= MIN_QUALITY_TENTHS) return blob;
  }
}

/** Foto de la galería. Un archivo que no se puede decodificar da un `PhotoError`. */
export async function compressImage(
  file: Blob,
  deps: CompressDeps = browserDeps,
): Promise<CompressedPhoto> {
  let drawable: Drawable;
  try {
    drawable = await deps.decodeFile(file);
  } catch {
    throw new PhotoError(UNREADABLE_IMAGE);
  }
  try {
    if (!drawable.width || !drawable.height) throw new PhotoError(UNREADABLE_IMAGE);
    return await compressDrawable(drawable, deps.createEncoder);
  } finally {
    drawable.release?.();
  }
}

/** Cuadro actual de la cámara en vivo. */
export async function compressVideoFrame(
  video: HTMLVideoElement,
  createEncoder: EncoderFactory = canvasEncoder,
): Promise<CompressedPhoto> {
  const { videoWidth: width, videoHeight: height } = video;
  if (!width || !height) throw new PhotoError(CAMERA_NOT_READY);
  return compressDrawable({ source: video, width, height }, createEncoder);
}

async function compressDrawable(
  drawable: Drawable,
  createEncoder: EncoderFactory,
): Promise<CompressedPhoto> {
  const size = fitWithin(drawable.width, drawable.height);
  const blob = await encodeWithinBudget(createEncoder(drawable, size.width, size.height));
  return {
    base64: await blobToBase64(blob),
    mimeType: 'image/jpeg',
    ...size,
    bytes: blob.size,
    blob,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000; // Evita pasar demasiados argumentos a `fromCharCode`.
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** `from-image` aplica la orientación EXIF: las fotos verticales no llegan giradas. */
async function decodeWithBitmap(file: Blob): Promise<Drawable> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
  };
}

/** Dibuja una sola vez; cada llamada al codificador solo cambia la calidad del JPEG. */
function canvasEncoder(drawable: Drawable, width: number, height: number): JpegEncoder {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError(ENCODE_FAILED);
  ctx.drawImage(drawable.source, 0, 0, width, height);
  return (quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new PhotoError(ENCODE_FAILED))),
        'image/jpeg',
        quality,
      );
    });
}

const browserDeps: CompressDeps = { decodeFile: decodeWithBitmap, createEncoder: canvasEncoder };
