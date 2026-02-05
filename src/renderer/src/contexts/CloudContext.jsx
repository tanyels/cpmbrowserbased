import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { browserKeyService } from '../services/browserKeyService';
import { browserStorageService } from '../services/browserStorageService';
import { browserCryptoService } from '../services/browserCryptoService';

const CloudContext = createContext(null);

export function CloudProvider({ children }) {
  const [keyStatus, setKeyStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isConfigured] = useState(true); // Always configured in web version
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  // Initialize - check if key service already has a key (set by auth flow)
  useEffect(() => {
    const init = async () => {
      try {
        const savedKey = browserKeyService.getCurrentKey();
        if (savedKey) {
          const status = await browserKeyService.getKeyStatus();
          if (status.hasKey) {
            setKeyStatus(status);
            await loadFilesInternal();
          }
        }
      } catch (err) {
        console.error('Cloud init error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const loadFilesInternal = async () => {
    try {
      const fileList = await browserStorageService.listFiles();
      setFiles(fileList || []);
    } catch (err) {
      console.error('Error loading cloud files:', err);
      setError(err.message);
    }
  };

  const loadFiles = useCallback(async () => {
    await loadFilesInternal();
  }, []);

  const validateKey = useCallback(async (accessKey) => {
    setError(null);

    try {
      const keyData = await browserKeyService.validateKey(accessKey);

      // Derive encryption key from access key (normalized inside deriveKey)
      await browserCryptoService.deriveKey(accessKey);

      // Refresh key status
      const status = await browserKeyService.getKeyStatus();
      setKeyStatus(status);

      await loadFilesInternal();
      return keyData;
    } catch (err) {
      throw new Error(err.message);
    }
  }, []);

  const refreshKeyStatus = useCallback(async () => {
    try {
      const status = await browserKeyService.getKeyStatus();
      setKeyStatus(status);
    } catch (err) {
      console.error('Error refreshing key status:', err);
    }
  }, []);

  const clearKey = useCallback(async () => {
    setError(null);
    browserKeyService.clearKey();
    browserCryptoService.clearKey();
    setKeyStatus(null);
    setFiles([]);
  }, []);

  // Upload file buffer to cloud
  const uploadFile = useCallback(async (fileBuffer, displayName) => {
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to upload files');
    setError(null);
    setUploading(true);

    try {
      const result = await browserStorageService.uploadFile(fileBuffer, displayName);
      await loadFilesInternal();
      await refreshKeyStatus();
      return result;
    } finally {
      setUploading(false);
    }
  }, [keyStatus, refreshKeyStatus]);

  // Update existing file in cloud
  const updateFile = useCallback(async (fileBuffer, storagePath) => {
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to update files');
    setError(null);
    setUploading(true);

    try {
      const result = await browserStorageService.updateFile(fileBuffer, storagePath);
      await loadFilesInternal();
      await refreshKeyStatus();
      return result;
    } finally {
      setUploading(false);
    }
  }, [keyStatus, refreshKeyStatus]);

  // Download file from cloud (returns ArrayBuffer)
  const downloadFile = useCallback(async (storagePath) => {
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to download files');
    setError(null);

    return await browserStorageService.downloadFile(storagePath);
  }, [keyStatus]);

  const deleteFile = useCallback(async (storagePath) => {
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to delete files');
    setError(null);

    await browserStorageService.deleteFile(storagePath);
    await loadFilesInternal();
    await refreshKeyStatus();
    return true;
  }, [keyStatus, refreshKeyStatus]);

  const renameFile = useCallback(async (storagePath, newName) => {
    if (!keyStatus?.hasKey) throw new Error('You must enter a valid access key to rename files');
    setError(null);

    const result = await browserStorageService.renameFile(storagePath, newName);
    await loadFilesInternal();
    return result;
  }, [keyStatus]);

  const refreshFiles = useCallback(async () => {
    await loadFilesInternal();
  }, []);

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
