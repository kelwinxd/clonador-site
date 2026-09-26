import { useState } from 'react';
import App from './App';
import { Login } from './Login';

/**
 * Porta de entrada: mostra o login e, ao entrar, o app.
 * Ainda sem autenticação de verdade — qualquer e-mail válido passa (a lógica vem depois).
 */
export default function Root() {
  const [logado, setLogado] = useState(false);
  return logado ? <App /> : <Login onEntrar={() => setLogado(true)} />;
}
