import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKPI } from '../contexts/KPIContext';
import { BarChart3, FileText, CheckCircle } from 'lucide-react';

function DepartmentDashboard() {
  const navigate = useNavigate();
  const {
    getDepartments,
    addDepartment,
    getStats,
    hasUnsavedChanges,
    isSaving,
    saveChanges,
    exportToExcel,
    exportKPICards,
    currentFilePath
  } = useKPI();

  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [addDeptError, setAddDeptError] = useState('');
  const [cardsExportStatus, setCardsExportStatus] = useState({});

  const departments = getDepartments();
  const stats = getStats();

  const handleDepartmentClick = (deptName) => {
    navigate(`/department/${encodeURIComponent(deptName)}`);
  };

  const handleSave = () => {
    saveChanges();
  };

  const handleExport = async () => {
    setExportError(null);
    setExportSuccess(false);

    const result = await exportToExcel();
    if (result.success) {
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } else if (!result.cancelled) {
      setExportError(result.error);
    }
  };

  const handleAddDepartment = () => {
    setAddDeptError('');

    if (!newDeptName.trim()) {
      setAddDeptError('Department name is required');
      return;
    }

    const success = addDepartment(newDeptName);
    if (success) {
      setNewDeptName('');
      setShowAddDeptModal(false);
    } else {
      setAddDeptError('Department already exists');
    }
  };

  const handleCloseModal = () => {
    setShowAddDeptModal(false);
    setNewDeptName('');
    setAddDeptError('');
  };

  const handleExportKPICards = async (e, deptName) => {
    e.stopPropagation(); // Prevent navigating to department
    setCardsExportStatus(prev => ({ ...prev, [deptName]: 'exporting' }));

    const result = await exportKPICards(deptName);

    if (result.success) {
      setCardsExportStatus(prev => ({ ...prev, [deptName]: 'success' }));
      setTimeout(() => {
        setCardsExportStatus(prev => ({ ...prev, [deptName]: null }));
      }, 3000);
    } else if (!result.cancelled) {
      setCardsExportStatus(prev => ({ ...prev, [deptName]: result.error }));
      setTimeout(() => {
        setCardsExportStatus(prev => ({ ...prev, [deptName]: null }));
      }, 5000);
    } else {
      setCardsExportStatus(prev => ({ ...prev, [deptName]: null }));
    }
  };

  const fileName = currentFilePath ? currentFilePath.split(/[/\\]/).pop() : 'Unknown';

  return (
    <div className="app">
      <header className="header">
        <h1><BarChart3 size={24} style={{display:'inline', marginRight: 8}} /> CPM KPI Review Tool</h1>
        <div className="header-actions">
          {hasUnsavedChanges && (
            <div className="unsaved-indicator">
              <span className="unsaved-dot"></span>
              Unsaved changes
            </div>
          )}
          <button
            className="btn btn-secondary"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? '💾 Saving...' : '💾 Save Changes'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
          >
            📤 Export KPI Library
          </button>
        </div>
      </header>

      <div className="container">
        {exportSuccess && (
          <div className="success-message">
            <CheckCircle size={14} /> KPI Library exported successfully!
          </div>
        )}

        {exportError && (
          <div className="error-message">
            Export failed: {exportError}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>
            Current file: <strong>{fileName}</strong>
          </p>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-card-label">Total KPIs</div>
            <div className="stat-card-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Pending Review</div>
            <div className="stat-card-value warning">{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Kept</div>
            <div className="stat-card-value success">{stats.kept}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Edited</div>
            <div className="stat-card-value primary">{stats.edited}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Retired</div>
            <div className="stat-card-value danger">{stats.retired}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">New KPIs</div>
            <div className="stat-card-value primary">{stats.new}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>Departments</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddDeptModal(true)}
          >
            + Add Department
          </button>
        </div>

        {departments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={48} /></div>
            <h3>No departments found</h3>
            <p>Add a department to get started or load an Excel file with KPI data.</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setShowAddDeptModal(true)}
            >
              + Add Department
            </button>
          </div>
        ) : (
          <div className="departments-grid">
            {departments.map(dept => {
              const progress = dept.total > 0 ? (dept.reviewed / dept.total) * 100 : 0;
              return (
                <div
                  key={dept.name}
                  className={`department-card ${dept.isComplete && dept.total > 0 ? 'complete' : ''}`}
                  onClick={() => handleDepartmentClick(dept.name)}
                >
                  <div className="department-card-header">
                    <h3>{dept.name}</h3>
                    {dept.total === 0 ? (
                      <span className="department-card-badge" style={{ background: '#E3F2FD', color: '#1565C0' }}>
                        New
                      </span>
                    ) : (
                      <span className={`department-card-badge ${dept.isComplete ? 'complete' : 'pending'}`}>
                        {dept.isComplete ? <><CheckCircle size={12} /> Complete</> : 'In Progress'}
                      </span>
                    )}
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-bar-fill ${dept.isComplete && dept.total > 0 ? 'complete' : ''}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    {dept.total === 0
                      ? 'No KPIs yet - click to add'
                      : `${dept.reviewed} / ${dept.total} KPIs reviewed`
                    }
                  </div>
                  {dept.isComplete && dept.total > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{
                        marginTop: 12,
                        width: '100%',
                        fontSize: 13,
                        padding: '8px 12px'
                      }}
                      onClick={(e) => handleExportKPICards(e, dept.name)}
                      disabled={cardsExportStatus[dept.name] === 'exporting'}
                    >
                      {cardsExportStatus[dept.name] === 'exporting'
                        ? 'Generating...'
                        : cardsExportStatus[dept.name] === 'success'
                        ? <><CheckCircle size={12} /> Cards Exported!</>
                        : <><FileText size={12} /> Create KPI Cards</>}
                    </button>
                  )}
                  {cardsExportStatus[dept.name] && cardsExportStatus[dept.name] !== 'exporting' && cardsExportStatus[dept.name] !== 'success' && (
                    <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>
                      {cardsExportStatus[dept.name]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      {showAddDeptModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Department</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newDeptName}
                  onChange={(e) => {
                    setNewDeptName(e.target.value);
                    setAddDeptError('');
                  }}
                  placeholder="Enter department name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddDepartment();
                    }
                  }}
                />
                {addDeptError && (
                  <span style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                    {addDeptError}
                  </span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddDepartment}>
                Add Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentDashboard;
