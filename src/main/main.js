const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store');
const ExcelJS = require('exceljs');
const { licenseService, LICENSE_STATE, LICENSE_CONFIG } = require('./licenseService');

const store = new Store();

let mainWindow;

// Get bundled template path
function getTemplatePath() {
  return path.join(__dirname, 'templates', 'SAMPLE_KPI_SHEET.xlsm');
}

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1400,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate unique ID
function generateId(prefix = 'ID') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

// Read sheet data as array of objects
function readSheetData(worksheet) {
  if (!worksheet || worksheet.rowCount === 0) return [];

  const headers = [];
  const data = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
      });
    } else {
      const rowData = {};
      let hasData = false;
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header && cell.value !== null && cell.value !== undefined) {
          rowData[header] = cell.value;
          hasData = true;
        }
      });
      if (hasData) {
        data.push(rowData);
      }
    }
  });

  return data;
}

// Write data to sheet - completely replaces sheet content
function writeSheetData(worksheet, data, headers) {
  // Clear ALL existing rows by removing them from the end to the beginning
  const rowCount = worksheet.rowCount || 0;
  if (rowCount > 0) {
    for (let i = rowCount; i >= 1; i--) {
      worksheet.spliceRows(i, 1);
    }
  }

  // Write headers as first row
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  // Write data rows
  data.forEach(item => {
    const rowValues = headers.map(h => item[h] ?? '');
    worksheet.addRow(rowValues);
  });

  // Auto-width columns
  headers.forEach((_, index) => {
    worksheet.getColumn(index + 1).width = 20;
  });
}

// Create default Operational objectives for each level
function createOperationalObjectives(businessUnits) {
  const operational = [];
  const levels = ['L1', 'L2', 'L3'];

  levels.forEach(level => {
    const levelBUs = businessUnits.filter(bu => bu.Level === level);
    levelBUs.forEach(bu => {
      operational.push({
        Code: `OBJ_${level}_OPERATIONAL_${bu.Code}`,
        Name: 'Operational',
        Name_AR: 'تشغيلي',
        Level: level,
        Business_Unit: bu.Code,
        Parent_Objective: level === 'L1' ? '' : `OBJ_${level === 'L2' ? 'L1' : 'L2'}_OPERATIONAL_${bu.Parent_Code || 'CORP'}`,
        Pillar_Code: '',
        Perspective: '',
        Weight: 0,
        Status: 'Active',
        Is_Operational: true
      });
    });
  });

  return operational;
}

// ============================================
// ENCRYPTION HELPERS (AES-256-GCM)
// ============================================

// Derive encryption key from license (licenseKey + companyName)
function getEncryptionKey() {
  const data = licenseService.getLicenseData();
  if (!data.licenseKey || !data.companyName) {
    throw new Error('Valid license required for encrypted files');
  }
  return crypto.createHash('sha256')
    .update(`${data.licenseKey}:${data.companyName}`)
    .digest();
}

// Encrypt buffer using AES-256-GCM
function encryptBuffer(buffer) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Format: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

// Decrypt buffer using AES-256-GCM
function decryptBuffer(encryptedData) {
  const key = getEncryptionKey();

  const iv = encryptedData.slice(0, 12);
  const authTag = encryptedData.slice(12, 28);
  const ciphertext = encryptedData.slice(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
}

// ============================================
// IPC HANDLERS - FILE OPERATIONS
// ============================================

ipcMain.handle('get-last-file-path', () => {
  return store.get('lastFilePath', null);
});

ipcMain.handle('set-last-file-path', (event, filePath) => {
  store.set('lastFilePath', filePath);
  return true;
});

ipcMain.handle('get-template-path', () => {
  return getTemplatePath();
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CPM Files', extensions: ['cpme', 'xlsx', 'xls', 'xlsm'] },
      { name: 'Encrypted CPM Files', extensions: ['cpme'] },
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('save-file-dialog', async (event, options) => {
  // Support both old string format and new object format
  // Old: saveFileDialog('filename')
  // New: saveFileDialog({ name: 'filename', type: 'xlsx' }) for xlsx-only dialogs
  let defaultName, preferXlsx;
  if (typeof options === 'object' && options !== null) {
    defaultName = options.name;
    preferXlsx = options.type === 'xlsx';
  } else {
    defaultName = options;
    preferXlsx = false;
  }

  // Strip any existing extension
  let baseName = defaultName || 'Strategy_Cascade';
  baseName = baseName.replace(/\.(xlsx|xls|xlsm|cpme)$/i, '');

  let dialogOptions;
  if (preferXlsx) {
    // Excel-only dialog (for exports like KPI cards)
    dialogOptions = {
      defaultPath: baseName + '.xlsx',
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ]
    };
  } else {
    // Default: encrypted file dialog with both options
    dialogOptions = {
      defaultPath: baseName + '.cpme',
      filters: [
        { name: 'Encrypted CPM File', extensions: ['cpme'] },
        { name: 'Excel File (Unencrypted)', extensions: ['xlsx'] }
      ]
    };
  }

  const result = await dialog.showSaveDialog(mainWindow, dialogOptions);

  if (!result.canceled) {
    let filePath = result.filePath;

    // Normalize extension handling for cross-platform compatibility
    // Windows and macOS handle filter extensions differently

    // First, clean up any double/multiple extensions
    // e.g., "file.cpme.xlsx" -> "file.xlsx", "file.cpme.cpme" -> "file.cpme"
    const multiExtRegex = /(\.(xlsx|xls|xlsm|cpme))+$/i;
    const extMatches = filePath.match(multiExtRegex);

    if (extMatches) {
      // Get all extensions found
      const allExts = extMatches[0].toLowerCase();
      // Get the base path without any of these extensions
      const basePathClean = filePath.slice(0, -extMatches[0].length);

      // Determine final extension based on what's present and preference
      let finalExt;
      if (allExts.includes('.xlsx') || allExts.includes('.xls') || allExts.includes('.xlsm')) {
        // User selected xlsx filter at some point
        finalExt = '.xlsx';
      } else {
        finalExt = '.cpme';
      }

      filePath = basePathClean + finalExt;
    } else {
      // No recognized extension - add default
      filePath = filePath + (preferXlsx ? '.xlsx' : '.cpme');
    }

    return filePath;
  }
  return null;
});

// ============================================
// IPC HANDLERS - READ STRATEGY CASCADE FILE
// ============================================

ipcMain.handle('read-strategy-file', async (event, filePath) => {
  try {
    console.log('=== MAIN PROCESS READ CALLED ===');
    console.log('MAIN READ - filePath:', filePath);
    const workbook = new ExcelJS.Workbook();

    if (filePath.endsWith('.cpme')) {
      // Encrypted file - decrypt first
      console.log('MAIN READ - Decrypting encrypted .cpme file');
      try {
        const encryptedData = fs.readFileSync(filePath);
        const decryptedBuffer = decryptBuffer(encryptedData);
        await workbook.xlsx.load(decryptedBuffer);
      } catch (decryptError) {
        console.error('Decryption error:', decryptError);
        // Handle decryption errors (wrong license)
        if (decryptError.message.includes('Unsupported state') ||
            decryptError.message.includes('auth tag') ||
            decryptError.message.includes('Invalid') ||
            decryptError.message.includes('Valid license required')) {
          return {
            success: false,
            error: 'Cannot decrypt file. This file was created with a different license or your license is not active.'
          };
        }
        throw decryptError;
      }
    } else {
      // Plain Excel file
      await workbook.xlsx.readFile(filePath);
    }
    console.log('MAIN READ - workbook loaded, sheets:', workbook.worksheets.map(ws => ws.name));

    // Initialize data structure
    const data = {
      vision: { Statement: '', Statement_AR: '' },
      mission: { Statement: '', Statement_AR: '' },
      pillars: [],
      perspectives: [],
      objectives: [],
      businessUnits: [],
      kpis: [],
      objectiveLinks: [],
      mapPositions: {},
      globalValues: [],
      measures: [],
      parameterValues: {},
      calculatedValues: {},
      achievements: {},
      // Team Members data
      teamMembers: [],
      personalObjectives: [],
      employeeKpis: [],
      employeeAchievements: {},
      settings: {}
    };

    // Helper to safely parse JSON
    const safeJsonParse = (str, defaultValue) => {
      if (!str) return defaultValue;
      try {
        return JSON.parse(str);
      } catch (e) {
        console.warn('Failed to parse JSON:', str, e);
        return defaultValue;
      }
    };

    // Read Vision sheet
    const visionSheet = workbook.getWorksheet('Vision');
    if (visionSheet) {
      const visionData = readSheetData(visionSheet);
      if (visionData.length > 0) {
        data.vision = {
          Statement: visionData[0].Statement || visionData[0].Vision || visionData[0].Text || '',
          Statement_AR: visionData[0].Statement_AR || ''
        };
      }
    }

    // Read Mission sheet
    const missionSheet = workbook.getWorksheet('Mission');
    if (missionSheet) {
      const missionData = readSheetData(missionSheet);
      if (missionData.length > 0) {
        data.mission = {
          Statement: missionData[0].Statement || missionData[0].Mission || missionData[0].Text || '',
          Statement_AR: missionData[0].Statement_AR || ''
        };
      }
    }

    // Read Strategic Pillars
    const pillarsSheet = workbook.getWorksheet('Strategic_Pillars');
    if (pillarsSheet) {
      data.pillars = readSheetData(pillarsSheet).map(p => ({
        Code: p.Code || generateId('PIL'),
        Name: p.Name || '',
        Name_AR: p.Name_AR || '',
        Description: p.Description || '',
        Weight: p.Weight || 0,
        Status: p.Status || 'Active',
        Color: p.Color || ''
      }));
    }

    // Read Perspectives (optional)
    const perspectivesSheet = workbook.getWorksheet('Perspectives');
    if (perspectivesSheet) {
      data.perspectives = readSheetData(perspectivesSheet).map(p => ({
        Code: p.Code || generateId('PER'),
        Name: p.Name || '',
        Name_AR: p.Name_AR || '',
        Status: p.Status || 'Active'
      }));
    }

    // Read Business Units
    const buSheet = workbook.getWorksheet('Business_Units');
    if (buSheet) {
      data.businessUnits = readSheetData(buSheet).map(bu => ({
        Code: bu.Code || `BU_${bu.Abbreviation || 'NEW'}`,
        Name: bu.Name || '',
        Name_AR: bu.Name_AR || '',
        Abbreviation: bu.Abbreviation || '',
        Level: bu.Level || 'L1',
        Parent_Code: bu.Parent_Code || '',
        Status: bu.Status || 'Active'
      }));
    }

    // Read Objectives
    const objectivesSheet = workbook.getWorksheet('Objectives');
    if (objectivesSheet) {
      data.objectives = readSheetData(objectivesSheet).map(obj => ({
        Code: obj.Code || generateId('OBJ'),
        Name: obj.Name || '',
        Name_AR: obj.Name_AR || '',
        Description: obj.Description || '',
        Level: obj.Level || 'L1',
        Business_Unit_Code: obj.Business_Unit || obj.Business_Unit_Code || '',
        Parent_Objective_Code: obj.Parent_Objective || obj.Parent_Objective_Code || '',
        Pillar_Code: obj.Pillar_Code || '',
        Perspective_Code: obj.Perspective || obj.Perspective_Code || '',
        Weight: obj.Weight || 0,
        Status: obj.Status || 'Active',
        Is_Operational: obj.Is_Operational === true || obj.Is_Operational === 'true' || obj.Name === 'Operational'
      }));
    }

    // Read KPIs
    const kpisSheet = workbook.getWorksheet('KPIs');
    if (kpisSheet) {
      data.kpis = readSheetData(kpisSheet).map(kpi => ({
        _id: kpi._id || generateId('KPI'),
        Code: kpi.Code || kpi['KPI Code'] || generateId('KPI'),
        Name: kpi.Name || kpi['KPI Name (English)'] || '',
        Name_AR: kpi.Name_AR || kpi['KPI Name (Arabic)'] || '',
        Description: kpi.Description || kpi['KPI Description (English)'] || '',
        Description_AR: kpi.Description_AR || '',
        Level: kpi.Level || '',  // Level is derived from objective, but can be stored directly
        Objective_Code: kpi.Objective_Code || '',
        Business_Unit_Code: kpi.Business_Unit || kpi.Business_Unit_Code || '',
        Impact_Type: kpi.Impact_Type || 'Direct',
        Indicator_Type: kpi.Indicator_Type || 'Lagging',
        Approval_Status: kpi.Approval_Status || 'Recommended',
        Formula: kpi.Formula || '',
        Data_Points: kpi.Data_Points || kpi['Data Points'] || '',
        Target: kpi.Target || '',
        Target_Mode: kpi.Target_Mode || 'single',
        Monthly_Targets: safeJsonParse(kpi.Monthly_Targets, {}),
        Unit: kpi.Unit || '',
        Weight: kpi.Weight || 0,
        Polarity: kpi.Polarity || 'Positive',
        Status: kpi.Status || 'Active',
        Review_Status: kpi.Review_Status || 'Pending',
        Discussion: kpi.Discussion || ''
      }));
    }

    // Read Objective Links
    const linksSheet = workbook.getWorksheet('Objective_Links');
    if (linksSheet) {
      data.objectiveLinks = readSheetData(linksSheet).map(link => ({
        From_Code: link.From_Code || '',
        To_Code: link.To_Code || '',
        From_Side: link.From_Side || null,
        To_Side: link.To_Side || null,
        Waypoints: link.Waypoints || ''
      }));
    }

    // Read Map Layout (objective positions and sizes)
    const mapLayoutSheet = workbook.getWorksheet('Map_Layout');
    if (mapLayoutSheet) {
      const mapData = readSheetData(mapLayoutSheet);
      data.mapPositions = {};
      mapData.forEach(row => {
        if (row.Objective_Code) {
          data.mapPositions[row.Objective_Code] = {
            x: parseFloat(row.X) || 0,
            y: parseFloat(row.Y) || 0,
            width: row.Width ? parseFloat(row.Width) : undefined,
            height: row.Height ? parseFloat(row.Height) : undefined
          };
        }
      });
    }

    // Read Global Values sheet
    const globalValuesSheet = workbook.getWorksheet('Global_Values');
    if (globalValuesSheet) {
      data.globalValues = readSheetData(globalValuesSheet).map(gv => ({
        Code: gv.Code || '',
        Name: gv.Name || '',
        Name_AR: gv.Name_AR || '',
        Type: gv.Type || 'number',
        Description: gv.Description || '',
        Monthly_Values: safeJsonParse(gv.Monthly_Values, {})
      }));
    }

    // Read Measures sheet
    const measuresSheet = workbook.getWorksheet('Measures');
    if (measuresSheet) {
      data.measures = readSheetData(measuresSheet).map(m => ({
        Code: m.Code || '',
        Name: m.Name || '',
        KPI_Code: m.KPI_Code || '',
        Formula_Elements: safeJsonParse(m.Formula_Elements, []),
        Formula_Text: m.Formula_Text || '',
        Parameters: safeJsonParse(m.Parameters, []),
        Last_Value: m.Last_Value || null,
        Last_Calculated: m.Last_Calculated || null,
        Status: m.Status || 'Active',
        Created_At: m.Created_At || null
      }));
    }

    // Read Parameter Values sheet
    const paramValuesSheet = workbook.getWorksheet('Parameter_Values');
    if (paramValuesSheet) {
      const paramData = readSheetData(paramValuesSheet);
      data.parameterValues = {};
      paramData.forEach(row => {
        if (row.Measure_Code && row.Parameter_Name && row.Month_Key) {
          if (!data.parameterValues[row.Measure_Code]) {
            data.parameterValues[row.Measure_Code] = {};
          }
          if (!data.parameterValues[row.Measure_Code][row.Parameter_Name]) {
            data.parameterValues[row.Measure_Code][row.Parameter_Name] = {};
          }
          data.parameterValues[row.Measure_Code][row.Parameter_Name][row.Month_Key] = parseFloat(row.Value);
        }
      });
    }

    // Read Calculated Values sheet
    const calcValuesSheet = workbook.getWorksheet('Calculated_Values');
    if (calcValuesSheet) {
      const calcData = readSheetData(calcValuesSheet);
      data.calculatedValues = {};
      calcData.forEach(row => {
        if (row.Measure_Code && row.Month_Key) {
          if (!data.calculatedValues[row.Measure_Code]) {
            data.calculatedValues[row.Measure_Code] = {};
          }
          data.calculatedValues[row.Measure_Code][row.Month_Key] = {
            value: parseFloat(row.Value),
            error: row.Error || null
          };
        }
      });
    }

    // Read Achievements sheet
    const achievementsSheet = workbook.getWorksheet('Achievements');
    if (achievementsSheet) {
      const achieveData = readSheetData(achievementsSheet);
      data.achievements = {};
      achieveData.forEach(row => {
        if (row.Measure_Code && row.Month_Key) {
          if (!data.achievements[row.Measure_Code]) {
            data.achievements[row.Measure_Code] = {};
          }
          data.achievements[row.Measure_Code][row.Month_Key] = parseFloat(row.Achievement);
        }
      });
    }

    // Read Settings sheet
    const settingsSheet = workbook.getWorksheet('Settings');
    if (settingsSheet) {
      const settingsData = readSheetData(settingsSheet);
      data.settings = {};
      settingsData.forEach(row => {
        if (row.Key) {
          let value = row.Value;
          // Try to parse as number
          if (!isNaN(parseFloat(value)) && isFinite(value)) {
            value = parseFloat(value);
          }
          // Try to parse as JSON (for objects/arrays)
          else if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if JSON parse fails
            }
          }
          data.settings[row.Key] = value;
        }
      });
    }

    // Read Team Members sheet
    const teamMembersSheet = workbook.getWorksheet('Team_Members');
    console.log('READ - Team_Members sheet exists:', !!teamMembersSheet);
    if (teamMembersSheet) {
      const rawTeamData = readSheetData(teamMembersSheet);
      console.log('READ - Raw team members count:', rawTeamData.length);
      console.log('READ - Raw team members:', JSON.stringify(rawTeamData));
      data.teamMembers = rawTeamData.map(tm => ({
        Code: tm.Code || '',
        Employee_ID: tm.Employee_ID || '',
        Name: tm.Name || '',
        Name_AR: tm.Name_AR || '',
        Job_Title: tm.Job_Title || '',
        Job_Title_AR: tm.Job_Title_AR || '',
        Email: tm.Email || '',
        Photo_URL: tm.Photo_URL || '',
        Hire_Date: tm.Hire_Date || '',
        Reports_To: tm.Reports_To || '',
        Business_Unit_Code: tm.Business_Unit_Code || '',
        Status: tm.Status || 'Active'
      }));
    }

    // Read Personal Objectives sheet
    const personalObjSheet = workbook.getWorksheet('Personal_Objectives');
    if (personalObjSheet) {
      data.personalObjectives = readSheetData(personalObjSheet).map(obj => ({
        Code: obj.Code || '',
        Name: obj.Name || '',
        Name_AR: obj.Name_AR || '',
        Description: obj.Description || '',
        Employee_Code: obj.Employee_Code || '',
        Parent_Objective_Code: obj.Parent_Objective_Code || '',
        Weight: obj.Weight || 0,
        Target_Date: obj.Target_Date || '',
        Status: obj.Status || 'Active'
      }));
    }

    // Read Employee KPIs sheet
    const employeeKpisSheet = workbook.getWorksheet('Employee_KPIs');
    if (employeeKpisSheet) {
      data.employeeKpis = readSheetData(employeeKpisSheet).map(kpi => ({
        Code: kpi.Code || '',
        Name: kpi.Name || '',
        Name_AR: kpi.Name_AR || '',
        Description: kpi.Description || '',
        Employee_Code: kpi.Employee_Code || '',
        Personal_Objective_Code: kpi.Personal_Objective_Code || '',
        Formula: kpi.Formula || '',
        Data_Points: kpi.Data_Points || '',
        Target: kpi.Target || '',
        Target_Mode: kpi.Target_Mode || 'single',
        Monthly_Targets: safeJsonParse(kpi.Monthly_Targets, {}),
        Unit: kpi.Unit || '',
        Weight: kpi.Weight || 0,
        Polarity: kpi.Polarity || 'Positive',
        Status: kpi.Status || 'Active'
      }));
    }

    // Read Employee Achievements sheet
    const empAchievementsSheet = workbook.getWorksheet('Employee_Achievements');
    if (empAchievementsSheet) {
      const empAchieveData = readSheetData(empAchievementsSheet);
      data.employeeAchievements = {};
      empAchieveData.forEach(row => {
        if (row.Employee_KPI_Code && row.Month_Key) {
          if (!data.employeeAchievements[row.Employee_KPI_Code]) {
            data.employeeAchievements[row.Employee_KPI_Code] = {};
          }
          // Store as { actual, achievement } structure
          data.employeeAchievements[row.Employee_KPI_Code][row.Month_Key] = {
            actual: row.Actual !== undefined && row.Actual !== '' ? parseFloat(row.Actual) : null,
            achievement: row.Achievement !== undefined && row.Achievement !== '' ? parseFloat(row.Achievement) : null
          };
        }
      });
    }

    // BU Scorecard Config (nested structure: { buCode: { parentObjCode: weight } })
    const buScorecardConfigSheet = workbook.getWorksheet('BU_Scorecard_Config');
    data.buScorecardConfig = {};
    if (buScorecardConfigSheet) {
      const configData = readSheetData(buScorecardConfigSheet);
      configData.forEach(row => {
        if (row.BU_Code && row.Parent_Objective_Code) {
          if (!data.buScorecardConfig[row.BU_Code]) {
            data.buScorecardConfig[row.BU_Code] = {};
          }
          data.buScorecardConfig[row.BU_Code][row.Parent_Objective_Code] = parseFloat(row.Weight) || 0;
        }
      });
    }

    // Ensure Operational objectives exist for all Business Units
    const existingOperational = data.objectives.filter(o => o.Is_Operational);
    const operationalBUs = new Set(existingOperational.map(o => `${o.Level}_${o.Business_Unit_Code}`));

    data.businessUnits.forEach(bu => {
      const key = `${bu.Level}_${bu.Code}`;
      if (!operationalBUs.has(key)) {
        data.objectives.push({
          Code: `OBJ_${bu.Level}_OPERATIONAL_${bu.Code}`,
          Name: 'Operational',
          Name_AR: 'تشغيلي',
          Description: 'Operational objective for non-strategic KPIs',
          Level: bu.Level,
          Business_Unit_Code: bu.Code,
          Parent_Objective_Code: '',
          Pillar_Code: '',
          Perspective_Code: '',
          Weight: 0,
          Status: 'Active',
          Is_Operational: true
        });
      }
    });

    console.log('=== MAIN READ RETURNING DATA ===');
    console.log('MAIN READ RETURN - teamMembers count:', data.teamMembers.length);
    console.log('MAIN READ RETURN - teamMembers:', JSON.stringify(data.teamMembers));
    console.log('MAIN READ RETURN - personalObjectives count:', data.personalObjectives.length);
    console.log('MAIN READ RETURN - employeeKpis count:', data.employeeKpis.length);
    return { success: true, data };
  } catch (error) {
    console.error('Error reading strategy file:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC HANDLERS - SAVE STRATEGY CASCADE FILE
// ============================================

ipcMain.handle('save-strategy-file', async (event, { filePath, data }) => {
  try {
    console.log('=== MAIN PROCESS SAVE CALLED ===');
    console.log('MAIN SAVE - filePath:', filePath);
    console.log('MAIN SAVE - data keys:', Object.keys(data || {}));
    console.log('MAIN SAVE - data.teamMembers:', data?.teamMembers);
    console.log('MAIN SAVE - teamMembers count:', (data?.teamMembers || []).length);
    console.log('MAIN SAVE - personalObjectives count:', (data?.personalObjectives || []).length);
    console.log('MAIN SAVE - employeeKpis count:', (data?.employeeKpis || []).length);

    // Create a fresh workbook - don't try to read existing file
    // This ensures clean sheets without duplicate data
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPM Strategy Cascade Tool';
    workbook.created = new Date();

    // Helper function to create a fresh sheet with data
    const createSheet = (name, sheetData, headers) => {
      const sheet = workbook.addWorksheet(name);

      // Write headers as first row
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Write data rows
      sheetData.forEach(item => {
        const rowValues = headers.map(h => item[h] ?? '');
        sheet.addRow(rowValues);
      });

      // Auto-width columns
      headers.forEach((_, index) => {
        sheet.getColumn(index + 1).width = 20;
      });

      return sheet;
    };

    // Vision sheet
    const visionData = typeof data.vision === 'object'
      ? [{ Statement: data.vision.Statement || '', Statement_AR: data.vision.Statement_AR || '', Year: new Date().getFullYear() }]
      : [{ Statement: data.vision || '', Statement_AR: '', Year: new Date().getFullYear() }];
    createSheet('Vision', visionData, ['Statement', 'Statement_AR', 'Year']);

    // Mission sheet
    const missionData = typeof data.mission === 'object'
      ? [{ Statement: data.mission.Statement || '', Statement_AR: data.mission.Statement_AR || '', Year: new Date().getFullYear() }]
      : [{ Statement: data.mission || '', Statement_AR: '', Year: new Date().getFullYear() }];
    createSheet('Mission', missionData, ['Statement', 'Statement_AR', 'Year']);

    // Strategic Pillars sheet
    createSheet('Strategic_Pillars', data.pillars || [], ['Code', 'Name', 'Name_AR', 'Description', 'Weight', 'Status', 'Color']);

    // Perspectives sheet
    createSheet('Perspectives', data.perspectives || [], ['Code', 'Name', 'Name_AR', 'Status']);

    // Business Units sheet
    createSheet('Business_Units', data.businessUnits || [], ['Code', 'Name', 'Name_AR', 'Abbreviation', 'Level', 'Parent_Code', 'Status']);

    // Objectives sheet - map frontend field names to Excel column names
    const objectivesForExcel = (data.objectives || []).map(obj => ({
      ...obj,
      Business_Unit: obj.Business_Unit_Code || obj.Business_Unit || '',
      Parent_Objective: obj.Parent_Objective_Code || obj.Parent_Objective || '',
      Perspective: obj.Perspective_Code || obj.Perspective || ''
    }));
    createSheet('Objectives', objectivesForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Level', 'Business_Unit',
      'Parent_Objective', 'Pillar_Code', 'Perspective', 'Weight', 'Status', 'Is_Operational'
    ]);

    // KPIs sheet - map frontend field names to Excel column names
    // Derive Level from the linked objective
    const kpisForExcel = (data.kpis || []).map(kpi => {
      const objective = (data.objectives || []).find(obj => obj.Code === kpi.Objective_Code);
      return {
        ...kpi,
        Level: objective?.Level || kpi.Level || '',
        Business_Unit: kpi.Business_Unit_Code || kpi.Business_Unit || '',
        Monthly_Targets: JSON.stringify(kpi.Monthly_Targets || {})
      };
    });
    createSheet('KPIs', kpisForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Description_AR', 'Level', 'Objective_Code', 'Business_Unit',
      'Impact_Type', 'Indicator_Type', 'Approval_Status', 'Formula', 'Data_Points', 'Target', 'Target_Mode', 'Monthly_Targets', 'Unit', 'Weight', 'Status', 'Review_Status', 'Discussion', 'Polarity'
    ]);

    // Objective Links sheet
    createSheet('Objective_Links', data.objectiveLinks || [], ['From_Code', 'To_Code', 'From_Side', 'To_Side', 'Waypoints']);

    // Map Layout sheet (objective positions and sizes)
    const mapLayoutData = Object.entries(data.mapPositions || {}).map(([code, pos]) => ({
      Objective_Code: code,
      X: pos.x,
      Y: pos.y,
      Width: pos.width || '',
      Height: pos.height || ''
    }));
    createSheet('Map_Layout', mapLayoutData, ['Objective_Code', 'X', 'Y', 'Width', 'Height']);

    // Global Values sheet
    const globalValuesForExcel = (data.globalValues || []).map(gv => ({
      ...gv,
      Monthly_Values: JSON.stringify(gv.Monthly_Values || {})
    }));
    createSheet('Global_Values', globalValuesForExcel, ['Code', 'Name', 'Name_AR', 'Type', 'Description', 'Monthly_Values']);

    // Measures sheet
    const measuresForExcel = (data.measures || []).map(m => ({
      ...m,
      Formula_Elements: JSON.stringify(m.Formula_Elements || []),
      Parameters: JSON.stringify(m.Parameters || [])
    }));
    createSheet('Measures', measuresForExcel, ['Code', 'Name', 'KPI_Code', 'Formula_Elements', 'Formula_Text', 'Parameters', 'Last_Value', 'Last_Calculated', 'Status', 'Created_At']);

    // Parameter Values sheet (flatten the nested structure)
    const parameterValuesData = [];
    Object.entries(data.parameterValues || {}).forEach(([measureCode, params]) => {
      Object.entries(params || {}).forEach(([paramName, months]) => {
        Object.entries(months || {}).forEach(([monthKey, value]) => {
          if (value !== null && value !== undefined) {
            parameterValuesData.push({
              Measure_Code: measureCode,
              Parameter_Name: paramName,
              Month_Key: monthKey,
              Value: value
            });
          }
        });
      });
    });
    createSheet('Parameter_Values', parameterValuesData, ['Measure_Code', 'Parameter_Name', 'Month_Key', 'Value']);

    // Calculated Values sheet (flatten the nested structure)
    const calculatedValuesData = [];
    Object.entries(data.calculatedValues || {}).forEach(([measureCode, months]) => {
      Object.entries(months || {}).forEach(([monthKey, result]) => {
        if (result && result.value !== null && result.value !== undefined) {
          calculatedValuesData.push({
            Measure_Code: measureCode,
            Month_Key: monthKey,
            Value: result.value,
            Error: result.error || ''
          });
        }
      });
    });
    createSheet('Calculated_Values', calculatedValuesData, ['Measure_Code', 'Month_Key', 'Value', 'Error']);

    // Achievements sheet (flatten the nested structure)
    const achievementsData = [];
    Object.entries(data.achievements || {}).forEach(([measureCode, months]) => {
      Object.entries(months || {}).forEach(([monthKey, value]) => {
        if (value !== null && value !== undefined) {
          achievementsData.push({
            Measure_Code: measureCode,
            Month_Key: monthKey,
            Achievement: value
          });
        }
      });
    });
    createSheet('Achievements', achievementsData, ['Measure_Code', 'Month_Key', 'Achievement']);

    // Team Members sheet
    console.log('SAVE - Team Members count:', (data.teamMembers || []).length);
    console.log('SAVE - Team Members data:', JSON.stringify(data.teamMembers || []));
    createSheet('Team_Members', data.teamMembers || [], [
      'Code', 'Employee_ID', 'Name', 'Name_AR', 'Job_Title', 'Job_Title_AR',
      'Email', 'Photo_URL', 'Hire_Date', 'Reports_To', 'Business_Unit_Code', 'Status'
    ]);

    // Personal Objectives sheet
    createSheet('Personal_Objectives', data.personalObjectives || [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code',
      'Parent_Objective_Code', 'Weight', 'Target_Date', 'Status'
    ]);

    // Employee KPIs sheet
    const employeeKpisForExcel = (data.employeeKpis || []).map(kpi => ({
      ...kpi,
      Monthly_Targets: JSON.stringify(kpi.Monthly_Targets || {})
    }));
    createSheet('Employee_KPIs', employeeKpisForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code', 'Personal_Objective_Code',
      'Formula', 'Data_Points', 'Target', 'Target_Mode', 'Monthly_Targets', 'Unit', 'Weight', 'Polarity', 'Status'
    ]);

    // Employee Achievements sheet (flatten the nested structure)
    const employeeAchievementsData = [];
    Object.entries(data.employeeAchievements || {}).forEach(([kpiCode, months]) => {
      Object.entries(months || {}).forEach(([monthKey, value]) => {
        if (value !== null && value !== undefined) {
          // Handle both old format (just number) and new format ({ actual, achievement })
          const actual = typeof value === 'object' ? value.actual : null;
          const achievement = typeof value === 'object' ? value.achievement : value;
          employeeAchievementsData.push({
            Employee_KPI_Code: kpiCode,
            Month_Key: monthKey,
            Actual: actual,
            Achievement: achievement
          });
        }
      });
    });
    createSheet('Employee_Achievements', employeeAchievementsData, ['Employee_KPI_Code', 'Month_Key', 'Actual', 'Achievement']);

    // Settings sheet (key-value pairs)
    const settingsData = Object.entries(data.settings || {}).map(([key, value]) => ({
      Key: key,
      Value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
    createSheet('Settings', settingsData, ['Key', 'Value']);

    // BU Scorecard Config sheet (flatten the nested structure)
    // Format: { buCode: { parentObjCode: weight, ... }, ... }
    const buScorecardConfigData = [];
    Object.entries(data.buScorecardConfig || {}).forEach(([buCode, parentWeights]) => {
      Object.entries(parentWeights || {}).forEach(([parentObjCode, weight]) => {
        buScorecardConfigData.push({
          BU_Code: buCode,
          Parent_Objective_Code: parentObjCode,
          Weight: weight
        });
      });
    });
    createSheet('BU_Scorecard_Config', buScorecardConfigData, ['BU_Code', 'Parent_Objective_Code', 'Weight']);

    console.log('MAIN SAVE - Writing file to:', filePath);

    if (filePath.endsWith('.cpme')) {
      // Encrypt and save
      console.log('MAIN SAVE - Encrypting file as .cpme');
      try {
        const buffer = await workbook.xlsx.writeBuffer();
        const encryptedBuffer = encryptBuffer(buffer);
        fs.writeFileSync(filePath, encryptedBuffer);
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
        if (encryptError.message.includes('Valid license required')) {
          return { success: false, error: 'Valid license required to save encrypted files. Please activate your license.' };
        }
        throw encryptError;
      }
    } else {
      // Save as plain Excel
      await workbook.xlsx.writeFile(filePath);
    }

    console.log('MAIN SAVE - File written successfully');
    return { success: true };
  } catch (error) {
    console.error('Error saving strategy file:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC HANDLERS - CREATE NEW STRATEGY FILE
// ============================================

ipcMain.handle('create-new-strategy-file', async (event, filePath) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPM Strategy Cascade Tool';
    workbook.created = new Date();

    // Create all sheets with headers

    // Vision
    const visionSheet = workbook.addWorksheet('Vision');
    writeSheetData(visionSheet, [], ['Vision', 'Year']);

    // Mission
    const missionSheet = workbook.addWorksheet('Mission');
    writeSheetData(missionSheet, [], ['Mission', 'Year']);

    // Strategic Pillars
    const pillarsSheet = workbook.addWorksheet('Strategic_Pillars');
    writeSheetData(pillarsSheet, [], ['Code', 'Name', 'Name_AR', 'Description', 'Weight', 'Status', 'Color']);

    // Perspectives
    const perspectivesSheet = workbook.addWorksheet('Perspectives');
    writeSheetData(perspectivesSheet, [], ['Code', 'Name', 'Name_AR', 'Status']);

    // Business Units
    const buSheet = workbook.addWorksheet('Business_Units');
    writeSheetData(buSheet, [], ['Code', 'Name', 'Name_AR', 'Abbreviation', 'Level', 'Parent_Code', 'Status']);

    // Objectives
    const objectivesSheet = workbook.addWorksheet('Objectives');
    writeSheetData(objectivesSheet, [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Level', 'Business_Unit',
      'Parent_Objective', 'Pillar_Code', 'Perspective', 'Weight', 'Status', 'Is_Operational'
    ]);

    // KPIs
    const kpisSheet = workbook.addWorksheet('KPIs');
    writeSheetData(kpisSheet, [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Level', 'Objective_Code', 'Business_Unit',
      'Impact_Type', 'Indicator_Type', 'Approval_Status', 'Formula', 'Data_Points', 'Target', 'Weight', 'Status', 'Review_Status', 'Discussion', 'Polarity'
    ]);

    // Objective Links
    const linksSheet = workbook.addWorksheet('Objective_Links');
    writeSheetData(linksSheet, [], ['From_Code', 'To_Code', 'From_Side', 'To_Side', 'Waypoints']);

    // Map Layout (objective positions)
    const mapLayoutSheet = workbook.addWorksheet('Map_Layout');
    writeSheetData(mapLayoutSheet, [], ['Objective_Code', 'X', 'Y']);

    // Global Values
    const globalValuesSheet = workbook.addWorksheet('Global_Values');
    writeSheetData(globalValuesSheet, [], ['Code', 'Name', 'Name_AR', 'Type', 'Description', 'Monthly_Values']);

    // Measures
    const measuresSheet = workbook.addWorksheet('Measures');
    writeSheetData(measuresSheet, [], ['Code', 'Name', 'KPI_Code', 'Formula_Elements', 'Formula_Text', 'Parameters', 'Last_Value', 'Last_Calculated', 'Status', 'Created_At']);

    // Parameter Values
    const paramValuesSheet = workbook.addWorksheet('Parameter_Values');
    writeSheetData(paramValuesSheet, [], ['Measure_Code', 'Parameter_Name', 'Month_Key', 'Value']);

    // Calculated Values
    const calcValuesSheet = workbook.addWorksheet('Calculated_Values');
    writeSheetData(calcValuesSheet, [], ['Measure_Code', 'Month_Key', 'Value', 'Error']);

    // Achievements
    const achievementsSheet = workbook.addWorksheet('Achievements');
    writeSheetData(achievementsSheet, [], ['Measure_Code', 'Month_Key', 'Achievement']);

    // Team Members
    const teamMembersSheet = workbook.addWorksheet('Team_Members');
    writeSheetData(teamMembersSheet, [], [
      'Code', 'Employee_ID', 'Name', 'Name_AR', 'Job_Title', 'Job_Title_AR',
      'Email', 'Photo_URL', 'Hire_Date', 'Reports_To', 'Business_Unit_Code', 'Status'
    ]);

    // Personal Objectives
    const personalObjSheet = workbook.addWorksheet('Personal_Objectives');
    writeSheetData(personalObjSheet, [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code',
      'Parent_Objective_Code', 'Weight', 'Target_Date', 'Status'
    ]);

    // Employee KPIs
    const employeeKpisSheet = workbook.addWorksheet('Employee_KPIs');
    writeSheetData(employeeKpisSheet, [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code', 'Personal_Objective_Code',
      'Formula', 'Data_Points', 'Target', 'Target_Mode', 'Monthly_Targets', 'Unit', 'Weight', 'Polarity', 'Status'
    ]);

    // Employee Achievements
    const empAchievementsSheet = workbook.addWorksheet('Employee_Achievements');
    writeSheetData(empAchievementsSheet, [], ['Employee_KPI_Code', 'Month_Key', 'Actual', 'Achievement']);

    // Settings
    const settingsSheet = workbook.addWorksheet('Settings');
    writeSheetData(settingsSheet, [], ['Key', 'Value']);

    // BU Scorecard Config
    const buScorecardConfigSheet = workbook.addWorksheet('BU_Scorecard_Config');
    writeSheetData(buScorecardConfigSheet, [], ['BU_Code', 'Parent_Objective_Code', 'Weight']);

    await workbook.xlsx.writeFile(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error creating new strategy file:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC HANDLERS - GENERATE SAMPLE DATA
// ============================================

ipcMain.handle('generate-sample-file', async (event, filePath) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPM Strategy Cascade Tool';
    workbook.created = new Date();

    // Sample Vision
    const visionSheet = workbook.addWorksheet('Vision');
    writeSheetData(visionSheet, [{
      Vision: 'To be the leading organization in our industry, driving innovation and excellence.',
      Year: 2026
    }], ['Vision', 'Year']);

    // Sample Mission
    const missionSheet = workbook.addWorksheet('Mission');
    writeSheetData(missionSheet, [{
      Mission: 'We deliver exceptional value to our stakeholders through operational excellence, innovation, and sustainable practices.',
      Year: 2026
    }], ['Mission', 'Year']);

    // Sample Strategic Pillars
    const pillarsSheet = workbook.addWorksheet('Strategic_Pillars');
    const pillars = [
      { Code: 'PIL_001', Name: 'Operational Excellence', Name_AR: 'التميز التشغيلي', Description: 'Achieve best-in-class operational performance', Weight: 0.3, Status: 'Active', Color: '#4472C4' },
      { Code: 'PIL_002', Name: 'Customer Centricity', Name_AR: 'التركيز على العملاء', Description: 'Put customers at the heart of everything we do', Weight: 0.25, Status: 'Active', Color: '#ED7D31' },
      { Code: 'PIL_003', Name: 'Innovation & Growth', Name_AR: 'الابتكار والنمو', Description: 'Drive growth through innovation and new markets', Weight: 0.25, Status: 'Active', Color: '#70AD47' },
      { Code: 'PIL_004', Name: 'People & Culture', Name_AR: 'الموظفون والثقافة', Description: 'Build a high-performance culture', Weight: 0.2, Status: 'Active', Color: '#9b59b6' }
    ];
    writeSheetData(pillarsSheet, pillars, ['Code', 'Name', 'Name_AR', 'Description', 'Weight', 'Status', 'Color']);

    // Sample Perspectives
    const perspectivesSheet = workbook.addWorksheet('Perspectives');
    const perspectives = [
      { Code: 'PER_FIN', Name: 'Financial', Name_AR: 'المالية', Status: 'Active' },
      { Code: 'PER_CUS', Name: 'Customer', Name_AR: 'العملاء', Status: 'Active' },
      { Code: 'PER_INT', Name: 'Internal Process', Name_AR: 'العمليات الداخلية', Status: 'Active' },
      { Code: 'PER_LRN', Name: 'Learning & Growth', Name_AR: 'التعلم والنمو', Status: 'Active' }
    ];
    writeSheetData(perspectivesSheet, perspectives, ['Code', 'Name', 'Name_AR', 'Status']);

    // Sample Business Units
    const buSheet = workbook.addWorksheet('Business_Units');
    const businessUnits = [
      // L1 - Corporate
      { Code: 'BU_CORP', Name: 'Corporate', Name_AR: 'الشركة', Abbreviation: 'CORP', Level: 'L1', Parent_Code: '', Status: 'Active' },
      // L2 - Divisions
      { Code: 'BU_OPS', Name: 'Operations Division', Name_AR: 'قطاع العمليات', Abbreviation: 'OPS', Level: 'L2', Parent_Code: 'BU_CORP', Status: 'Active' },
      { Code: 'BU_FIN', Name: 'Finance Division', Name_AR: 'قطاع المالية', Abbreviation: 'FIN', Level: 'L2', Parent_Code: 'BU_CORP', Status: 'Active' },
      { Code: 'BU_HR', Name: 'Human Resources Division', Name_AR: 'قطاع الموارد البشرية', Abbreviation: 'HR', Level: 'L2', Parent_Code: 'BU_CORP', Status: 'Active' },
      { Code: 'BU_IT', Name: 'IT Division', Name_AR: 'قطاع تقنية المعلومات', Abbreviation: 'IT', Level: 'L2', Parent_Code: 'BU_CORP', Status: 'Active' },
      // L3 - Departments
      { Code: 'BU_PROD', Name: 'Production', Name_AR: 'الإنتاج', Abbreviation: 'PROD', Level: 'L3', Parent_Code: 'BU_OPS', Status: 'Active' },
      { Code: 'BU_QA', Name: 'Quality Assurance', Name_AR: 'ضمان الجودة', Abbreviation: 'QA', Level: 'L3', Parent_Code: 'BU_OPS', Status: 'Active' },
      { Code: 'BU_ACC', Name: 'Accounting', Name_AR: 'المحاسبة', Abbreviation: 'ACC', Level: 'L3', Parent_Code: 'BU_FIN', Status: 'Active' },
      { Code: 'BU_TRE', Name: 'Treasury', Name_AR: 'الخزينة', Abbreviation: 'TRE', Level: 'L3', Parent_Code: 'BU_FIN', Status: 'Active' },
      { Code: 'BU_REC', Name: 'Recruitment', Name_AR: 'التوظيف', Abbreviation: 'REC', Level: 'L3', Parent_Code: 'BU_HR', Status: 'Active' },
      { Code: 'BU_TRN', Name: 'Training', Name_AR: 'التدريب', Abbreviation: 'TRN', Level: 'L3', Parent_Code: 'BU_HR', Status: 'Active' }
    ];
    writeSheetData(buSheet, businessUnits, ['Code', 'Name', 'Name_AR', 'Abbreviation', 'Level', 'Parent_Code', 'Status']);

    // Sample Objectives
    const objectivesSheet = workbook.addWorksheet('Objectives');
    const objectives = [
      // L1 Corporate Objectives (simple: OBJ_L1_001)
      { Code: 'OBJ_L1_001', Name: 'Maximize Shareholder Value', Name_AR: 'تعظيم قيمة المساهمين', Description: 'Deliver superior returns to shareholders', Level: 'L1', Business_Unit: 'BU_CORP', Parent_Objective: '', Pillar_Code: 'PIL_001', Perspective: 'PER_FIN', Weight: 0.25, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L1_002', Name: 'Enhance Customer Experience', Name_AR: 'تحسين تجربة العملاء', Description: 'Deliver exceptional customer experience', Level: 'L1', Business_Unit: 'BU_CORP', Parent_Objective: '', Pillar_Code: 'PIL_002', Perspective: 'PER_CUS', Weight: 0.25, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L1_003', Name: 'Drive Innovation', Name_AR: 'تعزيز الابتكار', Description: 'Foster innovation culture', Level: 'L1', Business_Unit: 'BU_CORP', Parent_Objective: '', Pillar_Code: 'PIL_003', Perspective: 'PER_INT', Weight: 0.25, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L1_004', Name: 'Develop Talent', Name_AR: 'تطوير المواهب', Description: 'Build and retain top talent', Level: 'L1', Business_Unit: 'BU_CORP', Parent_Objective: '', Pillar_Code: 'PIL_004', Perspective: 'PER_LRN', Weight: 0.25, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L1_OPERATIONAL_BU_CORP', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L1', Business_Unit: 'BU_CORP', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },

      // L2 Division Objectives (format: OBJ_L2_[BU_ABBR]_001)
      { Code: 'OBJ_L2_OPS_001', Name: 'Optimize Operations Cost', Name_AR: 'تحسين تكاليف العمليات', Description: 'Reduce operational costs', Level: 'L2', Business_Unit: 'BU_OPS', Parent_Objective: 'OBJ_L1_001', Pillar_Code: '', Perspective: 'PER_FIN', Weight: 0.3, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L2_OPS_002', Name: 'Improve Quality Standards', Name_AR: 'تحسين معايير الجودة', Description: 'Achieve quality excellence', Level: 'L2', Business_Unit: 'BU_OPS', Parent_Objective: 'OBJ_L1_002', Pillar_Code: '', Perspective: 'PER_INT', Weight: 0.3, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L2_FIN_001', Name: 'Strengthen Financial Controls', Name_AR: 'تعزيز الضوابط المالية', Description: 'Enhance financial governance', Level: 'L2', Business_Unit: 'BU_FIN', Parent_Objective: 'OBJ_L1_001', Pillar_Code: '', Perspective: 'PER_FIN', Weight: 0.25, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L2_HR_001', Name: 'Build High-Performance Teams', Name_AR: 'بناء فرق عالية الأداء', Description: 'Develop high-performing workforce', Level: 'L2', Business_Unit: 'BU_HR', Parent_Objective: 'OBJ_L1_004', Pillar_Code: '', Perspective: 'PER_LRN', Weight: 0.3, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L2_OPERATIONAL_BU_OPS', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L2', Business_Unit: 'BU_OPS', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L2_OPERATIONAL_BU_FIN', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L2', Business_Unit: 'BU_FIN', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L2_OPERATIONAL_BU_HR', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L2', Business_Unit: 'BU_HR', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L2_OPERATIONAL_BU_IT', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L2', Business_Unit: 'BU_IT', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },

      // L3 Department Objectives (format: OBJ_L3_[BU_ABBR]_001)
      { Code: 'OBJ_L3_PROD_001', Name: 'Maximize Production Efficiency', Name_AR: 'تعظيم كفاءة الإنتاج', Description: 'Increase production output', Level: 'L3', Business_Unit: 'BU_PROD', Parent_Objective: 'OBJ_L2_OPS_001', Pillar_Code: '', Perspective: 'PER_INT', Weight: 0.4, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L3_QA_001', Name: 'Reduce Defect Rate', Name_AR: 'تقليل معدل العيوب', Description: 'Minimize production defects', Level: 'L3', Business_Unit: 'BU_QA', Parent_Objective: 'OBJ_L2_OPS_002', Pillar_Code: '', Perspective: 'PER_INT', Weight: 0.35, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L3_REC_001', Name: 'Accelerate Recruitment', Name_AR: 'تسريع التوظيف', Description: 'Reduce time-to-hire', Level: 'L3', Business_Unit: 'BU_REC', Parent_Objective: 'OBJ_L2_HR_001', Pillar_Code: '', Perspective: 'PER_LRN', Weight: 0.3, Status: 'Active', Is_Operational: false },
      { Code: 'OBJ_L3_OPERATIONAL_BU_PROD', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L3', Business_Unit: 'BU_PROD', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L3_OPERATIONAL_BU_QA', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L3', Business_Unit: 'BU_QA', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L3_OPERATIONAL_BU_ACC', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L3', Business_Unit: 'BU_ACC', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L3_OPERATIONAL_BU_TRE', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L3', Business_Unit: 'BU_TRE', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L3_OPERATIONAL_BU_REC', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L3', Business_Unit: 'BU_REC', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true },
      { Code: 'OBJ_L3_OPERATIONAL_BU_TRN', Name: 'Operational', Name_AR: 'تشغيلي', Description: 'Operational objective', Level: 'L3', Business_Unit: 'BU_TRN', Parent_Objective: '', Pillar_Code: '', Perspective: '', Weight: 0, Status: 'Active', Is_Operational: true }
    ];
    writeSheetData(objectivesSheet, objectives, [
      'Code', 'Name', 'Name_AR', 'Description', 'Level', 'Business_Unit',
      'Parent_Objective', 'Pillar_Code', 'Perspective', 'Weight', 'Status', 'Is_Operational'
    ]);

    // Sample KPIs (format: KPI_L[LEVEL]_[BU_ABBR]_001)
    const kpisSheet = workbook.addWorksheet('KPIs');
    const kpis = [
      // L1 Corporate KPIs (5 KPIs)
      { Code: 'KPI_L1_CORP_001', Name: 'Return on Equity (ROE)', Name_AR: 'العائد على حقوق الملكية', Description: 'Measures profitability relative to shareholders equity', Objective_Code: 'OBJ_L1_001', Business_Unit: 'BU_CORP', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Net Income / Shareholders Equity', Data_Points: 'Net Income, Shareholders Equity', Polarity: 'Positive', Unit: '%', Target: 15, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L1_CORP_002', Name: 'Customer Satisfaction Score', Name_AR: 'درجة رضا العملاء', Description: 'Overall customer satisfaction rating', Objective_Code: 'OBJ_L1_002', Business_Unit: 'BU_CORP', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Sum of satisfaction ratings / Total responses', Data_Points: 'Survey responses', Polarity: 'Positive', Unit: '%', Target: 90, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L1_CORP_003', Name: 'Innovation Index', Name_AR: 'مؤشر الابتكار', Description: 'Measures innovation output', Objective_Code: 'OBJ_L1_003', Business_Unit: 'BU_CORP', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Under Discussion', Formula: 'New products launched + Patents filed', Data_Points: 'Product launches, Patent filings', Polarity: 'Positive', Unit: 'Count', Target: 10, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L1_CORP_004', Name: 'Employee Engagement Score', Name_AR: 'درجة مشاركة الموظفين', Description: 'Annual employee engagement survey score', Objective_Code: 'OBJ_L1_004', Business_Unit: 'BU_CORP', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Locked', Formula: 'Engagement survey score', Data_Points: 'Survey results', Polarity: 'Positive', Unit: '%', Target: 80, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L1_CORP_005', Name: 'Revenue Growth Rate', Name_AR: 'معدل نمو الإيرادات', Description: 'Year-over-year revenue growth percentage', Objective_Code: 'OBJ_L1_001', Business_Unit: 'BU_CORP', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: '(Current Revenue - Previous Revenue) / Previous Revenue * 100', Data_Points: 'Revenue figures', Polarity: 'Positive', Unit: '%', Target: 12, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L2 Operations KPIs (5 KPIs)
      { Code: 'KPI_L2_OPS_001', Name: 'Operating Cost Ratio', Name_AR: 'نسبة تكاليف التشغيل', Description: 'Operating costs as percentage of revenue', Objective_Code: 'OBJ_L2_OPS_001', Business_Unit: 'BU_OPS', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Operating Costs / Revenue * 100', Data_Points: 'Operating costs, Revenue', Polarity: 'Negative', Unit: '%', Target: 25, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_OPS_002', Name: 'Quality Compliance Rate', Name_AR: 'معدل الامتثال للجودة', Description: 'Percentage of products meeting quality standards', Objective_Code: 'OBJ_L2_OPS_002', Business_Unit: 'BU_OPS', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Compliant products / Total products * 100', Data_Points: 'QA inspection results', Polarity: 'Positive', Unit: '%', Target: 98, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_OPS_003', Name: 'On-Time Delivery Rate', Name_AR: 'معدل التسليم في الوقت المحدد', Description: 'Percentage of orders delivered on time', Objective_Code: 'OBJ_L2_OPS_002', Business_Unit: 'BU_OPS', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'On-time deliveries / Total deliveries * 100', Data_Points: 'Delivery logs', Polarity: 'Positive', Unit: '%', Target: 95, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_OPS_004', Name: 'Equipment Uptime', Name_AR: 'وقت تشغيل المعدات', Description: 'Percentage of time equipment is operational', Objective_Code: 'OBJ_L2_OPS_001', Business_Unit: 'BU_OPS', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Operating hours / Total available hours * 100', Data_Points: 'Maintenance records', Polarity: 'Positive', Unit: '%', Target: 92, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_OPS_005', Name: 'Safety Incident Rate', Name_AR: 'معدل حوادث السلامة', Description: 'Number of safety incidents per 100 employees', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_OPS', Business_Unit: 'BU_OPS', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Incidents / Employees * 100', Data_Points: 'Safety reports', Polarity: 'Negative', Unit: 'Rate', Target: 0.5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L2 Finance KPIs (5 KPIs)
      { Code: 'KPI_L2_FIN_001', Name: 'Budget Variance', Name_AR: 'انحراف الميزانية', Description: 'Variance between actual and budgeted spend', Objective_Code: 'OBJ_L2_FIN_001', Business_Unit: 'BU_FIN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Under Discussion', Formula: 'ABS(Actual - Budget) / Budget * 100', Data_Points: 'Actual spend, Budget', Polarity: 'Negative', Unit: '%', Target: 5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_FIN_002', Name: 'Days Sales Outstanding', Name_AR: 'أيام المبيعات المعلقة', Description: 'Average days to collect payment', Objective_Code: 'OBJ_L2_FIN_001', Business_Unit: 'BU_FIN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Accounts Receivable / Revenue * 365', Data_Points: 'AR, Revenue', Polarity: 'Negative', Unit: 'Days', Target: 45, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_FIN_003', Name: 'Cost per Transaction', Name_AR: 'تكلفة المعاملة', Description: 'Average cost to process a financial transaction', Objective_Code: 'OBJ_L2_FIN_001', Business_Unit: 'BU_FIN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Total processing cost / Number of transactions', Data_Points: 'Processing costs', Polarity: 'Negative', Unit: '$', Target: 2.5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_FIN_004', Name: 'Financial Report Accuracy', Name_AR: 'دقة التقارير المالية', Description: 'Percentage of reports without errors', Objective_Code: 'OBJ_L2_FIN_001', Business_Unit: 'BU_FIN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Error-free reports / Total reports * 100', Data_Points: 'Audit findings', Polarity: 'Positive', Unit: '%', Target: 99, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_FIN_005', Name: 'Working Capital Ratio', Name_AR: 'نسبة رأس المال العامل', Description: 'Current assets to current liabilities ratio', Objective_Code: 'OBJ_L2_FIN_001', Business_Unit: 'BU_FIN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Current Assets / Current Liabilities', Data_Points: 'Balance sheet', Polarity: 'Positive', Unit: 'Ratio', Target: 1.5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L2 HR KPIs (5 KPIs)
      { Code: 'KPI_L2_HR_001', Name: 'Training Hours per Employee', Name_AR: 'ساعات التدريب لكل موظف', Description: 'Average training hours per employee per year', Objective_Code: 'OBJ_L2_HR_001', Business_Unit: 'BU_HR', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Total training hours / Number of employees', Data_Points: 'Training records', Polarity: 'Positive', Unit: 'Hours', Target: 40, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_HR_002', Name: 'Employee Turnover Rate', Name_AR: 'معدل دوران الموظفين', Description: 'Percentage of employees leaving annually', Objective_Code: 'OBJ_L2_HR_001', Business_Unit: 'BU_HR', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Employees left / Average headcount * 100', Data_Points: 'HR records', Polarity: 'Negative', Unit: '%', Target: 10, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_HR_003', Name: 'Internal Promotion Rate', Name_AR: 'معدل الترقية الداخلية', Description: 'Percentage of positions filled internally', Objective_Code: 'OBJ_L2_HR_001', Business_Unit: 'BU_HR', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Internal promotions / Total positions filled * 100', Data_Points: 'Hiring records', Polarity: 'Positive', Unit: '%', Target: 60, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_HR_004', Name: 'Absenteeism Rate', Name_AR: 'معدل الغياب', Description: 'Percentage of workdays missed due to absence', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_HR', Business_Unit: 'BU_HR', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Absent days / Total workdays * 100', Data_Points: 'Attendance records', Polarity: 'Negative', Unit: '%', Target: 3, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_HR_005', Name: 'HR Service Response Time', Name_AR: 'وقت استجابة الموارد البشرية', Description: 'Average time to respond to HR requests', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_HR', Business_Unit: 'BU_HR', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Total response time / Number of requests', Data_Points: 'HR ticketing system', Polarity: 'Negative', Unit: 'Hours', Target: 24, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L2 IT KPIs (5 KPIs)
      { Code: 'KPI_L2_IT_001', Name: 'System Uptime', Name_AR: 'وقت تشغيل النظام', Description: 'Percentage of time critical systems are available', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_IT', Business_Unit: 'BU_IT', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Uptime hours / Total hours * 100', Data_Points: 'System monitoring', Polarity: 'Positive', Unit: '%', Target: 99.5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_IT_002', Name: 'Mean Time to Resolve', Name_AR: 'متوسط وقت الحل', Description: 'Average time to resolve IT incidents', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_IT', Business_Unit: 'BU_IT', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Total resolution time / Number of incidents', Data_Points: 'IT ticketing system', Polarity: 'Negative', Unit: 'Hours', Target: 4, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_IT_003', Name: 'IT Project On-Time Delivery', Name_AR: 'تسليم مشاريع تقنية المعلومات في الوقت المحدد', Description: 'Percentage of IT projects delivered on schedule', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_IT', Business_Unit: 'BU_IT', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'On-time projects / Total projects * 100', Data_Points: 'Project records', Polarity: 'Positive', Unit: '%', Target: 85, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_IT_004', Name: 'Cybersecurity Incident Rate', Name_AR: 'معدل حوادث الأمن السيبراني', Description: 'Number of security incidents per month', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_IT', Business_Unit: 'BU_IT', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Count of security incidents', Data_Points: 'Security logs', Polarity: 'Negative', Unit: 'Count', Target: 0, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L2_IT_005', Name: 'User Satisfaction Score', Name_AR: 'درجة رضا المستخدمين', Description: 'IT service satisfaction from internal users', Objective_Code: 'OBJ_L2_OPERATIONAL_BU_IT', Business_Unit: 'BU_IT', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Average satisfaction rating', Data_Points: 'IT surveys', Polarity: 'Positive', Unit: '%', Target: 85, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L3 Production KPIs (5 KPIs)
      { Code: 'KPI_L3_PROD_001', Name: 'Production Output', Name_AR: 'الناتج الإنتاجي', Description: 'Units produced per month', Objective_Code: 'OBJ_L3_PROD_001', Business_Unit: 'BU_PROD', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Total units produced', Data_Points: 'Production logs', Polarity: 'Positive', Unit: 'Units', Target: 10000, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_PROD_002', Name: 'Production Efficiency', Name_AR: 'كفاءة الإنتاج', Description: 'Actual output vs planned output', Objective_Code: 'OBJ_L3_PROD_001', Business_Unit: 'BU_PROD', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Actual output / Planned output * 100', Data_Points: 'Production records', Polarity: 'Positive', Unit: '%', Target: 95, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_PROD_003', Name: 'Machine Utilization Rate', Name_AR: 'معدل استخدام الآلات', Description: 'Percentage of machine capacity utilized', Objective_Code: 'OBJ_L3_PROD_001', Business_Unit: 'BU_PROD', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Actual run time / Available time * 100', Data_Points: 'Machine logs', Polarity: 'Positive', Unit: '%', Target: 85, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_PROD_004', Name: 'Scrap Rate', Name_AR: 'معدل الهدر', Description: 'Percentage of materials wasted in production', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_PROD', Business_Unit: 'BU_PROD', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Scrapped materials / Total materials * 100', Data_Points: 'Waste records', Polarity: 'Negative', Unit: '%', Target: 2, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_PROD_005', Name: 'Cycle Time', Name_AR: 'وقت الدورة', Description: 'Average time to complete one production cycle', Objective_Code: 'OBJ_L3_PROD_001', Business_Unit: 'BU_PROD', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Total production time / Units produced', Data_Points: 'Production logs', Polarity: 'Negative', Unit: 'Minutes', Target: 15, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L3 QA KPIs (5 KPIs)
      { Code: 'KPI_L3_QA_001', Name: 'Defect Rate', Name_AR: 'معدل العيوب', Description: 'Percentage of defective products', Objective_Code: 'OBJ_L3_QA_001', Business_Unit: 'BU_QA', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Defective units / Total units * 100', Data_Points: 'QA inspection data', Polarity: 'Negative', Unit: '%', Target: 0.5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_QA_002', Name: 'First Pass Yield', Name_AR: 'العائد من المحاولة الأولى', Description: 'Percentage of products passing QA on first inspection', Objective_Code: 'OBJ_L3_QA_001', Business_Unit: 'BU_QA', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'First pass products / Total inspected * 100', Data_Points: 'Inspection records', Polarity: 'Positive', Unit: '%', Target: 97, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_QA_003', Name: 'Customer Complaints', Name_AR: 'شكاوى العملاء', Description: 'Number of quality-related customer complaints', Objective_Code: 'OBJ_L3_QA_001', Business_Unit: 'BU_QA', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Count of quality complaints', Data_Points: 'Customer feedback', Polarity: 'Negative', Unit: 'Count', Target: 5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_QA_004', Name: 'Inspection Coverage', Name_AR: 'تغطية الفحص', Description: 'Percentage of production batches inspected', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_QA', Business_Unit: 'BU_QA', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Batches inspected / Total batches * 100', Data_Points: 'Inspection logs', Polarity: 'Positive', Unit: '%', Target: 100, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_QA_005', Name: 'Corrective Action Closure Rate', Name_AR: 'معدل إغلاق الإجراءات التصحيحية', Description: 'Percentage of corrective actions closed on time', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_QA', Business_Unit: 'BU_QA', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Closed on time / Total CAs * 100', Data_Points: 'CAPA system', Polarity: 'Positive', Unit: '%', Target: 90, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L3 Accounting KPIs (5 KPIs)
      { Code: 'KPI_L3_ACC_001', Name: 'Invoice Processing Time', Name_AR: 'وقت معالجة الفواتير', Description: 'Average time to process invoices', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_ACC', Business_Unit: 'BU_ACC', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Total processing time / Number of invoices', Data_Points: 'Invoice logs', Polarity: 'Negative', Unit: 'Days', Target: 3, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_ACC_002', Name: 'Month-End Close Time', Name_AR: 'وقت إغلاق نهاية الشهر', Description: 'Days to complete monthly financial close', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_ACC', Business_Unit: 'BU_ACC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Days from month end to close', Data_Points: 'Close calendar', Polarity: 'Negative', Unit: 'Days', Target: 5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_ACC_003', Name: 'Payment Error Rate', Name_AR: 'معدل أخطاء الدفع', Description: 'Percentage of payments with errors', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_ACC', Business_Unit: 'BU_ACC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Erroneous payments / Total payments * 100', Data_Points: 'Payment records', Polarity: 'Negative', Unit: '%', Target: 0.1, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_ACC_004', Name: 'Vendor Payment On-Time Rate', Name_AR: 'معدل الدفع للموردين في الوقت المحدد', Description: 'Percentage of vendor payments made on time', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_ACC', Business_Unit: 'BU_ACC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'On-time payments / Total payments * 100', Data_Points: 'AP records', Polarity: 'Positive', Unit: '%', Target: 98, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_ACC_005', Name: 'Account Reconciliation Rate', Name_AR: 'معدل تسوية الحسابات', Description: 'Percentage of accounts reconciled monthly', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_ACC', Business_Unit: 'BU_ACC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Reconciled accounts / Total accounts * 100', Data_Points: 'Reconciliation logs', Polarity: 'Positive', Unit: '%', Target: 100, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L3 Treasury KPIs (5 KPIs)
      { Code: 'KPI_L3_TRE_001', Name: 'Cash Flow Forecast Accuracy', Name_AR: 'دقة توقعات التدفق النقدي', Description: 'Accuracy of cash flow predictions', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRE', Business_Unit: 'BU_TRE', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: '100 - ABS(Forecast - Actual) / Actual * 100', Data_Points: 'Cash records', Polarity: 'Positive', Unit: '%', Target: 95, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRE_002', Name: 'Investment Return Rate', Name_AR: 'معدل عائد الاستثمار', Description: 'Return on short-term investments', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRE', Business_Unit: 'BU_TRE', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Investment returns / Principal * 100', Data_Points: 'Investment records', Polarity: 'Positive', Unit: '%', Target: 4, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRE_003', Name: 'Bank Reconciliation Time', Name_AR: 'وقت تسوية البنك', Description: 'Days to complete bank reconciliations', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRE', Business_Unit: 'BU_TRE', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Average days to reconcile', Data_Points: 'Bank records', Polarity: 'Negative', Unit: 'Days', Target: 2, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRE_004', Name: 'Liquidity Ratio', Name_AR: 'نسبة السيولة', Description: 'Cash and equivalents to current liabilities', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRE', Business_Unit: 'BU_TRE', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Locked', Formula: 'Cash / Current Liabilities', Data_Points: 'Treasury reports', Polarity: 'Positive', Unit: 'Ratio', Target: 0.5, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRE_005', Name: 'FX Hedging Effectiveness', Name_AR: 'فعالية التحوط من العملات', Description: 'Effectiveness of foreign exchange hedges', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRE', Business_Unit: 'BU_TRE', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Hedge gain / Exposure loss * 100', Data_Points: 'FX records', Polarity: 'Positive', Unit: '%', Target: 85, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L3 Recruitment KPIs (5 KPIs)
      { Code: 'KPI_L3_REC_001', Name: 'Time to Hire', Name_AR: 'وقت التوظيف', Description: 'Average days to fill a position', Objective_Code: 'OBJ_L3_REC_001', Business_Unit: 'BU_REC', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Under Discussion', Formula: 'Sum of days to fill / Positions filled', Data_Points: 'Recruitment data', Polarity: 'Negative', Unit: 'Days', Target: 30, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_REC_002', Name: 'Cost per Hire', Name_AR: 'تكلفة التوظيف', Description: 'Average cost to hire an employee', Objective_Code: 'OBJ_L3_REC_001', Business_Unit: 'BU_REC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Total recruitment cost / Hires made', Data_Points: 'Recruitment budget', Polarity: 'Negative', Unit: '$', Target: 5000, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_REC_003', Name: 'Offer Acceptance Rate', Name_AR: 'معدل قبول العروض', Description: 'Percentage of job offers accepted', Objective_Code: 'OBJ_L3_REC_001', Business_Unit: 'BU_REC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Accepted offers / Total offers * 100', Data_Points: 'Offer records', Polarity: 'Positive', Unit: '%', Target: 85, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_REC_004', Name: 'Quality of Hire', Name_AR: 'جودة التوظيف', Description: 'Performance rating of new hires after 6 months', Objective_Code: 'OBJ_L3_REC_001', Business_Unit: 'BU_REC', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Average performance score of new hires', Data_Points: 'Performance reviews', Polarity: 'Positive', Unit: '%', Target: 80, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_REC_005', Name: 'Applicants per Position', Name_AR: 'المتقدمين لكل وظيفة', Description: 'Average number of applicants per job posting', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_REC', Business_Unit: 'BU_REC', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Total applicants / Open positions', Data_Points: 'ATS data', Polarity: 'Positive', Unit: 'Count', Target: 50, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },

      // L3 Training KPIs (5 KPIs)
      { Code: 'KPI_L3_TRN_001', Name: 'Training Completion Rate', Name_AR: 'معدل إكمال التدريب', Description: 'Percentage of employees completing required training', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRN', Business_Unit: 'BU_TRN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Employees completed / Total employees * 100', Data_Points: 'Training records', Polarity: 'Positive', Unit: '%', Target: 95, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRN_002', Name: 'Training Satisfaction Score', Name_AR: 'درجة الرضا عن التدريب', Description: 'Average satisfaction rating from training feedback', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRN', Business_Unit: 'BU_TRN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Average feedback score', Data_Points: 'Training surveys', Polarity: 'Positive', Unit: '%', Target: 85, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRN_003', Name: 'Training Cost per Employee', Name_AR: 'تكلفة التدريب لكل موظف', Description: 'Average training investment per employee', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRN', Business_Unit: 'BU_TRN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Total training cost / Number of employees', Data_Points: 'Training budget', Polarity: 'Positive', Unit: '$', Target: 1500, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRN_004', Name: 'Knowledge Assessment Pass Rate', Name_AR: 'معدل اجتياز تقييم المعرفة', Description: 'Percentage passing post-training assessments', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRN', Business_Unit: 'BU_TRN', Impact_Type: 'Direct', Indicator_Type: 'Lagging', Approval_Status: 'Recommended', Formula: 'Passed assessments / Total assessments * 100', Data_Points: 'Assessment results', Polarity: 'Positive', Unit: '%', Target: 90, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' },
      { Code: 'KPI_L3_TRN_005', Name: 'Training Programs Delivered', Name_AR: 'برامج التدريب المقدمة', Description: 'Number of training programs conducted', Objective_Code: 'OBJ_L3_OPERATIONAL_BU_TRN', Business_Unit: 'BU_TRN', Impact_Type: 'Direct', Indicator_Type: 'Leading', Approval_Status: 'Recommended', Formula: 'Count of programs', Data_Points: 'Training calendar', Polarity: 'Positive', Unit: 'Count', Target: 24, Weight: 20, Status: 'Active', Review_Status: 'Kept', Discussion: '' }
    ];
    // Add Level to each KPI based on code pattern (KPI_L1_*, KPI_L2_*, KPI_L3_*)
    const kpisWithLevel = kpis.map(kpi => {
      let level = '';
      if (kpi.Code.includes('_L1_')) level = 'L1';
      else if (kpi.Code.includes('_L2_')) level = 'L2';
      else if (kpi.Code.includes('_L3_')) level = 'L3';
      return { ...kpi, Level: level };
    });
    writeSheetData(kpisSheet, kpisWithLevel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Level', 'Objective_Code', 'Business_Unit',
      'Impact_Type', 'Indicator_Type', 'Approval_Status', 'Formula', 'Data_Points', 'Target', 'Weight', 'Polarity', 'Status', 'Review_Status', 'Discussion'
    ]);

    await workbook.xlsx.writeFile(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error generating sample file:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC HANDLERS - DIALOGS
// ============================================

ipcMain.handle('show-confirm-dialog', async (event, { title, message }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Confirm'],
    defaultId: 1,
    title: title,
    message: message
  });
  return result.response === 1;
});

ipcMain.handle('show-unsaved-warning', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Don\'t Save', 'Cancel', 'Save'],
    defaultId: 2,
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Do you want to save them before continuing?'
  });
  return result.response;
});

// ============================================
// IPC HANDLERS - EXPORT
// ============================================

ipcMain.handle('export-strategy-report', async (event, { filePath, data }) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPM Strategy Cascade Tool';
    workbook.created = new Date();

    // Helper to get vision/mission statement
    const getVisionText = () => {
      if (typeof data.vision === 'object') return data.vision.Statement || '';
      return data.vision || '';
    };
    const getMissionText = () => {
      if (typeof data.mission === 'object') return data.mission.Statement || '';
      return data.mission || '';
    };

    // Sheet 1: Strategy Overview
    const strategySheet = workbook.addWorksheet('Strategy Overview');
    strategySheet.getCell('A1').value = 'STRATEGY OVERVIEW';
    strategySheet.getCell('A1').font = { bold: true, size: 16 };
    strategySheet.mergeCells('A1:D1');

    strategySheet.getCell('A3').value = 'Vision';
    strategySheet.getCell('A3').font = { bold: true, size: 12 };
    strategySheet.getCell('B3').value = getVisionText();
    strategySheet.mergeCells('B3:D3');

    strategySheet.getCell('A5').value = 'Mission';
    strategySheet.getCell('A5').font = { bold: true, size: 12 };
    strategySheet.getCell('B5').value = getMissionText();
    strategySheet.mergeCells('B5:D5');

    let row = 8;
    strategySheet.getCell(`A${row}`).value = 'Strategic Pillars';
    strategySheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;
    strategySheet.getRow(row).values = ['Code', 'Name', 'Name (Arabic)', 'Weight %', 'Status'];
    strategySheet.getRow(row).font = { bold: true };
    strategySheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    strategySheet.getRow(row).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row++;
    data.pillars.forEach(p => {
      strategySheet.getRow(row).values = [p.Code, p.Name, p.Name_AR || '', p.Weight, p.Status];
      row++;
    });

    strategySheet.getColumn(1).width = 15;
    strategySheet.getColumn(2).width = 35;
    strategySheet.getColumn(3).width = 35;
    strategySheet.getColumn(4).width = 12;
    strategySheet.getColumn(5).width = 12;

    // Sheet 2: Business Units
    const buSheet = workbook.addWorksheet('Business Units');
    buSheet.addRow(['Code', 'Name', 'Name (Arabic)', 'Level', 'Parent Code', 'Status']);
    buSheet.getRow(1).font = { bold: true };
    buSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    buSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const sortedBUs = [...data.businessUnits].sort((a, b) => {
      if (a.Level !== b.Level) return a.Level.localeCompare(b.Level);
      return a.Name.localeCompare(b.Name);
    });

    sortedBUs.forEach(bu => {
      buSheet.addRow([bu.Code, bu.Name, bu.Name_AR || '', bu.Level, bu.Parent_Code || '', bu.Status]);
    });

    buSheet.columns.forEach(col => { col.width = 20; });

    // Sheet 3: Objectives Cascade
    const objectivesSheet = workbook.addWorksheet('Objectives');
    objectivesSheet.addRow(['Level', 'Business Unit', 'Code', 'Name', 'Name (Arabic)', 'Parent Objective', 'Pillar', 'Perspective', 'Weight', 'Is Operational']);
    objectivesSheet.getRow(1).font = { bold: true };
    objectivesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    objectivesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const sortedObjectives = [...data.objectives].sort((a, b) => {
      if (a.Level !== b.Level) return a.Level.localeCompare(b.Level);
      const buA = a.Business_Unit_Code || a.Business_Unit || '';
      const buB = b.Business_Unit_Code || b.Business_Unit || '';
      return buA.localeCompare(buB);
    });

    sortedObjectives.forEach(obj => {
      const bu = data.businessUnits.find(b => b.Code === (obj.Business_Unit_Code || obj.Business_Unit));
      const pillar = data.pillars.find(p => p.Code === obj.Pillar_Code);
      objectivesSheet.addRow([
        obj.Level,
        bu ? bu.Name : (obj.Business_Unit_Code || obj.Business_Unit || ''),
        obj.Code,
        obj.Name,
        obj.Name_AR || '',
        obj.Parent_Objective_Code || obj.Parent_Objective || '',
        pillar ? pillar.Name : obj.Pillar_Code || '',
        obj.Perspective_Code || obj.Perspective || '',
        obj.Weight,
        obj.Is_Operational ? 'Yes' : 'No'
      ]);
    });

    objectivesSheet.columns.forEach(col => { col.width = 18; });

    // Sheet 4: KPIs
    const kpisSheet = workbook.addWorksheet('KPIs');
    kpisSheet.addRow(['Code', 'Name', 'Name (Arabic)', 'Level', 'Objective', 'Business Unit', 'Impact Type', 'Indicator Type', 'Approval Status', 'Target', 'Unit', 'Weight', 'Polarity', 'Status']);
    kpisSheet.getRow(1).font = { bold: true };
    kpisSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    kpisSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const sortedKPIs = [...data.kpis].sort((a, b) => (a.Objective_Code || '').localeCompare(b.Objective_Code || ''));
    sortedKPIs.forEach(kpi => {
      const obj = data.objectives.find(o => o.Code === kpi.Objective_Code);
      const bu = obj ? data.businessUnits.find(b => b.Code === (obj.Business_Unit_Code || obj.Business_Unit)) : null;
      const level = obj?.Level || kpi.Level || '';
      kpisSheet.addRow([
        kpi.Code,
        kpi.Name,
        kpi.Name_AR || '',
        level,
        obj ? obj.Name : kpi.Objective_Code || '',
        bu ? bu.Name : (kpi.Business_Unit_Code || kpi.Business_Unit || ''),
        kpi.Impact_Type,
        kpi.Indicator_Type || 'Lagging',
        kpi.Approval_Status || 'Recommended',
        kpi.Target,
        kpi.Unit || '',
        kpi.Weight,
        kpi.Polarity || 'Positive',
        kpi.Review_Status
      ]);
    });

    kpisSheet.columns.forEach(col => { col.width = 18; });

    // Sheet 5: Summary Statistics
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.getCell('A1').value = 'STRATEGY CASCADE SUMMARY';
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.mergeCells('A1:C1');

    summarySheet.getCell('A3').value = 'Generated On:';
    summarySheet.getCell('B3').value = new Date().toLocaleDateString();

    const l1BUs = data.businessUnits.filter(bu => bu.Level === 'L1');
    const l2BUs = data.businessUnits.filter(bu => bu.Level === 'L2');
    const l3BUs = data.businessUnits.filter(bu => bu.Level === 'L3');
    const l1Objs = data.objectives.filter(o => o.Level === 'L1' && !o.Is_Operational);
    const l2Objs = data.objectives.filter(o => o.Level === 'L2' && !o.Is_Operational);
    const l3Objs = data.objectives.filter(o => o.Level === 'L3' && !o.Is_Operational);

    summarySheet.getCell('A5').value = 'Metric';
    summarySheet.getCell('B5').value = 'Count';
    summarySheet.getRow(5).font = { bold: true };

    const stats = [
      ['Strategic Pillars', data.pillars.length],
      ['Perspectives', data.perspectives?.length || 0],
      ['L1 Business Units', l1BUs.length],
      ['L2 Business Units', l2BUs.length],
      ['L3 Business Units', l3BUs.length],
      ['Total Business Units', data.businessUnits.length],
      ['L1 Objectives', l1Objs.length],
      ['L2 Objectives', l2Objs.length],
      ['L3 Objectives', l3Objs.length],
      ['Total Objectives (excl. Operational)', l1Objs.length + l2Objs.length + l3Objs.length],
      ['Total KPIs', data.kpis.length]
    ];

    let statRow = 6;
    stats.forEach(([label, value]) => {
      summarySheet.getCell(`A${statRow}`).value = label;
      summarySheet.getCell(`B${statRow}`).value = value;
      statRow++;
    });

    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 15;

    await workbook.xlsx.writeFile(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error exporting strategy report:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// IPC HANDLER - EXPORT UNENCRYPTED
// ============================================

ipcMain.handle('export-unencrypted', async (event, { data, defaultName }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'Strategy_Export.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    // Create a fresh workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPM Strategy Cascade Tool';
    workbook.created = new Date();

    // Helper function to create a fresh sheet with data
    const createSheet = (name, sheetData, headers) => {
      const sheet = workbook.addWorksheet(name);

      // Write headers as first row
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Write data rows
      sheetData.forEach(item => {
        const rowValues = headers.map(h => item[h] ?? '');
        sheet.addRow(rowValues);
      });

      // Auto-width columns
      headers.forEach((_, index) => {
        sheet.getColumn(index + 1).width = 20;
      });

      return sheet;
    };

    // Vision sheet
    const visionData = typeof data.vision === 'object'
      ? [{ Statement: data.vision.Statement || '', Statement_AR: data.vision.Statement_AR || '', Year: new Date().getFullYear() }]
      : [{ Statement: data.vision || '', Statement_AR: '', Year: new Date().getFullYear() }];
    createSheet('Vision', visionData, ['Statement', 'Statement_AR', 'Year']);

    // Mission sheet
    const missionData = typeof data.mission === 'object'
      ? [{ Statement: data.mission.Statement || '', Statement_AR: data.mission.Statement_AR || '', Year: new Date().getFullYear() }]
      : [{ Statement: data.mission || '', Statement_AR: '', Year: new Date().getFullYear() }];
    createSheet('Mission', missionData, ['Statement', 'Statement_AR', 'Year']);

    // Strategic Pillars sheet
    createSheet('Strategic_Pillars', data.pillars || [], ['Code', 'Name', 'Name_AR', 'Description', 'Weight', 'Status', 'Color']);

    // Perspectives sheet
    createSheet('Perspectives', data.perspectives || [], ['Code', 'Name', 'Name_AR', 'Status']);

    // Business Units sheet
    createSheet('Business_Units', data.businessUnits || [], ['Code', 'Name', 'Name_AR', 'Abbreviation', 'Level', 'Parent_Code', 'Status']);

    // Objectives sheet
    const objectivesForExcel = (data.objectives || []).map(obj => ({
      ...obj,
      Business_Unit: obj.Business_Unit_Code || obj.Business_Unit || '',
      Parent_Objective: obj.Parent_Objective_Code || obj.Parent_Objective || '',
      Perspective: obj.Perspective_Code || obj.Perspective || ''
    }));
    createSheet('Objectives', objectivesForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Level', 'Business_Unit',
      'Parent_Objective', 'Pillar_Code', 'Perspective', 'Weight', 'Status', 'Is_Operational'
    ]);

    // KPIs sheet
    const kpisForExcel = (data.kpis || []).map(kpi => {
      const objective = (data.objectives || []).find(obj => obj.Code === kpi.Objective_Code);
      return {
        ...kpi,
        Level: objective?.Level || kpi.Level || '',
        Business_Unit: kpi.Business_Unit_Code || kpi.Business_Unit || '',
        Monthly_Targets: JSON.stringify(kpi.Monthly_Targets || {})
      };
    });
    createSheet('KPIs', kpisForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Description_AR', 'Level', 'Objective_Code', 'Business_Unit',
      'Impact_Type', 'Indicator_Type', 'Approval_Status', 'Formula', 'Data_Points', 'Target', 'Target_Mode', 'Monthly_Targets', 'Unit', 'Weight', 'Status', 'Review_Status', 'Discussion', 'Polarity'
    ]);

    // Objective Links sheet
    createSheet('Objective_Links', data.objectiveLinks || [], ['From_Code', 'To_Code', 'From_Side', 'To_Side', 'Waypoints']);

    // Map Layout sheet
    const mapLayoutData = Object.entries(data.mapPositions || {}).map(([code, pos]) => ({
      Objective_Code: code,
      X: pos.x,
      Y: pos.y,
      Width: pos.width || '',
      Height: pos.height || ''
    }));
    createSheet('Map_Layout', mapLayoutData, ['Objective_Code', 'X', 'Y', 'Width', 'Height']);

    // Global Values sheet
    const globalValuesForExcel = (data.globalValues || []).map(gv => ({
      ...gv,
      Monthly_Values: JSON.stringify(gv.Monthly_Values || {})
    }));
    createSheet('Global_Values', globalValuesForExcel, ['Code', 'Name', 'Name_AR', 'Type', 'Description', 'Monthly_Values']);

    // Measures sheet
    const measuresForExcel = (data.measures || []).map(m => ({
      ...m,
      Formula_Elements: JSON.stringify(m.Formula_Elements || []),
      Parameters: JSON.stringify(m.Parameters || [])
    }));
    createSheet('Measures', measuresForExcel, ['Code', 'Name', 'KPI_Code', 'Formula_Elements', 'Formula_Text', 'Parameters', 'Last_Value', 'Last_Calculated', 'Status', 'Created_At']);

    // Parameter Values sheet
    const parameterValuesData = [];
    Object.entries(data.parameterValues || {}).forEach(([measureCode, params]) => {
      Object.entries(params || {}).forEach(([paramName, months]) => {
        Object.entries(months || {}).forEach(([monthKey, value]) => {
          if (value !== null && value !== undefined) {
            parameterValuesData.push({
              Measure_Code: measureCode,
              Parameter_Name: paramName,
              Month_Key: monthKey,
              Value: value
            });
          }
        });
      });
    });
    createSheet('Parameter_Values', parameterValuesData, ['Measure_Code', 'Parameter_Name', 'Month_Key', 'Value']);

    // Calculated Values sheet
    const calculatedValuesData = [];
    Object.entries(data.calculatedValues || {}).forEach(([measureCode, months]) => {
      Object.entries(months || {}).forEach(([monthKey, result]) => {
        if (result && result.value !== null && result.value !== undefined) {
          calculatedValuesData.push({
            Measure_Code: measureCode,
            Month_Key: monthKey,
            Value: result.value,
            Error: result.error || ''
          });
        }
      });
    });
    createSheet('Calculated_Values', calculatedValuesData, ['Measure_Code', 'Month_Key', 'Value', 'Error']);

    // Achievements sheet
    const achievementsData = [];
    Object.entries(data.achievements || {}).forEach(([measureCode, months]) => {
      Object.entries(months || {}).forEach(([monthKey, value]) => {
        if (value !== null && value !== undefined) {
          achievementsData.push({
            Measure_Code: measureCode,
            Month_Key: monthKey,
            Achievement: value
          });
        }
      });
    });
    createSheet('Achievements', achievementsData, ['Measure_Code', 'Month_Key', 'Achievement']);

    // Team Members sheet
    createSheet('Team_Members', data.teamMembers || [], [
      'Code', 'Employee_ID', 'Name', 'Name_AR', 'Job_Title', 'Job_Title_AR',
      'Email', 'Photo_URL', 'Hire_Date', 'Reports_To', 'Business_Unit_Code', 'Status'
    ]);

    // Personal Objectives sheet
    createSheet('Personal_Objectives', data.personalObjectives || [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code',
      'Parent_Objective_Code', 'Weight', 'Target_Date', 'Status'
    ]);

    // Employee KPIs sheet
    const employeeKpisForExcel = (data.employeeKpis || []).map(kpi => ({
      ...kpi,
      Monthly_Targets: JSON.stringify(kpi.Monthly_Targets || {})
    }));
    createSheet('Employee_KPIs', employeeKpisForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code', 'Personal_Objective_Code',
      'Formula', 'Data_Points', 'Target', 'Target_Mode', 'Monthly_Targets', 'Unit', 'Weight', 'Polarity', 'Status'
    ]);

    // Employee Achievements sheet
    const employeeAchievementsData = [];
    Object.entries(data.employeeAchievements || {}).forEach(([kpiCode, months]) => {
      Object.entries(months || {}).forEach(([monthKey, value]) => {
        if (value !== null && value !== undefined) {
          const actual = typeof value === 'object' ? value.actual : null;
          const achievement = typeof value === 'object' ? value.achievement : value;
          employeeAchievementsData.push({
            Employee_KPI_Code: kpiCode,
            Month_Key: monthKey,
            Actual: actual,
            Achievement: achievement
          });
        }
      });
    });
    createSheet('Employee_Achievements', employeeAchievementsData, ['Employee_KPI_Code', 'Month_Key', 'Actual', 'Achievement']);

    // Settings sheet
    const settingsData = Object.entries(data.settings || {}).map(([key, value]) => ({
      Key: key,
      Value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
    createSheet('Settings', settingsData, ['Key', 'Value']);

    // BU Scorecard Config sheet
    const buScorecardConfigData = [];
    Object.entries(data.buScorecardConfig || {}).forEach(([buCode, parentWeights]) => {
      Object.entries(parentWeights || {}).forEach(([parentObjCode, weight]) => {
        buScorecardConfigData.push({
          BU_Code: buCode,
          Parent_Objective_Code: parentObjCode,
          Weight: weight
        });
      });
    });
    createSheet('BU_Scorecard_Config', buScorecardConfigData, ['BU_Code', 'Parent_Objective_Code', 'Weight']);

    // Write as plain Excel (unencrypted)
    await workbook.xlsx.writeFile(result.filePath);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error exporting unencrypted file:', error);
    return { success: false, error: error.message };
  }
});

// Generate KPI Cards (keeping for compatibility)
ipcMain.handle('generate-kpi-cards', async (event, { templatePath, outputPath, kpis, businessUnitName }) => {
  try {
    const actualTemplatePath = templatePath || getTemplatePath();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(actualTemplatePath);

    const templateSheet = workbook.worksheets.find(ws => ws.name.startsWith('KPI_'));
    if (!templateSheet) {
      throw new Error('No KPI template sheet found in the template file');
    }

    const outputWorkbook = new ExcelJS.Workbook();
    outputWorkbook.creator = 'CPM Strategy Cascade Tool';
    outputWorkbook.created = new Date();

    const cellMapping = {
      'Code': 'D8',
      'Name': 'H8',
      'Name_AR': 'N8',
      'Description': 'D11',
      'Formula': 'D13',
      'Data_Points': 'D14',
      'Weight': 'L16',
      'Discussion': 'D18',
      'Target': 'M24',
      'Review_Status': 'N1'
    };

    for (const kpi of kpis) {
      const kpiCode = kpi.Code || `KPI_${Date.now()}`;
      const sheetName = kpiCode.toString().substring(0, 31).replace(/[\\/*?[\]]/g, '_');

      const newSheet = outputWorkbook.addWorksheet(sheetName);

      templateSheet.columns.forEach((col, index) => {
        if (col.width) newSheet.getColumn(index + 1).width = col.width;
      });

      templateSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        newSheet.getRow(rowNumber).height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const newCell = newSheet.getCell(rowNumber, colNumber);
          if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
            newCell.value = cell.value.result || '';
          } else {
            newCell.value = cell.value;
          }
          if (cell.style) {
            newCell.style = JSON.parse(JSON.stringify(cell.style));
          }
        });
      });

      templateSheet.model.merges.forEach(merge => {
        try { newSheet.mergeCells(merge); } catch (e) {}
      });

      for (const [field, cellRef] of Object.entries(cellMapping)) {
        const value = kpi[field];
        if (value !== undefined && value !== null) {
          newSheet.getCell(cellRef).value = value;
        }
      }

      newSheet.getCell('D5').value = businessUnitName || kpi.Business_Unit || '';
      newSheet.getCell('D7').value = kpi.Objective_Code || '';
    }

    await outputWorkbook.xlsx.writeFile(outputPath);
    return { success: true, count: kpis.length };
  } catch (error) {
    console.error('Error generating KPI cards:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// LICENSE MANAGEMENT HANDLERS
// ============================================

// Get current license state
ipcMain.handle('license:get-state', async () => {
  try {
    const state = await licenseService.getCurrentState();
    return { success: true, ...state };
  } catch (error) {
    console.error('Error getting license state:', error);
    return { success: false, error: error.message };
  }
});

// Get license data
ipcMain.handle('license:get-data', () => {
  try {
    const data = licenseService.getLicenseData();
    return { success: true, data };
  } catch (error) {
    console.error('Error getting license data:', error);
    return { success: false, error: error.message };
  }
});

// Activate license with key
ipcMain.handle('license:activate', async (event, licenseKey, companyInfo = null) => {
  try {
    const result = await licenseService.activateLicense(licenseKey, companyInfo);
    return result;
  } catch (error) {
    console.error('Error activating license:', error);
    return { success: false, error: error.message };
  }
});

// Deactivate current license
ipcMain.handle('license:deactivate', async () => {
  try {
    const result = await licenseService.deactivateLicense();
    return result;
  } catch (error) {
    console.error('Error deactivating license:', error);
    return { success: false, error: error.message };
  }
});

// Start trial mode
ipcMain.handle('license:start-trial', () => {
  try {
    const result = licenseService.startTrial();
    return result;
  } catch (error) {
    console.error('Error starting trial:', error);
    return { success: false, error: error.message };
  }
});

// Get trial status
ipcMain.handle('license:get-trial-status', () => {
  try {
    const status = licenseService.getTrialStatus();
    return { success: true, ...status };
  } catch (error) {
    console.error('Error getting trial status:', error);
    return { success: false, error: error.message };
  }
});

// Get feature limits
ipcMain.handle('license:get-limits', async () => {
  try {
    const limits = await licenseService.getFeatureLimits();
    return { success: true, limits };
  } catch (error) {
    console.error('Error getting feature limits:', error);
    return { success: false, error: error.message };
  }
});

// Validate current license (force online check)
ipcMain.handle('license:validate', async () => {
  try {
    const licenseKey = licenseService.getLicenseData().licenseKey;
    if (!licenseKey) {
      return { success: false, message: 'No license key found' };
    }
    const result = await licenseService.validateLicense(licenseKey);
    return result;
  } catch (error) {
    console.error('Error validating license:', error);
    return { success: false, error: error.message };
  }
});

// Clear license data (for testing/debugging)
ipcMain.handle('license:clear', () => {
  try {
    const result = licenseService.clearLicenseData();
    return result;
  } catch (error) {
    console.error('Error clearing license data:', error);
    return { success: false, error: error.message };
  }
});

// Get license configuration
ipcMain.handle('license:get-config', () => {
  return {
    trialDays: LICENSE_CONFIG.TRIAL_DAYS,
    gracePeriodDays: LICENSE_CONFIG.GRACE_PERIOD_DAYS,
    validationIntervalDays: LICENSE_CONFIG.VALIDATION_INTERVAL_DAYS,
    trialLimits: LICENSE_CONFIG.TRIAL_LIMITS
  };
});

// Get company logo as base64
ipcMain.handle('license:get-company-logo', () => {
  try {
    const licenseData = licenseService.getLicenseData();
    if (licenseData.companyLogoPath && fs.existsSync(licenseData.companyLogoPath)) {
      const logoBuffer = fs.readFileSync(licenseData.companyLogoPath);
      const ext = path.extname(licenseData.companyLogoPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      const base64 = logoBuffer.toString('base64');
      return { success: true, logo: `data:${mimeType};base64,${base64}` };
    }
    return { success: false, error: 'No logo found' };
  } catch (error) {
    console.error('Error reading company logo:', error);
    return { success: false, error: error.message };
  }
});
