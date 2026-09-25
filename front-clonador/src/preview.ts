import JSZip from 'jszip';

const MIME_POR_EXTENSAO: Record<string, string> = {
  css: 'text/css',
  js: 'text/javascript',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  mp4: 'video/mp4',
};

export interface Preview {
  html: string;
  /** Libera os endereços temporários criados para os arquivos. */
  descartar: () => void;
}

/**
 * Monta a prévia sem passar pelo servidor: abre o zip aqui mesmo, transforma cada
 * arquivo num endereço temporário do navegador e troca os caminhos dentro do index.html.
 *
 * Funciona porque o motor sempre grava os assets como assets/<hash>.<extensão>.
 * Quando existir armazenamento no servidor (Etapa 10), dá para trocar por uma URL de verdade.
 */
export async function montarPreview(zipBlob: Blob): Promise<Preview> {
  const zip = await JSZip.loadAsync(zipBlob);
  const enderecos: string[] = [];
  const mapa = new Map<string, string>();

  const arquivos = Object.keys(zip.files).filter((nome) => nome.startsWith('assets/'));

  for (const nome of arquivos) {
    const conteudo = await zip.files[nome].async('blob');
    const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
    const tipado = new Blob([conteudo], { type: MIME_POR_EXTENSAO[extensao] ?? 'application/octet-stream' });
    const endereco = URL.createObjectURL(tipado);
    enderecos.push(endereco);
    mapa.set(nome, endereco);
  }

  let html = (await zip.file('index.html')?.async('string')) ?? '<p>zip sem index.html</p>';
  for (const [nome, endereco] of mapa) {
    html = html.split(nome).join(endereco);
  }

  return {
    html,
    descartar: () => enderecos.forEach((endereco) => URL.revokeObjectURL(endereco)),
  };
}

const URL_CSS = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

/**
 * Monta um HTML autossuficiente: todos os arquivos embutidos como data: URIs, os .css
 * viram <style> inline (com os url() de dentro já resolvidos), e as imagens/fontes viram
 * data:. Serve para abrir o clone numa aba nova — como um site de verdade — sem depender
 * dos endereços temporários da página que o gerou (que uma aba de origem opaca não acessa).
 */
export async function montarHtmlAutonomo(zipBlob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(zipBlob);
  const arquivos = Object.keys(zip.files).filter((nome) => nome.startsWith('assets/'));

  // assets/<hash>.<ext> -> data: ; e por nome de arquivo (para os url() dentro do css).
  const porCaminho = new Map<string, string>();
  const porNome = new Map<string, string>();
  for (const nome of arquivos) {
    if (nome.endsWith('.css')) continue; // css é embutido como texto, não como data:
    const base64 = await zip.files[nome].async('base64');
    const ext = nome.split('.').pop()?.toLowerCase() ?? '';
    const dataUri = `data:${MIME_POR_EXTENSAO[ext] ?? 'application/octet-stream'};base64,${base64}`;
    porCaminho.set(nome, dataUri);
    porNome.set(basename(nome), dataUri);
  }

  const resolveUrlCss = (css: string) =>
    css.replace(URL_CSS, (todo, aspas: string, cru: string) => {
      const uri = porCaminho.get(cru) ?? porNome.get(basename(cru));
      return uri ? `url(${aspas}${uri}${aspas})` : todo;
    });

  // Conteúdo de cada .css, com os url() internos já apontando para data:.
  const cssPorCaminho = new Map<string, string>();
  for (const nome of arquivos.filter((n) => n.endsWith('.css'))) {
    cssPorCaminho.set(nome, resolveUrlCss(await zip.files[nome].async('string')));
  }

  const htmlBruto = (await zip.file('index.html')?.async('string')) ?? '<p>zip sem index.html</p>';
  const doc = new DOMParser().parseFromString(htmlBruto, 'text/html');

  // <link rel=stylesheet href=assets/x.css> -> <style>…</style>
  doc.querySelectorAll('link[rel~="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href') ?? '';
    const css = cssPorCaminho.get(href);
    if (css != null) {
      const style = doc.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
    }
  });

  // src/href simples -> data:
  doc.querySelectorAll('[src], [href]').forEach((el) => {
    for (const attr of ['src', 'href']) {
      const valor = el.getAttribute(attr);
      if (valor && porCaminho.has(valor)) el.setAttribute(attr, porCaminho.get(valor)!);
    }
  });

  // srcset -> data:
  doc.querySelectorAll('[srcset]').forEach((el) => {
    const novo = (el.getAttribute('srcset') ?? '')
      .split(',')
      .map((parte) => {
        const [u, ...desc] = parte.trim().split(/\s+/);
        const uri = porCaminho.get(u);
        return (uri ?? u) + (desc.length ? ` ${desc.join(' ')}` : '');
      })
      .join(', ');
    el.setAttribute('srcset', novo);
  });

  // style="" inline e <style> no head -> resolve url()
  doc.querySelectorAll('[style]').forEach((el) => {
    el.setAttribute('style', resolveUrlCss(el.getAttribute('style') ?? ''));
  });
  doc.querySelectorAll('style').forEach((s) => {
    if (s.textContent) s.textContent = resolveUrlCss(s.textContent);
  });

  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function basename(caminho: string): string {
  return caminho.split('/').pop() ?? caminho;
}
