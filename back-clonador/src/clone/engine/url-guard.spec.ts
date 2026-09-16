import { CloneError } from './errors';
import { assertPublicHost, isPrivateIp, parseTargetUrl } from './url-guard';

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '169.254.169.254', // metadados de nuvem
    '0.0.0.0',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
    'fe80::1',
  ])('bloqueia %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '192.167.255.255', '2606:4700::1111'])(
    'libera %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );
});

describe('parseTargetUrl', () => {
  it('aceita http e https', () => {
    expect(parseTargetUrl('https://exemplo.com/a').hostname).toBe('exemplo.com');
  });

  it.each(['file:///etc/passwd', 'ftp://exemplo.com', 'javascript:alert(1)', 'nao-e-url'])(
    'recusa %s',
    (raw) => {
      expect(() => parseTargetUrl(raw)).toThrow(CloneError);
    },
  );
});

describe('assertPublicHost', () => {
  const original = process.env.ALLOW_PRIVATE_HOSTS;
  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_HOSTS;
  });
  afterAll(() => {
    process.env.ALLOW_PRIVATE_HOSTS = original;
  });

  it('bloqueia IP interno direto', async () => {
    await expect(assertPublicHost(new URL('http://169.254.169.254/latest/meta-data'))).rejects.toThrow(
      /rede interna/,
    );
  });

  it('libera IP interno quando ALLOW_PRIVATE_HOSTS=true (fixtures)', async () => {
    process.env.ALLOW_PRIVATE_HOSTS = 'true';
    await expect(assertPublicHost(new URL('http://127.0.0.1:4173/ssr.html'))).resolves.toBeUndefined();
  });
});
