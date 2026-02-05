import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useStrategy } from '../contexts/StrategyContext';
import { useLicense } from '../contexts/LicenseContext';
import { useCloud } from '../contexts/CloudContext';
import { useAuth } from '../contexts/AuthContext';
import transdataLogo from '../assets/transdata-logo.jpg';
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
import SupportTab from './tabs/SupportTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import UserManagement from './UserManagement';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    filePath,
    hasUnsavedChanges,
    saveFile,
    saveFileAs,
    isSaving,
    closeFile,
    isFromCloud,
    cloudStoragePath
  } = useStrategy();
  const { getCompanyInfo } = useLicense();
  const { updateFile, uploadFile, clearKey } = useCloud();
  const { user: authUser, isOwner, logout: authLogout } = useAuth();

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('design'); // 'design', 'track', 'measure', or 'settings'
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cpm-dark-mode') === 'true');
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

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
    } else if (path.includes('/main/admin') || path.includes('/main/team')) {
      setActiveCategory('settings');
    } else if (path.includes('/main/analytics')) {
      setActiveCategory('analytics');
    } else if (path.includes('/main/support')) {
      setActiveCategory('support');
    }
  }, [location.pathname]);

  const handleSave = async () => {
    console.log('=== HANDLE SAVE ===');
    console.log('isFromCloud:', isFromCloud);
    console.log('cloudStoragePath:', cloudStoragePath);
    console.log('filePath:', filePath);

    // Save and get the encrypted buffer
    const result = await saveFile();
    console.log('saveFile result:', result);

    // If file is from cloud, also update in cloud
    if (result?.success && result.buffer && isFromCloud && cloudStoragePath) {
      console.log('Syncing to cloud...');
      setIsSavingToCloud(true);
      try {
        const cloudResult = await updateFile(result.buffer, cloudStoragePath);
        console.log('Cloud sync result:', cloudResult);
        alert('Saved and synced to cloud!');
      } catch (err) {
        console.error('Failed to sync to cloud:', err);
        alert('Saved locally but failed to sync to cloud: ' + err.message);
      } finally {
        setIsSavingToCloud(false);
      }
    } else {
      console.log('Not syncing to cloud - conditions not met:', {
        success: result?.success,
        hasBuffer: !!result?.buffer,
        isFromCloud,
        cloudStoragePath
      });
      // Show feedback for local-only save
      if (result?.success) {
        console.log('Saved locally (not from cloud or no storage path)');
      }
    }
  };

  // Save As - open modal to get new name
  const handleSaveAs = () => {
    const currentName = fileName.replace(/\.cpme$/, '');
    setSaveAsName(currentName);
    setShowSaveAsModal(true);
  };

  // Actually perform the Save As to cloud
  const handleSaveAsConfirm = async () => {
    if (!saveAsName || !saveAsName.trim()) {
      return;
    }

    const cleanName = saveAsName.trim();
    setShowSaveAsModal(false);
    setIsSavingToCloud(true);

    try {
      // Save and get the encrypted buffer
      const result = await saveFile();
      if (!result?.success || !result.buffer) {
        throw new Error(result?.error || 'Failed to save file');
      }

      // Upload to cloud with new name
      await uploadFile(result.buffer, cleanName);
      alert(`Saved to cloud as "${cleanName}"!`);
    } catch (err) {
      console.error('Failed to save as:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Do you want to save before closing?');
      if (shouldSave) {
        await handleSave();
      }
      closeFile();
      navigate('/');
    } else {
      closeFile();
      navigate('/');
    }
  };

  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Do you want to save before logging out?');
      if (shouldSave) {
        await handleSave();
      }
    }
    closeFile();
    authLogout();
    navigate('/');
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
    } else if (category === 'analytics') {
      navigate('/main/analytics');
    } else if (category === 'support') {
      navigate('/main/support');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('cpm-dark-mode', String(next));
      return next;
    });
  };

  // Keyboard shortcuts - use a ref to avoid stale closure
  const handleSaveRef = React.useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        console.log('Keyboard save triggered');
        await handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`main-layout${darkMode ? ' dark-mode' : ''}`}>
      <header className="main-header">
        <div className="header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} title="Go to previous view">
            ← Back
          </button>
          <img
            src={transdataLogo}
            alt="Transdata"
            className="company-logo-header"
          />
          <span className="company-name-header">Transdata</span>
          <div className="header-divider"></div>
          <h1 className="file-title">
            {fileName}
            {hasUnsavedChanges && <span className="unsaved-indicator">*</span>}
          </h1>
        </div>
        <div className="header-right">
          {authUser && (
            <div className="header-user-info">
              <span className="header-user-name">{authUser.display_name}</span>
              {isOwner && <span className="header-owner-badge">Owner</span>}
            </div>
          )}
          <button
            className="btn btn-ghost"
            onClick={handleSaveAs}
            disabled={isSaving || isSavingToCloud}
            title="Save to cloud with a new name"
          >
            Save As
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || isSavingToCloud || !hasUnsavedChanges}
          >
            {isSaving ? 'Saving...' : isSavingToCloud ? 'Syncing to Cloud...' : 'Save'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleClose}
            title="Close file and return to file browser"
          >
            Exit
          </button>
          <button
            className="btn btn-danger"
            onClick={handleLogout}
            title="Logout and clear session"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Horizontal Toolbar */}
      <aside className="main-toolbar">
        <nav className="toolbar-nav">
          <div className="theme-toggle">
            <button
              className={`theme-toggle-btn ${!darkMode ? 'active' : ''}`}
              onClick={() => { if (darkMode) toggleDarkMode(); }}
              title="Light Mode"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </button>
            <button
              className={`theme-toggle-btn ${darkMode ? 'active' : ''}`}
              onClick={() => { if (!darkMode) toggleDarkMode(); }}
              title="Dark Mode"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>
          </div>

          <div className="toolbar-divider"></div>

          <button
            className={`toolbar-item ${activeCategory === 'design' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('design')}
            title="Design"
          >
            <span className="toolbar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <path d="M2 2l7.586 7.586"></path>
                <circle cx="11" cy="11" r="2"></circle>
              </svg>
            </span>
            <span className="toolbar-label">Design</span>
          </button>

          <button
            className={`toolbar-item ${activeCategory === 'track' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('track')}
            title="Track"
          >
            <span className="toolbar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </span>
            <span className="toolbar-label">Track</span>
          </button>

          <button
            className={`toolbar-item ${activeCategory === 'measure' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('measure')}
            title="Measure"
          >
            <span className="toolbar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <span className="toolbar-label">Measure</span>
          </button>

          <button
            className={`toolbar-item ${activeCategory === 'analytics' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('analytics')}
            title="Analytics"
          >
            <span className="toolbar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </span>
            <span className="toolbar-label">Analytics</span>
          </button>

          <button
            className={`toolbar-item ${activeCategory === 'support' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('support')}
            title="Support"
          >
            <span className="toolbar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </span>
            <span className="toolbar-label">Support</span>
          </button>

          {/* Spacer to push Settings to the right */}
          <div className="toolbar-spacer"></div>

          <button
            className={`toolbar-item ${activeCategory === 'settings' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('settings')}
            title="Settings"
          >
            <span className="toolbar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            <span className="toolbar-label">Settings</span>
          </button>

        </nav>
      </aside>

      <div className="main-body">
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
                {isOwner && (
                  <NavLink to="/main/team" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                    Team Management
                  </NavLink>
                )}
              </>
            )}
            {activeCategory === 'analytics' && (
              <>
                <NavLink to="/main/analytics" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Dependency Graph
                </NavLink>
              </>
            )}
            {activeCategory === 'support' && (
              <>
                <NavLink to="/main/support" className={({ isActive }) => isActive ? 'nav-tab active' : 'nav-tab'}>
                  Documentation
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
              <Route path="team" element={<UserManagement />} />
              <Route path="analytics" element={<AnalyticsTab />} />
              <Route path="support" element={<SupportTab />} />
              <Route path="*" element={<DashboardTab />} />
            </Routes>
          </main>
        </div>
      </div>

      {/* Save As Modal */}
      {showSaveAsModal && (
        <div className="modal-overlay" onClick={() => setShowSaveAsModal(false)}>
          <div className="modal-content save-as-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Save As</h3>
            <p>Enter a new name for this file:</p>
            <input
              type="text"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              placeholder="Enter filename"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAsConfirm();
                if (e.key === 'Escape') setShowSaveAsModal(false);
              }}
            />
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSaveAsConfirm} disabled={!saveAsName.trim()}>
                Save to Cloud
              </button>
              <button className="btn btn-ghost" onClick={() => setShowSaveAsModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default MainLayout;
