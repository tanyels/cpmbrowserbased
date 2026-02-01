import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';
import { useLicense } from '../../contexts/LicenseContext';
import { AlertTriangle } from 'lucide-react';

function TeamMembersTab() {
  const {
    businessUnits,
    teamMembers,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    archiveTeamMember,
    getDirectReports,
    personalObjectives,
    addPersonalObjective,
    updatePersonalObjective,
    deletePersonalObjective,
    getPersonalObjectivesByEmployee,
    employeeKpis,
    addEmployeeKPI,
    updateEmployeeKPI,
    deleteEmployeeKPI,
    getEmployeeKPIsByEmployee,
    objectives
  } = useStrategy();

  const { isFeatureAllowed, isReadOnly, featureLimits, isInTrial } = useLicense();

  // Check if we can add more team members
  const canAddMoreMembers = isFeatureAllowed('team_members', teamMembers.length);
  const memberLimit = featureLimits?.MAX_TEAM_MEMBERS;

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingToBU, setAddingToBU] = useState(null);
  const [expandedBUs, setExpandedBUs] = useState({});
  const [expandedManagers, setExpandedManagers] = useState({});
  const [detailTab, setDetailTab] = useState('info'); // 'info', 'objectives', 'kpis'

  // New employee form state
  const [addingToManager, setAddingToManager] = useState(null); // For adding direct report
  const [newEmployee, setNewEmployee] = useState({
    Employee_ID: '',
    Name: '',
    Name_AR: '',
    Job_Title: '',
    Job_Title_AR: '',
    Email: '',
    Hire_Date: '',
    Reports_To: '',
    Business_Unit_Code: ''
  });

  // Objective form state
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [objectiveForm, setObjectiveForm] = useState({
    Name: '',
    Name_AR: '',
    Description: '',
    Target_Date: '',
    Parent_Objective_Code: ''
  });

  // KPI form state
  const [showKPIForm, setShowKPIForm] = useState(false);
  const [editingKPI, setEditingKPI] = useState(null);
  const [kpiForm, setKPIForm] = useState({
    Name: '',
    Name_AR: '',
    Description: '',
    Personal_Objective_Code: '',
    Target: '',
    Target_Mode: 'single', // 'single' or 'monthly'
    Monthly_Targets: {},
    Unit: '',
    Weight: 0,
    Polarity: 'Positive'
  });

  const months = [
    { short: 'Jan', idx: 0 }, { short: 'Feb', idx: 1 }, { short: 'Mar', idx: 2 },
    { short: 'Apr', idx: 3 }, { short: 'May', idx: 4 }, { short: 'Jun', idx: 5 },
    { short: 'Jul', idx: 6 }, { short: 'Aug', idx: 7 }, { short: 'Sep', idx: 8 },
    { short: 'Oct', idx: 9 }, { short: 'Nov', idx: 10 }, { short: 'Dec', idx: 11 }
  ];

  // Refs for scrolling forms into view
  const kpiFormRef = useRef(null);
  const objectiveFormRef = useRef(null);

  // Scroll to form when it becomes visible
  useEffect(() => {
    if (showKPIForm && kpiFormRef.current) {
      kpiFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showKPIForm]);

  useEffect(() => {
    if (showObjectiveForm && objectiveFormRef.current) {
      objectiveFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showObjectiveForm]);

  // Build tree structure grouped by BU
  const employeeTree = useMemo(() => {
    const activeMembers = teamMembers.filter(m => m.Status === 'Active');
    const tree = {};

    // Group by BU
    businessUnits.filter(bu => bu.Status === 'Active').forEach(bu => {
      const buMembers = activeMembers.filter(m => m.Business_Unit_Code === bu.Code);
      if (buMembers.length > 0) {
        // Find top-level employees (no manager or manager in different BU)
        const topLevel = buMembers.filter(m =>
          !m.Reports_To || !buMembers.some(other => other.Code === m.Reports_To)
        );
        tree[bu.Code] = {
          bu,
          members: topLevel.map(m => buildEmployeeNode(m, buMembers))
        };
      }
    });

    // Unassigned employees
    const unassigned = activeMembers.filter(m => !m.Business_Unit_Code);
    if (unassigned.length > 0) {
      tree['unassigned'] = {
        bu: { Code: 'unassigned', Name: 'Unassigned', Abbreviation: '-' },
        members: unassigned.map(m => buildEmployeeNode(m, unassigned))
      };
    }

    return tree;
  }, [teamMembers, businessUnits]);

  // Build employee node with children (direct reports)
  function buildEmployeeNode(employee, allMembers) {
    const directReports = allMembers.filter(m => m.Reports_To === employee.Code);
    return {
      ...employee,
      children: directReports.map(m => buildEmployeeNode(m, allMembers))
    };
  }

  // Get managers list for dropdown (employees in same BU or all if no BU selected)
  const getAvailableManagers = (buCode, excludeCode = null) => {
    return teamMembers.filter(m =>
      m.Status === 'Active' &&
      m.Code !== excludeCode &&
      (buCode ? m.Business_Unit_Code === buCode : true)
    );
  };

  // Handle add employee
  const handleAddEmployee = () => {
    if (!newEmployee.Name.trim()) {
      alert('Employee name is required');
      return;
    }
    if (!newEmployee.Business_Unit_Code) {
      alert('Business Unit is required');
      return;
    }

    addTeamMember({
      ...newEmployee,
      Business_Unit_Code: newEmployee.Business_Unit_Code || addingToBU
    });

    setNewEmployee({
      Employee_ID: '',
      Name: '',
      Name_AR: '',
      Job_Title: '',
      Job_Title_AR: '',
      Email: '',
      Hire_Date: '',
      Reports_To: '',
      Business_Unit_Code: ''
    });
    setShowAddForm(false);
    setAddingToBU(null);
    setAddingToManager(null);
  };

  // Handle update employee
  const handleUpdateEmployee = () => {
    if (!editingEmployee) return;
    const emp = teamMembers.find(m => m.Code === editingEmployee);
    if (emp) {
      setEditingEmployee(null);
    }
  };

  // Handle delete employee
  const handleDeleteEmployee = (code) => {
    const result = deleteTeamMember(code);
    if (!result.success) {
      alert(result.error);
      return;
    }
    if (selectedEmployee === code) {
      setSelectedEmployee(null);
    }
  };

  // Toggle BU expansion
  const toggleBU = (buCode) => {
    setExpandedBUs(prev => ({
      ...prev,
      [buCode]: !prev[buCode]
    }));
  };

  // Toggle manager expansion
  const toggleManager = (empCode) => {
    setExpandedManagers(prev => ({
      ...prev,
      [empCode]: !prev[empCode]
    }));
  };

  // Start adding employee to a specific BU
  const startAddToBU = (buCode) => {
    setNewEmployee({
      Employee_ID: '',
      Name: '',
      Name_AR: '',
      Job_Title: '',
      Job_Title_AR: '',
      Email: '',
      Hire_Date: '',
      Reports_To: '',
      Business_Unit_Code: buCode
    });
    setAddingToBU(buCode);
    setAddingToManager(null);
    setShowAddForm(true);
  };

  // Start adding employee as direct report to a manager
  const startAddToManager = (manager) => {
    setNewEmployee({
      Employee_ID: '',
      Name: '',
      Name_AR: '',
      Job_Title: '',
      Job_Title_AR: '',
      Email: '',
      Hire_Date: '',
      Reports_To: manager.Code,
      Business_Unit_Code: manager.Business_Unit_Code
    });
    setAddingToBU(manager.Business_Unit_Code);
    setAddingToManager(manager.Code);
    setShowAddForm(true);
    // Expand the manager node so we can see the new employee
    setExpandedManagers(prev => ({ ...prev, [manager.Code]: true }));
  };

  // Handle objective form submit
  const handleObjectiveSubmit = () => {
    if (!objectiveForm.Name.trim()) {
      alert('Objective name is required');
      return;
    }

    if (editingObjective) {
      updatePersonalObjective(editingObjective, objectiveForm);
    } else {
      addPersonalObjective({
        ...objectiveForm,
        Employee_Code: selectedEmployee
      });
    }

    setObjectiveForm({
      Name: '',
      Name_AR: '',
      Description: '',
      Target_Date: '',
      Parent_Objective_Code: ''
    });
    setShowObjectiveForm(false);
    setEditingObjective(null);
  };

  // Handle KPI form submit
  const handleKPISubmit = () => {
    if (!kpiForm.Name.trim()) {
      alert('KPI name is required');
      return;
    }

    if (editingKPI) {
      updateEmployeeKPI(editingKPI, kpiForm);
    } else {
      addEmployeeKPI({
        ...kpiForm,
        Employee_Code: selectedEmployee
      });
    }

    setKPIForm({
      Name: '',
      Name_AR: '',
      Description: '',
      Personal_Objective_Code: '',
      Target: '',
      Target_Mode: 'single',
      Monthly_Targets: {},
      Unit: '',
      Weight: 0,
      Polarity: 'Positive'
    });
    setShowKPIForm(false);
    setEditingKPI(null);
  };

  // Edit objective
  const handleEditObjective = (obj) => {
    setObjectiveForm({
      Name: obj.Name || '',
      Name_AR: obj.Name_AR || '',
      Description: obj.Description || '',
      Target_Date: obj.Target_Date || '',
      Parent_Objective_Code: obj.Parent_Objective_Code || ''
    });
    setEditingObjective(obj.Code);
    setShowObjectiveForm(true);
  };

  // Edit KPI
  const handleEditKPI = (kpi) => {
    setKPIForm({
      Name: kpi.Name || '',
      Name_AR: kpi.Name_AR || '',
      Description: kpi.Description || '',
      Personal_Objective_Code: kpi.Personal_Objective_Code || '',
      Target: kpi.Target || '',
      Target_Mode: kpi.Target_Mode || 'single',
      Monthly_Targets: kpi.Monthly_Targets || {},
      Unit: kpi.Unit || '',
      Weight: kpi.Weight || 0,
      Polarity: kpi.Polarity || 'Positive'
    });
    setEditingKPI(kpi.Code);
    setShowKPIForm(true);
  };

  // Render employee node in tree
  const renderEmployeeNode = (emp, depth = 0) => {
    const isSelected = selectedEmployee === emp.Code;
    const isEditing = editingEmployee === emp.Code;
    const hasChildren = emp.children && emp.children.length > 0;
    const isExpanded = expandedManagers[emp.Code] !== false; // Default expanded

    return (
      <div key={emp.Code} className="employee-tree-node">
        <div
          className={`employee-node-content ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: depth * 24 + 12 }}
          onClick={() => setSelectedEmployee(emp.Code)}
        >
          {hasChildren && (
            <button
              className="expand-btn"
              onClick={(e) => { e.stopPropagation(); toggleManager(emp.Code); }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="expand-placeholder"></span>}

          <div className="employee-avatar">
            {emp.Photo_URL ? (
              <img src={emp.Photo_URL} alt={emp.Name} />
            ) : (
              <span>{emp.Name?.charAt(0) || '?'}</span>
            )}
          </div>

          {isEditing ? (
            <div className="employee-edit-inline" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={emp.Name}
                onChange={(e) => updateTeamMember(emp.Code, { Name: e.target.value })}
                placeholder="Name"
              />
              <input
                type="text"
                value={emp.Job_Title || ''}
                onChange={(e) => updateTeamMember(emp.Code, { Job_Title: e.target.value })}
                placeholder="Job Title"
              />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setEditingEmployee(null)}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="employee-info">
                <span className="employee-name">{emp.Name}</span>
                <span className="employee-title">{emp.Job_Title || 'No Title'}</span>
              </div>
              <div className="employee-node-actions">
                <button
                  className="btn btn-sm btn-ghost add-report-btn"
                  onClick={(e) => { e.stopPropagation(); startAddToManager(emp); }}
                  title="Add direct report"
                >
                  + Report
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => { e.stopPropagation(); setEditingEmployee(emp.Code); }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.Code); }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="employee-children">
            {emp.children.map(child => renderEmployeeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get selected employee data
  const selectedEmp = selectedEmployee ? teamMembers.find(m => m.Code === selectedEmployee) : null;
  const selectedEmpObjectives = selectedEmployee ? getPersonalObjectivesByEmployee(selectedEmployee) : [];
  const selectedEmpKPIs = selectedEmployee ? getEmployeeKPIsByEmployee(selectedEmployee) : [];
  const selectedEmpBU = selectedEmp ? businessUnits.find(b => b.Code === selectedEmp.Business_Unit_Code) : null;
  const selectedEmpManager = selectedEmp?.Reports_To ? teamMembers.find(m => m.Code === selectedEmp.Reports_To) : null;

  // Get BU objectives for linking personal objectives
  const buObjectives = selectedEmpBU ? objectives.filter(o =>
    o.Business_Unit_Code === selectedEmpBU.Code && o.Status === 'Active'
  ) : [];

  return (
    <div className="team-members-tab">
      <div className="tm-header">
        <h2>Team Members</h2>
        <p className="section-description">
          Manage employees, their personal objectives, and individual KPIs
        </p>
      </div>

      <div className="tm-content">
        {/* Left Panel - Employee Tree */}
        <div className="tm-tree-panel">
          <div className="tm-tree-header">
            <h3>Organization</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setNewEmployee({
                  Employee_ID: '',
                  Name: '',
                  Name_AR: '',
                  Job_Title: '',
                  Job_Title_AR: '',
                  Email: '',
                  Hire_Date: '',
                  Reports_To: '',
                  Business_Unit_Code: ''
                });
                setShowAddForm(true);
                setAddingToBU(null);
                setAddingToManager(null);
              }}
              disabled={!canAddMoreMembers || isReadOnly()}
            >
              + Add Employee
            </button>
          </div>

          {/* License limit warning */}
          {isInTrial() && !canAddMoreMembers && (
            <div className="limit-warning" style={{ margin: '12px' }}>
              <span className="limit-warning-icon"><AlertTriangle size={14} /></span>
              <div className="limit-warning-text">
                <strong>Team Member Limit Reached</strong>
                <span>Trial is limited to {memberLimit} team members. </span>
              </div>
              <a href="http://localhost:3000/products/cpm-software" target="_blank" rel="noopener noreferrer">
                Upgrade
              </a>
            </div>
          )}

          {/* Read-only warning */}
          {isReadOnly() && (
            <div className="limit-warning" style={{ margin: '12px' }}>
              <span className="limit-warning-icon">🔒</span>
              <div className="limit-warning-text">
                <strong>Read-Only Mode</strong>
                <span>Your license has expired.</span>
              </div>
              <a href="http://localhost:3000/products/cpm-software" target="_blank" rel="noopener noreferrer">
                Renew
              </a>
            </div>
          )}

          {/* Add Employee Form */}
          {showAddForm && (
            <div className="add-employee-form">
              <h4>
                {addingToManager ? (
                  <>Add Direct Report to {teamMembers.find(m => m.Code === addingToManager)?.Name}</>
                ) : addingToBU ? (
                  <>Add Employee to {businessUnits.find(bu => bu.Code === addingToBU)?.Name}</>
                ) : (
                  'Add New Employee'
                )}
              </h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name (English) *</label>
                  <input
                    type="text"
                    value={newEmployee.Name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="form-group">
                  <label>Name (Arabic)</label>
                  <input
                    type="text"
                    value={newEmployee.Name_AR}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Name_AR: e.target.value })}
                    placeholder="جون سميث"
                    dir="rtl"
                  />
                </div>
                <div className="form-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    value={newEmployee.Employee_ID}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Employee_ID: e.target.value })}
                    placeholder="EMP-12345"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newEmployee.Email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Email: e.target.value })}
                    placeholder="john.smith@company.com"
                  />
                </div>
                <div className="form-group">
                  <label>Job Title (English)</label>
                  <input
                    type="text"
                    value={newEmployee.Job_Title}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Job_Title: e.target.value })}
                    placeholder="Senior Analyst"
                  />
                </div>
                <div className="form-group">
                  <label>Job Title (Arabic)</label>
                  <input
                    type="text"
                    value={newEmployee.Job_Title_AR}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Job_Title_AR: e.target.value })}
                    placeholder="محلل أول"
                    dir="rtl"
                  />
                </div>
                <div className="form-group">
                  <label>Business Unit *</label>
                  <select
                    value={newEmployee.Business_Unit_Code}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Business_Unit_Code: e.target.value })}
                  >
                    <option value="">Select Business Unit...</option>
                    {businessUnits.filter(bu => bu.Status === 'Active').map(bu => (
                      <option key={bu.Code} value={bu.Code}>
                        [{bu.Level}] {bu.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Reports To</label>
                  <select
                    value={newEmployee.Reports_To}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Reports_To: e.target.value })}
                  >
                    <option value="">No Manager</option>
                    {getAvailableManagers(newEmployee.Business_Unit_Code).map(m => (
                      <option key={m.Code} value={m.Code}>
                        {m.Name} - {m.Job_Title || 'No Title'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hire Date</label>
                  <input
                    type="date"
                    value={newEmployee.Hire_Date}
                    onChange={(e) => setNewEmployee({ ...newEmployee, Hire_Date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleAddEmployee}>
                  Add Employee
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddingToBU(null);
                    setAddingToManager(null);
                    setNewEmployee({
                      Employee_ID: '',
                      Name: '',
                      Name_AR: '',
                      Job_Title: '',
                      Job_Title_AR: '',
                      Email: '',
                      Hire_Date: '',
                      Reports_To: '',
                      Business_Unit_Code: ''
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Employee Tree */}
          <div className="employee-tree">
            {Object.keys(employeeTree).length === 0 ? (
              <div className="empty-state">
                <p>No team members yet. Add your first employee to get started.</p>
              </div>
            ) : (
              Object.entries(employeeTree).map(([buCode, { bu, members }]) => (
                <div key={buCode} className="bu-group">
                  <div
                    className="bu-group-header"
                    onClick={() => toggleBU(buCode)}
                  >
                    <span className="expand-icon">
                      {expandedBUs[buCode] !== false ? '▼' : '▶'}
                    </span>
                    <span className="bu-badge">{bu.Abbreviation || bu.Level}</span>
                    <span className="bu-name">{bu.Name}</span>
                    <span className="member-count">{members.length} member(s)</span>
                    {buCode !== 'unassigned' && (
                      <button
                        className="btn btn-sm btn-ghost add-to-bu-btn"
                        onClick={(e) => { e.stopPropagation(); startAddToBU(buCode); }}
                        title={`Add employee to ${bu.Name}`}
                      >
                        +
                      </button>
                    )}
                  </div>
                  {expandedBUs[buCode] !== false && (
                    <div className="bu-members">
                      {members.map(emp => renderEmployeeNode(emp, 0))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Employee Details */}
        <div className="tm-details-panel">
          {selectedEmp ? (
            <>
              <div className="employee-detail-header">
                <div className="employee-avatar-large">
                  {selectedEmp.Photo_URL ? (
                    <img src={selectedEmp.Photo_URL} alt={selectedEmp.Name} />
                  ) : (
                    <span>{selectedEmp.Name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div className="employee-header-info">
                  <h3>{selectedEmp.Name}</h3>
                  {selectedEmp.Name_AR && <p className="name-ar">{selectedEmp.Name_AR}</p>}
                  <p className="job-title">{selectedEmp.Job_Title || 'No Title'}</p>
                </div>
              </div>

              <div className="detail-tabs">
                <button
                  className={`tab-btn ${detailTab === 'info' ? 'active' : ''}`}
                  onClick={() => setDetailTab('info')}
                >
                  Info
                </button>
                <button
                  className={`tab-btn ${detailTab === 'objectives' ? 'active' : ''}`}
                  onClick={() => setDetailTab('objectives')}
                >
                  Objectives ({selectedEmpObjectives.length})
                </button>
                <button
                  className={`tab-btn ${detailTab === 'kpis' ? 'active' : ''}`}
                  onClick={() => setDetailTab('kpis')}
                >
                  KPIs ({selectedEmpKPIs.length})
                </button>
              </div>

              <div className="detail-content">
                {detailTab === 'info' && (
                  <div className="info-tab">
                    <div className="info-grid">
                      <div className="info-row">
                        <label>Code:</label>
                        <span>{selectedEmp.Code}</span>
                      </div>
                      <div className="info-row">
                        <label>Employee ID:</label>
                        <span>{selectedEmp.Employee_ID || '-'}</span>
                      </div>
                      <div className="info-row">
                        <label>Email:</label>
                        <span>{selectedEmp.Email || '-'}</span>
                      </div>
                      <div className="info-row">
                        <label>Business Unit:</label>
                        <span>{selectedEmpBU?.Name || '-'}</span>
                      </div>
                      <div className="info-row">
                        <label>Reports To:</label>
                        <span>
                          {selectedEmpManager ? (
                            <span
                              className="link"
                              onClick={() => setSelectedEmployee(selectedEmpManager.Code)}
                            >
                              {selectedEmpManager.Name}
                            </span>
                          ) : '-'}
                        </span>
                      </div>
                      <div className="info-row">
                        <label>Hire Date:</label>
                        <span>{selectedEmp.Hire_Date || '-'}</span>
                      </div>
                      <div className="info-row">
                        <label>Direct Reports:</label>
                        <span>{getDirectReports(selectedEmp.Code).length}</span>
                      </div>
                    </div>

                    {/* Edit Info Form */}
                    <div className="edit-info-section">
                      <h4>Edit Employee</h4>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Name (English)</label>
                          <input
                            type="text"
                            value={selectedEmp.Name}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Name (Arabic)</label>
                          <input
                            type="text"
                            value={selectedEmp.Name_AR || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Name_AR: e.target.value })}
                            dir="rtl"
                          />
                        </div>
                        <div className="form-group">
                          <label>Job Title (English)</label>
                          <input
                            type="text"
                            value={selectedEmp.Job_Title || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Job_Title: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Job Title (Arabic)</label>
                          <input
                            type="text"
                            value={selectedEmp.Job_Title_AR || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Job_Title_AR: e.target.value })}
                            dir="rtl"
                          />
                        </div>
                        <div className="form-group">
                          <label>Employee ID</label>
                          <input
                            type="text"
                            value={selectedEmp.Employee_ID || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Employee_ID: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={selectedEmp.Email || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Email: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Reports To</label>
                          <select
                            value={selectedEmp.Reports_To || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Reports_To: e.target.value })}
                          >
                            <option value="">No Manager</option>
                            {getAvailableManagers(selectedEmp.Business_Unit_Code, selectedEmp.Code).map(m => (
                              <option key={m.Code} value={m.Code}>
                                {m.Name} - {m.Job_Title || 'No Title'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Hire Date</label>
                          <input
                            type="date"
                            value={selectedEmp.Hire_Date || ''}
                            onChange={(e) => updateTeamMember(selectedEmp.Code, { Hire_Date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === 'objectives' && (
                  <div className="objectives-tab">
                    <div className="tab-header">
                      <h4>Personal Objectives</h4>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setObjectiveForm({
                            Name: '',
                            Name_AR: '',
                            Description: '',
                            Target_Date: '',
                            Parent_Objective_Code: ''
                          });
                          setEditingObjective(null);
                          setShowObjectiveForm(true);
                        }}
                      >
                        + Add Objective
                      </button>
                    </div>

                    {showObjectiveForm && (
                      <div className="objective-form" ref={objectiveFormRef}>
                        <h5>{editingObjective ? 'Edit Objective' : 'New Objective'}</h5>
                        <div className="form-grid">
                          <div className="form-group">
                            <label>Name (English) *</label>
                            <input
                              type="text"
                              value={objectiveForm.Name}
                              onChange={(e) => setObjectiveForm({ ...objectiveForm, Name: e.target.value })}
                              placeholder="Complete certification"
                            />
                          </div>
                          <div className="form-group">
                            <label>Name (Arabic)</label>
                            <input
                              type="text"
                              value={objectiveForm.Name_AR}
                              onChange={(e) => setObjectiveForm({ ...objectiveForm, Name_AR: e.target.value })}
                              dir="rtl"
                            />
                          </div>
                          <div className="form-group full-width">
                            <label>Description</label>
                            <textarea
                              value={objectiveForm.Description}
                              onChange={(e) => setObjectiveForm({ ...objectiveForm, Description: e.target.value })}
                              rows={2}
                            />
                          </div>
                          <div className="form-group">
                            <label>Target Date</label>
                            <input
                              type="date"
                              value={objectiveForm.Target_Date}
                              onChange={(e) => setObjectiveForm({ ...objectiveForm, Target_Date: e.target.value })}
                            />
                          </div>
                          <div className="form-group full-width">
                            <label>Linked to BU Objective (Optional)</label>
                            <select
                              value={objectiveForm.Parent_Objective_Code}
                              onChange={(e) => setObjectiveForm({ ...objectiveForm, Parent_Objective_Code: e.target.value })}
                            >
                              <option value="">None</option>
                              {buObjectives.map(obj => (
                                <option key={obj.Code} value={obj.Code}>
                                  {obj.Name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-actions">
                          <button className="btn btn-primary btn-sm" onClick={handleObjectiveSubmit}>
                            {editingObjective ? 'Update' : 'Add'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setShowObjectiveForm(false); setEditingObjective(null); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="objectives-list">
                      {selectedEmpObjectives.length === 0 ? (
                        <p className="empty-message">No personal objectives defined.</p>
                      ) : (
                        selectedEmpObjectives.filter(obj => obj.Code !== editingObjective).map(obj => {
                          const linkedKPIs = employeeKpis.filter(k => k.Personal_Objective_Code === obj.Code);
                          return (
                            <div key={obj.Code} className="objective-card">
                              <div className="objective-header">
                                <span className="objective-name">{obj.Name}</span>
                              </div>
                              {obj.Description && (
                                <p className="objective-desc">{obj.Description}</p>
                              )}
                              <div className="objective-meta">
                                {obj.Target_Date && (
                                  <span className="target-date">Due: {obj.Target_Date}</span>
                                )}
                                <span className="kpi-count">{linkedKPIs.length} KPI(s)</span>
                              </div>
                              <div className="objective-actions">
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => handleEditObjective(obj)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => {
                                    const result = deletePersonalObjective(obj.Code);
                                    if (!result.success) alert(result.error);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {detailTab === 'kpis' && (
                  <div className="kpis-tab">
                    <div className="tab-header">
                      <h4>Employee KPIs</h4>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setKPIForm({
                            Name: '',
                            Name_AR: '',
                            Description: '',
                            Personal_Objective_Code: '',
                            Target: '',
                            Target_Mode: 'single',
                            Monthly_Targets: {},
                            Unit: '',
                            Weight: 0,
                            Polarity: 'Positive'
                          });
                          setEditingKPI(null);
                          setShowKPIForm(true);
                        }}
                      >
                        + Add KPI
                      </button>
                    </div>

                    {showKPIForm && (
                      <div className="kpi-form" ref={kpiFormRef}>
                        <h5>{editingKPI ? 'Edit KPI' : 'New KPI'}</h5>
                        <div className="form-grid">
                          <div className="form-group">
                            <label>Name (English) *</label>
                            <input
                              type="text"
                              value={kpiForm.Name}
                              onChange={(e) => setKPIForm({ ...kpiForm, Name: e.target.value })}
                              placeholder="Certification Score"
                            />
                          </div>
                          <div className="form-group">
                            <label>Name (Arabic)</label>
                            <input
                              type="text"
                              value={kpiForm.Name_AR}
                              onChange={(e) => setKPIForm({ ...kpiForm, Name_AR: e.target.value })}
                              dir="rtl"
                            />
                          </div>
                          <div className="form-group full-width">
                            <label>Description</label>
                            <textarea
                              value={kpiForm.Description}
                              onChange={(e) => setKPIForm({ ...kpiForm, Description: e.target.value })}
                              rows={2}
                            />
                          </div>
                          <div className="form-group full-width">
                            <label>Linked Objective</label>
                            <select
                              value={kpiForm.Personal_Objective_Code}
                              onChange={(e) => setKPIForm({ ...kpiForm, Personal_Objective_Code: e.target.value })}
                            >
                              <option value="">None</option>
                              {selectedEmpObjectives.map(obj => (
                                <option key={obj.Code} value={obj.Code}>
                                  {obj.Name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Unit</label>
                            <input
                              type="text"
                              value={kpiForm.Unit}
                              onChange={(e) => setKPIForm({ ...kpiForm, Unit: e.target.value })}
                              placeholder="%"
                            />
                          </div>
                          <div className="form-group full-width">
                            <label>Target</label>
                            <div className="target-mode-selector">
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="empKpiTargetMode"
                                  value="single"
                                  checked={kpiForm.Target_Mode === 'single'}
                                  onChange={() => setKPIForm({ ...kpiForm, Target_Mode: 'single' })}
                                />
                                Same for all months
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="empKpiTargetMode"
                                  value="monthly"
                                  checked={kpiForm.Target_Mode === 'monthly'}
                                  onChange={() => setKPIForm({ ...kpiForm, Target_Mode: 'monthly' })}
                                />
                                Different per month
                              </label>
                            </div>
                            {kpiForm.Target_Mode === 'single' ? (
                              <input
                                type="text"
                                value={kpiForm.Target}
                                onChange={(e) => setKPIForm({ ...kpiForm, Target: e.target.value })}
                                placeholder="Target value for all months"
                                style={{ marginTop: '8px' }}
                              />
                            ) : (
                              <div className="monthly-targets-grid" style={{ marginTop: '8px' }}>
                                {months.map(({ short, idx }) => (
                                  <div key={idx} className="monthly-target-input">
                                    <span className="month-label">{short}</span>
                                    <input
                                      type="text"
                                      value={kpiForm.Monthly_Targets[idx] || ''}
                                      onChange={(e) => setKPIForm({
                                        ...kpiForm,
                                        Monthly_Targets: { ...kpiForm.Monthly_Targets, [idx]: e.target.value }
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
                              value={kpiForm.Weight}
                              onChange={(e) => setKPIForm({ ...kpiForm, Weight: parseFloat(e.target.value) || 0 })}
                              min="0"
                              max="100"
                            />
                          </div>
                          <div className="form-group">
                            <label>Polarity</label>
                            <select
                              value={kpiForm.Polarity}
                              onChange={(e) => setKPIForm({ ...kpiForm, Polarity: e.target.value })}
                            >
                              <option value="Positive">Positive (Higher is Better)</option>
                              <option value="Negative">Negative (Lower is Better)</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-actions">
                          <button className="btn btn-primary btn-sm" onClick={handleKPISubmit}>
                            {editingKPI ? 'Update' : 'Add'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setShowKPIForm(false); setEditingKPI(null); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="kpis-list">
                      {selectedEmpKPIs.length === 0 ? (
                        <p className="empty-message">No KPIs defined.</p>
                      ) : (
                        selectedEmpKPIs.filter(kpi => kpi.Code !== editingKPI).map(kpi => {
                          const linkedObj = kpi.Personal_Objective_Code
                            ? personalObjectives.find(o => o.Code === kpi.Personal_Objective_Code)
                            : null;
                          return (
                            <div key={kpi.Code} className="kpi-card">
                              <div className="kpi-header">
                                <span className="kpi-name">{kpi.Name}</span>
                                <span className="kpi-weight">{kpi.Weight}%</span>
                              </div>
                              <div className="kpi-details">
                                <span className="kpi-target">
                                  Target: {kpi.Target} {kpi.Unit}
                                </span>
                                <span className={`kpi-polarity ${kpi.Polarity?.toLowerCase()}`}>
                                  {kpi.Polarity}
                                </span>
                              </div>
                              {linkedObj && (
                                <div className="kpi-objective">
                                  Objective: {linkedObj.Name}
                                </div>
                              )}
                              <div className="kpi-actions">
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => handleEditKPI(kpi)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => deleteEmployeeKPI(kpi.Code)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>Select an employee to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamMembersTab;
