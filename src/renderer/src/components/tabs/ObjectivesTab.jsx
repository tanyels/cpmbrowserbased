import React, { useState, useMemo, useEffect } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';
import { CheckCircle, AlertTriangle } from 'lucide-react';

function ObjectivesTab({ level }) {
  const {
    objectives,
    addObjective,
    updateObjective,
    deleteObjective,
    businessUnits,
    pillars,
    perspectives,
    kpis,
    addKPI,
    updateKPI,
    buScorecardConfig,
    setBuParentWeight,
    removeBuParentWeight,
    getBuParentWeights,
    getAvailableParentObjectives,
    initializeBuScorecardConfig,
    validateL1Weights,
    validateL2Weights,
    validateL3Weights
  } = useStrategy();

  const [selectedPillar, setSelectedPillar] = useState(''); // For L1 pillar filter
  const [selectedParentSO, setSelectedParentSO] = useState(''); // For L2 parent SO filter
  const [selectedL2, setSelectedL2] = useState(''); // For L3 cascading filter
  const [selectedBU, setSelectedBU] = useState('');
  const [editingObj, setEditingObj] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newObj, setNewObj] = useState({
    Name: '',
    Name_AR: '',
    Pillar_Code: '',
    Perspective_Code: '',
    Parent_Objective_Code: '',
    Weight: 0
  });

  // KPI add state
  const [addingKPIForObjective, setAddingKPIForObjective] = useState(null);
  const [newKPI, setNewKPI] = useState({
    Name: '',
    Name_AR: '',
    Description: '',
    Impact_Type: 'Direct',
    Indicator_Type: 'Lagging',
    Approval_Status: 'Recommended',
    Unit: '',
    Target: '',
    Weight: 0
  });

  // Expanded KPIs state - track which objective cards have KPIs expanded
  const [expandedKPIs, setExpandedKPIs] = useState({});

  // Editing KPI state
  const [editingKPICode, setEditingKPICode] = useState(null);
  const [editingKPIData, setEditingKPIData] = useState(null);

  const impactTypes = ['Direct', 'Indirect', 'Complimentary'];
  const indicatorTypes = ['Lagging', 'Leading'];
  const approvalStatuses = ['Recommended', 'Under Discussion', 'Locked'];

  // Auto-initialize scorecard config for L2/L3 BUs with existing parent objectives
  useEffect(() => {
    if (selectedBU && (level === 'L2' || level === 'L3')) {
      initializeBuScorecardConfig(selectedBU);
    }
  }, [selectedBU, level, initializeBuScorecardConfig]);

  // Toggle KPI expansion for an objective
  const toggleKPIExpansion = (objCode) => {
    setExpandedKPIs(prev => ({
      ...prev,
      [objCode]: !prev[objCode]
    }));
  };

  // Get KPIs for a specific objective
  const getKPIsForObjective = (objCode) => {
    return kpis.filter(kpi => kpi.Objective_Code === objCode);
  };

  // Start editing a KPI
  const startEditingKPI = (kpi) => {
    setEditingKPICode(kpi.Code);
    setEditingKPIData({ ...kpi });
  };

  // Cancel editing KPI
  const cancelEditingKPI = () => {
    setEditingKPICode(null);
    setEditingKPIData(null);
  };

  // Save KPI edits
  const saveKPIEdits = () => {
    if (editingKPICode && editingKPIData) {
      updateKPI(editingKPICode, {
        Name: editingKPIData.Name,
        Name_AR: editingKPIData.Name_AR,
        Description: editingKPIData.Description,
        Impact_Type: editingKPIData.Impact_Type,
        Indicator_Type: editingKPIData.Indicator_Type,
        Approval_Status: editingKPIData.Approval_Status,
        Unit: editingKPIData.Unit,
        Target: editingKPIData.Target,
        Weight: parseFloat(editingKPIData.Weight) || 0
      });
      cancelEditingKPI();
    }
  };

  // Reset KPI form
  const resetKPIForm = () => {
    setNewKPI({
      Name: '',
      Name_AR: '',
      Description: '',
      Impact_Type: 'Direct',
      Indicator_Type: 'Lagging',
      Approval_Status: 'Recommended',
      Unit: '',
      Target: '',
      Weight: 0
    });
    setAddingKPIForObjective(null);
  };

  // Handle adding KPI from objective card
  const handleAddKPIFromObjective = (objectiveCode) => {
    if (!newKPI.Name.trim()) return;

    addKPI({
      ...newKPI,
      Objective_Code: objectiveCode,
      Weight: parseFloat(newKPI.Weight) || 0
    });
    resetKPIForm();
  };

  // Reset selections when level changes
  useEffect(() => {
    setSelectedPillar('');
    setSelectedParentSO('');
    setSelectedL2('');
    setSelectedBU('');
    setShowAddForm(false);
    setAddingKPIForObjective(null);
    setExpandedKPIs({});
    setEditingKPICode(null);
    setEditingKPIData(null);
  }, [level]);

  // Get L1 corporate business unit (auto-select for L1)
  const corporateBU = useMemo(() => {
    return businessUnits.find(bu => bu.Level === 'L1');
  }, [businessUnits]);

  // Get L2 business units (for L3 cascading)
  const l2BusinessUnits = useMemo(() => {
    return businessUnits.filter(bu => bu.Level === 'L2');
  }, [businessUnits]);

  // Filter business units by level (and by selected L2 for L3)
  const levelBUs = useMemo(() => {
    if (level === 'L3' && selectedL2) {
      return businessUnits.filter(bu => bu.Level === 'L3' && bu.Parent_Code === selectedL2);
    }
    return businessUnits.filter(bu => bu.Level === level);
  }, [businessUnits, level, selectedL2]);

  // Filter objectives by level, BU, and pillar (for L1)
  const filteredObjectives = useMemo(() => {
    let objs = objectives.filter(obj => obj.Level === level && !obj.Is_Operational);
    if (level === 'L1' && selectedPillar) {
      objs = objs.filter(obj => obj.Pillar_Code === selectedPillar);
    }
    if (selectedBU) {
      objs = objs.filter(obj => obj.Business_Unit_Code === selectedBU);
    }
    return objs;
  }, [objectives, level, selectedBU, selectedPillar]);

  // Group objectives by pillar (for L1)
  const objectivesByPillar = useMemo(() => {
    if (level !== 'L1') return null;

    const grouped = {};
    const l1Objectives = objectives.filter(obj => obj.Level === 'L1' && !obj.Is_Operational);

    // Initialize all pillars
    pillars.forEach(pillar => {
      grouped[pillar.Code] = {
        pillar,
        objectives: [],
        totalWeight: 0
      };
    });

    // Add "Unassigned" group for objectives without a pillar
    grouped['_unassigned'] = {
      pillar: { Code: '_unassigned', Name: 'Unassigned', Weight: 0 },
      objectives: [],
      totalWeight: 0
    };

    // Group objectives
    l1Objectives.forEach(obj => {
      const pillarCode = obj.Pillar_Code || '_unassigned';
      if (grouped[pillarCode]) {
        grouped[pillarCode].objectives.push(obj);
        grouped[pillarCode].totalWeight += parseFloat(obj.Weight) || 0;
      }
    });

    return grouped;
  }, [objectives, pillars, level]);

  // Get all L1 strategic objectives (for L2 grouping)
  const l1Objectives = useMemo(() => {
    return objectives.filter(obj => obj.Level === 'L1' && !obj.Is_Operational);
  }, [objectives]);

  // Group L2 objectives by parent SO (filtered by selected BU)
  const objectivesByParentSO = useMemo(() => {
    if (level !== 'L2' || !selectedBU) return null;

    const grouped = {};
    // Filter L2 objectives by selected Business Unit
    const l2Objectives = objectives.filter(
      obj => obj.Level === 'L2' && !obj.Is_Operational && obj.Business_Unit_Code === selectedBU
    );

    // Get unique parent objective codes from filtered L2 objectives
    const parentCodes = [...new Set(l2Objectives.map(obj => obj.Parent_Objective_Code).filter(Boolean))];

    // Initialize groups for L1 objectives that have children in this BU
    parentCodes.forEach(parentCode => {
      const l1Obj = l1Objectives.find(o => o.Code === parentCode);
      if (l1Obj) {
        const pillar = pillars.find(p => p.Code === l1Obj.Pillar_Code);
        grouped[l1Obj.Code] = {
          parentObjective: l1Obj,
          pillar,
          objectives: [],
          totalWeight: 0
        };
      }
    });

    // Add "Unassigned" group for L2 objectives without a parent
    grouped['_unassigned'] = {
      parentObjective: { Code: '_unassigned', Name: 'Unassigned (No Parent SO)', Weight: 0 },
      pillar: null,
      objectives: [],
      totalWeight: 0
    };

    // Group L2 objectives by parent
    l2Objectives.forEach(obj => {
      const parentCode = obj.Parent_Objective_Code || '_unassigned';
      if (grouped[parentCode]) {
        grouped[parentCode].objectives.push(obj);
        grouped[parentCode].totalWeight += parseFloat(obj.Weight) || 0;
      } else {
        // Parent doesn't exist in our groups, add to unassigned
        grouped['_unassigned'].objectives.push(obj);
        grouped['_unassigned'].totalWeight += parseFloat(obj.Weight) || 0;
      }
    });

    return grouped;
  }, [objectives, l1Objectives, pillars, level, selectedBU]);

  // Get all L2 objectives (for L3 grouping)
  const l2ObjectivesList = useMemo(() => {
    return objectives.filter(obj => obj.Level === 'L2' && !obj.Is_Operational);
  }, [objectives]);

  // Group L3 objectives by parent L2 objective (filtered by selected BU)
  const objectivesByParentL2 = useMemo(() => {
    if (level !== 'L3' || !selectedBU) return null;

    const grouped = {};
    // Filter L3 objectives by selected Business Unit (Department)
    const l3Objectives = objectives.filter(
      obj => obj.Level === 'L3' && !obj.Is_Operational && obj.Business_Unit_Code === selectedBU
    );

    // Get unique parent objective codes from filtered L3 objectives
    const parentCodes = [...new Set(l3Objectives.map(obj => obj.Parent_Objective_Code).filter(Boolean))];

    // Initialize groups for L2 objectives that have children in this BU
    parentCodes.forEach(parentCode => {
      const l2Obj = l2ObjectivesList.find(o => o.Code === parentCode);
      if (l2Obj) {
        // Also get the L1 parent of this L2 objective
        const l1Parent = l1Objectives.find(o => o.Code === l2Obj.Parent_Objective_Code);
        grouped[l2Obj.Code] = {
          parentObjective: l2Obj,
          l1Parent,
          objectives: [],
          totalWeight: 0
        };
      }
    });

    // Add "Unassigned" group for L3 objectives without a parent
    grouped['_unassigned'] = {
      parentObjective: { Code: '_unassigned', Name: 'Unassigned (No Parent L2 Objective)', Weight: 0 },
      l1Parent: null,
      objectives: [],
      totalWeight: 0
    };

    // Group L3 objectives by parent
    l3Objectives.forEach(obj => {
      const parentCode = obj.Parent_Objective_Code || '_unassigned';
      if (grouped[parentCode]) {
        grouped[parentCode].objectives.push(obj);
        grouped[parentCode].totalWeight += parseFloat(obj.Weight) || 0;
      } else {
        // Parent doesn't exist in our groups, add to unassigned
        grouped['_unassigned'].objectives.push(obj);
        grouped['_unassigned'].totalWeight += parseFloat(obj.Weight) || 0;
      }
    });

    return grouped;
  }, [objectives, l2ObjectivesList, l1Objectives, level, selectedBU]);

  // Get parent objectives (for L2 and L3)
  const parentObjectives = useMemo(() => {
    if (level === 'L1') return [];
    const parentLevel = level === 'L2' ? 'L1' : 'L2';

    if (selectedBU) {
      const bu = businessUnits.find(b => b.Code === selectedBU);
      if (bu && bu.Parent_Code) {
        return objectives.filter(obj =>
          obj.Level === parentLevel && obj.Business_Unit_Code === bu.Parent_Code && !obj.Is_Operational
        );
      }
    }
    return objectives.filter(obj => obj.Level === parentLevel && !obj.Is_Operational);
  }, [objectives, level, selectedBU, businessUnits]);

  // Get the Operational objective for the selected BU (for L2/L3)
  const operationalObjective = useMemo(() => {
    if (!selectedBU || level === 'L1') return null;
    return objectives.find(obj =>
      obj.Business_Unit_Code === selectedBU &&
      obj.Level === level &&
      obj.Is_Operational &&
      obj.Status === 'Active'
    );
  }, [objectives, selectedBU, level]);

  // Get KPIs for the operational objective
  const operationalKPIs = useMemo(() => {
    if (!operationalObjective) return [];
    return kpis.filter(kpi => kpi.Objective_Code === operationalObjective.Code);
  }, [kpis, operationalObjective]);

  // Get KPI count for an objective
  const getKPICount = (objCode) => {
    return kpis.filter(kpi => kpi.Objective_Code === objCode).length;
  };

  const handleAddObjective = () => {
    if (!newObj.Name.trim()) return;

    // For L1, use corporate BU; for others, use selected BU
    const buCode = level === 'L1' ? (corporateBU?.Code || '') : selectedBU;

    if (level !== 'L1' && !buCode) return;

    addObjective({
      ...newObj,
      Level: level,
      Business_Unit_Code: buCode,
      Weight: parseFloat(newObj.Weight) || 0
    });
    setNewObj({
      Name: '',
      Name_AR: '',
      Pillar_Code: selectedPillar || '',
      Perspective_Code: '',
      Parent_Objective_Code: '',
      Weight: 0
    });
    setShowAddForm(false);
  };

  // Special handler for L2 objectives (uses selectedBU from filter)
  const handleAddL2Objective = () => {
    if (!newObj.Name.trim()) return;
    if (!selectedBU) {
      alert('Please select a Division first');
      return;
    }

    addObjective({
      ...newObj,
      Level: 'L2',
      Business_Unit_Code: selectedBU,
      Weight: parseFloat(newObj.Weight) || 0
    });
    setNewObj({
      Name: '',
      Name_AR: '',
      Pillar_Code: '',
      Perspective_Code: '',
      Parent_Objective_Code: '',
      Weight: 0
    });
    setShowAddForm(false);
  };

  const handleDeleteObjective = (code) => {
    const hasChildren = objectives.some(obj => obj.Parent_Objective_Code === code);
    if (hasChildren) {
      alert('Cannot delete an objective that has child objectives. Delete children first.');
      return;
    }
    const hasKPIs = kpis.some(kpi => kpi.Objective_Code === code);
    if (hasKPIs) {
      alert('Cannot delete an objective that has KPIs linked to it. Remove KPIs first.');
      return;
    }
    deleteObjective(code);
  };

  const levelLabels = {
    L1: 'Corporate',
    L2: 'Division',
    L3: 'Department'
  };

  // Render L1 view with pillar grouping
  if (level === 'L1') {
    return (
      <div className="objectives-tab">
        <div className="objectives-header">
          <h2>L1 Strategic Objectives (Corporate)</h2>
          <p className="section-description">
            Define corporate-level objectives linked to strategic pillars. Objectives under each pillar should total 100%.
          </p>
        </div>

        {/* Pillar Filter & Add Button */}
        <div className="objectives-filter">
          <label>Filter by Pillar:</label>
          <select
            value={selectedPillar}
            onChange={(e) => setSelectedPillar(e.target.value)}
          >
            <option value="">All Pillars</option>
            {pillars.map(p => (
              <option key={p.Code} value={p.Code}>{p.Name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => {
              setNewObj(prev => ({ ...prev, Pillar_Code: selectedPillar }));
              setShowAddForm(true);
            }}
          >
            + Add L1 Objective
          </button>
        </div>

        {/* Add Objective Form */}
        {showAddForm && (
          <div className="add-objective-form">
            <h4>Add New L1 Strategic Objective</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Name (English) *</label>
                <input
                  type="text"
                  value={newObj.Name}
                  onChange={(e) => setNewObj({ ...newObj, Name: e.target.value })}
                  placeholder="Objective name..."
                />
              </div>
              <div className="form-group">
                <label>Name (Arabic)</label>
                <input
                  type="text"
                  value={newObj.Name_AR}
                  onChange={(e) => setNewObj({ ...newObj, Name_AR: e.target.value })}
                  placeholder="اسم الهدف..."
                  dir="rtl"
                />
              </div>
              <div className="form-group">
                <label>Strategic Pillar *</label>
                <select
                  value={newObj.Pillar_Code}
                  onChange={(e) => setNewObj({ ...newObj, Pillar_Code: e.target.value })}
                >
                  <option value="">Select Pillar...</option>
                  {pillars.map(p => (
                    <option key={p.Code} value={p.Code}>{p.Name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Weight (%)</label>
                <input
                  type="number"
                  value={newObj.Weight}
                  onChange={(e) => setNewObj({ ...newObj, Weight: e.target.value })}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
              {perspectives.length > 0 && (
                <div className="form-group">
                  <label>Perspective (Optional)</label>
                  <select
                    value={newObj.Perspective_Code}
                    onChange={(e) => setNewObj({ ...newObj, Perspective_Code: e.target.value })}
                  >
                    <option value="">Select Perspective...</option>
                    {perspectives.map(p => (
                      <option key={p.Code} value={p.Code}>{p.Name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleAddObjective}>
                Add Objective
              </button>
              <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Objectives grouped by Pillar */}
        <div className="pillar-objectives-container">
          {objectivesByPillar && Object.entries(objectivesByPillar)
            .filter(([code, data]) => {
              if (selectedPillar) return code === selectedPillar;
              return data.objectives.length > 0 || code !== '_unassigned';
            })
            .map(([pillarCode, data]) => {
              const pillarWeight = parseFloat(data.pillar.Weight) || 0;
              const isValid = pillarWeight > 0 && Math.abs(data.totalWeight - pillarWeight) < 0.01;
              const isEmpty = data.objectives.length === 0;
              const remaining = pillarWeight - data.totalWeight;

              return (
                <div key={pillarCode} className="pillar-group">
                  <div className="pillar-group-header">
                    <div className="pillar-group-info">
                      <h3>{data.pillar.Name}</h3>
                      {pillarWeight > 0 && (
                        <span className="pillar-weight-badge">Weight: {pillarWeight}%</span>
                      )}
                    </div>
                    <div className={`weight-indicator ${isValid ? 'valid' : isEmpty ? 'empty' : 'invalid'}`}>
                      {isEmpty ? (
                        <span>No objectives</span>
                      ) : pillarWeight === 0 ? (
                        <span className="weight-value">{data.totalWeight.toFixed(0)}% (no weight set)</span>
                      ) : (
                        <>
                          <span className="weight-value">{data.totalWeight.toFixed(0)}% / {pillarWeight}%</span>
                          <span className="weight-label">
                            {isValid ? <><CheckCircle size={12} /> Complete</> : `${Math.abs(remaining).toFixed(0)}% ${remaining > 0 ? 'remaining' : 'over'}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {isEmpty ? (
                    <div className="pillar-empty-state">
                      <p>No objectives assigned to this pillar yet.</p>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setNewObj(prev => ({ ...prev, Pillar_Code: pillarCode }));
                          setShowAddForm(true);
                        }}
                      >
                        + Add Objective
                      </button>
                    </div>
                  ) : (
                    <div className="pillar-objectives-list">
                      {data.objectives.map(obj => {
                        const perspective = perspectives.find(p => p.Code === obj.Perspective_Code);
                        const kpiCount = getKPICount(obj.Code);
                        const isEditing = editingObj === obj.Code;

                        return (
                          <div key={obj.Code} className="objective-card">
                            {isEditing ? (
                              <div className="objective-edit">
                                <div className="form-grid">
                                  <div className="form-group">
                                    <label>Name (English)</label>
                                    <input
                                      type="text"
                                      value={obj.Name}
                                      onChange={(e) => updateObjective(obj.Code, { Name: e.target.value })}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Name (Arabic)</label>
                                    <input
                                      type="text"
                                      value={obj.Name_AR || ''}
                                      onChange={(e) => updateObjective(obj.Code, { Name_AR: e.target.value })}
                                      dir="rtl"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Strategic Pillar</label>
                                    <select
                                      value={obj.Pillar_Code || ''}
                                      onChange={(e) => updateObjective(obj.Code, { Pillar_Code: e.target.value })}
                                    >
                                      <option value="">Select Pillar...</option>
                                      {pillars.map(p => (
                                        <option key={p.Code} value={p.Code}>{p.Name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label>Weight (%)</label>
                                    <input
                                      type="number"
                                      value={obj.Weight || 0}
                                      onChange={(e) => updateObjective(obj.Code, { Weight: parseFloat(e.target.value) || 0 })}
                                      min="0"
                                      max="100"
                                      step="1"
                                    />
                                  </div>
                                  {perspectives.length > 0 && (
                                    <div className="form-group">
                                      <label>Perspective</label>
                                      <select
                                        value={obj.Perspective_Code || ''}
                                        onChange={(e) => updateObjective(obj.Code, { Perspective_Code: e.target.value })}
                                      >
                                        <option value="">None</option>
                                        {perspectives.map(p => (
                                          <option key={p.Code} value={p.Code}>{p.Name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                                <div className="form-actions">
                                  <button className="btn btn-primary btn-sm" onClick={() => setEditingObj(null)}>
                                    Done
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="objective-display">
                                <div className="objective-header">
                                  <span className="objective-code">{obj.Code}</span>
                                  <span className="objective-weight">{obj.Weight || 0}%</span>
                                </div>
                                <div className="objective-name">{obj.Name}</div>
                                {obj.Name_AR && <div className="objective-name-ar">{obj.Name_AR}</div>}

                                <div className="objective-meta">
                                  {perspective && (
                                    <span className="meta-item perspective">
                                      <strong>Perspective:</strong> {perspective.Name}
                                    </span>
                                  )}
                                  <span className="meta-item kpis">
                                    {kpiCount > 0 && (
                                      <button
                                        className={`kpi-expand-btn ${expandedKPIs[obj.Code] ? 'expanded' : ''}`}
                                        onClick={() => toggleKPIExpansion(obj.Code)}
                                        title={expandedKPIs[obj.Code] ? 'Collapse KPIs' : 'Expand KPIs'}
                                      >
                                        ▶
                                      </button>
                                    )}
                                    <strong>KPIs:</strong> {kpiCount}
                                    <button
                                      className="btn btn-xs btn-outline add-kpi-btn"
                                      onClick={() => setAddingKPIForObjective(obj.Code)}
                                    >
                                      + Add KPI
                                    </button>
                                  </span>
                                  {/* KPI Weight Validation */}
                                  {(() => {
                                    const objKPIs = getKPIsForObjective(obj.Code);
                                    const kpiTotalWeight = objKPIs.reduce((sum, k) => sum + (parseFloat(k.Weight) || 0), 0);
                                    const objWeight = parseFloat(obj.Weight) || 0;
                                    const kpiIsValid = objWeight > 0 && Math.abs(kpiTotalWeight - objWeight) < 0.01;
                                    const kpiRemaining = objWeight - kpiTotalWeight;

                                    if (objKPIs.length === 0) return null;

                                    return (
                                      <span className={`meta-item kpi-weight-status ${kpiIsValid ? 'valid' : 'invalid'}`}>
                                        {kpiIsValid ? (
                                          <><CheckCircle size={12} /> KPI weights: {kpiTotalWeight}%</>
                                        ) : objWeight === 0 ? (
                                          <>KPI weights: {kpiTotalWeight}% (no weight set)</>
                                        ) : (
                                          <><AlertTriangle size={12} /> KPIs: {kpiTotalWeight}% / {objWeight}% ({Math.abs(kpiRemaining).toFixed(0)}% {kpiRemaining > 0 ? 'remaining' : 'over'})</>
                                        )}
                                      </span>
                                    );
                                  })()}
                                </div>

                                {/* Expanded KPI List */}
                                {expandedKPIs[obj.Code] && kpiCount > 0 && (
                                  <div className="kpi-list-expanded">
                                    <table className="kpi-table">
                                      <thead>
                                        <tr>
                                          <th>KPI Name</th>
                                          <th>Weight</th>
                                          <th>Target</th>
                                          <th>Status</th>
                                          <th>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {getKPIsForObjective(obj.Code).map(kpi => (
                                          <tr key={kpi.Code}>
                                            <td>{kpi.Name}</td>
                                            <td>{kpi.Weight || 0}%</td>
                                            <td>{kpi.Target || '-'}</td>
                                            <td>
                                              <span className={`status-badge ${(kpi.Approval_Status || 'Recommended').toLowerCase().replace(' ', '-')}`}>
                                                {kpi.Approval_Status || 'Recommended'}
                                              </span>
                                            </td>
                                            <td>
                                              <button
                                                className="btn btn-xs btn-ghost"
                                                onClick={() => startEditingKPI(kpi)}
                                              >
                                                Edit
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>

                                    {/* Inline KPI Edit Form */}
                                    {editingKPICode && getKPIsForObjective(obj.Code).some(k => k.Code === editingKPICode) && (
                                      <div className="inline-kpi-edit-form">
                                        <h5>Edit KPI: {editingKPIData?.Name}</h5>
                                        <div className="form-grid">
                                          <div className="form-group">
                                            <label>Name (English) *</label>
                                            <input
                                              type="text"
                                              value={editingKPIData?.Name || ''}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Name: e.target.value })}
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Name (Arabic)</label>
                                            <input
                                              type="text"
                                              value={editingKPIData?.Name_AR || ''}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Name_AR: e.target.value })}
                                              dir="rtl"
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Impact Type</label>
                                            <select
                                              value={editingKPIData?.Impact_Type || 'Direct'}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Impact_Type: e.target.value })}
                                            >
                                              {impactTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>Indicator Type</label>
                                            <select
                                              value={editingKPIData?.Indicator_Type || 'Lagging'}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Indicator_Type: e.target.value })}
                                            >
                                              {indicatorTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>Approval Status</label>
                                            <select
                                              value={editingKPIData?.Approval_Status || 'Recommended'}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Approval_Status: e.target.value })}
                                            >
                                              {approvalStatuses.map(status => (
                                                <option key={status} value={status}>{status}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>Unit</label>
                                            <input
                                              type="text"
                                              value={editingKPIData?.Unit || ''}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Unit: e.target.value })}
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Target</label>
                                            <input
                                              type="text"
                                              value={editingKPIData?.Target || ''}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Target: e.target.value })}
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Weight (%)</label>
                                            <input
                                              type="number"
                                              value={editingKPIData?.Weight || 0}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Weight: e.target.value })}
                                              min="0"
                                              max="100"
                                            />
                                          </div>
                                        </div>
                                        <div className="form-group full-width">
                                          <label>Description</label>
                                          <textarea
                                            value={editingKPIData?.Description || ''}
                                            onChange={(e) => setEditingKPIData({ ...editingKPIData, Description: e.target.value })}
                                            rows="2"
                                          />
                                        </div>
                                        <div className="form-actions">
                                          <button className="btn btn-primary btn-sm" onClick={saveKPIEdits}>
                                            Save Changes
                                          </button>
                                          <button className="btn btn-ghost btn-sm" onClick={cancelEditingKPI}>
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="objective-actions">
                                  <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => setEditingObj(obj.Code)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteObjective(obj.Code)}
                                  >
                                    Delete
                                  </button>
                                </div>

                                {/* Inline KPI Add Form */}
                                {addingKPIForObjective === obj.Code && (
                                  <div className="inline-kpi-form">
                                    <h5>Add KPI to {obj.Code}</h5>
                                    <div className="form-grid">
                                      <div className="form-group">
                                        <label>Name (English) *</label>
                                        <input
                                          type="text"
                                          value={newKPI.Name}
                                          onChange={(e) => setNewKPI({ ...newKPI, Name: e.target.value })}
                                          placeholder="KPI name..."
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Name (Arabic)</label>
                                        <input
                                          type="text"
                                          value={newKPI.Name_AR}
                                          onChange={(e) => setNewKPI({ ...newKPI, Name_AR: e.target.value })}
                                          placeholder="اسم مؤشر..."
                                          dir="rtl"
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Impact Type</label>
                                        <select
                                          value={newKPI.Impact_Type}
                                          onChange={(e) => setNewKPI({ ...newKPI, Impact_Type: e.target.value })}
                                        >
                                          {impactTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="form-group">
                                        <label>Indicator Type</label>
                                        <select
                                          value={newKPI.Indicator_Type}
                                          onChange={(e) => setNewKPI({ ...newKPI, Indicator_Type: e.target.value })}
                                        >
                                          {indicatorTypes.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="form-group">
                                        <label>Approval Status</label>
                                        <select
                                          value={newKPI.Approval_Status}
                                          onChange={(e) => setNewKPI({ ...newKPI, Approval_Status: e.target.value })}
                                        >
                                          {approvalStatuses.map(status => (
                                            <option key={status} value={status}>{status}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="form-group">
                                        <label>Unit</label>
                                        <input
                                          type="text"
                                          value={newKPI.Unit}
                                          onChange={(e) => setNewKPI({ ...newKPI, Unit: e.target.value })}
                                          placeholder="%, #, AED..."
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Target</label>
                                        <input
                                          type="text"
                                          value={newKPI.Target}
                                          onChange={(e) => setNewKPI({ ...newKPI, Target: e.target.value })}
                                          placeholder="Target value..."
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Weight (%)</label>
                                        <input
                                          type="number"
                                          value={newKPI.Weight}
                                          onChange={(e) => setNewKPI({ ...newKPI, Weight: e.target.value })}
                                          placeholder="0"
                                          min="0"
                                          max="100"
                                        />
                                      </div>
                                    </div>
                                    <div className="form-group full-width">
                                      <label>Description</label>
                                      <textarea
                                        value={newKPI.Description}
                                        onChange={(e) => setNewKPI({ ...newKPI, Description: e.target.value })}
                                        placeholder="KPI description..."
                                        rows="2"
                                      />
                                    </div>
                                    <div className="form-actions">
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleAddKPIFromObjective(obj.Code)}
                                      >
                                        Add KPI
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={resetKPIForm}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // Render L2 view with BU selection then SO grouping
  if (level === 'L2') {
    const selectedBUObj = businessUnits.find(b => b.Code === selectedBU);
    const buParentWeights = selectedBU ? getBuParentWeights(selectedBU) : {};
    const buTotalParentWeight = Object.values(buParentWeights).reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
    const availableSOs = selectedBU ? getAvailableParentObjectives(selectedBU) : [];

    return (
      <div className="objectives-tab">
        <div className="objectives-header">
          <h2>L2 Objectives (Division)</h2>
          <p className="section-description">
            Select a division, configure which SOs it uses (weights must total 100%), then define objectives under each SO.
          </p>
        </div>

        {/* Division (L2 BU) Filter */}
        <div className="objectives-filter">
          <label>Select Division:</label>
          <select
            value={selectedBU}
            onChange={(e) => setSelectedBU(e.target.value)}
          >
            <option value="">Select Division...</option>
            {levelBUs.map(bu => (
              <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
            ))}
          </select>
        </div>

        {/* Show message if no BU selected */}
        {!selectedBU ? (
          <div className="empty-state">
            <p>Select a division to view and manage its objectives.</p>
          </div>
        ) : (
          <>
            {/* SO Scorecard Configuration */}
            <div className="scorecard-config-section">
              <h3>Scorecard Configuration for {selectedBUObj?.Name}</h3>
              <p className="config-description">
                Assign weights to each Strategic Objective (SO) this division is responsible for. Weights must total 100%.
              </p>

              <div className={`weight-total-indicator ${Math.abs(buTotalParentWeight - 100) < 0.01 ? 'valid' : 'invalid'}`}>
                <span>Total SO Weight: {buTotalParentWeight.toFixed(0)}%</span>
                {Math.abs(buTotalParentWeight - 100) < 0.01 ? (
                  <span className="status-icon"><CheckCircle size={16} /> Complete</span>
                ) : (
                  <span className="status-icon"><AlertTriangle size={16} /> {(100 - buTotalParentWeight).toFixed(0)}% {buTotalParentWeight < 100 ? 'remaining' : 'over'}</span>
                )}
              </div>

              {/* Configured SOs + Operational (Operational always shown) */}
              <div className="configured-parents-list">
                {/* Strategic SOs */}
                {Object.entries(buParentWeights)
                  .filter(([objCode]) => !operationalObjective || objCode !== operationalObjective.Code)
                  .filter(([objCode]) => l1Objectives.some(o => o.Code === objCode))
                  .map(([objCode, weight]) => {
                    const so = l1Objectives.find(o => o.Code === objCode);
                    const pillar = so ? pillars.find(p => p.Code === so.Pillar_Code) : null;

                    return (
                      <div key={objCode} className="configured-parent-item">
                        <div className="parent-info">
                          <span className="parent-code">{objCode}</span>
                          <span className="parent-name">{so.Name}</span>
                          {pillar && <span className="parent-pillar">({pillar.Name})</span>}
                        </div>
                        <div className="parent-weight-input">
                          <input
                            type="number"
                            value={weight}
                            onChange={(e) => setBuParentWeight(selectedBU, objCode, e.target.value)}
                            min="0"
                            max="100"
                            step="1"
                          />
                          <span>%</span>
                        </div>
                        <button
                          className="btn btn-xs btn-danger"
                          onClick={() => removeBuParentWeight(selectedBU, objCode)}
                          title="Remove from scorecard"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}

                {/* Operational - ALWAYS shown */}
                {operationalObjective && (
                  <div className="configured-parent-item operational-item">
                    <div className="parent-info">
                      <span className="parent-code">OPERATIONAL</span>
                      <span className="parent-name">Operational</span>
                      <span className="parent-pillar operational-tag">(Non-Strategic KPIs)</span>
                    </div>
                    <div className="parent-weight-input">
                      <input
                        type="number"
                        value={buParentWeights[operationalObjective.Code] || 0}
                        onChange={(e) => setBuParentWeight(selectedBU, operationalObjective.Code, e.target.value)}
                        min="0"
                        max="100"
                        step="1"
                      />
                      <span>%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Add SO to scorecard */}
              {availableSOs.length > 0 && (
                <div className="add-parent-form">
                  <select
                    id="add-so-select"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setBuParentWeight(selectedBU, e.target.value, 0);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Add SO to scorecard...</option>
                    {availableSOs.map(so => {
                      const pillar = pillars.find(p => p.Code === so.Pillar_Code);
                      return (
                        <option key={so.Code} value={so.Code}>
                          {so.Name} {pillar ? `(${pillar.Name})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Add Objective Button */}
            {Object.keys(buParentWeights).length > 0 && (
              <div className="objectives-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setNewObj(prev => ({ ...prev, Business_Unit_Code: selectedBU }));
                    setShowAddForm(true);
                  }}
                >
                  + Add L2 Objective
                </button>
              </div>
            )}
            {/* Add Objective Form */}
            {showAddForm && (
              <div className="add-objective-form">
                <h4>Add New L2 Objective for {selectedBUObj?.Name}</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Name (English) *</label>
                    <input
                      type="text"
                      value={newObj.Name}
                      onChange={(e) => setNewObj({ ...newObj, Name: e.target.value })}
                      placeholder="Objective name..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Name (Arabic)</label>
                    <input
                      type="text"
                      value={newObj.Name_AR}
                      onChange={(e) => setNewObj({ ...newObj, Name_AR: e.target.value })}
                      placeholder="اسم الهدف..."
                      dir="rtl"
                    />
                  </div>
                  <div className="form-group">
                    <label>Parent L1 Strategic Objective *</label>
                    <select
                      value={newObj.Parent_Objective_Code}
                      onChange={(e) => setNewObj({ ...newObj, Parent_Objective_Code: e.target.value })}
                    >
                      <option value="">Select Parent SO...</option>
                      {l1Objectives.map(obj => (
                        <option key={obj.Code} value={obj.Code}>{obj.Name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Weight (%)</label>
                    <input
                      type="number"
                      value={newObj.Weight}
                      onChange={(e) => setNewObj({ ...newObj, Weight: e.target.value })}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>
                  {perspectives.length > 0 && (
                    <div className="form-group">
                      <label>Perspective (Optional)</label>
                      <select
                        value={newObj.Perspective_Code}
                        onChange={(e) => setNewObj({ ...newObj, Perspective_Code: e.target.value })}
                      >
                        <option value="">Select Perspective...</option>
                        {perspectives.map(p => (
                          <option key={p.Code} value={p.Code}>{p.Name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary" onClick={handleAddL2Objective}>
                    Add Objective
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Objectives grouped by Parent SO */}
            {Object.keys(buParentWeights).filter(code => !operationalObjective || code !== operationalObjective.Code).filter(code => l1Objectives.some(o => o.Code === code)).length === 0 ? (
              <div className="empty-state">
                <p>Add Strategic Objectives to this division's scorecard above, then create L2 objectives under each SO.</p>
              </div>
            ) : (
              <div className="pillar-objectives-container">
                {Object.entries(buParentWeights)
                  .filter(([soCode]) => !operationalObjective || soCode !== operationalObjective.Code)
                  .filter(([soCode]) => l1Objectives.some(o => o.Code === soCode))
                  .map(([soCode, soBudget]) => {
                  const soData = objectivesByParentSO?.[soCode];
                  const so = l1Objectives.find(o => o.Code === soCode);
                  const pillar = so ? pillars.find(p => p.Code === so.Pillar_Code) : null;
                  const objectives_list = soData?.objectives || [];
                  const totalWeight = objectives_list.reduce((sum, obj) => sum + (parseFloat(obj.Weight) || 0), 0);
                  const budgetNum = parseFloat(soBudget) || 0;
                  const isValid = budgetNum > 0 && Math.abs(totalWeight - budgetNum) < 0.01;
                  const isEmpty = objectives_list.length === 0;
                  const remaining = budgetNum - totalWeight;

                    return (
                      <div key={soCode} className="pillar-group so-group">
                        <div className="pillar-group-header so-header">
                          <div className="pillar-group-info">
                            <span className="pillar-code">{soCode}</span>
                            <h3>{so.Name}</h3>
                            {pillar && (
                              <span className="pillar-weight-badge">Pillar: {pillar.Name}</span>
                            )}
                            <span className="pillar-weight-badge">Weight: {budgetNum}%</span>
                          </div>
                          <div className={`weight-indicator ${isValid ? 'valid' : isEmpty ? 'empty' : 'invalid'}`}>
                            {isEmpty ? (
                              <span>No objectives</span>
                            ) : budgetNum === 0 ? (
                              <span className="weight-value">{totalWeight.toFixed(0)}% (no weight set)</span>
                            ) : (
                              <>
                                <span className="weight-value">{totalWeight.toFixed(0)}% / {budgetNum}%</span>
                                <span className="weight-label">
                                  {isValid ? <><CheckCircle size={12} /> Complete</> : `${Math.abs(remaining).toFixed(0)}% ${remaining > 0 ? 'remaining' : 'over'}`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {isEmpty ? (
                          <div className="pillar-empty-state">
                            <p>No objectives under this SO yet.</p>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => {
                                setNewObj(prev => ({ ...prev, Parent_Objective_Code: soCode, Business_Unit_Code: selectedBU }));
                                setShowAddForm(true);
                              }}
                            >
                              + Add Objective
                            </button>
                          </div>
                        ) : (
                        <div className="pillar-objectives-list">
                          {objectives_list.map(obj => {
                            const perspective = perspectives.find(p => p.Code === obj.Perspective_Code);
                            const kpiCount = getKPICount(obj.Code);
                            const isEditing = editingObj === obj.Code;

                            return (
                              <div key={obj.Code} className="objective-card">
                                {isEditing ? (
                                  <div className="objective-edit">
                                    <div className="form-grid">
                                      <div className="form-group">
                                        <label>Name (English)</label>
                                        <input
                                          type="text"
                                          value={obj.Name}
                                          onChange={(e) => updateObjective(obj.Code, { Name: e.target.value })}
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Name (Arabic)</label>
                                        <input
                                          type="text"
                                          value={obj.Name_AR || ''}
                                          onChange={(e) => updateObjective(obj.Code, { Name_AR: e.target.value })}
                                          dir="rtl"
                                        />
                                      </div>
                                      <div className="form-group">
                                        <label>Parent L1 Strategic Objective</label>
                                        <select
                                          value={obj.Parent_Objective_Code || ''}
                                          onChange={(e) => updateObjective(obj.Code, { Parent_Objective_Code: e.target.value })}
                                        >
                                          <option value="">Select Parent SO...</option>
                                          {l1Objectives.map(l1 => (
                                            <option key={l1.Code} value={l1.Code}>{l1.Name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="form-group">
                                        <label>Weight (%)</label>
                                        <input
                                          type="number"
                                          value={obj.Weight || 0}
                                          onChange={(e) => updateObjective(obj.Code, { Weight: parseFloat(e.target.value) || 0 })}
                                          min="0"
                                          max="100"
                                          step="1"
                                        />
                                      </div>
                                      {perspectives.length > 0 && (
                                        <div className="form-group">
                                          <label>Perspective</label>
                                          <select
                                            value={obj.Perspective_Code || ''}
                                            onChange={(e) => updateObjective(obj.Code, { Perspective_Code: e.target.value })}
                                          >
                                            <option value="">None</option>
                                            {perspectives.map(p => (
                                              <option key={p.Code} value={p.Code}>{p.Name}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                    <div className="form-actions">
                                      <button className="btn btn-primary btn-sm" onClick={() => setEditingObj(null)}>
                                        Done
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="objective-display">
                                    <div className="objective-header">
                                      <span className="objective-code">{obj.Code}</span>
                                      <span className="objective-weight">{obj.Weight || 0}%</span>
                                    </div>
                                    <div className="objective-name">{obj.Name}</div>
                                    {obj.Name_AR && <div className="objective-name-ar">{obj.Name_AR}</div>}

                                    <div className="objective-meta">
                                      {perspective && (
                                        <span className="meta-item perspective">
                                          <strong>Perspective:</strong> {perspective.Name}
                                        </span>
                                      )}
                                      <span className="meta-item kpis">
                                        {kpiCount > 0 && (
                                          <button
                                            className={`kpi-expand-btn ${expandedKPIs[obj.Code] ? 'expanded' : ''}`}
                                            onClick={() => toggleKPIExpansion(obj.Code)}
                                            title={expandedKPIs[obj.Code] ? 'Collapse KPIs' : 'Expand KPIs'}
                                          >
                                            ▶
                                          </button>
                                        )}
                                        <strong>KPIs:</strong> {kpiCount}
                                        <button
                                          className="btn btn-xs btn-outline add-kpi-btn"
                                          onClick={() => setAddingKPIForObjective(obj.Code)}
                                        >
                                          + Add KPI
                                        </button>
                                      </span>
                                    </div>

                                    {/* Expanded KPI List */}
                                    {expandedKPIs[obj.Code] && kpiCount > 0 && (
                                      <div className="kpi-list-expanded">
                                        <table className="kpi-table">
                                          <thead>
                                            <tr>
                                              <th>KPI Name</th>
                                              <th>Weight</th>
                                              <th>Target</th>
                                              <th>Status</th>
                                              <th>Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {getKPIsForObjective(obj.Code).map(kpi => (
                                              <tr key={kpi.Code}>
                                                <td>{kpi.Name}</td>
                                                <td>{kpi.Weight || 0}%</td>
                                                <td>{kpi.Target || '-'}</td>
                                                <td>
                                                  <span className={`status-badge ${(kpi.Approval_Status || 'Recommended').toLowerCase().replace(' ', '-')}`}>
                                                    {kpi.Approval_Status || 'Recommended'}
                                                  </span>
                                                </td>
                                                <td>
                                                  <button
                                                    className="btn btn-xs btn-ghost"
                                                    onClick={() => startEditingKPI(kpi)}
                                                  >
                                                    Edit
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>

                                        {/* Inline KPI Edit Form */}
                                        {editingKPICode && getKPIsForObjective(obj.Code).some(k => k.Code === editingKPICode) && (
                                          <div className="inline-kpi-edit-form">
                                            <h5>Edit KPI: {editingKPIData?.Name}</h5>
                                            <div className="form-grid">
                                              <div className="form-group">
                                                <label>Name (English) *</label>
                                                <input
                                                  type="text"
                                                  value={editingKPIData?.Name || ''}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Name: e.target.value })}
                                                />
                                              </div>
                                              <div className="form-group">
                                                <label>Name (Arabic)</label>
                                                <input
                                                  type="text"
                                                  value={editingKPIData?.Name_AR || ''}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Name_AR: e.target.value })}
                                                  dir="rtl"
                                                />
                                              </div>
                                              <div className="form-group">
                                                <label>Impact Type</label>
                                                <select
                                                  value={editingKPIData?.Impact_Type || 'Direct'}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Impact_Type: e.target.value })}
                                                >
                                                  {impactTypes.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div className="form-group">
                                                <label>Indicator Type</label>
                                                <select
                                                  value={editingKPIData?.Indicator_Type || 'Lagging'}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Indicator_Type: e.target.value })}
                                                >
                                                  {indicatorTypes.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div className="form-group">
                                                <label>Approval Status</label>
                                                <select
                                                  value={editingKPIData?.Approval_Status || 'Recommended'}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Approval_Status: e.target.value })}
                                                >
                                                  {approvalStatuses.map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div className="form-group">
                                                <label>Unit</label>
                                                <input
                                                  type="text"
                                                  value={editingKPIData?.Unit || ''}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Unit: e.target.value })}
                                                />
                                              </div>
                                              <div className="form-group">
                                                <label>Target</label>
                                                <input
                                                  type="text"
                                                  value={editingKPIData?.Target || ''}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Target: e.target.value })}
                                                />
                                              </div>
                                              <div className="form-group">
                                                <label>Weight (%)</label>
                                                <input
                                                  type="number"
                                                  value={editingKPIData?.Weight || 0}
                                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Weight: e.target.value })}
                                                  min="0"
                                                  max="100"
                                                />
                                              </div>
                                            </div>
                                            <div className="form-group full-width">
                                              <label>Description</label>
                                              <textarea
                                                value={editingKPIData?.Description || ''}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Description: e.target.value })}
                                                rows="2"
                                              />
                                            </div>
                                            <div className="form-actions">
                                              <button className="btn btn-primary btn-sm" onClick={saveKPIEdits}>
                                                Save Changes
                                              </button>
                                              <button className="btn btn-ghost btn-sm" onClick={cancelEditingKPI}>
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="objective-actions">
                                      <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => setEditingObj(obj.Code)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDeleteObjective(obj.Code)}
                                      >
                                        Delete
                                      </button>
                                    </div>

                                    {/* Inline KPI Add Form */}
                                    {addingKPIForObjective === obj.Code && (
                                      <div className="inline-kpi-form">
                                        <h5>Add KPI to {obj.Code}</h5>
                                        <div className="form-grid">
                                          <div className="form-group">
                                            <label>Name (English) *</label>
                                            <input
                                              type="text"
                                              value={newKPI.Name}
                                              onChange={(e) => setNewKPI({ ...newKPI, Name: e.target.value })}
                                              placeholder="KPI name..."
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Name (Arabic)</label>
                                            <input
                                              type="text"
                                              value={newKPI.Name_AR}
                                              onChange={(e) => setNewKPI({ ...newKPI, Name_AR: e.target.value })}
                                              placeholder="اسم مؤشر..."
                                              dir="rtl"
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Impact Type</label>
                                            <select
                                              value={newKPI.Impact_Type}
                                              onChange={(e) => setNewKPI({ ...newKPI, Impact_Type: e.target.value })}
                                            >
                                              {impactTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>Indicator Type</label>
                                            <select
                                              value={newKPI.Indicator_Type}
                                              onChange={(e) => setNewKPI({ ...newKPI, Indicator_Type: e.target.value })}
                                            >
                                              {indicatorTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>Approval Status</label>
                                            <select
                                              value={newKPI.Approval_Status}
                                              onChange={(e) => setNewKPI({ ...newKPI, Approval_Status: e.target.value })}
                                            >
                                              {approvalStatuses.map(status => (
                                                <option key={status} value={status}>{status}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>Unit</label>
                                            <input
                                              type="text"
                                              value={newKPI.Unit}
                                              onChange={(e) => setNewKPI({ ...newKPI, Unit: e.target.value })}
                                              placeholder="%, #, AED..."
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Target</label>
                                            <input
                                              type="text"
                                              value={newKPI.Target}
                                              onChange={(e) => setNewKPI({ ...newKPI, Target: e.target.value })}
                                              placeholder="Target value..."
                                            />
                                          </div>
                                          <div className="form-group">
                                            <label>Weight (%)</label>
                                            <input
                                              type="number"
                                              value={newKPI.Weight}
                                              onChange={(e) => setNewKPI({ ...newKPI, Weight: e.target.value })}
                                              placeholder="0"
                                              min="0"
                                              max="100"
                                            />
                                          </div>
                                        </div>
                                        <div className="form-group full-width">
                                          <label>Description</label>
                                          <textarea
                                            value={newKPI.Description}
                                            onChange={(e) => setNewKPI({ ...newKPI, Description: e.target.value })}
                                            placeholder="KPI description..."
                                            rows="2"
                                          />
                                        </div>
                                        <div className="form-actions">
                                          <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleAddKPIFromObjective(obj.Code)}
                                          >
                                            Add KPI
                                          </button>
                                          <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={resetKPIForm}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Operational Section - Always shown for L2 */}
            {operationalObjective && (() => {
              const opBudget = parseFloat(buParentWeights[operationalObjective.Code]) || 0;
              const opTotalWeight = operationalKPIs.reduce((sum, k) => sum + (parseFloat(k.Weight) || 0), 0);
              const opIsValid = opBudget > 0 && Math.abs(opTotalWeight - opBudget) < 0.01;
              const opRemaining = opBudget - opTotalWeight;
              const opIsEmpty = operationalKPIs.length === 0;

              return (
                <div className="pillar-group so-group operational-group">
                  <div className="pillar-group-header so-header">
                    <div className="pillar-group-info">
                      <span className="pillar-code">OPERATIONAL</span>
                      <h3>Operational</h3>
                      <span className="pillar-weight-badge">Weight: {opBudget}%</span>
                    </div>
                    <div className={`weight-indicator ${opIsValid ? 'valid' : opIsEmpty ? 'empty' : 'invalid'}`}>
                      {opIsEmpty ? (
                        <span>No KPIs</span>
                      ) : opBudget === 0 ? (
                        <span className="weight-value">{opTotalWeight.toFixed(0)}% (no weight set)</span>
                      ) : (
                        <>
                          <span className="weight-value">{opTotalWeight.toFixed(0)}% / {opBudget}%</span>
                          <span className="weight-label">
                            {opIsValid ? <><CheckCircle size={12} /> Complete</> : `${Math.abs(opRemaining).toFixed(0)}% ${opRemaining > 0 ? 'remaining' : 'over'}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pillar-objectives-list">

                    {operationalKPIs.length > 0 && (
                      <div className="kpi-list-expanded">
                        <table className="kpi-table">
                          <thead>
                            <tr>
                              <th>KPI Name</th>
                              <th>Weight</th>
                              <th>Target</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {operationalKPIs.map(kpi => (
                              <tr key={kpi.Code}>
                                <td>{kpi.Name}</td>
                                <td>{kpi.Weight || 0}%</td>
                                <td>{kpi.Target || '-'}</td>
                                <td>
                                  <span className={`status-badge ${(kpi.Approval_Status || 'Recommended').toLowerCase().replace(' ', '-')}`}>
                                    {kpi.Approval_Status || 'Recommended'}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-xs btn-ghost"
                                    onClick={() => startEditingKPI(kpi)}
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Inline KPI Edit Form for Operational */}
                        {editingKPICode && operationalKPIs.some(k => k.Code === editingKPICode) && (
                          <div className="inline-kpi-edit-form">
                            <h5>Edit KPI: {editingKPIData?.Name}</h5>
                            <div className="form-grid">
                              <div className="form-group">
                                <label>Name (English) *</label>
                                <input
                                  type="text"
                                  value={editingKPIData?.Name || ''}
                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Name: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label>Name (Arabic)</label>
                                <input
                                  type="text"
                                  value={editingKPIData?.Name_AR || ''}
                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Name_AR: e.target.value })}
                                  dir="rtl"
                                />
                              </div>
                              <div className="form-group">
                                <label>Unit</label>
                                <input
                                  type="text"
                                  value={editingKPIData?.Unit || ''}
                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Unit: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label>Target</label>
                                <input
                                  type="text"
                                  value={editingKPIData?.Target || ''}
                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Target: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label>Weight (%)</label>
                                <input
                                  type="number"
                                  value={editingKPIData?.Weight || 0}
                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Weight: e.target.value })}
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <div className="form-group">
                                <label>Approval Status</label>
                                <select
                                  value={editingKPIData?.Approval_Status || 'Recommended'}
                                  onChange={(e) => setEditingKPIData({ ...editingKPIData, Approval_Status: e.target.value })}
                                >
                                  {approvalStatuses.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="form-actions">
                              <button className="btn btn-primary btn-sm" onClick={saveKPIEdits}>
                                Save Changes
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={cancelEditingKPI}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setAddingKPIForObjective(operationalObjective.Code)}
                    >
                      + Add Operational KPI
                    </button>

                    {/* Inline KPI Add Form for Operational */}
                    {addingKPIForObjective === operationalObjective.Code && (
                      <div className="inline-kpi-form">
                        <h5>Add Operational KPI</h5>
                        <div className="form-grid">
                          <div className="form-group">
                            <label>Name (English) *</label>
                            <input
                              type="text"
                              value={newKPI.Name}
                              onChange={(e) => setNewKPI({ ...newKPI, Name: e.target.value })}
                              placeholder="KPI name..."
                            />
                          </div>
                          <div className="form-group">
                            <label>Name (Arabic)</label>
                            <input
                              type="text"
                              value={newKPI.Name_AR}
                              onChange={(e) => setNewKPI({ ...newKPI, Name_AR: e.target.value })}
                              placeholder="اسم مؤشر..."
                              dir="rtl"
                            />
                          </div>
                          <div className="form-group">
                            <label>Unit</label>
                            <input
                              type="text"
                              value={newKPI.Unit}
                              onChange={(e) => setNewKPI({ ...newKPI, Unit: e.target.value })}
                              placeholder="%, #, AED..."
                            />
                          </div>
                          <div className="form-group">
                            <label>Target</label>
                            <input
                              type="text"
                              value={newKPI.Target}
                              onChange={(e) => setNewKPI({ ...newKPI, Target: e.target.value })}
                              placeholder="Target value..."
                            />
                          </div>
                          <div className="form-group">
                            <label>Weight (%)</label>
                            <input
                              type="number"
                              value={newKPI.Weight}
                              onChange={(e) => setNewKPI({ ...newKPI, Weight: e.target.value })}
                              placeholder="0"
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                        <div className="form-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAddKPIFromObjective(operationalObjective.Code)}
                          >
                            Add KPI
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={resetKPIForm}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  }

  // Render L3 view with BU selection then L2 objective grouping
  const selectedL3BUObj = businessUnits.find(b => b.Code === selectedBU);
  const l3BuParentWeights = selectedBU ? getBuParentWeights(selectedBU) : {};
  const l3BuTotalParentWeight = Object.values(l3BuParentWeights).reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
  const availableL2Objs = selectedBU ? getAvailableParentObjectives(selectedBU) : [];

  return (
    <div className="objectives-tab">
      <div className="objectives-header">
        <h2>L3 Objectives (Department)</h2>
        <p className="section-description">
          Select a department, configure which L2 objectives it uses (weights must total 100%), then define objectives under each L2.
        </p>
      </div>

      {/* Business Unit Filter - Cascading L2 -> L3 */}
      <div className="objectives-filter">
        <label>Division (L2):</label>
        <select
          value={selectedL2}
          onChange={(e) => {
            setSelectedL2(e.target.value);
            setSelectedBU('');
          }}
        >
          <option value="">Select Division first...</option>
          {l2BusinessUnits.map(bu => (
            <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
          ))}
        </select>

        <label>Department (L3):</label>
        <select
          value={selectedBU}
          onChange={(e) => setSelectedBU(e.target.value)}
          disabled={!selectedL2}
        >
          <option value="">{!selectedL2 ? 'Select Division first' : 'Select Department...'}</option>
          {levelBUs.map(bu => (
            <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
          ))}
        </select>
      </div>

      {/* Show message if no BU selected */}
      {!selectedBU ? (
        <div className="empty-state">
          <p>{!selectedL2 ? 'Select a division first, then a department.' : 'Select a department to view and manage its objectives.'}</p>
        </div>
      ) : (
        <>
          {/* L2 Objective Scorecard Configuration */}
          <div className="scorecard-config-section">
            <h3>Scorecard Configuration for {selectedL3BUObj?.Name}</h3>
            <p className="config-description">
              Assign weights to each L2 Objective this department is responsible for. Weights must total 100%.
            </p>

            <div className={`weight-total-indicator ${Math.abs(l3BuTotalParentWeight - 100) < 0.01 ? 'valid' : 'invalid'}`}>
              <span>Total L2 Objective Weight: {l3BuTotalParentWeight.toFixed(0)}%</span>
              {Math.abs(l3BuTotalParentWeight - 100) < 0.01 ? (
                <span className="status-icon"><CheckCircle size={16} /> Complete</span>
              ) : (
                <span className="status-icon"><AlertTriangle size={16} /> {(100 - l3BuTotalParentWeight).toFixed(0)}% {l3BuTotalParentWeight < 100 ? 'remaining' : 'over'}</span>
              )}
            </div>

            {/* Configured L2 Objectives + Operational (Operational always shown) */}
            <div className="configured-parents-list">
              {/* Strategic L2 Objectives */}
              {Object.entries(l3BuParentWeights)
                .filter(([objCode]) => !operationalObjective || objCode !== operationalObjective.Code)
                .filter(([objCode]) => l2ObjectivesList.some(o => o.Code === objCode))
                .map(([objCode, weight]) => {
                  const l2Obj = l2ObjectivesList.find(o => o.Code === objCode);
                  const parentSO = l2Obj ? l1Objectives.find(o => o.Code === l2Obj.Parent_Objective_Code) : null;

                  return (
                    <div key={objCode} className="configured-parent-item">
                      <div className="parent-info">
                        <span className="parent-code">{objCode}</span>
                        <span className="parent-name">{l2Obj.Name}</span>
                        {parentSO && <span className="parent-pillar">(SO: {parentSO.Name})</span>}
                      </div>
                      <div className="parent-weight-input">
                        <input
                          type="number"
                          value={weight}
                          onChange={(e) => setBuParentWeight(selectedBU, objCode, e.target.value)}
                          min="0"
                          max="100"
                          step="1"
                        />
                        <span>%</span>
                      </div>
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={() => removeBuParentWeight(selectedBU, objCode)}
                        title="Remove from scorecard"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

              {/* Operational - ALWAYS shown */}
              {operationalObjective && (
                <div className="configured-parent-item operational-item">
                  <div className="parent-info">
                    <span className="parent-code">OPERATIONAL</span>
                    <span className="parent-name">Operational</span>
                    <span className="parent-pillar operational-tag">(Non-Strategic KPIs)</span>
                  </div>
                  <div className="parent-weight-input">
                    <input
                      type="number"
                      value={l3BuParentWeights[operationalObjective.Code] || 0}
                      onChange={(e) => setBuParentWeight(selectedBU, operationalObjective.Code, e.target.value)}
                      min="0"
                      max="100"
                      step="1"
                    />
                    <span>%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Add L2 Objective to scorecard */}
            {availableL2Objs.length > 0 && (
              <div className="add-parent-form">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setBuParentWeight(selectedBU, e.target.value, 0);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Add L2 Objective to scorecard...</option>
                  {availableL2Objs.map(obj => {
                    const parentSO = l1Objectives.find(o => o.Code === obj.Parent_Objective_Code);
                    return (
                      <option key={obj.Code} value={obj.Code}>
                        {obj.Name} {parentSO ? `(SO: ${parentSO.Name})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Add Objective Button */}
          {Object.keys(l3BuParentWeights).length > 0 && (
            <div className="objectives-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
              >
                + Add L3 Objective
              </button>
            </div>
          )}
          {/* Add Objective Form */}
          {showAddForm && (
            <div className="add-objective-form">
              <h4>Add New L3 Objective for {selectedL3BUObj?.Name}</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name (English) *</label>
                  <input
                    type="text"
                    value={newObj.Name}
                    onChange={(e) => setNewObj({ ...newObj, Name: e.target.value })}
                    placeholder="Objective name..."
                  />
                </div>
                <div className="form-group">
                  <label>Name (Arabic)</label>
                  <input
                    type="text"
                    value={newObj.Name_AR}
                    onChange={(e) => setNewObj({ ...newObj, Name_AR: e.target.value })}
                    placeholder="اسم الهدف..."
                    dir="rtl"
                  />
                </div>
                <div className="form-group">
                  <label>Parent L2 Objective *</label>
                  <select
                    value={newObj.Parent_Objective_Code}
                    onChange={(e) => setNewObj({ ...newObj, Parent_Objective_Code: e.target.value })}
                  >
                    <option value="">Select Parent L2 Objective...</option>
                    {parentObjectives.map(obj => (
                      <option key={obj.Code} value={obj.Code}>{obj.Name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Weight (%)</label>
                  <input
                    type="number"
                    value={newObj.Weight}
                    onChange={(e) => setNewObj({ ...newObj, Weight: e.target.value })}
                    placeholder="0"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
                {perspectives.length > 0 && (
                  <div className="form-group">
                    <label>Perspective (Optional)</label>
                    <select
                      value={newObj.Perspective_Code}
                      onChange={(e) => setNewObj({ ...newObj, Perspective_Code: e.target.value })}
                    >
                      <option value="">Select Perspective...</option>
                      {perspectives.map(p => (
                        <option key={p.Code} value={p.Code}>{p.Name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleAddObjective}>
                  Add Objective
                </button>
                <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Objectives grouped by Parent L2 Objective */}
          {Object.keys(l3BuParentWeights).filter(code => !operationalObjective || code !== operationalObjective.Code).filter(code => l2ObjectivesList.some(o => o.Code === code)).length === 0 ? (
            <div className="empty-state">
              <p>Add L2 Objectives to this department's scorecard above, then create L3 objectives under each L2 Objective.</p>
            </div>
          ) : (
            <div className="pillar-objectives-container">
              {Object.entries(l3BuParentWeights)
                  .filter(([l2ObjCode]) => !operationalObjective || l2ObjCode !== operationalObjective.Code)
                  .filter(([l2ObjCode]) => l2ObjectivesList.some(o => o.Code === l2ObjCode))
                  .map(([l2ObjCode, l2Budget]) => {
                  const l2Data = objectivesByParentL2?.[l2ObjCode];
                  const l2Obj = l2ObjectivesList.find(o => o.Code === l2ObjCode);
                  const parentSO = l2Obj ? l1Objectives.find(o => o.Code === l2Obj.Parent_Objective_Code) : null;
                  const l3_objectives_list = l2Data?.objectives || [];
                  const totalWeight = l3_objectives_list.reduce((sum, obj) => sum + (parseFloat(obj.Weight) || 0), 0);
                  const budgetNum = parseFloat(l2Budget) || 0;
                  const isValid = budgetNum > 0 && Math.abs(totalWeight - budgetNum) < 0.01;
                  const isEmpty = l3_objectives_list.length === 0;
                  const remaining = budgetNum - totalWeight;

                  return (
                    <div key={l2ObjCode} className="pillar-group l3-group">
                      <div className="pillar-group-header l3-header">
                        <div className="pillar-group-info">
                          <span className="pillar-code">{l2ObjCode}</span>
                          <h3>{l2Obj.Name}</h3>
                          {parentSO && (
                            <span className="pillar-weight-badge">SO: {parentSO.Name}</span>
                          )}
                          <span className="pillar-weight-badge">Weight: {budgetNum}%</span>
                        </div>
                        <div className={`weight-indicator ${isValid ? 'valid' : isEmpty ? 'empty' : 'invalid'}`}>
                          {isEmpty ? (
                            <span>No objectives</span>
                          ) : budgetNum === 0 ? (
                            <span className="weight-value">{totalWeight.toFixed(0)}% (no weight set)</span>
                          ) : (
                            <>
                              <span className="weight-value">{totalWeight.toFixed(0)}% / {budgetNum}%</span>
                              <span className="weight-label">
                                {isValid ? <><CheckCircle size={12} /> Complete</> : `${Math.abs(remaining).toFixed(0)}% ${remaining > 0 ? 'remaining' : 'over'}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {isEmpty ? (
                        <div className="pillar-empty-state">
                          <p>No objectives under this L2 Objective yet.</p>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setNewObj(prev => ({ ...prev, Parent_Objective_Code: l2ObjCode, Business_Unit_Code: selectedBU }));
                              setShowAddForm(true);
                            }}
                          >
                            + Add Objective
                          </button>
                        </div>
                      ) : (
                      <div className="pillar-objectives-list">
                        {l3_objectives_list.map(obj => {
                          const perspective = perspectives.find(p => p.Code === obj.Perspective_Code);
                          const kpiCount = getKPICount(obj.Code);
                          const isEditing = editingObj === obj.Code;

                          return (
                            <div key={obj.Code} className="objective-card">
                              {isEditing ? (
                                <div className="objective-edit">
                                  <div className="form-grid">
                                    <div className="form-group">
                                      <label>Name (English)</label>
                                      <input
                                        type="text"
                                        value={obj.Name}
                                        onChange={(e) => updateObjective(obj.Code, { Name: e.target.value })}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Name (Arabic)</label>
                                      <input
                                        type="text"
                                        value={obj.Name_AR || ''}
                                        onChange={(e) => updateObjective(obj.Code, { Name_AR: e.target.value })}
                                        dir="rtl"
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Parent L2 Objective</label>
                                      <select
                                        value={obj.Parent_Objective_Code || ''}
                                        onChange={(e) => updateObjective(obj.Code, { Parent_Objective_Code: e.target.value })}
                                      >
                                        <option value="">Select Parent...</option>
                                        {parentObjectives.map(po => (
                                          <option key={po.Code} value={po.Code}>{po.Name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="form-group">
                                      <label>Weight (%)</label>
                                      <input
                                        type="number"
                                        value={obj.Weight || 0}
                                        onChange={(e) => updateObjective(obj.Code, { Weight: parseFloat(e.target.value) || 0 })}
                                        min="0"
                                        max="100"
                                        step="1"
                                      />
                                    </div>
                                    {perspectives.length > 0 && (
                                      <div className="form-group">
                                        <label>Perspective</label>
                                        <select
                                          value={obj.Perspective_Code || ''}
                                          onChange={(e) => updateObjective(obj.Code, { Perspective_Code: e.target.value })}
                                        >
                                          <option value="">None</option>
                                          {perspectives.map(p => (
                                            <option key={p.Code} value={p.Code}>{p.Name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                  <div className="form-actions">
                                    <button className="btn btn-primary btn-sm" onClick={() => setEditingObj(null)}>
                                      Done
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="objective-display">
                                  <div className="objective-header">
                                    <span className="objective-code">{obj.Code}</span>
                                    <span className="objective-weight">{obj.Weight || 0}%</span>
                                  </div>
                                  <div className="objective-name">{obj.Name}</div>
                                  {obj.Name_AR && <div className="objective-name-ar">{obj.Name_AR}</div>}

                                  <div className="objective-meta">
                                    {perspective && (
                                      <span className="meta-item perspective">
                                        <strong>Perspective:</strong> {perspective.Name}
                                      </span>
                                    )}
                                    <span className="meta-item kpis">
                                      {kpiCount > 0 && (
                                        <button
                                          className={`kpi-expand-btn ${expandedKPIs[obj.Code] ? 'expanded' : ''}`}
                                          onClick={() => toggleKPIExpansion(obj.Code)}
                                          title={expandedKPIs[obj.Code] ? 'Collapse KPIs' : 'Expand KPIs'}
                                        >
                                          ▶
                                        </button>
                                      )}
                                      <strong>KPIs:</strong> {kpiCount}
                                      <button
                                        className="btn btn-xs btn-outline add-kpi-btn"
                                        onClick={() => setAddingKPIForObjective(obj.Code)}
                                      >
                                        + Add KPI
                                      </button>
                                    </span>
                                  </div>

                                  {/* Expanded KPI List */}
                                  {expandedKPIs[obj.Code] && kpiCount > 0 && (
                                    <div className="kpi-list-expanded">
                                      <table className="kpi-table">
                                        <thead>
                                          <tr>
                                            <th>KPI Name</th>
                                            <th>Weight</th>
                                            <th>Target</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {getKPIsForObjective(obj.Code).map(kpi => (
                                            <tr key={kpi.Code}>
                                              <td>{kpi.Name}</td>
                                              <td>{kpi.Weight || 0}%</td>
                                              <td>{kpi.Target || '-'}</td>
                                              <td>
                                                <span className={`status-badge ${(kpi.Approval_Status || 'Recommended').toLowerCase().replace(' ', '-')}`}>
                                                  {kpi.Approval_Status || 'Recommended'}
                                                </span>
                                              </td>
                                              <td>
                                                <button
                                                  className="btn btn-xs btn-ghost"
                                                  onClick={() => startEditingKPI(kpi)}
                                                >
                                                  Edit
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>

                                      {/* Inline KPI Edit Form */}
                                      {editingKPICode && getKPIsForObjective(obj.Code).some(k => k.Code === editingKPICode) && (
                                        <div className="inline-kpi-edit-form">
                                          <h5>Edit KPI: {editingKPIData?.Name}</h5>
                                          <div className="form-grid">
                                            <div className="form-group">
                                              <label>Name (English) *</label>
                                              <input
                                                type="text"
                                                value={editingKPIData?.Name || ''}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Name: e.target.value })}
                                              />
                                            </div>
                                            <div className="form-group">
                                              <label>Name (Arabic)</label>
                                              <input
                                                type="text"
                                                value={editingKPIData?.Name_AR || ''}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Name_AR: e.target.value })}
                                                dir="rtl"
                                              />
                                            </div>
                                            <div className="form-group">
                                              <label>Impact Type</label>
                                              <select
                                                value={editingKPIData?.Impact_Type || 'Direct'}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Impact_Type: e.target.value })}
                                              >
                                                {impactTypes.map(type => (
                                                  <option key={type} value={type}>{type}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="form-group">
                                              <label>Indicator Type</label>
                                              <select
                                                value={editingKPIData?.Indicator_Type || 'Lagging'}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Indicator_Type: e.target.value })}
                                              >
                                                {indicatorTypes.map(type => (
                                                  <option key={type} value={type}>{type}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="form-group">
                                              <label>Approval Status</label>
                                              <select
                                                value={editingKPIData?.Approval_Status || 'Recommended'}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Approval_Status: e.target.value })}
                                              >
                                                {approvalStatuses.map(status => (
                                                  <option key={status} value={status}>{status}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="form-group">
                                              <label>Unit</label>
                                              <input
                                                type="text"
                                                value={editingKPIData?.Unit || ''}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Unit: e.target.value })}
                                              />
                                            </div>
                                            <div className="form-group">
                                              <label>Target</label>
                                              <input
                                                type="text"
                                                value={editingKPIData?.Target || ''}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Target: e.target.value })}
                                              />
                                            </div>
                                            <div className="form-group">
                                              <label>Weight (%)</label>
                                              <input
                                                type="number"
                                                value={editingKPIData?.Weight || 0}
                                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Weight: e.target.value })}
                                                min="0"
                                                max="100"
                                              />
                                            </div>
                                          </div>
                                          <div className="form-group full-width">
                                            <label>Description</label>
                                            <textarea
                                              value={editingKPIData?.Description || ''}
                                              onChange={(e) => setEditingKPIData({ ...editingKPIData, Description: e.target.value })}
                                              rows="2"
                                            />
                                          </div>
                                          <div className="form-actions">
                                            <button className="btn btn-primary btn-sm" onClick={saveKPIEdits}>
                                              Save Changes
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={cancelEditingKPI}>
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="objective-actions">
                                    <button
                                      className="btn btn-sm btn-ghost"
                                      onClick={() => setEditingObj(obj.Code)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleDeleteObjective(obj.Code)}
                                    >
                                      Delete
                                    </button>
                                  </div>

                                  {/* Inline KPI Add Form */}
                                  {addingKPIForObjective === obj.Code && (
                                    <div className="inline-kpi-form">
                                      <h5>Add KPI to {obj.Code}</h5>
                                      <div className="form-grid">
                                        <div className="form-group">
                                          <label>Name (English) *</label>
                                          <input
                                            type="text"
                                            value={newKPI.Name}
                                            onChange={(e) => setNewKPI({ ...newKPI, Name: e.target.value })}
                                            placeholder="KPI name..."
                                          />
                                        </div>
                                        <div className="form-group">
                                          <label>Name (Arabic)</label>
                                          <input
                                            type="text"
                                            value={newKPI.Name_AR}
                                            onChange={(e) => setNewKPI({ ...newKPI, Name_AR: e.target.value })}
                                            placeholder="اسم مؤشر..."
                                            dir="rtl"
                                          />
                                        </div>
                                        <div className="form-group">
                                          <label>Impact Type</label>
                                          <select
                                            value={newKPI.Impact_Type}
                                            onChange={(e) => setNewKPI({ ...newKPI, Impact_Type: e.target.value })}
                                          >
                                            {impactTypes.map(type => (
                                              <option key={type} value={type}>{type}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="form-group">
                                          <label>Indicator Type</label>
                                          <select
                                            value={newKPI.Indicator_Type}
                                            onChange={(e) => setNewKPI({ ...newKPI, Indicator_Type: e.target.value })}
                                          >
                                            {indicatorTypes.map(type => (
                                              <option key={type} value={type}>{type}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="form-group">
                                          <label>Approval Status</label>
                                          <select
                                            value={newKPI.Approval_Status}
                                            onChange={(e) => setNewKPI({ ...newKPI, Approval_Status: e.target.value })}
                                          >
                                            {approvalStatuses.map(status => (
                                              <option key={status} value={status}>{status}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="form-group">
                                          <label>Unit</label>
                                          <input
                                            type="text"
                                            value={newKPI.Unit}
                                            onChange={(e) => setNewKPI({ ...newKPI, Unit: e.target.value })}
                                            placeholder="%, #, AED..."
                                          />
                                        </div>
                                        <div className="form-group">
                                          <label>Target</label>
                                          <input
                                            type="text"
                                            value={newKPI.Target}
                                            onChange={(e) => setNewKPI({ ...newKPI, Target: e.target.value })}
                                            placeholder="Target value..."
                                          />
                                        </div>
                                        <div className="form-group">
                                          <label>Weight (%)</label>
                                          <input
                                            type="number"
                                            value={newKPI.Weight}
                                            onChange={(e) => setNewKPI({ ...newKPI, Weight: e.target.value })}
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                          />
                                        </div>
                                      </div>
                                      <div className="form-group full-width">
                                        <label>Description</label>
                                        <textarea
                                          value={newKPI.Description}
                                          onChange={(e) => setNewKPI({ ...newKPI, Description: e.target.value })}
                                          placeholder="KPI description..."
                                          rows="2"
                                        />
                                      </div>
                                      <div className="form-actions">
                                        <button
                                          className="btn btn-primary btn-sm"
                                          onClick={() => handleAddKPIFromObjective(obj.Code)}
                                        >
                                          Add KPI
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          onClick={resetKPIForm}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Operational Section - Always shown for L3 */}
          {operationalObjective && (() => {
            const opBudget = parseFloat(l3BuParentWeights[operationalObjective.Code]) || 0;
            const opTotalWeight = operationalKPIs.reduce((sum, k) => sum + (parseFloat(k.Weight) || 0), 0);
            const opIsValid = opBudget > 0 && Math.abs(opTotalWeight - opBudget) < 0.01;
            const opRemaining = opBudget - opTotalWeight;
            const opIsEmpty = operationalKPIs.length === 0;

            return (
              <div className="pillar-group l3-group operational-group">
                <div className="pillar-group-header l3-header">
                  <div className="pillar-group-info">
                    <span className="pillar-code">OPERATIONAL</span>
                    <h3>Operational</h3>
                    <span className="pillar-weight-badge">Weight: {opBudget}%</span>
                  </div>
                  <div className={`weight-indicator ${opIsValid ? 'valid' : opIsEmpty ? 'empty' : 'invalid'}`}>
                    {opIsEmpty ? (
                      <span>No KPIs</span>
                    ) : opBudget === 0 ? (
                      <span className="weight-value">{opTotalWeight.toFixed(0)}% (no weight set)</span>
                    ) : (
                      <>
                        <span className="weight-value">{opTotalWeight.toFixed(0)}% / {opBudget}%</span>
                        <span className="weight-label">
                          {opIsValid ? <><CheckCircle size={12} /> Complete</> : `${Math.abs(opRemaining).toFixed(0)}% ${opRemaining > 0 ? 'remaining' : 'over'}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="pillar-objectives-list">
                  {operationalKPIs.length > 0 && (
                    <div className="kpi-list-expanded">
                      <table className="kpi-table">
                        <thead>
                          <tr>
                            <th>KPI Name</th>
                            <th>Weight</th>
                            <th>Target</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operationalKPIs.map(kpi => (
                            <tr key={kpi.Code}>
                              <td>{kpi.Name}</td>
                              <td>{kpi.Weight || 0}%</td>
                              <td>{kpi.Target || '-'}</td>
                              <td>
                                <span className={`status-badge ${(kpi.Approval_Status || 'Recommended').toLowerCase().replace(' ', '-')}`}>
                                  {kpi.Approval_Status || 'Recommended'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-xs btn-ghost"
                                  onClick={() => startEditingKPI(kpi)}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Inline KPI Edit Form for Operational */}
                      {editingKPICode && operationalKPIs.some(k => k.Code === editingKPICode) && (
                        <div className="inline-kpi-edit-form">
                          <h5>Edit KPI: {editingKPIData?.Name}</h5>
                          <div className="form-grid">
                            <div className="form-group">
                              <label>Name (English) *</label>
                              <input
                                type="text"
                                value={editingKPIData?.Name || ''}
                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Name: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Name (Arabic)</label>
                              <input
                                type="text"
                                value={editingKPIData?.Name_AR || ''}
                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Name_AR: e.target.value })}
                                dir="rtl"
                              />
                            </div>
                            <div className="form-group">
                              <label>Unit</label>
                              <input
                                type="text"
                                value={editingKPIData?.Unit || ''}
                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Unit: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Target</label>
                              <input
                                type="text"
                                value={editingKPIData?.Target || ''}
                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Target: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Weight (%)</label>
                              <input
                                type="number"
                                value={editingKPIData?.Weight || 0}
                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Weight: e.target.value })}
                                min="0"
                                max="100"
                              />
                            </div>
                            <div className="form-group">
                              <label>Approval Status</label>
                              <select
                                value={editingKPIData?.Approval_Status || 'Recommended'}
                                onChange={(e) => setEditingKPIData({ ...editingKPIData, Approval_Status: e.target.value })}
                              >
                                {approvalStatuses.map(status => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="form-actions">
                            <button className="btn btn-primary btn-sm" onClick={saveKPIEdits}>
                              Save Changes
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={cancelEditingKPI}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setAddingKPIForObjective(operationalObjective.Code)}
                  >
                    + Add Operational KPI
                  </button>

                  {/* Inline KPI Add Form for Operational */}
                  {addingKPIForObjective === operationalObjective.Code && (
                    <div className="inline-kpi-form">
                      <h5>Add Operational KPI</h5>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Name (English) *</label>
                          <input
                            type="text"
                            value={newKPI.Name}
                            onChange={(e) => setNewKPI({ ...newKPI, Name: e.target.value })}
                            placeholder="KPI name..."
                          />
                        </div>
                        <div className="form-group">
                          <label>Name (Arabic)</label>
                          <input
                            type="text"
                            value={newKPI.Name_AR}
                            onChange={(e) => setNewKPI({ ...newKPI, Name_AR: e.target.value })}
                            placeholder="اسم مؤشر..."
                            dir="rtl"
                          />
                        </div>
                        <div className="form-group">
                          <label>Unit</label>
                          <input
                            type="text"
                            value={newKPI.Unit}
                            onChange={(e) => setNewKPI({ ...newKPI, Unit: e.target.value })}
                            placeholder="%, #, AED..."
                          />
                        </div>
                        <div className="form-group">
                          <label>Target</label>
                          <input
                            type="text"
                            value={newKPI.Target}
                            onChange={(e) => setNewKPI({ ...newKPI, Target: e.target.value })}
                            placeholder="Target value..."
                          />
                        </div>
                        <div className="form-group">
                          <label>Weight (%)</label>
                          <input
                            type="number"
                            value={newKPI.Weight}
                            onChange={(e) => setNewKPI({ ...newKPI, Weight: e.target.value })}
                            placeholder="0"
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddKPIFromObjective(operationalObjective.Code)}
                        >
                          Add KPI
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={resetKPIForm}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

export default ObjectivesTab;
