import React, { useState, useCallback, useEffect } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';
import { BarChart3 } from 'lucide-react';

// ============================================
// SCORECARD TAB - Main Component
// ============================================
function ScorecardTab() {
  const {
    measures,
    kpis,
    objectives,
    businessUnits,
    calculatedValues,
    achievements,
    settings,
    updateKPI
  } = useStrategy();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [selectedL2BU, setSelectedL2BU] = useState('');
  const [selectedBU, setSelectedBU] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showYTD, setShowYTD] = useState(false);

  // KPI Detail Modal state
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [isEditingKPI, setIsEditingKPI] = useState(false);
  const [kpiEditForm, setKpiEditForm] = useState({});

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

  // Get BUs by level
  const l1BusinessUnits = (businessUnits || []).filter(bu => bu.Level === 'L1' && bu.Status === 'Active');
  const l2BusinessUnits = (businessUnits || []).filter(bu => bu.Level === 'L2' && bu.Status === 'Active');
  const l3BusinessUnits = (businessUnits || []).filter(bu => bu.Level === 'L3' && bu.Status === 'Active');

  // Get filtered L3 BUs
  const filteredL3BUs = selectedL2BU
    ? l3BusinessUnits.filter(bu => bu.Parent_Code === selectedL2BU)
    : l3BusinessUnits;

  // Auto-select first BU when level changes
  useEffect(() => {
    if (selectedLevel === 'L1' && l1BusinessUnits.length > 0 && !selectedBU) {
      setSelectedBU(l1BusinessUnits[0].Code);
    } else if (selectedLevel === 'L2' && l2BusinessUnits.length > 0 && !selectedBU) {
      setSelectedBU(l2BusinessUnits[0].Code);
    }
  }, [selectedLevel, l1BusinessUnits, l2BusinessUnits]);

  // Get month key
  const getMonthKey = (monthIdx, year = selectedYear) => `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  // Get KPIs for a specific BU (through objectives)
  const getKPIsForBU = useCallback((buCode) => {
    const buObjectives = (objectives || []).filter(obj => obj.Business_Unit_Code === buCode);
    const objectiveCodes = buObjectives.map(obj => obj.Code);
    return (kpis || []).filter(kpi => objectiveCodes.includes(kpi.Objective_Code));
  }, [objectives, kpis]);

  // Get achievement for a KPI at a specific month (actual value)
  const getKPIAchievement = useCallback((kpiCode, monthIdx) => {
    const measure = (measures || []).find(m => m.KPI_Code === kpiCode);
    if (!measure) return null;
    const monthKey = getMonthKey(monthIdx);
    return achievements?.[measure.Code]?.[monthKey] ?? null;
  }, [measures, achievements, selectedYear]);

  // Get capped achievement value (for display and weighted average calculations)
  const getCappedAchievement = useCallback((achievement) => {
    if (achievement === null || achievement === undefined) return null;
    const achievementCap = settings?.achievementCap ?? 120;
    return Math.min(achievement, achievementCap);
  }, [settings]);

  // Get actual value for a KPI at a specific month
  const getKPIActual = useCallback((kpiCode, monthIdx) => {
    const measure = (measures || []).find(m => m.KPI_Code === kpiCode);
    if (!measure) return null;
    const monthKey = getMonthKey(monthIdx);
    const calcResult = calculatedValues?.[measure.Code]?.[monthKey];
    return calcResult?.value ?? null;
  }, [measures, calculatedValues, selectedYear]);

  // Get target for a KPI at a specific month
  const getKPITarget = useCallback((kpi, monthIdx) => {
    if (!kpi) return null;
    if (kpi.Target_Mode === 'monthly' && kpi.Monthly_Targets?.[monthIdx]) {
      return parseFloat(kpi.Monthly_Targets[monthIdx]);
    }
    return kpi.Target ? parseFloat(kpi.Target) : null;
  }, []);

  // Calculate weighted achievement for a BU (uses capped values)
  const calculateBUAchievement = useCallback((buCode, monthIdx = selectedMonth) => {
    const buKPIs = getKPIsForBU(buCode);
    if (buKPIs.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    buKPIs.forEach(kpi => {
      const weight = parseFloat(kpi.Weight) || 0;
      const achievement = getKPIAchievement(kpi.Code, monthIdx);

      if (achievement !== null && weight > 0) {
        // Use capped achievement for weighted average calculation
        const cappedAchievement = getCappedAchievement(achievement);
        weightedSum += weight * cappedAchievement;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
  }, [getKPIsForBU, getKPIAchievement, getCappedAchievement, selectedMonth]);

  // Calculate YTD achievement (average of months up to selected month)
  const calculateYTDAchievement = useCallback((buCode) => {
    let totalAchievement = 0;
    let monthsWithData = 0;

    for (let i = 0; i <= selectedMonth; i++) {
      const monthAchievement = calculateBUAchievement(buCode, i);
      if (monthAchievement !== null) {
        totalAchievement += monthAchievement;
        monthsWithData++;
      }
    }

    if (monthsWithData === 0) return null;
    return totalAchievement / monthsWithData;
  }, [calculateBUAchievement, selectedMonth]);

  // Get achievement color class
  const getAchievementColor = (achievement) => {
    if (achievement === null || achievement === undefined) return 'no-data';
    const thresholdExcellent = settings?.thresholdExcellent ?? 100;
    const thresholdGood = settings?.thresholdGood ?? 80;
    const thresholdWarning = settings?.thresholdWarning ?? 60;
    if (achievement >= thresholdExcellent) return 'excellent';
    if (achievement >= thresholdGood) return 'good';
    if (achievement >= thresholdWarning) return 'warning';
    return 'poor';
  };

  // Get achievement inline style with custom colors
  const getAchievementStyle = (achievement, includeForCard = false) => {
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

    // Lighten color for card backgrounds
    const lightenColor = (hexColor, percent) => {
      const num = parseInt(hexColor.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, (num >> 16) + amt);
      const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
      const B = Math.min(255, (num & 0x0000FF) + amt);
      return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    };

    if (includeForCard) {
      return {
        backgroundColor: lightenColor(bgColor, 60),
        borderColor: bgColor,
        color: textColor === '#ffffff' ? '#333' : textColor
      };
    }

    return { backgroundColor: bgColor, color: textColor };
  };

  // Get monthly trend data for line chart
  const getMonthlyTrend = useCallback((buCode) => {
    return months.map((month, idx) => ({
      month: month.short,
      achievement: calculateBUAchievement(buCode, idx)
    }));
  }, [calculateBUAchievement, months]);

  // Get child BUs
  const getChildBUs = useCallback((buCode) => {
    const bu = (businessUnits || []).find(b => b.Code === buCode);
    if (!bu) return [];

    if (bu.Level === 'L1') {
      return l2BusinessUnits;
    } else if (bu.Level === 'L2') {
      return l3BusinessUnits.filter(b => b.Parent_Code === buCode);
    }
    return [];
  }, [businessUnits, l2BusinessUnits, l3BusinessUnits]);

  // Current BU data
  const currentBU = (businessUnits || []).find(bu => bu.Code === selectedBU);
  const currentKPIs = selectedBU ? getKPIsForBU(selectedBU) : [];
  const currentAchievement = selectedBU
    ? (showYTD ? calculateYTDAchievement(selectedBU) : calculateBUAchievement(selectedBU))
    : null;
  const monthlyTrend = selectedBU ? getMonthlyTrend(selectedBU) : [];
  const childBUs = selectedBU ? getChildBUs(selectedBU) : [];

  // Previous month achievement for comparison (not available for January or YTD)
  const previousMonthAchievement = (selectedBU && selectedMonth > 0 && !showYTD)
    ? calculateBUAchievement(selectedBU, selectedMonth - 1)
    : null;

  // Calculate month-over-month change
  const monthChange = (currentAchievement !== null && previousMonthAchievement !== null)
    ? currentAchievement - previousMonthAchievement
    : null;

  // Get KPI monthly trend data (with capped achievements)
  const getKPIMonthlyTrend = useCallback((kpiCode) => {
    return months.map((month, idx) => ({
      month: month.short,
      achievement: getCappedAchievement(getKPIAchievement(kpiCode, idx))
    }));
  }, [months, getKPIAchievement, getCappedAchievement]);

  // Open KPI detail modal
  const openKPIModal = (kpi) => {
    setSelectedKPI(kpi);
    setKpiEditForm({
      Name: kpi.Name || '',
      Name_AR: kpi.Name_AR || '',
      Description: kpi.Description || '',
      Weight: kpi.Weight || 0,
      Target: kpi.Target || '',
      Target_Mode: kpi.Target_Mode || 'single',
      Monthly_Targets: kpi.Monthly_Targets || {},
      Unit: kpi.Unit || '',
      Polarity: kpi.Polarity || 'Positive',
      Approval_Status: kpi.Approval_Status || 'Draft'
    });
    setIsEditingKPI(false);
  };

  // Close KPI modal
  const closeKPIModal = () => {
    setSelectedKPI(null);
    setIsEditingKPI(false);
    setKpiEditForm({});
  };

  // Save KPI edits
  const saveKPIEdits = () => {
    if (selectedKPI && updateKPI) {
      updateKPI(selectedKPI.Code, kpiEditForm);
      setIsEditingKPI(false);
      // Update selectedKPI with new values
      setSelectedKPI({ ...selectedKPI, ...kpiEditForm });
    }
  };

  // Handle drill-down
  const handleDrillDown = (buCode) => {
    const bu = (businessUnits || []).find(b => b.Code === buCode);
    if (bu) {
      setSelectedLevel(bu.Level);
      if (bu.Level === 'L3') {
        setSelectedL2BU(bu.Parent_Code);
      }
      setSelectedBU(buCode);
    }
  };

  // Export functions (placeholder for now)
  const handleExport = (format) => {
    alert(`Export to ${format} - Coming soon!`);
  };

  return (
    <div className="scorecard-view">
      {/* Filters */}
      <div className="scorecard-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Level:</label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setSelectedL2BU('');
                setSelectedBU('');
              }}
            >
              <option value="L1">L1 - Corporate</option>
              <option value="L2">L2 - Division</option>
              <option value="L3">L3 - Department</option>
            </select>
          </div>

          {selectedLevel === 'L1' && (
            <div className="filter-group">
              <label>Business Unit:</label>
              <select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
                <option value="">Select...</option>
                {l1BusinessUnits.map(bu => (
                  <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedLevel === 'L2' && (
            <div className="filter-group">
              <label>Division:</label>
              <select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
                <option value="">Select...</option>
                {l2BusinessUnits.map(bu => (
                  <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedLevel === 'L3' && (
            <>
              <div className="filter-group">
                <label>Division (L2):</label>
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
                <div className="filter-group">
                  <label>Department:</label>
                  <select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}>
                    <option value="">Select...</option>
                    {filteredL3BUs.map(bu => (
                      <option key={bu.Code} value={bu.Code}>{bu.Name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="filter-group">
            <label>Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map(m => (
                <option key={m.idx} value={m.idx}>{m.full}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
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

          <div className="filter-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={showYTD}
                onChange={(e) => setShowYTD(e.target.checked)}
              />
              Show YTD
            </label>
          </div>

          <div className="filter-group export-group">
            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('PDF')}>
              Export PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('Excel')}>
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {!selectedBU ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 size={48} /></div>
          <h3>Select a Business Unit</h3>
          <p>Choose a business unit from the filters above to view its scorecard.</p>
        </div>
      ) : (
        <>
          {/* Scorecard Header */}
          <div className="scorecard-header-info">
            <h3>{currentBU?.Name}</h3>
            <span className="scorecard-period">
              {showYTD ? `YTD ${selectedYear}` : `${months[selectedMonth].full} ${selectedYear}`}
            </span>
          </div>

          {/* Charts Row */}
          <div className="scorecard-charts">
            {/* Gauge Chart */}
            <div className="scorecard-gauge-container">
              <h4>Overall Achievement</h4>
              <GaugeChart value={currentAchievement} settings={settings} />
              <div className={`gauge-value ${getAchievementColor(currentAchievement)}`}>
                {currentAchievement !== null ? `${currentAchievement.toFixed(0)}%` : 'No Data'}
              </div>
              {/* Month-over-month change indicator */}
              {monthChange !== null && (
                <div className={`gauge-change ${monthChange > 0 ? 'positive' : monthChange < 0 ? 'negative' : 'neutral'}`}>
                  <span className="change-indicator">
                    {monthChange > 0 ? '▲' : monthChange < 0 ? '▼' : '▬'}
                  </span>
                  <span className="change-value">
                    {monthChange > 0 ? '+' : ''}{monthChange.toFixed(0)}%
                  </span>
                  <span className="change-label">vs {months[selectedMonth - 1]?.short}</span>
                </div>
              )}
              {selectedMonth === 0 && !showYTD && currentAchievement !== null && (
                <div className="gauge-change neutral">
                  <span className="change-label">No previous month data</span>
                </div>
              )}
            </div>

            {/* Line Chart */}
            <div className="scorecard-trend-container">
              <h4>Monthly Trend ({selectedYear})</h4>
              <LineChart data={monthlyTrend} currentMonth={selectedMonth} onMonthSelect={setSelectedMonth} settings={settings} />
            </div>
          </div>

          {/* KPI Table - Full table */}
          <div className="scorecard-table-container">
            <h4>KPI Details</h4>
            {currentKPIs.length === 0 ? (
              <p className="text-muted">No KPIs found for this business unit.</p>
            ) : (
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th>KPI Name</th>
                    <th>Objective</th>
                    <th>Status</th>
                    <th>Weight</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Achievement</th>
                  </tr>
                </thead>
                <tbody>
                  {currentKPIs.map(kpi => {
                    const target = getKPITarget(kpi, selectedMonth);
                    const actual = getKPIActual(kpi.Code, selectedMonth);
                    const achievement = getKPIAchievement(kpi.Code, selectedMonth);
                    const cappedAchievement = getCappedAchievement(achievement);
                    const objective = (objectives || []).find(o => o.Code === kpi.Objective_Code);

                    return (
                      <tr key={kpi.Code} onClick={() => openKPIModal(kpi)} className="clickable-row">
                        <td className="kpi-name-cell">
                          <div className="kpi-name">{kpi.Name}</div>
                          <div className="kpi-code">{kpi.Code}</div>
                        </td>
                        <td className="objective-cell">{objective?.Name || '—'}</td>
                        <td className="status-cell">
                          <span className={`approval-badge ${(kpi.Approval_Status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                            {kpi.Approval_Status || '—'}
                          </span>
                        </td>
                        <td className="weight-cell">{kpi.Weight ? `${kpi.Weight}%` : '—'}</td>
                        <td className="target-cell">{target !== null ? target : '—'}</td>
                        <td className="actual-cell">{actual !== null ? actual.toFixed(0) : '—'}</td>
                        <td className={`achievement-cell ${getAchievementColor(cappedAchievement)}`}>
                          {cappedAchievement !== null ? `${cappedAchievement.toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Child BU Cards */}
          {childBUs.length > 0 && (
            <div className="scorecard-children-container">
              <h4>
                {currentBU?.Level === 'L1' ? 'Divisions' : 'Departments'}
              </h4>
              <div className="child-bu-grid">
                {childBUs.map(childBU => {
                  const childAchievement = showYTD
                    ? calculateYTDAchievement(childBU.Code)
                    : calculateBUAchievement(childBU.Code);

                  return (
                    <div
                      key={childBU.Code}
                      className={`child-bu-card ${getAchievementColor(childAchievement)}`}
                      onClick={() => handleDrillDown(childBU.Code)}
                    >
                      <div className="child-bu-name">{childBU.Name}</div>
                      <div className="child-bu-achievement">
                        {childAchievement !== null ? `${childAchievement.toFixed(0)}%` : 'No Data'}
                      </div>
                      <div className="child-bu-drill">Click to view →</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* KPI Detail Modal */}
      {selectedKPI && (
        <div className="modal-overlay" onClick={closeKPIModal}>
          <div className="modal-content kpi-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditingKPI ? 'Edit KPI' : 'KPI Details'}</h3>
              <button className="modal-close" onClick={closeKPIModal}>×</button>
            </div>

            <div className="modal-body">
              {isEditingKPI ? (
                /* Edit Form */
                <div className="kpi-edit-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Name (English)</label>
                      <input
                        type="text"
                        value={kpiEditForm.Name}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Name (Arabic)</label>
                      <input
                        type="text"
                        value={kpiEditForm.Name_AR}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Name_AR: e.target.value })}
                        dir="rtl"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Description</label>
                      <textarea
                        value={kpiEditForm.Description}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="form-group">
                      <label>Weight (%)</label>
                      <input
                        type="number"
                        value={kpiEditForm.Weight}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Weight: parseFloat(e.target.value) || 0 })}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <input
                        type="text"
                        value={kpiEditForm.Unit}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Unit: e.target.value })}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Target</label>
                      <div className="target-mode-selector">
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="kpiTargetMode"
                            value="single"
                            checked={kpiEditForm.Target_Mode === 'single'}
                            onChange={() => setKpiEditForm({ ...kpiEditForm, Target_Mode: 'single' })}
                          />
                          Same for all months
                        </label>
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="kpiTargetMode"
                            value="monthly"
                            checked={kpiEditForm.Target_Mode === 'monthly'}
                            onChange={() => setKpiEditForm({ ...kpiEditForm, Target_Mode: 'monthly' })}
                          />
                          Different per month
                        </label>
                      </div>
                      {kpiEditForm.Target_Mode === 'single' ? (
                        <input
                          type="text"
                          value={kpiEditForm.Target}
                          onChange={(e) => setKpiEditForm({ ...kpiEditForm, Target: e.target.value })}
                          placeholder="Target value for all months"
                          style={{ marginTop: '8px' }}
                        />
                      ) : (
                        <div className="monthly-targets-grid" style={{ marginTop: '8px' }}>
                          {months.map(m => (
                            <div key={m.idx} className="monthly-target-input">
                              <span className="month-label">{m.short}</span>
                              <input
                                type="text"
                                value={kpiEditForm.Monthly_Targets?.[m.idx] || ''}
                                onChange={(e) => setKpiEditForm({
                                  ...kpiEditForm,
                                  Monthly_Targets: { ...kpiEditForm.Monthly_Targets, [m.idx]: e.target.value }
                                })}
                                placeholder="—"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Polarity</label>
                      <select
                        value={kpiEditForm.Polarity}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Polarity: e.target.value })}
                      >
                        <option value="Positive">Positive (Higher is Better)</option>
                        <option value="Negative">Negative (Lower is Better)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={kpiEditForm.Approval_Status}
                        onChange={(e) => setKpiEditForm({ ...kpiEditForm, Approval_Status: e.target.value })}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={saveKPIEdits}>Save Changes</button>
                    <button className="btn btn-ghost" onClick={() => setIsEditingKPI(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* KPI Details View */
                <>
                  <div className="kpi-modal-charts">
                    {/* KPI Gauge */}
                    <div className="kpi-modal-gauge">
                      <h4>Current Achievement</h4>
                      {(() => {
                        const kpiAchievement = getCappedAchievement(getKPIAchievement(selectedKPI.Code, selectedMonth));
                        return (
                          <>
                            <GaugeChart
                              value={kpiAchievement}
                              settings={settings}
                            />
                            <div className={`gauge-value ${getAchievementColor(kpiAchievement)}`}>
                              {kpiAchievement !== null
                                ? `${kpiAchievement.toFixed(0)}%`
                                : 'No Data'}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* KPI Trend */}
                    <div className="kpi-modal-trend">
                      <h4>Monthly Trend ({selectedYear})</h4>
                      <LineChart
                        data={getKPIMonthlyTrend(selectedKPI.Code)}
                        currentMonth={selectedMonth}
                        onMonthSelect={setSelectedMonth}
                        settings={settings}
                      />
                    </div>
                  </div>

                  <div className="kpi-modal-details">
                    <h4>KPI Information</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>Code</label>
                        <span>{selectedKPI.Code}</span>
                      </div>
                      <div className="detail-item">
                        <label>Name</label>
                        <span>{selectedKPI.Name}</span>
                      </div>
                      {selectedKPI.Name_AR && (
                        <div className="detail-item">
                          <label>Name (Arabic)</label>
                          <span dir="rtl">{selectedKPI.Name_AR}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Objective</label>
                        <span>{objectives?.find(o => o.Code === selectedKPI.Objective_Code)?.Name || '—'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Weight</label>
                        <span>{selectedKPI.Weight ? `${selectedKPI.Weight}%` : '—'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Target Mode</label>
                        <span>{selectedKPI.Target_Mode === 'monthly' ? 'Monthly Targets' : 'Single Target'}</span>
                      </div>
                      {selectedKPI.Target_Mode === 'monthly' ? (
                        <div className="detail-item full-width">
                          <label>Monthly Targets ({selectedKPI.Unit || ''})</label>
                          <div className="monthly-targets-display">
                            {months.map(m => (
                              <div key={m.idx} className="monthly-target-item">
                                <span className="month-label">{m.short}</span>
                                <span className="target-value">{selectedKPI.Monthly_Targets?.[m.idx] || '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="detail-item">
                          <label>Target</label>
                          <span>{selectedKPI.Target || '—'} {selectedKPI.Unit || ''}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Actual ({months[selectedMonth]?.short})</label>
                        <span>{getKPIActual(selectedKPI.Code, selectedMonth)?.toFixed(0) || '—'} {selectedKPI.Unit || ''}</span>
                      </div>
                      <div className="detail-item">
                        <label>Polarity</label>
                        <span>{selectedKPI.Polarity || 'Positive'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Status</label>
                        <span className={`approval-badge ${(selectedKPI.Approval_Status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                          {selectedKPI.Approval_Status || 'Draft'}
                        </span>
                      </div>
                      {selectedKPI.Description && (
                        <div className="detail-item full-width">
                          <label>Description</label>
                          <span>{selectedKPI.Description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {!isEditingKPI && (
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={() => setIsEditingKPI(true)}>
                  Edit KPI
                </button>
                <button className="btn btn-ghost" onClick={closeKPIModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// GAUGE CHART COMPONENT (SVG)
// ============================================
function GaugeChart({ value, settings }) {
  // Generate unique ID for this gauge instance to avoid SVG gradient conflicts
  const gaugeId = React.useMemo(() => Math.random().toString(36).substr(2, 9), []);

  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;

  // Get thresholds and colors from settings
  const thresholdExcellent = settings?.thresholdExcellent ?? 100;
  const thresholdGood = settings?.thresholdGood ?? 80;
  const thresholdWarning = settings?.thresholdWarning ?? 60;
  const colorExcellent = settings?.colorExcellent || '#28a745';
  const colorGood = settings?.colorGood || '#ffc107';
  const colorWarning = settings?.colorWarning || '#fd7e14';
  const colorPoor = settings?.colorPoor || '#dc3545';
  // Use overachievement cap as the gauge maximum
  const gaugeMax = settings?.overachievementCap ?? 120;

  // 180 degree arc - half circle from left (270°) to right (90°/450°) through the top
  // In this coordinate system: 0° = up, 90° = right, 180° = down, 270° = left
  const startAngle = 270;
  const endAngle = 450; // 90 + 360 to go through 0 (top)
  const totalAngle = endAngle - startAngle;

  const percentage = value !== null ? Math.min(Math.max(value, 0), gaugeMax) : 0;
  const valueAngle = startAngle + (percentage / gaugeMax) * totalAngle;

  const polarToCartesian = (angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad)
    };
  };

  const describeArc = (startAng, endAng) => {
    const start = polarToCartesian(endAng);
    const end = polarToCartesian(startAng);
    const largeArcFlag = endAng - startAng <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const getColor = () => {
    if (value === null) return '#e5e7eb';
    if (value >= thresholdExcellent) return colorExcellent;
    if (value >= thresholdGood) return colorGood;
    if (value >= thresholdWarning) return colorWarning;
    return colorPoor;
  };

  // Lighten a hex color
  const lightenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  };

  // Calculate segment positions based on thresholds
  const warningPos = thresholdWarning / gaugeMax;
  const goodPos = thresholdGood / gaugeMax;
  const excellentPos = thresholdExcellent / gaugeMax;

  return (
    <svg width={size + 40} height={size * 0.75} viewBox={`-20 -5 ${size + 40} ${size * 0.75}`} className="gauge-chart">
      <defs>
        <linearGradient id={`gaugeValueGradient-${gaugeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={lightenColor(getColor(), 20)} />
          <stop offset="100%" stopColor={getColor()} />
        </linearGradient>
        <linearGradient id={`gaugeGrayGradient-${gaugeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#d1d5db" />
        </linearGradient>
        <filter id={`gaugeShadow-${gaugeId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
        </filter>
      </defs>

      {/* Background track */}
      <path
        d={describeArc(startAngle, endAngle)}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Colored segments for scale reference using custom colors */}
      <path
        d={describeArc(startAngle, startAngle + totalAngle * warningPos)}
        fill="none"
        stroke={lightenColor(colorPoor, 60)}
        strokeWidth={strokeWidth - 8}
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d={describeArc(startAngle + totalAngle * warningPos, startAngle + totalAngle * goodPos)}
        fill="none"
        stroke={lightenColor(colorWarning, 60)}
        strokeWidth={strokeWidth - 8}
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d={describeArc(startAngle + totalAngle * goodPos, startAngle + totalAngle * excellentPos)}
        fill="none"
        stroke={lightenColor(colorGood, 60)}
        strokeWidth={strokeWidth - 8}
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d={describeArc(startAngle + totalAngle * excellentPos, endAngle)}
        fill="none"
        stroke={lightenColor(colorExcellent, 60)}
        strokeWidth={strokeWidth - 8}
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Value arc */}
      {value !== null && percentage > 0 && (
        <path
          d={describeArc(startAngle, valueAngle)}
          fill="none"
          stroke={`url(#gaugeValueGradient-${gaugeId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={`url(#gaugeShadow-${gaugeId})`}
          style={{ transition: 'all 0.5s ease' }}
        />
      )}

      {/* Needle */}
      {value !== null && (() => {
        const needleLength = radius - 5;
        const needleAngleRad = (valueAngle - 90) * Math.PI / 180;
        const needleTipX = centerX + needleLength * Math.cos(needleAngleRad);
        const needleTipY = centerY + needleLength * Math.sin(needleAngleRad);
        // Create a triangular needle
        const needleWidth = 6;
        const perpAngle = needleAngleRad + Math.PI / 2;
        const baseX1 = centerX + needleWidth * Math.cos(perpAngle);
        const baseY1 = centerY + needleWidth * Math.sin(perpAngle);
        const baseX2 = centerX - needleWidth * Math.cos(perpAngle);
        const baseY2 = centerY - needleWidth * Math.sin(perpAngle);

        return (
          <g style={{ transition: 'transform 0.5s ease' }}>
            <polygon
              points={`${needleTipX},${needleTipY} ${baseX1},${baseY1} ${baseX2},${baseY2}`}
              fill={getColor()}
              filter={`url(#gaugeShadow-${gaugeId})`}
            />
          </g>
        );
      })()}

      {/* Center circle */}
      <circle cx={centerX} cy={centerY} r="10" fill={getColor()} filter={`url(#gaugeShadow-${gaugeId})`} />
      <circle cx={centerX} cy={centerY} r="5" fill="white" />

      {/* Scale labels - show 100% and max cap (if different) */}
      {[...new Set([100, ...(gaugeMax > 100 ? [gaugeMax] : [])])].map((tick, idx) => {
        const tickAngle = startAngle + (tick / gaugeMax) * totalAngle;
        const labelRadius = radius + 22;
        const labelX = centerX + labelRadius * Math.cos((tickAngle - 90) * Math.PI / 180);
        const labelY = centerY + labelRadius * Math.sin((tickAngle - 90) * Math.PI / 180);
        return (
          <text
            key={`tick-${idx}-${tick}`}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={11}
            fill={tick === gaugeMax && gaugeMax > 100 ? '#4472C4' : '#6b7280'}
            fontWeight="600"
          >
            {tick}%
          </text>
        );
      })}
    </svg>
  );
}

// ============================================
// LINE CHART COMPONENT (SVG)
// ============================================
function LineChart({ data, currentMonth, onMonthSelect, settings }) {
  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 30, left: 45 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get overachievement cap from settings
  const overachievementCap = settings?.overachievementCap ?? 120;

  // Calculate scales - max Y is 1.1 * cap to prevent cropping at the top
  const maxValue = overachievementCap * 1.1;
  const minValue = 0;

  const xScale = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v) => padding.top + chartHeight - ((v - minValue) / (maxValue - minValue)) * chartHeight;

  // Build path
  const validPoints = data.map((d, i) => ({
    x: xScale(i),
    y: d.achievement !== null ? yScale(d.achievement) : null,
    value: d.achievement
  }));

  const pathD = validPoints
    .filter(p => p.y !== null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Y-axis labels: 50%, 100%, and cap (if different from 100%)
  const yAxisLabels = [50, 100];
  if (overachievementCap !== 100 && !yAxisLabels.includes(overachievementCap)) {
    yAxisLabels.push(overachievementCap);
  }
  yAxisLabels.sort((a, b) => a - b);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="line-chart">
      {/* Grid lines - show at 50%, 100%, and cap */}
      {yAxisLabels.map(v => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={yScale(v)}
            x2={width - padding.right}
            y2={yScale(v)}
            stroke={v === overachievementCap && v !== 100 ? '#4472C4' : '#e5e7eb'}
            strokeWidth={v === overachievementCap && v !== 100 ? 1.5 : 1}
            strokeDasharray="0"
          />
          <text
            x={padding.left - 5}
            y={yScale(v)}
            textAnchor="end"
            alignmentBaseline="middle"
            fontSize={10}
            fill={v === overachievementCap && v !== 100 ? '#4472C4' : '#6b7280'}
            fontWeight={v === overachievementCap && v !== 100 ? '600' : 'normal'}
          >
            {v}%
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={xScale(i)}
          y={height - 10}
          textAnchor="middle"
          fontSize={10}
          fill={i === currentMonth ? '#4472C4' : '#6b7280'}
          fontWeight={i === currentMonth ? 'bold' : 'normal'}
        >
          {d.month}
        </text>
      ))}

      {/* Line */}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="#4472C4"
          strokeWidth={2}
        />
      )}

      {/* Points */}
      {validPoints.map((p, i) => (
        p.y !== null && (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={i === currentMonth ? 6 : 4}
              fill={i === currentMonth ? '#4472C4' : '#fff'}
              stroke="#4472C4"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={() => onMonthSelect && onMonthSelect(i)}
            />
            {/* Larger invisible hit area */}
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onMonthSelect && onMonthSelect(i)}
            />
          </g>
        )
      ))}
    </svg>
  );
}

export default ScorecardTab;
