import { BrowserRouter, Route, Routes } from 'react-router';
import { AccountPage } from '../features/account/AccountPage';
import { ACCOUNT_PATH } from '../features/account/paths';
import { CameraPage } from '../features/camera/CameraPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { ChatPage } from '../features/chat/ChatPage';
import { FavoritesPage } from '../features/favorites/FavoritesPage';
import { ResultPage } from '../features/classify/ResultPage';
import { HistoryDetailPage } from '../features/history/HistoryDetailPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { HomePage } from '../features/home/HomePage';
import { IdeasPage } from '../features/upcycle/IdeasPage';
import { ConsentGate } from '../features/privacy/ConsentGate';
import { ConsentPage } from '../features/privacy/ConsentPage';
import { CONSENT_PATH, PRIVACY_PATH } from '../features/privacy/paths';
import { PrivacyPage } from '../features/privacy/PrivacyPage';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

export function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      {/* HU-21: con sesión, pide la autorización vigente antes de seguir. */}
      <ConsentGate>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/camara" element={<CameraPage />} />
          <Route path="/resultado" element={<ResultPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/restablecer" element={<ResetPasswordPage />} />
          <Route path={PRIVACY_PATH} element={<PrivacyPage />} />
          <Route path={CONSENT_PATH} element={<ConsentPage />} />
          <Route
            path="/historial"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/historial/:id"
            element={
              <RequireAuth>
                <HistoryDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path={ACCOUNT_PATH}
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route
            path="/favoritos"
            element={
              <RequireAuth>
                <FavoritesPage />
              </RequireAuth>
            }
          />
        </Routes>
      </ConsentGate>
      <UpdatePrompt />
    </BrowserRouter>
  );
}
