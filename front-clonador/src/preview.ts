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
