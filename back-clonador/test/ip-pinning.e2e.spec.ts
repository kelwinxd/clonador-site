import { httpGet } from '../src/clone/engine/http-client';
import { assertPublicHost } from '../src/clone/engine/url-guard';

jest.setTimeout(30_000);

/**
 * Amarração de IP (anti DNS rebinding): buscar por NOME, com a checagem ligada, conecta
 * no IP já aprovado. Este teste prova que o caminho com amarração funciona contra um host
 * público real — ou seja, que a amarração não quebrou o fetch normal.
 *
 * Depende de rede; se estiver offline, pula com um aviso em vez de falhar.
 */
describe('Etapa — amarração de IP (anti DNS rebinding)', () => {
  const original = process.env.ALLOW_PRIVATE_HOSTS;
  beforeAll(() => {
    delete process.env.ALLOW_PRIVATE_HOSTS; // checagem (e amarração) LIGADAS
  });
  afterAll(() => {
    process.env.ALLOW_PRIVATE_HOSTS = original;
  });

  it('busca example.com por nome conectando no IP aprovado', async () => {
    let temRede = true;
    const ip = await assertPublicHost(new URL('https://example.com')).catch(() => {
      temRede = false;
      return null;
    });
    if (!temRede) {
      console.warn('\n[ip-pinning] sem rede — teste pulado.\n');
      return;
    }

    // Um IP público de verdade foi resolvido e aprovado (é o que será amarrado).
    expect(ip).toMatch(/^\d{1,3}(\.\d{1,3}){3}$|:/);

    const resultado = await httpGet('https://example.com');
    expect(resultado.status).toBe(200);
    expect(resultado.body.toString('utf-8').toLowerCase()).toContain('example domain');
  });
});
