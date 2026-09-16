import archiver from 'archiver';

export interface ZipEntry {
  path: string;
  content: Buffer | string;
}

/** Junta HTML e assets num zip pronto para hospedar. */
export async function buildZip(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('warning', (error) => reject(error));
    archive.on('error', (error) => reject(error));
    archive.on('end', () => resolve(Buffer.concat(chunks)));

    for (const entry of entries) {
      archive.append(entry.content, { name: entry.path });
    }

    void archive.finalize();
  });
}
