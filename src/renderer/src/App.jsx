import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StrategyProvider, useStrategy } from './contexts/StrategyContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { CloudProvider } from './contexts/CloudContext';
import FileSelection from './components/FileSelection';
import MainLayout from './components/MainLayout';

function AppContent() {
  const { filePath } = useStrategy();

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<FileSelection />} />
        <Route
          path="/main/*"
          element={filePath ? <MainLayout /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <footer className="app-footer">
        Built by Transdata Bilgi Islem LTD STI
      </footer>
    </div>
  );
}

function App() {
  return (
    <LicenseProvider>
      <CloudProvider>
        <StrategyProvider>
          <AppContent />
        </StrategyProvider>
      </CloudProvider>
    </LicenseProvider>
  );
}

export default App;
