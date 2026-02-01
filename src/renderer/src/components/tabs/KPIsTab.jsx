import React, { useState, useMemo } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';
import { useLicense } from '../../contexts/LicenseContext';
import { AlertTriangle, CheckCircle } from 'lucide-react';

function KPIsTab() {
  const {
    kpis,
    addKPI,
    updateKPI,
    deleteKPI,
    objectives,
    businessUnits
  } = useStrategy();

  const { isFeatureAllowed, isReadOnly, featureLimits, isInTrial } = useLicense();

  // Check if we can add more KPIs
  const canAddMoreKPIs = isFeatureAllowed('kpis', kpis.length);
  const kpiLimit = featureLimits?.MAX_KPIS;

  const [filterLevel, setFilterLevel] = useState('');
  const [filterL2, setFilterL2] = useState(''); // For L3 cascading
  const [filterBU, setFilterBU] = useState('');
  const [filterObjective, setFilterObjective] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('');
  const [editingKPI, setEditingKPI] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKPI, setNewKPI] = useState({
    Name: '',
    Name_AR: '',
    Description: '',
    Description_AR: '',
    Objective_Code: '',
    Impact_Type: 'Direct',
    Indicator_Type: 'Lagging',
    Approval_Status: 'Recommended',
    Unit: '',
    Target: '',
    Target_Mode: 'single', // 'single' or 'monthly'
    Monthly_Targets: {},
    Weight: 0,
    Formula: '',
    Data_Points: '',
    Polarity: 'Positive'
  });

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const approvalStatuses = ['Recommended', 'Under Discussion', 'Locked'];
  const indicatorTypes = ['Lagging', 'Leading'];
  const polarityOptions = ['Positive', 'Negative'];

  // Get L2 business units (for L3 cascading filter)
  const l2BusinessUnits = useMemo(() => {
    return businessUnits.filter(bu => bu.Level === 'L2');
  }, [businessUnits]);

  // Filter business units by selected level (and by L2 for L3)
  const filteredBUs = useMemo(() => {
    if (!filterLevel) return businessUnits;
    if (filterLevel === 'L3' && filterL2) {
      return businessUnits.filter(bu => bu.Level === 'L3' && bu.Parent_Code === filterL2);
    }
    return businessUnits.filter(bu => bu.Level === filterLevel);
  }, [businessUnits, filterLevel, filterL2]);

  // Filter objectives by selected level and BU
  const filteredObjectives = useMemo(() => {
    let objs = objectives;
    if (filterLevel) {
      objs = objs.filter(obj => obj.Level === filterLevel);
    }
    if (filterBU) {
      objs = objs.filter(obj => obj.Business_Unit_Code === filterBU);
    }
    return objs;
  }, [objectives, filterLevel, filterBU]);

  // Filter KPIs
  const filteredKPIs = useMemo(() => {
    let result = kpis;
    if (filterObjective) {
      result = result.filter(kpi => kpi.Objective_Code === filterObjective);
    } else if (filterBU) {
      const buObjectives = objectives.filter(obj => obj.Business_Unit_Code === filterBU).map(obj => obj.Code);
      result = result.filter(kpi => buObjectives.includes(kpi.Objective_Code));
    } else if (filterLevel) {
      const levelObjectives = objectives.filter(obj => obj.Level === filterLevel).map(obj => obj.Code);
      result = result.filter(kpi => levelObjectives.includes(kpi.Objective_Code));
    }
    // Filter by approval status
    if (filterApprovalStatus) {
      result = result.filter(kpi => kpi.Approval_Status === filterApprovalStatus);
    }
    return result;
  }, [kpis, filterLevel, filterBU, filterObjective, filterApprovalStatus, objectives]);

  // All objectives for the edit form (shows everything)
  const allObjectivesGrouped = useMemo(() => {
    const grouped = {};
    objectives.forEach(obj => {
      const bu = businessUnits.find(b => b.Code === obj.Business_Unit_Code);
      const key = `${obj.Level} - ${bu ? bu.Name : 'Unknown'}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(obj);
    });
    return grouped;
  }, [objectives, businessUnits]);

  // Objectives for add form - filtered by current selections
  const objectivesForAddForm = useMemo(() => {
    // If a specific BU is selected, show only that BU's objectives
    if (filterBU) {
      return objectives.filter(obj => obj.Business_Unit_Code === filterBU);
    }
    // If only level is selected, show all objectives for that level
    if (filterLevel) {
      return objectives.filter(obj => obj.Level === filterLevel);
    }
    // No filter - return empty (require selection first)
    return [];
  }, [objectives, filterLevel, filterBU]);

  // Calculate total weight of filtered KPIs
  const totalKPIWeight = useMemo(() => {
    return filteredKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.Weight) || 0), 0);
  }, [filteredKPIs]);

  // Get the selected objective and its weight budget
  const selectedObjective = useMemo(() => {
    if (filterObjective) {
      return objectives.find(obj => obj.Code === filterObjective);
    }
    return null;
  }, [filterObjective, objectives]);

  // Get objective weight budget - for L1 objectives, the weight is on the objective itself
  // For all levels, the KPIs should sum to the objective's Weight field
  const objectiveWeightBudget = useMemo(() => {
    if (selectedObjective) {
      return parseFloat(selectedObjective.Weight) || 0;
    }
    return 0;
  }, [selectedObjective]);

  // Group KPIs by objective when filtering by BU (to show per-objective weight validation)
  const kpisByObjective = useMemo(() => {
    if (!filterBU || filterObjective) return null;

    const grouped = {};
    filteredKPIs.forEach(kpi => {
      if (!grouped[kpi.Objective_Code]) {
        grouped[kpi.Objective_Code] = [];
      }
      grouped[kpi.Objective_Code].push(kpi);
    });
    return grouped;
  }, [filteredKPIs, filterBU, filterObjective]);

  // Calculate weight summaries per objective
  const objectiveWeightSummaries = useMemo(() => {
    if (!kpisByObjective) return null;

    const summaries = {};
    Object.entries(kpisByObjective).forEach(([objCode, objKpis]) => {
      const obj = objectives.find(o => o.Code === objCode);
      const budget = parseFloat(obj?.Weight) || 0;
      const total = objKpis.reduce((sum, kpi) => sum + (parseFloat(kpi.Weight) || 0), 0);
      summaries[objCode] = {
        objective: obj,
        budget,
        total,
        kpiCount: objKpis.length,
        isValid: Math.abs(total - budget) < 0.01
      };
    });
    return summaries;
  }, [kpisByObjective, objectives]);

  // Get the selected BU name for display
  const selectedBUName = useMemo(() => {
    if (filterBU) {
      const bu = businessUnits.find(b => b.Code === filterBU);
      return bu ? bu.Name : '';
    }
    return '';
  }, [filterBU, businessUnits]);

  const handleAddKPI = () => {
    if (!newKPI.Name.trim() || !newKPI.Objective_Code) return;

    addKPI({
      ...newKPI,
      Weight: parseFloat(newKPI.Weight) || 0
    });
    setNewKPI({
      Name: '',
      Name_AR: '',
      Description: '',
      Description_AR: '',
      Objective_Code: '',
      Impact_Type: 'Direct',
      Indicator_Type: 'Lagging',
      Approval_Status: 'Recommended',
      Unit: '',
      Target: '',
      Target_Mode: 'single',
      Monthly_Targets: {},
      Weight: 0,
      Formula: '',
      Data_Points: '',
      Polarity: 'Positive'
    });
    setShowAddForm(false);
  };

  const impactTypes = ['Direct', 'Indirect', 'Complimentary'];

  return (
    <div className="kpis-tab">
      <div className="kpis-header">
        <h2>Key Performance Indicators</h2>
        <p className="section-description">
          Define and manage KPIs linked to objectives. Each KPI must be linked to exactly one objective.
        </p>
      </div>

      {/* Filters */}
      <div className="kpis-filters">
        <div className="filter-group">
          <label>Level:</label>
          <select
            value={filterLevel}
            onChange={(e) => {
              setFilterLevel(e.target.value);
              setFilterL2('');
              setFilterBU('');
              setFilterObjective('');
            }}
          >
            <option value="">All Levels</option>
            <option value="L1">L1 (Corporate)</option>
            <option value="L2">L2 (Division)</option>
            <option value="L3">L3 (Department)</option>
          </select>
        </div>

        {/* Show L2 filter when L3 is selected (cascading) */}
        {filterLevel === 'L3' && (
          <div className="filter-group">
            <label>Division (L2):</label>
            <select
              value={filterL2}
              onChange={(e) => {
                setFilterL2(e.target.value);
                setFilterBU('');
                setFilterObjective('');
              }}
            >
              <option value="">Select Division first...</option>
              {l2BusinessUnits.map(bu => (
                <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>{filterLevel === 'L3' ? 'Department:' : 'Business Unit:'}</label>
          <select
            value={filterBU}
            onChange={(e) => {
              setFilterBU(e.target.value);
              setFilterObjective('');
            }}
            disabled={filterLevel === 'L3' && !filterL2}
          >
            <option value="">
              {filterLevel === 'L3' && !filterL2 ? 'Select Division first' : 'All Units'}
            </option>
            {filteredBUs.map(bu => (
              <option key={bu.Code} value={bu.Code}>
                {filterLevel ? bu.Name : `${bu.Level} - ${bu.Name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Objective:</label>
          <select
            value={filterObjective}
            onChange={(e) => setFilterObjective(e.target.value)}
          >
            <option value="">All Objectives</option>
            {filteredObjectives.map(obj => (
              <option key={obj.Code} value={obj.Code}>
                {obj.Name} {obj.Is_Operational ? '(Operational)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filterApprovalStatus}
            onChange={(e) => setFilterApprovalStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {approvalStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
          disabled={!canAddMoreKPIs || isReadOnly()}
        >
          + Add KPI
        </button>
      </div>

      {/* License limit warning */}
      {isInTrial() && !canAddMoreKPIs && (
        <div className="limit-warning">
          <span className="limit-warning-icon"><AlertTriangle size={14} /></span>
          <div className="limit-warning-text">
            <strong>KPI Limit Reached</strong>
            <span>Trial is limited to {kpiLimit} KPIs. </span>
          </div>
          <a href="http://localhost:3000/products/cpm-software" target="_blank" rel="noopener noreferrer">
            Upgrade License
          </a>
        </div>
      )}

      {/* Read-only warning */}
      {isReadOnly() && (
        <div className="limit-warning">
          <span className="limit-warning-icon">🔒</span>
          <div className="limit-warning-text">
            <strong>Read-Only Mode</strong>
            <span>Your license has expired. You cannot make changes.</span>
          </div>
          <a href="http://localhost:3000/products/cpm-software" target="_blank" rel="noopener noreferrer">
            Renew License
          </a>
        </div>
      )}

      {/* Weight Indicator - when a specific objective is selected */}
      {filterObjective && selectedObjective && filteredKPIs.length > 0 && (
        <div className="kpi-weight-summary">
          <div className="weight-summary-header">
            <span className="weight-summary-title">
              KPI Weights for "{selectedObjective.Name}"
            </span>
            <span className="weight-summary-count">
              {filteredKPIs.length} KPI{filteredKPIs.length !== 1 ? 's' : ''} | Target: {objectiveWeightBudget}%
            </span>
          </div>
          <div className="weight-summary-bar">
            <div
              className={`weight-bar-fill ${Math.abs(totalKPIWeight - objectiveWeightBudget) < 0.01 ? 'complete' : totalKPIWeight > objectiveWeightBudget ? 'over' : ''}`}
              style={{ width: `${objectiveWeightBudget > 0 ? Math.min((totalKPIWeight / objectiveWeightBudget) * 100, 100) : 0}%` }}
            />
          </div>
          <div className={`weight-summary-value ${Math.abs(totalKPIWeight - objectiveWeightBudget) < 0.01 ? 'valid' : totalKPIWeight > objectiveWeightBudget ? 'over' : 'under'}`}>
            <span className="weight-total">{totalKPIWeight.toFixed(0)}% / {objectiveWeightBudget}%</span>
            <span className="weight-status">
              {Math.abs(totalKPIWeight - objectiveWeightBudget) < 0.01
                ? <><CheckCircle size={12} /> Complete</>
                : totalKPIWeight > objectiveWeightBudget
                  ? `${(totalKPIWeight - objectiveWeightBudget).toFixed(0)}% over limit`
                  : `${(objectiveWeightBudget - totalKPIWeight).toFixed(0)}% remaining`
              }
            </span>
          </div>
        </div>
      )}

      {/* Per-objective weight summaries when filtering by BU (no specific objective selected) */}
      {filterBU && !filterObjective && objectiveWeightSummaries && Object.keys(objectiveWeightSummaries).length > 0 && (
        <div className="kpi-weight-summaries-grid">
          <div className="weight-summaries-header">
            <h4>KPI Weight Distribution by Objective</h4>
            <span className="weight-summaries-subtitle">Each objective's KPIs should sum to the objective's weight</span>
          </div>
          <div className="weight-summaries-list">
            {Object.entries(objectiveWeightSummaries).map(([objCode, summary]) => (
              <div key={objCode} className={`objective-weight-summary ${summary.isValid ? 'valid' : 'invalid'}`}>
                <div className="obj-summary-header">
                  <span className="obj-name">{summary.objective?.Name || objCode}</span>
                  <span className={`obj-status ${summary.isValid ? 'valid' : 'invalid'}`}>
                    {summary.isValid ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                  </span>
                </div>
                <div className="obj-summary-bar">
                  <div
                    className={`obj-bar-fill ${summary.isValid ? 'complete' : summary.total > summary.budget ? 'over' : ''}`}
                    style={{ width: `${summary.budget > 0 ? Math.min((summary.total / summary.budget) * 100, 100) : 0}%` }}
                  />
                </div>
                <div className="obj-summary-details">
                  <span className="obj-kpi-count">{summary.kpiCount} KPI{summary.kpiCount !== 1 ? 's' : ''}</span>
                  <span className="obj-weight-ratio">{summary.total.toFixed(0)}% / {summary.budget}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add KPI Form */}
      {showAddForm && (
        <div className="add-kpi-form">
          <h4>
            Add New KPI
            {filterBU && (() => {
              const bu = businessUnits.find(b => b.Code === filterBU);
              return bu ? ` for ${bu.Name}` : '';
            })()}
          </h4>
          {!filterBU && !filterLevel ? (
            <div className="form-message warning">
              Please select a Level and Business Unit from the filters above to add a KPI.
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)} style={{ marginLeft: '12px' }}>
                Close
              </button>
            </div>
          ) : !filterBU ? (
            <div className="form-message warning">
              Please select a Business Unit from the filters above to add a KPI.
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)} style={{ marginLeft: '12px' }}>
                Close
              </button>
            </div>
          ) : (
          <>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Objective *</label>
              <select
                value={newKPI.Objective_Code}
                onChange={(e) => setNewKPI({ ...newKPI, Objective_Code: e.target.value })}
              >
                <option value="">Select Objective...</option>
                {objectivesForAddForm.map(obj => (
                  <option key={obj.Code} value={obj.Code}>
                    {obj.Name} {obj.Is_Operational ? '(Operational)' : ''}
                  </option>
                ))}
              </select>
            </div>
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
                placeholder="اسم المؤشر..."
                dir="rtl"
              />
            </div>
            <div className="form-group full-width">
              <label>Description (English)</label>
              <textarea
                value={newKPI.Description}
                onChange={(e) => setNewKPI({ ...newKPI, Description: e.target.value })}
                placeholder="KPI description..."
                rows={2}
              />
            </div>
            <div className="form-group full-width">
              <label>Description (Arabic)</label>
              <textarea
                value={newKPI.Description_AR}
                onChange={(e) => setNewKPI({ ...newKPI, Description_AR: e.target.value })}
                placeholder="وصف المؤشر..."
                dir="rtl"
                rows={2}
              />
            </div>
            <div className="form-group">
              <label>Impact Type *</label>
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
              <label>Indicator Type *</label>
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
              <label>Approval Status *</label>
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
                placeholder="%, $, count, etc."
              />
            </div>
            <div className="form-group full-width">
              <label>Target</label>
              <div className="target-mode-selector">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="newKpiTargetMode"
                    value="single"
                    checked={newKPI.Target_Mode === 'single'}
                    onChange={() => setNewKPI({ ...newKPI, Target_Mode: 'single' })}
                  />
                  Same for all months
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="newKpiTargetMode"
                    value="monthly"
                    checked={newKPI.Target_Mode === 'monthly'}
                    onChange={() => setNewKPI({ ...newKPI, Target_Mode: 'monthly' })}
                  />
                  Different per month
                </label>
              </div>
              {newKPI.Target_Mode === 'single' ? (
                <input
                  type="text"
                  value={newKPI.Target}
                  onChange={(e) => setNewKPI({ ...newKPI, Target: e.target.value })}
                  placeholder="Target value for all months"
                />
              ) : (
                <div className="monthly-targets-grid">
                  {MONTHS.map((month, idx) => (
                    <div key={month} className="monthly-target-input">
                      <label>{month}</label>
                      <input
                        type="text"
                        value={newKPI.Monthly_Targets[idx] || ''}
                        onChange={(e) => setNewKPI({
                          ...newKPI,
                          Monthly_Targets: { ...newKPI.Monthly_Targets, [idx]: e.target.value }
                        })}
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Weight (%)</label>
              <input
                type="number"
                value={newKPI.Weight}
                onChange={(e) => setNewKPI({ ...newKPI, Weight: e.target.value })}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="form-group">
              <label>Polarity</label>
              <select
                value={newKPI.Polarity}
                onChange={(e) => setNewKPI({ ...newKPI, Polarity: e.target.value })}
              >
                {polarityOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="form-group full-width">
              <label>Formula</label>
              <textarea
                value={newKPI.Formula}
                onChange={(e) => setNewKPI({ ...newKPI, Formula: e.target.value })}
                placeholder="e.g., (Revenue - Cost) / Revenue * 100"
                rows={2}
              />
            </div>
            <div className="form-group full-width">
              <label>Data Points</label>
              <textarea
                value={newKPI.Data_Points}
                onChange={(e) => setNewKPI({ ...newKPI, Data_Points: e.target.value })}
                placeholder="e.g., Revenue, Cost, Number of Employees..."
                rows={2}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleAddKPI}>
              Add KPI
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
          </>
          )}
        </div>
      )}

      {/* KPIs List */}
      <div className="kpis-list">
        {filteredKPIs.length === 0 ? (
          <div className="empty-state">
            <p>No KPIs found. Use the filters above or click "Add KPI" to create one.</p>
          </div>
        ) : (
          filteredKPIs.map(kpi => {
            const objective = objectives.find(obj => obj.Code === kpi.Objective_Code);
            const bu = objective ? businessUnits.find(b => b.Code === objective.Business_Unit_Code) : null;
            const isEditing = editingKPI === kpi.Code;

            return (
              <div key={kpi.Code} className="kpi-card">
                {isEditing ? (
                  <div className="kpi-edit">
                    <div className="form-grid">
                      <div className="form-group full-width">
                        <label>Objective</label>
                        <select
                          value={kpi.Objective_Code}
                          onChange={(e) => updateKPI(kpi.Code, { Objective_Code: e.target.value })}
                        >
                          {Object.entries(allObjectivesGrouped).map(([group, objs]) => (
                            <optgroup key={group} label={group}>
                              {objs.map(obj => (
                                <option key={obj.Code} value={obj.Code}>
                                  {obj.Name} {obj.Is_Operational ? '(Operational)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Name (English)</label>
                        <input
                          type="text"
                          value={kpi.Name}
                          onChange={(e) => updateKPI(kpi.Code, { Name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Name (Arabic)</label>
                        <input
                          type="text"
                          value={kpi.Name_AR || ''}
                          onChange={(e) => updateKPI(kpi.Code, { Name_AR: e.target.value })}
                          dir="rtl"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Description (English)</label>
                        <textarea
                          value={kpi.Description || ''}
                          onChange={(e) => updateKPI(kpi.Code, { Description: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Description (Arabic)</label>
                        <textarea
                          value={kpi.Description_AR || ''}
                          onChange={(e) => updateKPI(kpi.Code, { Description_AR: e.target.value })}
                          dir="rtl"
                          rows={2}
                        />
                      </div>
                      <div className="form-group">
                        <label>Impact Type</label>
                        <select
                          value={kpi.Impact_Type || 'Direct'}
                          onChange={(e) => updateKPI(kpi.Code, { Impact_Type: e.target.value })}
                        >
                          {impactTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Indicator Type</label>
                        <select
                          value={kpi.Indicator_Type || 'Lagging'}
                          onChange={(e) => updateKPI(kpi.Code, { Indicator_Type: e.target.value })}
                        >
                          {indicatorTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Approval Status</label>
                        <select
                          value={kpi.Approval_Status || 'Recommended'}
                          onChange={(e) => updateKPI(kpi.Code, { Approval_Status: e.target.value })}
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
                          value={kpi.Unit || ''}
                          onChange={(e) => updateKPI(kpi.Code, { Unit: e.target.value })}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Target</label>
                        <div className="target-mode-selector">
                          <label className="radio-label">
                            <input
                              type="radio"
                              name={`targetMode-${kpi.Code}`}
                              value="single"
                              checked={(kpi.Target_Mode || 'single') === 'single'}
                              onChange={() => updateKPI(kpi.Code, { Target_Mode: 'single' })}
                            />
                            Same for all months
                          </label>
                          <label className="radio-label">
                            <input
                              type="radio"
                              name={`targetMode-${kpi.Code}`}
                              value="monthly"
                              checked={kpi.Target_Mode === 'monthly'}
                              onChange={() => updateKPI(kpi.Code, { Target_Mode: 'monthly' })}
                            />
                            Different per month
                          </label>
                        </div>
                        {(kpi.Target_Mode || 'single') === 'single' ? (
                          <input
                            type="text"
                            value={kpi.Target || ''}
                            onChange={(e) => updateKPI(kpi.Code, { Target: e.target.value })}
                            placeholder="Target value for all months"
                          />
                        ) : (
                          <div className="monthly-targets-grid">
                            {MONTHS.map((month, idx) => (
                              <div key={month} className="monthly-target-input">
                                <label>{month}</label>
                                <input
                                  type="text"
                                  value={(kpi.Monthly_Targets || {})[idx] || ''}
                                  onChange={(e) => updateKPI(kpi.Code, {
                                    Monthly_Targets: { ...(kpi.Monthly_Targets || {}), [idx]: e.target.value }
                                  })}
                                  placeholder="—"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Weight (%)</label>
                        <input
                          type="number"
                          value={kpi.Weight || 0}
                          onChange={(e) => updateKPI(kpi.Code, { Weight: parseFloat(e.target.value) || 0 })}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                      <div className="form-group">
                        <label>Polarity</label>
                        <select
                          value={kpi.Polarity || 'Positive'}
                          onChange={(e) => updateKPI(kpi.Code, { Polarity: e.target.value })}
                        >
                          {polarityOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group full-width">
                        <label>Formula</label>
                        <textarea
                          value={kpi.Formula || ''}
                          onChange={(e) => updateKPI(kpi.Code, { Formula: e.target.value })}
                          placeholder="e.g., (Revenue - Cost) / Revenue * 100"
                          rows={2}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Data Points</label>
                        <textarea
                          value={kpi.Data_Points || ''}
                          onChange={(e) => updateKPI(kpi.Code, { Data_Points: e.target.value })}
                          placeholder="e.g., Revenue, Cost, Number of Employees..."
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => setEditingKPI(null)}>
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="kpi-display">
                    <div className="kpi-header">
                      <span className="kpi-code">{kpi.Code}</span>
                      <span className={`indicator-type-badge ${(kpi.Indicator_Type || 'Lagging').toLowerCase()}`}>
                        {kpi.Indicator_Type || 'Lagging'}
                      </span>
                      <span className={`impact-badge ${kpi.Impact_Type?.toLowerCase() || 'direct'}`}>
                        {kpi.Impact_Type || 'Direct'}
                      </span>
                      <span className={`approval-status-badge ${(kpi.Approval_Status || 'Recommended').toLowerCase().replace(' ', '-')}`}>
                        {kpi.Approval_Status || 'Recommended'}
                      </span>
                    </div>
                    <div className="kpi-name">{kpi.Name}</div>
                    {kpi.Name_AR && <div className="kpi-name-ar">{kpi.Name_AR}</div>}
                    {kpi.Description && (
                      <div className="kpi-description">{kpi.Description}</div>
                    )}

                    <div className="kpi-meta">
                      {objective && (
                        <span className="meta-item objective">
                          <strong>Objective:</strong> {objective.Name}
                          {objective.Is_Operational && ' (Operational)'}
                        </span>
                      )}
                      {bu && (
                        <span className="meta-item bu">
                          <strong>BU:</strong> {bu.Level} - {bu.Name}
                        </span>
                      )}
                      {kpi.Unit && (
                        <span className="meta-item unit">
                          <strong>Unit:</strong> {kpi.Unit}
                        </span>
                      )}
                      {kpi.Target && (
                        <span className="meta-item target">
                          <strong>Target:</strong> {kpi.Target}
                        </span>
                      )}
                      {kpi.Weight > 0 && (
                        <span className="meta-item weight">
                          <strong>Weight:</strong> {kpi.Weight}%
                        </span>
                      )}
                      <span className={`meta-item polarity ${(kpi.Polarity || 'Positive').toLowerCase()}`}>
                        <strong>Polarity:</strong> {kpi.Polarity || 'Positive'}
                      </span>
                    </div>

                    {(kpi.Formula || kpi.Data_Points) && (
                      <div className="kpi-calculation-details">
                        {kpi.Formula && (
                          <div className="calc-item formula">
                            <strong>Formula:</strong>
                            <span className="calc-value">{kpi.Formula}</span>
                          </div>
                        )}
                        {kpi.Data_Points && (
                          <div className="calc-item data-points">
                            <strong>Data Points:</strong>
                            <span className="calc-value">{kpi.Data_Points}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="kpi-actions">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setEditingKPI(kpi.Code)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteKPI(kpi.Code)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default KPIsTab;
