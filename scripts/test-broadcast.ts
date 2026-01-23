// scripts/test-broadcast.ts
// Painel de teste permanente — escuta chamadas para sempre

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken'); 
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient(); 

const SERVER_URL = process.env.SERVER_URL || 'http://server:3000';
// Slug do canal que queremos escutar
const CHANNEL_SLUG = process.env.CHANNEL || 'recepcao-principal';

console.log(`\nPAINEL DE TESTE PERMANENTE`);
console.log(`Servidor: ${SERVER_URL}`);
console.log(`Canal Alvo: ${CHANNEL_SLUG}`);

async function main() {
  try {
    // 1. Busca a chave real do canal no banco para assinar o token corretamente
    console.log(`🔍 Buscando chave do canal '${CHANNEL_SLUG}' no banco...`);
    
    const channel = await prisma.channel.findUnique({
      where: { slug: CHANNEL_SLUG }
    });

    if (!channel) {
      console.error(`❌ Erro: Canal '${CHANNEL_SLUG}' não encontrado no banco.`);
      console.error(`   Certifique-se de ter criado o canal via API antes de rodar este teste.`);
      process.exit(1);
    }

    if (!channel.isActive) {
      console.warn(`⚠️ Aviso: O canal '${CHANNEL_SLUG}' está marcado como inativo.`);
    }

    const secretKey = channel.apiKey;
    console.log(`✅ Canal encontrado! ID: ${channel.id}`);
    console.log(`🔑 Usando chave real do banco: ${secretKey.substring(0, 8)}...`);

    // 2. Gera um token válido assinado com a chave do canal
    const token = jwt.sign(
      { role: 'test-client', channel: CHANNEL_SLUG }, 
      secretKey, 
      { expiresIn: '24h' }
    );
    
    console.log(`🎫 Token JWT gerado e assinado.`);
    console.log(`📡 Conectando ao WebSocket...\n`);

    // 3. Conecta ao Socket.IO
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      auth: {
        token, // Envia o token
        channelSlug: CHANNEL_SLUG // Envia o slug para o servidor saber qual chave usar na validação
      }
    });

    socket.on('connect', () => {
      console.log(`[SOCKET] Conectado! ID: ${socket.id}`);
      socket.emit('join_channel', CHANNEL_SLUG);
      console.log(`[SOCKET] Entrou na sala: ${CHANNEL_SLUG}`);
      console.log(`[STATUS] Aguardando chamadas... (Ctrl+C para sair)\n`);
    });

    socket.on('connect_error', (err: any) => {
      console.error(`[ERRO] Falha na conexão: ${err.message}`);
      if (err.data) {
        console.error('Detalhes:', err.data);
      }
    });

    socket.on('call_update', (data: any) => {
      console.log('🔔 CHAMADA RECEBIDA!');
      console.log('════════════════════════════════════════════════');
      console.dir(data, { depth: null, colors: true });
      console.log('════════════════───────────────────────────────\n');
    });

    // Cleanup no encerramento
    const cleanup = async () => {
      console.log('\nEncerrando painel de teste...');
      socket.disconnect();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  } catch (error) {
    console.error('Erro fatal no script:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();