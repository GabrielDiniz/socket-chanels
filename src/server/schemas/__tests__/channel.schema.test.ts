import { channelSchema, channelDto } from '../channel.schema';

describe('Channel Schema', () => {
  it('Deve validar DTO válido (slug regex, name min/max)', () => {
    const validDto = {
      slug: 'valid-slug_01',
      name: 'Valid Channel',
      system: 'NovoSGA',
      tenant: 'Hospital A',
      registration_key: 'validkey1234567890',
    };
    expect(channelSchema.safeParse(validDto).success).toBe(true);
  });

  it('Deve rejeitar slug inválido (ex: com maiúsculas ou chars especiais)', () => {
    const invalidSlug = {
      slug: 'Invalid@Slug',
      name: 'Channel',
      system: 'Versa',
      registration_key: 'validkey1234567890',
    };
    const result = channelSchema.safeParse(invalidSlug);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('slug');
  });

  it('Deve rejeitar name vazio ou longo demais', () => {
    const emptyName = {
      slug: 'valid-slug',
      name: '',
      system: 'NovoSGA',
      registration_key: 'validkey1234567890',
    };
    let result = channelSchema.safeParse(emptyName);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('name');

    const longName = {
      slug: 'valid-slug',
      name: 'A'.repeat(101), // >100
      system: 'NovoSGA',
      registration_key: 'validkey1234567890',
    };
    result = channelSchema.safeParse(longName);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('name');
  });

  it('Deve permitir tenant opcional', () => {
    const withoutTenant = {
      slug: 'valid-slug',
      name: 'Channel',
      system: 'Versa',
      registration_key: 'validkey1234567890',
    };
    expect(channelSchema.safeParse(withoutTenant).success).toBe(true);
  });

  it('Deve validar registration_key com min 10 chars', () => {
    const shortKey = {
      slug: 'valid-slug',
      name: 'Channel',
      system: 'NovoSGA',
      registration_key: 'short', // <10
    };
    const result = channelSchema.safeParse(shortKey);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('registration_key');
  });
});