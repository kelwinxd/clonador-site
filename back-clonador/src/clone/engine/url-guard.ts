import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { CloneError } from './errors';

/**
 * Trava de segurança do motor.
 *
 * O servidor busca qualquer URL que o usuário mandar, então sem isso alguém pede
 * http://169.254.169.254/ (metadados da nuvem) ou http://localhost:6379 e usa a API
 * como ponte para a rede interna. Isso é SSRF.
 *
 * Em desenvolvimento, ALLOW_PRIVATE_HOSTS=true libera localhost para os testes com fixtures.
 */

const PRIVATE_V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // metadados de nuvem (AWS/GCP/Azure)
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reservado
];

function v4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const value = v4ToInt(ip);
    return PRIVATE_V4_RANGES.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (v4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const addr = ip.toLowerCase().split('%')[0];
    if (addr === '::1' || addr === '::') return true;
    // IPv4 embutido em IPv6: ::ffff:127.0.0.1
    const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (/^f[cd]/.test(addr)) return true; // fc00::/7 — rede local
    if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 — link-local
    return false;
  }
  return false;
}

/** Aceita só http/https e devolve a URL já normalizada. */
export function parseTargetUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CloneError('INVALID_URL', `URL inválida: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CloneError('INVALID_URL', `Protocolo não permitido: ${url.protocol}`);
  }
  return url;
}

function allowsPrivateHosts(): boolean {
  return process.env.ALLOW_PRIVATE_HOSTS === 'true';
}

/**
 * Resolve o DNS do host e recusa se apontar para a rede interna.
 * Precisa rodar em cada redirecionamento, não só na URL inicial.
 */
export async function assertPublicHost(url: URL): Promise<void> {
  if (allowsPrivateHosts()) return;

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new CloneError('BLOCKED_HOST', `Endereço de rede interna bloqueado: ${host}`);
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new CloneError('INVALID_URL', `Domínio não encontrado: ${host}`);
  }

  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new CloneError('BLOCKED_HOST', `O domínio ${host} aponta para a rede interna`);
  }
}
