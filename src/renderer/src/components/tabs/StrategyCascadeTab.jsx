import React, { useState, useMemo } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

function StrategyCascadeTab() {
  const {
    pillars,
    objectives,
    kpis,
    businessUnits
  } = useStrategy();

  const [expandedPillars, setExpandedPillars] = useState({});
  const [expandedL1, setExpandedL1] = useState({});
  const [expandedBUGroups, setExpandedBUGroups] = useState({});
  const [expandedL2, setExpandedL2] = useState({});
  const [expandedL3, setExpandedL3] = useState({});
  const [expandedKPIs, setExpandedKPIs] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  // Get active pillars
  const activePillars = useMemo(() => {
    return pillars.filter(p => p.Status === 'Active');
  }, [pillars]);

  // Get L1 objectives for a pillar
  const getL1ObjectivesForPillar = (pillarCode) => {
    return objectives.filter(obj =>
      obj.Level === 'L1' &&
      obj.Pillar_Code === pillarCode &&
      !obj.Is_Operational
    );
  };

  // Get child objectives (L2 or L3 that have this objective as parent)
  const getChildObjectives = (parentCode, level) => {
    return objectives.filter(obj =>
      obj.Level === level &&
      obj.Parent_Objective_Code === parentCode &&
      !obj.Is_Operational
    );
  };

  // Get KPIs for an objective
  const getKPIsForObjective = (objCode) => {
    return kpis.filter(kpi => kpi.Objective_Code === objCode);
  };

  // Get BU name
  const getBUName = (buCode) => {
    const bu = businessUnits.find(b => b.Code === buCode);
    return bu ? bu.Name : buCode;
  };

  // Get BU abbreviation
  const getBUAbbr = (buCode) => {
    const bu = businessUnits.find(b => b.Code === buCode);
    return bu?.Abbreviation || '';
  };

  // Get BU by code
  const getBU = (buCode) => {
    return businessUnits.find(b => b.Code === buCode);
  };

  // Group L2 objectives by their Business Unit
  const groupL2sByBU = (l2Objectives) => {
    const grouped = {};
    l2Objectives.forEach(obj => {
      const buCode = obj.Business_Unit_Code || 'unassigned';
      if (!grouped[buCode]) {
        grouped[buCode] = [];
      }
      grouped[buCode].push(obj);
    });
    return grouped;
  };

  // Toggle functions
  const togglePillar = (code) => {
    setExpandedPillars(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleL1 = (code) => {
    setExpandedL1(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleBUGroup = (key) => {
    setExpandedBUGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleL2 = (code) => {
    setExpandedL2(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleL3 = (code) => {
    setExpandedL3(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleKPIs = (code) => {
    setExpandedKPIs(prev => ({ ...prev, [code]: !prev[code] }));
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'locked':
      case 'approved':
        return 'status-approved';
      case 'recommended':
        return 'status-recommended';
      case 'under discussion':
        return 'status-discussion';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  };

  // Render KPIs section
  const renderKPIs = (objCode) => {
    const objKPIs = getKPIsForObjective(objCode);
    const isExpanded = expandedKPIs[objCode];

    if (objKPIs.length === 0) return null;

    return (
      <div className="cascade-kpis-section">
        <button
          className="kpis-toggle"
          onClick={(e) => {
            e.stopPropagation();
            toggleKPIs(objCode);
          }}
        >
          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="kpis-label">KPIs ({objKPIs.length})</span>
        </button>

        {isExpanded && (
          <div className="cascade-kpis-list">
            {objKPIs.map(kpi => (
              <div
                key={kpi.Code}
                className={`cascade-kpi ${selectedItem?.data?.Code === kpi.Code ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem({ type: 'kpi', data: kpi });
                }}
              >
                <span className="kpi-icon">📊</span>
                <span className="kpi-name">{kpi.Name}</span>
                <span className={`kpi-status ${getStatusColor(kpi.Approval_Status)}`}>
                  {kpi.Approval_Status || 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render L3 Objective
  const renderL3Objective = (obj) => {
    const isExpanded = expandedL3[obj.Code];
    const objKPIs = getKPIsForObjective(obj.Code);
    const isSelected = selectedItem?.type === 'objective' && selectedItem?.data?.Code === obj.Code;
    const buAbbr = getBUAbbr(obj.Business_Unit_Code);

    return (
      <div key={obj.Code} className="cascade-l3-wrapper">
        <div
          className={`cascade-objective l3 ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedItem({ type: 'objective', data: obj })}
        >
          <div className="objective-header">
            {objKPIs.length > 0 && (
              <button
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleL3(obj.Code);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {objKPIs.length === 0 && <span className="expand-placeholder" />}
            <span className="level-badge l3">L3</span>
            {buAbbr && <span className="bu-badge">{buAbbr}</span>}
            <span className="objective-name">{obj.Name}</span>
          </div>
          <div className="objective-meta">
            <span className="weight-badge">{obj.Weight}%</span>
            <span className="kpi-count">{objKPIs.length} KPIs</span>
          </div>
        </div>

        {isExpanded && renderKPIs(obj.Code)}
      </div>
    );
  };

  // Render L2 Objective
  const renderL2Objective = (obj) => {
    const isExpanded = expandedL2[obj.Code];
    const childL3s = getChildObjectives(obj.Code, 'L3');
    const objKPIs = getKPIsForObjective(obj.Code);
    const hasChildren = childL3s.length > 0 || objKPIs.length > 0;
    const isSelected = selectedItem?.type === 'objective' && selectedItem?.data?.Code === obj.Code;
    const buAbbr = getBUAbbr(obj.Business_Unit_Code);

    return (
      <div key={obj.Code} className="cascade-l2-wrapper">
        <div
          className={`cascade-objective l2 ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedItem({ type: 'objective', data: obj })}
        >
          <div className="objective-header">
            {hasChildren && (
              <button
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleL2(obj.Code);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="expand-placeholder" />}
            <span className="level-badge l2">L2</span>
            {buAbbr && <span className="bu-badge">{buAbbr}</span>}
            <span className="objective-name">{obj.Name}</span>
          </div>
          <div className="objective-meta">
            <span className="weight-badge">{obj.Weight}%</span>
            <span className="kpi-count">{objKPIs.length} KPIs</span>
            {childL3s.length > 0 && (
              <span className="children-count">{childL3s.length} L3</span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="cascade-l2-content">
            {renderKPIs(obj.Code)}

            {childL3s.length > 0 && (
              <div className="cascade-l3-list">
                {childL3s.map(l3 => renderL3Objective(l3))}
              </div>
            )}

            {childL3s.length === 0 && objKPIs.length === 0 && (
              <div className="no-children">No L3 objectives or KPIs</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render BU Group with its L2 objectives (for grouping under L1)
  const renderBUGroup = (buCode, l2Objectives, l1Code) => {
    const bu = getBU(buCode);
    const key = `${l1Code}-bu-${buCode}`;
    const isExpanded = expandedBUGroups[key];

    return (
      <div key={key} className="cascade-bu-group">
        <div
          className="bu-group-header"
          onClick={() => toggleBUGroup(key)}
        >
          <button className="expand-btn">
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="level-badge l2">L2</span>
          <span className="bu-group-name">
            {bu ? bu.Name : 'Unassigned BU'}
          </span>
          {bu?.Abbreviation && (
            <span className="bu-abbr-badge">{bu.Abbreviation}</span>
          )}
          <span className="objectives-count">{l2Objectives.length} objectives</span>
        </div>

        {isExpanded && (
          <div className="bu-group-content">
            {l2Objectives.map(l2 => renderL2Objective(l2))}
          </div>
        )}
      </div>
    );
  };

  // Render L1 Objective
  const renderL1Objective = (obj) => {
    const isExpanded = expandedL1[obj.Code];
    const childL2s = getChildObjectives(obj.Code, 'L2');
    const objKPIs = getKPIsForObjective(obj.Code);
    const hasChildren = childL2s.length > 0 || objKPIs.length > 0;
    const isSelected = selectedItem?.type === 'objective' && selectedItem?.data?.Code === obj.Code;

    // Group L2 objectives by Business Unit
    const l2sByBU = groupL2sByBU(childL2s);

    return (
      <div key={obj.Code} className="cascade-l1-wrapper">
        <div
          className={`cascade-objective l1 ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedItem({ type: 'objective', data: obj })}
        >
          <div className="objective-header">
            {hasChildren && (
              <button
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleL1(obj.Code);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="expand-placeholder" />}
            <span className="level-badge l1">L1</span>
            <span className="objective-name">{obj.Name}</span>
          </div>
          <div className="objective-meta">
            <span className="weight-badge">{obj.Weight}%</span>
            <span className="kpi-count">{objKPIs.length} KPIs</span>
            {childL2s.length > 0 && (
              <span className="children-count">{childL2s.length} L2</span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="cascade-l1-content">
            {renderKPIs(obj.Code)}

            {Object.keys(l2sByBU).length > 0 && (
              <div className="cascade-bu-groups">
                {Object.entries(l2sByBU).map(([buCode, l2Objs]) =>
                  renderBUGroup(buCode, l2Objs, obj.Code)
                )}
              </div>
            )}

            {childL2s.length === 0 && objKPIs.length === 0 && (
              <div className="no-children">No L2 objectives or KPIs</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Pillar
  const renderPillar = (pillar) => {
    const isExpanded = expandedPillars[pillar.Code];
    const l1Objectives = getL1ObjectivesForPillar(pillar.Code);
    const pillarColor = pillar.Color || '#4472C4';
    const isSelected = selectedItem?.type === 'pillar' && selectedItem?.data?.Code === pillar.Code;

    return (
      <div key={pillar.Code} className="cascade-pillar-wrapper">
        <div
          className={`cascade-pillar ${isSelected ? 'selected' : ''}`}
          style={{ borderLeftColor: pillarColor }}
          onClick={() => setSelectedItem({ type: 'pillar', data: pillar })}
        >
          <div className="pillar-header">
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePillar(pillar.Code);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
            <div
              className="pillar-color-dot"
              style={{ backgroundColor: pillarColor }}
            />
            <span className="pillar-name">{pillar.Name}</span>
          </div>
          <div className="pillar-meta">
            <span className="weight-badge">{pillar.Weight}%</span>
            <span className="objectives-count">{l1Objectives.length} L1 Objectives</span>
          </div>
        </div>

        {isExpanded && (
          <div className="cascade-pillar-content">
            {l1Objectives.length > 0 ? (
              <div className="cascade-l1-list">
                {l1Objectives.map(obj => renderL1Objective(obj))}
              </div>
            ) : (
              <div className="no-children">No L1 objectives assigned to this pillar</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="strategy-cascade-tab">
      <div className="cascade-header">
        <h2>Strategy Cascade</h2>
        <p className="section-description">
          Explore the strategic hierarchy from Pillars through L1, L2, and L3 objectives with their KPIs.
        </p>
      </div>

      <div className="cascade-container">
        <div className="cascade-tree-panel">
          {activePillars.length === 0 ? (
            <div className="empty-state">
              <p>No strategic pillars defined yet.</p>
              <p>Go to Design → Strategy to create pillars.</p>
            </div>
          ) : (
            <div className="cascade-tree">
              {activePillars.map(pillar => renderPillar(pillar))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="cascade-detail-panel">
            {selectedItem.type === 'pillar' && (
              <div className="detail-content">
                <div
                  className="detail-header"
                  style={{ borderLeftColor: selectedItem.data.Color || '#4472C4' }}
                >
                  <h3>{selectedItem.data.Name}</h3>
                </div>
                <div className="detail-rows">
                  <div className="detail-row">
                    <label>Code:</label>
                    <span>{selectedItem.data.Code}</span>
                  </div>
                  <div className="detail-row">
                    <label>Weight:</label>
                    <span>{selectedItem.data.Weight}%</span>
                  </div>
                  <div className="detail-row">
                    <label>Status:</label>
                    <span>{selectedItem.data.Status}</span>
                  </div>
                  {selectedItem.data.Description && (
                    <div className="detail-row full-width">
                      <label>Description:</label>
                      <span>{selectedItem.data.Description}</span>
                    </div>
                  )}
                  {selectedItem.data.Name_AR && (
                    <div className="detail-row">
                      <label>Arabic Name:</label>
                      <span dir="rtl">{selectedItem.data.Name_AR}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedItem.type === 'objective' && (
              <div className="detail-content">
                <h3>{selectedItem.data.Name}</h3>
                <div className="detail-rows">
                  <div className="detail-row">
                    <label>Code:</label>
                    <span>{selectedItem.data.Code}</span>
                  </div>
                  <div className="detail-row">
                    <label>Level:</label>
                    <span>{selectedItem.data.Level}</span>
                  </div>
                  <div className="detail-row">
                    <label>Weight:</label>
                    <span>{selectedItem.data.Weight}%</span>
                  </div>
                  {selectedItem.data.Business_Unit_Code && (
                    <div className="detail-row">
                      <label>Business Unit:</label>
                      <span>{getBUName(selectedItem.data.Business_Unit_Code)}</span>
                    </div>
                  )}
                  {selectedItem.data.Parent_Objective_Code && (
                    <div className="detail-row">
                      <label>Parent Objective:</label>
                      <span>{selectedItem.data.Parent_Objective_Code}</span>
                    </div>
                  )}
                  {selectedItem.data.Description && (
                    <div className="detail-row full-width">
                      <label>Description:</label>
                      <span>{selectedItem.data.Description}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedItem.type === 'kpi' && (
              <div className="detail-content">
                <h3>{selectedItem.data.Name}</h3>
                <div className="detail-rows">
                  <div className="detail-row">
                    <label>Code:</label>
                    <span>{selectedItem.data.Code}</span>
                  </div>
                  <div className="detail-row">
                    <label>Status:</label>
                    <span className={`status-badge ${getStatusColor(selectedItem.data.Approval_Status)}`}>
                      {selectedItem.data.Approval_Status || 'Pending'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <label>Weight:</label>
                    <span>{selectedItem.data.Weight}%</span>
                  </div>
                  <div className="detail-row">
                    <label>Target:</label>
                    <span>{selectedItem.data.Target || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Impact Type:</label>
                    <span>{selectedItem.data.Impact_Type || '-'}</span>
                  </div>
                  {selectedItem.data.Formula && (
                    <div className="detail-row full-width">
                      <label>Formula:</label>
                      <span>{selectedItem.data.Formula}</span>
                    </div>
                  )}
                  {selectedItem.data.Description && (
                    <div className="detail-row full-width">
                      <label>Description:</label>
                      <span>{selectedItem.data.Description}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              className="btn btn-ghost btn-sm close-detail"
              onClick={() => setSelectedItem(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StrategyCascadeTab;
