import { BrowserRouter, Route, Routes } from 'react-router';
import { CameraPage } from '../features/camera/CameraPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { ChatPage } from '../features/chat/ChatPage';
import { FavoritesPage } from '../features/favorites/FavoritesPage';
import { ResultPage } from '../features/classify/ResultPage';
import { HistoryDetailPage } from '../features/history/HistoryDetailPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { HomePage } from '../features/home/HomePage';
import { IdeasPage } from '../features/upcycle/IdeasPage';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

export function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/camara" element={<CameraPage />} />
        <Route path="/resultado" element={<ResultPage />} />
        <Route path="/ideas" element={<IdeasPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/entrar" element={<LoginPage />} />
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
          path="/favoritos"
          element={
            <RequireAuth>
              <FavoritesPage />
            </RequireAuth>
          }
        />
      </Routes>
      <UpdatePrompt />
    </BrowserRouter>
  );
}
