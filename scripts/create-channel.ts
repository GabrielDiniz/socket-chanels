// scripts/create-channel.ts
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(^|\s)\w/g, (l) => l.toUpperCase());
}

async function main() {
  const slug = process.argv[2];
  const nameArg = process.argv[3];

  if (!slug) {
    console.error('Uso: npx ts-node scripts/create-channel.ts <slug> [nome]');
    console.error('Exemplo: recepcao_01 "Recepção Principal"');
    process.exit(1);
  }

  const name = nameArg || toTitleCase(slug.replace(/_/g, ' '));

  try {
    const channel = await prisma.channel.create({
      data: {
        slug,
        name,
        apiKey: randomUUID(),
        tenant: 'hospital-teste',
      },
    });

    console.log('\nCANAL CRIADO COM SUCESSO!');
    console.log('════════════════════════════════');
    console.log(`Slug       → ${channel.slug}`);
    console.log(`Nome       → ${channel.name}`);
    console.log(`API Key    → ${channel.apiKey}`);
    console.log('\nTESTE COM CURL:');
    console.log(`curl -X POST http://localhost:3000/api/v1/chamada \\`);
    console.log(`  -H "x-auth-token: ${channel.apiKey}" \\`);
    console.log(`  -H "x-channel-id: ${channel.slug}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"senha":{"format":"P001"},"local":{"nome":"Triagem"},"numeroLocal":1}'`);
    console.log('════════════════════════════════\n');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.error('Erro: Já existe um canal com esse slug ou apiKey.');
    } else {
      console.error('Erro:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();