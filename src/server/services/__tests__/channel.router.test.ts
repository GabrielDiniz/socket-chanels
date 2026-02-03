import { channelRouter } from '../channel.router';
import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';

// Mock do Prisma para isolar o banco de dados
jest.mock('../../config/prisma', () => ({
  __esModule: true,
  prisma: {
    channel: {
      findMany: jest.fn(),
    },
  },
}));

describe('ChannelRouterService', () => {
  // Dados de exemplo para simular o retorno do banco
  const mockChannels = [
    {
      id: 'c1',
      slug: 'recepcao-geral',
      name: 'Recepção',
      routingKeyMap: {
        'NovoSGA': '5',       // Match simples string
        'Versa': 100          // Match número
      },
      tenantId: 'tenant-1'
    },
    {
      id: 'c2',
      slug: 'coleta-laboratorio',
      name: 'Coleta',
      routingKeyMap: {
        'LabSys': ['COL', 'TRI'], // Match array
        'NovoSGA': '6'
      },
      tenantId: 'tenant-1'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('route()', () => {
    
    it('deve retornar null imediatamente se routingKey não for fornecida', async () => {
      const result = await channelRouter.route('tenant-1', 'NovoSGA', undefined);
      
      expect(result).toBeNull();
      expect(prisma.channel.findMany).not.toHaveBeenCalled();
    });

    it('deve retornar null se routingKey for string vazia', async () => {
      const result = await channelRouter.route('tenant-1', 'NovoSGA', '');
      
      expect(result).toBeNull();
      expect(prisma.channel.findMany).not.toHaveBeenCalled();
    });

    it('deve encontrar canal com correspondência exata (String)', async () => {
      (prisma.channel.findMany as jest.Mock).mockResolvedValue(mockChannels);

      // routingKey "5" deve bater com "5" do canal c1
      const result = await channelRouter.route('tenant-1', 'NovoSGA', '5');

      expect(prisma.channel.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          routingKeyMap: { not: Prisma.DbNull }
        }
      });
      expect(result).toEqual(mockChannels[0]);
    });

    it('deve encontrar canal com correspondência exata (Number vs String)', async () => {
      (prisma.channel.findMany as jest.Mock).mockResolvedValue(mockChannels);

      // routingKey "100" (string) deve bater com 100 (number) do canal c1
      // A lógica do router deve converter para string antes de comparar
      const result = await channelRouter.route('tenant-1', 'Versa', '100');

      expect(result).toEqual(mockChannels[0]);
    });

    it('deve encontrar canal quando a regra é um Array (Lista de valores)', async () => {
      (prisma.channel.findMany as jest.Mock).mockResolvedValue(mockChannels);

      // "TRI" está dentro de ['COL', 'TRI'] no canal c2
      const result = await channelRouter.route('tenant-1', 'LabSys', 'TRI');

      expect(result).toEqual(mockChannels[1]);
    });

    it('deve retornar null se o sistema de origem (sourceSystem) não existir no mapa', async () => {
      (prisma.channel.findMany as jest.Mock).mockResolvedValue(mockChannels);

      // "SistemaDesconhecido" não existe nas chaves do JSON
      const result = await channelRouter.route('tenant-1', 'SistemaDesconhecido', '5');

      expect(result).toBeNull();
    });

    it('deve retornar null se a chave não corresponder a nenhuma regra', async () => {
      (prisma.channel.findMany as jest.Mock).mockResolvedValue(mockChannels);

      // "999" não existe em nenhum canal para NovoSGA
      const result = await channelRouter.route('tenant-1', 'NovoSGA', '999');

      expect(result).toBeNull();
    });

    it('deve ignorar canais sem routingKeyMap (null)', async () => {
      // Mock retorna um canal configurado e um sem configuração (dirty data)
      const mixedChannels = [
        ...mockChannels,
        { id: 'c3', slug: 'sem-config', routingKeyMap: null, tenantId: 'tenant-1' }
      ];
      
      (prisma.channel.findMany as jest.Mock).mockResolvedValue(mixedChannels);

      const result = await channelRouter.route('tenant-1', 'NovoSGA', '5');

      // Deve ignorar c3 e achar c1
      expect(result).toEqual(mockChannels[0]);
    });

    it('deve ignorar canal se routingKeyMap existe mas não tem a chave do sistema (sourceSystem)', async () => {
        // Simula um canal que tem mapa JSON, mas NÃO tem a chave 'NovoSGA' nele
        const partialConfigChannel = [
          {
            id: 'c4',
            slug: 'apenas-versa',
            name: 'Apenas Versa',
            routingKeyMap: { 'Versa': '200' }, // Não tem 'NovoSGA'
            tenantId: 'tenant-1'
          }
        ];
        
        (prisma.channel.findMany as jest.Mock).mockResolvedValue(partialConfigChannel);
  
        // Buscamos por 'NovoSGA'. O canal c4 tem mapa, mas map['NovoSGA'] será undefined.
        // Isso deve cair no `if (!ruleValue) return false;`
        const result = await channelRouter.route('tenant-1', 'NovoSGA', '5');
  
        expect(result).toBeNull();
    });

    it('deve retornar null se o tenant não tiver canais configurados', async () => {
      (prisma.channel.findMany as jest.Mock).mockResolvedValue([]);

      const result = await channelRouter.route('tenant-2', 'NovoSGA', '5');

      expect(result).toBeNull();
    });
  });
});