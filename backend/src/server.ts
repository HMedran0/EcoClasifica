import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

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
