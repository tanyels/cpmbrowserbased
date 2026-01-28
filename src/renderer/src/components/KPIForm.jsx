import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKPI } from '../contexts/KPIContext';

function KPIForm({ mode }) {
  const { kpiId, departmentName } = useParams();
  const navigate = useNavigate();
  const { getKPIById, editKPI, createKPI, hasUnsavedChanges, isSaving, saveChanges } = useKPI();

  const isEditMode = mode === 'edit';
  const decodedKpiId = kpiId ? decodeURIComponent(kpiId) : null;
  const decodedDeptName = departmentName ? decodeURIComponent(departmentName) : null;

  const existingKPI = isEditMode ? getKPIById(decodedKpiId) : null;

  const [formData, setFormData] = useState({
    'KPI Name (English)': '',
    'KPI Name (Arabic)': '',
    'KPI Description (English)': '',
    'Initiative Name': '',
    Department: decodedDeptName || '',
    Formula: '',
    'Data Points': '',
    Target: '',
    Weight: '',
    Comments: ''
  });

  const [errors, setErrors] = useState({});

  // Get department from existing KPI
  const getDepartmentFromKPI = (kpi) => {
    const dept = kpi.Department || kpi.Owner || kpi['Source.Name'] || 'Unknown';
    return dept.replace(/_KPI.*$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  };

  useEffect(() => {
    if (isEditMode && existingKPI) {
      setFormData({
        'KPI Name (English)': existingKPI['KPI Name (English)'] || existingKPI['KPI Name'] || '',
        'KPI Name (Arabic)': existingKPI['KPI Name (Arabic)'] || '',
        'KPI Description (English)': existingKPI['KPI Description (English)'] || existingKPI.Description || '',
        'Initiative Name': existingKPI['Initiative Name'] || '',
        Department: getDepartmentFromKPI(existingKPI),
        Formula: existingKPI.Formula || '',
        'Data Points': existingKPI['Data Points'] || '',
        Target: existingKPI.Target || '',
        Weight: existingKPI.Weight || '',
        Comments: existingKPI.Comments || ''
      });
    }
  }, [isEditMode, existingKPI]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData['KPI Name (English)'].trim()) {
      newErrors['KPI Name (English)'] = 'KPI Name (English) is required';
    }

    if (!formData.Department.trim()) {
      newErrors.Department = 'Department is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Convert weight to number if it's a string
    const processedData = { ...formData };
    if (processedData.Weight && typeof processedData.Weight === 'string') {
      const weightNum = parseFloat(processedData.Weight);
      if (!isNaN(weightNum)) {
        processedData.Weight = weightNum > 1 ? weightNum / 100 : weightNum;
      }
    }

    if (isEditMode) {
      editKPI(decodedKpiId, processedData);
      navigate(`/kpi/${encodeURIComponent(decodedKpiId)}`);
    } else {
      createKPI(processedData, decodedDeptName);
      navigate(`/department/${encodeURIComponent(decodedDeptName)}`);
    }
  };

  const handleCancel = () => {
    if (isEditMode) {
      navigate(`/kpi/${encodeURIComponent(decodedKpiId)}`);
    } else {
      navigate(`/department/${encodeURIComponent(decodedDeptName)}`);
    }
  };

  if (isEditMode && !existingKPI) {
    return (
      <div className="app">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">?</div>
            <h3>KPI not found</h3>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const department = isEditMode
    ? getDepartmentFromKPI(existingKPI)
    : decodedDeptName;

  return (
    <div className="app">
      <header className="header">
        <h1>{isEditMode ? 'Edit KPI' : 'Create New KPI'}</h1>
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
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </header>

      <div className="container">
        <span className="back-link" onClick={handleCancel}>
          Cancel
        </span>

        <div className="form-container">
          <div className="form-card">
            <h2>{isEditMode ? `Edit: ${existingKPI['KPI Name (English)'] || existingKPI['KPI Name']}` : 'Create New KPI'}</h2>

            {isEditMode && (
              <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>
                KPI Code: {existingKPI['KPI Code'] || existingKPI['KPI ID']}
              </p>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">KPI Name (English) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData['KPI Name (English)']}
                    onChange={(e) => handleChange('KPI Name (English)', e.target.value)}
                    placeholder="Enter KPI name in English"
                  />
                  {errors['KPI Name (English)'] && (
                    <span style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                      {errors['KPI Name (English)']}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">KPI Name (Arabic)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData['KPI Name (Arabic)']}
                    onChange={(e) => handleChange('KPI Name (Arabic)', e.target.value)}
                    placeholder="Enter KPI name in Arabic"
                    dir="rtl"
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData['KPI Description (English)']}
                    onChange={(e) => handleChange('KPI Description (English)', e.target.value)}
                    placeholder="Enter KPI description"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.Department}
                    onChange={(e) => handleChange('Department', e.target.value)}
                    placeholder="Enter department"
                  />
                  {errors.Department && (
                    <span style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                      {errors.Department}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Initiative Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData['Initiative Name']}
                    onChange={(e) => handleChange('Initiative Name', e.target.value)}
                    placeholder="Enter initiative name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Weight (%)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={typeof formData.Weight === 'number' ? (formData.Weight * 100).toFixed(0) : formData.Weight}
                    onChange={(e) => handleChange('Weight', e.target.value)}
                    placeholder="e.g., 5 or 0.05"
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Formula</label>
                  <textarea
                    className="form-textarea"
                    value={formData.Formula}
                    onChange={(e) => handleChange('Formula', e.target.value)}
                    placeholder="Enter calculation formula"
                    rows={2}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Data Points</label>
                  <textarea
                    className="form-textarea"
                    value={formData['Data Points']}
                    onChange={(e) => handleChange('Data Points', e.target.value)}
                    placeholder="Enter required data points"
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.Target}
                    onChange={(e) => handleChange('Target', e.target.value)}
                    placeholder="e.g., >80%, <45 days"
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Comments</label>
                  <textarea
                    className="form-textarea"
                    value={formData.Comments}
                    onChange={(e) => handleChange('Comments', e.target.value)}
                    placeholder="Enter any comments or notes"
                    rows={2}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditMode ? 'Save Changes' : 'Create KPI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KPIForm;
