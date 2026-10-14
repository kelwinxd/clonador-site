import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import './App.css';
import { AppProvider, useApp } from './state';
import ClonarPage from './pages/ClonarPage';
import PreviewPage from './pages/PreviewPage';
import CriarContaPage from './pages/CriarContaPage';
import EntrarPage from './pages/EntrarPage';

/** Raiz do app: provê o estado compartilhado e monta o layout com as rotas. */
export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}

function Layout() {
  const app = useApp();
  const navigate = useNavigate();
  const logado = !!app.sessao;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Início">
          <span className="logo">
            <img src="/logo.png" alt="" width="60" height="60" />
          </span>
          <span className="brand-nome">
            CLONE <span className="brand-ninja">NINJA</span>
          </span>
        </Link>
        <div className="conta">
          {logado ? (
            <>
              <span className="conta-email" title={app.sessao!.email}>
                {app.sessao!.email}
              </span>
              <button
                type="button"
                className="botao-ghost pequeno"
                onClick={() => {
                  app.logout();
                  navigate('/');
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" className="botao-ghost pequeno">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <Routes>
        <Route path="/" element={<ClonarPage />} />
        <Route path="/resultado" element={<PreviewPage />} />
        <Route path="/criar-conta" element={<CriarContaPage />} />
        <Route path="/entrar" element={<EntrarPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
