import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fileService } from '../services/fileService';

const StrategyContext = createContext(null);

export const useStrategy = () => {
  const context = useContext(StrategyContext);
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
};

export const StrategyProvider = ({ children }) => {
  // File state - for web, filePath is actually the display name
  const [filePath, setFilePath] = useState(null);
  const [isFromCloud, setIsFromCloud] = useState(false);
  const [cloudStoragePath, setCloudStoragePath] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // In-memory file buffer (for web, we keep the data in memory)
  const [currentFileBuffer, setCurrentFileBuffer] = useState(null);

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
  const [calculatedValues, setCalculatedValues] = useState({});
  const [achievements, setAchievements] = useState({});

  // Team Members module data
  const [teamMembers, setTeamMembers] = useState([]);
  const [personalObjectives, setPersonalObjectives] = useState([]);
  const [employeeKpis, setEmployeeKpis] = useState([]);
  const [employeeAchievements, setEmployeeAchievements] = useState({});

  // Admin settings
  const [settings, setSettings] = useState({
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

  // BU Scorecard Configuration
  const [buScorecardConfig, setBuScorecardConfig] = useState({});

  // Track if we're currently loading to avoid marking changes during load
  const isLoadingRef = useRef(false);

  // Ensure operational objectives exist for all business units
  useEffect(() => {
    if (businessUnits.length === 0) return;

    const missingOperationalObjs = [];
    businessUnits.forEach(bu => {
      const opObjCode = `OBJ_${bu.Level}_OPERATIONAL_${bu.Code}`;
      const hasOperational = objectives.some(
        obj => obj.Is_Operational && obj.Business_Unit_Code === bu.Code
      );

      if (!hasOperational) {
        missingOperationalObjs.push({
          Code: opObjCode,
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

    if (missingOperationalObjs.length > 0) {
      setObjectives(prev => [...prev, ...missingOperationalObjs]);
      if (!isLoadingRef.current) {
        setHasUnsavedChanges(true);
      }
    }
  }, [businessUnits, objectives]);

  // Navigation state
  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState(null);

  // Generate incremental ID based on existing items
  const generateIncrementalId = useCallback((prefix, existingItems, codeField = 'Code') => {
    const numbers = existingItems
      .map(item => {
        const code = item[codeField] || '';
        const match = code.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[_]*(\\d+)$`, 'i'));
        if (match) {
          return parseInt(match[1], 10);
        }
        const numMatch = code.match(/(\d+)$/);
        if (numMatch && code.startsWith(prefix)) {
          return parseInt(numMatch[1], 10);
        }
        return 0;
      })
      .filter(n => !isNaN(n));

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    return `${prefix}_${String(nextNum).padStart(3, '0')}`;
  }, []);

  // Load file from ArrayBuffer (decrypted cloud file)
  const loadFromBuffer = useCallback(async (arrayBuffer, displayName, storagePath) => {
    setIsLoading(true);
    isLoadingRef.current = true;
    try {
      const data = await fileService.readStrategyFile(arrayBuffer);

      setFilePath(displayName);
      setIsFromCloud(true);
      setCloudStoragePath(storagePath);
      setCurrentFileBuffer(arrayBuffer);

      setVisionState(data.vision || { Statement: '', Statement_AR: '' });
      setMissionState(data.mission || { Statement: '', Statement_AR: '' });
      setPillars(data.pillars || []);
      setPerspectives(data.perspectives || []);
      setObjectives(data.objectives || []);
      setBusinessUnits(data.businessUnits || []);
      setKpis(data.kpis || []);
      setObjectiveLinks(data.objectiveLinks || []);
      setMapPositionsState(data.mapPositions || {});
      setGlobalValues(data.globalValues || []);
      setMeasures(data.measures || []);
      setParameterValues(data.parameterValues || {});
      setCalculatedValues(data.calculatedValues || {});
      setAchievements(data.achievements || {});
      setTeamMembers(data.teamMembers || []);
      setPersonalObjectives(data.personalObjectives || []);
      setEmployeeKpis(data.employeeKpis || []);
      setEmployeeAchievements(data.employeeAchievements || {});
      setSettings(prev => ({ ...prev, ...(data.settings || {}) }));
      setBuScorecardConfig(data.buScorecardConfig || {});
      setHasUnsavedChanges(false);

      setTimeout(() => {
        isLoadingRef.current = false;
      }, 100);

      return { success: true };
    } catch (error) {
      console.error('Error loading file:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Legacy loadFile for compatibility - not used in web version
  const loadFile = useCallback(async (path) => {
    console.warn('loadFile called in web version - use loadFromBuffer instead');
    return { success: false, error: 'Use loadFromBuffer in web version' };
  }, []);

  // Close file
  const closeFile = useCallback(() => {
    setFilePath(null);
    setIsFromCloud(false);
    setCloudStoragePath(null);
    setCurrentFileBuffer(null);
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
    setBuScorecardConfig({});
    setHasUnsavedChanges(false);
  }, []);

  // Get current data object
  const getCurrentData = useCallback(() => {
    return {
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
      teamMembers,
      personalObjectives,
      employeeKpis,
      employeeAchievements,
      settings,
      buScorecardConfig
    };
  }, [vision, mission, pillars, perspectives, objectives, businessUnits, kpis, objectiveLinks, mapPositions, globalValues, measures, parameterValues, calculatedValues, achievements, teamMembers, personalObjectives, employeeKpis, employeeAchievements, settings, buScorecardConfig]);

  // Save file - returns encrypted buffer for cloud upload
  const saveFile = useCallback(async () => {
    setIsSaving(true);
    try {
      const data = getCurrentData();
      const encryptedBuffer = await fileService.writeStrategyFile(data);
      setCurrentFileBuffer(encryptedBuffer);
      setHasUnsavedChanges(false);
      return { success: true, buffer: encryptedBuffer };
    } catch (error) {
      console.error('Error saving file:', error);
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [getCurrentData]);

  // Save file as - same as saveFile for web version, returns buffer
  const saveFileAs = useCallback(async () => {
    return await saveFile();
  }, [saveFile]);

  // Create new file (in memory)
  const createNewFile = useCallback(async (displayName = 'New Strategy') => {
    setIsLoading(true);
    try {
      const emptyData = fileService.createNewStrategy();

      setFilePath(displayName);
      setIsFromCloud(false);
      setCloudStoragePath(null);
      setCurrentFileBuffer(null);

      setVisionState(emptyData.vision);
      setMissionState(emptyData.mission);
      setPillars(emptyData.pillars);
      setPerspectives(emptyData.perspectives);
      setObjectives(emptyData.objectives);
      setBusinessUnits(emptyData.businessUnits);
      setKpis(emptyData.kpis);
      setObjectiveLinks(emptyData.objectiveLinks);
      setMapPositionsState(emptyData.mapPositions);
      setGlobalValues(emptyData.globalValues);
      setMeasures(emptyData.measures);
      setParameterValues(emptyData.parameterValues);
      setCalculatedValues(emptyData.calculatedValues);
      setAchievements(emptyData.achievements);
      setTeamMembers(emptyData.teamMembers);
      setPersonalObjectives(emptyData.personalObjectives);
      setEmployeeKpis(emptyData.employeeKpis);
      setEmployeeAchievements(emptyData.employeeAchievements);
      setSettings(prev => ({ ...prev, ...emptyData.settings }));
      setBuScorecardConfig(emptyData.buScorecardConfig);
      setHasUnsavedChanges(false);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate sample file - not available in web version
  const generateSampleFile = useCallback(async () => {
    console.warn('generateSampleFile not available in web version');
    return { success: false, error: 'Sample file generation not available in web version' };
  }, []);

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
  }, []);

  const updateBusinessUnit = useCallback((code, updates) => {
    setBusinessUnits(prev => prev.map(bu => bu.Code === code ? { ...bu, ...updates } : bu));
    setHasUnsavedChanges(true);
  }, []);

  const deleteBusinessUnit = useCallback((code) => {
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

    if ((level === 'L2' || level === 'L3') && objective.Business_Unit_Code) {
      const bu = businessUnits.find(b => b.Code === objective.Business_Unit_Code);
      if (bu?.Abbreviation) {
        prefix = `OBJ_${level}_${bu.Abbreviation}`;
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
    let buCode = kpi.Business_Unit || kpi.Business_Unit_Code || '';

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
    // Use browser confirm instead of Electron dialog
    const confirmed = window.confirm('Are you sure you want to retire this KPI?');
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
    const exists = objectiveLinks.some(
      link => link.From_Code === fromCode && link.To_Code === toCode
    );
    if (exists) return null;

    const newLink = {
      From_Code: fromCode,
      To_Code: toCode,
      From_Side: fromSide,
      To_Side: toSide,
      Waypoints: ''
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

  const setMapPosition = useCallback((objectiveCode, x, y, width = null, height = null) => {
    setMapPositionsState(prev => {
      const existing = prev[objectiveCode] || {};
      return {
        ...prev,
        [objectiveCode]: {
          x,
          y,
          width: width !== null ? width : existing.width,
          height: height !== null ? height : existing.height
        }
      };
    });
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
      Type: gv.Type || 'number',
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
  // PARAMETER VALUES
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

  const updateCalculatedValues = useCallback((newCalculatedValues) => {
    setCalculatedValues(newCalculatedValues);
    setHasUnsavedChanges(true);
  }, []);

  const updateAchievements = useCallback((newAchievements) => {
    setAchievements(newAchievements);
    setHasUnsavedChanges(true);
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    setHasUnsavedChanges(true);
  }, []);

  // ============================================
  // BU SCORECARD CONFIG
  // ============================================

  const setBuParentWeight = useCallback((buCode, parentObjCode, weight) => {
    setBuScorecardConfig(prev => ({
      ...prev,
      [buCode]: {
        ...(prev[buCode] || {}),
        [parentObjCode]: parseFloat(weight) || 0
      }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const removeBuParentWeight = useCallback((buCode, parentObjCode) => {
    setBuScorecardConfig(prev => {
      const newConfig = { ...prev };
      if (newConfig[buCode]) {
        const { [parentObjCode]: removed, ...rest } = newConfig[buCode];
        newConfig[buCode] = rest;
        if (Object.keys(newConfig[buCode]).length === 0) {
          delete newConfig[buCode];
        }
      }
      return newConfig;
    });
    setHasUnsavedChanges(true);
  }, []);

  const getBuParentWeights = useCallback((buCode) => {
    return buScorecardConfig[buCode] || {};
  }, [buScorecardConfig]);

  const getBuTotalParentWeight = useCallback((buCode) => {
    const weights = buScorecardConfig[buCode] || {};
    return Object.values(weights).reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
  }, [buScorecardConfig]);

  // ============================================
  // WEIGHT VALIDATION HELPERS
  // ============================================

  const validateL1Weights = useCallback(() => {
    const result = {};
    const l1Objectives = objectives.filter(o => o.Level === 'L1' && o.Status === 'Active' && !o.Is_Operational);

    pillars.filter(p => p.Status === 'Active').forEach(pillar => {
      const pillarSOs = l1Objectives.filter(o => o.Pillar_Code === pillar.Code);
      const soTotalWeight = pillarSOs.reduce((sum, so) => sum + (parseFloat(so.Weight) || 0), 0);

      result[pillar.Code] = {
        pillarWeight: parseFloat(pillar.Weight) || 0,
        soTotalWeight,
        isValid: Math.abs(soTotalWeight - (parseFloat(pillar.Weight) || 0)) < 0.01,
        sos: {}
      };

      pillarSOs.forEach(so => {
        const soKPIs = kpis.filter(k => k.Objective_Code === so.Code && k.Review_Status !== 'Retired');
        const kpiTotalWeight = soKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.Weight) || 0), 0);

        result[pillar.Code].sos[so.Code] = {
          soWeight: parseFloat(so.Weight) || 0,
          kpiTotalWeight,
          isValid: Math.abs(kpiTotalWeight - (parseFloat(so.Weight) || 0)) < 0.01
        };
      });
    });

    return result;
  }, [pillars, objectives, kpis]);

  const validateL2Weights = useCallback((buCode) => {
    const result = {};
    const buParentWeights = buScorecardConfig[buCode] || {};
    const l2Objectives = objectives.filter(o =>
      o.Level === 'L2' &&
      o.Business_Unit_Code === buCode &&
      o.Status === 'Active' &&
      !o.Is_Operational
    );

    Object.entries(buParentWeights).forEach(([soCode, soWeight]) => {
      const soObjectives = l2Objectives.filter(o => o.Parent_Objective_Code === soCode);
      const objTotalWeight = soObjectives.reduce((sum, obj) => sum + (parseFloat(obj.Weight) || 0), 0);

      result[soCode] = {
        soWeight: parseFloat(soWeight) || 0,
        objTotalWeight,
        isValid: Math.abs(objTotalWeight - (parseFloat(soWeight) || 0)) < 0.01,
        objectives: {}
      };

      soObjectives.forEach(obj => {
        const objKPIs = kpis.filter(k => k.Objective_Code === obj.Code && k.Review_Status !== 'Retired');
        const kpiTotalWeight = objKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.Weight) || 0), 0);

        result[soCode].objectives[obj.Code] = {
          objWeight: parseFloat(obj.Weight) || 0,
          kpiTotalWeight,
          isValid: Math.abs(kpiTotalWeight - (parseFloat(obj.Weight) || 0)) < 0.01
        };
      });
    });

    return result;
  }, [buScorecardConfig, objectives, kpis]);

  const validateL3Weights = useCallback((buCode) => {
    const result = {};
    const buParentWeights = buScorecardConfig[buCode] || {};
    const l3Objectives = objectives.filter(o =>
      o.Level === 'L3' &&
      o.Business_Unit_Code === buCode &&
      o.Status === 'Active' &&
      !o.Is_Operational
    );

    Object.entries(buParentWeights).forEach(([l2ObjCode, l2ObjWeight]) => {
      const l3Objs = l3Objectives.filter(o => o.Parent_Objective_Code === l2ObjCode);
      const objTotalWeight = l3Objs.reduce((sum, obj) => sum + (parseFloat(obj.Weight) || 0), 0);

      result[l2ObjCode] = {
        parentWeight: parseFloat(l2ObjWeight) || 0,
        objTotalWeight,
        isValid: Math.abs(objTotalWeight - (parseFloat(l2ObjWeight) || 0)) < 0.01,
        objectives: {}
      };

      l3Objs.forEach(obj => {
        const objKPIs = kpis.filter(k => k.Objective_Code === obj.Code && k.Review_Status !== 'Retired');
        const kpiTotalWeight = objKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.Weight) || 0), 0);

        result[l2ObjCode].objectives[obj.Code] = {
          objWeight: parseFloat(obj.Weight) || 0,
          kpiTotalWeight,
          isValid: Math.abs(kpiTotalWeight - (parseFloat(obj.Weight) || 0)) < 0.01
        };
      });
    });

    return result;
  }, [buScorecardConfig, objectives, kpis]);

  const getAvailableParentObjectives = useCallback((buCode) => {
    const bu = businessUnits.find(b => b.Code === buCode);
    if (!bu) return [];

    const currentWeights = buScorecardConfig[buCode] || {};
    const assignedCodes = Object.keys(currentWeights);

    if (bu.Level === 'L2') {
      return objectives.filter(o =>
        o.Level === 'L1' &&
        o.Status === 'Active' &&
        !o.Is_Operational &&
        !assignedCodes.includes(o.Code)
      );
    } else if (bu.Level === 'L3') {
      const parentL2BU = bu.Parent_Code;
      return objectives.filter(o =>
        o.Level === 'L2' &&
        o.Business_Unit_Code === parentL2BU &&
        o.Status === 'Active' &&
        !o.Is_Operational &&
        !assignedCodes.includes(o.Code)
      );
    }

    return [];
  }, [businessUnits, objectives, buScorecardConfig]);

  const initializeBuScorecardConfig = useCallback((buCode) => {
    const bu = businessUnits.find(b => b.Code === buCode);
    if (!bu) return;

    const currentConfig = buScorecardConfig[buCode] || {};
    if (Object.keys(currentConfig).length > 0) return;

    const newConfig = {};

    if (bu.Level === 'L2') {
      const buL2Objectives = objectives.filter(o =>
        o.Level === 'L2' &&
        o.Business_Unit_Code === buCode &&
        o.Status === 'Active' &&
        !o.Is_Operational
      );

      const soWeightSums = {};
      buL2Objectives.forEach(obj => {
        if (obj.Parent_Objective_Code) {
          if (!soWeightSums[obj.Parent_Objective_Code]) {
            soWeightSums[obj.Parent_Objective_Code] = 0;
          }
          soWeightSums[obj.Parent_Objective_Code] += parseFloat(obj.Weight) || 0;
        }
      });

      Object.entries(soWeightSums).forEach(([soCode, weightSum]) => {
        newConfig[soCode] = Math.round(weightSum * 10) / 10;
      });

      const operationalObj = objectives.find(o =>
        o.Level === 'L2' &&
        o.Business_Unit_Code === buCode &&
        o.Is_Operational &&
        o.Status === 'Active'
      );
      if (operationalObj) {
        const operationalKPIs = kpis.filter(k => k.Objective_Code === operationalObj.Code);
        const operationalWeight = operationalKPIs.reduce((sum, k) => sum + (parseFloat(k.Weight) || 0), 0);
        newConfig[operationalObj.Code] = Math.round(operationalWeight * 10) / 10;
      }
    } else if (bu.Level === 'L3') {
      const buL3Objectives = objectives.filter(o =>
        o.Level === 'L3' &&
        o.Business_Unit_Code === buCode &&
        o.Status === 'Active' &&
        !o.Is_Operational
      );

      const l2WeightSums = {};
      buL3Objectives.forEach(obj => {
        if (obj.Parent_Objective_Code) {
          if (!l2WeightSums[obj.Parent_Objective_Code]) {
            l2WeightSums[obj.Parent_Objective_Code] = 0;
          }
          l2WeightSums[obj.Parent_Objective_Code] += parseFloat(obj.Weight) || 0;
        }
      });

      Object.entries(l2WeightSums).forEach(([l2Code, weightSum]) => {
        newConfig[l2Code] = Math.round(weightSum * 10) / 10;
      });

      const operationalObj = objectives.find(o =>
        o.Level === 'L3' &&
        o.Business_Unit_Code === buCode &&
        o.Is_Operational &&
        o.Status === 'Active'
      );
      if (operationalObj) {
        const operationalKPIs = kpis.filter(k => k.Objective_Code === operationalObj.Code);
        const operationalWeight = operationalKPIs.reduce((sum, k) => sum + (parseFloat(k.Weight) || 0), 0);
        newConfig[operationalObj.Code] = Math.round(operationalWeight * 10) / 10;
      }
    }

    if (Object.keys(newConfig).length > 0) {
      setBuScorecardConfig(prev => ({
        ...prev,
        [buCode]: newConfig
      }));
      setHasUnsavedChanges(true);
    }
  }, [businessUnits, objectives, buScorecardConfig, kpis]);

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
    const hasObjectives = personalObjectives.some(o => o.Employee_Code === code);
    if (hasObjectives) {
      return { success: false, error: 'Cannot delete employee with personal objectives' };
    }
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
    const tree = {};
    const activeMembers = teamMembers.filter(m => m.Status === 'Active');

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
  // CONTEXT VALUE
  // ============================================

  const markAsFromCloud = useCallback((storagePath) => {
    setIsFromCloud(true);
    setCloudStoragePath(storagePath);
  }, []);

  const value = {
    // File state
    filePath,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    isFromCloud,
    cloudStoragePath,
    markAsFromCloud,
    currentFileBuffer,

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
    loadFromBuffer,
    saveFile,
    saveFileAs,
    closeFile,
    createNewFile,
    generateSampleFile,
    getCurrentData,

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

    // BU Scorecard Config
    buScorecardConfig,
    setBuParentWeight,
    removeBuParentWeight,
    getBuParentWeights,
    initializeBuScorecardConfig,
    getBuTotalParentWeight,
    getAvailableParentObjectives,

    // Weight Validation
    validateL1Weights,
    validateL2Weights,
    validateL3Weights,

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
    getStats
  };

  return (
    <StrategyContext.Provider value={value}>
      {children}
    </StrategyContext.Provider>
  );
};

export default StrategyContext;
