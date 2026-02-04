import React, { useState, useEffect } from 'react';
import { useCloud } from '../contexts/CloudContext';
import { useStrategy } from '../contexts/StrategyContext';
import {
  Cloud, Upload, Download, Trash2, RefreshCw,
  FileText, Clock, HardDrive, AlertCircle, Check,
  Key, Loader, Edit2, X, FolderOpen, LogOut, Lock, ExternalLink
} from 'lucide-react';

function CloudFileBrowser({ onFileOpened }) {
  const {
    hasValidKey,
    keyStatus,
    isConfigured,
    isOnline,
    files,
    loading,
    uploading,
    error,
    validateKey,
    clearKey,
    uploadFile,
    downloadFile,
    deleteFile,
    renameFile,
    refreshFiles,
    refreshKeyStatus,
    clearError
  } = useCloud();

  const { filePath, hasUnsavedChanges, saveFile, saveFileAs, loadFile, markAsFromCloud } = useStrategy();

  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [newName, setNewName] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [localError, setLocalError] = useState('');

  // Clear messages after a delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (localError) {
      const timer = setTimeout(() => setLocalError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [localError]);

  useEffect(() => {
    if (keyError) {
      const timer = setTimeout(() => setKeyError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [keyError]);

  // Format access key as user types (xxxx-xxxx-xxxx-xxxx)
  const handleKeyInputChange = (e) => {
    let value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Remove existing dashes for reformatting
    const cleaned = value.replace(/-/g, '');

    // Add dashes at appropriate positions
    let formatted = '';
    for (let i = 0; i < cleaned.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += '-';
      }
      formatted += cleaned[i];
    }

    setAccessKeyInput(formatted);
  };

  const handleValidateKey = async (e) => {
    e.preventDefault();
    if (!accessKeyInput.trim()) return;

    setKeyLoading(true);
    setKeyError('');

    try {
      await validateKey(accessKeyInput.trim());
      setAccessKeyInput('');
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setKeyLoading(false);
    }
  };

  // Not configured
  if (!isConfigured) {
    return (
      <div className="cloud-browser cloud-not-configured">
        <div className="cloud-empty-state">
          <AlertCircle size={48} />
          <h3>Cloud Not Configured</h3>
          <p>Cloud storage has not been configured for this application.</p>
          <p className="cloud-config-hint">
            To enable cloud features, update the Supabase configuration in
            <code>src/main/supabaseConfig.js</code>
          </p>
        </div>
      </div>
    );
  }

  // No valid key - show key entry UI
  if (!hasValidKey) {
    return (
      <div className="cloud-browser cloud-key-entry">
        <div className="cloud-key-form">
          <div className="cloud-key-header">
            <Key size={48} />
            <h2>Cloud Storage Access</h2>
            <p>Enter your access key to access cloud storage</p>
          </div>

          <form onSubmit={handleValidateKey}>
            <div className="cloud-key-input-group">
              <input
                type="text"
                value={accessKeyInput}
                onChange={handleKeyInputChange}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                className="cloud-key-input"
                maxLength={19}
                disabled={keyLoading}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={keyLoading || accessKeyInput.length < 19}
              >
                {keyLoading ? (
                  <><Loader size={16} className="spinner" /> Validating...</>
                ) : (
                  <><Key size={16} /> Activate Key</>
                )}
              </button>
            </div>

            {keyError && (
              <div className="cloud-key-error">
                <AlertCircle size={16} />
                <span>{keyError}</span>
              </div>
            )}
          </form>

          <div className="cloud-key-info">
            <p>Don't have an access key? Contact your administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const getQuotaPercent = () => {
    if (!keyStatus?.quotaBytes) return 0;
    return Math.round((keyStatus.usedBytes || 0) / keyStatus.quotaBytes * 100);
  };

  const formatExpiration = () => {
    if (!keyStatus?.expiresAt) return 'Never';
    const expires = new Date(keyStatus.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'Expired';
    if (daysLeft < 30) return `${daysLeft} days left`;
    return expires.toLocaleDateString();
  };

  const handleUploadCurrent = async () => {
    if (!filePath) {
      setLocalError('No file is currently open');
      return;
    }

    if (!filePath.endsWith('.cpme')) {
      setLocalError('Only encrypted .cpme files can be uploaded. Use "Save As" to save your file as .cpme first.');
      return;
    }

    if (hasUnsavedChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Save before uploading?');
      if (shouldSave) {
        await saveFile();
      }
    }

    setActionLoading('upload');
    clearError();

    try {
      const fileName = filePath.split('/').pop().split('\\').pop();
      await uploadFile(filePath, fileName.replace('.cpme', ''));
      setSuccessMessage('File uploaded successfully!');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEncryptAndInitialize = async () => {
    setActionLoading('encrypt');
    clearError();
    setLocalError('');

    try {
      // Open file dialog to select xlsx
      const selectedPath = await window.electronAPI.openFileDialog();
      if (!selectedPath) {
        // User cancelled
        setActionLoading(null);
        return;
      }

      // Check if selected file is xlsx
      if (selectedPath.endsWith('.cpme')) {
        setLocalError('Selected file is already encrypted. Please select an .xlsx file.');
        setActionLoading(null);
        return;
      }

      // Convert and upload directly (saves to temp, uploads, no local save needed)
      const result = await window.electronAPI.cloud.convertAndUpload(selectedPath);
      if (result.success) {
        setSuccessMessage('File encrypted and uploaded successfully!');
        await refreshFiles();
        await refreshKeyStatus();
      } else {
        setLocalError(result.error || 'Failed to convert and upload file');
      }
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (file) => {
    setActionLoading(file.id);
    clearError();

    try {
      // Ask where to save
      const result = await window.electronAPI.saveFileDialog(file.display_name + '.cpme');
      if (!result || result.canceled) {
        setActionLoading(null);
        return;
      }

      await downloadFile(file.storage_path, result.filePath);
      setSuccessMessage(`Downloaded: ${file.display_name}`);

      // Ask if they want to open the file
      const shouldOpen = window.confirm('File downloaded. Would you like to open it now?');
      if (shouldOpen) {
        if (onFileOpened) {
          onFileOpened(result.filePath);
        }
      }
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenInApp = async (file) => {
    setActionLoading(file.id);
    clearError();

    try {
      console.log('=== OPEN IN APP ===');
      console.log('file.storage_path:', file.storage_path);
      // Download to temp location and open
      const result = await window.electronAPI.cloud.downloadAndOpen(file.storage_path, file.display_name);
      console.log('downloadAndOpen result:', result);
      if (result.success) {
        setSuccessMessage(`Opened: ${file.display_name}`);
        // Mark as from cloud so we can track it
        console.log('Calling markAsFromCloud with:', file.storage_path);
        markAsFromCloud(file.storage_path);
        if (onFileOpened) {
          console.log('Calling onFileOpened with:', result.filePath);
          onFileOpened(result.filePath);
        }
      } else {
        setLocalError(result.error || 'Failed to open file');
      }
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${file.display_name}"? This cannot be undone.`);
    if (!confirmed) return;

    setActionLoading(file.id);
    clearError();

    try {
      await deleteFile(file.storage_path);
      setSuccessMessage('File deleted');
      setSelectedFile(null);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartRename = (file) => {
    setEditingFile(file.id);
    setNewName(file.display_name);
  };

  const handleRename = async (file) => {
    if (!newName.trim() || newName === file.display_name) {
      setEditingFile(null);
      return;
    }

    setActionLoading(file.id);
    clearError();

    try {
      await renameFile(file.storage_path, newName.trim());
      setSuccessMessage('File renamed');
      setEditingFile(null);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setActionLoading('refresh');
    try {
      await refreshFiles();
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearKey = async () => {
    const confirmed = window.confirm('Are you sure you want to disconnect from cloud storage?');
    if (!confirmed) return;

    try {
      await clearKey();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="cloud-browser">
      {/* Header */}
      <div className="cloud-browser-header">
        <div className="cloud-user-info">
          <Key size={20} />
          <span className="cloud-key-preview">{keyStatus?.keyPreview || '••••-••••-••••-••••'}</span>
          {!isOnline && (
            <span className="cloud-offline-badge">
              <AlertCircle size={14} /> Offline
            </span>
          )}
        </div>
        <div className="cloud-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={actionLoading === 'refresh' || !isOnline}
            title="Refresh file list"
          >
            <RefreshCw size={14} className={actionLoading === 'refresh' ? 'spinning' : ''} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleClearKey}
            title="Disconnect"
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </div>

      {/* Quota & Expiration Info */}
      <div className="cloud-status-bar">
        <div className="cloud-quota">
          <HardDrive size={14} />
          <span>Storage: {formatSize(keyStatus?.usedBytes || 0)} / {formatSize(keyStatus?.quotaBytes || 0)}</span>
          <div className="cloud-quota-bar">
            <div
              className={`cloud-quota-fill ${getQuotaPercent() > 90 ? 'warning' : ''}`}
              style={{ width: `${getQuotaPercent()}%` }}
            />
          </div>
          <span className="cloud-quota-percent">{getQuotaPercent()}%</span>
        </div>
        <div className="cloud-expiration">
          <Clock size={14} />
          <span>Expires: {formatExpiration()}</span>
        </div>
      </div>

      {/* Messages */}
      {(error || localError) && (
        <div className="cloud-message error">
          <AlertCircle size={16} />
          <span>{error || localError}</span>
          <button onClick={() => { clearError(); setLocalError(''); }}>
            <X size={14} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="cloud-message success">
          <Check size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Upload Section */}
      <div className="cloud-upload-section">
        <h3>Upload to Cloud</h3>
        <div className="cloud-security-notice">
          <AlertCircle size={14} />
          <span>For security, only encrypted .cpme files can be uploaded to cloud storage.</span>
        </div>
        <p className="cloud-upload-hint">
          {filePath
            ? `Current file: ${filePath.split('/').pop().split('\\').pop()}${!filePath.endsWith('.cpme') ? ' (needs encryption)' : ''}`
            : 'Open a .cpme file to upload it to the cloud'
          }
        </p>
        <div className="cloud-upload-buttons">
          <button
            className="btn btn-primary"
            onClick={handleUploadCurrent}
            disabled={!filePath || !filePath.endsWith('.cpme') || uploading || actionLoading || !isOnline}
          >
            {uploading || actionLoading === 'upload' ? (
              <><Loader size={16} className="spinner" /> Uploading...</>
            ) : (
              <><Upload size={16} /> Upload Current File</>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleEncryptAndInitialize}
            disabled={(filePath && filePath.endsWith('.cpme')) || uploading || actionLoading || !isOnline}
          >
            {actionLoading === 'encrypt' ? (
              <><Loader size={16} className="spinner" /> Encrypting...</>
            ) : (
              <><Lock size={16} /> Encrypt & Initialize</>
            )}
          </button>
        </div>
        <p className="cloud-encrypt-note">
          To upload an .xlsx file, click "Encrypt & Initialize" to select, encrypt, and upload it to cloud.
        </p>
      </div>

      {/* File List */}
      <div className="cloud-files-section">
        <h3>
          <FolderOpen size={18} />
          Cloud Files
          <span className="cloud-file-count">{files.length}</span>
        </h3>

        {loading ? (
          <div className="cloud-loading">
            <Loader size={24} className="spinner" />
            <span>Loading files...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="cloud-empty-files">
            <FileText size={32} />
            <p>No files in the cloud yet</p>
            <p className="hint">Upload your first .cpme file to get started</p>
          </div>
        ) : (
          <div className="cloud-file-list">
            {files.map(file => (
              <div
                key={file.id}
                className={`cloud-file-item ${selectedFile === file.id ? 'selected' : ''}`}
                onClick={() => setSelectedFile(file.id)}
              >
                <div className="cloud-file-icon">
                  <FileText size={24} />
                </div>
                <div className="cloud-file-info">
                  {editingFile === file.id ? (
                    <div className="cloud-file-rename">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(file);
                          if (e.key === 'Escape') setEditingFile(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleRename(file)} title="Save">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingFile(null)} title="Cancel">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="cloud-file-name">{file.display_name}</span>
                  )}
                  <span className="cloud-file-meta">
                    <Clock size={12} /> {formatDate(file.uploaded_at)}
                    <HardDrive size={12} /> {formatSize(file.file_size)}
                  </span>
                </div>
                <div className="cloud-file-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenInApp(file); }}
                    disabled={actionLoading === file.id || !isOnline}
                    title="Open in App"
                    className="primary"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                    disabled={actionLoading === file.id || !isOnline}
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartRename(file); }}
                    disabled={actionLoading === file.id || !isOnline}
                    title="Rename"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                    disabled={actionLoading === file.id || !isOnline}
                    title="Delete"
                    className="danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CloudFileBrowser;
