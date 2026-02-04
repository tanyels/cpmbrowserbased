const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  getLastFilePath: () => ipcRenderer.invoke('get-last-file-path'),
  setLastFilePath: (filePath) => ipcRenderer.invoke('set-last-file-path', filePath),
  getTemplatePath: () => ipcRenderer.invoke('get-template-path'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),

  // Strategy Cascade file operations
  readStrategyFile: (filePath) => ipcRenderer.invoke('read-strategy-file', filePath),
  saveStrategyFile: (filePath, data) => ipcRenderer.invoke('save-strategy-file', { filePath, data }),
  createNewStrategyFile: (filePath) => ipcRenderer.invoke('create-new-strategy-file', filePath),
  generateSampleFile: (filePath) => ipcRenderer.invoke('generate-sample-file', filePath),

  // Dialogs
  showConfirmDialog: (title, message) => ipcRenderer.invoke('show-confirm-dialog', { title, message }),
  showUnsavedWarning: () => ipcRenderer.invoke('show-unsaved-warning'),

  // License management
  license: {
    getState: () => ipcRenderer.invoke('license:get-state'),
    getData: () => ipcRenderer.invoke('license:get-data'),
    activate: (licenseKey, companyInfo) => ipcRenderer.invoke('license:activate', licenseKey, companyInfo),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    startTrial: () => ipcRenderer.invoke('license:start-trial'),
    getTrialStatus: () => ipcRenderer.invoke('license:get-trial-status'),
    getLimits: () => ipcRenderer.invoke('license:get-limits'),
    validate: () => ipcRenderer.invoke('license:validate'),
    clear: () => ipcRenderer.invoke('license:clear'),
    getConfig: () => ipcRenderer.invoke('license:get-config'),
    getCompanyLogo: () => ipcRenderer.invoke('license:get-company-logo')
  },

  // Cloud storage management (key-based access)
  cloud: {
    // Key management
    isConfigured: () => ipcRenderer.invoke('cloud:is-configured'),
    validateKey: (accessKey) => ipcRenderer.invoke('cloud:validate-key', accessKey),
    getKeyStatus: () => ipcRenderer.invoke('cloud:get-key-status'),
    clearKey: () => ipcRenderer.invoke('cloud:clear-key'),

    // Storage
    convertAndUpload: (xlsxPath) => ipcRenderer.invoke('cloud:convert-and-upload', xlsxPath),
    uploadFile: (localPath, displayName) => ipcRenderer.invoke('cloud:upload-file', localPath, displayName),
    updateFile: (localPath, storagePath) => ipcRenderer.invoke('cloud:update-file', localPath, storagePath),
    downloadFile: (storagePath, localDestination) => ipcRenderer.invoke('cloud:download-file', storagePath, localDestination),
    downloadAndOpen: (storagePath, displayName) => ipcRenderer.invoke('cloud:download-and-open', storagePath, displayName),
    listFiles: () => ipcRenderer.invoke('cloud:list-files'),
    deleteFile: (storagePath) => ipcRenderer.invoke('cloud:delete-file', storagePath),
    renameFile: (storagePath, newName) => ipcRenderer.invoke('cloud:rename-file', storagePath, newName)
  }
});
