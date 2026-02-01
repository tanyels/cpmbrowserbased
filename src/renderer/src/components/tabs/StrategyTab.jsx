import React, { useState } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

function StrategyTab() {
  const {
    vision,
    setVision,
    mission,
    setMission,
    pillars,
    addPillar,
    updatePillar,
    deletePillar,
    perspectives,
    addPerspective,
    updatePerspective,
    deletePerspective
  } = useStrategy();

  const [newPillar, setNewPillar] = useState({ Name: '', Name_AR: '', Weight: 0 });
  const [newPerspective, setNewPerspective] = useState({ Name: '', Name_AR: '' });
  const [editingPillar, setEditingPillar] = useState(null);
  const [editingPerspective, setEditingPerspective] = useState(null);

  // Calculate total pillar weight
  const totalWeight = pillars.reduce((sum, p) => sum + (parseFloat(p.Weight) || 0), 0);

  const handleAddPillar = () => {
    if (newPillar.Name.trim()) {
      addPillar({
        ...newPillar,
        Weight: parseFloat(newPillar.Weight) || 0
      });
      setNewPillar({ Name: '', Name_AR: '', Weight: 0 });
    }
  };

  const handleUpdatePillar = (code, updates) => {
    updatePillar(code, updates);
    setEditingPillar(null);
  };

  const handleAddPerspective = () => {
    if (newPerspective.Name.trim()) {
      addPerspective(newPerspective);
      setNewPerspective({ Name: '', Name_AR: '' });
    }
  };

  const handleUpdatePerspective = (code, updates) => {
    updatePerspective(code, updates);
    setEditingPerspective(null);
  };

  return (
    <div className="strategy-tab">
      {/* Vision Section */}
      <section className="strategy-section">
        <h2>Vision</h2>
        <div className="form-group">
          <label>Vision Statement (English)</label>
          <textarea
            value={vision.Statement || ''}
            onChange={(e) => setVision({ ...vision, Statement: e.target.value })}
            placeholder="Enter your organization's vision statement..."
            rows={3}
          />
        </div>
        <div className="form-group">
          <label>Vision Statement (Arabic)</label>
          <textarea
            value={vision.Statement_AR || ''}
            onChange={(e) => setVision({ ...vision, Statement_AR: e.target.value })}
            placeholder="أدخل بيان الرؤية..."
            rows={3}
            dir="rtl"
          />
        </div>
      </section>

      {/* Mission Section */}
      <section className="strategy-section">
        <h2>Mission</h2>
        <div className="form-group">
          <label>Mission Statement (English)</label>
          <textarea
            value={mission.Statement || ''}
            onChange={(e) => setMission({ ...mission, Statement: e.target.value })}
            placeholder="Enter your organization's mission statement..."
            rows={3}
          />
        </div>
        <div className="form-group">
          <label>Mission Statement (Arabic)</label>
          <textarea
            value={mission.Statement_AR || ''}
            onChange={(e) => setMission({ ...mission, Statement_AR: e.target.value })}
            placeholder="أدخل بيان المهمة..."
            rows={3}
            dir="rtl"
          />
        </div>
      </section>

      {/* Strategic Pillars Section */}
      <section className="strategy-section">
        <h2>
          Strategic Pillars
          <span className={`weight-total ${Math.abs(totalWeight - 100) < 0.01 ? 'valid' : 'invalid'}`}>
            Total Weight: {totalWeight.toFixed(0)}%
          </span>
        </h2>

        <div className="pillars-list">
          {pillars.map((pillar) => (
            <div key={pillar.Code} className="pillar-card">
              {editingPillar === pillar.Code ? (
                <div className="pillar-edit">
                  <input
                    type="text"
                    value={pillar.Name}
                    onChange={(e) => updatePillar(pillar.Code, { Name: e.target.value })}
                    placeholder="Pillar Name (English)"
                  />
                  <input
                    type="text"
                    value={pillar.Name_AR || ''}
                    onChange={(e) => updatePillar(pillar.Code, { Name_AR: e.target.value })}
                    placeholder="اسم الركيزة (Arabic)"
                    dir="rtl"
                  />
                  <div className="weight-input">
                    <input
                      type="number"
                      value={pillar.Weight}
                      onChange={(e) => updatePillar(pillar.Code, { Weight: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span>%</span>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => setEditingPillar(null)}>
                    Done
                  </button>
                </div>
              ) : (
                <div className="pillar-display">
                  <div className="pillar-info">
                    <span className="pillar-code">{pillar.Code}</span>
                    <span className="pillar-name">{pillar.Name}</span>
                    {pillar.Name_AR && <span className="pillar-name-ar">{pillar.Name_AR}</span>}
                  </div>
                  <div className="pillar-weight">{pillar.Weight}%</div>
                  <div className="pillar-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingPillar(pillar.Code)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deletePillar(pillar.Code)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="add-pillar-form">
          <h4>Add New Pillar</h4>
          <div className="form-row">
            <input
              type="text"
              value={newPillar.Name}
              onChange={(e) => setNewPillar({ ...newPillar, Name: e.target.value })}
              placeholder="Pillar Name (English)"
            />
            <input
              type="text"
              value={newPillar.Name_AR}
              onChange={(e) => setNewPillar({ ...newPillar, Name_AR: e.target.value })}
              placeholder="اسم الركيزة (Arabic)"
              dir="rtl"
            />
            <div className="weight-input">
              <input
                type="number"
                value={newPillar.Weight}
                onChange={(e) => setNewPillar({ ...newPillar, Weight: e.target.value })}
                placeholder="Weight"
                min="0"
                max="100"
                step="0.1"
              />
              <span>%</span>
            </div>
            <button className="btn btn-primary" onClick={handleAddPillar}>
              Add Pillar
            </button>
          </div>
        </div>
      </section>

      {/* Perspectives Section (Optional) */}
      <section className="strategy-section">
        <h2>
          Perspectives
          <span className="optional-badge">Optional</span>
        </h2>
        <p className="section-description">
          Add perspectives to categorize your objectives (e.g., Financial, Customer, Internal Processes, Learning & Growth).
        </p>

        <div className="perspectives-list">
          {perspectives.map((perspective) => (
            <div key={perspective.Code} className="perspective-card">
              {editingPerspective === perspective.Code ? (
                <div className="perspective-edit">
                  <input
                    type="text"
                    value={perspective.Name}
                    onChange={(e) => updatePerspective(perspective.Code, { Name: e.target.value })}
                    placeholder="Perspective Name (English)"
                  />
                  <input
                    type="text"
                    value={perspective.Name_AR || ''}
                    onChange={(e) => updatePerspective(perspective.Code, { Name_AR: e.target.value })}
                    placeholder="اسم المنظور (Arabic)"
                    dir="rtl"
                  />
                  <button className="btn btn-sm btn-primary" onClick={() => setEditingPerspective(null)}>
                    Done
                  </button>
                </div>
              ) : (
                <div className="perspective-display">
                  <div className="perspective-info">
                    <span className="perspective-code">{perspective.Code}</span>
                    <span className="perspective-name">{perspective.Name}</span>
                    {perspective.Name_AR && <span className="perspective-name-ar">{perspective.Name_AR}</span>}
                  </div>
                  <div className="perspective-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingPerspective(perspective.Code)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deletePerspective(perspective.Code)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="add-perspective-form">
          <h4>Add New Perspective</h4>
          <div className="form-row">
            <input
              type="text"
              value={newPerspective.Name}
              onChange={(e) => setNewPerspective({ ...newPerspective, Name: e.target.value })}
              placeholder="Perspective Name (English)"
            />
            <input
              type="text"
              value={newPerspective.Name_AR}
              onChange={(e) => setNewPerspective({ ...newPerspective, Name_AR: e.target.value })}
              placeholder="اسم المنظور (Arabic)"
              dir="rtl"
            />
            <button className="btn btn-primary" onClick={handleAddPerspective}>
              Add Perspective
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default StrategyTab;
