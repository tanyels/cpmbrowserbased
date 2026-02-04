import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StrategyProvider, useStrategy } from './contexts/StrategyContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { CloudProvider, useCloud } from './contexts/CloudContext';
import FileSelection from './components/FileSelection';
import MainLayout from './components/MainLayout';
import LicenseScreen from './components/LicenseScreen';

function AppContent() {
  const { filePath } = useStrategy();
  const { hasValidKey, loading } = useCloud();

  // Show loading spinner while checking key status
  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show license screen if no valid key
  if (!hasValidKey) {
    return <LicenseScreen />;
  }

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
