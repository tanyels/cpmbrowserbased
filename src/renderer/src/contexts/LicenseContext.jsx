import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// License states matching backend
const LICENSE_STATE = {
  VALID: 'valid',
  TRIAL: 'trial',
  TRIAL_EXPIRED: 'trial_expired',
  EXPIRED: 'expired',
  GRACE_PERIOD: 'grace_period',
  INVALID: 'invalid',
  NEEDS_VALIDATION: 'needs_validation'
};

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const [licenseState, setLicenseState] = useState(null);
  const [licenseData, setLicenseData] = useState(null);
  const [featureLimits, setFeatureLimits] = useState(null);
  const [config, setConfig] = useState(null);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if we're running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.license;

  // Fetch license configuration
  const fetchConfig = useCallback(async () => {
    if (!isElectron) return;
    try {
      const result = await window.electronAPI.license.getConfig();
      setConfig(result);
    } catch (err) {
      console.error('Failed to fetch license config:', err);
    }
  }, [isElectron]);

  // Fetch current license state
  const fetchLicenseState = useCallback(async () => {
    if (!isElectron) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const stateResult = await window.electronAPI.license.getState();
      setLicenseState(stateResult);

      const dataResult = await window.electronAPI.license.getData();
      if (dataResult.success) {
        setLicenseData(dataResult.data);
      }

      const limitsResult = await window.electronAPI.license.getLimits();
      if (limitsResult.success) {
        setFeatureLimits(limitsResult.limits);
      }

      // Fetch company logo as base64
      const logoResult = await window.electronAPI.license.getCompanyLogo();
      if (logoResult.success) {
        setCompanyLogo(logoResult.logo);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch license state:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Initialize
  useEffect(() => {
    fetchConfig();
    fetchLicenseState();
  }, [fetchConfig, fetchLicenseState]);

  // Activate license with key
  const activateLicense = useCallback(async (licenseKey, companyInfo = null) => {
    if (!isElectron) return { success: false, message: 'Not running in Electron' };

    try {
      setIsLoading(true);
      const result = await window.electronAPI.license.activate(licenseKey, companyInfo);

      if (result.success) {
        await fetchLicenseState();
      }

      return result;
    } catch (err) {
      console.error('Failed to activate license:', err);
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron, fetchLicenseState]);

  // Deactivate license
  const deactivateLicense = useCallback(async () => {
    if (!isElectron) return { success: false, message: 'Not running in Electron' };

    try {
      setIsLoading(true);
      const result = await window.electronAPI.license.deactivate();

      if (result.success) {
        await fetchLicenseState();
      }

      return result;
    } catch (err) {
      console.error('Failed to deactivate license:', err);
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron, fetchLicenseState]);

  // Start trial
  const startTrial = useCallback(async () => {
    if (!isElectron) return { success: false, message: 'Not running in Electron' };

    try {
      setIsLoading(true);
      const result = await window.electronAPI.license.startTrial();

      if (result.success) {
        await fetchLicenseState();
      }

      return result;
    } catch (err) {
      console.error('Failed to start trial:', err);
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron, fetchLicenseState]);

  // Validate license (force online check)
  const validateLicense = useCallback(async () => {
    if (!isElectron) return { success: false, message: 'Not running in Electron' };

    try {
      setIsLoading(true);
      const result = await window.electronAPI.license.validate();

      await fetchLicenseState();

      return result;
    } catch (err) {
      console.error('Failed to validate license:', err);
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron, fetchLicenseState]);

  // Clear license data (for testing)
  const clearLicense = useCallback(async () => {
    if (!isElectron) return { success: false, message: 'Not running in Electron' };

    try {
      const result = await window.electronAPI.license.clear();

      if (result.success) {
        await fetchLicenseState();
      }

      return result;
    } catch (err) {
      console.error('Failed to clear license:', err);
      return { success: false, message: err.message };
    }
  }, [isElectron, fetchLicenseState]);

  // Check if a feature is allowed based on current limits
  const isFeatureAllowed = useCallback((feature, currentCount = 0) => {
    if (!featureLimits) return true; // Allow all if no limits set

    switch (feature) {
      case 'business_units':
        return featureLimits.MAX_BUSINESS_UNITS === Infinity ||
               currentCount < featureLimits.MAX_BUSINESS_UNITS;
      case 'kpis':
        return featureLimits.MAX_KPIS === Infinity ||
               currentCount < featureLimits.MAX_KPIS;
      case 'team_members':
        return featureLimits.MAX_TEAM_MEMBERS === Infinity ||
               currentCount < featureLimits.MAX_TEAM_MEMBERS;
      case 'export':
        return featureLimits.EXPORT_ALLOWED !== false;
      default:
        return true;
    }
  }, [featureLimits]);

  // Check if currently in read-only mode
  const isReadOnly = useCallback(() => {
    return featureLimits?.readOnly === true;
  }, [featureLimits]);

  // Check if license is valid (not expired, not trial expired, etc.)
  const hasValidLicense = useCallback(() => {
    if (!licenseState) return false;
    return licenseState.state === LICENSE_STATE.VALID ||
           licenseState.state === LICENSE_STATE.TRIAL;
  }, [licenseState]);

  // Check if trial is active
  const isInTrial = useCallback(() => {
    return licenseState?.state === LICENSE_STATE.TRIAL;
  }, [licenseState]);

  // Check if in grace period
  const isInGracePeriod = useCallback(() => {
    return licenseState?.state === LICENSE_STATE.GRACE_PERIOD;
  }, [licenseState]);

  // Get remaining days (trial or grace period)
  const getRemainingDays = useCallback(() => {
    if (licenseState?.state === LICENSE_STATE.TRIAL) {
      return licenseState.trialDaysRemaining || 0;
    }
    if (licenseState?.state === LICENSE_STATE.GRACE_PERIOD) {
      return licenseState.graceDaysRemaining || 0;
    }
    return null;
  }, [licenseState]);

  // Get user-friendly status message
  const getStatusMessage = useCallback(() => {
    if (!licenseState) return 'Checking license...';
    return licenseState.message || 'Unknown status';
  }, [licenseState]);

  // Get license expiration date
  const getExpirationDate = useCallback(() => {
    if (!licenseState?.expiresAt) return null;
    return new Date(licenseState.expiresAt);
  }, [licenseState]);

  // Get company info
  const getCompanyInfo = useCallback(() => {
    if (!licenseData) return null;
    return {
      name: licenseData.companyName,
      logoUrl: licenseData.companyLogoUrl,
      logo: companyLogo // base64 data URL
    };
  }, [licenseData, companyLogo]);

  const value = {
    // State
    licenseState,
    licenseData,
    featureLimits,
    config,
    isLoading,
    error,

    // Actions
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
