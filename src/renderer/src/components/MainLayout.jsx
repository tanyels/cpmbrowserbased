import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useStrategy } from '../contexts/StrategyContext';
import { useLicense } from '../contexts/LicenseContext';
import DashboardTab from './tabs/DashboardTab';
import StrategyMapTab from './tabs/StrategyMapTab';
import OrgViewTab from './tabs/OrgViewTab';
import StrategyCascadeTab from './tabs/StrategyCascadeTab';
import StrategyTab from './tabs/StrategyTab';
import BusinessUnitsTab from './tabs/BusinessUnitsTab';
import TeamMembersTab from './tabs/TeamMembersTab';
import ObjectivesTab from './tabs/ObjectivesTab';
import KPIsTab from './tabs/KPIsTab';
import MeasureTab from './tabs/MeasureTab';
import ScorecardTab from './tabs/ScorecardTab';
import EmployeeScorecardView from './tabs/EmployeeScorecardView';
import AdminTab from './tabs/AdminTab';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    filePath,
    hasUnsavedChanges,
    saveFile,
    isSaving,
    closeFile
  } = useStrategy();
  const { getCompanyInfo } = useLicense();

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('design'); // 'design', 'track', 'measure', or 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get company info for branding
  const companyInfo = getCompanyInfo();

  // Extract filename from path
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled';

  // Determine active category based on current route
  useEffect(() => {
    const path = location.pathname;
    if (
      path.includes('/main/dashboard') ||
      path.includes('/main/strategy-map') ||
      path.includes('/main/org-view') ||
      path.includes('/main/strategy-cascade')
    ) {
      setActiveCategory('track');
    } else if (
      path.includes('/main/strategy') ||
      path.includes('/main/business-units') ||
      path.includes('/main/team-members') ||
      path.includes('/main/objectives') ||
      path.includes('/main/kpis')
    ) {
      setActiveCategory('design');
    } else if (
      path.includes('/main/measure') ||
      path.includes('/main/global-values') ||
      path.includes('/main/data-entry') ||
      path.includes('/main/scorecard') ||
      path.includes('/main/employee-scorecard')
    ) {
      setActiveCategory('measure');
    } else if (path.includes('/main/admin')) {
      setActiveCategory('settings');
    }
  }, [location.pathname]);

  const handleSave = async () => {
    await saveFile();
  };

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const result = await window.electronAPI.showUnsavedWarning();
      if (result === 0) {
        // Save and close
        await saveFile();
        closeFile();
        navigate('/');
      } else if (result === 1) {
        // Don't save, just close
        closeFile();
        navigate('/');
      }
      // result === 2 means cancel, do nothing
    } else {
      closeFile();
      navigate('/');
    }
  };

  // Handle category change
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    // Navigate to the first tab of the selected category
    if (category === 'track') {
      navigate('/main/dashboard');
    } else if (category === 'design') {
      navigate('/main/strategy');
    } else if (category === 'measure') {
      navigate('/main/measure');
    } else if (category === 'settings') {
      navigate('/main/admin');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        console.log('Keyboard save triggered');
        await saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="header-left">
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>
            ← Back
          </button>
          {companyInfo?.logo && (
            <img
              src={companyInfo.logo}
              alt={companyInfo.name || 'Company Logo'}
              className="company-logo-header"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          {companyInfo?.name && (
            <span className="company-name-header">{companyInfo.name}</span>
          )}
          <div className="header-divider"></div>
          <h1 className="file-title">
            {fileName}
            {hasUnsavedChanges && <span className="unsaved-indicator">*</span>}
          </h1>
        </div>
        <div className="header-right">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <div className="main-body">
        {/* Left Sidebar */}
        <aside className={`main-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${activeCategory === 'design' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('design')}
              title="Design"
            >
              <span className="sidebar-icon">
                {/* Pencil/Ruler icon for Design */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                  <path d="M2 2l7.586 7.586"></path>
                  <circle cx="11" cy="11" r="2"></circle>
                </svg>
              </span>
              {!sidebarCollapsed && <span className="sidebar-label">Design</span>}
            </button>

            <button
              className={`sidebar-item ${activeCategory === 'track' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('track')}
              title="Track"
            >
              <span className="sidebar-icon">
                {/* Chart/Graph icon for Track */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </span>
              {!sidebarCollapsed && <span className="sidebar-label">Track</span>}
            </button>

            <button
              className={`sidebar-item ${activeCategory === 'measure' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('measure')}
              title="Measure"
            >
              <span className="sidebar-icon">
                {/* Calculator icon for Measure */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                  <line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="8" y1="10" x2="8" y2="10.01"></line>
                  <line x1="12" y1="10" x2="12" y2="10.01"></line>
                  <line x1="16" y1="10" x2="16" y2="10.01"></line>
                  <line x1="8" y1="14" x2="8" y2="14.01"></line>
                  <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  <line x1="16" y1="14" x2="16" y2="14.01"></line>
                  <line x1="8" y1="18" x2="8" y2="18.01"></line>
                  <line x1="12" y1="18" x2="12" y2="18.01"></line>
                  <line x1="16" y1="18" x2="16" y2="18.01"></line>
                </svg>
              </span>
              {!sidebarCollapsed && <span className="sidebar-label">Measure</span>}
            </button>

            <div className="sidebar-spacer"></div>

            <button
              className={`sidebar-item ${activeCategory === 'settings' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('settings')}
              title="Settings"
            >
              <span className="sidebar-icon">
                {/* Gear icon for Settings */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </span>
              {!sidebarCollapsed && <span className="sidebar-label">Settings</span>}
            </button>
          </nav>
        </aside>

        <div className="main-content-area">
          {/* Horizontal Tabs based on category */}
          <nav className="main-nav">
            {activeCategory === 'track' && (
              <>
                <NavLink to="/main/dashboard" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Dashboard
                </NavLink>
                <NavLink to="/main/strategy-map" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Strategy Map
                </NavLink>
                <NavLink to="/main/org-view" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Org View
                </NavLink>
                <NavLink to="/main/strategy-cascade" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Strategy Cascade
                </NavLink>
              </>
            )}
            {activeCategory === 'design' && (
              <>
                <NavLink to="/main/strategy" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Strategy
                </NavLink>
                <NavLink to="/main/business-units" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Business Units
                </NavLink>
                <NavLink to="/main/team-members" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Team Members
                </NavLink>
                <NavLink to="/main/objectives/l1" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  L1 Objectives
                </NavLink>
                <NavLink to="/main/objectives/l2" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  L2 Objectives
                </NavLink>
                <NavLink to="/main/objectives/l3" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  L3 Objectives
                </NavLink>
                <NavLink to="/main/kpis" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  KPIs
                </NavLink>
              </>
            )}
            {activeCategory === 'measure' && (
              <>
                <NavLink to="/main/measure" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Measures
                </NavLink>
                <NavLink to="/main/global-values" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Global Values
                </NavLink>
                <NavLink to="/main/data-entry" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Data Entry
                </NavLink>
                <NavLink to="/main/scorecard" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Scorecard
                </NavLink>
                <NavLink to="/main/employee-scorecard" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Employee Scorecard
                </NavLink>
              </>
            )}
            {activeCategory === 'settings' && (
              <>
                <NavLink to="/main/admin" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Admin Center
                </NavLink>
              </>
            )}
          </nav>

          <main className="main-content">
            <Routes>
              <Route path="dashboard" element={<DashboardTab />} />
              <Route path="strategy-map" element={<StrategyMapTab />} />
              <Route path="org-view" element={<OrgViewTab />} />
              <Route path="strategy-cascade" element={<StrategyCascadeTab />} />
              <Route path="strategy" element={<StrategyTab />} />
              <Route path="business-units" element={<BusinessUnitsTab />} />
              <Route path="team-members" element={<TeamMembersTab />} />
              <Route path="objectives/l1" element={<ObjectivesTab level="L1" />} />
              <Route path="objectives/l2" element={<ObjectivesTab level="L2" />} />
              <Route path="objectives/l3" element={<ObjectivesTab level="L3" />} />
              <Route path="kpis" element={<KPIsTab />} />
              <Route path="measure" element={<MeasureTab view="list" />} />
              <Route path="global-values" element={<MeasureTab view="global-values" />} />
              <Route path="data-entry" element={<MeasureTab view="data-entry" />} />
              <Route path="scorecard" element={<ScorecardTab />} />
              <Route path="employee-scorecard" element={<EmployeeScorecardView />} />
              <Route path="admin" element={<AdminTab />} />
              <Route path="*" element={<DashboardTab />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
