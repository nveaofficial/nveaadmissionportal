import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerSW} from 'virtual:pwa-register';

// Register PWA service worker with auto-update and offline readiness
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('NVEA Admission Portal update available');
  },
  onOfflineReady() {
    console.log('NVEA Admission Portal is ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
