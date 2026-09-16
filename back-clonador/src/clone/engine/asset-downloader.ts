import { createHash } from 'node:crypto';
import pLimit from 'p-limit';
import { LIMITS } from '../../config';
import { CloneError } from './errors';
import { httpGet } from './http-client';

export interface DownloadedAsset {
  url: string;
  /** Caminho dentro do zip, ex.: assets/9f1c2b3d4e.png */
  path: string;
  body: Buffer;
  contentType: string;
}

export interface DownloadReport {
  assets: DownloadedAsset[];
  /** URL absoluta -> caminho local, usado na reescrita do HTML. */
  map: Map<string, string>;
  failed: Array<{ url: string; reason: string }>;
  totalBytes: number;
}

export interface DownloadOptions {
  referer?: string;
  onProgress?: (done: number, total: number) => void;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'text/css': 'css',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'application/json': 'json',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-woff': 'woff',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
};

/** Nome curto e estável para o arquivo: hash da URL + extensão. */
export function localPathFor(url: string, contentType = ''): string {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 10);
  const fromType = EXTENSION_BY_TYPE[contentType.split(';')[0].trim().toLowerCase()];
  const fromUrl = (() => {
    try {
      const match = /\.([a-z0-9]{2,5})$/i.exec(new URL(url).pathname);
      return match?.[1]?.toLowerCase();
    } catch {
      return undefined;
    }
  })();
  return `assets/${hash}.${fromType ?? fromUrl ?? 'bin'}`;
}

/** Baixa os assets em paralelo. Um arquivo que falha não derruba o clone. */
export async function downloadAssets(
  urls: string[],
  options: DownloadOptions = {},
): Promise<DownloadReport> {
  const selected = urls.slice(0, LIMITS.maxAssets);
  const limit = pLimit(LIMITS.assetConcurrency);
  const assets: DownloadedAsset[] = [];
  const failed: Array<{ url: string; reason: string }> = [];
  const map = new Map<string, string>();
  let totalBytes = 0;
  let done = 0;

  await Promise.all(
    selected.map((url) =>
      limit(async () => {
        try {
          if (totalBytes >= LIMITS.maxTotalBytes) {
            throw new CloneError('TOO_LARGE', 'Limite total de download atingido');
          }
          const result = await httpGet(url, {
            timeoutMs: LIMITS.assetTimeoutMs,
            maxBytes: LIMITS.maxAssetBytes,
            accept: '*/*',
            referer: options.referer,
          });
          totalBytes += result.body.length;
          const path = localPathFor(url, result.contentType);
          assets.push({ url, path, body: result.body, contentType: result.contentType });
          map.set(url, path);
        } catch (error) {
          failed.push({
            url,
            reason: error instanceof Error ? error.message : String(error),
          });
        } finally {
          done += 1;
          options.onProgress?.(done, selected.length);
        }
      }),
    ),
  );

  return { assets, map, failed, totalBytes };
}
