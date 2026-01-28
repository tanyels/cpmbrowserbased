import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKPI } from '../contexts/KPIContext';

function DepartmentKPIList() {
  const { departmentName } = useParams();
  const navigate = useNavigate();
  const { getKPIsByDepartment, hasUnsavedChanges, isSaving, saveChanges } = useKPI();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');

  const decodedDeptName = decodeURIComponent(departmentName);
  const allKPIs = getKPIsByDepartment(decodedDeptName);

  const filteredKPIs = useMemo(() => {
    return allKPIs.filter(kpi => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const kpiCode = (kpi['KPI Code'] || kpi['KPI ID'] || '').toLowerCase();
        const kpiName = (kpi['KPI Name (English)'] || kpi['KPI Name'] || '').toLowerCase();
        const kpiNameAr = (kpi['KPI Name (Arabic)'] || '').toLowerCase();
        const desc = (kpi['KPI Description (English)'] || kpi.Description || '').toLowerCase();

        const matchesSearch = kpiCode.includes(query) ||
          kpiName.includes(query) ||
          kpiNameAr.includes(query) ||
          desc.includes(query);

        if (!matchesSearch) return false;
      }

      // KPI Status filter (based on Active/Inactive)
      // 1 = Measured, 2 = NEW KPI, 0/other = Inactive
      if (statusFilter !== 'all') {
        const activeValue = kpi['Active/Inactive'];
        let derivedStatus = 'Inactive';
        if (activeValue === 2 || activeValue === '2') derivedStatus = 'NEW KPI';
        else if (activeValue === 1 || activeValue === '1' || activeValue === true) derivedStatus = 'Measured';
        if (derivedStatus !== statusFilter) return false;
      }

      // Review status filter
      if (reviewFilter !== 'all') {
        if (kpi.reviewStatus !== reviewFilter) return false;
      }

      return true;
    });
  }, [allKPIs, searchQuery, statusFilter, reviewFilter]);

  const reviewedCount = allKPIs.filter(k => k.reviewStatus !== 'Pending').length;
  const progress = allKPIs.length > 0 ? (reviewedCount / allKPIs.length) * 100 : 0;

  const getKPIStatusBadgeClass = (status) => {
    if (status === 'Measured') return 'kept';
    if (status === 'Inactive') return 'retired';
    if (status === 'NEW KPI' || status === 'New KPI') return 'new';
    if (status === 'Added KPI') return 'edited';
    return 'pending';
  };

  // Get KPI status based on Active/Inactive column
  // 1 = Measured, 2 = NEW KPI, 0/other = Inactive
  const getKPIStatusFromActive = (kpi) => {
    const activeValue = kpi['Active/Inactive'];
    if (activeValue === 2 || activeValue === '2') {
      return 'NEW KPI';
    }
    if (activeValue === 1 || activeValue === '1' || activeValue === true) {
      return 'Measured';
    }
    return 'Inactive';
  };

  const getReviewBadgeClass = (reviewStatus) => {
    switch (reviewStatus) {
      case 'Kept': return 'kept';
      case 'Edited': return 'edited';
      case 'Retired': return 'retired';
      case 'New': return 'new';
      default: return 'pending';
    }
  };

  // Get achievement display with color
  const getAchievementDisplay = (kpi) => {
    const rawAchievement = kpi['Achievement %'] ?? kpi.Achievement;
    if (rawAchievement === null || rawAchievement === undefined) {
      return '-';
    }
    if (typeof rawAchievement === 'number') {
      // All values are decimal percentages (0.21 = 21%, 1 = 100%, 1.21 = 121%)
      const pct = rawAchievement * 100;
      const rounded = Math.round(pct);
      let color = 'var(--danger)';
      if (rounded >= 90) color = 'var(--success)';
      else if (rounded >= 70) color = 'var(--warning)';
      return <span style={{ color, fontWeight: 600 }}>{rounded}%</span>;
    }
    return '-';
  };

  return (
    <div className="app">
      <header className="header">
        <h1>{decodedDeptName}</h1>
        <div className="header-actions">
          {hasUnsavedChanges && (
            <div className="unsaved-indicator">
              <span className="unsaved-dot"></span>
              Unsaved changes
            </div>
          )}
          <button
            className="btn btn-secondary"
            onClick={saveChanges}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      <div className="container">
        <span
          className="back-link"
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </span>

        <div className="kpi-list-header">
          <div>
            <h2>{decodedDeptName} KPIs</h2>
            <div className="progress-text" style={{ marginTop: 4 }}>
              {reviewedCount} / {allKPIs.length} reviewed ({Math.round(progress)}%)
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/department/${encodeURIComponent(decodedDeptName)}/new`)}
          >
            + Create New KPI
          </button>
        </div>

        <div className="progress-bar" style={{ marginBottom: 24, height: 6 }}>
          <div
            className={`progress-bar-fill ${progress === 100 ? 'complete' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="kpi-list-filters">
          <input
            type="text"
            className="search-input"
            placeholder="Search KPIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All KPI Status</option>
            <option value="Measured">Measured</option>
            <option value="Inactive">Inactive</option>
            <option value="NEW KPI">NEW KPI</option>
          </select>
          <select
            className="filter-select"
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
          >
            <option value="all">All Review Status</option>
            <option value="Pending">Pending</option>
            <option value="Kept">Kept</option>
            <option value="Edited">Edited</option>
            <option value="Retired">Retired</option>
            <option value="New">New</option>
          </select>
        </div>

        {filteredKPIs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No KPIs found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="kpi-table">
            <table>
              <thead>
                <tr>
                  <th>KPI Code</th>
                  <th>KPI Name</th>
                  <th>Target</th>
                  <th>Achievement</th>
                  <th>KPI Status</th>
                  <th>Review Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredKPIs.map(kpi => (
                  <tr
                    key={kpi._id}
                    onClick={() => navigate(`/kpi/${encodeURIComponent(kpi._id)}`)}
                  >
                    <td>{kpi['KPI Code'] || kpi['KPI ID'] || '-'}</td>
                    <td>{kpi['KPI Name (English)'] || kpi['KPI Name'] || '-'}</td>
                    <td>{kpi.Target || '-'}</td>
                    <td>{getAchievementDisplay(kpi)}</td>
                    <td>
                      <span className={`status-badge ${getKPIStatusBadgeClass(getKPIStatusFromActive(kpi))}`}>
                        {getKPIStatusFromActive(kpi)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getReviewBadgeClass(kpi.reviewStatus)}`}>
                        {kpi.reviewStatus === 'Pending' ? 'Pending' : `✓ ${kpi.reviewStatus}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentKPIList;
