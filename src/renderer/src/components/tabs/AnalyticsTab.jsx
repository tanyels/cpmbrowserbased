import React, { useState, useMemo, useCallback } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

// ─── Node colors by type ──────────────────────────────────────────────────────

const NODE_COLORS = {
  pillar: '#4472C4',
  'objective-l1': '#5B9BD5',
  'objective-l2': '#70AD47',
  'objective-l3': '#9DC183',
  kpi: '#ADB5BD',
  measure: '#9b59b6',
  'business-unit': '#ED7D31',
  'global-value': '#636363',
};

const NODE_TYPE_LABELS = {
  pillar: 'Pillar',
  'objective-l1': 'L1 Objective',
  'objective-l2': 'L2 Objective',
  'objective-l3': 'L3 Objective',
  kpi: 'KPI',
  measure: 'Measure',
  'business-unit': 'Business Unit',
  'global-value': 'Global Value',
};

const EDGE_STYLES = {
  'weight-flow': { stroke: '#4472C4', dasharray: '', width: 2 },
  'parent-child': { stroke: '#ADB5BD', dasharray: '6,3', width: 1.5 },
  'data-flow': { stroke: '#28A745', dasharray: '3,3', width: 1.5 },
  'formula-dep': { stroke: '#9b59b6', dasharray: '4,4', width: 1 },
  'ownership': { stroke: '#ED7D31', dasharray: '2,4', width: 1 },
};

// ─── Component ────────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const {
    pillars = [],
    objectives = [],
    kpis = [],
    measures = [],
    achievements = {},
    businessUnits = [],
    globalValues = [],
    settings = {}
  } = useStrategy();

  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [graphType, setGraphType] = useState('leaf-tree');
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();

  // ── Graph data ────────────────────────────────────────────────────────

  const graphNodes = useMemo(() => {
    const nodes = [];

    pillars.filter(p => p.Status === 'Active').forEach(p => {
      nodes.push({
        id: p.Code, type: 'pillar', label: p.Name,
        weight: parseFloat(p.Weight) || 0, color: p.Color || NODE_COLORS.pillar,
        data: p
      });
    });

    objectives.filter(o => o.Status === 'Active' && !o.Is_Operational).forEach(o => {
      const level = (o.Level || '').toUpperCase();
      let type = 'objective-l1';
      if (level === 'L2') type = 'objective-l2';
      else if (level === 'L3') type = 'objective-l3';
      nodes.push({
        id: o.Code, type, label: o.Name,
        weight: parseFloat(o.Weight) || 0,
        parentId: level === 'L1' ? o.Pillar_Code : o.Parent_Objective_Code,
        buCode: o.Business_Unit_Code,
        data: o
      });
    });

    kpis.filter(k => k.Status === 'Active').forEach(k => {
      nodes.push({
        id: k.Code, type: 'kpi', label: k.Name,
        weight: parseFloat(k.Weight) || 0,
        parentId: k.Objective_Code,
        buCode: k.Business_Unit_Code,
        data: k
      });
    });

    measures.filter(m => m.Status === 'Active').forEach(m => {
      nodes.push({
        id: m.Code, type: 'measure', label: m.Name,
        parentId: m.KPI_Code,
        data: m
      });
    });

    globalValues.filter(gv => gv.Status === 'Active').forEach(gv => {
      nodes.push({
        id: gv.Code, type: 'global-value', label: gv.Name,
        data: gv
      });
    });

    return nodes;
  }, [pillars, objectives, kpis, measures, globalValues]);

  const graphEdges = useMemo(() => {
    const edges = [];
    const nodeIds = new Set(graphNodes.map(n => n.id));

    graphNodes.forEach(n => {
      if (n.parentId && nodeIds.has(n.parentId)) {
        const isWeightFlow = n.type === 'kpi' || n.type.startsWith('objective');
        edges.push({
          from: n.parentId,
          to: n.id,
          type: isWeightFlow ? 'weight-flow' : 'data-flow',
          weight: n.weight || 0
        });
      }
    });

    // Formula dependencies: measure → global values
    measures.filter(m => m.Status === 'Active' && m.Formula_Elements).forEach(m => {
      let elements = m.Formula_Elements;
      if (typeof elements === 'string') {
        try { elements = JSON.parse(elements); } catch { elements = []; }
      }
      if (Array.isArray(elements)) {
        elements.forEach(el => {
          if (el.type === 'globalValue' && el.code && nodeIds.has(el.code)) {
            edges.push({ from: el.code, to: m.Code, type: 'formula-dep' });
          }
          if (el.type === 'measure-ref' && el.code && nodeIds.has(el.code)) {
            edges.push({ from: el.code, to: m.Code, type: 'formula-dep' });
          }
        });
      }
    });

    return edges;
  }, [graphNodes, measures]);

  // ── Collapse helpers ────────────────────────────────────────────────

  const toggleCollapse = useCallback((nodeId, e) => {
    e.stopPropagation();
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedNodes(new Set()), []);
  const collapseAll = useCallback(() => {
    const parents = new Set(graphEdges.map(e => e.from));
    setCollapsedNodes(parents);
  }, [graphEdges]);

  // ── Visible nodes (respects collapsed state) ───────────────────────

  const childrenMap = useMemo(() => {
    const map = {};
    graphEdges.forEach(e => {
      if (!map[e.from]) map[e.from] = [];
      map[e.from].push(e.to);
    });
    return map;
  }, [graphEdges]);

  const childCountMap = useMemo(() => {
    const counts = {};
    graphEdges.forEach(e => {
      counts[e.from] = (counts[e.from] || 0) + 1;
    });
    return counts;
  }, [graphEdges]);

  const visibleNodeIds = useMemo(() => {
    const visible = new Set(graphNodes.map(n => n.id));

    const hideDescendants = (parentId) => {
      const children = childrenMap[parentId] || [];
      children.forEach(childId => {
        visible.delete(childId);
        hideDescendants(childId);
      });
    };

    collapsedNodes.forEach(nodeId => {
      if (visible.has(nodeId)) hideDescendants(nodeId);
    });

    return visible;
  }, [graphNodes, childrenMap, collapsedNodes]);

  // Count hidden descendants for badge
  const hiddenDescendantCount = useMemo(() => {
    const counts = {};
    const countDescendants = (parentId) => {
      let count = 0;
      const children = childrenMap[parentId] || [];
      children.forEach(childId => {
        count += 1 + countDescendants(childId);
      });
      return count;
    };
    collapsedNodes.forEach(nodeId => {
      counts[nodeId] = countDescendants(nodeId);
    });
    return counts;
  }, [childrenMap, collapsedNodes]);

  // ── Layout computation ────────────────────────────────────────────────

  const LAYER_CONFIG = [
    { types: ['pillar'], y: 60 },
    { types: ['objective-l1'], y: 190 },
    { types: ['objective-l2'], y: 320 },
    { types: ['objective-l3'], y: 450 },
    { types: ['kpi'], y: 580 },
    { types: ['measure', 'global-value'], y: 710 },
  ];

  const nodePositions = useMemo(() => {
    const positions = {};
    const nodeMap = {};
    graphNodes.forEach(n => { nodeMap[n.id] = n; });

    LAYER_CONFIG.forEach(({ types, y }) => {
      const layerNodes = graphNodes.filter(n => types.includes(n.type) && visibleNodeIds.has(n.id));
      if (layerNodes.length === 0) return;

      // Sort by parent to group siblings
      layerNodes.sort((a, b) => {
        const ap = a.parentId || '';
        const bp = b.parentId || '';
        if (ap !== bp) return ap.localeCompare(bp);
        return (b.weight || 0) - (a.weight || 0);
      });

      // Barycenter pass: reorder by average parent x
      if (Object.keys(positions).length > 0) {
        layerNodes.forEach(n => {
          if (n.parentId && positions[n.parentId]) {
            n._parentX = positions[n.parentId].x;
          } else {
            n._parentX = 0;
          }
        });
        layerNodes.sort((a, b) => (a._parentX || 0) - (b._parentX || 0));
      }

      const count = layerNodes.length;
      const minWidth = Math.max(1200, count * 120);
      const spacing = minWidth / (count + 1);
      layerNodes.forEach((n, i) => {
        positions[n.id] = { x: spacing * (i + 1), y };
      });
    });

    return positions;
  }, [graphNodes, visibleNodeIds]);

  // ── Decomposition Tree Layout ─────────────────────────────────────────

  const DECOMP_CARD_W = 180;
  const DECOMP_CARD_H = 56;
  const DECOMP_H_GAP = 24;
  const DECOMP_V_GAP = 90;

  const decompPositions = useMemo(() => {
    if (graphType !== 'decomposition-tree') return {};

    const visibleNodes = graphNodes.filter(n => visibleNodeIds.has(n.id));
    const visibleEdges = graphEdges.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));

    // Build parent→children adjacency
    const childMap = {};
    const hasParent = new Set();
    visibleEdges.forEach(e => {
      if (!childMap[e.from]) childMap[e.from] = [];
      childMap[e.from].push(e.to);
      hasParent.add(e.to);
    });

    // Root nodes: no parent in visible edges
    const roots = visibleNodes.filter(n => !hasParent.has(n.id));

    // Compute subtree widths (in card units)
    const subtreeWidth = {};
    const computeWidth = (nodeId) => {
      const children = childMap[nodeId] || [];
      if (children.length === 0) {
        subtreeWidth[nodeId] = 1;
        return 1;
      }
      let total = 0;
      children.forEach(cid => { total += computeWidth(cid); });
      subtreeWidth[nodeId] = total;
      return total;
    };
    roots.forEach(r => computeWidth(r.id));
    // Also compute for orphan nodes not in roots
    visibleNodes.forEach(n => {
      if (subtreeWidth[n.id] === undefined) subtreeWidth[n.id] = 1;
    });

    const positions = {};
    const unitWidth = DECOMP_CARD_W + DECOMP_H_GAP;

    const assignPositions = (nodeId, depth, leftOffset) => {
      const children = (childMap[nodeId] || []);
      const myWidth = subtreeWidth[nodeId] || 1;

      if (children.length === 0) {
        positions[nodeId] = {
          x: leftOffset + (myWidth * unitWidth) / 2 - DECOMP_CARD_W / 2,
          y: depth * (DECOMP_CARD_H + DECOMP_V_GAP) + 40
        };
        return;
      }

      let childOffset = leftOffset;
      children.forEach(cid => {
        const cw = subtreeWidth[cid] || 1;
        assignPositions(cid, depth + 1, childOffset);
        childOffset += cw * unitWidth;
      });

      // Center parent over children
      const firstChild = positions[children[0]];
      const lastChild = positions[children[children.length - 1]];
      positions[nodeId] = {
        x: (firstChild.x + lastChild.x) / 2,
        y: depth * (DECOMP_CARD_H + DECOMP_V_GAP) + 40
      };
    };

    let rootOffset = 0;
    roots.forEach(r => {
      const w = subtreeWidth[r.id] || 1;
      assignPositions(r.id, 0, rootOffset);
      rootOffset += w * unitWidth + 40;
    });

    // Place orphan nodes (visible but not connected) at the bottom
    let orphanX = 0;
    visibleNodes.forEach(n => {
      if (!positions[n.id]) {
        positions[n.id] = { x: orphanX, y: (roots.length > 0 ? 6 : 0) * (DECOMP_CARD_H + DECOMP_V_GAP) + 40 };
        orphanX += unitWidth;
      }
    });

    return positions;
  }, [graphType, graphNodes, graphEdges, visibleNodeIds]);

  // ── Canvas dimensions (shared) ──────────────────────────────────────

  const activePositions = graphType === 'decomposition-tree' ? decompPositions : nodePositions;

  const canvasWidth = useMemo(() => {
    let maxX = 1200;
    Object.values(activePositions).forEach(p => {
      const rightEdge = p.x + (graphType === 'decomposition-tree' ? DECOMP_CARD_W + 40 : 60);
      if (rightEdge > maxX) maxX = rightEdge;
    });
    return maxX;
  }, [activePositions, graphType]);

  const canvasHeight = useMemo(() => {
    let maxY = 800;
    Object.values(activePositions).forEach(p => {
      const bottomEdge = p.y + (graphType === 'decomposition-tree' ? DECOMP_CARD_H + 80 : 80);
      if (bottomEdge > maxY) maxY = bottomEdge;
    });
    return maxY;
  }, [activePositions, graphType]);

  // ── Sensitivity analysis ──────────────────────────────────────────────

  const sensitivityData = useMemo(() => {
    const results = [];
    const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const activePillars = pillars.filter(p => p.Status === 'Active');
    const objMap = {};
    objectives.forEach(o => { objMap[o.Code] = o; });
    const pillarMap = {};
    activePillars.forEach(p => { pillarMap[p.Code] = p; });

    kpis.filter(k => k.Status === 'Active').forEach(kpi => {
      const kpiWeight = parseFloat(kpi.Weight) || 0;
      const obj = objMap[kpi.Objective_Code];
      if (!obj || obj.Is_Operational || obj.Status !== 'Active') return;

      let pillarName = '';
      let compositeWeight = kpiWeight / 100;

      if ((obj.Level || '').toUpperCase() === 'L1') {
        const pillar = pillarMap[obj.Pillar_Code];
        pillarName = pillar?.Name || '';
      } else if ((obj.Level || '').toUpperCase() === 'L2') {
        const parent = objMap[obj.Parent_Objective_Code];
        if (parent) {
          const pillar = pillarMap[parent.Pillar_Code];
          pillarName = pillar?.Name || '';
        }
      } else if ((obj.Level || '').toUpperCase() === 'L3') {
        const parent = objMap[obj.Parent_Objective_Code];
        if (parent) {
          const grandparent = objMap[parent.Parent_Objective_Code];
          if (grandparent) {
            const pillar = pillarMap[grandparent.Pillar_Code];
            pillarName = pillar?.Name || '';
          }
        }
      }

      // Find achievement
      const measure = measures.find(m => m.KPI_Code === kpi.Code && m.Status === 'Active');
      let currentAchievement = null;
      if (measure && achievements?.[measure.Code]?.[monthKey] != null) {
        currentAchievement = parseFloat(achievements[measure.Code][monthKey]);
      }

      const achievementGap = currentAchievement !== null
        ? Math.max(0, 100 - currentAchievement)
        : 100;

      const leverageScore = compositeWeight * achievementGap;

      results.push({
        kpiCode: kpi.Code,
        kpiName: kpi.Name,
        objectiveCode: obj.Code,
        objectiveName: obj.Name,
        level: obj.Level,
        pillarName,
        kpiWeight,
        compositeWeight,
        currentAchievement,
        achievementGap,
        leverageScore,
        impactOf10Pct: compositeWeight * 10
      });
    });

    results.sort((a, b) => b.leverageScore - a.leverageScore);
    return results;
  }, [pillars, objectives, kpis, measures, achievements, selectedMonth, currentYear]);

  const topLeverageIds = useMemo(() => {
    return new Set(sensitivityData.slice(0, 5).map(s => s.kpiCode));
  }, [sensitivityData]);

  // ── Achievement color ─────────────────────────────────────────────────

  const getAchievementColor = useCallback((achievement) => {
    if (achievement === null || achievement === undefined) return '#ADB5BD';
    const excellent = parseFloat(settings.thresholdExcellent) || 100;
    const good = parseFloat(settings.thresholdGood) || 80;
    const warning = parseFloat(settings.thresholdWarning) || 60;
    if (achievement >= excellent) return settings.colorExcellent || '#28a745';
    if (achievement >= good) return settings.colorGood || '#ffc107';
    if (achievement >= warning) return settings.colorWarning || '#fd7e14';
    return settings.colorPoor || '#dc3545';
  }, [settings]);

  // ── Graph interaction ─────────────────────────────────────────────────

  const connectedIds = useMemo(() => {
    if (!selectedNode) return null;
    const ids = new Set([selectedNode]);
    let changed = true;
    while (changed) {
      changed = false;
      graphEdges.forEach(e => {
        if (ids.has(e.from) && !ids.has(e.to)) { ids.add(e.to); changed = true; }
        if (ids.has(e.to) && !ids.has(e.from)) { ids.add(e.from); changed = true; }
      });
    }
    return ids;
  }, [selectedNode, graphEdges]);

  const getNodeDetails = useCallback((nodeId) => {
    const node = graphNodes.find(n => n.id === nodeId);
    if (!node) return null;

    const upEdges = graphEdges.filter(e => e.to === nodeId);
    const downEdges = graphEdges.filter(e => e.from === nodeId);
    const upstream = upEdges.map(e => graphNodes.find(n => n.id === e.from)).filter(Boolean);
    const downstream = downEdges.map(e => graphNodes.find(n => n.id === e.to)).filter(Boolean);

    let achievement = null;
    if (node.type === 'kpi') {
      const measure = measures.find(m => m.KPI_Code === node.id && m.Status === 'Active');
      const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      if (measure && achievements?.[measure.Code]?.[monthKey] != null) {
        achievement = parseFloat(achievements[measure.Code][monthKey]);
      }
    }

    const sensitivity = sensitivityData.find(s => s.kpiCode === nodeId);

    return { node, upstream, downstream, achievement, sensitivity };
  }, [graphNodes, graphEdges, measures, achievements, selectedMonth, currentYear, sensitivityData]);

  // ── Render ────────────────────────────────────────────────────────────

  const hasData = graphNodes.length > 0;

  return (
    <div className="support-tab">
      <div className="support-graph">
        <div className="support-graph-main">
          {/* Controls */}
          <div className="support-graph-controls">
            <div className="support-graph-type-toggle">
              <button
                className={graphType === 'leaf-tree' ? 'active' : ''}
                onClick={() => setGraphType('leaf-tree')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="12" y1="14" x2="6" y2="16"/><line x1="12" y1="14" x2="18" y2="16"/>
                </svg>
                Leaf Tree
              </button>
              <button
                className={graphType === 'decomposition-tree' ? 'active' : ''}
                onClick={() => setGraphType('decomposition-tree')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <rect x="3" y="3" width="18" height="4" rx="1"/><rect x="1" y="13" width="8" height="4" rx="1"/><rect x="15" y="13" width="8" height="4" rx="1"/><line x1="12" y1="7" x2="12" y2="10"/><line x1="5" y1="13" x2="5" y2="10"/><line x1="19" y1="13" x2="19" y2="10"/><line x1="5" y1="10" x2="19" y2="10"/>
                </svg>
                Decomposition Tree
              </button>
            </div>

            <div className="support-graph-month-select">
              <label>Month:</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                {monthNames.map((m, i) => <option key={i} value={i}>{m} {currentYear}</option>)}
              </select>
            </div>

            <div className="support-graph-actions">
              <button onClick={expandAll} title="Expand All">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Expand All
              </button>
              <button onClick={collapseAll} title="Collapse All">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Collapse All
              </button>
              <span className="zoom-controls">
                <button onClick={() => setZoomLevel(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Zoom Out">-</button>
                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(z => Math.min(2, +(z + 0.25).toFixed(2)))} title="Zoom In">+</button>
                <button onClick={() => setZoomLevel(1)} title="Reset Zoom" className="zoom-reset">Reset</button>
              </span>
            </div>

            <div className="support-graph-legend">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <span key={type} className="support-legend-item">
                  <span className="support-legend-dot" style={{ background: color }}></span>
                  {NODE_TYPE_LABELS[type]}
                </span>
              ))}
            </div>
          </div>

          {/* Canvas */}
          {!hasData ? (
            <div className="support-graph-empty">
              <p>No strategy data loaded. Open a file to see the dependency graph.</p>
            </div>
          ) : (
            <div className="support-graph-canvas-wrapper">
              <svg
                className="support-graph-canvas"
                width={canvasWidth * zoomLevel}
                height={canvasHeight * zoomLevel}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                onClick={(e) => { if (e.target === e.currentTarget || e.target.tagName === 'svg') setSelectedNode(null); }}
              >
                <defs>
                  <marker id="sg-arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 3 L 0 6 z" fill="#ADB5BD" />
                  </marker>
                </defs>

                {/* ── Leaf Tree View ── */}
                {graphType === 'leaf-tree' && (
                  <g>
                    {/* Edges */}
                    {graphEdges.map((edge, i) => {
                      if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) return null;
                      const fromPos = nodePositions[edge.from];
                      const toPos = nodePositions[edge.to];
                      if (!fromPos || !toPos) return null;

                      const style = EDGE_STYLES[edge.type] || EDGE_STYLES['parent-child'];
                      const isDimmed = connectedIds && !connectedIds.has(edge.from) && !connectedIds.has(edge.to);

                      const sx = fromPos.x;
                      const sy = fromPos.y + 20;
                      const tx = toPos.x;
                      const ty = toPos.y - 20;
                      const cy1 = sy + (ty - sy) * 0.4;
                      const cy2 = sy + (ty - sy) * 0.6;

                      return (
                        <path
                          key={i}
                          d={`M ${sx} ${sy} C ${sx} ${cy1}, ${tx} ${cy2}, ${tx} ${ty}`}
                          fill="none"
                          stroke={style.stroke}
                          strokeWidth={style.width}
                          strokeDasharray={style.dasharray}
                          opacity={isDimmed ? 0.08 : 0.5}
                          markerEnd="url(#sg-arrow)"
                        />
                      );
                    })}

                    {/* Nodes */}
                    {graphNodes.filter(n => visibleNodeIds.has(n.id)).map(node => {
                      const pos = nodePositions[node.id];
                      if (!pos) return null;

                      const isDimmed = connectedIds && !connectedIds.has(node.id);
                      const isSelected = selectedNode === node.id;
                      const isHovered = hoveredNode === node.id;
                      const isTopLeverage = topLeverageIds.has(node.id);
                      const hasChildren = childCountMap[node.id] > 0;
                      const isCollapsed = collapsedNodes.has(node.id);

                      let fillColor = NODE_COLORS[node.type] || '#ADB5BD';
                      if (node.type === 'kpi') {
                        const measure = measures.find(m => m.KPI_Code === node.id && m.Status === 'Active');
                        const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                        const ach = measure && achievements?.[measure.Code]?.[monthKey] != null
                          ? parseFloat(achievements[measure.Code][monthKey])
                          : null;
                        fillColor = getAchievementColor(ach);
                      }
                      if (node.type === 'pillar' && node.color) fillColor = node.color;

                      const baseRadius = node.type === 'pillar' ? 24
                        : node.type.startsWith('objective') ? 18
                        : node.type === 'kpi' ? 16
                        : node.type === 'measure' ? 14
                        : 12;
                      const weightScale = node.weight ? Math.min(node.weight / 30, 1.5) : 1;
                      const r = Math.max(10, baseRadius * weightScale);

                      const truncLabel = node.label.length > 18 ? node.label.substring(0, 16) + '...' : node.label;

                      return (
                        <g
                          key={node.id}
                          className={`support-graph-node ${isDimmed ? 'dimmed' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedNode(node.id); }}
                          onDoubleClick={(e) => { if (hasChildren) toggleCollapse(node.id, e); }}
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {isTopLeverage && (
                            <circle cx={pos.x} cy={pos.y} r={r + 10} fill="none" stroke={fillColor} strokeWidth="2" className="sensitivity-halo" />
                          )}
                          {isSelected && (
                            <circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke="#4472C4" strokeWidth="3" />
                          )}
                          <circle cx={pos.x} cy={pos.y} r={r} fill={fillColor} stroke={isHovered ? '#fff' : 'rgba(255,255,255,0.3)'} strokeWidth={isHovered ? 2 : 1} />
                          <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" className="support-graph-label" fontSize="11">{truncLabel}</text>
                          {node.weight > 0 && (
                            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600">{node.weight}%</text>
                          )}

                          {/* Collapse/expand button */}
                          {hasChildren && (
                            <g onClick={(e) => toggleCollapse(node.id, e)} className="collapse-btn-group">
                              <circle cx={pos.x} cy={pos.y + r + 28} r="8" fill="#fff" stroke="#6c757d" strokeWidth="1.5" />
                              <text x={pos.x} y={pos.y + r + 32} textAnchor="middle" fontSize="13" fontWeight="700" fill="#495057">
                                {isCollapsed ? '+' : '-'}
                              </text>
                            </g>
                          )}

                          {/* Hidden children badge */}
                          {isCollapsed && hiddenDescendantCount[node.id] > 0 && (
                            <g>
                              <rect x={pos.x + r + 2} y={pos.y - 10} width={28} height={16} rx="8" fill="#6c757d" />
                              <text x={pos.x + r + 16} y={pos.y + 1} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">
                                +{hiddenDescendantCount[node.id]}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* ── Decomposition Tree View ── */}
                {graphType === 'decomposition-tree' && (
                  <g>
                    {/* Elbow connector edges */}
                    {graphEdges.map((edge, i) => {
                      if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) return null;
                      const fromPos = decompPositions[edge.from];
                      const toPos = decompPositions[edge.to];
                      if (!fromPos || !toPos) return null;

                      const isDimmed = connectedIds && !connectedIds.has(edge.from) && !connectedIds.has(edge.to);
                      const style = EDGE_STYLES[edge.type] || EDGE_STYLES['parent-child'];

                      const sx = fromPos.x + DECOMP_CARD_W / 2;
                      const sy = fromPos.y + DECOMP_CARD_H;
                      const tx = toPos.x + DECOMP_CARD_W / 2;
                      const ty = toPos.y;
                      const midY = sy + (ty - sy) / 2;

                      return (
                        <path
                          key={`decomp-edge-${i}`}
                          d={`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`}
                          fill="none"
                          stroke={style.stroke}
                          strokeWidth={style.width}
                          strokeDasharray={style.dasharray}
                          opacity={isDimmed ? 0.08 : 0.45}
                        />
                      );
                    })}

                    {/* Rectangular card nodes */}
                    {graphNodes.filter(n => visibleNodeIds.has(n.id)).map(node => {
                      const pos = decompPositions[node.id];
                      if (!pos) return null;

                      const isDimmed = connectedIds && !connectedIds.has(node.id);
                      const isSelected = selectedNode === node.id;
                      const isHovered = hoveredNode === node.id;
                      const isTopLeverage = topLeverageIds.has(node.id);
                      const hasChildren = childCountMap[node.id] > 0;
                      const isCollapsed = collapsedNodes.has(node.id);

                      let fillColor = NODE_COLORS[node.type] || '#ADB5BD';
                      if (node.type === 'kpi') {
                        const measure = measures.find(m => m.KPI_Code === node.id && m.Status === 'Active');
                        const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                        const ach = measure && achievements?.[measure.Code]?.[monthKey] != null
                          ? parseFloat(achievements[measure.Code][monthKey])
                          : null;
                        fillColor = getAchievementColor(ach);
                      }
                      if (node.type === 'pillar' && node.color) fillColor = node.color;

                      const truncLabel = node.label.length > 22 ? node.label.substring(0, 20) + '...' : node.label;

                      return (
                        <g
                          key={node.id}
                          className={`support-graph-node decomp-node ${isDimmed ? 'dimmed' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedNode(node.id); }}
                          onDoubleClick={(e) => { if (hasChildren) toggleCollapse(node.id, e); }}
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Sensitivity pulse halo */}
                          {isTopLeverage && (
                            <rect
                              x={pos.x - 4} y={pos.y - 4}
                              width={DECOMP_CARD_W + 8} height={DECOMP_CARD_H + 8}
                              rx="8" fill="none" stroke={fillColor} strokeWidth="2"
                              className="sensitivity-halo"
                            />
                          )}

                          {/* Selection highlight */}
                          {isSelected && (
                            <rect
                              x={pos.x - 3} y={pos.y - 3}
                              width={DECOMP_CARD_W + 6} height={DECOMP_CARD_H + 6}
                              rx="7" fill="none" stroke="#4472C4" strokeWidth="3"
                            />
                          )}

                          {/* Card background */}
                          <rect
                            x={pos.x} y={pos.y}
                            width={DECOMP_CARD_W} height={DECOMP_CARD_H}
                            rx="6" fill="#fff"
                            stroke={isHovered ? '#4472C4' : '#dee2e6'}
                            strokeWidth={isHovered ? 2 : 1}
                            className="decomp-card-bg"
                          />

                          {/* Left color stripe */}
                          <rect
                            x={pos.x} y={pos.y}
                            width={5} height={DECOMP_CARD_H}
                            rx="0" fill={fillColor}
                            style={{ clipPath: 'inset(0 0 0 0 round 6px 0 0 6px)' }}
                          />
                          <rect x={pos.x} y={pos.y} width={5} height={DECOMP_CARD_H} fill={fillColor} />
                          {/* Rounded left corners */}
                          <rect x={pos.x} y={pos.y} width={6} height={DECOMP_CARD_H} rx="6" fill={fillColor} />
                          <rect x={pos.x + 3} y={pos.y} width={3} height={DECOMP_CARD_H} fill={fillColor} />

                          {/* Type label */}
                          <text x={pos.x + 14} y={pos.y + 15} fontSize="9" fill="#6c757d" fontWeight="500" className="decomp-type-label">
                            {NODE_TYPE_LABELS[node.type]}
                          </text>

                          {/* Node label */}
                          <text x={pos.x + 14} y={pos.y + 32} fontSize="11" fontWeight="600" fill="#212529" className="decomp-card-label">
                            {truncLabel}
                          </text>

                          {/* Weight badge */}
                          {node.weight > 0 && (
                            <g>
                              <rect x={pos.x + DECOMP_CARD_W - 38} y={pos.y + 6} width={30} height={16} rx="8" fill={fillColor} opacity="0.9" />
                              <text x={pos.x + DECOMP_CARD_W - 23} y={pos.y + 17} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">
                                {node.weight}%
                              </text>
                            </g>
                          )}

                          {/* Hidden children badge */}
                          {isCollapsed && hiddenDescendantCount[node.id] > 0 && (
                            <g>
                              <rect x={pos.x + DECOMP_CARD_W - 38} y={pos.y + DECOMP_CARD_H - 20} width={30} height={14} rx="7" fill="#6c757d" />
                              <text x={pos.x + DECOMP_CARD_W - 23} y={pos.y + DECOMP_CARD_H - 10} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="600">
                                +{hiddenDescendantCount[node.id]}
                              </text>
                            </g>
                          )}

                          {/* Collapse/expand button at bottom center */}
                          {hasChildren && (
                            <g onClick={(e) => toggleCollapse(node.id, e)} className="collapse-btn-group">
                              <circle cx={pos.x + DECOMP_CARD_W / 2} cy={pos.y + DECOMP_CARD_H + 10} r="8" fill="#fff" stroke="#6c757d" strokeWidth="1.5" />
                              <text x={pos.x + DECOMP_CARD_W / 2} y={pos.y + DECOMP_CARD_H + 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="#495057">
                                {isCollapsed ? '+' : '-'}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}
              </svg>

              {/* Tooltip */}
              {hoveredNode && activePositions[hoveredNode] && (
                <div
                  className="support-graph-tooltip"
                  style={{
                    left: (activePositions[hoveredNode].x + (graphType === 'decomposition-tree' ? DECOMP_CARD_W + 10 : 20)) * zoomLevel,
                    top: (activePositions[hoveredNode].y - 10) * zoomLevel
                  }}
                >
                  {(() => {
                    const node = graphNodes.find(n => n.id === hoveredNode);
                    if (!node) return null;
                    const sens = sensitivityData.find(s => s.kpiCode === node.id);
                    return (
                      <>
                        <strong>{node.label}</strong>
                        <div className="tooltip-type">{NODE_TYPE_LABELS[node.type]}</div>
                        {node.weight > 0 && <div>Weight: {node.weight}%</div>}
                        {sens && sens.currentAchievement !== null && (
                          <div>Achievement: {sens.currentAchievement.toFixed(1)}%</div>
                        )}
                        {sens && <div>Leverage: {sens.leverageScore.toFixed(2)}</div>}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Sensitivity Panel */}
          {hasData && sensitivityData.length > 0 && (
            <div className="support-sensitivity-panel">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                Highest-Leverage Improvement Opportunities
              </h3>
              <p className="sensitivity-description">
                KPIs ranked by potential impact — improving these will have the largest effect on overall organizational performance.
              </p>
              <div className="sensitivity-table-wrapper">
                <table className="sensitivity-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>KPI</th>
                      <th>Objective</th>
                      <th>Pillar</th>
                      <th>Weight</th>
                      <th>Achievement</th>
                      <th>Gap</th>
                      <th>Leverage</th>
                      <th>+10% Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityData.slice(0, 10).map((s, i) => (
                      <tr
                        key={s.kpiCode}
                        className={`sensitivity-row ${selectedNode === s.kpiCode ? 'active' : ''} ${i < 5 ? 'top-leverage' : ''}`}
                        onClick={() => setSelectedNode(s.kpiCode)}
                      >
                        <td className="rank-cell">{i + 1}</td>
                        <td className="kpi-name-cell">{s.kpiName}</td>
                        <td>{s.objectiveName}</td>
                        <td>{s.pillarName}</td>
                        <td>{s.kpiWeight}%</td>
                        <td>
                          <span
                            className="achievement-badge"
                            style={{ background: getAchievementColor(s.currentAchievement), color: '#fff' }}
                          >
                            {s.currentAchievement !== null ? `${s.currentAchievement.toFixed(1)}%` : 'No data'}
                          </span>
                        </td>
                        <td>{s.achievementGap.toFixed(1)}%</td>
                        <td className="leverage-cell">{s.leverageScore.toFixed(2)}</td>
                        <td className="impact-cell">+{s.impactOf10Pct.toFixed(2)}pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="support-graph-detail-panel">
            {(() => {
              const details = getNodeDetails(selectedNode);
              if (!details) return <p>Node not found.</p>;
              const { node, upstream, downstream, achievement, sensitivity } = details;
              return (
                <>
                  <div className="detail-header">
                    <span className="detail-type-badge" style={{ background: NODE_COLORS[node.type] || '#ADB5BD' }}>
                      {NODE_TYPE_LABELS[node.type]}
                    </span>
                    <button className="detail-close" onClick={() => setSelectedNode(null)}>&times;</button>
                  </div>
                  <h3 className="detail-name">{node.label}</h3>
                  <p className="detail-code">{node.id}</p>

                  {node.weight > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Weight</span>
                      <span className="detail-value">{node.weight}%</span>
                    </div>
                  )}

                  {achievement !== null && (
                    <div className="detail-row">
                      <span className="detail-label">Achievement ({monthNames[selectedMonth]})</span>
                      <span className="detail-value" style={{ color: getAchievementColor(achievement) }}>
                        {achievement.toFixed(1)}%
                      </span>
                    </div>
                  )}

                  {sensitivity && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Composite Weight</span>
                        <span className="detail-value">{(sensitivity.compositeWeight * 100).toFixed(1)}%</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Leverage Score</span>
                        <span className="detail-value">{sensitivity.leverageScore.toFixed(2)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">+10% Impact</span>
                        <span className="detail-value">+{sensitivity.impactOf10Pct.toFixed(2)} pts</span>
                      </div>
                    </>
                  )}

                  {upstream.length > 0 && (
                    <div className="detail-connections">
                      <h4>Upstream</h4>
                      {upstream.map(u => (
                        <button
                          key={u.id}
                          className="detail-conn-item"
                          onClick={() => setSelectedNode(u.id)}
                        >
                          <span className="conn-dot" style={{ background: NODE_COLORS[u.type] || '#ADB5BD' }}></span>
                          {u.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {downstream.length > 0 && (
                    <div className="detail-connections">
                      <h4>Downstream</h4>
                      {downstream.map(d => (
                        <button
                          key={d.id}
                          className="detail-conn-item"
                          onClick={() => setSelectedNode(d.id)}
                        >
                          <span className="conn-dot" style={{ background: NODE_COLORS[d.type] || '#ADB5BD' }}></span>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsTab;
