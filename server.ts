import { env } from './src/server/config/env';
import { createApp } from './src/server/app';
import { logger } from './src/server/config/logger'; // Importa logger

// Função principal de execução
async function main() {
  logger.info('---------------------------------------------------');
  logger.info(`Inicializando Painel de Chamada v1.0`);
  logger.info(`Modo: 'HEADLESS (API Only)'`);
  logger.info('---------------------------------------------------');

  try {
    // Cria a aplicação usando a factory
    const { httpServer, io } = await createApp();

    // Inicia o servidor na porta definida
    httpServer.listen(env.PORT, () => {
      logger.info(`> Server rodando em http://localhost:${env.PORT}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('\nEncerrando servidor...');
      io.close(() => {
        httpServer.close(() => {
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err: any) { // Tipagem explícita para evitar erro de TS
    logger.error('Falha crítica ao iniciar o servidor:', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Executa se este arquivo for o ponto de entrada principal
if (require.main === module) {
  main();
}

export { main };