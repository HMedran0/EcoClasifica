import { createApp } from './app';
import { env, productionConfigErrors } from './config/env';
import { logger } from './utils/logger';

// Aquí y no en createApp: las pruebas crean la app sin estas variables.
// Solo nombres de variables: nunca sus valores.
const { missing, invalid } = productionConfigErrors(env);
if (missing.length > 0 || invalid.length > 0) {
  logger.fatal(
    { missing, invalid },
    `Configuración inválida. Faltan: ${missing.join(', ') || '—'}. Inválidas: ${invalid.join(', ') || '—'}`,
  );
  process.exit(1);
}

const app = createApp();

// Railway inyecta PORT; en local es 3000.
const server = app.listen(env.PORT, () => {
  logger.info(`EcoClasifica API escuchando en el puerto ${env.PORT}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} recibido, cerrando servidor`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
