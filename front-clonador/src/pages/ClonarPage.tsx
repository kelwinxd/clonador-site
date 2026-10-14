import { CloneForm } from '@/features/clone/components/CloneForm';

/** Página 1: o formulário de clonagem (só endereço + aceite). */
export default function ClonarPage() {
  return (
    <>
      <p className="tagline">
        Clone uma página autorizada e baixe um <strong>.zip</strong> pronto para hospedar, com o seu
        link no lugar.
      </p>
      <CloneForm />
    </>
  );
}
