import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.id ?? '');

  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = new AppError('VALIDATION_ERROR', 'Los datos enviados no son válidos', err.flatten());
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
