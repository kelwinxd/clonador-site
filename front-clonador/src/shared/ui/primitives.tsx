/** Pequenos componentes visuais reutilizáveis, sem lógica de negócio. */

export function SecaoTitulo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="secao-titulo">
      <span className="badge">{numero}</span>
      <span>{titulo}</span>
    </div>
  );
}

export function PlaceholderPreview({ clonando }: { clonando: boolean }) {
  return (
    <div className="placeholder">
      <div className="sk sk-l" />
      <div className="sk sk-m" />
      <div className="sk sk-s" />
      <div className="sk-img">{clonando ? 'gerando prévia…' : 'conteúdo original da página'}</div>
      <div className="sk-botao" />
    </div>
  );
}
