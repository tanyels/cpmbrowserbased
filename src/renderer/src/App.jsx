import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StrategyProvider, useStrategy } from './contexts/StrategyContext';
import { LicenseProvider, useLicense } from './contexts/LicenseContext';
import FileSelection from './components/FileSelection';
import MainLayout from './components/MainLayout';
import LicenseScreen from './components/LicenseScreen';

function LicenseGate({ children }) {
  const { licenseState, hasValidLicense, isInGracePeriod, isLoading } = useLicense();
  const [licensePassed, setLicensePassed] = useState(false);

  // While loading, show nothing (LicenseScreen handles its own loading state)
  if (isLoading) {
    return (
      <LicenseScreen onContinue={() => setLicensePassed(true)} />
    );
  }

  // If user has already passed the license check this session, continue
  if (licensePassed) {
    return children;
  }

  // If valid license or trial, or in grace period, allow through
  if (hasValidLicense() || isInGracePeriod()) {
    return (
      <LicenseScreen onContinue={() => setLicensePassed(true)} />
    );
  }

  // Show license screen for activation
  return (
    <LicenseScreen onContinue={() => setLicensePassed(true)} />
  );
}

function AppContent() {
  const { filePath } = useStrategy();
  const { isReadOnly, isInTrial, isInGracePeriod, getRemainingDays } = useLicense();

  return (
    <div className="app">
      {/* License status banner */}
      {(isInTrial() || isInGracePeriod()) && (
        <LicenseBanner />
      )}

      <Routes>
        <Route path="/" element={<FileSelection />} />
        <Route
          path="/main/*"
          element={filePath ? <MainLayout /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <footer className="app-footer">
        Built by Lamosa L.L.C. - FZ
      </footer>
    </div>
  );
}

function LicenseBanner() {
  const { isInTrial, isInGracePeriod, getRemainingDays, isReadOnly } = useLicense();
  const daysRemaining = getRemainingDays();

  if (isInGracePeriod()) {
    return (
      <div className="license-banner license-banner-warning">
        <span>License expired - Read-only mode ({daysRemaining} days remaining)</span>
        <a href="http://localhost:3000/products/cpm-software" target="_blank" rel="noopener noreferrer">
          Renew License
        </a>
      </div>
    );
  }

  if (isInTrial()) {
    return (
      <div className="license-banner license-banner-trial">
        <span>Trial Mode - {daysRemaining} days remaining</span>
        <a href="http://localhost:3000/products/cpm-software" target="_blank" rel="noopener noreferrer">
          Purchase License
        </a>
      </div>
    );
  }

  return null;
}

function App() {
  return (
    <LicenseProvider>
      <LicenseGate>
        <StrategyProvider>
          <AppContent />
        </StrategyProvider>
      </LicenseGate>
    </LicenseProvider>
  );
}

export default App;
