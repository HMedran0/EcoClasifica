import { BrowserRouter, Route, Routes } from 'react-router';
import { ResultPage } from '../features/classify/ResultPage';
import { HomePage } from '../features/home/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultado" element={<ResultPage />} />
      </Routes>
    </BrowserRouter>
  );
}
