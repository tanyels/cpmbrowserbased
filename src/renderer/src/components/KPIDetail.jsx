import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKPI } from '../contexts/KPIContext';
import { Check } from 'lucide-react';

function KPIDetail() {
  const { kpiId } = useParams();
  const navigate = useNavigate();
  const { getKPIById, keepKPI, retireKPI, updateDiscussion, hasUnsavedChanges, isSaving, saveChanges } = useKPI();

  const decodedId = decodeURIComponent(kpiId);
  const kpi = getKPIById(decodedId);

  const [discussionText, setDiscussionText] = useState('');

  // Sync discussion text when KPI loads or changes
  useEffect(() => {
    if (kpi) {
      setDiscussionText(kpi.Discussion || '');
    }
  }, [kpi?._id]);

  // Handle discussion text change with debounced save
  const handleDiscussionChange = (e) => {
    const newText = e.target.value;
    setDiscussionText(newText);
    updateDiscussion(kpi._id, newText);
  };

  if (!kpi) {
    return (
      <div className="app">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">?</div>
            <h3>KPI not found</h3>
            <p>The requested KPI could not be found.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get department - handle different field names
  const getDepartment = () => {
    const dept = kpi.Department || kpi.Owner || kpi['Source.Name'] || 'Unknown';
    return dept.replace(/_KPI.*$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  };

  const department = getDepartment();

  // Get KPI display values - handle different field names
  const kpiCode = kpi['KPI Code'] || kpi['KPI ID'] || '-';
  const kpiName = kpi['KPI Name (English)'] || kpi['KPI Name'] || 'Unnamed KPI';
  const kpiNameArabic = kpi['KPI Name (Arabic)'] || '';
  const description = kpi['KPI Description (English)'] || kpi.Description || '-';
  const formula = kpi.Formula || '-';
  const target = kpi.Target || '-';
  // Format achievement - handle decimal values (0.21 = 21%) and round to whole number
  const rawAchievement = kpi['Achievement %'] ?? kpi.Achievement;
  let achievement;
  if (rawAchievement === null || rawAchievement === undefined) {
    achievement = null;
  } else if (typeof rawAchievement === 'number') {
    // All values are decimal percentages (0.21 = 21%, 1 = 100%, 1.21 = 121%)
    const pct = rawAchievement * 100;
    achievement = Math.round(pct);
  } else {
    achievement = null;
  }
  const weight = kpi.Weight || '-';
  const initiative = kpi['Initiative Name'] || '-';
  const dataPoints = kpi['Data Points'] || '-';
  const kpiStatus = kpi['KPI Status'] || kpi.Status || '-';
  const comments = kpi.Comments || '-';

  const handleKeep = () => {
    keepKPI(kpi._id);
  };

  const handleEdit = () => {
    navigate(`/kpi/${encodeURIComponent(kpi._id)}/edit`);
  };

  const handleRetire = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to retire "${kpiName}"?\n\nThis KPI will be excluded from the next year's scorecard.`
    );

    if (confirmed) {
      retireKPI(kpi._id);
    }
  };

  const handleCreateNew = () => {
    navigate(`/department/${encodeURIComponent(department)}/new`);
  };

  // Achievement color based on value
  const getAchievementColor = (value) => {
    if (typeof value === 'number') {
      if (value >= 90) return 'var(--success)';
      if (value >= 70) return 'var(--warning)';
      return 'var(--danger)';
    }
    return 'var(--gray-800)';
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

  const getKPIStatusBadgeClass = (status) => {
    if (status === 'Measure') return 'kept';
    if (status === 'Inactive') return 'retired';
    if (status === 'New KPI') return 'new';
    if (status === 'Added KPI') return 'edited';
    return 'pending';
  };

  return (
    <div className="app">
      <header className="header">
        <h1>KPI Details</h1>
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
          onClick={() => navigate(`/department/${encodeURIComponent(department)}`)}
        >
          Back to {department}
        </span>

        <div className="kpi-detail">
          <div className="kpi-card">
            <div className="kpi-card-header">
              <div>
                <h2>{kpiName}</h2>
                {kpiNameArabic && (
                  <div style={{ fontSize: 16, color: 'var(--gray-600)', marginTop: 4, direction: 'rtl' }}>
                    {kpiNameArabic}
                  </div>
                )}
                <div className="kpi-card-id">{kpiCode}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={`status-badge ${getKPIStatusBadgeClass(kpiStatus)}`}>
                  {kpiStatus}
                </span>
                <span className={`status-badge ${getReviewBadgeClass(kpi.reviewStatus)}`}>
                  {kpi.reviewStatus}
                </span>
              </div>
            </div>

            <div className="kpi-card-grid">
              <div className="kpi-field full-width">
                <span className="kpi-field-label">Description</span>
                <span className="kpi-field-value">{description}</span>
              </div>

              <div className="kpi-field">
                <span className="kpi-field-label">Department</span>
                <span className="kpi-field-value">{department}</span>
              </div>

              <div className="kpi-field">
                <span className="kpi-field-label">Initiative</span>
                <span className="kpi-field-value">{initiative}</span>
              </div>

              <div className="kpi-field">
                <span className="kpi-field-label">Weight</span>
                <span className="kpi-field-value">
                  {typeof weight === 'number' ? `${(weight * 100).toFixed(0)}%` : weight}
                </span>
              </div>

              <div className="kpi-field full-width">
                <span className="kpi-field-label">Formula</span>
                <span className="kpi-field-value">{formula}</span>
              </div>

              <div className="kpi-field full-width">
                <span className="kpi-field-label">Data Points</span>
                <span className="kpi-field-value">{dataPoints}</span>
              </div>

              {comments !== '-' && (
                <div className="kpi-field full-width">
                  <span className="kpi-field-label">Comments</span>
                  <span className="kpi-field-value">{comments}</span>
                </div>
              )}
            </div>

            <div className="kpi-metrics">
              <div className="kpi-metric">
                <div className="kpi-metric-label">Target</div>
                <div className="kpi-metric-value">{target}</div>
              </div>
              <div className="kpi-metric">
                <div className="kpi-metric-label">Achievement %</div>
                <div className="kpi-metric-value" style={{ color: getAchievementColor(achievement) }}>
                  {achievement !== null ? `${achievement}%` : '-'}
                </div>
              </div>
              <div className="kpi-metric">
                <div className="kpi-metric-label">Weight</div>
                <div className="kpi-metric-value">
                  {typeof weight === 'number' ? `${(weight * 100).toFixed(0)}%` : weight}
                </div>
              </div>
            </div>
          </div>

          <div className="discussion-section" style={{ marginTop: 24, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12, color: 'var(--gray-700)' }}>Discussion / Comments</h3>
            <textarea
              className="discussion-textarea"
              value={discussionText}
              onChange={handleDiscussionChange}
              placeholder="Add discussion points, notes, or comments from the review session..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid var(--gray-300)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: 100
              }}
            />
          </div>

          <h3 style={{ marginBottom: 16, color: 'var(--gray-700)' }}>Actions</h3>

          <div className="kpi-actions">
            <button
              className={`kpi-action-btn ${kpi.reviewStatus === 'Kept' ? 'active' : ''}`}
              onClick={handleKeep}
              disabled={kpi.reviewStatus === 'Retired'}
            >
              <div className="kpi-action-btn-icon"><Check size={16} /></div>
              <div className="kpi-action-btn-label">Keep</div>
            </button>

            <button
              className={`kpi-action-btn ${kpi.reviewStatus === 'Edited' ? 'active' : ''}`}
              onClick={handleEdit}
              disabled={kpi.reviewStatus === 'Retired'}
            >
              <div className="kpi-action-btn-icon">✎</div>
              <div className="kpi-action-btn-label">Edit</div>
            </button>

            <button
              className={`kpi-action-btn ${kpi.reviewStatus === 'Retired' ? 'active' : ''}`}
              onClick={handleRetire}
              style={kpi.reviewStatus === 'Retired' ? { borderColor: 'var(--danger)', background: 'var(--danger-light)' } : {}}
            >
              <div className="kpi-action-btn-icon">✗</div>
              <div className="kpi-action-btn-label">Retire</div>
            </button>

            <button
              className="kpi-action-btn"
              onClick={handleCreateNew}
            >
              <div className="kpi-action-btn-icon">+</div>
              <div className="kpi-action-btn-label">Create New</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KPIDetail;
