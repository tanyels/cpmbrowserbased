import React, { createContext, useContext, useState, useCallback } from 'react';
import { useCloud } from './CloudContext';

// License states - simplified for web
const LICENSE_STATE = {
  VALID: 'valid',
  INVALID: 'invalid'
};

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  // For web version, license is tied to cloud access key
  // We don't need to duplicate CloudContext state, just provide compatible interface

  // Check if a feature is allowed - all features allowed in web version
  const isFeatureAllowed = useCallback(() => {
    return true; // All features allowed
  }, []);

  // Not read-only in web version
  const isReadOnly = useCallback(() => {
    return false;
  }, []);

  // Valid license if cloud key is valid
  const hasValidLicense = useCallback(() => {
    return true; // Always valid in web - cloud key controls access
  }, []);

  // Not in trial in web version
  const isInTrial = useCallback(() => {
    return false;
  }, []);

  const isInGracePeriod = useCallback(() => {
    return false;
  }, []);

  const getRemainingDays = useCallback(() => {
    return null;
  }, []);

  const getStatusMessage = useCallback(() => {
    return 'Web version - Cloud storage enabled';
  }, []);

  const getExpirationDate = useCallback(() => {
    return null;
  }, []);

  // Company info - simplified for web
  const getCompanyInfo = useCallback(() => {
    return {
      name: 'Transdata',
      logo: null
    };
  }, []);

  // Placeholder functions for API compatibility
  const activateLicense = useCallback(async () => {
    return { success: true };
  }, []);

  const deactivateLicense = useCallback(async () => {
    return { success: true };
  }, []);

  const startTrial = useCallback(async () => {
    return { success: true };
  }, []);

  const validateLicense = useCallback(async () => {
    return { success: true };
  }, []);

  const clearLicense = useCallback(async () => {
    return { success: true };
  }, []);

  const fetchLicenseState = useCallback(async () => {
    // No-op for web
  }, []);

  const value = {
    // State - simplified
    licenseState: { state: LICENSE_STATE.VALID },
    licenseData: null,
    featureLimits: null,
    config: null,
    isLoading: false,
    error: null,

    // Actions (no-ops for web)
    activateLicense,
    deactivateLicense,
    startTrial,
    validateLicense,
    clearLicense,
    refreshLicense: fetchLicenseState,

    // Helpers
    isFeatureAllowed,
    isReadOnly,
    hasValidLicense,
    isInTrial,
    isInGracePeriod,
    getRemainingDays,
    getStatusMessage,
    getExpirationDate,
    getCompanyInfo,

    // Constants
    LICENSE_STATE
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}

export { LICENSE_STATE };
