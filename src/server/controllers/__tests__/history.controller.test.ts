import { Request, Response } from 'express';
import { getChannelHistory } from '../history.controller';
import { channelService } from '../../services/channel.service';

// Mock do channelService
jest.mock('../../services/channel.service', () => ({
  channelService: {
    getHistory: jest.fn(),
  },
}));

// Helper para mockar Response
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  return res;
};

describe('History Controller', () => {
  let req: Partial<Request>;
  let res: Response;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { slug: 'test-channel' },
    };
    res = mockResponse();
  });

  it('Deve retornar 200 e o histórico quando o canal existe', async () => {
    const mockHistory = [
      {
        id: '1',
        name: 'Paciente 1',
        destination: 'Sala 1',
        timestamp: new Date(),
        isPriority: false,
        rawSource: 'Versa',
      },
    ];

    (channelService.getHistory as jest.Mock).mockResolvedValue(mockHistory);

    await getChannelHistory(req as Request, res);

    expect(channelService.getHistory).toHaveBeenCalledWith('test-channel');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      channel: 'test-channel',
      history: mockHistory,
    });
  });

  it('Deve retornar 404 quando o canal não é encontrado (serviço retorna null)', async () => {
    (channelService.getHistory as jest.Mock).mockResolvedValue(null);

    await getChannelHistory(req as Request, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Canal não encontrado',
    }));
  });

  it('Deve retornar 500 quando ocorre um erro no serviço', async () => {
    (channelService.getHistory as jest.Mock).mockRejectedValue(new Error('DB Error'));

    await getChannelHistory(req as Request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Erro interno ao buscar histórico',
    }));
  });
});