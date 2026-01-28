import React, { useState, useEffect } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

// Color palettes
const colorPalettes = {
  reds: [
    { name: 'Crimson', value: '#dc3545' },
    { name: 'Tomato', value: '#e74c3c' },
    { name: 'Coral Red', value: '#ff6b6b' },
    { name: 'Indian Red', value: '#cd5c5c' },
    { name: 'Dark Red', value: '#c0392b' },
    { name: 'Brick', value: '#b22222' },
    { name: 'Rose', value: '#e91e63' },
    { name: 'Raspberry', value: '#d63384' },
  ],
  oranges: [
    { name: 'Orange', value: '#fd7e14' },
    { name: 'Tangerine', value: '#f39c12' },
    { name: 'Carrot', value: '#e67e22' },
    { name: 'Pumpkin', value: '#d35400' },
    { name: 'Burnt Orange', value: '#cc5500' },
    { name: 'Amber', value: '#ffbf00' },
    { name: 'Coral', value: '#ff7f50' },
    { name: 'Peach', value: '#ffab91' },
  ],
  yellows: [
    { name: 'Gold', value: '#ffc107' },
    { name: 'Sunflower', value: '#f1c40f' },
    { name: 'Lemon', value: '#fff176' },
    { name: 'Mustard', value: '#ffca28' },
    { name: 'Honey', value: '#ffa000' },
    { name: 'Canary', value: '#ffeb3b' },
    { name: 'Butter', value: '#ffe082' },
    { name: 'Marigold', value: '#ff9800' },
  ],
  greens: [
    { name: 'Emerald', value: '#2ecc71' },
    { name: 'Green', value: '#28a745' },
    { name: 'Sea Green', value: '#20c997' },
    { name: 'Mint', value: '#00c853' },
    { name: 'Forest', value: '#27ae60' },
    { name: 'Lime', value: '#8bc34a' },
    { name: 'Jade', value: '#00a86b' },
    { name: 'Teal', value: '#009688' },
  ],
  blues: [
    { name: 'Blue', value: '#007bff' },
    { name: 'Royal', value: '#3498db' },
    { name: 'Sky', value: '#54b4d3' },
    { name: 'Navy', value: '#0d47a1' },
    { name: 'Cobalt', value: '#0047ab' },
    { name: 'Azure', value: '#0288d1' },
    { name: 'Cerulean', value: '#17a2b8' },
    { name: 'Steel', value: '#6c757d' },
  ],
};

// Color picker component
function ColorPicker({ label, value, onChange, palettes }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="color-picker">
      <div className="color-picker-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="color-preview" style={{ backgroundColor: value }}></div>
        <span className="color-name">{value}</span>
        <span className="color-dropdown-icon">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="color-picker-dropdown">
          {palettes.map((paletteName) => (
            <div key={paletteName} className="color-palette-group">
              <div className="palette-label">{paletteName.charAt(0).toUpperCase() + paletteName.slice(1)}</div>
              <div className="color-swatches">
                {colorPalettes[paletteName].map((color) => (
                  <button
                    key={color.value}
                    className={`color-swatch ${value === color.value ? 'selected' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => {
                      onChange(color.value);
                      setIsOpen(false);
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminTab() {
  const { settings, updateSettings } = useStrategy();

  // Local state for form values
  const [formValues, setFormValues] = useState({
    // Achievement Thresholds
    thresholdExcellent: 100,
    thresholdGood: 80,
    thresholdWarning: 60,
    // Achievement Colors
    colorExcellent: '#28a745',
    colorGood: '#ffc107',
    colorWarning: '#fd7e14',
    colorPoor: '#dc3545',
    // Achievement Limits
    overachievementCap: 200,
    employeeOverachievementCap: 200,
    gaugeMaxValue: 150,
    // Organization Info
    organizationName: '',
    currencySymbol: '$'
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load settings from context on mount
  useEffect(() => {
    if (settings) {
      setFormValues(prev => ({
        ...prev,
        ...settings
      }));
    }
  }, [settings]);

  // Track changes
  const handleChange = (field, value) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
    setSaveMessage('');
  };

  // Save settings
  const handleSave = () => {
    updateSettings(formValues);
    setHasChanges(false);
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    const defaults = {
      thresholdExcellent: 100,
      thresholdGood: 80,
      thresholdWarning: 60,
      colorExcellent: '#28a745',
      colorGood: '#ffc107',
      colorWarning: '#fd7e14',
      colorPoor: '#dc3545',
      overachievementCap: 200,
      employeeOverachievementCap: 200,
      gaugeMaxValue: 150,
      organizationName: '',
      currencySymbol: '$'
    };
    setFormValues(defaults);
    setHasChanges(true);
    setSaveMessage('');
  };

  return (
    <div className="admin-tab">
      <div className="admin-header">
        <div>
          <h2>Admin Center</h2>
          <p className="section-description">
            Configure system-wide settings for thresholds, colors, limits, and organization information.
          </p>
        </div>
        <div className="admin-header-actions">
          {saveMessage && <span className="save-message success">{saveMessage}</span>}
          <button
            className="btn btn-secondary"
            onClick={handleResetDefaults}
          >
            Reset to Defaults
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Settings
          </button>
        </div>
      </div>

      <div className="admin-content">
        {/* Achievement Thresholds Section */}
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Achievement Thresholds & Colors</h3>
            <p>Define the percentage thresholds and colors for achievement coding across the application.</p>
          </div>
          <div className="admin-section-content">
            <div className="threshold-preview">
              <div className="threshold-bar">
                <div
                  className="threshold-segment"
                  style={{
                    width: `${formValues.thresholdWarning}%`,
                    backgroundColor: formValues.colorPoor,
                    color: getContrastColor(formValues.colorPoor)
                  }}
                >
                  <span>Poor</span>
                  <span>&lt;{formValues.thresholdWarning}%</span>
                </div>
                <div
                  className="threshold-segment"
                  style={{
                    width: `${formValues.thresholdGood - formValues.thresholdWarning}%`,
                    backgroundColor: formValues.colorWarning,
                    color: getContrastColor(formValues.colorWarning)
                  }}
                >
                  <span>Warning</span>
                  <span>{formValues.thresholdWarning}-{formValues.thresholdGood - 1}%</span>
                </div>
                <div
                  className="threshold-segment"
                  style={{
                    width: `${formValues.thresholdExcellent - formValues.thresholdGood}%`,
                    backgroundColor: formValues.colorGood,
                    color: getContrastColor(formValues.colorGood)
                  }}
                >
                  <span>Good</span>
                  <span>{formValues.thresholdGood}-{formValues.thresholdExcellent - 1}%</span>
                </div>
                <div
                  className="threshold-segment"
                  style={{
                    width: `${100 - formValues.thresholdExcellent + 20}%`,
                    backgroundColor: formValues.colorExcellent,
                    color: getContrastColor(formValues.colorExcellent)
                  }}
                >
                  <span>Excellent</span>
                  <span>&ge;{formValues.thresholdExcellent}%</span>
                </div>
              </div>
            </div>

            <div className="settings-grid threshold-grid">
              {/* Excellent */}
              <div className="setting-item">
                <label>
                  <span className="setting-label">Excellent Threshold</span>
                  <span className="setting-hint">Achievement at or above this value</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={formValues.thresholdExcellent}
                    onChange={(e) => handleChange('thresholdExcellent', parseInt(e.target.value) || 0)}
                    min={0}
                    max={200}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>
              <div className="setting-item">
                <label>
                  <span className="setting-label">Excellent Color</span>
                  <span className="setting-hint">Color for excellent achievement</span>
                </label>
                <ColorPicker
                  value={formValues.colorExcellent}
                  onChange={(color) => handleChange('colorExcellent', color)}
                  palettes={['greens', 'blues']}
                />
              </div>

              {/* Good */}
              <div className="setting-item">
                <label>
                  <span className="setting-label">Good Threshold</span>
                  <span className="setting-hint">Achievement at or above this value</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={formValues.thresholdGood}
                    onChange={(e) => handleChange('thresholdGood', parseInt(e.target.value) || 0)}
                    min={0}
                    max={formValues.thresholdExcellent - 1}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>
              <div className="setting-item">
                <label>
                  <span className="setting-label">Good Color</span>
                  <span className="setting-hint">Color for good achievement</span>
                </label>
                <ColorPicker
                  value={formValues.colorGood}
                  onChange={(color) => handleChange('colorGood', color)}
                  palettes={['yellows', 'greens']}
                />
              </div>

              {/* Warning */}
              <div className="setting-item">
                <label>
                  <span className="setting-label">Warning Threshold</span>
                  <span className="setting-hint">Achievement at or above this value</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={formValues.thresholdWarning}
                    onChange={(e) => handleChange('thresholdWarning', parseInt(e.target.value) || 0)}
                    min={0}
                    max={formValues.thresholdGood - 1}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>
              <div className="setting-item">
                <label>
                  <span className="setting-label">Warning Color</span>
                  <span className="setting-hint">Color for warning achievement</span>
                </label>
                <ColorPicker
                  value={formValues.colorWarning}
                  onChange={(color) => handleChange('colorWarning', color)}
                  palettes={['oranges', 'yellows']}
                />
              </div>

              {/* Poor */}
              <div className="setting-item disabled">
                <label>
                  <span className="setting-label">Poor Threshold</span>
                  <span className="setting-hint">Below warning threshold</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={0}
                    disabled
                  />
                  <span className="input-suffix">to {formValues.thresholdWarning - 1}%</span>
                </div>
              </div>
              <div className="setting-item">
                <label>
                  <span className="setting-label">Poor Color</span>
                  <span className="setting-hint">Color for poor achievement</span>
                </label>
                <ColorPicker
                  value={formValues.colorPoor}
                  onChange={(color) => handleChange('colorPoor', color)}
                  palettes={['reds', 'oranges']}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Achievement Limits Section */}
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Achievement Limits</h3>
            <p>Set maximum values for achievement calculations and displays.</p>
          </div>
          <div className="admin-section-content">
            <div className="settings-grid">
              <div className="setting-item">
                <label>
                  <span className="setting-label">BU Achievement Cap</span>
                  <span className="setting-hint">Cap Business Unit KPI achievement at this value for scorecard display and weighted averages</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={formValues.overachievementCap}
                    onChange={(e) => handleChange('overachievementCap', parseInt(e.target.value) || 100)}
                    min={100}
                    max={500}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>

              <div className="setting-item">
                <label>
                  <span className="setting-label">Employee Achievement Cap</span>
                  <span className="setting-hint">Cap Employee KPI achievement at this value (also handles infinity values)</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={formValues.employeeOverachievementCap}
                    onChange={(e) => handleChange('employeeOverachievementCap', parseInt(e.target.value) || 100)}
                    min={100}
                    max={500}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>

              <div className="setting-item">
                <label>
                  <span className="setting-label">Gauge Maximum Display</span>
                  <span className="setting-hint">Maximum value shown on scorecard gauge charts</span>
                </label>
                <div className="setting-input">
                  <input
                    type="number"
                    value={formValues.gaugeMaxValue}
                    onChange={(e) => handleChange('gaugeMaxValue', parseInt(e.target.value) || 100)}
                    min={100}
                    max={300}
                  />
                  <span className="input-suffix">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Info Section */}
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Organization Information</h3>
            <p>Basic organization details used throughout the application.</p>
          </div>
          <div className="admin-section-content">
            <div className="settings-grid">
              <div className="setting-item wide">
                <label>
                  <span className="setting-label">Organization Name</span>
                  <span className="setting-hint">Displayed in reports and exports</span>
                </label>
                <div className="setting-input">
                  <input
                    type="text"
                    value={formValues.organizationName}
                    onChange={(e) => handleChange('organizationName', e.target.value)}
                    placeholder="Enter organization name"
                  />
                </div>
              </div>

              <div className="setting-item">
                <label>
                  <span className="setting-label">Currency Symbol</span>
                  <span className="setting-hint">Used for monetary values display</span>
                </label>
                <div className="setting-input">
                  <input
                    type="text"
                    value={formValues.currencySymbol}
                    onChange={(e) => handleChange('currencySymbol', e.target.value)}
                    placeholder="$"
                    maxLength={3}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to determine contrast color (black or white) based on background
function getContrastColor(hexColor) {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default AdminTab;
