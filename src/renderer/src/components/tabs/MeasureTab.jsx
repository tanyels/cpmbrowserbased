import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

// Safe expression evaluator (no eval/Function)
// Supports: +, -, *, /, parentheses for grouping, and functions: SUM(), AVG(), MIN(), MAX(), FIRST(), LAST(), ABS()
function safeEvaluate(tokens) {
  console.log('[safeEvaluate] Input tokens:', tokens);

  if (!tokens || tokens.length === 0) {
    console.log('[safeEvaluate] Empty tokens');
    return null;
  }

  const isOperator = (t) => ['+', '-', '*', '/'].includes(t);
  const isFunction = (t) => typeof t === 'string' && ['SUM(', 'AVG(', 'MIN(', 'MAX(', 'FIRST(', 'LAST(', 'ABS('].includes(t.toUpperCase());
  const isOpenParen = (t) => t === '(';
  const isCloseParen = (t) => t === ')';
  const isNumber = (t) => typeof t === 'number' && !isNaN(t);

  // Normalize all tokens first
  const normalizedTokens = tokens.map(token => {
    if (typeof token === 'string') {
      const trimmed = token.trim();
      if (trimmed === '(' || trimmed === ')') return trimmed;
      if (isOperator(trimmed)) return trimmed;
      if (isFunction(trimmed)) return trimmed;
      const num = parseFloat(trimmed);
      if (!isNaN(num)) return num;
    }
    return token;
  });

  console.log('[safeEvaluate] Normalized tokens:', normalizedTokens);

  // Process tokens handling parentheses recursively
  function evaluateExpression(toks) {
    let processed = [];
    let i = 0;

    while (i < toks.length) {
      let token = toks[i];

      if (isFunction(token)) {
        // Collect arguments until closing paren
        const funcName = token.toUpperCase().replace('(', '');
        const args = [];
        i++; // move past function token

        let parenDepth = 1;
        while (i < toks.length && parenDepth > 0) {
          if (isOpenParen(toks[i])) parenDepth++;
          else if (isCloseParen(toks[i])) parenDepth--;

          if (parenDepth > 0) {
            let arg = toks[i];
            if (isNumber(arg)) {
              args.push(arg);
            }
          }
          i++;
        }

        console.log(`[safeEvaluate] Function ${funcName} with args:`, args);

        // Apply function
        let funcResult = null;
        if (args.length > 0) {
          switch (funcName) {
            case 'SUM':
              funcResult = args.reduce((a, b) => a + b, 0);
              break;
            case 'AVG':
              funcResult = args.reduce((a, b) => a + b, 0) / args.length;
              break;
            case 'MIN':
              funcResult = Math.min(...args);
              break;
            case 'MAX':
              funcResult = Math.max(...args);
              break;
            case 'FIRST':
              funcResult = args[0];
              break;
            case 'LAST':
              funcResult = args[args.length - 1];
              break;
            case 'ABS':
              funcResult = Math.abs(args[0]);
              break;
            default:
              console.log('[safeEvaluate] Unknown function:', funcName);
              return null;
          }
        }

        if (funcResult !== null) {
          processed.push(funcResult);
        }
      } else if (isOpenParen(token)) {
        // Find matching closing paren and recursively evaluate
        let parenDepth = 1;
        let start = i + 1;
        i++;

        while (i < toks.length && parenDepth > 0) {
          if (isOpenParen(toks[i])) parenDepth++;
          else if (isCloseParen(toks[i])) parenDepth--;
          i++;
        }

        // Extract the sub-expression (excluding the parens)
        const subExpr = toks.slice(start, i - 1);
        console.log('[safeEvaluate] Sub-expression in parens:', subExpr);

        // Recursively evaluate the sub-expression
        const subResult = evaluateExpression(subExpr);
        if (subResult !== null && isNumber(subResult)) {
          processed.push(subResult);
        }
      } else if (!isCloseParen(token)) {
        processed.push(token);
        i++;
      } else {
        i++;
      }
    }

    console.log('[safeEvaluate] After paren/function processing:', processed);

    // Now evaluate arithmetic on processed tokens
    if (processed.length === 0) return null;
    if (processed.length === 1) {
      return isNumber(processed[0]) ? processed[0] : null;
    }

    // First pass: handle * and /
    let intermediate = [];
    let j = 0;
    while (j < processed.length) {
      const tok = processed[j];

      if (isNumber(tok)) {
        if (intermediate.length >= 2) {
          const lastOp = intermediate[intermediate.length - 1];
          if (lastOp === '*' || lastOp === '/') {
            intermediate.pop();
            const left = intermediate.pop();
            if (lastOp === '*') {
              intermediate.push(left * tok);
            } else {
              if (tok === 0) return NaN;
              intermediate.push(left / tok);
            }
          } else {
            intermediate.push(tok);
          }
        } else {
          intermediate.push(tok);
        }
      } else if (isOperator(tok)) {
        intermediate.push(tok);
      }
      j++;
    }

    console.log('[safeEvaluate] After * and /:', intermediate);

    // Second pass: handle + and -
    if (intermediate.length === 0) return null;

    let result = intermediate[0];
    if (!isNumber(result)) {
      console.log('[safeEvaluate] First element is not a number:', result);
      return null;
    }

    j = 1;
    while (j < intermediate.length) {
      const op = intermediate[j];
      const right = intermediate[j + 1];

      if (op === '+' && isNumber(right)) {
        result = result + right;
      } else if (op === '-' && isNumber(right)) {
        result = result - right;
      } else if (!isOperator(op)) {
        j++;
        continue;
      }
      j += 2;
    }

    return result;
  }

  const result = evaluateExpression(normalizedTokens);
  console.log('[safeEvaluate] Final result:', result);
  return result;
}

function MeasureTab({ view = 'list' }) {
  const {
    kpis,
    objectives,
    businessUnits,
    globalValues,
    measures,
    parameterValues,
    calculatedValues,
    achievements,
    settings,
    addGlobalValue,
    updateGlobalValue,
    deleteGlobalValue,
    addMeasure,
    updateMeasure,
    deleteMeasure,
    setParameterValue,
    updateCalculatedValues,
    updateAchievements,
    updateKPI
  } = useStrategy();

  // View state: 'list' | 'global-values' | 'builder' | 'data-entry'
  // Use prop for main view, but allow switching to 'builder' internally
  const [internalView, setInternalView] = useState(null);
  const activeView = internalView || view;
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [selectedKPI, setSelectedKPI] = useState(null);

  // Reset internal view when prop changes
  useEffect(() => {
    setInternalView(null);
    setSelectedMeasure(null);
    setSelectedKPI(null);
  }, [view]);

  // Filter states
  const [filterLevel, setFilterLevel] = useState('');
  const [filterL2BU, setFilterL2BU] = useState('');
  const [filterBU, setFilterBU] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to get Business Unit Code for a measure (through KPI -> Objective)
  const getMeasureBUCode = (measure) => {
    const kpi = kpis.find(k => k.Code === measure.KPI_Code);
    if (!kpi) return null;
    const objective = objectives.find(o => o.Code === kpi.Objective_Code);
    return objective?.Business_Unit_Code || null;
  };

  // Get filtered measures
  const filteredMeasures = useMemo(() => {
    let result = measures || [];

    if (filterBU) {
      // Filter by specific BU
      result = result.filter(m => getMeasureBUCode(m) === filterBU);
    } else if (filterLevel) {
      // Filter by level (all BUs in that level)
      const levelBUs = businessUnits.filter(bu => bu.Level === filterLevel).map(bu => bu.Code);
      result = result.filter(m => levelBUs.includes(getMeasureBUCode(m)));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(m =>
        m.Name?.toLowerCase().includes(term) ||
        m.KPI_Code?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [measures, kpis, objectives, businessUnits, filterLevel, filterBU, searchTerm]);

  // Get KPIs that don't have measures yet (for creating new measures)
  const availableKPIs = useMemo(() => {
    const measureKPICodes = (measures || []).map(m => m.KPI_Code);
    return kpis.filter(k => !measureKPICodes.includes(k.Code));
  }, [kpis, measures]);

  const handleCreateMeasure = (kpiCode) => {
    setSelectedKPI(kpiCode);
    setInternalView('builder');
  };

  const handleEditMeasure = (measure) => {
    setSelectedMeasure(measure);
    setInternalView('builder');
  };

  const handleBackToList = () => {
    setInternalView(null); // Reset to prop-based view
    setSelectedMeasure(null);
    setSelectedKPI(null);
  };

  return (
    <div className="measure-tab">
      {/* Header */}
      <div className="measure-header">
        <div className="measure-header-left">
          {activeView === 'builder' && (
            <button className="btn btn-ghost btn-sm" onClick={handleBackToList}>
              ← Back to Measures
            </button>
          )}
          <h2>
            {activeView === 'list' && 'Measures'}
            {activeView === 'global-values' && 'Global Values'}
            {activeView === 'builder' && (selectedMeasure ? 'Edit Measure' : 'Create Measure')}
            {activeView === 'data-entry' && 'Data Entry'}
          </h2>
        </div>
        <div className="measure-header-actions">
          {/* Actions moved to navbar */}
        </div>
      </div>

      {/* Description */}
      {activeView === 'list' && (
        <p className="section-description">
          Create and manage parametric calculations for KPI achievement. Define formulas using data points,
          global values, and other measures to automatically calculate KPI actual values.
        </p>
      )}
      {activeView === 'global-values' && (
        <p className="section-description">
          Define global values that can be used across all measures (e.g., Total Employees, OPEX, CAPEX).
        </p>
      )}
      {activeView === 'data-entry' && (
        <p className="section-description">
          Enter monthly values for measure parameters. All 12 months are displayed below.
        </p>
      )}

      {/* Main Content */}
      <div className="measure-content">
        {activeView === 'list' && (
          <MeasureListView
            measures={filteredMeasures}
            kpis={kpis}
            objectives={objectives}
            businessUnits={businessUnits}
            availableKPIs={availableKPIs}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            filterL2BU={filterL2BU}
            setFilterL2BU={setFilterL2BU}
            filterBU={filterBU}
            setFilterBU={setFilterBU}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onCreateMeasure={handleCreateMeasure}
            onEditMeasure={handleEditMeasure}
            onDeleteMeasure={deleteMeasure}
          />
        )}

        {activeView === 'global-values' && (
          <GlobalValuesView
            globalValues={globalValues || []}
            onAdd={addGlobalValue}
            onUpdate={updateGlobalValue}
            onDelete={deleteGlobalValue}
            onBack={handleBackToList}
          />
        )}

        {activeView === 'builder' && (
          <FormulaBuilderView
            measure={selectedMeasure}
            kpiCode={selectedKPI}
            kpis={kpis}
            globalValues={globalValues || []}
            measures={measures || []}
            onSave={(measureData) => {
              if (selectedMeasure) {
                updateMeasure(selectedMeasure.Code, measureData);
              } else {
                addMeasure(measureData);
              }
              handleBackToList();
            }}
            onCancel={handleBackToList}
          />
        )}

        {activeView === 'data-entry' && (
          <DataEntryView
            measures={measures || []}
            globalValues={globalValues || []}
            kpis={kpis}
            objectives={objectives}
            businessUnits={businessUnits}
            parameterValues={parameterValues || {}}
            calculatedValues={calculatedValues || {}}
            achievements={achievements || {}}
            settings={settings}
            setParameterValue={setParameterValue}
            updateCalculatedValues={updateCalculatedValues}
            updateAchievements={updateAchievements}
            updateMeasure={updateMeasure}
            updateKPI={updateKPI}
            updateGlobalValue={updateGlobalValue}
            onBack={handleBackToList}
          />
        )}

      </div>
    </div>
  );
}

// ============================================
// MEASURE LIST VIEW
// ============================================
function MeasureListView({
  measures,
  kpis,
  objectives,
  businessUnits,
  availableKPIs,
  filterLevel,
  setFilterLevel,
  filterL2BU,
  setFilterL2BU,
  filterBU,
  setFilterBU,
  searchTerm,
  setSearchTerm,
  onCreateMeasure,
  onEditMeasure,
  onDeleteMeasure
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalLevel, setModalLevel] = useState('');
  const [modalL2BU, setModalL2BU] = useState('');
  const [modalBU, setModalBU] = useState('');

  // Get BUs by level
  const l1BusinessUnits = businessUnits.filter(bu => bu.Level === 'L1' && bu.Status === 'Active');
  const l2BusinessUnits = businessUnits.filter(bu => bu.Level === 'L2' && bu.Status === 'Active');
  const l3BusinessUnits = businessUnits.filter(bu => bu.Level === 'L3' && bu.Status === 'Active');

  // Get L3 BUs filtered by selected L2 parent (for main page filter)
  const mainFilteredL3BUs = filterL2BU
    ? l3BusinessUnits.filter(bu => bu.Parent_Code === filterL2BU)
    : l3BusinessUnits;

  // Get L3 BUs filtered by selected L2 parent (for modal)
  const modalFilteredL3BUs = modalL2BU
    ? l3BusinessUnits.filter(bu => bu.Parent_Code === modalL2BU)
    : l3BusinessUnits;

  // Get filtered KPIs based on selection (filter through objectives)
  const modalFilteredKPIs = useMemo(() => {
    let filtered = availableKPIs;

    if (modalBU) {
      // Filter by specific BU - get objectives for this BU, then filter KPIs
      const buObjectives = objectives.filter(obj => obj.Business_Unit_Code === modalBU).map(obj => obj.Code);
      filtered = filtered.filter(kpi => buObjectives.includes(kpi.Objective_Code));
    } else if (modalLevel === 'L3' && modalL2BU) {
      // For L3 with L2 parent selected, filter by L3 BUs under that parent
      const l3BUsUnderParent = l3BusinessUnits.filter(bu => bu.Parent_Code === modalL2BU).map(bu => bu.Code);
      const l3Objectives = objectives.filter(obj => l3BUsUnderParent.includes(obj.Business_Unit_Code)).map(obj => obj.Code);
      filtered = filtered.filter(kpi => l3Objectives.includes(kpi.Objective_Code));
    } else if (modalLevel) {
      // Filter by all objectives in the selected level
      const levelObjectives = objectives.filter(obj => obj.Level === modalLevel).map(obj => obj.Code);
      filtered = filtered.filter(kpi => levelObjectives.includes(kpi.Objective_Code));
    }

    return filtered;
  }, [availableKPIs, objectives, modalLevel, modalL2BU, modalBU, l3BusinessUnits]);

  // Reset modal state when closing
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalLevel('');
    setModalL2BU('');
    setModalBU('');
  };

  return (
    <div className="measure-list-view">
      {/* Filters */}
      <div className="measure-filters">
        <div className="filter-group">
          <label>Level:</label>
          <select
            value={filterLevel}
            onChange={(e) => {
              setFilterLevel(e.target.value);
              setFilterL2BU('');
              setFilterBU('');
            }}
          >
            <option value="">All Levels</option>
            <option value="L1">L1</option>
            <option value="L2">L2</option>
            <option value="L3">L3</option>
          </select>
        </div>

        {filterLevel === 'L1' && (
          <div className="filter-group">
            <label>Business Unit:</label>
            <select value={filterBU} onChange={(e) => setFilterBU(e.target.value)}>
              <option value="">All L1 Units</option>
              {l1BusinessUnits.map(bu => (
                <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
              ))}
            </select>
          </div>
        )}

        {filterLevel === 'L2' && (
          <div className="filter-group">
            <label>Business Unit:</label>
            <select value={filterBU} onChange={(e) => setFilterBU(e.target.value)}>
              <option value="">All L2 Units</option>
              {l2BusinessUnits.map(bu => (
                <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
              ))}
            </select>
          </div>
        )}

        {filterLevel === 'L3' && (
          <>
            <div className="filter-group">
              <label>L2 Parent:</label>
              <select
                value={filterL2BU}
                onChange={(e) => {
                  setFilterL2BU(e.target.value);
                  setFilterBU('');
                }}
              >
                <option value="">Select L2 first...</option>
                {l2BusinessUnits.map(bu => (
                  <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                ))}
              </select>
            </div>
            {filterL2BU && (
              <div className="filter-group">
                <label>L3 Business Unit:</label>
                <select value={filterBU} onChange={(e) => setFilterBU(e.target.value)}>
                  <option value="">All L3 Units</option>
                  {mainFilteredL3BUs.map(bu => (
                    <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search measures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Measure
        </button>
      </div>

      {/* Measures Grid */}
      {measures.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No Measures Yet</h3>
          <p>Create your first measure to start calculating KPI achievements automatically.</p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Your First Measure
          </button>
        </div>
      ) : (
        <div className="measures-grid">
          {measures.map(measure => {
            const kpi = kpis.find(k => k.Code === measure.KPI_Code);
            const objective = kpi ? objectives.find(o => o.Code === kpi.Objective_Code) : null;
            const bu = objective ? businessUnits.find(b => b.Code === objective.Business_Unit_Code) : null;

            return (
              <div key={measure.Code} className="measure-card">
                <div className="measure-card-header">
                  <span className="measure-code">{measure.Code}</span>
                  {kpi && (
                    <span className="measure-kpi-badge">{kpi.Name}</span>
                  )}
                </div>
                <h4 className="measure-name">{measure.Name}</h4>
                {bu && (
                  <div className="measure-bu">{bu.Level} - {bu.Name}</div>
                )}
                <div className="measure-formula-preview">
                  <code>{measure.Formula_Text || 'No formula defined'}</code>
                </div>
                <div className="measure-result">
                  <span className="result-label">Last Calculated:</span>
                  <span className="result-value">
                    {measure.Last_Value != null ? measure.Last_Value : '—'}
                  </span>
                </div>
                <div className="measure-card-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onEditMeasure(measure)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onDeleteMeasure(measure.Code)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Measure Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select KPI for New Measure</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              {/* Level and BU Filters */}
              <div className="modal-filters">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Level:</label>
                    <select
                      value={modalLevel}
                      onChange={(e) => {
                        setModalLevel(e.target.value);
                        setModalL2BU('');
                        setModalBU('');
                      }}
                    >
                      <option value="">All Levels</option>
                      <option value="L1">L1</option>
                      <option value="L2">L2</option>
                      <option value="L3">L3</option>
                    </select>
                  </div>

                  {modalLevel === 'L1' && (
                    <div className="filter-group">
                      <label>Business Unit:</label>
                      <select value={modalBU} onChange={(e) => setModalBU(e.target.value)}>
                        <option value="">All L1 Units</option>
                        {l1BusinessUnits.map(bu => (
                          <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalLevel === 'L2' && (
                    <div className="filter-group">
                      <label>Business Unit:</label>
                      <select value={modalBU} onChange={(e) => setModalBU(e.target.value)}>
                        <option value="">All L2 Units</option>
                        {l2BusinessUnits.map(bu => (
                          <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalLevel === 'L3' && (
                    <>
                      <div className="filter-group">
                        <label>L2 Parent:</label>
                        <select
                          value={modalL2BU}
                          onChange={(e) => {
                            setModalL2BU(e.target.value);
                            setModalBU('');
                          }}
                        >
                          <option value="">Select L2 first...</option>
                          {l2BusinessUnits.map(bu => (
                            <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                          ))}
                        </select>
                      </div>
                      {modalL2BU && (
                        <div className="filter-group">
                          <label>L3 Business Unit:</label>
                          <select value={modalBU} onChange={(e) => setModalBU(e.target.value)}>
                            <option value="">All L3 Units</option>
                            {modalFilteredL3BUs.map(bu => (
                              <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* KPI List */}
              {availableKPIs.length === 0 ? (
                <p className="text-muted">All KPIs already have measures defined.</p>
              ) : modalFilteredKPIs.length === 0 ? (
                <p className="text-muted">No KPIs available for the selected filters.</p>
              ) : (
                <div className="kpi-select-list">
                  {modalFilteredKPIs.map(kpi => {
                    const objective = objectives.find(o => o.Code === kpi.Objective_Code);
                    const bu = objective ? businessUnits.find(b => b.Code === objective.Business_Unit_Code) : null;
                    return (
                      <div
                        key={kpi.Code}
                        className="kpi-select-item"
                        onClick={() => {
                          handleCloseModal();
                          onCreateMeasure(kpi.Code);
                        }}
                      >
                        <div className="kpi-select-name">{kpi.Name}</div>
                        <div className="kpi-select-meta">
                          <span className="kpi-code">{kpi.Code}</span>
                          {bu && <span className="kpi-bu">{bu.Level} - {bu.Name}</span>}
                        </div>
                        {kpi.Data_Points && (
                          <div className="kpi-data-points">
                            Data Points: {kpi.Data_Points}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// GLOBAL VALUES VIEW
// ============================================
function GlobalValuesView({ globalValues, onAdd, onUpdate, onDelete, onBack }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingValue, setEditingValue] = useState(null);
  const [newValue, setNewValue] = useState({
    Name: '',
    Name_AR: '',
    Type: 'number',
    Description: ''
  });

  const currentYear = new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleAdd = () => {
    if (!newValue.Name.trim()) return;
    onAdd(newValue);
    setNewValue({ Name: '', Name_AR: '', Type: 'number', Description: '' });
    setShowAddForm(false);
  };

  return (
    <div className="global-values-view">
      <div className="global-values-header">
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          + Add Global Value
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="global-value-form">
          <h4>Add New Global Value</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Name (English) *</label>
              <input
                type="text"
                value={newValue.Name}
                onChange={(e) => setNewValue({ ...newValue, Name: e.target.value })}
                placeholder="e.g., Total Employees"
              />
            </div>
            <div className="form-group">
              <label>Name (Arabic)</label>
              <input
                type="text"
                value={newValue.Name_AR}
                onChange={(e) => setNewValue({ ...newValue, Name_AR: e.target.value })}
                placeholder="الاسم بالعربية"
                dir="rtl"
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={newValue.Type}
                onChange={(e) => setNewValue({ ...newValue, Type: e.target.value })}
              >
                <option value="number">Number</option>
                <option value="percentage">Percentage</option>
                <option value="currency">Currency</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                value={newValue.Description}
                onChange={(e) => setNewValue({ ...newValue, Description: e.target.value })}
                placeholder="What does this value represent?"
                rows={2}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleAdd}>Add</button>
            <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Global Values List */}
      {globalValues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌐</div>
          <h3>No Global Values Defined</h3>
          <p>Add global values like Total Employees, OPEX, or CAPEX that can be used in measure formulas.</p>
        </div>
      ) : (
        <div className="global-values-list">
          {globalValues.map(gv => (
            <div key={gv.Code} className="global-value-card">
              <div className="gv-header">
                <div className="gv-info">
                  <span className="gv-code">{gv.Code}</span>
                  <span className={`gv-type-badge ${gv.Type}`}>{gv.Type}</span>
                </div>
                <div className="gv-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setEditingValue(editingValue === gv.Code ? null : gv.Code)}
                  >
                    {editingValue === gv.Code ? 'Close' : 'Edit Monthly Data'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onDelete(gv.Code)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <h4 className="gv-name">{gv.Name}</h4>
              {gv.Name_AR && <div className="gv-name-ar">{gv.Name_AR}</div>}
              {gv.Description && <p className="gv-description">{gv.Description}</p>}

              {/* Monthly Data Editor */}
              {editingValue === gv.Code && (
                <div className="gv-monthly-data">
                  <h5>Monthly Values ({currentYear})</h5>
                  <div className="monthly-grid">
                    {months.map((month, idx) => {
                      const monthKey = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
                      const monthlyValues = gv.Monthly_Values || {};
                      return (
                        <div key={month} className="month-input">
                          <label>{month}</label>
                          <input
                            type="number"
                            value={monthlyValues[monthKey] || ''}
                            onChange={(e) => {
                              const newMonthlyValues = {
                                ...monthlyValues,
                                [monthKey]: e.target.value ? parseFloat(e.target.value) : null
                              };
                              onUpdate(gv.Code, { Monthly_Values: newMonthlyValues });
                            }}
                            placeholder="—"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// FORMULA BUILDER VIEW
// ============================================
function FormulaBuilderView({ measure, kpiCode, kpis, globalValues, measures, onSave, onCancel }) {
  const kpi = kpis.find(k => k.Code === (measure?.KPI_Code || kpiCode));

  // Parse data points from KPI
  const dataPoints = useMemo(() => {
    if (!kpi?.Data_Points) return [];
    return kpi.Data_Points.split(',').map(dp => dp.trim()).filter(Boolean);
  }, [kpi]);

  const [measureName, setMeasureName] = useState(measure?.Name || `${kpi?.Name || 'KPI'} Calculation`);
  const [formulaElements, setFormulaElements] = useState(measure?.Formula_Elements || []);
  const [isDragOver, setIsDragOver] = useState(false);
  const [testValues, setTestValues] = useState({});
  const [calculatedResult, setCalculatedResult] = useState(null);
  const [calcError, setCalcError] = useState(null);
  const [editingStaticIdx, setEditingStaticIdx] = useState(null);

  // Search states for dropdowns
  const [globalValueSearch, setGlobalValueSearch] = useState('');
  const [measureSearch, setMeasureSearch] = useState('');

  // Filtered lists based on search
  const filteredGlobalValues = useMemo(() => {
    if (!globalValueSearch.trim()) return globalValues;
    const search = globalValueSearch.toLowerCase();
    return globalValues.filter(gv =>
      gv.Name?.toLowerCase().includes(search) ||
      gv.Code?.toLowerCase().includes(search)
    );
  }, [globalValues, globalValueSearch]);

  const filteredMeasures = useMemo(() => {
    const otherMeasures = measures.filter(m => m.Code !== measure?.Code);
    // Only show results when search has input
    if (!measureSearch.trim()) return [];
    const search = measureSearch.toLowerCase();
    return otherMeasures.filter(m =>
      m.Name?.toLowerCase().includes(search) ||
      m.Code?.toLowerCase().includes(search)
    );
  }, [measures, measure?.Code, measureSearch]);

  // Generate unique ID for formula elements
  const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle drag start from palette
  const handleDragStart = (e, type, value, display) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, value, display }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drag over canvas
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle drop on canvas
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const newElement = {
        id: generateId(),
        type: data.type,
        value: data.value,
        display: data.display || data.value
      };

      // If it's a static value, prompt for the actual number
      if (data.type === 'static') {
        newElement.display = '0';
        newElement.value = 0;
      }

      setFormulaElements(prev => [...prev, newElement]);
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Add operator to formula
  const addOperator = (operator, display) => {
    // Special case: × 100 should add two elements (multiply operator + 100 value)
    if (operator === '* 100') {
      const multiplyElement = {
        id: generateId(),
        type: 'operator',
        value: '*',
        display: '×'
      };
      const hundredElement = {
        id: generateId(),
        type: 'static',
        value: 100,
        display: '100'
      };
      setFormulaElements(prev => [...prev, multiplyElement, hundredElement]);
      return;
    }

    const newElement = {
      id: generateId(),
      type: 'operator',
      value: operator,
      display: display || operator
    };
    setFormulaElements(prev => [...prev, newElement]);
  };

  // Remove element from formula
  const removeElement = (idx) => {
    setFormulaElements(prev => prev.filter((_, i) => i !== idx));
  };

  // Update static value
  const updateStaticValue = (idx, value) => {
    setFormulaElements(prev => prev.map((el, i) => {
      if (i === idx && el.type === 'static') {
        return { ...el, value: parseFloat(value) || 0, display: value };
      }
      return el;
    }));
  };

  // Clear formula
  const clearFormula = () => {
    setFormulaElements([]);
    setCalculatedResult(null);
    setCalcError(null);
  };

  // Generate formula text for display and evaluation
  const formulaText = useMemo(() => {
    return formulaElements.map(el => {
      if (el.type === 'operator') {
        // Convert display operators to JS operators for evaluation
        const opMap = { '×': '*', '÷': '/', '−': '-' };
        return opMap[el.display] || el.display;
      }
      return el.display;
    }).join(' ');
  }, [formulaElements]);

  // Calculate result based on test values
  const calculateResult = () => {
    try {
      setCalcError(null);

      // Build evaluatable expression as array of tokens
      const tokens = formulaElements.map(el => {
        if (el.type === 'data-point') {
          const val = testValues[el.value];
          if (val === undefined || val === '') {
            throw new Error(`Missing value for: ${el.value}`);
          }
          return parseFloat(val);
        }
        if (el.type === 'static') {
          return parseFloat(el.value);
        }
        if (el.type === 'operator') {
          const opMap = { '×': '*', '÷': '/', '−': '-' };
          return opMap[el.display] || el.display;
        }
        if (el.type === 'global-value') {
          // For now, use test value or 0
          return parseFloat(testValues[el.value]) || 0;
        }
        return parseFloat(el.value) || el.value;
      });

      // Evaluate using safe evaluator
      const result = safeEvaluate(tokens);

      if (result === null || isNaN(result) || !isFinite(result)) {
        throw new Error('Invalid calculation result');
      }

      setCalculatedResult(result);
    } catch (err) {
      setCalcError(err.message);
      setCalculatedResult(null);
    }
  };

  // Get global value name by code
  const getGlobalValueName = (code) => {
    const gv = globalValues.find(g => g.Code === code);
    return gv?.Name || code;
  };

  // Get measure name by code
  const getMeasureName = (code) => {
    const m = measures.find(m => m.Code === code);
    return m?.Name || code;
  };

  return (
    <div className="formula-builder-view">
      <div className="builder-header">
        <div className="builder-kpi-info">
          <span className="label">Building measure for:</span>
          <span className="kpi-name">{kpi?.Name || 'Unknown KPI'}</span>
          <span className="kpi-code">({kpi?.Code})</span>
        </div>
        <div className="form-group inline">
          <label>Measure Name:</label>
          <input
            type="text"
            value={measureName}
            onChange={(e) => setMeasureName(e.target.value)}
            placeholder="Enter measure name..."
          />
        </div>
      </div>

      <div className="builder-layout">
        {/* Left Panel - Parameter Palette */}
        <div className="builder-palette">
          <h4>Parameters</h4>

          {/* KPI Data Points */}
          <div className="palette-section">
            <h5>KPI Data Points</h5>
            {dataPoints.length > 0 ? (
              <div className="palette-items">
                {dataPoints.map((dp, idx) => (
                  <div
                    key={idx}
                    className="palette-item data-point"
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'data-point', dp, dp)}
                  >
                    {dp}
                  </div>
                ))}
              </div>
            ) : (
              <p className="palette-empty">No data points defined in KPI</p>
            )}
          </div>

          {/* Global Values */}
          <div className="palette-section">
            <h5>Global Values</h5>
            {globalValues.length > 0 ? (
              <>
                <input
                  type="text"
                  className="palette-search"
                  placeholder="Search global values..."
                  value={globalValueSearch}
                  onChange={(e) => setGlobalValueSearch(e.target.value)}
                />
                <div className="palette-items palette-items-scrollable">
                  {filteredGlobalValues.length > 0 ? (
                    filteredGlobalValues.map(gv => (
                      <div
                        key={gv.Code}
                        className="palette-item global-value"
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'global-value', gv.Code, gv.Name)}
                      >
                        {gv.Name}
                      </div>
                    ))
                  ) : (
                    <p className="palette-empty">No matches found</p>
                  )}
                </div>
              </>
            ) : (
              <p className="palette-empty">No global values defined</p>
            )}
          </div>

          {/* Other Measures */}
          <div className="palette-section">
            <h5>Other Measures</h5>
            {measures.filter(m => m.Code !== measure?.Code).length > 0 ? (
              <>
                <input
                  type="text"
                  className="palette-search"
                  placeholder="Search measures..."
                  value={measureSearch}
                  onChange={(e) => setMeasureSearch(e.target.value)}
                />
                <div className="palette-items palette-items-scrollable">
                  {filteredMeasures.length > 0 ? (
                    filteredMeasures.map(m => (
                      <div
                        key={m.Code}
                        className="palette-item measure-ref"
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'measure', m.Code, m.Name)}
                      >
                        {m.Name}
                      </div>
                    ))
                  ) : (
                    <p className="palette-empty">
                      {measureSearch.trim() ? 'No matches found' : 'Type to search measures...'}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="palette-empty">No other measures available</p>
            )}
          </div>

          {/* Static Value */}
          <div className="palette-section">
            <h5>Static Value</h5>
            <div className="palette-items">
              <div
                className="palette-item static-value"
                draggable
                onDragStart={(e) => handleDragStart(e, 'static', '0', '0')}
              >
                Add Number
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Formula Canvas */}
        <div className="builder-canvas">
          <div className="canvas-header">
            <h4>Formula</h4>
            {formulaElements.length > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={clearFormula}>
                Clear All
              </button>
            )}
          </div>
          <div
            className={`formula-canvas-area ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {formulaElements.length === 0 ? (
              <div className="canvas-placeholder">
                Drag parameters here to build your formula
              </div>
            ) : (
              <div className="formula-elements">
                {formulaElements.map((el, idx) => (
                  <div key={el.id || idx} className={`formula-element ${el.type}`}>
                    {el.type === 'static' && editingStaticIdx === idx ? (
                      <input
                        type="number"
                        className="static-input"
                        value={el.display}
                        onChange={(e) => updateStaticValue(idx, e.target.value)}
                        onBlur={() => setEditingStaticIdx(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingStaticIdx(null)}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="element-display"
                        onClick={() => el.type === 'static' && setEditingStaticIdx(idx)}
                        title={el.type === 'static' ? 'Click to edit' : ''}
                      >
                        {el.display}
                      </span>
                    )}
                    <button
                      className="element-remove"
                      onClick={() => removeElement(idx)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operators Toolbar */}
          <div className="operators-toolbar">
            <h5>Operators</h5>
            <div className="operator-groups">
              <div className="operator-group">
                <span className="group-label">Arithmetic</span>
                <button className="operator-btn" onClick={() => addOperator('+', '+')}>+</button>
                <button className="operator-btn" onClick={() => addOperator('-', '−')}>−</button>
                <button className="operator-btn" onClick={() => addOperator('*', '×')}>×</button>
                <button className="operator-btn" onClick={() => addOperator('/', '÷')}>÷</button>
              </div>
              <div className="operator-group">
                <span className="group-label">Functions</span>
                <button className="operator-btn fn" onClick={() => addOperator('SUM(', 'SUM(')}>SUM</button>
                <button className="operator-btn fn" onClick={() => addOperator('AVG(', 'AVG(')}>AVG</button>
                <button className="operator-btn fn" onClick={() => addOperator('MIN(', 'MIN(')}>MIN</button>
                <button className="operator-btn fn" onClick={() => addOperator('MAX(', 'MAX(')}>MAX</button>
                <button className="operator-btn fn" onClick={() => addOperator('ABS(', 'ABS(')}>ABS</button>
              </div>
              <div className="operator-group">
                <span className="group-label">Comparison</span>
                <button className="operator-btn" onClick={() => addOperator('>', '>')}>&gt;</button>
                <button className="operator-btn" onClick={() => addOperator('<', '<')}>&lt;</button>
                <button className="operator-btn" onClick={() => addOperator('==', '=')}>=</button>
                <button className="operator-btn" onClick={() => addOperator('>=', '≥')}>≥</button>
                <button className="operator-btn" onClick={() => addOperator('<=', '≤')}>≤</button>
              </div>
              <div className="operator-group">
                <span className="group-label">Conditional</span>
                <button className="operator-btn fn" onClick={() => addOperator('IF(', 'IF(')}>IF</button>
                <button className="operator-btn fn" onClick={() => addOperator(',', ',')}>THEN</button>
                <button className="operator-btn fn" onClick={() => addOperator(',', ',')}>ELSE</button>
              </div>
              <div className="operator-group">
                <span className="group-label">Percentage</span>
                <button className="operator-btn fn" onClick={() => addOperator('%', '%')}>%</button>
                <button className="operator-btn fn" onClick={() => addOperator('* 100', '× 100')}>× 100</button>
              </div>
              <div className="operator-group">
                <span className="group-label">Grouping</span>
                <button className="operator-btn" onClick={() => addOperator('(', '(')}>(</button>
                <button className="operator-btn" onClick={() => addOperator(')', ')')}>)</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="builder-preview">
          <h4>Preview</h4>
          <div className="preview-section">
            <h5>Formula Text</h5>
            <code className="formula-text">
              {formulaElements.length > 0
                ? formulaText
                : 'No formula defined yet'
              }
            </code>
          </div>
          <div className="preview-section">
            <h5>Test Calculation</h5>
            <div className="test-inputs">
              {/* Only show data points that are used in the formula */}
              {dataPoints.filter(dp =>
                formulaElements.some(el => el.type === 'data-point' && el.value === dp)
              ).map((dp, idx) => (
                <div key={idx} className="test-input">
                  <label>{dp}:</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={testValues[dp] || ''}
                    onChange={(e) => setTestValues(prev => ({ ...prev, [dp]: e.target.value }))}
                  />
                </div>
              ))}
              {/* Only show global values that are used in the formula */}
              {globalValues.filter(gv =>
                formulaElements.some(el => el.type === 'global-value' && el.value === gv.Code)
              ).map(gv => (
                <div key={gv.Code} className="test-input">
                  <label>{gv.Name} <span className="global-tag">(Global)</span>:</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={testValues[gv.Code] || ''}
                    onChange={(e) => setTestValues(prev => ({ ...prev, [gv.Code]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-sm btn-secondary"
              onClick={calculateResult}
              disabled={formulaElements.length === 0}
              style={{ marginBottom: '12px', width: '100%' }}
            >
              Calculate
            </button>
            <div className={`test-result ${calcError ? 'error' : ''}`}>
              <span className="result-label">{calcError ? 'Error:' : 'Result:'}</span>
              <span className="result-value">
                {calcError ? calcError : (calculatedResult !== null ? calculatedResult.toFixed(2) : '—')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="builder-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={() => onSave({
            Name: measureName,
            KPI_Code: kpi?.Code,
            Formula_Elements: formulaElements,
            Formula_Text: formulaText
          })}
          disabled={!measureName.trim() || formulaElements.length === 0}
        >
          Save Measure
        </button>
      </div>
    </div>
  );
}

// ============================================
// DATA ENTRY VIEW - All Months in One View
// ============================================
function DataEntryView({
  measures,
  globalValues,
  kpis,
  objectives,
  businessUnits,
  parameterValues,
  calculatedValues,    // Now from context (persisted)
  achievements,        // Now from context (persisted)
  settings,
  setParameterValue,
  updateCalculatedValues,
  updateAchievements,
  updateMeasure,
  updateKPI,
  updateGlobalValue,
  onBack
}) {
  // KPI Edit Modal state
  const [editingKPICode, setEditingKPICode] = useState(null);
  const editingKPI = editingKPICode ? kpis.find(k => k.Code === editingKPICode) : null;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const approvalStatuses = ['Recommended', 'Under Discussion', 'Locked'];
  const indicatorTypes = ['Lagging', 'Leading'];
  const polarityOptions = ['Positive', 'Negative'];
  const impactTypes = ['Direct', 'Indirect'];
  // Get achievement color class
  const getAchievementClass = (achievement) => {
    if (achievement === null || achievement === undefined) return '';
    const thresholdExcellent = settings?.thresholdExcellent ?? 100;
    const thresholdGood = settings?.thresholdGood ?? 80;
    const thresholdWarning = settings?.thresholdWarning ?? 60;
    if (achievement >= thresholdExcellent) return 'achievement-excellent';
    if (achievement >= thresholdGood) return 'achievement-good';
    if (achievement >= thresholdWarning) return 'achievement-warning';
    return 'achievement-poor';
  };

  // Get achievement inline style with custom colors
  const getAchievementStyle = (achievement) => {
    if (achievement === null || achievement === undefined) return {};
    const thresholdExcellent = settings?.thresholdExcellent ?? 100;
    const thresholdGood = settings?.thresholdGood ?? 80;
    const thresholdWarning = settings?.thresholdWarning ?? 60;

    let bgColor;
    if (achievement >= thresholdExcellent) {
      bgColor = settings?.colorExcellent || '#28a745';
    } else if (achievement >= thresholdGood) {
      bgColor = settings?.colorGood || '#ffc107';
    } else if (achievement >= thresholdWarning) {
      bgColor = settings?.colorWarning || '#fd7e14';
    } else {
      bgColor = settings?.colorPoor || '#dc3545';
    }

    // Calculate contrast color for text
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const textColor = luminance > 0.5 ? '#000000' : '#ffffff';

    return { backgroundColor: bgColor, color: textColor };
  };
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedL2BU, setSelectedL2BU] = useState('');
  const [selectedBU, setSelectedBU] = useState('');

  // Get BUs by level
  const l1BusinessUnits = (businessUnits || []).filter(bu => bu.Level === 'L1' && bu.Status === 'Active');
  const l2BusinessUnits = (businessUnits || []).filter(bu => bu.Level === 'L2' && bu.Status === 'Active');
  const l3BusinessUnits = (businessUnits || []).filter(bu => bu.Level === 'L3' && bu.Status === 'Active');

  // Get L3 BUs filtered by selected L2 parent
  const filteredL3BUs = selectedL2BU
    ? l3BusinessUnits.filter(bu => bu.Parent_Code === selectedL2BU)
    : l3BusinessUnits;

  // Helper to get Business Unit Code for a measure (through KPI -> Objective)
  const getMeasureBUCode = (measure) => {
    const kpi = kpis.find(k => k.Code === measure.KPI_Code);
    if (!kpi) return null;
    const objective = objectives.find(o => o.Code === kpi.Objective_Code);
    return objective?.Business_Unit_Code || null;
  };

  // Filter measures by level and BU
  const filteredMeasures = useMemo(() => {
    let result = measures;

    if (selectedBU) {
      // Filter by specific BU
      result = result.filter(measure => getMeasureBUCode(measure) === selectedBU);
    } else if (selectedLevel) {
      // Filter by level
      const levelBUs = (businessUnits || []).filter(bu => bu.Level === selectedLevel).map(bu => bu.Code);
      result = result.filter(measure => levelBUs.includes(getMeasureBUCode(measure)));
    }

    return result;
  }, [measures, kpis, objectives, businessUnits, selectedLevel, selectedBU]);

  const months = [
    { short: 'Jan', full: 'January', idx: 0 },
    { short: 'Feb', full: 'February', idx: 1 },
    { short: 'Mar', full: 'March', idx: 2 },
    { short: 'Apr', full: 'April', idx: 3 },
    { short: 'May', full: 'May', idx: 4 },
    { short: 'Jun', full: 'June', idx: 5 },
    { short: 'Jul', full: 'July', idx: 6 },
    { short: 'Aug', full: 'August', idx: 7 },
    { short: 'Sep', full: 'September', idx: 8 },
    { short: 'Oct', full: 'October', idx: 9 },
    { short: 'Nov', full: 'November', idx: 10 },
    { short: 'Dec', full: 'December', idx: 11 }
  ];

  // Get month key for a specific month index
  const getMonthKey = (monthIdx) => `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`;

  // Get parameter value from context for a specific month
  const getParamValue = (measureCode, paramName, monthIdx) => {
    const monthKey = getMonthKey(monthIdx);
    const measureParams = parameterValues[measureCode] || {};
    const paramMonthly = measureParams[paramName] || {};
    return paramMonthly[monthKey] ?? '';
  };

  // Handle parameter value change for a specific month
  const handleValueChange = (measureCode, paramName, monthIdx, value) => {
    const monthKey = getMonthKey(monthIdx);
    setParameterValue(measureCode, paramName, monthKey, value !== '' ? parseFloat(value) : null);
  };

  // Check if all required values are empty for a month
  const isMonthEmpty = (measure, kpi, monthIdx) => {
    const monthKey = getMonthKey(monthIdx);
    const formulaElements = measure?.Formula_Elements || [];

    // Get data points used in formula
    const formulaDataPoints = formulaElements
      .filter(el => el.type === 'data-point')
      .map(el => el.value);

    // Get global values used in formula
    const formulaGlobalValues = formulaElements
      .filter(el => el.type === 'global-value')
      .map(el => el.value);

    // Get measure references used in formula
    const formulaMeasureRefs = formulaElements
      .filter(el => el.type === 'measure')
      .map(el => el.value);

    // If no data sources in formula, it's empty
    if (formulaDataPoints.length === 0 && formulaGlobalValues.length === 0 && formulaMeasureRefs.length === 0) {
      return true;
    }

    // Check if all data points are empty
    const dataPointsEmpty = formulaDataPoints.every(dp => {
      const val = getParamValue(measure.Code, dp, monthIdx);
      return val === '' || val === undefined || val === null;
    });

    // Check if all global values are empty
    const globalValuesEmpty = formulaGlobalValues.every(gvCode => {
      const gv = globalValues.find(g => g.Code === gvCode);
      const val = gv?.Monthly_Values?.[monthKey];
      return val === undefined || val === null;
    });

    // Check if all measure references are empty
    const measureRefsEmpty = formulaMeasureRefs.every(mCode => {
      const val = calculatedValues?.[mCode]?.[monthKey]?.value;
      return val === undefined || val === null;
    });

    // Month is empty only if ALL sources are empty
    return dataPointsEmpty && globalValuesEmpty && measureRefsEmpty;
  };

  // Calculate measure result for a specific month
  const calculateMeasureResultForMonth = (measure, kpi, monthIdx) => {
    if (!measure?.Formula_Elements?.length) {
      return { value: null, error: 'No formula defined' };
    }

    // If all fields are empty, don't show error (month hasn't arrived yet)
    if (isMonthEmpty(measure, kpi, monthIdx)) {
      return { value: null, error: null }; // Silent - no error
    }

    const monthKey = getMonthKey(monthIdx);

    try {
      const missingParams = [];
      const expression = measure.Formula_Elements.map(el => {
        if (el.type === 'data-point') {
          const val = getParamValue(measure.Code, el.value, monthIdx);
          if (val === '' || val === undefined || val === null) {
            missingParams.push(el.value);
            return null;
          }
          return parseFloat(val);
        }
        if (el.type === 'static') {
          const num = parseFloat(el.value);
          return isNaN(num) ? 0 : num;
        }
        if (el.type === 'operator') {
          const opMap = { '×': '*', '÷': '/', '−': '-' };
          return opMap[el.display] || el.display;
        }
        if (el.type === 'global-value') {
          const gv = globalValues.find(g => g.Code === el.value);
          const gvVal = gv?.Monthly_Values?.[monthKey];
          if (gvVal === undefined || gvVal === null) {
            missingParams.push(`Global: ${gv?.Name || el.value}`);
            return null;
          }
          return parseFloat(gvVal);
        }
        if (el.type === 'measure') {
          // Get the calculated value of another measure for this month
          const refMeasure = measures.find(m => m.Code === el.value);
          const refValue = calculatedValues?.[el.value]?.[monthKey]?.value;
          if (refValue === undefined || refValue === null) {
            missingParams.push(`Measure: ${refMeasure?.Name || el.value}`);
            return null;
          }
          return parseFloat(refValue);
        }
        const num = parseFloat(el.value);
        return isNaN(num) ? el.value : num;
      });

      if (expression.some(v => v === null)) {
        return { value: null, error: `Missing: ${missingParams.join(', ')}` };
      }

      const result = safeEvaluate(expression);

      if (result === null || isNaN(result) || !isFinite(result)) {
        return { value: null, error: 'Invalid result' };
      }
      return { value: result, error: null };
    } catch (err) {
      console.error(`[Measure ${measure.Code}] Calc error:`, err);
      return { value: null, error: err.message };
    }
  };

  // Get target for a specific month (supports monthly targets)
  const getTargetForMonth = (kpi, monthIdx) => {
    if (!kpi) return null;

    // If monthly target mode and has monthly targets
    if (kpi.Target_Mode === 'monthly' && kpi.Monthly_Targets) {
      const monthlyTarget = kpi.Monthly_Targets[monthIdx];
      if (monthlyTarget !== undefined && monthlyTarget !== null && monthlyTarget !== '') {
        return parseFloat(monthlyTarget);
      }
      // Fall back to single target if monthly is empty
    }

    // Use single target value (default behavior)
    if (kpi.Target !== undefined && kpi.Target !== null && kpi.Target !== '') {
      return parseFloat(kpi.Target);
    }

    return null;
  };

  // Get the BU achievement cap from settings
  const buAchievementCap = settings?.overachievementCap ?? 200;

  // Calculate achievement percentage
  const calculateAchievement = (actual, target, polarity) => {
    if (actual === null || target === null || target === 0) return null;

    const targetNum = parseFloat(target);
    const actualNum = parseFloat(actual);
    if (isNaN(targetNum) || targetNum === 0) return null;
    if (isNaN(actualNum)) return null;

    let achievement;
    if (polarity === 'Negative') {
      // Lower is better - if actual is 0 or very small, cap at buAchievementCap
      if (actualNum <= 0 || Math.abs(actualNum) < 0.0001) return buAchievementCap;
      achievement = (targetNum / actualNum) * 100;
    } else {
      achievement = (actualNum / targetNum) * 100;
    }

    // Handle infinity, NaN, and cap at buAchievementCap
    if (!isFinite(achievement) || isNaN(achievement)) return buAchievementCap;
    return Math.min(Math.max(achievement, 0), buAchievementCap);
  };

  // Calculate all values for all months (for filtered measures)
  const handleCalculateAll = () => {
    const newCalculated = { ...calculatedValues };
    const newAchievements = { ...achievements };

    filteredMeasures.forEach(measure => {
      const kpi = kpis.find(k => k.Code === measure.KPI_Code);
      // Initialize if doesn't exist
      if (!newCalculated[measure.Code]) {
        newCalculated[measure.Code] = {};
      }
      if (!newAchievements[measure.Code]) {
        newAchievements[measure.Code] = {};
      }

      months.forEach(month => {
        const monthKey = getMonthKey(month.idx);
        const result = calculateMeasureResultForMonth(measure, kpi, month.idx);

        // Always update the calculated value (including null for empty months)
        newCalculated[measure.Code][monthKey] = result;

        // Update achievement: set value if calculated, clear if no data
        if (result.value !== null && kpi) {
          const monthTarget = getTargetForMonth(kpi, month.idx);
          const achievement = calculateAchievement(result.value, monthTarget, kpi.Polarity);
          newAchievements[measure.Code][monthKey] = achievement;
        } else {
          // Clear achievement when there's no calculated value
          newAchievements[measure.Code][monthKey] = null;
        }
      });

      // Update measure with latest calculated value
      const latestMonth = [...months].reverse().find(m => {
        const calcResult = newCalculated[measure.Code][getMonthKey(m.idx)];
        return calcResult && calcResult.value !== null;
      });
      if (latestMonth) {
        const latestValue = newCalculated[measure.Code][getMonthKey(latestMonth.idx)].value;
        updateMeasure(measure.Code, {
          Last_Value: latestValue,
          Last_Calculated: new Date().toISOString()
        });
      }
    });

    updateCalculatedValues(newCalculated);
    updateAchievements(newAchievements);
  };

  // Calculate a single month for all filtered measures
  const handleCalculateMonth = (monthIdx) => {
    const newCalculated = { ...calculatedValues };
    const newAchievements = { ...achievements };
    const monthKey = getMonthKey(monthIdx);

    filteredMeasures.forEach(measure => {
      const kpi = kpis.find(k => k.Code === measure.KPI_Code);
      if (!newCalculated[measure.Code]) {
        newCalculated[measure.Code] = {};
      }
      if (!newAchievements[measure.Code]) {
        newAchievements[measure.Code] = {};
      }

      const result = calculateMeasureResultForMonth(measure, kpi, monthIdx);

      // Always update the calculated value
      newCalculated[measure.Code][monthKey] = result;

      // Update achievement: set value if calculated, clear if no data
      if (result.value !== null && kpi) {
        const monthTarget = getTargetForMonth(kpi, monthIdx);
        const achievement = calculateAchievement(result.value, monthTarget, kpi.Polarity);
        newAchievements[measure.Code][monthKey] = achievement;
      } else {
        // Clear achievement when there's no calculated value
        newAchievements[measure.Code][monthKey] = null;
      }
    });

    updateCalculatedValues(newCalculated);
    updateAchievements(newAchievements);
  };

  return (
    <div className="data-entry-view">
      <div className="data-entry-header">
        <div className="data-entry-header-left">
          {/* Description moved to main header */}
        </div>
        <div className="data-entry-controls">
          <div className="period-selector">
            <label>Level:</label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setSelectedL2BU('');
                setSelectedBU('');
              }}
            >
              <option value="">All Levels</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>
          </div>

          {selectedLevel === 'L1' && (
            <div className="period-selector">
              <label>Business Unit:</label>
              <select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
                <option value="">All L1 Units</option>
                {l1BusinessUnits.map(bu => (
                  <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedLevel === 'L2' && (
            <div className="period-selector">
              <label>Business Unit:</label>
              <select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
                <option value="">All L2 Units</option>
                {l2BusinessUnits.map(bu => (
                  <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedLevel === 'L3' && (
            <>
              <div className="period-selector">
                <label>L2 Parent:</label>
                <select
                  value={selectedL2BU}
                  onChange={(e) => {
                    setSelectedL2BU(e.target.value);
                    setSelectedBU('');
                  }}
                >
                  <option value="">Select L2 first...</option>
                  {l2BusinessUnits.map(bu => (
                    <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                  ))}
                </select>
              </div>
              {selectedL2BU && (
                <div className="period-selector">
                  <label>L3 Unit:</label>
                  <select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
                    <option value="">All L3 Units</option>
                    {filteredL3BUs.map(bu => (
                      <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="period-selector">
            <label>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCalculateAll}
            disabled={filteredMeasures.length === 0}
          >
            Calculate All
          </button>
        </div>
      </div>

      {filteredMeasures.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>{measures.length === 0 ? 'No Measures to Enter Data For' : 'No Measures for Selected Filters'}</h3>
          <p>{measures.length === 0 ? 'Create measures first, then come back here to enter monthly data.' : 'Try selecting different filter options.'}</p>
        </div>
      ) : (
        <div className="data-entry-list">
          {filteredMeasures.map(measure => {
            const kpi = kpis.find(k => k.Code === measure.KPI_Code);
            const dataPoints = kpi?.Data_Points?.split(',').map(dp => dp.trim()).filter(Boolean) || [];

            return (
              <div key={measure.Code} className="data-entry-card">
                <div className="data-entry-card-header">
                  <div className="data-entry-card-title">
                    <h4>{measure.Name}</h4>
                    <span
                      className="kpi-badge kpi-badge-clickable"
                      onClick={() => kpi && setEditingKPICode(kpi.Code)}
                      title="Click to edit KPI details"
                    >
                      {kpi?.Name || measure.KPI_Code}
                    </span>
                  </div>
                  {kpi && (
                    <div className="data-entry-kpi-info">
                      <span className="kpi-target">
                        {kpi.Target_Mode === 'monthly'
                          ? 'Target: Monthly (see table)'
                          : `Target: ${kpi.Target || '—'} ${kpi.Unit || ''}`
                        }
                      </span>
                      <span className={`kpi-polarity ${(kpi.Polarity || 'Positive').toLowerCase()}`}>
                        {kpi.Polarity || 'Positive'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Formula Info */}
                <div className="formula-info">
                  <span className="formula-label">Formula:</span>
                  {measure.Formula_Elements?.length > 0 ? (
                    <span className="formula-text">
                      {measure.Formula_Elements.map(el => el.display).join(' ')}
                    </span>
                  ) : (
                    <span className="formula-missing">No formula defined - please edit this measure to add a formula</span>
                  )}
                </div>

                {/* Debug: Show formula data points vs KPI data points */}
                {measure.Formula_Elements?.length > 0 && (
                  <div className="debug-info">
                    <details>
                      <summary>Debug Info</summary>
                      <div className="debug-content">
                        <p><strong>Measure Code:</strong> {measure.Code}</p>
                        <p><strong>KPI Code:</strong> {measure.KPI_Code}</p>
                        <p><strong>KPI Data Points:</strong> {dataPoints.join(', ') || 'None'}</p>
                        <p><strong>Formula expects:</strong> {
                          measure.Formula_Elements
                            .filter(el => el.type === 'data-point')
                            .map(el => el.value)
                            .join(', ') || 'None'
                        }</p>
                        <p><strong>Stored values for Jan:</strong> {
                          JSON.stringify(parameterValues[measure.Code] || {})
                        }</p>
                      </div>
                    </details>
                  </div>
                )}

                {(() => {
                  // Check what data sources the formula uses
                  const formulaDataPoints = measure.Formula_Elements?.filter(el => el.type === 'data-point') || [];
                  const formulaGlobalValues = measure.Formula_Elements?.filter(el => el.type === 'global-value') || [];
                  const formulaMeasureRefs = measure.Formula_Elements?.filter(el => el.type === 'measure') || [];
                  const hasAnySources = dataPoints.length > 0 || formulaGlobalValues.length > 0 || formulaMeasureRefs.length > 0;

                  if (!hasAnySources && !measure.Formula_Elements?.length) {
                    return <p className="text-muted">No formula defined for this measure.</p>;
                  }

                  return (
                  <>
                    <div className="data-entry-table-wrapper">
                      <table className="data-entry-table">
                        <thead>
                          <tr>
                            <th className="param-column">Parameter</th>
                            {months.map(month => (
                              <th key={month.idx} className="month-column">
                                <span>{month.short}</span>
                                <button
                                  className="month-calc-btn"
                                  onClick={() => handleCalculateMonth(month.idx)}
                                  title={`Calculate ${month.full}`}
                                >
                                  =
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Data Point Rows - only show data points used in formula */}
                          {dataPoints.filter(dp =>
                            measure.Formula_Elements?.some(el => el.type === 'data-point' && el.value === dp)
                          ).map((dp, dpIdx) => (
                            <tr key={dpIdx}>
                              <td className="param-name">{dp}</td>
                              {months.map(month => (
                                <td key={month.idx}>
                                  <input
                                    type="number"
                                    className="month-input"
                                    value={getParamValue(measure.Code, dp, month.idx)}
                                    onChange={(e) => handleValueChange(measure.Code, dp, month.idx, e.target.value)}
                                    placeholder="—"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                          {/* Referenced Measures Rows - show calculated values from other measures */}
                          {formulaMeasureRefs.map((el, mIdx) => {
                            const refMeasure = measures.find(m => m.Code === el.value);
                            if (!refMeasure) return null;
                            return (
                              <tr key={`measure-${mIdx}`} className="measure-ref-row">
                                <td className="param-name">
                                  <span className="measure-ref-label">📊 {refMeasure.Name}</span>
                                </td>
                                {months.map(month => {
                                  const monthKey = getMonthKey(month.idx);
                                  const refValue = calculatedValues?.[el.value]?.[monthKey]?.value;
                                  return (
                                    <td key={month.idx} className="measure-ref-cell">
                                      <span className="measure-ref-value">
                                        {refValue !== null && refValue !== undefined ? refValue.toFixed(2) : '—'}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          {/* Global Values Rows - editable global values used in formula */}
                          {measure.Formula_Elements?.filter(el => el.type === 'global-value').map((el, gvIdx) => {
                            const gv = globalValues.find(g => g.Code === el.value);
                            if (!gv) return null;
                            return (
                              <tr key={`gv-${gvIdx}`} className="global-value-row">
                                <td className="param-name">
                                  <span className="gv-label">{gv.Name} <span className="global-tag">(Global)</span></span>
                                </td>
                                {months.map(month => {
                                  const monthKey = getMonthKey(month.idx);
                                  const value = gv.Monthly_Values?.[monthKey];
                                  return (
                                    <td key={month.idx} className="global-value-cell">
                                      <input
                                        type="number"
                                        className="month-input gv-input"
                                        value={value ?? ''}
                                        onChange={(e) => {
                                          const newMonthlyValues = {
                                            ...(gv.Monthly_Values || {}),
                                            [monthKey]: e.target.value ? parseFloat(e.target.value) : null
                                          };
                                          updateGlobalValue(gv.Code, { Monthly_Values: newMonthlyValues });
                                        }}
                                        placeholder="—"
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          {/* Target Row */}
                          <tr className="target-row">
                            <td className="param-name"><strong>Target</strong></td>
                            {months.map(month => {
                              const target = getTargetForMonth(kpi, month.idx);
                              const isMonthly = kpi?.Target_Mode === 'monthly' && kpi?.Monthly_Targets?.[month.idx];
                              return (
                                <td
                                  key={month.idx}
                                  className={`target-cell ${isMonthly ? 'monthly-target' : ''}`}
                                >
                                  {target !== null ? target : '—'}
                                </td>
                              );
                            })}
                          </tr>
                          {/* Calculated Row */}
                          <tr className="calculated-row">
                            <td className="param-name"><strong>Actual</strong></td>
                            {months.map(month => {
                              const monthKey = getMonthKey(month.idx);
                              const calcResult = calculatedValues[measure.Code]?.[monthKey];
                              const value = calcResult?.value;
                              const error = calcResult?.error;
                              return (
                                <td
                                  key={month.idx}
                                  className={`calculated-cell ${error ? 'has-error' : ''}`}
                                  title={error || ''}
                                >
                                  {value !== null && value !== undefined
                                    ? value.toFixed(1)
                                    : error
                                      ? '⚠'
                                      : '—'
                                  }
                                </td>
                              );
                            })}
                          </tr>
                          {/* Achievement Row */}
                          <tr className="achievement-row">
                            <td className="param-name"><strong>Achievement</strong></td>
                            {months.map(month => {
                              const monthKey = getMonthKey(month.idx);
                              const achievement = achievements[measure.Code]?.[monthKey];
                              return (
                                <td
                                  key={month.idx}
                                  className="achievement-cell"
                                  style={getAchievementStyle(achievement)}
                                >
                                  {achievement !== null && achievement !== undefined
                                    ? `${achievement.toFixed(0)}%`
                                    : '—'
                                  }
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Error Messages Box */}
                    {(() => {
                      const measureCalcs = calculatedValues[measure.Code] || {};
                      const errors = Object.entries(measureCalcs)
                        .filter(([_, result]) => result?.error)
                        .map(([monthKey, result]) => {
                          const monthName = months.find(m => getMonthKey(m.idx) === monthKey)?.full || monthKey;
                          return { month: monthName, error: result.error };
                        });

                      if (errors.length === 0) return null;

                      // Group by error message
                      const errorGroups = {};
                      errors.forEach(e => {
                        if (!errorGroups[e.error]) {
                          errorGroups[e.error] = [];
                        }
                        errorGroups[e.error].push(e.month);
                      });

                      return (
                        <div className="calculation-errors">
                          <div className="error-header">
                            <span className="error-icon">⚠</span>
                            <span>Calculation Errors</span>
                          </div>
                          <div className="error-list">
                            {Object.entries(errorGroups).map(([error, monthsList], idx) => (
                              <div key={idx} className="error-item">
                                <strong>{error}</strong>
                                <span className="error-months">({monthsList.join(', ')})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Edit Modal */}
      {editingKPI && (
        <div className="modal-overlay" onClick={() => setEditingKPICode(null)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit KPI: {editingKPI.Code}</h3>
              <button className="modal-close" onClick={() => setEditingKPICode(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name (English)</label>
                  <input
                    type="text"
                    value={editingKPI.Name || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Name (Arabic)</label>
                  <input
                    type="text"
                    value={editingKPI.Name_AR || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Name_AR: e.target.value })}
                    dir="rtl"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Description (English)</label>
                  <textarea
                    value={editingKPI.Description || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Description (Arabic)</label>
                  <textarea
                    value={editingKPI.Description_AR || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Description_AR: e.target.value })}
                    dir="rtl"
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label>Impact Type</label>
                  <select
                    value={editingKPI.Impact_Type || 'Direct'}
                    onChange={(e) => updateKPI(editingKPI.Code, { Impact_Type: e.target.value })}
                  >
                    {impactTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Indicator Type</label>
                  <select
                    value={editingKPI.Indicator_Type || 'Lagging'}
                    onChange={(e) => updateKPI(editingKPI.Code, { Indicator_Type: e.target.value })}
                  >
                    {indicatorTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Approval Status</label>
                  <select
                    value={editingKPI.Approval_Status || 'Recommended'}
                    onChange={(e) => updateKPI(editingKPI.Code, { Approval_Status: e.target.value })}
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
                    value={editingKPI.Unit || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Unit: e.target.value })}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Target</label>
                  <div className="target-mode-selector">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="targetMode"
                        value="single"
                        checked={(editingKPI.Target_Mode || 'single') === 'single'}
                        onChange={() => updateKPI(editingKPI.Code, { Target_Mode: 'single' })}
                      />
                      Same for all months
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="targetMode"
                        value="monthly"
                        checked={editingKPI.Target_Mode === 'monthly'}
                        onChange={() => updateKPI(editingKPI.Code, { Target_Mode: 'monthly' })}
                      />
                      Different per month
                    </label>
                  </div>
                  {(editingKPI.Target_Mode || 'single') === 'single' ? (
                    <input
                      type="text"
                      value={editingKPI.Target || ''}
                      onChange={(e) => updateKPI(editingKPI.Code, { Target: e.target.value })}
                      placeholder="Target value for all months"
                    />
                  ) : (
                    <div className="monthly-targets-grid">
                      {MONTHS.map((month, idx) => (
                        <div key={month} className="monthly-target-input">
                          <label>{month}</label>
                          <input
                            type="text"
                            value={(editingKPI.Monthly_Targets || {})[idx] || ''}
                            onChange={(e) => updateKPI(editingKPI.Code, {
                              Monthly_Targets: { ...(editingKPI.Monthly_Targets || {}), [idx]: e.target.value }
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
                    value={editingKPI.Weight || 0}
                    onChange={(e) => updateKPI(editingKPI.Code, { Weight: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label>Polarity</label>
                  <select
                    value={editingKPI.Polarity || 'Positive'}
                    onChange={(e) => updateKPI(editingKPI.Code, { Polarity: e.target.value })}
                  >
                    {polarityOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Formula</label>
                  <textarea
                    value={editingKPI.Formula || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Formula: e.target.value })}
                    placeholder="e.g., (Revenue - Cost) / Revenue * 100"
                    rows={2}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Data Points</label>
                  <textarea
                    value={editingKPI.Data_Points || ''}
                    onChange={(e) => updateKPI(editingKPI.Code, { Data_Points: e.target.value })}
                    placeholder="e.g., Revenue, Cost, Number of Employees (comma separated)"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setEditingKPICode(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeasureTab;
