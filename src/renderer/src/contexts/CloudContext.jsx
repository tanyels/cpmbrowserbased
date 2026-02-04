import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CloudContext = createContext(null);

export function CloudProvider({ children }) {
  const [keyStatus, setKeyStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const isElectron = typeof window !== 'undefined' && window.electronAPI?.cloud;

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize and check configuration
  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        // Check if Supabase is configured
        const configured = await window.electronAPI.cloud.isConfigured();
        setIsConfigured(configured);

        if (!configured) {
          setLoading(false);
          return;
        }

        // Get key status (checks for saved key)
        const statusResult = await window.electronAPI.cloud.getKeyStatus();
        if (statusResult.success && statusResult.data?.hasKey) {
          setKeyStatus(statusResult.data);
          // Load files if we have a valid key (force load since isConfigured state may not be updated yet)
          await loadFiles(true);
        }
      } catch (err) {
        console.error('Cloud init error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isElectron]);

  const loadFiles = useCallback(async (forceLoad = false) => {
    if (!isElectron || (!isConfigured && !forceLoad)) return;

    try {
      const result = await window.electronAPI.cloud.listFiles();
      if (result.success) {
        setFiles(result.data || []);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error loading cloud files:', err);
      setError(err.message);
    }
  }, [isElectron, isConfigured]);

  const validateKey = useCallback(async (accessKey) => {
    if (!isElectron) throw new Error('Not running in Electron');
    setError(null);

    const result = await window.electronAPI.cloud.validateKey(accessKey);
    if (!result.success) {
      throw new Error(result.error);
    }

    // Refresh key status after validation
    const statusResult = await window.electronAPI.cloud.getKeyStatus();
    if (statusResult.success) {
      setKeyStatus(statusResult.data);
    }

    await loadFiles();
    return result.data;
  }, [isElectron, loadFiles]);

  const refreshKeyStatus = useCallback(async () => {
    if (!isElectron) return;

    try {
      const statusResult = await window.electronAPI.cloud.getKeyStatus();
      if (statusResult.success) {
        setKeyStatus(statusResult.data);
      }
    } catch (err) {
      console.error('Error refreshing key status:', err);
    }
  }, [isElectron]);

  const clearKey = useCallback(async () => {
    if (!isElectron) return;
    setError(null);

    const result = await window.electronAPI.cloud.clearKey();
    if (!result.success) {
      throw new Error(result.error);
    }

    setKeyStatus(null);
    setFiles([]);
  }, [isElectron]);

  const uploadFile = useCallback(async (localPath, displayName) => {
    if (!isElectron) throw new Error('Not running in Electron');
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to upload files');
    setError(null);
    setUploading(true);

    try {
      const result = await window.electronAPI.cloud.uploadFile(localPath, displayName);
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadFiles();
      await refreshKeyStatus(); // Refresh to update used bytes
      return result.data;
    } finally {
      setUploading(false);
    }
  }, [isElectron, keyStatus, loadFiles, refreshKeyStatus]);

  const updateFile = useCallback(async (localPath, storagePath) => {
    if (!isElectron) throw new Error('Not running in Electron');
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to update files');
    setError(null);
    setUploading(true);

    try {
      const result = await window.electronAPI.cloud.updateFile(localPath, storagePath);
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadFiles();
      await refreshKeyStatus(); // Refresh to update used bytes
      return result.data;
    } finally {
      setUploading(false);
    }
  }, [isElectron, keyStatus, loadFiles, refreshKeyStatus]);

  const downloadFile = useCallback(async (storagePath, localDestination) => {
    if (!isElectron) throw new Error('Not running in Electron');
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to download files');
    setError(null);

    const result = await window.electronAPI.cloud.downloadFile(storagePath, localDestination);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }, [isElectron, keyStatus]);

  const deleteFile = useCallback(async (storagePath) => {
    if (!isElectron) throw new Error('Not running in Electron');
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to delete files');
    setError(null);

    const result = await window.electronAPI.cloud.deleteFile(storagePath);
    if (!result.success) {
      throw new Error(result.error);
    }
    await loadFiles();
    await refreshKeyStatus(); // Refresh to update used bytes
    return true;
  }, [isElectron, keyStatus, loadFiles, refreshKeyStatus]);

  const renameFile = useCallback(async (storagePath, newName) => {
    if (!isElectron) throw new Error('Not running in Electron');
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to rename files');
    setError(null);

    const result = await window.electronAPI.cloud.renameFile(storagePath, newName);
    if (!result.success) {
      throw new Error(result.error);
    }
    await loadFiles();
    return result.data;
  }, [isElectron, keyStatus, loadFiles]);

  const refreshFiles = useCallback(async () => {
    await loadFiles();
  }, [loadFiles]);

  const value = {
    keyStatus,
    hasValidKey: !!keyStatus?.hasKey,
    isConfigured,
    isOnline,
    files,
    loading,
    uploading,
    error,
    validateKey,
    clearKey,
    refreshKeyStatus,
    uploadFile,
    updateFile,
    downloadFile,
    deleteFile,
    renameFile,
    refreshFiles,
    clearError: () => setError(null)
  };

  return (
    <CloudContext.Provider value={value}>
      {children}
    </CloudContext.Provider>
  );
}

export function useCloud() {
  const context = useContext(CloudContext);
  if (!context) {
    throw new Error('useCloud must be used within a CloudProvider');
  }
  return context;
}
