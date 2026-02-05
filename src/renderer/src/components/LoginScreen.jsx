import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Key, AlertCircle, CheckCircle, Loader, User, Lock, UserPlus } from 'lucide-react';
import transdataLogo from '../assets/transdata-logo.jpg';

function LoginScreen() {
  const { login, activateKey, provideAccessKey, needsAccessKey, error, clearError, user } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'activate'
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Activate fields
  const [accessKey, setAccessKey] = useState('');
  const [activateUsername, setActivateUsername] = useState('');
  const [activateDisplayName, setActivateDisplayName] = useState('');
  const [activatePassword, setActivatePassword] = useState('');
  const [activateConfirmPassword, setActivateConfirmPassword] = useState('');

  // Access key prompt field (post-login)
  const [promptAccessKey, setPromptAccessKey] = useState('');

  const displayError = localError || error;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError(null);
    clearError?.();

    if (!username.trim() || !password) {
      setLocalError('Please enter both username and password');
      return;
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setLocalError(null);
    clearError?.();

    if (!accessKey.trim()) {
      setLocalError('Please enter your access key');
      return;
    }
    if (!activateUsername.trim()) {
      setLocalError('Please enter a username');
      return;
    }
    if (!activateDisplayName.trim()) {
      setLocalError('Please enter a display name');
      return;
    }
    if (!activatePassword) {
      setLocalError('Please enter a password');
      return;
    }
    if (activatePassword.length < 4) {
      setLocalError('Password must be at least 4 characters');
      return;
    }
    if (activatePassword !== activateConfirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await activateKey(accessKey.trim(), activateUsername.trim(), activatePassword, activateDisplayName.trim());
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProvideKey = async (e) => {
    e.preventDefault();
    setLocalError(null);
    clearError?.();

    if (!promptAccessKey.trim()) {
      setLocalError('Please enter your access key');
      return;
    }

    setSubmitting(true);
    try {
      await provideAccessKey(promptAccessKey.trim());
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setLocalError(null);
    clearError?.();
  };

  // Post-login access key prompt
  if (needsAccessKey && user) {
    return (
      <div className="license-screen">
        <div className="license-container">
          <div className="license-header">
            <img src={transdataLogo} alt="Transdata" className="license-logo" />
            <h1>Access Key Required</h1>
            <p className="license-subtitle">
              Welcome back, {user.display_name}! Please enter your access key to continue on this browser.
            </p>
          </div>

          <form onSubmit={handleProvideKey} className="license-form">
            <div className="license-input-group">
              <label htmlFor="promptAccessKey">Access Key</label>
              <div className="license-input-wrapper">
                <Key size={20} className="license-input-icon" />
                <input
                  type="text"
                  id="promptAccessKey"
                  value={promptAccessKey}
                  onChange={(e) => setPromptAccessKey(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <p className="license-input-hint">
                Enter the access key associated with your account
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
              disabled={submitting || !promptAccessKey.trim()}
            >
              {submitting ? (
                <><Loader size={20} className="spin" /> Validating...</>
              ) : (
                <><CheckCircle size={20} /> Continue</>
              )}
            </button>
          </form>

          <div className="license-footer">
            <p>Don't have the access key? Ask your organization admin.</p>
            <p className="license-copyright">&copy; {new Date().getFullYear()} Transdata Bilgi Islem LTD STI</p>
          </div>
        </div>
      </div>
    );
  }

  // Login mode
  if (mode === 'login') {
    return (
      <div className="license-screen">
        <div className="license-container">
          <div className="license-header">
            <img src={transdataLogo} alt="Transdata" className="license-logo" />
            <h1>CPM Strategy Cascade</h1>
            <p className="license-subtitle">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="license-form">
            <div className="license-input-group">
              <label htmlFor="loginUsername">Username</label>
              <div className="license-input-wrapper">
                <User size={20} className="license-input-icon" />
                <input
                  type="text"
                  id="loginUsername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={submitting}
                  autoFocus
                />
              </div>
            </div>

            <div className="license-input-group">
              <label htmlFor="loginPassword">Password</label>
              <div className="license-input-wrapper">
                <Lock size={20} className="license-input-icon" />
                <input
                  type="password"
                  id="loginPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={submitting}
                />
              </div>
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
              disabled={submitting || !username.trim() || !password}
            >
              {submitting ? (
                <><Loader size={20} className="spin" /> Signing in...</>
              ) : (
                <><CheckCircle size={20} /> Sign In</>
              )}
            </button>
          </form>

          <div className="license-footer">
            <p>
              First time with a new key?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); switchMode('activate'); }}>
                Activate Key
              </a>
            </p>
            <p className="license-copyright">&copy; {new Date().getFullYear()} Transdata Bilgi Islem LTD STI</p>
          </div>
        </div>
      </div>
    );
  }

  // Activate mode
  return (
    <div className="license-screen">
      <div className="license-container" style={{ maxWidth: '520px' }}>
        <div className="license-header">
          <img src={transdataLogo} alt="Transdata" className="license-logo" />
          <h1>Activate Access Key</h1>
          <p className="license-subtitle">Set up your organization admin account</p>
        </div>

        <form onSubmit={handleActivate} className="license-form">
          <div className="license-input-group">
            <label htmlFor="activateKey">Access Key</label>
            <div className="license-input-wrapper">
              <Key size={20} className="license-input-icon" />
              <input
                type="text"
                id="activateKey"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                disabled={submitting}
                autoFocus
              />
            </div>
            <p className="license-input-hint">
              Enter the access key provided by your administrator
            </p>
          </div>

          <div className="login-form-divider"></div>

          <div className="license-input-group">
            <label htmlFor="activateDisplayName">Display Name</label>
            <div className="license-input-wrapper">
              <UserPlus size={20} className="license-input-icon" />
              <input
                type="text"
                id="activateDisplayName"
                value={activateDisplayName}
                onChange={(e) => setActivateDisplayName(e.target.value)}
                placeholder="Your full name"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="license-input-group">
            <label htmlFor="activateUsername">Username</label>
            <div className="license-input-wrapper">
              <User size={20} className="license-input-icon" />
              <input
                type="text"
                id="activateUsername"
                value={activateUsername}
                onChange={(e) => setActivateUsername(e.target.value)}
                placeholder="Choose a username"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="license-input-group">
            <label htmlFor="activatePassword">Password</label>
            <div className="license-input-wrapper">
              <Lock size={20} className="license-input-icon" />
              <input
                type="password"
                id="activatePassword"
                value={activatePassword}
                onChange={(e) => setActivatePassword(e.target.value)}
                placeholder="Choose a password"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="license-input-group">
            <label htmlFor="activateConfirmPassword">Confirm Password</label>
            <div className="license-input-wrapper">
              <Lock size={20} className="license-input-icon" />
              <input
                type="password"
                id="activateConfirmPassword"
                value={activateConfirmPassword}
                onChange={(e) => setActivateConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={submitting}
              />
            </div>
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
            disabled={submitting || !accessKey.trim() || !activateUsername.trim() || !activatePassword || !activateConfirmPassword}
          >
            {submitting ? (
              <><Loader size={20} className="spin" /> Activating...</>
            ) : (
              <><CheckCircle size={20} /> Activate &amp; Create Account</>
            )}
          </button>
        </form>

        <div className="license-footer">
          <p>
            Already have an account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>
              Sign In
            </a>
          </p>
          <p className="license-copyright">&copy; {new Date().getFullYear()} Transdata Bilgi Islem LTD STI</p>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
