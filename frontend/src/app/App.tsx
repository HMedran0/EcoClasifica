import { BrowserRouter, Route, Routes } from 'react-router';
import { CameraPage } from '../features/camera/CameraPage';
import { ChatPage } from '../features/chat/ChatPage';
import { ResultPage } from '../features/classify/ResultPage';
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
      </Routes>
      <UpdatePrompt />
    </BrowserRouter>
  );
}
