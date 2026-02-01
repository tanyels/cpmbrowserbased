import React, { useMemo, useState } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';
import { useLicense } from '../../contexts/LicenseContext';
import { AlertTriangle } from 'lucide-react';

function DashboardTab() {
  const {
    vision,
    mission,
    pillars,
    perspectives,
    objectives,
    businessUnits,
    kpis,
    getStats,
    exportReport
  } = useStrategy();
  const { getCompanyInfo } = useLicense();

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  const stats = useMemo(() => getStats(), [getStats]);
  const companyInfo = getCompanyInfo();

  // Calculate pillar coverage with cascade breakdown and KPI status
  const pillarCoverage = useMemo(() => {
    return pillars.filter(p => p.Status === 'Active').map(pillar => {
      // Get all objectives linked to this pillar (L1 direct, L2/L3 through parent chain)
      const l1Objectives = objectives.filter(
        obj => obj.Pillar_Code === pillar.Code && obj.Level === 'L1' && !obj.Is_Operational
      );

      // Get L2 objectives that are children of L1 objectives in this pillar
      const l1Codes = l1Objectives.map(o => o.Code);
      const l2Objectives = objectives.filter(
        obj => obj.Level === 'L2' && l1Codes.includes(obj.Parent_Objective_Code) && !obj.Is_Operational
      );

      // Get L3 objectives that are children of L2 objectives
      const l2Codes = l2Objectives.map(o => o.Code);
      const l3Objectives = objectives.filter(
        obj => obj.Level === 'L3' && l2Codes.includes(obj.Parent_Objective_Code) && !obj.Is_Operational
      );

      // Get L3 codes
      const l3Codes = l3Objectives.map(o => o.Code);

      // Get KPIs per level
      const l1KPIs = kpis.filter(kpi => l1Codes.includes(kpi.Objective_Code));
      const l2KPIs = kpis.filter(kpi => l2Codes.includes(kpi.Objective_Code));
      const l3KPIs = kpis.filter(kpi => l3Codes.includes(kpi.Objective_Code));

      // All KPIs in this pillar
      const allPillarKPIs = [...l1KPIs, ...l2KPIs, ...l3KPIs];

      // KPI approval status breakdown
      const kpiApproved = allPillarKPIs.filter(k => k.Approval_Status === 'Locked').length;
      const kpiPending = allPillarKPIs.filter(k => k.Approval_Status === 'Recommended' || !k.Approval_Status).length;
      const kpiDiscussion = allPillarKPIs.filter(k => k.Approval_Status === 'Under Discussion').length;

      return {
        ...pillar,
        l1Count: l1Objectives.length,
        l2Count: l2Objectives.length,
        l3Count: l3Objectives.length,
        l1KpiCount: l1KPIs.length,
        l2KpiCount: l2KPIs.length,
        l3KpiCount: l3KPIs.length,
        kpiCount: allPillarKPIs.length,
        kpiApproved,
        kpiPending,
        kpiDiscussion
      };
    });
  }, [pillars, objectives, kpis]);

  // Calculate BU coverage by level
  const buCoverage = useMemo(() => {
    const levels = ['L1', 'L2', 'L3'];
    return levels.map(level => {
      const levelBUs = businessUnits.filter(bu => bu.Level === level && bu.Status === 'Active');
      const levelObjectives = objectives.filter(obj => obj.Level === level && obj.Status === 'Active' && !obj.Is_Operational);
      const levelKPIs = kpis.filter(kpi => {
        const obj = objectives.find(o => o.Code === kpi.Objective_Code);
        return obj && obj.Level === level;
      });
      return {
        level,
        buCount: levelBUs.length,
        objectiveCount: levelObjectives.length,
        kpiCount: levelKPIs.length,
        avgObjectivesPerBU: levelBUs.length > 0 ? (levelObjectives.length / levelBUs.length).toFixed(0) : 0,
        avgKPIsPerBU: levelBUs.length > 0 ? (levelKPIs.length / levelBUs.length).toFixed(0) : 0
      };
    });
  }, [businessUnits, objectives, kpis]);

  // KPI Approval status summary
  const kpiApprovalSummary = useMemo(() => {
    return {
      total: kpis.length,
      recommended: kpis.filter(k => k.Approval_Status === 'Recommended' || !k.Approval_Status).length,
      underDiscussion: kpis.filter(k => k.Approval_Status === 'Under Discussion').length,
      locked: kpis.filter(k => k.Approval_Status === 'Locked').length
    };
  }, [kpis]);

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const result = await exportReport();
      if (result.success) {
        setExportMessage({ type: 'success', text: 'Report exported successfully!' });
      } else if (!result.cancelled) {
        setExportMessage({ type: 'error', text: result.error || 'Export failed' });
      }
    } catch (error) {
      setExportMessage({ type: 'error', text: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="dashboard-tab">
      {/* Company Branding Banner */}
      {companyInfo?.name && (
        <div className="company-branding-banner">
          {companyInfo.logo && (
            <img
              src={companyInfo.logo}
              alt={companyInfo.name}
              className="company-logo-banner"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <div className="company-info-banner">
            <h1 className="company-name-banner">{companyInfo.name}</h1>
            <p className="company-subtitle-banner">Strategy Cascade & Performance Management</p>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <div>
          <h2>Strategy Dashboard</h2>
          <p className="section-description">Overview of your strategy cascade structure and KPI coverage</p>
        </div>
        <div className="dashboard-actions">
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export Full Report'}
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className={`message ${exportMessage.type}`}>
          {exportMessage.text}
        </div>
      )}

      {/* Vision & Mission Summary */}
      <div className="dashboard-section">
        <h3>Vision & Mission</h3>
        <div className="vision-mission-cards">
          <div className="vm-card">
            <h4>Vision</h4>
            <p>{vision?.Statement || <em className="empty">Not defined</em>}</p>
          </div>
          <div className="vm-card">
            <h4>Mission</h4>
            <p>{mission?.Statement || <em className="empty">Not defined</em>}</p>
          </div>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="dashboard-section">
        <h3>Key Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value primary">{pillars.filter(p => p.Status === 'Active').length}</div>
            <div className="stat-label">Strategic Pillars</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalBusinessUnits}</div>
            <div className="stat-label">Business Units</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalObjectives}</div>
            <div className="stat-label">Objectives</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalKPIs}</div>
            <div className="stat-label">Active KPIs</div>
          </div>
        </div>
      </div>

      {/* Pillar Coverage */}
      <div className="dashboard-section">
        <h3>Strategic Pillar Coverage</h3>
        <div className="pillar-coverage-grid">
          {pillarCoverage.length === 0 ? (
            <p className="empty-message">No strategic pillars defined yet.</p>
          ) : (
            pillarCoverage.map(pillar => (
              <div key={pillar.Code} className="pillar-coverage-card">
                <div className="pillar-header">
                  <span className="pillar-name">{pillar.Name}</span>
                  <span className="pillar-weight">{pillar.Weight}%</span>
                </div>

                {/* Level Breakdown Rows */}
                <div className="level-rows">
                  <div className="level-row">
                    <span className="level-badge l1">L1</span>
                    <span className="level-stats">{pillar.l1Count} Objectives</span>
                    <span className="level-separator">•</span>
                    <span className="level-stats">{pillar.l1KpiCount} KPIs</span>
                  </div>
                  <div className="level-row">
                    <span className="level-badge l2">L2</span>
                    <span className="level-stats">{pillar.l2Count} Objectives</span>
                    <span className="level-separator">•</span>
                    <span className="level-stats">{pillar.l2KpiCount} KPIs</span>
                  </div>
                  <div className="level-row">
                    <span className="level-badge l3">L3</span>
                    <span className="level-stats">{pillar.l3Count} Objectives</span>
                    <span className="level-separator">•</span>
                    <span className="level-stats">{pillar.l3KpiCount} KPIs</span>
                  </div>
                </div>

                {/* KPI Approval Status */}
                {pillar.kpiCount > 0 && (
                  <div className="kpi-status-row">
                    <span className="kpi-status-item approved">
                      <span className="status-dot"></span>
                      {pillar.kpiApproved} Approved
                    </span>
                    <span className="kpi-status-item pending">
                      <span className="status-dot"></span>
                      {pillar.kpiPending} Pending
                    </span>
                    <span className="kpi-status-item discussion">
                      <span className="status-dot"></span>
                      {pillar.kpiDiscussion} Discussion
                    </span>
                  </div>
                )}

                {pillar.kpiCount === 0 && (
                  <div className="no-kpis-message">No KPIs assigned</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Level Breakdown */}
      <div className="dashboard-section">
        <h3>Cascade Breakdown by Level</h3>
        <div className="level-breakdown">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Business Units</th>
                <th>Objectives</th>
                <th>KPIs</th>
                <th>Avg Obj/BU</th>
                <th>Avg KPI/BU</th>
              </tr>
            </thead>
            <tbody>
              {buCoverage.map(row => (
                <tr key={row.level}>
                  <td>
                    <span className={`level-badge ${row.level.toLowerCase()}`}>{row.level}</span>
                    <span className="level-name">
                      {row.level === 'L1' ? 'Corporate' : row.level === 'L2' ? 'Division' : 'Department'}
                    </span>
                  </td>
                  <td>{row.buCount}</td>
                  <td>{row.objectiveCount}</td>
                  <td>{row.kpiCount}</td>
                  <td>{row.avgObjectivesPerBU}</td>
                  <td>{row.avgKPIsPerBU}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td><strong>{stats.totalBusinessUnits}</strong></td>
                <td><strong>{stats.totalObjectives}</strong></td>
                <td><strong>{stats.totalKPIs}</strong></td>
                <td>-</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Approval Status */}
      <div className="dashboard-section">
        <h3>KPI Approval Status</h3>
        <div className="review-status-grid">
          <div className="review-card total">
            <div className="review-count">{kpiApprovalSummary.total}</div>
            <div className="review-label">Total KPIs</div>
          </div>
          <div className="review-card recommended">
            <div className="review-count">{kpiApprovalSummary.recommended}</div>
            <div className="review-label">Recommended</div>
          </div>
          <div className="review-card under-discussion">
            <div className="review-count">{kpiApprovalSummary.underDiscussion}</div>
            <div className="review-label">Under Discussion</div>
          </div>
          <div className="review-card locked">
            <div className="review-count">{kpiApprovalSummary.locked}</div>
            <div className="review-label">Locked (Approved)</div>
          </div>
        </div>
        {kpiApprovalSummary.total > 0 && (
          <div className="review-progress">
            <div className="progress-bar-container">
              <div
                className="progress-segment locked"
                style={{ width: `${(kpiApprovalSummary.locked / kpiApprovalSummary.total) * 100}%` }}
                title={`Locked: ${kpiApprovalSummary.locked}`}
              />
              <div
                className="progress-segment under-discussion"
                style={{ width: `${(kpiApprovalSummary.underDiscussion / kpiApprovalSummary.total) * 100}%` }}
                title={`Under Discussion: ${kpiApprovalSummary.underDiscussion}`}
              />
              <div
                className="progress-segment recommended"
                style={{ width: `${(kpiApprovalSummary.recommended / kpiApprovalSummary.total) * 100}%` }}
                title={`Recommended: ${kpiApprovalSummary.recommended}`}
              />
            </div>
            <div className="progress-legend">
              <span className="legend-item locked">Locked</span>
              <span className="legend-item under-discussion">Under Discussion</span>
              <span className="legend-item recommended">Recommended</span>
            </div>
          </div>
        )}
      </div>

      {/* Warnings & Alerts */}
      {(stats.orphanedKPIs > 0 || pillarCoverage.some(p => p.objectiveCount === 0)) && (
        <div className="dashboard-section">
          <h3>Warnings</h3>
          <div className="warnings-list">
            {stats.orphanedKPIs > 0 && (
              <div className="warning-item">
                <span className="warning-icon"><AlertTriangle size={16} /></span>
                <span className="warning-text">
                  {stats.orphanedKPIs} KPI(s) are orphaned (linked to archived objectives)
                </span>
              </div>
            )}
            {pillarCoverage.filter(p => p.objectiveCount === 0).map(pillar => (
              <div key={pillar.Code} className="warning-item">
                <span className="warning-icon"><AlertTriangle size={16} /></span>
                <span className="warning-text">
                  Pillar "{pillar.Name}" has no objectives assigned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardTab;
