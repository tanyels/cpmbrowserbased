import React, { createContext, useContext, useState, useCallback } from 'react';

const KPIContext = createContext(null);

export function KPIProvider({ children }) {
  const [kpis, setKpis] = useState([]);
  const [originalKpis, setOriginalKpis] = useState([]);
  const [departments, setDepartments] = useState([]); // Manually added departments
  const [headers, setHeaders] = useState([]);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load KPIs from Excel file
  const loadKPIs = useCallback(async (filePath) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.readExcelFile(filePath);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Add review status to each KPI (preserve existing reviewStatus from Excel if present)
      const kpisWithStatus = result.data.map((kpi, index) => ({
        ...kpi,
        _id: `kpi-${index}-${Date.now()}`,
        reviewStatus: kpi.reviewStatus || 'Pending',
        isNew: kpi.isNew || false
      }));

      setHeaders(result.headers);
      setKpis(kpisWithStatus);
      setOriginalKpis(JSON.parse(JSON.stringify(kpisWithStatus)));
      setDepartments([]); // Reset manually added departments
      setCurrentFilePath(filePath);
      setHasUnsavedChanges(false);

      // Save as last opened file
      await window.electronAPI.setLastFilePath(filePath);

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get departments with progress
  const getDepartments = useCallback(() => {
    const deptMap = new Map();

    // Add manually created departments first (so they show even with 0 KPIs)
    departments.forEach(dept => {
      deptMap.set(dept, { total: 0, reviewed: 0 });
    });

    // Add departments from KPIs - support multiple field name variations
    kpis.forEach(kpi => {
      const dept = kpi.Department || kpi.Owner || kpi['Source.Name'] || 'Unknown';
      // Clean up department name if it's a filename
      const cleanDept = dept.replace(/_KPI.*$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      if (!deptMap.has(cleanDept)) {
        deptMap.set(cleanDept, { total: 0, reviewed: 0 });
      }
      const deptData = deptMap.get(cleanDept);
      deptData.total++;
      if (kpi.reviewStatus !== 'Pending') {
        deptData.reviewed++;
      }
    });

    return Array.from(deptMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      reviewed: data.reviewed,
      isComplete: data.total === 0 ? false : data.reviewed === data.total
    }));
  }, [kpis, departments]);

  // Add a new department
  const addDepartment = useCallback((departmentName) => {
    const trimmedName = departmentName.trim();
    if (!trimmedName) return false;

    // Check if department already exists
    const existingDepts = getDepartments();
    if (existingDepts.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) {
      return false; // Department already exists
    }

    setDepartments(prev => [...prev, trimmedName]);
    setHasUnsavedChanges(true);
    return true;
  }, [getDepartments]);

  // Get KPIs by department
  const getKPIsByDepartment = useCallback((department) => {
    return kpis.filter(kpi => {
      const dept = kpi.Department || kpi.Owner || kpi['Source.Name'] || 'Unknown';
      const cleanDept = dept.replace(/_KPI.*$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      return cleanDept === department;
    });
  }, [kpis]);

  // Get single KPI by ID
  const getKPIById = useCallback((id) => {
    return kpis.find(kpi => kpi._id === id);
  }, [kpis]);

  // Update KPI status (Keep, Edit, Retire)
  const updateKPIStatus = useCallback((id, status, updatedData = null) => {
    setKpis(prev => prev.map(kpi => {
      if (kpi._id === id) {
        return {
          ...kpi,
          ...(updatedData || {}),
          reviewStatus: status
        };
      }
      return kpi;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Keep KPI
  const keepKPI = useCallback((id) => {
    updateKPIStatus(id, 'Kept');
  }, [updateKPIStatus]);

  // Edit KPI
  const editKPI = useCallback((id, updatedData) => {
    updateKPIStatus(id, 'Edited', updatedData);
  }, [updateKPIStatus]);

  // Retire KPI
  const retireKPI = useCallback((id) => {
    updateKPIStatus(id, 'Retired');
  }, [updateKPIStatus]);

  // Update discussion notes for a KPI
  const updateDiscussion = useCallback((id, discussion) => {
    setKpis(prev => prev.map(kpi => {
      if (kpi._id === id) {
        return {
          ...kpi,
          Discussion: discussion
        };
      }
      return kpi;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Create new KPI
  const createKPI = useCallback((kpiData, department) => {
    // Find the highest numeric KPI code and increment from there (minimum 1000)
    let maxCode = 999;
    kpis.forEach(kpi => {
      const code = kpi['KPI Code'] || kpi['KPI ID'] || '';
      const numMatch = code.toString().match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num > maxCode) maxCode = num;
      }
    });
    const newKpiCode = maxCode + 1;

    const newKPI = {
      ...kpiData,
      _id: `kpi-new-${Date.now()}`,
      'KPI Code': `KPI_${newKpiCode}`,
      Department: department,
      'Active/Inactive': 2,
      reviewStatus: 'Pending',
      isNew: true
    };

    setKpis(prev => [...prev, newKPI]);
    setHasUnsavedChanges(true);
    return newKPI;
  }, [kpis]);

  // Save changes to the original Excel file
  const saveChanges = useCallback(async () => {
    if (!currentFilePath) {
      console.error('No file path to save to');
      return { success: false, error: 'No file loaded' };
    }

    setIsSaving(true);

    try {
      const result = await window.electronAPI.saveToExcelFile(currentFilePath, kpis, headers);

      if (result.success) {
        setOriginalKpis(JSON.parse(JSON.stringify(kpis)));
        setHasUnsavedChanges(false);
        return { success: true };
      } else {
        console.error('Failed to save:', result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error saving changes:', err);
      return { success: false, error: err.message };
    } finally {
      setIsSaving(false);
    }
  }, [kpis, currentFilePath, headers]);

  // Discard changes
  const discardChanges = useCallback(() => {
    setKpis(JSON.parse(JSON.stringify(originalKpis)));
    setHasUnsavedChanges(false);
  }, [originalKpis]);

  // Export to Excel
  const exportToExcel = useCallback(async () => {
    const year = 2026;
    const defaultName = `Final_KPI_Library_${year}.xlsx`;

    const filePath = await window.electronAPI.saveFileDialog(defaultName);
    if (!filePath) {
      return { success: false, cancelled: true };
    }

    const result = await window.electronAPI.exportExcel(filePath, { kpis });
    return result;
  }, [kpis]);

  // Export KPI Cards for a department
  const exportKPICards = useCallback(async (departmentName) => {
    // Get KPIs for this department (only non-retired, reviewed ones)
    const deptKPIs = kpis.filter(kpi => {
      const dept = kpi.Department || kpi.Owner || kpi['Source.Name'] || 'Unknown';
      const cleanDept = dept.replace(/_KPI.*$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      return cleanDept === departmentName && kpi.reviewStatus !== 'Retired' && kpi.reviewStatus !== 'Pending';
    });

    if (deptKPIs.length === 0) {
      return { success: false, error: 'No reviewed KPIs to export for this department' };
    }

    // Ask for output file location
    const cleanDeptName = departmentName.replace(/[\\/*?[\]:]/g, '_');
    const defaultName = `${cleanDeptName}_KPI_Cards.xlsx`;
    const outputPath = await window.electronAPI.saveFileDialog(defaultName);

    if (!outputPath) {
      return { success: false, cancelled: true };
    }

    // Pass null for templatePath - main process will use bundled template
    const result = await window.electronAPI.generateKPICards(null, outputPath, deptKPIs, departmentName);
    return result;
  }, [kpis]);

  // Get statistics
  const getStats = useCallback(() => {
    const stats = {
      total: kpis.length,
      pending: 0,
      kept: 0,
      edited: 0,
      retired: 0,
      new: 0
    };

    kpis.forEach(kpi => {
      switch (kpi.reviewStatus) {
        case 'Pending':
          stats.pending++;
          break;
        case 'Kept':
          stats.kept++;
          break;
        case 'Edited':
          stats.edited++;
          break;
        case 'Retired':
          stats.retired++;
          break;
        case 'New':
          stats.new++;
          break;
      }
    });

    return stats;
  }, [kpis]);

  const value = {
    kpis,
    headers,
    currentFilePath,
    hasUnsavedChanges,
    isLoading,
    isSaving,
    error,
    loadKPIs,
    getDepartments,
    addDepartment,
    getKPIsByDepartment,
    getKPIById,
    keepKPI,
    editKPI,
    retireKPI,
    updateDiscussion,
    createKPI,
    saveChanges,
    discardChanges,
    exportToExcel,
    exportKPICards,
    getStats
  };

  return (
    <KPIContext.Provider value={value}>
      {children}
    </KPIContext.Provider>
  );
}

export function useKPI() {
  const context = useContext(KPIContext);
  if (!context) {
    throw new Error('useKPI must be used within a KPIProvider');
  }
  return context;
}
