import React, { useState, useCallback, useEffect } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

function EmployeeScorecardView() {
  const {
    businessUnits,
    teamMembers,
    personalObjectives,
    employeeKpis,
    employeeAchievements,
    updateEmployeeAchievements,
    settings
  } = useStrategy();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedBU, setSelectedBU] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showDataEntry, setShowDataEntry] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Get active BUs
  const activeBUs = (businessUnits || []).filter(bu => bu.Status === 'Active');

  // Get employees for selected BU, filtered by search query
  const buEmployees = (teamMembers || []).filter(m => {
    if (m.Status !== 'Active') return false;
    if (selectedBU && m.Business_Unit_Code !== selectedBU) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = m.Name?.toLowerCase().includes(query);
      const matchesNameAR = m.Name_AR?.includes(searchQuery);
      const matchesID = m.Employee_ID?.toLowerCase().includes(query);
      return matchesName || matchesNameAR || matchesID;
    }
    return true;
  });

  // Auto-select first employee when list changes (but not BU - allow "All Units")
  useEffect(() => {
    if (buEmployees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(buEmployees[0].Code);
    } else if (selectedEmployee && !buEmployees.find(e => e.Code === selectedEmployee)) {
      setSelectedEmployee(buEmployees.length > 0 ? buEmployees[0].Code : '');
    }
  }, [buEmployees]);

  // Get month key
  const getMonthKey = useCallback((monthIdx, year = selectedYear) => {
    return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  }, [selectedYear]);

  // Get employee objectives
  const getEmployeeObjectives = useCallback((empCode) => {
    return (personalObjectives || []).filter(obj => obj.Employee_Code === empCode && obj.Status === 'Active');
  }, [personalObjectives]);

  // Get KPIs for employee
  const getEmployeeKPIs = useCallback((empCode) => {
    return (employeeKpis || []).filter(kpi => kpi.Employee_Code === empCode && kpi.Status === 'Active');
  }, [employeeKpis]);

  // Get KPIs by objective
  const getKPIsByObjective = useCallback((objCode) => {
    return (employeeKpis || []).filter(kpi => kpi.Personal_Objective_Code === objCode && kpi.Status === 'Active');
  }, [employeeKpis]);

  // Get achievement value for a KPI at a specific month
  const getKPIAchievement = useCallback((kpiCode, monthIdx) => {
    const monthKey = getMonthKey(monthIdx);
    return employeeAchievements?.[kpiCode]?.[monthKey]?.achievement ?? null;
  }, [employeeAchievements, selectedYear]);

  // Get actual value for a KPI at a specific month
  const getKPIActual = useCallback((kpiCode, monthIdx) => {
    const monthKey = getMonthKey(monthIdx);
    return employeeAchievements?.[kpiCode]?.[monthKey]?.actual ?? null;
  }, [employeeAchievements, selectedYear]);

  // Get target for a KPI at a specific month
  const getKPITarget = useCallback((kpi, monthIdx) => {
    if (!kpi) return null;
    if (kpi.Target_Mode === 'monthly' && kpi.Monthly_Targets?.[monthIdx]) {
      return parseFloat(kpi.Monthly_Targets[monthIdx]);
    }
    return kpi.Target ? parseFloat(kpi.Target) : null;
  }, []);

  // Get the employee achievement cap from settings
  const achievementCap = settings?.employeeOverachievementCap ?? 200;

  // Calculate achievement percentage
  const calculateAchievement = useCallback((actual, target, polarity) => {
    if (actual === null || actual === undefined || !target) return null;
    const actualNum = parseFloat(actual);
    const targetNum = parseFloat(target);
    if (isNaN(actualNum) || isNaN(targetNum) || targetNum === 0) return null;

    let achievement;
    if (polarity === 'Negative') {
      // Lower is better - if actual is 0 or very small, cap at achievementCap
      if (actualNum <= 0 || Math.abs(actualNum) < 0.0001) return achievementCap;
      achievement = (targetNum / actualNum) * 100;
    } else {
      achievement = (actualNum / targetNum) * 100;
    }

    // Handle infinity, NaN, and cap at achievementCap
    if (!isFinite(achievement) || isNaN(achievement)) return achievementCap;
    return Math.min(Math.max(achievement, 0), achievementCap);
  }, [achievementCap]);

  // Get capped achievement value
  const getCappedAchievement = useCallback((achievement) => {
    if (achievement === null || achievement === undefined) return null;
    const achievementCap = settings?.overachievementCap ?? 120;
    return Math.min(achievement, achievementCap);
  }, [settings]);

  // Calculate weighted achievement for an objective
  const calculateObjectiveAchievement = useCallback((objCode, monthIdx = selectedMonth) => {
    const objKPIs = getKPIsByObjective(objCode);
    if (objKPIs.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    objKPIs.forEach(kpi => {
      const weight = parseFloat(kpi.Weight) || 0;
      const achievement = getKPIAchievement(kpi.Code, monthIdx);

      if (achievement !== null && weight > 0) {
        const cappedAchievement = getCappedAchievement(achievement);
        weightedSum += weight * cappedAchievement;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
  }, [getKPIsByObjective, getKPIAchievement, getCappedAchievement, selectedMonth]);

  // Calculate overall employee achievement
  const calculateEmployeeAchievement = useCallback((empCode, monthIdx = selectedMonth) => {
    const empKPIs = getEmployeeKPIs(empCode);
    if (empKPIs.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    empKPIs.forEach(kpi => {
      const weight = parseFloat(kpi.Weight) || 0;
      const achievement = getKPIAchievement(kpi.Code, monthIdx);

      if (achievement !== null && weight > 0) {
        const cappedAchievement = getCappedAchievement(achievement);
        weightedSum += weight * cappedAchievement;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
  }, [getEmployeeKPIs, getKPIAchievement, getCappedAchievement, selectedMonth]);

  // Get achievement color
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

  // Get achievement style with custom colors
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

    // Calculate contrast color
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const textColor = luminance > 0.5 ? '#000000' : '#ffffff';

    return { backgroundColor: bgColor, color: textColor };
  };

  // Save actual value for a KPI
  const saveActualValue = useCallback((kpiCode, monthIdx, value) => {
    console.log('saveActualValue called:', { kpiCode, monthIdx, value });
    const kpi = employeeKpis.find(k => k.Code === kpiCode);
    if (!kpi) {
      console.log('KPI not found');
      return;
    }

    const monthKey = getMonthKey(monthIdx);
    const actual = value === '' ? null : parseFloat(value);
    const target = getKPITarget(kpi, monthIdx);

    // Calculate achievement using the cap
    const cap = settings?.employeeOverachievementCap ?? 200;
    let achievement = null;

    if (actual !== null && target !== null && target !== 0) {
      const actualNum = parseFloat(actual);
      const targetNum = parseFloat(target);

      if (!isNaN(actualNum) && !isNaN(targetNum) && targetNum !== 0) {
        if (kpi.Polarity === 'Negative') {
          if (actualNum <= 0 || Math.abs(actualNum) < 0.0001) {
            achievement = cap;
          } else {
            achievement = (targetNum / actualNum) * 100;
          }
        } else {
          achievement = (actualNum / targetNum) * 100;
        }

        // Handle infinity and cap
        if (!isFinite(achievement) || isNaN(achievement)) {
          achievement = cap;
        } else {
          achievement = Math.min(Math.max(achievement, 0), cap);
        }
      }
    }

    console.log('Calculated:', { actual, target, achievement, cap });

    const newAchievements = {
      ...employeeAchievements,
      [kpiCode]: {
        ...(employeeAchievements?.[kpiCode] || {}),
        [monthKey]: {
          actual,
          achievement
        }
      }
    };

    console.log('Updating achievements:', newAchievements);
    updateEmployeeAchievements(newAchievements);
  }, [employeeKpis, employeeAchievements, settings, getMonthKey, getKPITarget, updateEmployeeAchievements]);

  // Get selected employee data
  const employee = selectedEmployee ? teamMembers.find(m => m.Code === selectedEmployee) : null;
  const employeeObjectives = selectedEmployee ? getEmployeeObjectives(selectedEmployee) : [];
  const allEmployeeKPIs = selectedEmployee ? getEmployeeKPIs(selectedEmployee) : [];
  const overallAchievement = selectedEmployee ? calculateEmployeeAchievement(selectedEmployee) : null;

  // Get monthly trend data for line chart
  const getMonthlyTrend = useCallback((empCode) => {
    return months.map(m => {
      const achievement = calculateEmployeeAchievement(empCode, m.idx);
      return {
        month: m.short,
        monthIdx: m.idx,
        achievement
      };
    });
  }, [months, calculateEmployeeAchievement]);

  const monthlyTrend = selectedEmployee ? getMonthlyTrend(selectedEmployee) : [];

  return (
    <div className="employee-scorecard-view">
      <div className="scorecard-header">
        <h2>Employee Scorecard</h2>
        <p className="section-description">
          Track individual employee performance against their personal objectives and KPIs
        </p>
      </div>

      {/* Filters */}
      <div className="scorecard-filters">
        <div className="filter-row">
          <div className="filter-group search-group">
            <label>Search Employee</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedEmployee('');
              }}
              placeholder="Search by name or ID..."
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <label>Business Unit</label>
            <select
              value={selectedBU}
              onChange={(e) => {
                setSelectedBU(e.target.value);
                setSelectedEmployee('');
              }}
            >
              <option value="">All Units</option>
              {activeBUs.map(bu => (
                <option key={bu.Code} value={bu.Code}>
                  [{bu.Level}] {bu.Name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Employee ({buEmployees.length})</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">Select Employee...</option>
              {buEmployees.map(emp => (
                <option key={emp.Code} value={emp.Code}>
                  {emp.Employee_ID ? `[${emp.Employee_ID}] ` : ''}{emp.Name} - {emp.Job_Title || 'No Title'}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map(m => (
                <option key={m.idx} value={m.idx}>{m.full}</option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button
              className={`btn btn-sm ${showDataEntry ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowDataEntry(!showDataEntry)}
            >
              {showDataEntry ? 'Hide Data Entry' : 'Enter Data'}
            </button>
          </div>
        </div>
      </div>

      {!employee ? (
        <div className="no-selection-state">
          <p>Select an employee to view their scorecard</p>
        </div>
      ) : (
        <div className="scorecard-content">
          {/* Employee Summary Card */}
          <div className="employee-summary-card">
            <div className="summary-left">
              <div className="summary-avatar">
                {employee.Photo_URL ? (
                  <img src={employee.Photo_URL} alt={employee.Name} />
                ) : (
                  <span>{employee.Name?.charAt(0) || '?'}</span>
                )}
              </div>
              <div className="summary-info">
                <h3>{employee.Name}</h3>
                <p className="job-title">{employee.Job_Title || 'No Title'}</p>
                <p className="bu-name">
                  {businessUnits.find(b => b.Code === employee.Business_Unit_Code)?.Name || 'Unassigned'}
                </p>
              </div>
            </div>
            {/* Monthly Achievement Trend - Minimalistic */}
            {allEmployeeKPIs.length > 0 && (
              <div className="summary-chart">
                <MiniLineChart
                  data={monthlyTrend}
                  currentMonth={selectedMonth}
                  settings={settings}
                  onMonthSelect={setSelectedMonth}
                />
              </div>
            )}
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-value">{employeeObjectives.length}</span>
                <span className="stat-label">Objectives</span>
              </div>
              <div className="stat">
                <span className="stat-value">{allEmployeeKPIs.length}</span>
                <span className="stat-label">KPIs</span>
              </div>
              <div className="stat overall-achievement">
                <span
                  className="stat-value achievement-badge"
                  style={getAchievementStyle(overallAchievement)}
                >
                  {overallAchievement !== null ? `${overallAchievement.toFixed(1)}%` : '-'}
                </span>
                <span className="stat-label">Overall</span>
              </div>
            </div>
          </div>

          {/* Objectives and KPIs */}
          {employeeObjectives.length === 0 && allEmployeeKPIs.length === 0 ? (
            <div className="empty-state">
              <p>No objectives or KPIs defined for this employee.</p>
              <p className="hint">Go to Team Members tab to add personal objectives and KPIs.</p>
            </div>
          ) : (
            <div className="objectives-scorecard">
              {employeeObjectives.map(obj => {
                const objKPIs = getKPIsByObjective(obj.Code);
                const objAchievement = calculateObjectiveAchievement(obj.Code);

                return (
                  <div key={obj.Code} className="objective-scorecard-card">
                    <div className="objective-header">
                      <div className="objective-info">
                        <h4>{obj.Name}</h4>
                        {obj.Description && <p className="desc">{obj.Description}</p>}
                      </div>
                      <div className="objective-stats">
                        <span className="weight-badge">{obj.Weight}% weight</span>
                        <span
                          className="achievement-badge"
                          style={getAchievementStyle(objAchievement)}
                        >
                          {objAchievement !== null ? `${objAchievement.toFixed(1)}%` : '-'}
                        </span>
                      </div>
                    </div>

                    {objKPIs.length > 0 && (
                      <div className="kpi-table">
                        <table>
                          <thead>
                            <tr>
                              <th>KPI</th>
                              <th>Weight</th>
                              <th>Target</th>
                              <th>Actual</th>
                              <th>Achievement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {objKPIs.map(kpi => {
                              const target = getKPITarget(kpi, selectedMonth);
                              const actual = getKPIActual(kpi.Code, selectedMonth);
                              const achievement = getKPIAchievement(kpi.Code, selectedMonth);

                              return (
                                <tr key={kpi.Code}>
                                  <td className="kpi-name-cell">
                                    <span className="kpi-name">{kpi.Name}</span>
                                    <span className="kpi-unit">{kpi.Unit}</span>
                                  </td>
                                  <td className="weight-cell">{kpi.Weight}%</td>
                                  <td className="target-cell">
                                    {target !== null ? target.toLocaleString() : '-'}
                                  </td>
                                  <td className="actual-cell">
                                    {showDataEntry ? (
                                      <input
                                        type="number"
                                        value={actual ?? ''}
                                        onChange={(e) => saveActualValue(kpi.Code, selectedMonth, e.target.value)}
                                        placeholder="Enter value"
                                      />
                                    ) : (
                                      actual !== null ? actual.toLocaleString() : '-'
                                    )}
                                  </td>
                                  <td className="achievement-cell">
                                    <span
                                      className={`achievement-value ${getAchievementColor(achievement)}`}
                                      style={getAchievementStyle(achievement)}
                                    >
                                      {achievement !== null ? `${achievement.toFixed(1)}%` : '-'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {objKPIs.length === 0 && (
                      <p className="no-kpis">No KPIs linked to this objective</p>
                    )}
                  </div>
                );
              })}

              {/* Unlinked KPIs */}
              {(() => {
                const unlinkedKPIs = allEmployeeKPIs.filter(kpi => !kpi.Personal_Objective_Code);
                if (unlinkedKPIs.length === 0) return null;

                return (
                  <div className="objective-scorecard-card unlinked">
                    <div className="objective-header">
                      <div className="objective-info">
                        <h4>Other KPIs</h4>
                        <p className="desc">KPIs not linked to any objective</p>
                      </div>
                    </div>

                    <div className="kpi-table">
                      <table>
                        <thead>
                          <tr>
                            <th>KPI</th>
                            <th>Weight</th>
                            <th>Target</th>
                            <th>Actual</th>
                            <th>Achievement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unlinkedKPIs.map(kpi => {
                            const target = getKPITarget(kpi, selectedMonth);
                            const actual = getKPIActual(kpi.Code, selectedMonth);
                            const achievement = getKPIAchievement(kpi.Code, selectedMonth);

                            return (
                              <tr key={kpi.Code}>
                                <td className="kpi-name-cell">
                                  <span className="kpi-name">{kpi.Name}</span>
                                  <span className="kpi-unit">{kpi.Unit}</span>
                                </td>
                                <td className="weight-cell">{kpi.Weight}%</td>
                                <td className="target-cell">
                                  {target !== null ? target.toLocaleString() : '-'}
                                </td>
                                <td className="actual-cell">
                                  {showDataEntry ? (
                                    <input
                                      type="number"
                                      value={actual ?? ''}
                                      onChange={(e) => saveActualValue(kpi.Code, selectedMonth, e.target.value)}
                                      placeholder="Enter value"
                                    />
                                  ) : (
                                    actual !== null ? actual.toLocaleString() : '-'
                                  )}
                                </td>
                                <td className="achievement-cell">
                                  <span
                                    className={`achievement-value ${getAchievementColor(achievement)}`}
                                    style={getAchievementStyle(achievement)}
                                  >
                                    {achievement !== null ? `${achievement.toFixed(1)}%` : '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MINI LINE CHART COMPONENT (SVG) - Minimalistic with hover tooltips
// ============================================
function MiniLineChart({ data, currentMonth, settings, onMonthSelect }) {
  const [hoveredPoint, setHoveredPoint] = React.useState(null);

  const width = 400;
  const height = 80;
  const padding = { top: 15, right: 15, bottom: 20, left: 15 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxValue = Math.max(120, ...data.map(d => d.achievement || 0));
  const minValue = 0;

  const xScale = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v) => padding.top + chartHeight - ((v - minValue) / (maxValue - minValue)) * chartHeight;

  // Build path
  const validPoints = data.map((d, i) => ({
    x: xScale(i),
    y: d.achievement !== null ? yScale(d.achievement) : null,
    value: d.achievement,
    month: d.month,
    monthIdx: d.monthIdx
  }));

  const pathD = validPoints
    .filter(p => p.y !== null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Get color based on achievement
  const getPointColor = (achievement) => {
    if (achievement === null) return '#9ca3af';
    const thresholdExcellent = settings?.thresholdExcellent ?? 100;
    const thresholdGood = settings?.thresholdGood ?? 80;
    const thresholdWarning = settings?.thresholdWarning ?? 60;

    if (achievement >= thresholdExcellent) return settings?.colorExcellent || '#28a745';
    if (achievement >= thresholdGood) return settings?.colorGood || '#ffc107';
    if (achievement >= thresholdWarning) return settings?.colorWarning || '#fd7e14';
    return settings?.colorPoor || '#dc3545';
  };

  return (
    <div className="mini-line-chart-container">
      <svg width={width} height={height} className="mini-line-chart">
        {/* Subtle baseline at 100% */}
        <line
          x1={padding.left}
          y1={yScale(100)}
          x2={width - padding.right}
          y2={yScale(100)}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="4"
        />

        {/* Line gradient */}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4472C4" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#4472C4" stopOpacity="1" />
            <stop offset="100%" stopColor="#4472C4" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth={2}
          />
        )}

        {/* Points - only visible on hover or current month */}
        {validPoints.map((p, i) => (
          p.y !== null && (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredPoint === i || i === currentMonth ? 6 : 3}
                fill={i === currentMonth ? getPointColor(p.value) : (hoveredPoint === i ? getPointColor(p.value) : '#fff')}
                stroke={getPointColor(p.value)}
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => onMonthSelect && onMonthSelect(p.monthIdx)}
              />
              {/* Invisible larger hit area for better hover and click */}
              <circle
                cx={p.x}
                cy={p.y}
                r={12}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => onMonthSelect && onMonthSelect(p.monthIdx)}
              />
            </g>
          )
        ))}

        {/* Month labels - fixed positions: Jan, Jun, Dec */}
        {validPoints.map((p, i) => (
          (i === 0 || i === 5 || i === 11) && (
            <text
              key={`label-${i}`}
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {p.month}
            </text>
          )
        ))}

        {/* Tooltip on hover */}
        {hoveredPoint !== null && validPoints[hoveredPoint]?.y !== null && (
          <g>
            <rect
              x={validPoints[hoveredPoint].x - 28}
              y={validPoints[hoveredPoint].y - 28}
              width={56}
              height={22}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text
              x={validPoints[hoveredPoint].x}
              y={validPoints[hoveredPoint].y - 14}
              textAnchor="middle"
              fontSize={11}
              fill="#fff"
              fontWeight="500"
            >
              {validPoints[hoveredPoint].month}: {validPoints[hoveredPoint].value?.toFixed(1)}%
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default EmployeeScorecardView;
