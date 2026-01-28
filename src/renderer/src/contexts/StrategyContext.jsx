import React, { createContext, useContext, useState, useCallback } from 'react';

const StrategyContext = createContext(null);

export const useStrategy = () => {
  const context = useContext(StrategyContext);
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
};

export const StrategyProvider = ({ children }) => {
  // File state
  const [filePath, setFilePath] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Strategy data
  const [vision, setVisionState] = useState({ Statement: '', Statement_AR: '' });
  const [mission, setMissionState] = useState({ Statement: '', Statement_AR: '' });
  const [pillars, setPillars] = useState([]);
  const [perspectives, setPerspectives] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [objectiveLinks, setObjectiveLinks] = useState([]);
  const [mapPositions, setMapPositionsState] = useState({});

  // Measure module data
  const [globalValues, setGlobalValues] = useState([]);
  const [measures, setMeasures] = useState([]);
  const [parameterValues, setParameterValues] = useState({});
  const [calculatedValues, setCalculatedValues] = useState({}); // { measureCode: { monthKey: { value, error } } }
  const [achievements, setAchievements] = useState({}); // { measureCode: { monthKey: value } }

  // Team Members module data
  const [teamMembers, setTeamMembers] = useState([]);
  const [personalObjectives, setPersonalObjectives] = useState([]);
  const [employeeKpis, setEmployeeKpis] = useState([]);
  const [employeeAchievements, setEmployeeAchievements] = useState({}); // { employeeKpiCode: { monthKey: value } }

  // Admin settings
  const [settings, setSettings] = useState({
    // Achievement Thresholds
    thresholdExcellent: 100,
    thresholdGood: 80,
    thresholdWarning: 60,
    // Achievement Colors
    colorExcellent: '#28a745',
    colorGood: '#ffc107',
    colorWarning: '#fd7e14',
    colorPoor: '#dc3545',
    // Achievement Limits
    overachievementCap: 200,
    employeeOverachievementCap: 200,
    gaugeMaxValue: 150,
    // Organization Info
    organizationName: '',
    currencySymbol: '$'
  });

  // Navigation state
  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState(null);

  // Generate incremental ID based on existing items
  const generateIncrementalId = useCallback((prefix, existingItems, codeField = 'Code') => {
    // Extract numbers from existing codes with this prefix
    const numbers = existingItems
      .map(item => {
        const code = item[codeField] || '';
        // Match the last number in the code (e.g., PIL_001 -> 1, OBJ_L1_005 -> 5)
        const match = code.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[_]*(\\d+)$`, 'i'));
        if (match) {
          return parseInt(match[1], 10);
        }
        // Also try to match any trailing number
        const numMatch = code.match(/(\d+)$/);
        if (numMatch && code.startsWith(prefix)) {
          return parseInt(numMatch[1], 10);
        }
        return 0;
      })
      .filter(n => !isNaN(n));

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    // Pad with zeros to 3 digits
    return `${prefix}_${String(nextNum).padStart(3, '0')}`;
  }, []);

  // Load file
  const loadFile = useCallback(async (path) => {
    setIsLoading(true);
    try {
      console.log('=== LOAD FILE CALLED ===');
      console.log('LOAD - path:', path);
      const result = await window.electronAPI.readStrategyFile(path);
      console.log('LOAD - result.success:', result.success);
      console.log('LOAD - teamMembers from file:', result.data?.teamMembers);
      console.log('LOAD - teamMembers count:', result.data?.teamMembers?.length || 0);
      console.log('LOAD - personalObjectives count:', result.data?.personalObjectives?.length || 0);
      console.log('LOAD - employeeKpis count:', result.data?.employeeKpis?.length || 0);
      if (result.success) {
        setFilePath(path);
        setVisionState(result.data.vision || { Statement: '', Statement_AR: '' });
        setMissionState(result.data.mission || { Statement: '', Statement_AR: '' });
        setPillars(result.data.pillars || []);
        setPerspectives(result.data.perspectives || []);
        setObjectives(result.data.objectives || []);
        setBusinessUnits(result.data.businessUnits || []);
        setKpis(result.data.kpis || []);
        setObjectiveLinks(result.data.objectiveLinks || []);
        setMapPositionsState(result.data.mapPositions || {});
        setGlobalValues(result.data.globalValues || []);
        setMeasures(result.data.measures || []);
        setParameterValues(result.data.parameterValues || {});
        setCalculatedValues(result.data.calculatedValues || {});
        setAchievements(result.data.achievements || {});
        // Team Members data
        setTeamMembers(result.data.teamMembers || []);
        setPersonalObjectives(result.data.personalObjectives || []);
        setEmployeeKpis(result.data.employeeKpis || []);
        setEmployeeAchievements(result.data.employeeAchievements || {});
        setSettings(prev => ({ ...prev, ...(result.data.settings || {}) }));
        setHasUnsavedChanges(false);
        await window.electronAPI.setLastFilePath(path);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Close file
  const closeFile = useCallback(() => {
    setFilePath(null);
    setVisionState({ Statement: '', Statement_AR: '' });
    setMissionState({ Statement: '', Statement_AR: '' });
    setPillars([]);
    setPerspectives([]);
    setObjectives([]);
    setBusinessUnits([]);
    setKpis([]);
    setObjectiveLinks([]);
    setMapPositionsState({});
    setGlobalValues([]);
    setMeasures([]);
    setParameterValues({});
    setCalculatedValues({});
    setAchievements({});
    // Team Members data
    setTeamMembers([]);
    setPersonalObjectives([]);
    setEmployeeKpis([]);
    setEmployeeAchievements({});
    setSettings({
      thresholdExcellent: 100,
      thresholdGood: 80,
      thresholdWarning: 60,
      colorExcellent: '#28a745',
      colorGood: '#ffc107',
      colorWarning: '#fd7e14',
      colorPoor: '#dc3545',
      overachievementCap: 200,
      employeeOverachievementCap: 200,
      gaugeMaxValue: 150,
      organizationName: '',
      currencySymbol: '$'
    });
    setHasUnsavedChanges(false);
  }, []);

  // Save file
  const saveFile = useCallback(async () => {
    if (!filePath) return { success: false, error: 'No file path' };

    setIsSaving(true);
    try {
      console.log('=== SAVE FILE CALLED ===');
      console.log('SAVE - filePath:', filePath);
      console.log('SAVE - teamMembers state:', teamMembers);
      console.log('SAVE - teamMembers count:', teamMembers.length);
      console.log('SAVE - personalObjectives count:', personalObjectives.length);
      console.log('SAVE - employeeKpis count:', employeeKpis.length);
      const data = {
        vision,
        mission,
        pillars,
        perspectives,
        objectives,
        businessUnits,
        kpis,
        objectiveLinks,
        mapPositions,
        globalValues,
        measures,
        parameterValues,
        calculatedValues,
        achievements,
        // Team Members data
        teamMembers,
        personalObjectives,
        employeeKpis,
        employeeAchievements,
        settings
      };

      const result = await window.electronAPI.saveStrategyFile(filePath, data);
      if (result.success) {
        setHasUnsavedChanges(false);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [filePath, vision, mission, pillars, perspectives, objectives, businessUnits, kpis, objectiveLinks, mapPositions, globalValues, measures, parameterValues, calculatedValues, achievements, teamMembers, personalObjectives, employeeKpis, employeeAchievements, settings]);

  // Create new file
  const createNewFile = useCallback(async () => {
    const path = await window.electronAPI.saveFileDialog('Strategy_Cascade.xlsx');
    if (!path) return { success: false, cancelled: true };

    setIsLoading(true);
    try {
      const result = await window.electronAPI.createNewStrategyFile(path);
      if (result.success) {
        setFilePath(path);
        setVisionState({ Statement: '', Statement_AR: '' });
        setMissionState({ Statement: '', Statement_AR: '' });
        setPillars([]);
        setPerspectives([]);
        setObjectives([]);
        setBusinessUnits([]);
        setKpis([]);
        setObjectiveLinks([]);
        setMapPositionsState({});
        setGlobalValues([]);
        setMeasures([]);
        setParameterValues({});
        setCalculatedValues({});
        setAchievements({});
        setHasUnsavedChanges(false);
        await window.electronAPI.setLastFilePath(path);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate sample file
  const generateSampleFile = useCallback(async () => {
    const path = await window.electronAPI.saveFileDialog('Strategy_Cascade_Sample.xlsx');
    if (!path) return { success: false, cancelled: true };

    setIsLoading(true);
    try {
      const result = await window.electronAPI.generateSampleFile(path);
      if (result.success) {
        // Load the generated file
        return await loadFile(path);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [loadFile]);

  // ============================================
  // VISION & MISSION
  // ============================================

  const setVision = useCallback((newVision) => {
    setVisionState(newVision);
    setHasUnsavedChanges(true);
  }, []);

  const setMission = useCallback((newMission) => {
    setMissionState(newMission);
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // PILLARS
  // ============================================

  const addPillar = useCallback((pillar) => {
    const newPillar = {
      Code: pillar.Code || generateIncrementalId('PIL', pillars),
      Name: pillar.Name || '',
      Name_AR: pillar.Name_AR || '',
      Description: pillar.Description || '',
      Weight: pillar.Weight || 0,
      Status: 'Active',
      Color: pillar.Color || ''
    };
    setPillars(prev => [...prev, newPillar]);
    setHasUnsavedChanges(true);
    return newPillar;
  }, [pillars, generateIncrementalId]);

  const updatePillar = useCallback((code, updates) => {
    setPillars(prev => prev.map(p => p.Code === code ? { ...p, ...updates } : p));
    setHasUnsavedChanges(true);
  }, []);

  const deletePillar = useCallback((code) => {
    setPillars(prev => prev.filter(p => p.Code !== code));
    setHasUnsavedChanges(true);
  }, []);

  const archivePillar = useCallback((code) => {
    setPillars(prev => prev.map(p => p.Code === code ? { ...p, Status: 'Archived' } : p));
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // PERSPECTIVES
  // ============================================

  const addPerspective = useCallback((perspective) => {
    const newPerspective = {
      Code: perspective.Code || generateIncrementalId('PER', perspectives),
      Name: perspective.Name || '',
      Name_AR: perspective.Name_AR || '',
      Status: 'Active'
    };
    setPerspectives(prev => [...prev, newPerspective]);
    setHasUnsavedChanges(true);
    return newPerspective;
  }, [perspectives, generateIncrementalId]);

  const updatePerspective = useCallback((code, updates) => {
    setPerspectives(prev => prev.map(p => p.Code === code ? { ...p, ...updates } : p));
    setHasUnsavedChanges(true);
  }, []);

  const deletePerspective = useCallback((code) => {
    setPerspectives(prev => prev.filter(p => p.Code !== code));
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // BUSINESS UNITS
  // ============================================

  const addBusinessUnit = useCallback((bu) => {
    if (!bu.Abbreviation) {
      console.error('Abbreviation is required for Business Unit');
      return null;
    }
    const abbr = bu.Abbreviation.toUpperCase();
    const newBU = {
      Code: bu.Code || `BU_${abbr}`,
      Name: bu.Name || '',
      Name_AR: bu.Name_AR || '',
      Abbreviation: abbr,
      Level: bu.Level || 'L1',
      Parent_Code: bu.Parent_Code || '',
      Status: 'Active'
    };
    setBusinessUnits(prev => [...prev, newBU]);

    // Auto-create Operational objective for this BU
    const operationalObj = {
      Code: `OBJ_${newBU.Level}_OPERATIONAL_${newBU.Code}`,
      Name: 'Operational',
      Name_AR: 'تشغيلي',
      Description: 'Operational objective for non-strategic KPIs',
      Level: newBU.Level,
      Business_Unit_Code: newBU.Code,
      Parent_Objective_Code: '',
      Pillar_Code: '',
      Perspective_Code: '',
      Weight: 0,
      Status: 'Active',
      Is_Operational: true
    };
    setObjectives(prev => [...prev, operationalObj]);

    setHasUnsavedChanges(true);
    return newBU;
  }, [businessUnits, generateIncrementalId]);

  const updateBusinessUnit = useCallback((code, updates) => {
    setBusinessUnits(prev => prev.map(bu => bu.Code === code ? { ...bu, ...updates } : bu));
    setHasUnsavedChanges(true);
  }, []);

  const deleteBusinessUnit = useCallback((code) => {
    // Also delete the auto-generated Operational objective
    setObjectives(prev => prev.filter(obj =>
      !(obj.Is_Operational && obj.Business_Unit_Code === code)
    ));
    setBusinessUnits(prev => prev.filter(bu => bu.Code !== code));
    setHasUnsavedChanges(true);
  }, []);

  const archiveBusinessUnit = useCallback((code) => {
    setBusinessUnits(prev => prev.map(bu => bu.Code === code ? { ...bu, Status: 'Archived' } : bu));
    setHasUnsavedChanges(true);
  }, []);

  const getBusinessUnitsByLevel = useCallback((level) => {
    return businessUnits.filter(bu => bu.Level === level && bu.Status === 'Active');
  }, [businessUnits]);

  const getChildBusinessUnits = useCallback((parentCode) => {
    return businessUnits.filter(bu => bu.Parent_Code === parentCode && bu.Status === 'Active');
  }, [businessUnits]);

  const getBusinessUnitTree = useCallback(() => {
    const l1Units = businessUnits.filter(bu => bu.Level === 'L1' && bu.Status === 'Active');
    return l1Units.map(l1 => ({
      ...l1,
      children: businessUnits
        .filter(bu => bu.Parent_Code === l1.Code && bu.Level === 'L2' && bu.Status === 'Active')
        .map(l2 => ({
          ...l2,
          children: businessUnits.filter(bu => bu.Parent_Code === l2.Code && bu.Level === 'L3' && bu.Status === 'Active')
        }))
    }));
  }, [businessUnits]);

  // ============================================
  // OBJECTIVES
  // ============================================

  const addObjective = useCallback((objective) => {
    const level = objective.Level || 'L1';
    let prefix = `OBJ_${level}`;
    let relevantObjectives = objectives.filter(o => o.Level === level && !o.Is_Operational);

    // For L2/L3, include BU abbreviation in the code
    if ((level === 'L2' || level === 'L3') && objective.Business_Unit_Code) {
      const bu = businessUnits.find(b => b.Code === objective.Business_Unit_Code);
      if (bu?.Abbreviation) {
        prefix = `OBJ_${level}_${bu.Abbreviation}`;
        // Filter by this BU for numbering
        relevantObjectives = objectives.filter(o =>
          o.Level === level &&
          o.Business_Unit_Code === objective.Business_Unit_Code &&
          !o.Is_Operational
        );
      }
    }

    const newObjective = {
      Code: objective.Code || generateIncrementalId(prefix, relevantObjectives),
      Name: objective.Name || '',
      Name_AR: objective.Name_AR || '',
      Description: objective.Description || '',
      Level: level,
      Business_Unit_Code: objective.Business_Unit_Code || '',
      Parent_Objective_Code: objective.Parent_Objective_Code || '',
      Pillar_Code: objective.Pillar_Code || '',
      Perspective_Code: objective.Perspective_Code || '',
      Weight: objective.Weight || 0,
      Status: 'Active',
      Is_Operational: false
    };
    setObjectives(prev => [...prev, newObjective]);
    setHasUnsavedChanges(true);
    return newObjective;
  }, [objectives, businessUnits, generateIncrementalId]);

  const updateObjective = useCallback((code, updates) => {
    setObjectives(prev => prev.map(obj => obj.Code === code ? { ...obj, ...updates } : obj));
    setHasUnsavedChanges(true);
  }, []);

  const deleteObjective = useCallback((code) => {
    const objective = objectives.find(o => o.Code === code);
    if (objective?.Is_Operational) {
      return { success: false, error: 'Cannot delete Operational objective' };
    }
    setObjectives(prev => prev.filter(obj => obj.Code !== code));
    setHasUnsavedChanges(true);
    return { success: true };
  }, [objectives]);

  const archiveObjective = useCallback(async (code) => {
    const objective = objectives.find(o => o.Code === code);
    if (objective?.Is_Operational) {
      return { success: false, error: 'Cannot archive Operational objective' };
    }

    // Check for linked KPIs
    const linkedKPIs = kpis.filter(kpi => kpi.Objective_Code === code);
    if (linkedKPIs.length > 0) {
      return {
        success: false,
        error: `Cannot archive objective with ${linkedKPIs.length} linked KPI(s). Re-link KPIs first.`,
        linkedKPIs
      };
    }

    setObjectives(prev => prev.map(obj => obj.Code === code ? { ...obj, Status: 'Archived' } : obj));
    setHasUnsavedChanges(true);
    return { success: true };
  }, [objectives, kpis]);

  const getObjectivesByLevel = useCallback((level) => {
    return objectives.filter(obj => obj.Level === level && obj.Status === 'Active');
  }, [objectives]);

  const getObjectivesByBusinessUnit = useCallback((buCode, level) => {
    return objectives.filter(obj =>
      obj.Business_Unit_Code === buCode &&
      obj.Level === level &&
      obj.Status === 'Active'
    );
  }, [objectives]);

  const getObjectivesForKPIDropdown = useCallback((buCode, level) => {
    // Get objectives for this BU at this level
    return objectives.filter(obj =>
      obj.Business_Unit_Code === buCode &&
      obj.Level === level &&
      obj.Status === 'Active'
    );
  }, [objectives]);

  // ============================================
  // KPIs
  // ============================================

  const addKPI = useCallback((kpi) => {
    // Determine the BU from the Objective (KPIs are linked to Objectives, which are linked to BUs)
    let buCode = kpi.Business_Unit || kpi.Business_Unit_Code || '';

    // If no BU code but we have an Objective, get BU from the Objective
    if (!buCode && kpi.Objective_Code) {
      const objective = objectives.find(o => o.Code === kpi.Objective_Code);
      buCode = objective?.Business_Unit_Code || '';
    }

    const bu = businessUnits.find(b => b.Code === buCode);
    const buAbbr = bu?.Abbreviation || '';
    const buLevel = bu?.Level || 'L1';

    let prefix = 'KPI';
    let relevantKpis = kpis;

    if (buAbbr) {
      prefix = `KPI_${buLevel}_${buAbbr}`;
      // Filter KPIs by this BU for numbering
      relevantKpis = kpis.filter(k => k.Business_Unit_Code === buCode || k.Business_Unit === buCode);
    }

    const generatedCode = generateIncrementalId(prefix, relevantKpis);
    const newKPI = {
      _id: generatedCode,
      Code: kpi.Code || generatedCode,
      Name: kpi.Name || '',
      Name_AR: kpi.Name_AR || '',
      Description: kpi.Description || '',
      Description_AR: kpi.Description_AR || '',
      Objective_Code: kpi.Objective_Code || '',
      Business_Unit_Code: buCode,
      Impact_Type: kpi.Impact_Type || 'Direct',
      Indicator_Type: kpi.Indicator_Type || 'Lagging',
      Approval_Status: kpi.Approval_Status || 'Recommended',
      Formula: kpi.Formula || '',
      Data_Points: kpi.Data_Points || '',
      Polarity: kpi.Polarity || 'Positive',
      Unit: kpi.Unit || '',
      Target: kpi.Target || '',
      Weight: kpi.Weight || 0,
      Status: 'Active',
      Review_Status: 'New',
      Discussion: kpi.Discussion || ''
    };
    setKpis(prev => [...prev, newKPI]);
    setHasUnsavedChanges(true);
    return newKPI;
  }, [kpis, businessUnits, objectives, generateIncrementalId]);

  const updateKPI = useCallback((code, updates) => {
    setKpis(prev => prev.map(kpi => kpi.Code === code ? { ...kpi, ...updates } : kpi));
    setHasUnsavedChanges(true);
  }, []);

  const setKPIReviewStatus = useCallback((code, status) => {
    setKpis(prev => prev.map(kpi =>
      kpi.Code === code ? { ...kpi, Review_Status: status } : kpi
    ));
    setHasUnsavedChanges(true);
  }, []);

  const deleteKPI = useCallback((code) => {
    setKpis(prev => prev.filter(kpi => kpi.Code !== code));
    setHasUnsavedChanges(true);
  }, []);

  const retireKPI = useCallback(async (code) => {
    const confirmed = await window.electronAPI.showConfirmDialog(
      'Retire KPI',
      'Are you sure you want to retire this KPI?'
    );
    if (confirmed) {
      setKpis(prev => prev.map(kpi =>
        kpi.Code === code ? { ...kpi, Review_Status: 'Retired' } : kpi
      ));
      setHasUnsavedChanges(true);
      return { success: true };
    }
    return { success: false, cancelled: true };
  }, []);

  const getKPIsByObjective = useCallback((objectiveCode) => {
    return kpis.filter(kpi => kpi.Objective_Code === objectiveCode && kpi.Review_Status !== 'Retired');
  }, [kpis]);

  const getKPIsByBusinessUnit = useCallback((buCode) => {
    return kpis.filter(kpi => kpi.Business_Unit_Code === buCode && kpi.Review_Status !== 'Retired');
  }, [kpis]);

  const getKPIsByLevel = useCallback((level) => {
    const levelBUs = businessUnits.filter(bu => bu.Level === level).map(bu => bu.Code);
    return kpis.filter(kpi => levelBUs.includes(kpi.Business_Unit_Code) && kpi.Review_Status !== 'Retired');
  }, [kpis, businessUnits]);

  const getOrphanedKPIs = useCallback(() => {
    const activeObjectiveCodes = objectives
      .filter(obj => obj.Status === 'Active')
      .map(obj => obj.Code);
    return kpis.filter(kpi =>
      kpi.Objective_Code &&
      !activeObjectiveCodes.includes(kpi.Objective_Code) &&
      kpi.Review_Status !== 'Retired'
    );
  }, [kpis, objectives]);

  // ============================================
  // OBJECTIVE LINKS
  // ============================================

  const addObjectiveLink = useCallback((fromCode, toCode, fromSide = null, toSide = null) => {
    // Check if link already exists
    const exists = objectiveLinks.some(
      link => link.From_Code === fromCode && link.To_Code === toCode
    );
    if (exists) return null;

    const newLink = {
      From_Code: fromCode,
      To_Code: toCode,
      From_Side: fromSide,
      To_Side: toSide,
      Waypoints: '' // JSON string of waypoints array
    };
    setObjectiveLinks(prev => [...prev, newLink]);
    setHasUnsavedChanges(true);
    return newLink;
  }, [objectiveLinks]);

  const updateObjectiveLink = useCallback((fromCode, toCode, updates) => {
    setObjectiveLinks(prev => prev.map(link => {
      if (link.From_Code === fromCode && link.To_Code === toCode) {
        return { ...link, ...updates };
      }
      return link;
    }));
    setHasUnsavedChanges(true);
  }, []);

  const removeObjectiveLink = useCallback((fromCode, toCode) => {
    setObjectiveLinks(prev => prev.filter(
      link => !(link.From_Code === fromCode && link.To_Code === toCode)
    ));
    setHasUnsavedChanges(true);
  }, []);

  const getObjectiveLinks = useCallback(() => {
    return objectiveLinks;
  }, [objectiveLinks]);

  // ============================================
  // MAP POSITIONS
  // ============================================

  const setMapPosition = useCallback((objectiveCode, x, y) => {
    setMapPositionsState(prev => ({
      ...prev,
      [objectiveCode]: { x, y }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const setMapPositions = useCallback((positions) => {
    setMapPositionsState(positions);
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // GLOBAL VALUES
  // ============================================

  const addGlobalValue = useCallback((gv) => {
    const newGlobalValue = {
      Code: gv.Code || generateIncrementalId('GV', globalValues),
      Name: gv.Name || '',
      Name_AR: gv.Name_AR || '',
      Type: gv.Type || 'number', // number, percentage, currency
      Description: gv.Description || '',
      Monthly_Values: gv.Monthly_Values || {},
      Status: 'Active'
    };
    setGlobalValues(prev => [...prev, newGlobalValue]);
    setHasUnsavedChanges(true);
    return newGlobalValue;
  }, [globalValues, generateIncrementalId]);

  const updateGlobalValue = useCallback((code, updates) => {
    setGlobalValues(prev => prev.map(gv => gv.Code === code ? { ...gv, ...updates } : gv));
    setHasUnsavedChanges(true);
  }, []);

  const deleteGlobalValue = useCallback((code) => {
    setGlobalValues(prev => prev.filter(gv => gv.Code !== code));
    setHasUnsavedChanges(true);
  }, []);

  const setGlobalValueMonthly = useCallback((code, monthKey, value) => {
    setGlobalValues(prev => prev.map(gv => {
      if (gv.Code === code) {
        return {
          ...gv,
          Monthly_Values: {
            ...gv.Monthly_Values,
            [monthKey]: value
          }
        };
      }
      return gv;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // MEASURES
  // ============================================

  const addMeasure = useCallback((measure) => {
    const newMeasure = {
      Code: measure.Code || generateIncrementalId('MSR', measures),
      Name: measure.Name || '',
      KPI_Code: measure.KPI_Code || '',
      Formula_Elements: measure.Formula_Elements || [],
      Formula_Text: measure.Formula_Text || '',
      Parameters: measure.Parameters || [],
      Last_Value: null,
      Last_Calculated: null,
      Status: 'Active',
      Created_At: new Date().toISOString()
    };
    setMeasures(prev => [...prev, newMeasure]);
    setHasUnsavedChanges(true);
    return newMeasure;
  }, [measures, generateIncrementalId]);

  const updateMeasure = useCallback((code, updates) => {
    setMeasures(prev => prev.map(m => m.Code === code ? { ...m, ...updates } : m));
    setHasUnsavedChanges(true);
  }, []);

  const deleteMeasure = useCallback((code) => {
    setMeasures(prev => prev.filter(m => m.Code !== code));
    setHasUnsavedChanges(true);
  }, []);

  const getMeasureByKPI = useCallback((kpiCode) => {
    return measures.find(m => m.KPI_Code === kpiCode);
  }, [measures]);

  // ============================================
  // PARAMETER VALUES (Monthly data entry for measure parameters)
  // ============================================

  const setParameterValue = useCallback((measureCode, paramName, monthKey, value) => {
    setParameterValues(prev => ({
      ...prev,
      [measureCode]: {
        ...(prev[measureCode] || {}),
        [paramName]: {
          ...((prev[measureCode] || {})[paramName] || {}),
          [monthKey]: value
        }
      }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const getParameterValues = useCallback((measureCode, monthKey) => {
    const measureParams = parameterValues[measureCode] || {};
    const result = {};
    Object.keys(measureParams).forEach(paramName => {
      result[paramName] = measureParams[paramName][monthKey] || null;
    });
    return result;
  }, [parameterValues]);

  // Update calculated values (called from DataEntryView after calculation)
  const updateCalculatedValues = useCallback((newCalculatedValues) => {
    setCalculatedValues(newCalculatedValues);
    setHasUnsavedChanges(true);
  }, []);

  // Update achievements (called from DataEntryView after calculation)
  const updateAchievements = useCallback((newAchievements) => {
    setAchievements(newAchievements);
    setHasUnsavedChanges(true);
  }, []);

  // Update admin settings
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // TEAM MEMBERS
  // ============================================

  const addTeamMember = useCallback((member) => {
    const newMember = {
      Code: member.Code || generateIncrementalId('EMP', teamMembers),
      Employee_ID: member.Employee_ID || '',
      Name: member.Name || '',
      Name_AR: member.Name_AR || '',
      Job_Title: member.Job_Title || '',
      Job_Title_AR: member.Job_Title_AR || '',
      Email: member.Email || '',
      Photo_URL: member.Photo_URL || '',
      Hire_Date: member.Hire_Date || '',
      Reports_To: member.Reports_To || '',
      Business_Unit_Code: member.Business_Unit_Code || '',
      Status: 'Active'
    };
    setTeamMembers(prev => [...prev, newMember]);
    setHasUnsavedChanges(true);
    return newMember;
  }, [teamMembers, generateIncrementalId]);

  const updateTeamMember = useCallback((code, updates) => {
    setTeamMembers(prev => prev.map(m => m.Code === code ? { ...m, ...updates } : m));
    setHasUnsavedChanges(true);
  }, []);

  const deleteTeamMember = useCallback((code) => {
    // Check for dependent personal objectives
    const hasObjectives = personalObjectives.some(o => o.Employee_Code === code);
    if (hasObjectives) {
      return { success: false, error: 'Cannot delete employee with personal objectives' };
    }
    // Check for direct reports
    const hasReports = teamMembers.some(m => m.Reports_To === code);
    if (hasReports) {
      return { success: false, error: 'Cannot delete employee with direct reports' };
    }
    setTeamMembers(prev => prev.filter(m => m.Code !== code));
    setHasUnsavedChanges(true);
    return { success: true };
  }, [personalObjectives, teamMembers]);

  const archiveTeamMember = useCallback((code) => {
    setTeamMembers(prev => prev.map(m =>
      m.Code === code ? { ...m, Status: 'Inactive' } : m
    ));
    setHasUnsavedChanges(true);
  }, []);

  const getTeamMembersByBU = useCallback((buCode) => {
    return teamMembers.filter(m => m.Business_Unit_Code === buCode && m.Status === 'Active');
  }, [teamMembers]);

  const getDirectReports = useCallback((managerCode) => {
    return teamMembers.filter(m => m.Reports_To === managerCode && m.Status === 'Active');
  }, [teamMembers]);

  const getTeamMemberTree = useCallback(() => {
    // Build tree structure grouped by BU, then by reporting hierarchy
    const tree = {};
    const activeMembers = teamMembers.filter(m => m.Status === 'Active');

    // Group by BU first
    activeMembers.forEach(member => {
      const buCode = member.Business_Unit_Code || 'unassigned';
      if (!tree[buCode]) {
        tree[buCode] = [];
      }
      tree[buCode].push({
        ...member,
        children: activeMembers.filter(m => m.Reports_To === member.Code)
      });
    });

    return tree;
  }, [teamMembers]);

  // ============================================
  // PERSONAL OBJECTIVES
  // ============================================

  const addPersonalObjective = useCallback((objective) => {
    const empCode = objective.Employee_Code || '';
    const empObjectives = personalObjectives.filter(o => o.Employee_Code === empCode);
    const newObjective = {
      Code: objective.Code || generateIncrementalId(`POBJ_${empCode}`, empObjectives),
      Name: objective.Name || '',
      Name_AR: objective.Name_AR || '',
      Description: objective.Description || '',
      Employee_Code: empCode,
      Parent_Objective_Code: objective.Parent_Objective_Code || '',
      Weight: objective.Weight || 0,
      Target_Date: objective.Target_Date || '',
      Status: 'Active'
    };
    setPersonalObjectives(prev => [...prev, newObjective]);
    setHasUnsavedChanges(true);
    return newObjective;
  }, [personalObjectives, generateIncrementalId]);

  const updatePersonalObjective = useCallback((code, updates) => {
    setPersonalObjectives(prev => prev.map(o => o.Code === code ? { ...o, ...updates } : o));
    setHasUnsavedChanges(true);
  }, []);

  const deletePersonalObjective = useCallback((code) => {
    // Check for linked employee KPIs
    const hasKPIs = employeeKpis.some(k => k.Personal_Objective_Code === code);
    if (hasKPIs) {
      return { success: false, error: 'Cannot delete objective with linked KPIs' };
    }
    setPersonalObjectives(prev => prev.filter(o => o.Code !== code));
    setHasUnsavedChanges(true);
    return { success: true };
  }, [employeeKpis]);

  const getPersonalObjectivesByEmployee = useCallback((empCode) => {
    return personalObjectives.filter(o => o.Employee_Code === empCode && o.Status === 'Active');
  }, [personalObjectives]);

  // ============================================
  // EMPLOYEE KPIs
  // ============================================

  const addEmployeeKPI = useCallback((kpi) => {
    const empCode = kpi.Employee_Code || '';
    const empKpis = employeeKpis.filter(k => k.Employee_Code === empCode);
    const newKPI = {
      Code: kpi.Code || generateIncrementalId(`EKPI_${empCode}`, empKpis),
      Name: kpi.Name || '',
      Name_AR: kpi.Name_AR || '',
      Description: kpi.Description || '',
      Employee_Code: empCode,
      Personal_Objective_Code: kpi.Personal_Objective_Code || '',
      Formula: kpi.Formula || '',
      Data_Points: kpi.Data_Points || '',
      Target: kpi.Target || '',
      Target_Mode: kpi.Target_Mode || 'single',
      Monthly_Targets: kpi.Monthly_Targets || {},
      Unit: kpi.Unit || '',
      Weight: kpi.Weight || 0,
      Polarity: kpi.Polarity || 'Positive',
      Status: 'Active'
    };
    setEmployeeKpis(prev => [...prev, newKPI]);
    setHasUnsavedChanges(true);
    return newKPI;
  }, [employeeKpis, generateIncrementalId]);

  const updateEmployeeKPI = useCallback((code, updates) => {
    setEmployeeKpis(prev => prev.map(k => k.Code === code ? { ...k, ...updates } : k));
    setHasUnsavedChanges(true);
  }, []);

  const deleteEmployeeKPI = useCallback((code) => {
    setEmployeeKpis(prev => prev.filter(k => k.Code !== code));
    // Also clean up achievements
    setEmployeeAchievements(prev => {
      const newAchievements = { ...prev };
      delete newAchievements[code];
      return newAchievements;
    });
    setHasUnsavedChanges(true);
  }, []);

  const getEmployeeKPIsByObjective = useCallback((objCode) => {
    return employeeKpis.filter(k => k.Personal_Objective_Code === objCode && k.Status === 'Active');
  }, [employeeKpis]);

  const getEmployeeKPIsByEmployee = useCallback((empCode) => {
    return employeeKpis.filter(k => k.Employee_Code === empCode && k.Status === 'Active');
  }, [employeeKpis]);

  // Update employee achievements
  const updateEmployeeAchievements = useCallback((newAchievements) => {
    setEmployeeAchievements(newAchievements);
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // STATISTICS
  // ============================================

  const getStats = useCallback(() => {
    const activeKPIs = kpis.filter(k => k.Review_Status !== 'Retired');
    return {
      totalKPIs: activeKPIs.length,
      keptKPIs: activeKPIs.filter(k => k.Review_Status === 'Kept').length,
      editedKPIs: activeKPIs.filter(k => k.Review_Status === 'Edited').length,
      newKPIs: activeKPIs.filter(k => k.Review_Status === 'New').length,
      pendingKPIs: activeKPIs.filter(k => k.Review_Status === 'Pending').length,
      retiredKPIs: kpis.filter(k => k.Review_Status === 'Retired').length,
      totalObjectives: objectives.filter(o => o.Status === 'Active' && !o.Is_Operational).length,
      l1Objectives: objectives.filter(o => o.Level === 'L1' && o.Status === 'Active' && !o.Is_Operational).length,
      l2Objectives: objectives.filter(o => o.Level === 'L2' && o.Status === 'Active' && !o.Is_Operational).length,
      l3Objectives: objectives.filter(o => o.Level === 'L3' && o.Status === 'Active' && !o.Is_Operational).length,
      totalBusinessUnits: businessUnits.filter(bu => bu.Status === 'Active').length,
      totalPillars: pillars.filter(p => p.Status === 'Active').length,
      orphanedKPIs: getOrphanedKPIs().length
    };
  }, [kpis, objectives, businessUnits, pillars, getOrphanedKPIs]);

  // ============================================
  // EXPORT
  // ============================================

  const exportReport = useCallback(async () => {
    const defaultName = `Strategy_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const path = await window.electronAPI.saveFileDialog(defaultName);
    if (!path) return { success: false, cancelled: true };

    const data = {
      vision,
      mission,
      pillars: pillars.filter(p => p.Status === 'Active'),
      perspectives: perspectives.filter(p => p.Status === 'Active'),
      objectives: objectives.filter(o => o.Status === 'Active'),
      businessUnits: businessUnits.filter(bu => bu.Status === 'Active'),
      kpis: kpis.filter(k => k.Review_Status !== 'Retired')
    };

    return await window.electronAPI.exportStrategyReport(path, data);
  }, [vision, mission, pillars, perspectives, objectives, businessUnits, kpis]);

  const exportKPICards = useCallback(async (buCode) => {
    const bu = businessUnits.find(b => b.Code === buCode);
    const buName = bu?.Name || buCode;
    const buKPIs = kpis.filter(k =>
      k.Business_Unit_Code === buCode &&
      k.Review_Status !== 'Retired' &&
      k.Review_Status !== 'Pending'
    );

    if (buKPIs.length === 0) {
      return { success: false, error: 'No reviewed KPIs to export for this Business Unit' };
    }

    const defaultName = `${buName.replace(/[^a-zA-Z0-9]/g, '_')}_KPI_Cards.xlsx`;
    const outputPath = await window.electronAPI.saveFileDialog(defaultName);
    if (!outputPath) return { success: false, cancelled: true };

    return await window.electronAPI.generateKPICards(null, outputPath, buKPIs, buName);
  }, [businessUnits, kpis]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value = {
    // File state
    filePath,
    isLoading,
    isSaving,
    hasUnsavedChanges,

    // Data
    vision,
    mission,
    pillars,
    perspectives,
    objectives,
    businessUnits,
    kpis,
    objectiveLinks,
    mapPositions,
    globalValues,
    measures,
    parameterValues,
    calculatedValues,
    achievements,

    // Navigation
    selectedLevel,
    setSelectedLevel,
    selectedBusinessUnit,
    setSelectedBusinessUnit,

    // File operations
    loadFile,
    saveFile,
    closeFile,
    createNewFile,
    generateSampleFile,

    // Vision & Mission
    setVision,
    setMission,

    // Pillars
    addPillar,
    updatePillar,
    deletePillar,
    archivePillar,

    // Perspectives
    addPerspective,
    updatePerspective,
    deletePerspective,

    // Business Units
    addBusinessUnit,
    updateBusinessUnit,
    deleteBusinessUnit,
    archiveBusinessUnit,
    getBusinessUnitsByLevel,
    getChildBusinessUnits,
    getBusinessUnitTree,

    // Objectives
    addObjective,
    updateObjective,
    deleteObjective,
    archiveObjective,
    getObjectivesByLevel,
    getObjectivesByBusinessUnit,
    getObjectivesForKPIDropdown,

    // KPIs
    addKPI,
    updateKPI,
    deleteKPI,
    setKPIReviewStatus,
    retireKPI,
    getKPIsByObjective,
    getKPIsByBusinessUnit,
    getKPIsByLevel,
    getOrphanedKPIs,

    // Objective Links
    addObjectiveLink,
    updateObjectiveLink,
    removeObjectiveLink,
    getObjectiveLinks,

    // Map Positions
    setMapPosition,
    setMapPositions,

    // Global Values
    addGlobalValue,
    updateGlobalValue,
    deleteGlobalValue,
    setGlobalValueMonthly,

    // Measures
    addMeasure,
    updateMeasure,
    deleteMeasure,
    getMeasureByKPI,

    // Parameter Values
    setParameterValue,
    getParameterValues,

    // Calculated Values & Achievements
    updateCalculatedValues,
    updateAchievements,

    // Admin Settings
    settings,
    updateSettings,

    // Team Members
    teamMembers,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    archiveTeamMember,
    getTeamMembersByBU,
    getDirectReports,
    getTeamMemberTree,

    // Personal Objectives
    personalObjectives,
    addPersonalObjective,
    updatePersonalObjective,
    deletePersonalObjective,
    getPersonalObjectivesByEmployee,

    // Employee KPIs
    employeeKpis,
    addEmployeeKPI,
    updateEmployeeKPI,
    deleteEmployeeKPI,
    getEmployeeKPIsByObjective,
    getEmployeeKPIsByEmployee,
    employeeAchievements,
    updateEmployeeAchievements,

    // Statistics
    getStats,

    // Export
    exportReport,
    exportKPICards
  };

  return (
    <StrategyContext.Provider value={value}>
      {children}
    </StrategyContext.Provider>
  );
};

export default StrategyContext;
