import { CloneForm } from '@/features/clone/components/CloneForm';

/** Página 1: formulário à esquerda, imagem do ninja à direita. */
export default function ClonarPage() {
  return (
    <>
      <p className="tagline">
        Clone uma página autorizada e baixe um <strong>.zip</strong> pronto para hospedar, com o seu
        link no lugar.
      </p>
      <div className="clonar-grid">
        <CloneForm />
        <div className="clonar-hero"  aria-hidden="true">
          <img src="/ninja-bg.png" alt="" />
        </div>
      </div>
    </>
  );
}
