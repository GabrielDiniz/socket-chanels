import { Server as SocketIOServer } from 'socket.io';
import { SocketService } from '../socket.service';
import { logger } from '../../config/logger';
import { verifyToken } from '../../utils/jwt.utils';
import { channelService } from '../channel.service';
import { PairingService } from '../pairing.service'; // Importação necessária

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/jwt.utils', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../channel.service', () => ({
  channelService: {
    findBySlug: jest.fn(),
  },
}));

describe('Socket Service', () => {
  let socketService: SocketService;
  let mockServer: any;
  let mockPairingService: jest.Mocked<PairingService>; // Mock do pairing service
  let middlewareCallback: Function;
  let connectionCallback: Function;
  let mockSocket: any;
  // Mapa para capturar eventos registrados no socket
  let socketEventHandlers: { [key: string]: Function } = {};
  
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
    
    mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'valid-token', channelSlug: 'sala-1' },
        query: {},
        headers: {},
      },
      // Simula o registro de eventos e armazena os callbacks
      on: jest.fn((event, cb) => {
        socketEventHandlers[event] = cb;
      }),
      off: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
    };
    
    mockServer = {
      on: jest.fn((event, callback) => {
        if (event === 'connection') connectionCallback = callback;
      }),
      use: jest.fn((callback) => {
        middlewareCallback = callback;
      }),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    
    mockPairingService = {
      registerTempCode: jest.fn(),
    } as any;
    
    // Injetando io e pairingService conforme a assinatura da classe
    socketService = new SocketService(mockServer as unknown as SocketIOServer, mockPairingService);
  });
  
  describe('Middleware de Autenticação', () => {
    it('Deve permitir conexão com token válido e canal existente', async () => {
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ 
        slug: 'sala-1', 
        apiKey: 'secret-key-123' 
      });
      (verifyToken as jest.Mock).mockReturnValue({ id: 'user-1' });
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      expect(next).toHaveBeenCalledWith();
    });
    
    /** Cobertura Linhas 37-39: Token ausente quando channelSlug é fornecido */
    it('Deve rejeitar conexão se o token estiver ausente e channelSlug estiver presente', async () => {
      mockSocket.handshake.auth.token = undefined;
      mockSocket.handshake.headers['authorization'] = undefined;
      const next = jest.fn();
      
      await middlewareCallback(mockSocket, next);
      
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Token ausente'));
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication error: Token missing' }));
    });
    
    /** Cobertura Linhas 66-68: Erro interno no processo de autenticação */
    it('Deve retornar Internal Server Error se ocorrer uma exceção no banco ou processamento', async () => {
      (channelService.findBySlug as jest.Mock).mockRejectedValue(new Error('DB Crash'));
      const next = jest.fn();
      
      await middlewareCallback(mockSocket, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Erro interno na autenticação'));
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }));
    });
    
    it('Deve permitir conexão sem channelSlug (bypass for pairing public)', async () => {
      mockSocket.handshake.auth.channelSlug = undefined;
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      expect(next).toHaveBeenCalledWith();
    });
    /** 
    * Verifica se o serviço lida corretamente com tokens em formato de array 
    * e se remove o prefixo 'Bearer ' antes da validação.
    */
    it('Deve tratar token enviado como Array e remover o prefixo Bearer', async () => {
      // Configura o token no formato de array com o prefixo Bearer
      mockSocket.handshake.auth.token = ['Bearer token-limpo-123'];
      
      const mockChannel = { slug: 'sala-1', apiKey: 'secret-key' };
      (channelService.findBySlug as jest.Mock).mockResolvedValue(mockChannel);
      (verifyToken as jest.Mock).mockReturnValue({ id: 'user-1' });
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      // Verifica se o tokenString foi extraído do array e o replace foi executado
      // O verifyToken deve receber apenas 'token-limpo-123'
      expect(verifyToken).toHaveBeenCalledWith('token-limpo-123', 'secret-key');
      expect(next).toHaveBeenCalledWith();
    });
    
    /** 
    * Garante que o payload decodificado do JWT é atribuído à propriedade socket.user
    * e que a função next() é chamada para autorizar a conexão.
    */
    it('Deve anexar o payload decodificado ao objeto socket e chamar next()', async () => {
      const userPayload = { id: 'user-99', roles: ['admin'] };
      
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ apiKey: 'key' });
      (verifyToken as jest.Mock).mockReturnValue(userPayload);
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      // Verifica a atribuição à propriedade user
      expect(mockSocket.user).toEqual(userPayload);
      // Verifica se o fluxo prossegue
      expect(next).toHaveBeenCalledWith();
    });
    
    it('deve normalizar o token quando enviado como um Array (Cobertura Linha 46 ramo verdadeiro)', async () => {
      // Prepara o token como array para forçar o caminho "token[0]"
      mockSocket.handshake.auth.token = ['Bearer token-em-array'];
      
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ apiKey: 'chave-secreta' });
      (verifyToken as jest.Mock).mockReturnValue({ id: '123' });
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      // Verifica se o replace da linha 47 foi executado corretamente no primeiro item do array
      expect(verifyToken).toHaveBeenCalledWith('token-em-array', 'chave-secreta');
    });
    
    it('deve normalizar o token quando enviado como uma String (Cobertura Linha 46 ramo falso)', async () => {
      // Prepara o token como string simples
      mockSocket.handshake.auth.token = 'Bearer token-string';
      
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ apiKey: 'chave-secreta' });
      (verifyToken as jest.Mock).mockReturnValue({ id: '123' });
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      expect(verifyToken).toHaveBeenCalledWith('token-string', 'chave-secreta');
    });
  });
  
  describe('Eventos de Conexão e Salas', () => {
    beforeEach(() => {
      // Ativa a conexão para registrar os listeners de evento
      if (connectionCallback) connectionCallback(mockSocket);
    });
    
    /** Cobertura Linhas 86-87: join_channel */
    it('Deve permitir que o socket entre em uma sala de canal via evento join_channel', () => {
      const channelId = 'channel-xyz';
      socketEventHandlers['join_channel'](channelId);
      
      expect(mockSocket.join).toHaveBeenCalledWith(channelId);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Entrou na sala'), expect.any(Object));
    });
    
    /** Cobertura Linhas 90-91: waiting_pair */
    it('Deve permitir que o socket entre na sala de pareamento via evento waiting_pair', () => {
      const code = '123456';
      socketEventHandlers['waiting_pair'](code);
      
      expect(mockSocket.join).toHaveBeenCalledWith(`pairing-${code}`);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Entrou na sala de pareamento'), expect.any(Object));
    });
    
    it('Deve registrar código temporário via register_temp_code', () => {
      const data = { code: '654321' };
      socketEventHandlers['register_temp_code'](data);
      
      expect(mockPairingService.registerTempCode).toHaveBeenCalledWith('654321');
    });
  });
  
  describe('Método broadcastCall', () => {
    -
    it('Deve logar aviso e não emitir se o nome do canal for inválido ou vazio', () => {
      socketService.broadcastCall('', { data: 1 });
      socketService.broadcastCall(null as any, { data: 1 });
      
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Tentativa de broadcast para channel inválido'), expect.any(Object));
      expect(mockServer.to).not.toHaveBeenCalled();
    });
    
    it('Deve realizar broadcast corretamente para um canal válido', () => {
      const data = { id: '1' };
      socketService.broadcastCall('sala-01', data);
      
      expect(mockServer.to).toHaveBeenCalledWith('sala-01');
      expect(mockServer.emit).toHaveBeenCalledWith('call_update', data);
    });
  });
  
  describe('Cobertura de Falhas de Autenticação (Linhas 46-48 e 58-60)', () => {
    
    /**
    * Cobertura Linhas 46-48: Canal não encontrado
    * Simula o cenário onde o channelSlug é válido mas não existe no banco.
    */
    it('Deve cobrir as linhas 46-48: rejeitar conexão quando o canal não é encontrado', async () => {
      mockSocket.handshake.auth.channelSlug = 'slug-inexistente';
      mockSocket.handshake.auth.token = 'any-token';
      
      (channelService.findBySlug as jest.Mock).mockResolvedValue(null);
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      // Verificação ajustada: o logger.warn recebe apenas a string
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Socket] Conexão rejeitada: Canal não encontrado')
      );
      
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ 
        message: 'Authentication error: Channel not found' 
      }));
    });
    
    /**
    * Cobertura Linhas 58-60: Token inválido
    * Simula canal encontrado, mas a assinatura do JWT é inválida para aquele canal.
    */
    it('Deve cobrir as linhas 58-60: rejeitar conexão quando o verifyToken retorna nulo', async () => {
      const channelSlug = 'sala-teste';
      mockSocket.handshake.auth.channelSlug = channelSlug;
      mockSocket.handshake.auth.token = 'token-invalido';
      
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ 
        slug: channelSlug, 
        apiKey: 'api-key-do-canal' 
      });
      (verifyToken as jest.Mock).mockReturnValue(null);
      
      const next = jest.fn();
      await middlewareCallback(mockSocket, next);
      
      // Verificação ajustada: o logger.warn recebe apenas a string
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Conexão rejeitada: Token inválido ou expirado')
      );
      
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ 
        message: 'Authentication error: Invalid token' 
      }));
    });
  });
});