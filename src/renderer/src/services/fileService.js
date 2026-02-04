// Browser-compatible File Service using ExcelJS
import ExcelJS from 'exceljs';
import { browserCryptoService } from './browserCryptoService';

// Helper to generate IDs
const generateId = (prefix) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}${random}`.toUpperCase();
};

// Helper to safely parse JSON
const safeJsonParse = (str, defaultValue) => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
};

// Helper to read sheet data into array of objects
const readSheetData = (sheet) => {
  const data = [];
  const headers = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value?.toString() || `Col${colNumber}`;
      });
    } else {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          let value = cell.value;
          if (value && typeof value === 'object' && value.result !== undefined) {
            value = value.result;
          }
          if (value && typeof value === 'object' && value.text !== undefined) {
            value = value.text;
          }
          rowData[header] = value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    }
  });

  return data;
};

class FileService {
  // Read strategy data from ArrayBuffer (encrypted .cpme)
  async readStrategyFile(arrayBuffer) {
    let workbook = new ExcelJS.Workbook();

    // Decrypt the file
    const decryptedBuffer = await browserCryptoService.decrypt(arrayBuffer);
    await workbook.xlsx.load(decryptedBuffer);

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
      teamMembers: [],
      personalObjectives: [],
      employeeKpis: [],
      employeeAchievements: {},
      buScorecardConfig: {},
      settings: {}
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

    // Read Perspectives
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
        Level: kpi.Level || '',
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
        From_Side: link.From_Side || 'bottom',
        To_Side: link.To_Side || 'top',
        Waypoints: safeJsonParse(link.Waypoints, [])
      }));
    }

    // Read Map Layout
    const layoutSheet = workbook.getWorksheet('Map_Layout');
    if (layoutSheet) {
      readSheetData(layoutSheet).forEach(item => {
        if (item.Objective_Code) {
          data.mapPositions[item.Objective_Code] = {
            x: item.X || 0,
            y: item.Y || 0,
            width: item.Width || undefined,
            height: item.Height || undefined
          };
        }
      });
    }

    // Read Global Values
    const gvSheet = workbook.getWorksheet('Global_Values');
    if (gvSheet) {
      data.globalValues = readSheetData(gvSheet).map(gv => ({
        Code: gv.Code || generateId('GV'),
        Name: gv.Name || '',
        Name_AR: gv.Name_AR || '',
        Type: gv.Type || 'number',
        Description: gv.Description || '',
        Monthly_Values: safeJsonParse(gv.Monthly_Values, {})
      }));
    }

    // Read Measures
    const measuresSheet = workbook.getWorksheet('Measures');
    if (measuresSheet) {
      data.measures = readSheetData(measuresSheet).map(m => ({
        Code: m.Code || generateId('MSR'),
        Name: m.Name || '',
        KPI_Code: m.KPI_Code || '',
        Formula_Elements: safeJsonParse(m.Formula_Elements, []),
        Formula_Text: m.Formula_Text || '',
        Parameters: safeJsonParse(m.Parameters, []),
        Last_Value: m.Last_Value,
        Last_Calculated: m.Last_Calculated,
        Status: m.Status || 'Active',
        Created_At: m.Created_At
      }));
    }

    // Read Parameter Values
    const pvSheet = workbook.getWorksheet('Parameter_Values');
    if (pvSheet) {
      readSheetData(pvSheet).forEach(item => {
        if (!data.parameterValues[item.Measure_Code]) {
          data.parameterValues[item.Measure_Code] = {};
        }
        if (!data.parameterValues[item.Measure_Code][item.Parameter_Name]) {
          data.parameterValues[item.Measure_Code][item.Parameter_Name] = {};
        }
        data.parameterValues[item.Measure_Code][item.Parameter_Name][item.Month_Key] = item.Value;
      });
    }

    // Read Calculated Values
    const cvSheet = workbook.getWorksheet('Calculated_Values');
    if (cvSheet) {
      readSheetData(cvSheet).forEach(item => {
        if (!data.calculatedValues[item.Measure_Code]) {
          data.calculatedValues[item.Measure_Code] = {};
        }
        data.calculatedValues[item.Measure_Code][item.Month_Key] = {
          value: item.Value,
          error: item.Error || null
        };
      });
    }

    // Read Achievements
    const achSheet = workbook.getWorksheet('Achievements');
    if (achSheet) {
      readSheetData(achSheet).forEach(item => {
        if (!data.achievements[item.Measure_Code]) {
          data.achievements[item.Measure_Code] = {};
        }
        data.achievements[item.Measure_Code][item.Month_Key] = item.Achievement;
      });
    }

    // Read Team Members
    const tmSheet = workbook.getWorksheet('Team_Members');
    if (tmSheet) {
      data.teamMembers = readSheetData(tmSheet).map(tm => ({
        Code: tm.Code || generateId('EMP'),
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

    // Read Personal Objectives
    const poSheet = workbook.getWorksheet('Personal_Objectives');
    if (poSheet) {
      data.personalObjectives = readSheetData(poSheet).map(po => ({
        Code: po.Code || generateId('PO'),
        Name: po.Name || '',
        Name_AR: po.Name_AR || '',
        Description: po.Description || '',
        Employee_Code: po.Employee_Code || '',
        Parent_Objective_Code: po.Parent_Objective_Code || '',
        Weight: po.Weight || 0,
        Target_Date: po.Target_Date || '',
        Status: po.Status || 'Active'
      }));
    }

    // Read Employee KPIs
    const ekSheet = workbook.getWorksheet('Employee_KPIs');
    if (ekSheet) {
      data.employeeKpis = readSheetData(ekSheet).map(ek => ({
        Code: ek.Code || generateId('EKPI'),
        Name: ek.Name || '',
        Name_AR: ek.Name_AR || '',
        Description: ek.Description || '',
        Employee_Code: ek.Employee_Code || '',
        Personal_Objective_Code: ek.Personal_Objective_Code || '',
        Formula: ek.Formula || '',
        Data_Points: ek.Data_Points || '',
        Target: ek.Target || '',
        Target_Mode: ek.Target_Mode || 'single',
        Monthly_Targets: safeJsonParse(ek.Monthly_Targets, {}),
        Unit: ek.Unit || '',
        Weight: ek.Weight || 0,
        Polarity: ek.Polarity || 'Positive',
        Status: ek.Status || 'Active'
      }));
    }

    // Read Employee Achievements
    const eaSheet = workbook.getWorksheet('Employee_Achievements');
    if (eaSheet) {
      readSheetData(eaSheet).forEach(item => {
        if (!data.employeeAchievements[item.Employee_KPI_Code]) {
          data.employeeAchievements[item.Employee_KPI_Code] = {};
        }
        data.employeeAchievements[item.Employee_KPI_Code][item.Month_Key] = {
          actual: item.Actual,
          achievement: item.Achievement
        };
      });
    }

    // Read Settings
    const settingsSheet = workbook.getWorksheet('Settings');
    if (settingsSheet) {
      readSheetData(settingsSheet).forEach(item => {
        if (item.Key) {
          try {
            data.settings[item.Key] = JSON.parse(item.Value);
          } catch {
            data.settings[item.Key] = item.Value;
          }
        }
      });
    }

    // Read BU Scorecard Config
    const buscSheet = workbook.getWorksheet('BU_Scorecard_Config');
    if (buscSheet) {
      readSheetData(buscSheet).forEach(item => {
        if (!data.buScorecardConfig[item.BU_Code]) {
          data.buScorecardConfig[item.BU_Code] = {};
        }
        data.buScorecardConfig[item.BU_Code][item.Parent_Objective_Code] = item.Weight;
      });
    }

    return data;
  }

  // Write strategy data to ArrayBuffer (encrypted .cpme)
  async writeStrategyFile(data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPM Strategy Cascade Tool';
    workbook.created = new Date();

    // Helper to create sheet with data
    const createSheet = (name, sheetData, headers) => {
      const sheet = workbook.addWorksheet(name);

      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      sheetData.forEach(item => {
        const rowValues = headers.map(h => item[h] ?? '');
        sheet.addRow(rowValues);
      });

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

    // Strategic Pillars
    createSheet('Strategic_Pillars', data.pillars || [], ['Code', 'Name', 'Name_AR', 'Description', 'Weight', 'Status', 'Color']);

    // Perspectives
    createSheet('Perspectives', data.perspectives || [], ['Code', 'Name', 'Name_AR', 'Status']);

    // Business Units
    createSheet('Business_Units', data.businessUnits || [], ['Code', 'Name', 'Name_AR', 'Abbreviation', 'Level', 'Parent_Code', 'Status']);

    // Objectives
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

    // KPIs
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

    // Objective Links
    createSheet('Objective_Links', data.objectiveLinks || [], ['From_Code', 'To_Code', 'From_Side', 'To_Side', 'Waypoints']);

    // Map Layout
    const mapLayoutData = Object.entries(data.mapPositions || {}).map(([code, pos]) => ({
      Objective_Code: code,
      X: pos.x,
      Y: pos.y,
      Width: pos.width || '',
      Height: pos.height || ''
    }));
    createSheet('Map_Layout', mapLayoutData, ['Objective_Code', 'X', 'Y', 'Width', 'Height']);

    // Global Values
    const globalValuesForExcel = (data.globalValues || []).map(gv => ({
      ...gv,
      Monthly_Values: JSON.stringify(gv.Monthly_Values || {})
    }));
    createSheet('Global_Values', globalValuesForExcel, ['Code', 'Name', 'Name_AR', 'Type', 'Description', 'Monthly_Values']);

    // Measures
    const measuresForExcel = (data.measures || []).map(m => ({
      ...m,
      Formula_Elements: JSON.stringify(m.Formula_Elements || []),
      Parameters: JSON.stringify(m.Parameters || [])
    }));
    createSheet('Measures', measuresForExcel, ['Code', 'Name', 'KPI_Code', 'Formula_Elements', 'Formula_Text', 'Parameters', 'Last_Value', 'Last_Calculated', 'Status', 'Created_At']);

    // Parameter Values
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

    // Calculated Values
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

    // Achievements
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

    // Team Members
    createSheet('Team_Members', data.teamMembers || [], [
      'Code', 'Employee_ID', 'Name', 'Name_AR', 'Job_Title', 'Job_Title_AR',
      'Email', 'Photo_URL', 'Hire_Date', 'Reports_To', 'Business_Unit_Code', 'Status'
    ]);

    // Personal Objectives
    createSheet('Personal_Objectives', data.personalObjectives || [], [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code',
      'Parent_Objective_Code', 'Weight', 'Target_Date', 'Status'
    ]);

    // Employee KPIs
    const employeeKpisForExcel = (data.employeeKpis || []).map(kpi => ({
      ...kpi,
      Monthly_Targets: JSON.stringify(kpi.Monthly_Targets || {})
    }));
    createSheet('Employee_KPIs', employeeKpisForExcel, [
      'Code', 'Name', 'Name_AR', 'Description', 'Employee_Code', 'Personal_Objective_Code',
      'Formula', 'Data_Points', 'Target', 'Target_Mode', 'Monthly_Targets', 'Unit', 'Weight', 'Polarity', 'Status'
    ]);

    // Employee Achievements
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

    // Settings
    const settingsData = Object.entries(data.settings || {}).map(([key, value]) => ({
      Key: key,
      Value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
    createSheet('Settings', settingsData, ['Key', 'Value']);

    // BU Scorecard Config
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

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Encrypt the buffer
    const encryptedBuffer = await browserCryptoService.encrypt(buffer);

    return encryptedBuffer;
  }

  // Create a new empty strategy file
  createNewStrategy() {
    return {
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
      teamMembers: [],
      personalObjectives: [],
      employeeKpis: [],
      employeeAchievements: {},
      buScorecardConfig: {},
      settings: {}
    };
  }
}

export const fileService = new FileService();
