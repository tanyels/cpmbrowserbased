import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Buffer } from 'buffer';
import App from './App';
import { KPIProvider } from './contexts/KPIContext';
import './styles.css';

// Polyfill Buffer for browser (needed by exceljs)
window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <KPIProvider>
        <App />
      </KPIProvider>
    </HashRouter>
  </React.StrictMode>
);
