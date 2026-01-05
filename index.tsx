// IMPORT WAJIB: Penyeimbang WebRTC untuk semua browser (Safari/Android lama)
import 'webrtc-adapter'; 

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { VaultProvider } from './contexts/VaultContext';
import { FeatureProvider } from './contexts/FeatureContext';

// Mencegah error jika root tidak ditemukan (Safety check)
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("FATAL: Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// StrictMode diaktifkan untuk best practice
root.render(
  <React.StrictMode>
    <FeatureProvider>
      <VaultProvider>
          <App />
      </VaultProvider>
    </FeatureProvider>
  </React.StrictMode>
);