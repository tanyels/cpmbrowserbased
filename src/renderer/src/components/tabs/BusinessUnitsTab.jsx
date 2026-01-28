import React, { useState, useMemo } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

function BusinessUnitsTab() {
  const {
    businessUnits,
    addBusinessUnit,
    updateBusinessUnit,
    deleteBusinessUnit,
    objectives
  } = useStrategy();

  const [selectedBU, setSelectedBU] = useState(null);
  const [editingBU, setEditingBU] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingToParent, setAddingToParent] = useState(null);
  const [newBU, setNewBU] = useState({ Name: '', Name_AR: '', Abbreviation: '' });

  // Build tree structure
  const buTree = useMemo(() => {
    const l1Units = businessUnits.filter(bu => bu.Level === 'L1');
    const l2Units = businessUnits.filter(bu => bu.Level === 'L2');
    const l3Units = businessUnits.filter(bu => bu.Level === 'L3');

    return l1Units.map(l1 => ({
      ...l1,
      children: l2Units
        .filter(l2 => l2.Parent_Code === l1.Code)
        .map(l2 => ({
          ...l2,
          children: l3Units.filter(l3 => l3.Parent_Code === l2.Code)
        }))
    }));
  }, [businessUnits]);

  // Get objectives count for a business unit
  const getObjectivesCount = (buCode) => {
    return objectives.filter(obj => obj.Business_Unit_Code === buCode).length;
  };

  const handleAddBU = (level, parentCode = '') => {
    if (!newBU.Name.trim()) {
      alert('Name is required');
      return;
    }
    if (!newBU.Abbreviation.trim()) {
      alert('Abbreviation is required (e.g., FIN, HR, OPS)');
      return;
    }
    // Check for duplicate abbreviation
    const existingAbbr = businessUnits.find(
      bu => bu.Abbreviation?.toUpperCase() === newBU.Abbreviation.toUpperCase()
    );
    if (existingAbbr) {
      alert(`Abbreviation "${newBU.Abbreviation.toUpperCase()}" is already used by ${existingAbbr.Name}`);
      return;
    }

    addBusinessUnit({
      Name: newBU.Name,
      Name_AR: newBU.Name_AR,
      Abbreviation: newBU.Abbreviation.toUpperCase(),
      Level: level,
      Parent_Code: parentCode
    });
    setNewBU({ Name: '', Name_AR: '', Abbreviation: '' });
    setShowAddForm(false);
    setAddingToParent(null);
  };

  const handleUpdateBU = (code, updates) => {
    updateBusinessUnit(code, updates);
    setEditingBU(null);
  };

  const handleDeleteBU = (code) => {
    // Check for children
    const hasChildren = businessUnits.some(bu => bu.Parent_Code === code);
    if (hasChildren) {
      alert('Cannot delete a business unit that has child units. Delete children first.');
      return;
    }
    deleteBusinessUnit(code);
    if (selectedBU === code) {
      setSelectedBU(null);
    }
  };

  const renderBUNode = (bu, depth = 0) => {
    const isExpanded = true; // Always expanded for now
    const isSelected = selectedBU === bu.Code;
    const isEditing = editingBU === bu.Code;
    const objectivesCount = getObjectivesCount(bu.Code);
    const canAddChild = bu.Level !== 'L3';
    const nextLevel = bu.Level === 'L1' ? 'L2' : 'L3';

    return (
      <div key={bu.Code} className="bu-tree-node" style={{ marginLeft: depth * 24 }}>
        <div
          className={`bu-node-content ${isSelected ? 'selected' : ''} ${bu.Level.toLowerCase()}`}
          onClick={() => setSelectedBU(bu.Code)}
        >
          <div className="bu-node-icon">
            {bu.Level === 'L1' && '🏢'}
            {bu.Level === 'L2' && '🏬'}
            {bu.Level === 'L3' && '🏠'}
          </div>
          {isEditing ? (
            <div className="bu-edit-inline">
              <input
                type="text"
                value={bu.Name}
                onChange={(e) => updateBusinessUnit(bu.Code, { Name: e.target.value })}
                placeholder="Name (English)"
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="text"
                value={bu.Abbreviation || ''}
                onChange={(e) => updateBusinessUnit(bu.Code, { Abbreviation: e.target.value.toUpperCase() })}
                placeholder="ABBR"
                style={{ width: '80px' }}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="text"
                value={bu.Name_AR || ''}
                onChange={(e) => updateBusinessUnit(bu.Code, { Name_AR: e.target.value })}
                placeholder="الاسم (Arabic)"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => { e.stopPropagation(); setEditingBU(null); }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="bu-node-info">
                <span className="bu-level-badge">{bu.Level}</span>
                {bu.Abbreviation && <span className="bu-abbr-badge">{bu.Abbreviation}</span>}
                <span className="bu-name">{bu.Name}</span>
                {bu.Name_AR && <span className="bu-name-ar">{bu.Name_AR}</span>}
              </div>
              <div className="bu-node-meta">
                <span className="objectives-count" title="Objectives">
                  {objectivesCount} obj
                </span>
              </div>
              <div className="bu-node-actions">
                {canAddChild && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingToParent(bu.Code);
                      setShowAddForm(true);
                    }}
                    title={`Add ${nextLevel} unit`}
                  >
                    + {nextLevel}
                  </button>
                )}
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => { e.stopPropagation(); setEditingBU(bu.Code); }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={(e) => { e.stopPropagation(); handleDeleteBU(bu.Code); }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Add child form */}
        {showAddForm && addingToParent === bu.Code && (
          <div className="add-bu-inline" style={{ marginLeft: 24 }}>
            <input
              type="text"
              value={newBU.Name}
              onChange={(e) => setNewBU({ ...newBU, Name: e.target.value })}
              placeholder={`${nextLevel} Unit Name (English)`}
              autoFocus
            />
            <input
              type="text"
              value={newBU.Abbreviation}
              onChange={(e) => setNewBU({ ...newBU, Abbreviation: e.target.value.toUpperCase() })}
              placeholder="ABBR"
              style={{ width: '80px' }}
            />
            <input
              type="text"
              value={newBU.Name_AR}
              onChange={(e) => setNewBU({ ...newBU, Name_AR: e.target.value })}
              placeholder="الاسم (Arabic)"
              dir="rtl"
            />
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handleAddBU(nextLevel, bu.Code)}
            >
              Add
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setShowAddForm(false); setAddingToParent(null); setNewBU({ Name: '', Name_AR: '', Abbreviation: '' }); }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Children */}
        {bu.children && bu.children.map(child => renderBUNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="business-units-tab">
      <div className="bu-header">
        <h2>Business Units</h2>
        <p className="section-description">
          Organize your business units in a hierarchy: L1 (Corporate) → L2 (Division) → L3 (Department)
        </p>
      </div>

      <div className="bu-tree-container">
        <div className="bu-tree">
          {buTree.length === 0 ? (
            <div className="empty-state">
              <p>No business units yet. Add your first L1 (Corporate) unit to get started.</p>
            </div>
          ) : (
            buTree.map(bu => renderBUNode(bu, 0))
          )}
        </div>

        {/* Add L1 form */}
        <div className="add-l1-section">
          {showAddForm && addingToParent === null ? (
            <div className="add-bu-form">
              <h4>Add L1 (Corporate) Unit</h4>
              <div className="form-row">
                <input
                  type="text"
                  value={newBU.Name}
                  onChange={(e) => setNewBU({ ...newBU, Name: e.target.value })}
                  placeholder="Unit Name (English)"
                  autoFocus
                />
                <input
                  type="text"
                  value={newBU.Abbreviation}
                  onChange={(e) => setNewBU({ ...newBU, Abbreviation: e.target.value.toUpperCase() })}
                  placeholder="ABBR (e.g., CORP)"
                  style={{ width: '120px' }}
                />
                <input
                  type="text"
                  value={newBU.Name_AR}
                  onChange={(e) => setNewBU({ ...newBU, Name_AR: e.target.value })}
                  placeholder="اسم الوحدة (Arabic)"
                  dir="rtl"
                />
                <button className="btn btn-primary" onClick={() => handleAddBU('L1', '')}>
                  Add L1 Unit
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setShowAddForm(false); setNewBU({ Name: '', Name_AR: '', Abbreviation: '' }); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => { setShowAddForm(true); setAddingToParent(null); }}
            >
              + Add L1 (Corporate) Unit
            </button>
          )}
        </div>
      </div>

      {/* Selected BU Details Panel */}
      {selectedBU && (
        <div className="bu-details-panel">
          {(() => {
            const bu = businessUnits.find(b => b.Code === selectedBU);
            if (!bu) return null;
            const buObjectives = objectives.filter(obj => obj.Business_Unit_Code === bu.Code);
            const parentBU = bu.Parent_Code ? businessUnits.find(b => b.Code === bu.Parent_Code) : null;

            return (
              <>
                <h3>{bu.Name}</h3>
                <div className="bu-details-info">
                  <div className="detail-row">
                    <label>Code:</label>
                    <span>{bu.Code}</span>
                  </div>
                  <div className="detail-row">
                    <label>Abbreviation:</label>
                    <span>{bu.Abbreviation || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <label>Level:</label>
                    <span>{bu.Level}</span>
                  </div>
                  {parentBU && (
                    <div className="detail-row">
                      <label>Parent:</label>
                      <span>{parentBU.Name}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <label>Objectives:</label>
                    <span>{buObjectives.length}</span>
                  </div>
                </div>
                <div className="bu-objectives-list">
                  <h4>Objectives</h4>
                  {buObjectives.length === 0 ? (
                    <p className="empty-message">No objectives assigned to this unit.</p>
                  ) : (
                    <ul>
                      {buObjectives.map(obj => (
                        <li key={obj.Code} className={obj.Is_Operational ? 'operational' : ''}>
                          <span className="obj-code">{obj.Code}</span>
                          <span className="obj-name">{obj.Name}</span>
                          {obj.Is_Operational && <span className="operational-badge">Operational</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default BusinessUnitsTab;
