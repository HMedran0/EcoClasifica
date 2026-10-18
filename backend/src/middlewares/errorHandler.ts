import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
};

/**
 * Un solo código para imagen inválida: si falla el campo `image` (tamaño o formato) se responde
 * INVALID_IMAGE aunque fallen otros campos, porque sin imagen usable no hay escaneo posible.
 */
function fromZodError(err: ZodError): AppError {
  const imageIssue = err.issues.find((issue) => issue.path[0] === 'image');
  if (imageIssue) {
    // Solo los límites de tamaño traen mensaje propio en español en el esquema; el resto es de Zod (inglés).
    const isSizeIssue = imageIssue.code === 'too_small' || imageIssue.code === 'too_big';
    return new AppError(
      'INVALID_IMAGE',
      isSizeIssue ? imageIssue.message : 'Falta la imagen o no está en Base64',
    );
  }
  return new AppError('VALIDATION_ERROR', 'Los datos enviados no son válidos', err.flatten());
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.id ?? '');

  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = fromZodError(err);
  } else if (err?.type === 'entity.too.large') {
    appError = new AppError('PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande');
  } else if (typeof err?.type === 'string' && err?.status === 400) {
    // Errores de body-parser (JSON roto, codificación): traen `err.body` con el texto crudo; no se loguean.
    appError = new AppError('VALIDATION_ERROR', 'El cuerpo de la solicitud no es JSON válido');
  } else {
    // Solo mensaje y pila: las propiedades del error podrían contener la imagen.
    logger.error(
      { error: { message: err?.message, stack: err?.stack }, requestId },
      'Error no controlado',
    );
    appError = new AppError('INTERNAL_ERROR', 'Ocurrió un error inesperado');
  }

  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, requestId },
  });
};
