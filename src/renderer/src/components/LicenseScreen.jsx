import React, { useState } from 'react';
import { useCloud } from '../contexts/CloudContext';
import { Key, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import transdataLogo from '../assets/transdata-logo.jpg';

function LicenseScreen() {
  const { validateKey, loading, error, clearError } = useCloud();
  const [accessKey, setAccessKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    clearError?.();

    if (!accessKey.trim()) {
      setLocalError('Please enter your access key');
      return;
    }

    setValidating(true);
    try {
      await validateKey(accessKey.trim());
      // If successful, CloudContext will update hasValidKey and App will show main content
    } catch (err) {
      setLocalError(err.message || 'Invalid access key');
    } finally {
      setValidating(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="license-screen">
      <div className="license-container">
        <div className="license-header">
          <img
            src={transdataLogo}
            alt="Transdata"
            className="license-logo"
          />
          <h1>CPM Strategy Cascade</h1>
          <p className="license-subtitle">Enter your access key to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="license-form">
          <div className="license-input-group">
            <label htmlFor="accessKey">Access Key</label>
            <div className="license-input-wrapper">
              <Key size={20} className="license-input-icon" />
              <input
                type="text"
                id="accessKey"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                disabled={validating || loading}
                autoFocus
              />
            </div>
            <p className="license-input-hint">
              Enter the access key provided with your purchase
            </p>
          </div>

          {displayError && (
            <div className="license-error">
              <AlertCircle size={18} />
              <span>{displayError}</span>
            </div>
          )}

          <button
            type="submit"
            className="license-submit-btn"
            disabled={validating || loading || !accessKey.trim()}
          >
            {validating || loading ? (
              <>
                <Loader size={20} className="spin" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Activate
              </>
            )}
          </button>
        </form>

        <div className="license-footer">
          <p>Need an access key? Contact <a href="mailto:support@transdata.net">support@transdata.net</a></p>
          <p className="license-copyright">© {new Date().getFullYear()} Transdata Bilgi Islem LTD STI</p>
        </div>
      </div>
    </div>
  );
}

export default LicenseScreen;
