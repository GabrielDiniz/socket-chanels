// Para rodar: npx ts-node scripts/test-broadcast.ts
import { io } from 'socket.io-client';

const PORT = process.env.PORT || '3000';
const URL = `http://localhost:${PORT}`;
const CHANNEL = 'recepcao_01'; // Canal de teste

console.log(`🔵 Tentando conectar ao servidor em ${URL}...`);

const socket = io(URL, {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log(`✅ [SOCKET] Conectado com sucesso! ID: ${socket.id}`);
  
  // Entra no canal
  console.log(`➡️  [SOCKET] Entrando no canal: ${CHANNEL}`);
  socket.emit('join_channel', CHANNEL);
});

socket.on('connect_error', (err) => {
  console.error(`❌ [SOCKET] Erro de conexão: ${err.message}`);
});

// Ouve o evento de chamada (A PROVA DO FUNCIONAMENTO)
socket.on('call_update', (data) => {
  console.log('\n🔔 [EVENTO RECEBIDO] call_update');
  console.log('---------------------------------------------------');
  console.dir(data, { depth: null, colors: true });
  console.log('---------------------------------------------------');
  
  console.log('✅ Teste concluído com sucesso. Encerrando...');
  socket.disconnect();
  process.exit(0);
});

socket.on('disconnect', () => {
  console.log('🔴 [SOCKET] Desconectado');
});

// Timeout de segurança
setTimeout(() => {
  console.error('\n❌ Timeout: Nenhuma chamada recebida em 30 segundos.');
  console.error('   Verifique se você enviou o POST para a API corretamente.');
  process.exit(1);
}, 30000);