import { Request, Response } from 'express';
import { channelSchema } from '../schemas/channel.schema';
import { prisma } from '../config/prisma';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger'; // Importa logger

const REGISTRATION_KEY = process.env.CHANNEL_REGISTRATION_KEY; // chave mestra secreta

export const channelController = async (req: Request, res: Response) => {
  try {
    const body = channelSchema.parse(req.body);

    // 1. Validação da chave mestra
    if (body.registration_key !== REGISTRATION_KEY) {
      logger.warn('[Register] Chave de registro inválida', { 
        slug: body.slug, 
        receivedKey: '***REDACTED***' // Boa prática: não logar senhas/chaves inválidas
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Chave de registro inválida',
      });
    }

    // 2. Verifica se slug já existe
    const existing = await prisma.channel.findUnique({
      where: { slug: body.slug },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Já existe um canal com esse slug',
        channel: {
          slug: existing.slug,
          name: existing.name,
          apiKey: existing.apiKey,
        },
      });
    }

    // 3. Cria o canal
    const channel = await prisma.channel.create({
      data: {
        slug: body.slug,
        name: body.name,
        apiKey: randomUUID(),
        tenant: body.tenant || body.system,
        system: body.system,
        isActive: true,
      },
    });

    logger.info(`[Register] Novo canal registrado`, { 
      slug: channel.slug, 
      name: channel.name, 
      id: channel.id 
    });

    // 4. Resposta com credenciais
    return res.status(201).json({
      success: true,
      message: 'Canal registrado com sucesso!',
      channel: {
        slug: channel.slug,
        name: channel.name,
        apiKey: channel.apiKey,
        instructions: {
          endpoint: 'POST http://seu-dominio.com/api/v1/chamada',
          headers: {
            'x-auth-token': channel.apiKey,
            'x-channel-id': channel.slug,
          },
        },
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Bad Request',
        issues: error.errors,
      });
    }

    logger.error('[Register Error]', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};