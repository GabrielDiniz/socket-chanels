import { verifyToken, generateToken } from '../jwt.utils';

describe('jwt.utils', () => {
  const secret = 'test-secret';

  /**
   * Cobertura Linhas 17-18: Erro de formatação
   * Testa o retorno null quando o token não possui a estrutura de um JWT.
   */
  it('deve retornar null quando o token for uma string malformada (Cobertura Linha 17-18)', () => {
    const result = verifyToken('invalid.token.format', secret);
    expect(result).toBeNull();
  });

  /**
   * Cobertura Linhas 17-18: Erro de assinatura
   * Testa o retorno null quando a assinatura não confere com o segredo fornecido.
   */
  it('deve retornar null quando o segredo for inválido (Cobertura Linha 17-18)', () => {
    const token = generateToken({ id: 1 }, 'secret-A');
    const result = verifyToken(token, 'secret-B');
    expect(result).toBeNull();
  });

  /**
   * Cobertura Linhas 17-18: Erro de expiração
   * Testa o retorno null quando o payload contém uma claim de expiração já ultrapassada.
   */
  it('deve retornar null quando o token estiver expirado (Cobertura Linha 17-18)', () => {
    // expiresIn com valor negativo garante expiração imediata
    const token = generateToken({ id: 1 }, secret, -10); 
    const result = verifyToken(token, secret);
    expect(result).toBeNull();
  });
});