/**
 * Modal com os Termos de Uso e a Política de Privacidade (LGPD). Texto PLACEHOLDER, verossímil —
 * deve ser revisado por um advogado antes de valer de verdade. Serve para o fluxo de aceite.
 */
export function TermosModal({ onFechar }: { onFechar: () => void }) {
  return (
    <div className="login-overlay" role="dialog" aria-modal="true" aria-label="Termos" onClick={onFechar}>
      <div className="auth-card termos-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-fechar" aria-label="Fechar" onClick={onFechar}>
          ×
        </button>

        <h2 className="termos-titulo">Termos de Uso e Política de Privacidade</h2>
        <p className="termos-data">Última atualização: 17 de outubro de 2026 · Versão 1.0</p>

        <div className="termos-corpo">
          <p>
            Bem-vindo ao <strong>Clone Ninja</strong>. Ao criar uma conta e utilizar a plataforma,
            você declara ter lido, compreendido e aceitado integralmente estes Termos de Uso e a
            Política de Privacidade abaixo.
          </p>

          <h4>1. Objeto</h4>
          <p>
            O Clone Ninja é uma ferramenta que permite clonar páginas da web para as quais o usuário
            possui autorização, substituir links e identificadores, e gerar um arquivo hospedável. O
            uso é pessoal e intransferível.
          </p>

          <h4>2. Responsabilidade do usuário</h4>
          <p>
            Você é o único responsável pelo conteúdo clonado. É proibido clonar páginas de terceiros
            sem autorização, reproduzir marcas, violar direitos autorais, praticar phishing ou
            qualquer atividade ilícita. O descumprimento pode levar à suspensão imediata da conta.
          </p>

          <h4>3. Dados coletados</h4>
          <p>
            Coletamos: (i) dados de cadastro (e-mail e senha criptografada); (ii) dados de uso
            (endereços clonados, data/hora, quantidade de clones no ciclo); (iii) dados técnicos
            (endereço IP e identificador anti-robô), estritamente para segurança e prevenção a
            abusos.
          </p>

          <h4>4. Finalidade e base legal (LGPD)</h4>
          <p>
            Tratamos seus dados para executar o serviço contratado (art. 7º, V da Lei nº
            13.709/2018), cumprir obrigações legais e, mediante legítimo interesse, prevenir fraudes
            e abusos. Não vendemos seus dados.
          </p>

          <h4>5. Compartilhamento</h4>
          <p>
            Compartilhamos dados apenas com operadores necessários à prestação do serviço
            (hospedagem, processamento de pagamento e verificação anti-robô), que se obrigam a tratá-los
            conforme a LGPD.
          </p>

          <h4>6. Direitos do titular</h4>
          <p>
            Você pode, a qualquer momento, solicitar confirmação de tratamento, acesso, correção,
            anonimização, portabilidade ou eliminação dos seus dados, bem como revogar o
            consentimento, entrando em contato pelo canal indicado na seção 9.
          </p>

          <h4>7. Segurança e retenção</h4>
          <p>
            Adotamos medidas técnicas e administrativas para proteger seus dados. As senhas são
            armazenadas com hash. Mantemos os dados pelo tempo necessário ao serviço e às obrigações
            legais; após isso, são eliminados ou anonimizados.
          </p>

          <h4>8. Cookies</h4>
          <p>
            Utilizamos apenas cookies e armazenamento local essenciais ao funcionamento (como manter
            você conectado). Não usamos cookies de rastreamento publicitário.
          </p>

          <h4>9. Contato (Encarregado / DPO)</h4>
          <p>
            Dúvidas ou solicitações sobre dados pessoais podem ser enviadas para{' '}
            <strong>privacidade@clone-ninja.exemplo</strong>.
          </p>

          <h4>10. Alterações</h4>
          <p>
            Estes termos podem ser atualizados. Avisaremos sobre mudanças relevantes, e o uso
            continuado após a atualização implica concordância com a nova versão.
          </p>

          <p>
            <em>
              Documento de exemplo para fins de demonstração — deve ser revisado por profissional
              jurídico antes de produção.
            </em>
          </p>
        </div>
      </div>
    </div>
  );
}
