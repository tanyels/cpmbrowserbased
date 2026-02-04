import React, { useState, useEffect, useRef } from 'react';
import { useCloud } from '../contexts/CloudContext';
import { useStrategy } from '../contexts/StrategyContext';
import { fileService } from '../services/fileService';
import { cryptoService } from '../services/cryptoService';
import {
  Cloud, Upload, Download, Trash2, RefreshCw,
  FileText, Clock, HardDrive, AlertCircle, Check,
  Key, Loader, Edit2, X, FolderOpen, LogOut, ExternalLink
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

  const { filePath, hasUnsavedChanges, saveFile, loadFromBuffer, markAsFromCloud } = useStrategy();

  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [newName, setNewName] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [localError, setLocalError] = useState('');

  const fileInputRef = useRef(null);

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
    const cleaned = value.replace(/-/g, '');
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

  // Handle file upload from current session
  const handleUploadCurrent = async () => {
    if (!filePath) {
      setLocalError('No file is currently open');
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
      // Get the current file buffer from saveFile
      const result = await saveFile();
      if (!result.success || !result.buffer) {
        throw new Error(result.error || 'Failed to save file');
      }

      const displayName = filePath.replace(/\.cpme$/, '');
      await uploadFile(result.buffer, displayName);
      setSuccessMessage('File uploaded successfully!');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle file selection from input
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading('upload');
    clearError();

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Check if it's a .cpme file (already encrypted)
      if (file.name.endsWith('.cpme')) {
        // Upload directly
        const displayName = file.name.replace(/\.cpme$/, '');
        await uploadFile(arrayBuffer, displayName);
        setSuccessMessage('File uploaded successfully!');
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Need to encrypt first - this is complex, skip for now
        setLocalError('Please upload .cpme files only. Use the app to create and save strategy files.');
      } else {
        setLocalError('Please select a .cpme file');
      }
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Download file to browser
  const handleDownload = async (file) => {
    setActionLoading(file.id);
    clearError();

    try {
      const arrayBuffer = await downloadFile(file.storage_path);

      // Create blob and download
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.display_name}.cpme`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage(`Downloaded: ${file.display_name}`);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Open file in app
  const handleOpenInApp = async (file) => {
    setActionLoading(file.id);
    clearError();

    try {
      // Download the encrypted file
      const arrayBuffer = await downloadFile(file.storage_path);

      // Load into the app
      const result = await loadFromBuffer(arrayBuffer, file.display_name, file.storage_path);

      if (result.success) {
        setSuccessMessage(`Opened: ${file.display_name}`);
        if (onFileOpened) {
          onFileOpened(file.display_name);
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
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".cpme"
        onChange={handleFileSelect}
      />

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
        <p className="cloud-upload-hint">
          {filePath
            ? `Current file: ${filePath}`
            : 'Create a new strategy or select a .cpme file to upload'
          }
        </p>
        <div className="cloud-upload-buttons">
          <button
            className="btn btn-primary"
            onClick={handleUploadCurrent}
            disabled={!filePath || uploading || actionLoading || !isOnline}
          >
            {uploading || actionLoading === 'upload' ? (
              <><Loader size={16} className="spinner" /> Uploading...</>
            ) : (
              <><Upload size={16} /> Upload Current File</>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || actionLoading || !isOnline}
          >
            <Upload size={16} /> Upload .cpme File
          </button>
        </div>
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
            <p className="hint">Create a new strategy and save it to the cloud</p>
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
