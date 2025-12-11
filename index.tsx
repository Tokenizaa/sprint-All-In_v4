import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSupabase } from './services/storageService';
import './src/styles.css'; // Importando o CSS do Tailwind
import './src/custom.css'; // Importando CSS customizado

initSupabase();
// initSupabaseAdmin must be called from a secure server-side process, not from browser/client code.
// Server-side jobs (cron/worker) should initialize the admin client and run the sync using environment variables without the VITE_ prefix.


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);