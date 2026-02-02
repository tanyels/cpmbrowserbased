import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategy } from '../../contexts/StrategyContext';
import { Settings, Building2, Calendar } from 'lucide-react';

function OrgViewTab() {
  const navigate = useNavigate();
  const {
    businessUnits,
    objectives,
    kpis,
    pillars,
    teamMembers,
    measures,
    achievements,
    settings
  } = useStrategy();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedOrg, setSelectedOrg] = useState(null);
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [expandedDetails, setExpandedDetails] = useState({});
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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

  // Get month key for achievements lookup
  const getMonthKey = (monthIdx, year = selectedYear) => `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  // Build organization tree structure
  const orgTree = useMemo(() => {
    const l1Units = businessUnits.filter(bu => bu.Level === 'L1' && bu.Status === 'Active');
    const l2Units = businessUnits.filter(bu => bu.Level === 'L2' && bu.Status === 'Active');
    const l3Units = businessUnits.filter(bu => bu.Level === 'L3' && bu.Status === 'Active');

    return l1Units.map(l1 => ({
      ...l1,
      children: l2Units
        .filter(l2 => l2.Parent_Code === l1.Code)
        .map(l2 => ({
          ...l2,
          children: l3Units.filter(l3 => l3.Parent_Code === l2.Code)
        }))
    }));
  }, [businessUnits]);

  // Initialize expanded state for all orgs with children
  React.useEffect(() => {
    const initial = {};
    businessUnits.forEach(bu => {
      initial[bu.Code] = true; // Start expanded
    });
    setExpandedOrgs(initial);
  }, [businessUnits]);

  // Get objectives for a business unit
  const getObjectivesForBU = (buCode, buLevel) => {
    return objectives.filter(obj =>
      obj.Business_Unit_Code === buCode &&
      obj.Level === buLevel &&
      obj.Status === 'Active' &&
      !obj.Is_Operational
    );
  };

  // Get operational objectives for a BU
  const getOperationalObjectives = (buCode) => {
    return objectives.filter(obj =>
      obj.Business_Unit_Code === buCode &&
      obj.Is_Operational &&
      obj.Status === 'Active'
    );
  };

  // Get KPIs for an objective
  const getKPIsForObjective = (objCode) => {
    return kpis.filter(kpi =>
      kpi.Objective_Code === objCode &&
      kpi.Review_Status !== 'Retired'
    );
  };

  // Get all KPIs for a BU
  const getKPIsForBU = (buCode) => {
    return kpis.filter(kpi =>
      kpi.Business_Unit_Code === buCode &&
      kpi.Review_Status !== 'Retired'
    );
  };

  // Get employees for a BU
  const getEmployeesForBU = (buCode) => {
    return (teamMembers || []).filter(emp =>
      emp.Business_Unit_Code === buCode &&
      emp.Status === 'Active'
    );
  };

  // Get KPIs for a specific BU (through objectives)
  const getKPIsForBUAchievement = useCallback((buCode) => {
    const buObjectives = (objectives || []).filter(obj => obj.Business_Unit_Code === buCode);
    const objectiveCodes = buObjectives.map(obj => obj.Code);
    return (kpis || []).filter(kpi => objectiveCodes.includes(kpi.Objective_Code));
  }, [objectives, kpis]);

  // Get achievement for a KPI at a specific month
  const getKPIAchievement = useCallback((kpiCode, monthIdx) => {
    const measure = (measures || []).find(m => m.KPI_Code === kpiCode);
    if (!measure) return null;
    const monthKey = getMonthKey(monthIdx);
    return achievements?.[measure.Code]?.[monthKey] ?? null;
  }, [measures, achievements, selectedYear]);

  // Get capped achievement value
  const getCappedAchievement = useCallback((achievement) => {
    if (achievement === null || achievement === undefined) return null;
    const achievementCap = settings?.achievementCap ?? 120;
    return Math.min(achievement, achievementCap);
  }, [settings]);

  // Calculate weighted achievement for a BU
  const calculateBUAchievement = useCallback((buCode) => {
    const buKPIs = getKPIsForBUAchievement(buCode);
    if (buKPIs.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    buKPIs.forEach(kpi => {
      const weight = parseFloat(kpi.Weight) || 0;
      const achievement = getKPIAchievement(kpi.Code, selectedMonth);

      if (achievement !== null && weight > 0) {
        const cappedAchievement = getCappedAchievement(achievement);
        weightedSum += weight * cappedAchievement;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
  }, [getKPIsForBUAchievement, getKPIAchievement, getCappedAchievement, selectedMonth]);

  // Get achievement color based on thresholds
  const getAchievementColor = useCallback((achievement) => {
    if (achievement === null || achievement === undefined) return null;
    const thresholdExcellent = settings?.thresholdExcellent ?? 100;
    const thresholdGood = settings?.thresholdGood ?? 80;
    const thresholdWarning = settings?.thresholdWarning ?? 60;

    if (achievement >= thresholdExcellent) return settings?.colorExcellent || '#28a745';
    if (achievement >= thresholdGood) return settings?.colorGood || '#ffc107';
    if (achievement >= thresholdWarning) return settings?.colorWarning || '#fd7e14';
    return settings?.colorPoor || '#dc3545';
  }, [settings]);

  // Navigate to scorecard for a BU
  const navigateToScorecard = (buCode, buLevel) => {
    const params = new URLSearchParams({
      bu: buCode,
      level: buLevel,
      year: selectedYear,
      month: selectedMonth
    });
    navigate(`/main/scorecard?${params.toString()}`);
  };

  // Get pillar by code
  const getPillar = (pillarCode) => {
    return pillars.find(p => p.Code === pillarCode);
  };

  // Toggle org expand/collapse
  const toggleOrg = (code, e) => {
    e.stopPropagation();
    setExpandedOrgs(prev => ({ ...prev, [code]: !prev[code] }));
  };

  // Toggle detail section
  const toggleDetail = (key) => {
    setExpandedDetails(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Get status color for KPIs
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'locked':
      case 'approved':
      case 'kept':
        return 'approved';
      case 'recommended':
      case 'edited':
        return 'edited';
      case 'under discussion':
      case 'new':
        return 'new';
      case 'rejected':
      case 'retired':
        return 'retired';
      default:
        return 'pending';
    }
  };

  // Render a single org node with its children
  const renderOrgNode = (org, isRoot = false) => {
    const hasChildren = org.children && org.children.length > 0;
    const isExpanded = expandedOrgs[org.Code];
    const isSelected = selectedOrg?.Code === org.Code;
    const buObjectives = getObjectivesForBU(org.Code, org.Level);
    const operationalObjs = getOperationalObjectives(org.Code);
    const allKPIs = getKPIsForBU(org.Code);
    const buEmployees = getEmployeesForBU(org.Code);
    const totalObjectives = buObjectives.length + operationalObjs.length;
    const buAchievement = calculateBUAchievement(org.Code);
    const achievementColor = getAchievementColor(buAchievement);

    const levelColors = {
      'L1': '#4472C4',
      'L2': '#5B9BD5',
      'L3': '#70AD47'
    };

    return (
      <div className="org-node" key={org.Code}>
        {/* Vertical line from parent */}
        {!isRoot && <div className="org-line-top" />}

        {/* The org box */}
        <div
          className={`org-box ${isSelected ? 'selected' : ''}`}
          style={{ '--level-color': levelColors[org.Level] }}
          onClick={() => setSelectedOrg(org)}
        >
          {/* Achievement badge on top-right */}
          {buAchievement !== null && (
            <div
              className="org-achievement-badge"
              style={{ backgroundColor: achievementColor }}
              title={`Achievement: ${buAchievement.toFixed(1)}%`}
            >
              {buAchievement.toFixed(0)}%
            </div>
          )}
          <div className="org-box-level" style={{ backgroundColor: levelColors[org.Level] }}>
            {org.Level}
          </div>
          <div className="org-box-content">
            {org.Abbreviation && (
              <div className="org-box-abbr">{org.Abbreviation}</div>
            )}
            <div className="org-box-name">{org.Name}</div>
            <div className="org-box-stats">
              <span>{totalObjectives} Obj</span>
              <span>•</span>
              <span>{allKPIs.length} KPIs</span>
              <span>•</span>
              <span>{buEmployees.length} Emp</span>
            </div>
          </div>
          {/* Scorecard link button */}
          <button
            className="org-scorecard-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigateToScorecard(org.Code, org.Level);
            }}
            title="View Scorecard"
          >
            →
          </button>
          {hasChildren && (
            <button
              className={`org-expand-btn ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => toggleOrg(org.Code, e)}
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="org-subtree">
            {/* Vertical line from parent to horizontal line */}
            <div className="org-vline-down" />

            {/* Horizontal connector bar */}
            <div
              className="org-hline"
              style={{
                '--child-count': org.children.length,
                display: org.children.length > 1 ? 'block' : 'none'
              }}
            />

            {/* Children nodes */}
            <div className="org-children">
              {org.children.map((child, idx) => (
                <div key={child.Code} className="org-child-wrapper">
                  {/* Vertical line from horizontal bar to child */}
                  <div className="org-vline-to-child" />
                  {renderOrgNode(child, false)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render detail panel for selected org
  const renderDetailPanel = () => {
    if (!selectedOrg) return null;

    const buObjectives = getObjectivesForBU(selectedOrg.Code, selectedOrg.Level);
    const operationalObjs = getOperationalObjectives(selectedOrg.Code);
    const allKPIs = getKPIsForBU(selectedOrg.Code);
    const buEmployees = getEmployeesForBU(selectedOrg.Code);

    // Group objectives by pillar
    const groupedByPillar = {};
    buObjectives.forEach(obj => {
      const pillarCode = obj.Pillar_Code || 'unassigned';
      if (!groupedByPillar[pillarCode]) {
        groupedByPillar[pillarCode] = [];
      }
      groupedByPillar[pillarCode].push(obj);
    });

    return (
      <div className="org-detail-panel">
        <div className="org-detail-header">
          <div className="org-detail-title">
            <span
              className="org-detail-level"
              style={{ backgroundColor: selectedOrg.Level === 'L1' ? '#4472C4' : selectedOrg.Level === 'L2' ? '#5B9BD5' : '#70AD47' }}
            >
              {selectedOrg.Level}
            </span>
            <h3>{selectedOrg.Name}</h3>
          </div>
          <button className="close-btn" onClick={() => setSelectedOrg(null)}>×</button>
        </div>

        <div className="org-detail-info">
          <div className="info-row">
            <span className="info-label">Code</span>
            <span className="info-value">{selectedOrg.Code}</span>
          </div>
          {selectedOrg.Abbreviation && (
            <div className="info-row">
              <span className="info-label">Abbreviation</span>
              <span className="info-value">{selectedOrg.Abbreviation}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Status</span>
            <span className="info-value">{selectedOrg.Status}</span>
          </div>
        </div>

        <div className="org-detail-stats">
          <div className="stat-box">
            <div className="stat-value">{buObjectives.length + operationalObjs.length}</div>
            <div className="stat-label">Objectives</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{allKPIs.length}</div>
            <div className="stat-label">KPIs</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{buEmployees.length}</div>
            <div className="stat-label">Employees</div>
          </div>
        </div>

        <div className="org-detail-sections">
          {/* For L1: Show objectives grouped by pillar */}
          {selectedOrg.Level === 'L1' && Object.entries(groupedByPillar).map(([pillarCode, objs]) => {
            const pillar = getPillar(pillarCode);
            const sectionKey = `pillar-${pillarCode}`;
            const isExpanded = expandedDetails[sectionKey];
            const pillarColor = pillar?.Color || '#4472C4';

            return (
              <div key={sectionKey} className="detail-section">
                <div
                  className="detail-section-header"
                  onClick={() => toggleDetail(sectionKey)}
                  style={{ borderLeftColor: pillarColor }}
                >
                  <div className="section-title">
                    <div className="pillar-dot" style={{ backgroundColor: pillarColor }} />
                    <span>{pillar?.Name || 'Strategic Objectives'}</span>
                  </div>
                  <div className="section-meta">
                    <span>{objs.length} objectives</span>
                    <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="detail-section-content">
                    {objs.map(obj => {
                      const objKPIs = getKPIsForObjective(obj.Code);
                      const objKey = `obj-${obj.Code}`;
                      const objExpanded = expandedDetails[objKey];

                      return (
                        <div key={obj.Code} className="objective-item">
                          <div
                            className="objective-header"
                            onClick={() => toggleDetail(objKey)}
                          >
                            <div className="objective-info">
                              <span className="objective-name">{obj.Name}</span>
                              {obj.Weight > 0 && (
                                <span className="objective-weight">{obj.Weight}%</span>
                              )}
                            </div>
                            <div className="objective-meta">
                              <span className="kpi-count">{objKPIs.length} KPIs</span>
                              {objKPIs.length > 0 && (
                                <span className="expand-icon">{objExpanded ? '−' : '+'}</span>
                              )}
                            </div>
                          </div>

                          {objExpanded && objKPIs.length > 0 && (
                            <div className="kpi-list">
                              {objKPIs.map(kpi => (
                                <div key={kpi.Code} className="kpi-item">
                                  <div className="kpi-info">
                                    <span className="kpi-code">{kpi.Code}</span>
                                    <span className="kpi-name">{kpi.Name}</span>
                                  </div>
                                  <span className={`kpi-status ${getStatusColor(kpi.Review_Status)}`}>
                                    {kpi.Review_Status || 'Pending'}
                                  </span>
                                </div>
                              ))}
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

          {/* For L2/L3: Show objectives directly without pillar grouping */}
          {(selectedOrg.Level === 'L2' || selectedOrg.Level === 'L3') && buObjectives.length > 0 && (
            <div className="detail-section">
              <div
                className="detail-section-header"
                onClick={() => toggleDetail('objectives')}
                style={{ borderLeftColor: selectedOrg.Level === 'L2' ? '#5B9BD5' : '#70AD47' }}
              >
                <div className="section-title">
                  <span className="level-icon">{selectedOrg.Level}</span>
                  <span>{selectedOrg.Level} Objectives</span>
                </div>
                <div className="section-meta">
                  <span>{buObjectives.length} objectives</span>
                  <span className="expand-icon">{expandedDetails['objectives'] ? '−' : '+'}</span>
                </div>
              </div>

              {expandedDetails['objectives'] && (
                <div className="detail-section-content">
                  {buObjectives.map(obj => {
                    const objKPIs = getKPIsForObjective(obj.Code);
                    const objKey = `obj-${obj.Code}`;
                    const objExpanded = expandedDetails[objKey];

                    return (
                      <div key={obj.Code} className="objective-item">
                        <div
                          className="objective-header"
                          onClick={() => toggleDetail(objKey)}
                        >
                          <div className="objective-info">
                            <span className="objective-name">{obj.Name}</span>
                            {obj.Weight > 0 && (
                              <span className="objective-weight">{obj.Weight}%</span>
                            )}
                          </div>
                          <div className="objective-meta">
                            <span className="kpi-count">{objKPIs.length} KPIs</span>
                            {objKPIs.length > 0 && (
                              <span className="expand-icon">{objExpanded ? '−' : '+'}</span>
                            )}
                          </div>
                        </div>

                        {objExpanded && objKPIs.length > 0 && (
                          <div className="kpi-list">
                            {objKPIs.map(kpi => (
                              <div key={kpi.Code} className="kpi-item">
                                <div className="kpi-info">
                                  <span className="kpi-code">{kpi.Code}</span>
                                  <span className="kpi-name">{kpi.Name}</span>
                                </div>
                                <span className={`kpi-status ${getStatusColor(kpi.Review_Status)}`}>
                                  {kpi.Review_Status || 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Operational Objectives */}
          {operationalObjs.length > 0 && (
            <div className="detail-section">
              <div
                className="detail-section-header operational"
                onClick={() => toggleDetail('operational')}
              >
                <div className="section-title">
                  <span className="operational-icon"><Settings size={12} /></span>
                  <span>Operational</span>
                </div>
                <div className="section-meta">
                  <span>{operationalObjs.length} objectives</span>
                  <span className="expand-icon">{expandedDetails['operational'] ? '−' : '+'}</span>
                </div>
              </div>

              {expandedDetails['operational'] && (
                <div className="detail-section-content">
                  {operationalObjs.map(obj => {
                    const objKPIs = getKPIsForObjective(obj.Code);
                    const objKey = `obj-${obj.Code}`;
                    const objExpanded = expandedDetails[objKey];

                    return (
                      <div key={obj.Code} className="objective-item">
                        <div
                          className="objective-header"
                          onClick={() => toggleDetail(objKey)}
                        >
                          <div className="objective-info">
                            <span className="objective-name">{obj.Name}</span>
                          </div>
                          <div className="objective-meta">
                            <span className="kpi-count">{objKPIs.length} KPIs</span>
                            {objKPIs.length > 0 && (
                              <span className="expand-icon">{objExpanded ? '−' : '+'}</span>
                            )}
                          </div>
                        </div>

                        {objExpanded && objKPIs.length > 0 && (
                          <div className="kpi-list">
                            {objKPIs.map(kpi => (
                              <div key={kpi.Code} className="kpi-item">
                                <div className="kpi-info">
                                  <span className="kpi-code">{kpi.Code}</span>
                                  <span className="kpi-name">{kpi.Name}</span>
                                </div>
                                <span className={`kpi-status ${getStatusColor(kpi.Review_Status)}`}>
                                  {kpi.Review_Status || 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {buObjectives.length === 0 && operationalObjs.length === 0 && (
            <div className="empty-objectives">
              No objectives defined for this organization
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="org-chart-container">
      <div className="org-chart-header">
        <div>
          <h2>Organization Chart</h2>
          <p>Click on any organization to view details. Use arrow button to go to Scorecard.</p>
        </div>
        <div className="org-date-filter">
          <Calendar size={16} />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="month-select"
          >
            {months.map(m => (
              <option key={m.idx} value={m.idx}>{m.full}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="year-select"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="org-chart-wrapper">
        <div className="org-chart-canvas">
          {orgTree.length === 0 ? (
            <div className="org-chart-empty">
              <div className="empty-icon"><Building2 size={48} /></div>
              <h3>No Organizations Defined</h3>
              <p>Go to Design → Business Units to create your organizational structure.</p>
            </div>
          ) : (
            <div className="org-chart">
              {orgTree.map(org => renderOrgNode(org, true))}
            </div>
          )}
        </div>

        {renderDetailPanel()}
      </div>
    </div>
  );
}

export default OrgViewTab;
