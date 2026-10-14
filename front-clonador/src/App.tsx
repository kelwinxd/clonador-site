import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import './styles/app.css';
import './styles/auth.css';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { CloneProvider } from '@/features/clone/CloneContext';
import { OverlayClonando } from '@/features/clone/components/OverlayClonando';
import { ROTAS } from '@/shared/constants';
import ClonarPage from './pages/ClonarPage';
import CriarContaPage from './pages/CriarContaPage';
import EditorPage from './pages/EditorPage';
import EntrarPage from './pages/EntrarPage';
import PreviewPage from './pages/PreviewPage';

/** Raiz: compõe os provedores (auth → clone) e monta o layout com as rotas. */
export default function App() {
  return (
    <AuthProvider>
      <CloneProvider>
        <Layout />
      </CloneProvider>
    </AuthProvider>
  );
}

function Layout() {
  const { sessao, logout } = useAuth();
  const navigate = useNavigate();
  const inicial = sessao?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="app">
      <OverlayClonando />

      <header className="topbar">
        <div className="topbar-esq">
          <span className="brand">
            <span className="logo">
              <img src="/logo.png" alt="" width="60" height="60" />
            </span>
            <span className="brand-nome">
              CLONE <span className="brand-ninja">NINJA</span>
            </span>
          </span>
          <button type="button" className="botao-novo" onClick={() => navigate(ROTAS.clonar)}>
            + Novo clone
          </button>
        </div>

        <div className="conta">
          {sessao ? (
            <>
              <span className="avatar" aria-hidden="true">
                {inicial}
              </span>
              <span className="conta-email" title={sessao.email}>
                {sessao.email}
              </span>
              <button
                type="button"
                className="botao-ghost pequeno"
                onClick={() => {
                  logout();
                  navigate(ROTAS.clonar);
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <Link to={ROTAS.entrar} className="botao-ghost pequeno">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <Routes>
        <Route path={ROTAS.clonar} element={<ClonarPage />} />
        <Route path={ROTAS.resultado} element={<PreviewPage />} />
        <Route path={ROTAS.editor} element={<EditorPage />} />
        <Route path={ROTAS.criarConta} element={<CriarContaPage />} />
        <Route path={ROTAS.entrar} element={<EntrarPage />} />
        <Route path="*" element={<Navigate to={ROTAS.clonar} replace />} />
      </Routes>
    </div>
  );
}
