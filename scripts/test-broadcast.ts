// scripts/test-broadcast.ts
// Painel de teste permanente — escuta chamadas para sempre

const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://server:3000';
const CHANNEL = process.env.CHANNEL || 'recepcao-principal';

console.log(`\nPAINEL DE TESTE PERMANENTE`);
console.log(`Servidor: ${SERVER_URL}`);
console.log(`Canal: ${CHANNEL}`);
console.log(`Aguardando chamadas em tempo real... (Ctrl+C para parar)\n`);

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 3000,
});

socket.on('connect', () => {
  console.log(`[SOCKET] Conectado! ID: ${socket.id}`);
  socket.emit('join_channel', CHANNEL);
  console.log(`[SOCKET] Entrou na sala: ${CHANNEL}\n`);
});

socket.on('connect_error', (err: any) => {
  console.error(`[ERRO] Falha na conexão: ${err.message}`);
});

socket.on('call_update', (data: any) => {
  console.log('CHAMADA RECEBIDA!');
  console.log('════════════════════════════════════════════════');
  console.dir(data, { depth: null, colors: true });
  console.log('════════════════───────────────────────────────\n');
});

// Mantém vivo pra sempre
process.on('SIGINT', () => {
  console.log('\nEncerrando painel de teste...');
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  socket.disconnect();
  process.exit(0);
});