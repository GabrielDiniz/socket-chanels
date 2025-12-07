import { env } from './src/server/config/env';
import { createApp } from './src/server/app';

// Função principal de execução
async function main() {
  console.log('---------------------------------------------------');
  console.log(`Inicializando Painel de Chamada v1.0`);
  console.log(`Modo: 'HEADLESS (API Only)'`);
  console.log('---------------------------------------------------');

  try {
    // Cria a aplicação usando a factory
    const { httpServer, io } = await createApp();

    // Inicia o servidor na porta definida
    httpServer.listen(env.PORT, () => {
      console.log(`> Server rodando em http://localhost:${env.PORT}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nEncerrando servidor...');
      io.close(() => {
        httpServer.close(() => {
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    console.error('Falha crítica ao iniciar o servidor:', err);
    process.exit(1);
  }
}

// Executa se este arquivo for o ponto de entrada principal
if (require.main === module) {
  main();
}

// Exporta para casos de uso específicos se necessário (embora createApp seja preferível)
export { main };