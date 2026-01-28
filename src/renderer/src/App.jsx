import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StrategyProvider, useStrategy } from './contexts/StrategyContext';
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
    </div>
  );
}

function App() {
  return (
    <StrategyProvider>
      <AppContent />
    </StrategyProvider>
  );
}

export default App;
