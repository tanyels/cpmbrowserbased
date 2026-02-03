import React, { useState } from 'react';
import { useLicense, LICENSE_STATE } from '../contexts/LicenseContext';
import { Target, Building2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

function LicenseScreen({ onContinue }) {
  const {
    licenseState,
    licenseData,
    config,
    isLoading,
    activateLicense,
    startTrial,
    hasValidLicense,
    isInTrial,
    isInGracePeriod,
    getRemainingDays,
    getStatusMessage
  } = useLicense();

  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showActivationForm, setShowActivationForm] = useState(false);

  // Company info for first activation
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [pendingLicenseKey, setPendingLicenseKey] = useState('');

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setErrorMessage('Please enter a license key');
      return;
    }

    setActivating(true);
    setErrorMessage('');

    // First try without company info
    const result = await activateLicense(licenseKey.trim());

    if (result.success) {
      onContinue?.();
    } else if (result.needsCompanyInfo) {
      // License needs company info - show the company form
      setPendingLicenseKey(licenseKey.trim());
      setShowCompanyForm(true);
      setErrorMessage('');
    } else {
      setErrorMessage(result.message || 'Failed to activate license');
    }

    setActivating(false);
  };

  const handleCompanySubmit = async () => {
    if (!companyName.trim()) {
      setErrorMessage('Company name is required');
      return;
    }

    setActivating(true);
    setErrorMessage('');

    const result = await activateLicense(pendingLicenseKey, {
      companyName: companyName.trim(),
      companyLogoUrl: companyLogoUrl.trim() || null
    });

    if (result.success) {
      onContinue?.();
    } else {
      setErrorMessage(result.message || 'Failed to activate license');
    }

    setActivating(false);
  };

  const handleStartTrial = async () => {
    setActivating(true);
    setErrorMessage('');

    const result = await startTrial();

    if (result.success) {
      onContinue?.();
    } else {
      setErrorMessage(result.message || 'Failed to start trial');
    }

    setActivating(false);
  };

  const handleContinue = () => {
    onContinue?.();
  };

  const formatLicenseKey = (value) => {
    // Auto-format license key as XXXX-XXXX-XXXX-XXXX
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.slice(0, 4).join('-');
  };

  const handleKeyChange = (e) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
  };

  if (isLoading) {
    return (
      <div className="license-screen">
        <div className="license-card">
          <div className="license-logo"><Target size={48} /></div>
          <h1>CPM Strategy Cascade Tool</h1>
          <div className="license-loading">
            <span className="spinner"></span>
            <p>Checking license status...</p>
          </div>
        </div>
      </div>
    );
  }

  // Company info form for first activation
  if (showCompanyForm) {
    return (
      <div className="license-screen">
        <div className="license-card">
          <div className="license-logo"><Building2 size={48} /></div>
          <h1>Company Registration</h1>
          <p className="subtitle">Register your company to activate this license</p>

          <div className="company-form">
            <div className="form-group">
              <label>Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter your company name"
                className="input"
                disabled={activating}
              />
            </div>

            <div className="form-group">
              <label>Company Logo URL (Optional)</label>
              <input
                type="text"
                value={companyLogoUrl}
                onChange={(e) => setCompanyLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="input"
                disabled={activating}
              />
              <p className="form-hint">Enter a URL to your company logo image</p>
            </div>

            {companyLogoUrl && (
              <div className="logo-preview">
                <p>Logo Preview:</p>
                <img
                  src={companyLogoUrl}
                  alt="Company logo preview"
                  onError={(e) => e.target.style.display = 'none'}
                  style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }}
                />
              </div>
            )}

            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}

            <div className="form-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleCompanySubmit}
                disabled={activating || !companyName.trim()}
              >
                {activating ? 'Activating...' : 'Activate License'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowCompanyForm(false);
                  setPendingLicenseKey('');
                  setCompanyName('');
                  setCompanyLogoUrl('');
                  setErrorMessage('');
                }}
                disabled={activating}
              >
                Cancel
              </button>
            </div>
          </div>

          <p className="company-notice">
            This license will be permanently associated with your company.
            All seats on this license will be used under this company name.
          </p>
        </div>
      </div>
    );
  }

  // Valid license or trial - show continue option
  if (hasValidLicense()) {
    const daysRemaining = getRemainingDays();

    return (
      <div className="license-screen">
        <div className="license-card">
          <div className="license-logo"><Target size={48} /></div>
          <h1>CPM Strategy Cascade Tool</h1>

          <div className="license-status license-status-valid">
            <div className="status-icon"><CheckCircle size={24} /></div>
            <div className="status-info">
              <h3>{isInTrial() ? 'Trial Mode Active' : 'License Active'}</h3>
              <p>{getStatusMessage()}</p>
              {daysRemaining !== null && (
                <p className="days-remaining">
                  {daysRemaining} days remaining
                </p>
              )}
            </div>
          </div>

          {isInTrial() && config && (
            <div className="trial-limits-info">
              <h4>Trial Limitations:</h4>
              <ul>
                <li>Maximum {config.trialLimits.MAX_BUSINESS_UNITS} Business Units</li>
                <li>Maximum {config.trialLimits.MAX_KPIS} KPIs</li>
                <li>Maximum {config.trialLimits.MAX_TEAM_MEMBERS} Team Members</li>
                <li>Export functionality disabled</li>
              </ul>
            </div>
          )}

          <div className="license-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleContinue}
            >
              Continue to Application
            </button>

            {isInTrial() && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowActivationForm(true)}
              >
                Enter License Key
              </button>
            )}
          </div>

          {showActivationForm && (
            <div className="activation-form">
              <h4>Activate Full License</h4>
              <div className="form-group">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleKeyChange}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="license-input"
                  maxLength={19}
                  disabled={activating}
                />
              </div>
              {errorMessage && (
                <div className="error-message">{errorMessage}</div>
              )}
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleActivate}
                  disabled={activating || !licenseKey.trim()}
                >
                  {activating ? 'Activating...' : 'Activate'}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setShowActivationForm(false);
                    setLicenseKey('');
                    setErrorMessage('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grace period - read only mode
  if (isInGracePeriod()) {
    const daysRemaining = getRemainingDays();

    return (
      <div className="license-screen">
        <div className="license-card">
          <div className="license-logo"><Target size={48} /></div>
          <h1>CPM Strategy Cascade Tool</h1>

          <div className="license-status license-status-warning">
            <div className="status-icon"><AlertTriangle size={24} /></div>
            <div className="status-info">
              <h3>License Expired - Grace Period</h3>
              <p>{getStatusMessage()}</p>
              {daysRemaining !== null && (
                <p className="days-remaining warning">
                  {daysRemaining} days remaining in read-only mode
                </p>
              )}
            </div>
          </div>

          <p className="grace-period-notice">
            Your license has expired. You can continue using the application in read-only mode
            for {daysRemaining} more days. Please renew your license to regain full access.
          </p>

          <div className="activation-form">
            <h4>Enter License Key to Renew</h4>
            <div className="form-group">
              <input
                type="text"
                value={licenseKey}
                onChange={handleKeyChange}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="license-input"
                maxLength={19}
                disabled={activating}
              />
            </div>
            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
              >
                {activating ? 'Activating...' : 'Activate License'}
              </button>
            </div>
          </div>

          <div className="license-actions">
            <button
              className="btn btn-secondary"
              onClick={handleContinue}
            >
              Continue in Read-Only Mode
            </button>
          </div>

          <div className="purchase-link">
            <a href="https://lamosa-store.vercel.app/products/cpm-software" target="_blank" rel="noopener noreferrer">
              Purchase or renew license
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No license / expired / invalid - show activation options
  const canStartTrial = licenseState?.canStartTrial !== false;
  const isExpired = licenseState?.state === LICENSE_STATE.EXPIRED ||
                    licenseState?.state === LICENSE_STATE.TRIAL_EXPIRED;

  return (
    <div className="license-screen">
      <div className="license-card">
        <div className="license-logo"><Target size={48} /></div>
        <h1>CPM Strategy Cascade Tool</h1>
        <p className="subtitle">Strategy-to-KPI Structuring Platform</p>

        {isExpired && (
          <div className="license-status license-status-expired">
            <div className="status-icon"><XCircle size={24} /></div>
            <div className="status-info">
              <h3>{licenseState?.state === LICENSE_STATE.TRIAL_EXPIRED ? 'Trial Expired' : 'License Expired'}</h3>
              <p>{getStatusMessage()}</p>
            </div>
          </div>
        )}

        <div className="license-options">
          {canStartTrial && licenseState?.state !== LICENSE_STATE.TRIAL_EXPIRED && (
            <div className="license-option">
              <h3>Start Free Trial</h3>
              <p>Try the application for {config?.trialDays || 7} days with limited features</p>
              <ul className="trial-features">
                <li>Up to {config?.trialLimits?.MAX_BUSINESS_UNITS || 2} Business Units</li>
                <li>Up to {config?.trialLimits?.MAX_KPIS || 10} KPIs</li>
                <li>Up to {config?.trialLimits?.MAX_TEAM_MEMBERS || 5} Team Members</li>
              </ul>
              <button
                className="btn btn-secondary btn-lg"
                onClick={handleStartTrial}
                disabled={activating}
              >
                {activating ? 'Starting...' : 'Start 7-Day Trial'}
              </button>
            </div>
          )}

          <div className="license-option">
            <h3>Activate License</h3>
            <p>Enter your license key to unlock all features</p>

            <div className="activation-form inline">
              <div className="form-group">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={handleKeyChange}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="license-input"
                  maxLength={19}
                  disabled={activating}
                />
              </div>
              {errorMessage && (
                <div className="error-message">{errorMessage}</div>
              )}
              <button
                className="btn btn-primary btn-lg"
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
              >
                {activating ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        </div>

        <div className="purchase-link">
          <p>Don't have a license?</p>
          <a href="https://lamosa-store.vercel.app/products/cpm-software" target="_blank" rel="noopener noreferrer">
            Purchase a license ($4,999/year)
          </a>
        </div>

        <footer className="license-footer">
          <p>© {new Date().getFullYear()} Transdata Bilgi Islem LTD STI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default LicenseScreen;
