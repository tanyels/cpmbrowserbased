import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrategy } from '../contexts/StrategyContext';

function FileSelection() {
  const navigate = useNavigate();
  const { loadFile, createNewFile, generateSampleFile, isLoading } = useStrategy();
  const [lastFilePath, setLastFilePath] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function getLastFile() {
      const path = await window.electronAPI.getLastFilePath();
      setLastFilePath(path);
    }
    getLastFile();
  }, []);

  const handleOpenFile = async (filePath = null) => {
    setLoadError(null);
    let path = filePath;

    if (!path) {
      path = await window.electronAPI.openFileDialog();
    }

    if (path) {
      const result = await loadFile(path);
      if (result.success) {
        navigate('/main');
      } else {
        setLoadError(result.error);
      }
    }
  };

  const handleCreateNew = async () => {
    setLoadError(null);
    const result = await createNewFile();
    if (result.success) {
      navigate('/main');
    } else if (!result.cancelled) {
      setLoadError(result.error);
    }
  };

  const handleGenerateSample = async () => {
    setLoadError(null);
    const result = await generateSampleFile();
    if (result.success) {
      navigate('/main');
    } else if (!result.cancelled) {
      setLoadError(result.error);
    }
  };

  return (
    <div className="file-selection">
      <div className="file-selection-logo">🎯</div>
      <h1>CPM Strategy Cascade Tool</h1>
      <p className="subtitle">Strategy-to-KPI Structuring Platform</p>
      <p>Design, structure, and cascade strategy into measurable KPIs across L1, L2, and L3 levels</p>

      {loadError && (
        <div className="error-message">
          {loadError}
        </div>
      )}

      <div className="file-selection-actions">
        {lastFilePath && (
          <>
            <div
              className="last-file-card"
              onClick={() => handleOpenFile(lastFilePath)}
            >
              <div className="last-file-label">Last Opened File</div>
              <div className="last-file-path">{lastFilePath}</div>
            </div>
            <div className="divider">or</div>
          </>
        )}

        <div className="button-group">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => handleOpenFile()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ width: 20, height: 20, marginBottom: 0 }}></span>
                Loading...
              </>
            ) : (
              <>📁 Open Existing File</>
            )}
          </button>

          <button
            className="btn btn-secondary btn-lg"
            onClick={handleCreateNew}
            disabled={isLoading}
          >
            ✨ Create New Strategy File
          </button>

          <button
            className="btn btn-outline btn-lg"
            onClick={handleGenerateSample}
            disabled={isLoading}
          >
            📋 Generate Sample File
          </button>
        </div>
      </div>

      <div className="file-selection-features">
        <div className="features-grid">
          <div className="feature-category">
            <h3>📊 Track & Visualize</h3>
            <ul>
              <li>Interactive Strategy Map</li>
              <li>Organization Chart View</li>
              <li>Strategy Cascade Visualization</li>
              <li>Real-time Dashboard</li>
            </ul>
          </div>

          <div className="feature-category">
            <h3>🎯 Design & Structure</h3>
            <ul>
              <li>Vision, Mission & Strategic Pillars</li>
              <li>Business Units (L1 → L2 → L3)</li>
              <li>Team Members Hierarchy</li>
              <li>Cascaded Objectives & KPIs</li>
            </ul>
          </div>

          <div className="feature-category">
            <h3>📈 Measure & Analyze</h3>
            <ul>
              <li>Formula Builder for Measures</li>
              <li>Monthly Data Entry</li>
              <li>BU Scorecards with Gauges & Trends</li>
              <li>Employee Scorecards & KPIs</li>
            </ul>
          </div>

          <div className="feature-category">
            <h3>⚙️ Configure</h3>
            <ul>
              <li>Configurable Achievement Thresholds</li>
              <li>Custom Color Schemes</li>
              <li>Single or Monthly Targets</li>
              <li>Overachievement Caps</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileSelection;
