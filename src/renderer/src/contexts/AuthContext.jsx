import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { browserAuthService } from '../services/browserAuthService';
import { browserKeyService } from '../services/browserKeyService';
import { browserCryptoService } from '../services/browserCryptoService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsAccessKey, setNeedsAccessKey] = useState(false);

  // Initialize from stored session
  useEffect(() => {
    const init = async () => {
      try {
        const savedUser = browserAuthService.getCurrentUser();
        if (savedUser) {
          setUser(savedUser);

          // Check if access key is available
          const savedKey = browserKeyService.getCurrentKey();
          if (savedKey) {
            const matches = await browserKeyService.validateKeyForKeyId(savedKey, savedUser.key_id);
            if (matches) {
              await browserKeyService.initializeWithKey(savedKey);
              await browserCryptoService.deriveKey(savedKey);
              setNeedsAccessKey(false);
            } else {
              browserKeyService.clearKey();
              setNeedsAccessKey(true);
            }
          } else {
            setNeedsAccessKey(true);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        browserAuthService.clearSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = useCallback(async (username, password) => {
    setError(null);
    try {
      const result = await browserAuthService.login(username, password);
      setUser(result.user);
      setNeedsAccessKey(result.needsAccessKey);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const activateKey = useCallback(async (accessKey, username, password, displayName) => {
    setError(null);
    try {
      const result = await browserAuthService.activateKey(accessKey, username, password, displayName);
      setUser(result.user);
      setNeedsAccessKey(false);

      // Save key locally
      browserKeyService.currentKey = accessKey.toLowerCase().trim();
      localStorage.setItem('cpm-browser-key', browserKeyService.currentKey);

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const provideAccessKey = useCallback(async (accessKey) => {
    setError(null);
    if (!user) throw new Error('Must be logged in');

    try {
      const keyData = await browserAuthService.provideAccessKey(accessKey, user.key_id);

      // Save key locally
      browserKeyService.currentKey = accessKey.toLowerCase().trim();
      localStorage.setItem('cpm-browser-key', browserKeyService.currentKey);

      setNeedsAccessKey(false);
      return keyData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  const logout = useCallback(() => {
    browserAuthService.clearSession();
    browserKeyService.clearKey();
    browserCryptoService.clearKey();
    setUser(null);
    setNeedsAccessKey(false);
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    needsAccessKey,
    isAuthenticated: !!user,
    isOwner: user?.role === 'owner',
    login,
    activateKey,
    provideAccessKey,
    logout,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
