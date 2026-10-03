import { useState } from 'react';
import App from './App';
import { Login } from './Login';

/**
 * Porta de entrada: mostra o login e, ao entrar, o app.
 *
 * Login TEMPORARIAMENTE DESABILITADO — a página fica livre (sem cadastro) por enquanto,
 * para validar. Para religar, troque LOGIN_HABILITADO para true.
 * (A tela de login continua pronta em Login.tsx; só não está no caminho.)
 */
const LOGIN_HABILITADO = false;

export default function Root() {
  const [logado, setLogado] = useState(false);

  if (!LOGIN_HABILITADO) return <App />;
  return logado ? <App /> : <Login onEntrar={() => setLogado(true)} />;
}
