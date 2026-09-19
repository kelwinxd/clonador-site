import { createReadStream, promises as fs } from 'node:fs';
import { createServer, Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

/**
 * Servidor estático das páginas de teste.
 * Serve para desenvolver sem depender de site na internet e para os testes automatizados.
 *
 * Uso manual: npm run fixtures  (http://localhost:4173/ssr.html)
 */

const ROOT = resolve(__dirname, 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

export function createFixtureServer(): Server {
  return createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://fixture.local');

    // Deixa o JavaScript das páginas de teste ler respostas de outra origem. Sem isso o
    // teste de vazamento passaria por causa do CORS, e não por causa da trava.
    res.setHeader('access-control-allow-origin', '*');

    // /redireciona?para=URL — simula um site que manda o visitante para outro endereço.
    if (requestUrl.pathname === '/redireciona') {
      res.writeHead(302, { location: requestUrl.searchParams.get('para') ?? '/' }).end();
      return;
    }

    // /anti-robo.html — só entrega para quem parece navegador (manda sec-fetch-mode).
    // Cliente HTTP simples recebe 403, como acontece em sites com proteção contra robôs.
    if (requestUrl.pathname === '/anti-robo.html' && !req.headers['sec-fetch-mode']) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('acesso negado');
      return;
    }

    const path = normalize(decodeURIComponent(requestUrl.pathname));
    // Bloqueia ../ para não servir arquivo fora da pasta public.
    const file = join(ROOT, path.replace(/^(\.\.[/\\])+/, ''));

    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    try {
      const stat = await fs.stat(file);
      const target = stat.isDirectory() ? join(file, 'ssr.html') : file;
      res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('não encontrado');
    }
  });
}

/** Sobe o servidor numa porta livre e devolve a URL base (usado nos testes). */
export async function startFixtureServer(port = 0): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createFixtureServer();
  await new Promise<void>((done) => server.listen(port, '127.0.0.1', done));
  const address = server.address();
  const realPort = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${realPort}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

if (require.main === module) {
  const port = Number(process.env.FIXTURE_PORT ?? 4173);
  createFixtureServer().listen(port, () => {
    console.log(`fixtures em http://localhost:${port}/ssr.html`);
  });
}
