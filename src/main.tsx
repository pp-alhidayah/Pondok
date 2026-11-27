import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { API_MODE } from './lib/apiClient';
import { installApiBridge } from './lib/apiBridge';
import { siapkanStorage } from './lib/storageMode';
import './index.css';

const render = () => {
  createRoot(document.getElementById('root')!).render(<App />);
};

siapkanStorage(API_MODE);

// Pasang jembatan API sebelum render bila VITE_API_MODE=api.
void installApiBridge()
  .catch((error) => console.error('Gagal menyiapkan mode API:', error))
  .finally(render);

// PWA: daftarkan service worker hanya di produksi.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
