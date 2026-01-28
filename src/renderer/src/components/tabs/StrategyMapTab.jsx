import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStrategy } from '../../contexts/StrategyContext';

function StrategyMapTab() {
  const {
    pillars,
    perspectives,
    objectives,
    objectiveLinks,
    addObjectiveLink,
    updateObjectiveLink,
    removeObjectiveLink,
    mapPositions,
    setMapPosition,
    updatePillar
  } = useStrategy();

  const canvasRef = useRef(null);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [localPositions, setLocalPositions] = useState({}); // For computed/dragging positions
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const prevMapPositionsRef = useRef(null);

  // Clear local positions when mapPositions is loaded from file (goes from empty to having data)
  useEffect(() => {
    const prevKeys = prevMapPositionsRef.current ? Object.keys(prevMapPositionsRef.current) : [];
    const currentKeys = Object.keys(mapPositions);

    // Detect file load: mapPositions goes from empty/different to having data
    // Only clear if we're getting a fresh set of positions (not just an update from dragging)
    if (currentKeys.length > 0 && prevKeys.length === 0) {
      // File was loaded - clear local positions so saved ones are used
      setLocalPositions({});
    }

    prevMapPositionsRef.current = mapPositions;
  }, [mapPositions]);

  // Merge: localPositions takes priority (for dragging), then mapPositions (saved)
  const objectivePositions = useMemo(() => {
    return { ...mapPositions, ...localPositions };
  }, [localPositions, mapPositions]);

  // Linking state
  const [isLinking, setIsLinking] = useState(false);
  const [linkSource, setLinkSource] = useState(null);
  const [tempLinkEnd, setTempLinkEnd] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);

  // Waypoint editing state
  const [draggingWaypoint, setDraggingWaypoint] = useState(null);
  const [editingLink, setEditingLink] = useState(null);

  // Color picker state
  const [colorPickerPillar, setColorPickerPillar] = useState(null);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });

  // Default colors for pillars
  const DEFAULT_PILLAR_COLORS = [
    '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
    '#70AD47', '#9E480E', '#997300', '#264478', '#636363'
  ];

  // Objective box dimensions
  const OBJECTIVE_WIDTH = 160;
  const OBJECTIVE_HEIGHT = 60;
  const ANCHOR_RADIUS = 8;

  // Get L1 strategic objectives
  const l1Objectives = useMemo(() => {
    return objectives.filter(obj => obj.Level === 'L1' && !obj.Is_Operational);
  }, [objectives]);

  // Get active pillars and perspectives
  const activePillars = useMemo(() => {
    return pillars.filter(p => p.Status === 'Active');
  }, [pillars]);

  const activePerspectives = useMemo(() => {
    return perspectives.filter(p => p.Status === 'Active');
  }, [perspectives]);

  // Calculate grid dimensions
  const gridConfig = useMemo(() => {
    const hasPerspectives = activePerspectives.length > 0;
    const pillarCount = Math.max(activePillars.length, 1);
    const perspectiveCount = hasPerspectives ? Math.max(activePerspectives.length, 1) : 1;

    const headerHeight = 60;
    const sidebarWidth = hasPerspectives ? 150 : 0;
    const pillarRowHeight = Math.max(150, (canvasSize.height - headerHeight) / pillarCount);
    const perspectiveColWidth = hasPerspectives
      ? (canvasSize.width - sidebarWidth) / perspectiveCount
      : canvasSize.width;

    return {
      hasPerspectives,
      pillarCount,
      perspectiveCount,
      headerHeight,
      sidebarWidth,
      pillarRowHeight,
      perspectiveColWidth
    };
  }, [activePillars, activePerspectives, canvasSize]);

  // Initialize objective positions based on pillar/perspective
  // Only compute positions for objectives that don't have saved positions
  useEffect(() => {
    const newPositions = {};
    l1Objectives.forEach((obj, index) => {
      // Skip if position already exists in context (saved) or local state
      if (mapPositions[obj.Code] || localPositions[obj.Code]) {
        return;
      }

      const pillarIndex = activePillars.findIndex(p => p.Code === obj.Pillar_Code);
      const perspectiveIndex = activePerspectives.findIndex(p => p.Code === obj.Perspective_Code);

      const row = pillarIndex >= 0 ? pillarIndex : 0;
      const col = perspectiveIndex >= 0 ? perspectiveIndex : 0;

      const baseX = gridConfig.sidebarWidth + (col * gridConfig.perspectiveColWidth) + 20;
      const baseY = gridConfig.headerHeight + (row * gridConfig.pillarRowHeight) + 20;

      const objectivesInCell = l1Objectives.filter((o, i) => {
        const pIdx = activePillars.findIndex(p => p.Code === o.Pillar_Code);
        const perIdx = activePerspectives.findIndex(p => p.Code === o.Perspective_Code);
        return (pIdx === pillarIndex || (pIdx < 0 && pillarIndex < 0)) &&
               (perIdx === perspectiveIndex || (perIdx < 0 && perspectiveIndex < 0)) &&
               i < index;
      }).length;

      newPositions[obj.Code] = {
        x: baseX + (objectivesInCell % 3) * 180,
        y: baseY + Math.floor(objectivesInCell / 3) * 80
      };
    });

    if (Object.keys(newPositions).length > 0) {
      setLocalPositions(prev => ({ ...prev, ...newPositions }));
    }
  }, [l1Objectives, activePillars, activePerspectives, gridConfig, mapPositions, localPositions]);

  // Get the 4 anchor points for an objective
  const getAnchorPoints = useCallback((code) => {
    const pos = objectivePositions[code] || { x: 0, y: 0 };
    return {
      top: { x: pos.x + OBJECTIVE_WIDTH / 2, y: pos.y, side: 'top' },
      right: { x: pos.x + OBJECTIVE_WIDTH, y: pos.y + OBJECTIVE_HEIGHT / 2, side: 'right' },
      bottom: { x: pos.x + OBJECTIVE_WIDTH / 2, y: pos.y + OBJECTIVE_HEIGHT, side: 'bottom' },
      left: { x: pos.x, y: pos.y + OBJECTIVE_HEIGHT / 2, side: 'left' }
    };
  }, [objectivePositions]);

  // Find the best anchor pair between two objectives
  const findBestAnchors = useCallback((fromCode, toCode, preferredFromSide = null, preferredToSide = null) => {
    const fromAnchors = getAnchorPoints(fromCode);
    const toAnchors = getAnchorPoints(toCode);

    // If preferred sides are specified and valid, use them
    if (preferredFromSide && preferredToSide && fromAnchors[preferredFromSide] && toAnchors[preferredToSide]) {
      return { fromPoint: fromAnchors[preferredFromSide], toPoint: toAnchors[preferredToSide] };
    }

    // Find the pair with minimum distance
    let minDist = Infinity;
    let bestFrom = fromAnchors.right;
    let bestTo = toAnchors.left;

    for (const fromSide of ['top', 'right', 'bottom', 'left']) {
      for (const toSide of ['top', 'right', 'bottom', 'left']) {
        const from = fromAnchors[fromSide];
        const to = toAnchors[toSide];
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        if (dist < minDist) {
          minDist = dist;
          bestFrom = from;
          bestTo = to;
        }
      }
    }

    return { fromPoint: bestFrom, toPoint: bestTo };
  }, [getAnchorPoints]);

  // Parse waypoints from string
  const parseWaypoints = (waypointsStr) => {
    if (!waypointsStr) return [];
    try {
      return JSON.parse(waypointsStr);
    } catch {
      return [];
    }
  };

  // Generate path with waypoints - always 90-degree angles only
  const generatePath = useCallback((start, end, waypoints = []) => {
    const OFFSET = 25;
    let points = [{ x: start.x, y: start.y }];

    // Determine start direction (horizontal or vertical based on side)
    const startHorizontal = start.side === 'left' || start.side === 'right';
    const endHorizontal = end.side === 'left' || end.side === 'right';

    // Exit perpendicular from start
    let exitPoint;
    if (start.side === 'right') exitPoint = { x: start.x + OFFSET, y: start.y };
    else if (start.side === 'left') exitPoint = { x: start.x - OFFSET, y: start.y };
    else if (start.side === 'top') exitPoint = { x: start.x, y: start.y - OFFSET };
    else if (start.side === 'bottom') exitPoint = { x: start.x, y: start.y + OFFSET };
    else exitPoint = { x: start.x + OFFSET, y: start.y };

    points.push(exitPoint);

    // Entry point (before final point)
    let entryPoint;
    if (end.side === 'right') entryPoint = { x: end.x + OFFSET, y: end.y };
    else if (end.side === 'left') entryPoint = { x: end.x - OFFSET, y: end.y };
    else if (end.side === 'top') entryPoint = { x: end.x, y: end.y - OFFSET };
    else if (end.side === 'bottom') entryPoint = { x: end.x, y: end.y + OFFSET };
    else entryPoint = { x: end.x - OFFSET, y: end.y };

    if (waypoints.length === 0) {
      // No waypoints - automatic perpendicular routing
      if (startHorizontal && endHorizontal) {
        const midX = (exitPoint.x + entryPoint.x) / 2;
        points.push({ x: midX, y: exitPoint.y });
        points.push({ x: midX, y: entryPoint.y });
      } else if (!startHorizontal && !endHorizontal) {
        const midY = (exitPoint.y + entryPoint.y) / 2;
        points.push({ x: exitPoint.x, y: midY });
        points.push({ x: entryPoint.x, y: midY });
      } else if (startHorizontal && !endHorizontal) {
        points.push({ x: entryPoint.x, y: exitPoint.y });
      } else {
        points.push({ x: exitPoint.x, y: entryPoint.y });
      }
    } else {
      // With waypoints - route through each with 90-degree turns only
      let currentPoint = exitPoint;
      let currentDirection = startHorizontal ? 'horizontal' : 'vertical';

      for (const wp of waypoints) {
        // Create 90-degree path from current point to waypoint
        if (currentDirection === 'horizontal') {
          // Go horizontal first, then vertical
          if (currentPoint.x !== wp.x) {
            points.push({ x: wp.x, y: currentPoint.y });
          }
          if (currentPoint.y !== wp.y) {
            points.push({ x: wp.x, y: wp.y });
          }
          currentDirection = 'vertical';
        } else {
          // Go vertical first, then horizontal
          if (currentPoint.y !== wp.y) {
            points.push({ x: currentPoint.x, y: wp.y });
          }
          if (currentPoint.x !== wp.x) {
            points.push({ x: wp.x, y: wp.y });
          }
          currentDirection = 'horizontal';
        }
        currentPoint = wp;
      }

      // Route from last waypoint to entry point with 90-degree turns
      if (currentDirection === 'horizontal') {
        if (currentPoint.x !== entryPoint.x) {
          points.push({ x: entryPoint.x, y: currentPoint.y });
        }
        if (currentPoint.y !== entryPoint.y) {
          points.push({ x: entryPoint.x, y: entryPoint.y });
        }
      } else {
        if (currentPoint.y !== entryPoint.y) {
          points.push({ x: currentPoint.x, y: entryPoint.y });
        }
        if (currentPoint.x !== entryPoint.x) {
          points.push({ x: entryPoint.x, y: entryPoint.y });
        }
      }
    }

    points.push(entryPoint);
    points.push({ x: end.x, y: end.y });

    // Build path string - remove duplicate consecutive points
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      if (points[i].x !== points[i-1].x || points[i].y !== points[i-1].y) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
    }
    return path;
  }, []);

  // Handle starting a link from an anchor
  const handleAnchorMouseDown = (e, objCode, side) => {
    e.stopPropagation();
    e.preventDefault();
    setIsLinking(true);
    setLinkSource({ code: objCode, side });
    setSelectedObjective(null);
    setSelectedLink(null);

    const rect = canvasRef.current.getBoundingClientRect();
    const anchors = getAnchorPoints(objCode);
    setTempLinkEnd({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      side: null,
      targetCode: null
    });
  };

  // Handle mouse down on objective (for dragging)
  const handleObjectiveMouseDown = (e, obj) => {
    if (isLinking) return;
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const pos = objectivePositions[obj.Code] || { x: 0, y: 0 };

    setDragging({
      code: obj.Code,
      offsetX: e.clientX - rect.left - pos.x,
      offsetY: e.clientY - rect.top - pos.y
    });
  };

  // Handle waypoint drag start
  const handleWaypointMouseDown = (e, linkKey, waypointIndex) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingWaypoint({ linkKey, waypointIndex });
  };

  // Find objective at position
  const findObjectiveAtPosition = useCallback((x, y, excludeCode = null) => {
    return l1Objectives.find(obj => {
      if (obj.Code === excludeCode) return false;
      const pos = objectivePositions[obj.Code];
      if (!pos) return false;
      return x >= pos.x - 10 && x <= pos.x + OBJECTIVE_WIDTH + 10 &&
             y >= pos.y - 10 && y <= pos.y + OBJECTIVE_HEIGHT + 10;
    });
  }, [l1Objectives, objectivePositions]);

  // Find best anchor on target objective
  const findNearestAnchor = useCallback((targetCode, fromX, fromY) => {
    const anchors = getAnchorPoints(targetCode);
    let minDist = Infinity;
    let bestAnchor = anchors.left;

    for (const side of ['top', 'right', 'bottom', 'left']) {
      const anchor = anchors[side];
      const dist = Math.hypot(anchor.x - fromX, anchor.y - fromY);
      if (dist < minDist) {
        minDist = dist;
        bestAnchor = anchor;
      }
    }
    return bestAnchor;
  }, [getAnchorPoints]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingWaypoint) {
      // Dragging a waypoint
      const { linkKey, waypointIndex } = draggingWaypoint;
      const [fromCode, toCode] = linkKey.split('->');
      const link = objectiveLinks.find(l => l.From_Code === fromCode && l.To_Code === toCode);
      if (link) {
        const waypoints = parseWaypoints(link.Waypoints);
        waypoints[waypointIndex] = { x: mouseX, y: mouseY };
        updateObjectiveLink(fromCode, toCode, { Waypoints: JSON.stringify(waypoints) });
      }
    } else if (isLinking && linkSource) {
      // Creating a new link - use MOUSE position for finding nearest anchor on target
      const hoverObj = findObjectiveAtPosition(mouseX, mouseY, linkSource.code);

      if (hoverObj) {
        // Find anchor closest to MOUSE position, not source
        const bestAnchor = findNearestAnchor(hoverObj.Code, mouseX, mouseY);
        setTempLinkEnd({
          x: bestAnchor.x,
          y: bestAnchor.y,
          side: bestAnchor.side,
          targetCode: hoverObj.Code
        });
      } else {
        setTempLinkEnd({
          x: mouseX,
          y: mouseY,
          side: null,
          targetCode: null
        });
      }
    } else if (dragging) {
      // Dragging an objective - update local state for smooth dragging
      const x = Math.max(0, Math.min(mouseX - dragging.offsetX, canvasSize.width - OBJECTIVE_WIDTH));
      const y = Math.max(gridConfig.headerHeight, Math.min(mouseY - dragging.offsetY, canvasSize.height - OBJECTIVE_HEIGHT));

      setLocalPositions(prev => ({
        ...prev,
        [dragging.code]: { x, y }
      }));
    }
  }, [dragging, draggingWaypoint, isLinking, linkSource, canvasSize, gridConfig.headerHeight,
      findObjectiveAtPosition, findNearestAnchor, objectiveLinks, updateObjectiveLink]);

  // Handle mouse up
  const handleMouseUp = useCallback((e) => {
    if (draggingWaypoint) {
      setDraggingWaypoint(null);
    } else if (isLinking && linkSource && tempLinkEnd?.targetCode) {
      // Create the link with side information
      addObjectiveLink(
        linkSource.code,
        tempLinkEnd.targetCode,
        linkSource.side,
        tempLinkEnd.side
      );
      setIsLinking(false);
      setLinkSource(null);
      setTempLinkEnd(null);
    } else if (isLinking) {
      setIsLinking(false);
      setLinkSource(null);
      setTempLinkEnd(null);
    } else if (dragging) {
      // Save the final position to context (marks file as changed)
      const pos = localPositions[dragging.code];
      if (pos) {
        setMapPosition(dragging.code, pos.x, pos.y);
      }
    }
    setDragging(null);
  }, [isLinking, linkSource, tempLinkEnd, draggingWaypoint, dragging, localPositions, addObjectiveLink, setMapPosition]);

  // Handle double-click on path to add waypoint
  const handlePathDoubleClick = (e, fromCode, toCode) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const link = objectiveLinks.find(l => l.From_Code === fromCode && l.To_Code === toCode);
    if (link) {
      const waypoints = parseWaypoints(link.Waypoints);
      waypoints.push({ x, y });
      updateObjectiveLink(fromCode, toCode, { Waypoints: JSON.stringify(waypoints) });
      // Auto-select the link to show waypoints
      setSelectedLink({ fromCode, toCode });
      setSelectedObjective(null);
    }
  };

  // Clear all waypoints from a link
  const handleClearWaypoints = () => {
    if (selectedLink) {
      updateObjectiveLink(selectedLink.fromCode, selectedLink.toCode, { Waypoints: '' });
    }
  };

  // Handle clicking on a link to select it
  const handleLinkClick = (e, fromCode, toCode) => {
    e.stopPropagation();
    setSelectedLink({ fromCode, toCode });
    setSelectedObjective(null);
  };

  // Handle deleting selected link
  const handleDeleteLink = () => {
    if (selectedLink) {
      removeObjectiveLink(selectedLink.fromCode, selectedLink.toCode);
      setSelectedLink(null);
    }
  };

  // Handle deleting a waypoint
  const handleDeleteWaypoint = (linkKey, waypointIndex) => {
    const [fromCode, toCode] = linkKey.split('->');
    const link = objectiveLinks.find(l => l.From_Code === fromCode && l.To_Code === toCode);
    if (link) {
      const waypoints = parseWaypoints(link.Waypoints);
      waypoints.splice(waypointIndex, 1);
      updateObjectiveLink(fromCode, toCode, { Waypoints: JSON.stringify(waypoints) });
    }
  };

  // Add/remove event listeners
  useEffect(() => {
    if (dragging || isLinking || draggingWaypoint) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, isLinking, draggingWaypoint, handleMouseMove, handleMouseUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isLinking) {
          setIsLinking(false);
          setLinkSource(null);
          setTempLinkEnd(null);
        }
        setSelectedLink(null);
        setSelectedObjective(null);
        setColorPickerPillar(null);
      }
      if (e.key === 'Delete' && selectedLink) {
        handleDeleteLink();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLinking, selectedLink]);

  // Get pillar color - uses saved color or falls back to default
  const getPillarColor = useCallback((pillarCode, index) => {
    const pillar = activePillars.find(p => p.Code === pillarCode);
    if (pillar?.Color) {
      return pillar.Color;
    }
    const pillarIndex = activePillars.findIndex(p => p.Code === pillarCode);
    return DEFAULT_PILLAR_COLORS[(pillarIndex >= 0 ? pillarIndex : index) % DEFAULT_PILLAR_COLORS.length];
  }, [activePillars]);

  // Determine if a color is dark (returns true) or light (returns false)
  const isColorDark = useCallback((color) => {
    // Convert hex to RGB
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }, []);

  // Get text color based on background color
  const getTextColor = useCallback((bgColor) => {
    return isColorDark(bgColor) ? '#FFFFFF' : '#000000';
  }, [isColorDark]);

  // Handle pillar label click to open color picker
  const handlePillarClick = (e, pillar) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setColorPickerPosition({
      x: rect.right - canvasRect.left + 10,
      y: rect.top - canvasRect.top
    });
    setColorPickerPillar(pillar);
    setSelectedObjective(null);
    setSelectedLink(null);
  };

  // Handle color selection
  const handleColorSelect = (color) => {
    if (colorPickerPillar) {
      updatePillar(colorPickerPillar.Code, { Color: color });
      setColorPickerPillar(null);
    }
  };

  // Click on canvas to deselect
  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('objectives-layer') || e.target.classList.contains('strategy-map-canvas')) {
      setSelectedObjective(null);
      setSelectedLink(null);
      setColorPickerPillar(null);
    }
  };

  return (
    <div className="strategy-map-tab">
      <div className="strategy-map-header">
        <h2>Strategy Map</h2>
        <p className="section-description">
          Drag from anchor dots to connect objectives. Double-click a line to add waypoints for custom routing.
        </p>
      </div>

      <div className="strategy-map-container">
        <div
          ref={canvasRef}
          className={`strategy-map-canvas ${isLinking ? 'linking-mode' : ''}`}
          style={{ width: canvasSize.width, height: canvasSize.height }}
          onClick={handleCanvasClick}
        >
          {/* SVG Layer for arrows */}
          <svg
            className="links-layer"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#4472C4" />
              </marker>
              <marker
                id="arrowhead-selected"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#e74c3c" />
              </marker>
            </defs>

            {/* Render existing links */}
            {objectiveLinks.map((link, index) => {
              const fromPos = objectivePositions[link.From_Code];
              const toPos = objectivePositions[link.To_Code];
              if (!fromPos || !toPos) return null;

              const { fromPoint, toPoint } = findBestAnchors(
                link.From_Code,
                link.To_Code,
                link.From_Side,
                link.To_Side
              );
              const waypoints = parseWaypoints(link.Waypoints);
              const path = generatePath(fromPoint, toPoint, waypoints);
              const isSelected = selectedLink?.fromCode === link.From_Code && selectedLink?.toCode === link.To_Code;
              const linkKey = `${link.From_Code}->${link.To_Code}`;

              return (
                <g key={`${link.From_Code}-${link.To_Code}-${index}`}>
                  {/* Invisible wider path for clicking - higher z-index */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="25"
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLinkClick(e, link.From_Code, link.To_Code);
                    }}
                    onDoubleClick={(e) => handlePathDoubleClick(e, link.From_Code, link.To_Code)}
                  />
                  {/* Visible path */}
                  <path
                    d={path}
                    fill="none"
                    stroke={isSelected ? '#e74c3c' : '#4472C4'}
                    strokeWidth={isSelected ? '3' : '2'}
                    markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Waypoint handles - only show when selected */}
                  {isSelected && waypoints.map((wp, wpIndex) => (
                    <g key={wpIndex}>
                      <circle
                        cx={wp.x}
                        cy={wp.y}
                        r={8}
                        fill="#e74c3c"
                        stroke="#fff"
                        strokeWidth="2"
                        style={{ pointerEvents: 'auto', cursor: 'move' }}
                        onMouseDown={(e) => handleWaypointMouseDown(e, linkKey, wpIndex)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleDeleteWaypoint(linkKey, wpIndex);
                        }}
                      />
                    </g>
                  ))}
                </g>
              );
            })}

            {/* Temporary link while creating */}
            {isLinking && linkSource && tempLinkEnd && (
              <path
                d={(() => {
                  const anchors = getAnchorPoints(linkSource.code);
                  const start = anchors[linkSource.side];
                  const endSide = tempLinkEnd.side || (
                    linkSource.side === 'right' ? 'left' :
                    linkSource.side === 'left' ? 'right' :
                    linkSource.side === 'top' ? 'bottom' : 'top'
                  );
                  const end = { x: tempLinkEnd.x, y: tempLinkEnd.y, side: endSide };
                  return generatePath(start, end);
                })()}
                fill="none"
                stroke={tempLinkEnd.targetCode ? "#4472C4" : "#999"}
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />
            )}
          </svg>

          {/* Perspective Headers */}
          {gridConfig.hasPerspectives && (
            <div className="perspective-headers" style={{ left: gridConfig.sidebarWidth }}>
              {activePerspectives.map((perspective, index) => (
                <div
                  key={perspective.Code}
                  className="perspective-header"
                  style={{
                    width: gridConfig.perspectiveColWidth,
                    left: index * gridConfig.perspectiveColWidth
                  }}
                >
                  {perspective.Name}
                </div>
              ))}
            </div>
          )}

          {/* Pillar Rows */}
          <div className="pillar-rows" style={{ top: gridConfig.headerHeight }}>
            {activePillars.map((pillar, index) => (
              <div
                key={pillar.Code}
                className="pillar-row"
                style={{
                  height: gridConfig.pillarRowHeight,
                  top: index * gridConfig.pillarRowHeight
                }}
              >
                <div
                  className={`pillar-label ${colorPickerPillar?.Code === pillar.Code ? 'selected' : ''}`}
                  style={{
                    width: gridConfig.hasPerspectives ? gridConfig.sidebarWidth : 150,
                    backgroundColor: getPillarColor(pillar.Code, index),
                    color: getTextColor(getPillarColor(pillar.Code, index)),
                    cursor: 'pointer'
                  }}
                  onClick={(e) => handlePillarClick(e, pillar)}
                  title="Click to change color"
                >
                  <span className="pillar-name-badge">{pillar.Name}</span>
                  <span className="pillar-weight-badge">{pillar.Weight}%</span>
                </div>
                <div
                  className="pillar-content"
                  style={{
                    left: gridConfig.hasPerspectives ? gridConfig.sidebarWidth : 150,
                    borderLeftColor: getPillarColor(pillar.Code, index)
                  }}
                >
                  {gridConfig.hasPerspectives && activePerspectives.map((_, pIndex) => (
                    <div
                      key={pIndex}
                      className="perspective-column-line"
                      style={{ left: pIndex * gridConfig.perspectiveColWidth }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Objectives */}
          <div className="objectives-layer">
            {l1Objectives.map((obj) => {
              const pos = objectivePositions[obj.Code] || { x: 50, y: 100 };
              const isSelected = selectedObjective === obj.Code;
              const isDragging = dragging?.code === obj.Code;
              const isLinkSourceObj = linkSource?.code === obj.Code;
              const isLinkTarget = tempLinkEnd?.targetCode === obj.Code;

              return (
                <div
                  key={obj.Code}
                  className={`map-objective ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isLinkSourceObj ? 'link-source' : ''} ${isLinkTarget ? 'link-target' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: OBJECTIVE_WIDTH,
                    height: OBJECTIVE_HEIGHT,
                    borderColor: getPillarColor(obj.Pillar_Code, 0)
                  }}
                  onMouseDown={(e) => handleObjectiveMouseDown(e, obj)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isLinking) {
                      setSelectedObjective(obj.Code);
                      setSelectedLink(null);
                    }
                  }}
                >
                  <div
                    className="objective-color-bar"
                    style={{ backgroundColor: getPillarColor(obj.Pillar_Code, 0) }}
                  />
                  <div className="objective-content">
                    <span className="objective-code">{obj.Code}</span>
                    <span className="objective-name">{obj.Name}</span>
                    {obj.Weight > 0 && (
                      <span className="objective-weight">{obj.Weight}%</span>
                    )}
                  </div>

                  {/* Anchor points - all 4 sides */}
                  <svg
                    className="anchor-layer"
                    style={{
                      position: 'absolute',
                      top: -ANCHOR_RADIUS,
                      left: -ANCHOR_RADIUS,
                      width: OBJECTIVE_WIDTH + ANCHOR_RADIUS * 2,
                      height: OBJECTIVE_HEIGHT + ANCHOR_RADIUS * 2,
                      pointerEvents: 'none',
                      overflow: 'visible'
                    }}
                  >
                    {/* Top anchor */}
                    <circle
                      cx={OBJECTIVE_WIDTH / 2 + ANCHOR_RADIUS}
                      cy={ANCHOR_RADIUS}
                      r={ANCHOR_RADIUS}
                      className="anchor-point"
                      style={{ pointerEvents: 'auto' }}
                      onMouseDown={(e) => handleAnchorMouseDown(e, obj.Code, 'top')}
                    />
                    {/* Right anchor */}
                    <circle
                      cx={OBJECTIVE_WIDTH + ANCHOR_RADIUS}
                      cy={OBJECTIVE_HEIGHT / 2 + ANCHOR_RADIUS}
                      r={ANCHOR_RADIUS}
                      className="anchor-point"
                      style={{ pointerEvents: 'auto' }}
                      onMouseDown={(e) => handleAnchorMouseDown(e, obj.Code, 'right')}
                    />
                    {/* Bottom anchor */}
                    <circle
                      cx={OBJECTIVE_WIDTH / 2 + ANCHOR_RADIUS}
                      cy={OBJECTIVE_HEIGHT + ANCHOR_RADIUS}
                      r={ANCHOR_RADIUS}
                      className="anchor-point"
                      style={{ pointerEvents: 'auto' }}
                      onMouseDown={(e) => handleAnchorMouseDown(e, obj.Code, 'bottom')}
                    />
                    {/* Left anchor */}
                    <circle
                      cx={ANCHOR_RADIUS}
                      cy={OBJECTIVE_HEIGHT / 2 + ANCHOR_RADIUS}
                      r={ANCHOR_RADIUS}
                      className="anchor-point"
                      style={{ pointerEvents: 'auto' }}
                      onMouseDown={(e) => handleAnchorMouseDown(e, obj.Code, 'left')}
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Empty states */}
          {l1Objectives.length === 0 && (
            <div className="map-empty-state">
              <p>No L1 Strategic Objectives defined yet.</p>
              <p>Go to Design → L1 Objectives to create objectives.</p>
            </div>
          )}

          {activePillars.length === 0 && (
            <div className="map-empty-state">
              <p>No Strategic Pillars defined yet.</p>
              <p>Go to Design → Strategy to create pillars.</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Link Panel */}
      {selectedLink && (() => {
        const link = objectiveLinks.find(l => l.From_Code === selectedLink.fromCode && l.To_Code === selectedLink.toCode);
        const waypoints = link ? parseWaypoints(link.Waypoints) : [];

        return (
          <div className="selected-link-panel">
            <h4>Selected Connection</h4>
            <div className="detail-row">
              <span className="detail-label">From:</span>
              <span className="detail-value">{selectedLink.fromCode}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">To:</span>
              <span className="detail-value">{selectedLink.toCode}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Waypoints:</span>
              <span className="detail-value">{waypoints.length}</span>
            </div>
            <p className="help-text">
              Double-click on the line to add waypoints.<br/>
              Drag waypoints to move them.<br/>
              Right-click a waypoint to delete it.
            </p>
            <div className="link-actions">
              <button className="btn btn-danger btn-sm" onClick={handleDeleteLink}>
                Delete Link
              </button>
              {waypoints.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={handleClearWaypoints}>
                  Clear Waypoints
                </button>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedLink(null)}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Deselect
            </button>
          </div>
        );
      })()}

      {/* Selected Objective Panel */}
      {selectedObjective && !selectedLink && (
        <div className="selected-objective-panel">
          {(() => {
            const obj = l1Objectives.find(o => o.Code === selectedObjective);
            if (!obj) return null;
            const pillar = activePillars.find(p => p.Code === obj.Pillar_Code);
            const perspective = activePerspectives.find(p => p.Code === obj.Perspective_Code);
            const outgoingLinks = objectiveLinks.filter(l => l.From_Code === obj.Code);
            const incomingLinks = objectiveLinks.filter(l => l.To_Code === obj.Code);

            return (
              <>
                <h4>Selected Objective</h4>
                <div className="detail-row">
                  <span className="detail-label">Code:</span>
                  <span className="detail-value">{obj.Code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{obj.Name}</span>
                </div>
                {pillar && (
                  <div className="detail-row">
                    <span className="detail-label">Pillar:</span>
                    <span className="detail-value">{pillar.Name}</span>
                  </div>
                )}
                {perspective && (
                  <div className="detail-row">
                    <span className="detail-label">Perspective:</span>
                    <span className="detail-value">{perspective.Name}</span>
                  </div>
                )}
                {outgoingLinks.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Leads to:</span>
                    <span className="detail-value">{outgoingLinks.map(l => l.To_Code).join(', ')}</span>
                  </div>
                )}
                {incomingLinks.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Led by:</span>
                    <span className="detail-value">{incomingLinks.map(l => l.From_Code).join(', ')}</span>
                  </div>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedObjective(null)}>
                  Deselect
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Color Picker Panel */}
      {colorPickerPillar && (
        <div
          className="color-picker-panel"
          style={{
            position: 'absolute',
            left: colorPickerPosition.x,
            top: colorPickerPosition.y,
            zIndex: 1000
          }}
        >
          <div className="color-picker-header">
            <h4>Pillar Color</h4>
            <button
              className="btn btn-ghost btn-sm close-btn"
              onClick={() => setColorPickerPillar(null)}
            >
              ×
            </button>
          </div>
          <p className="color-picker-pillar-name">{colorPickerPillar.Name}</p>
          <div className="color-grid">
            {[
              '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
              '#70AD47', '#9E480E', '#997300', '#264478', '#636363',
              '#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#1abc9c',
              '#f39c12', '#e67e22', '#34495e', '#16a085', '#c0392b',
              '#8e44ad', '#2980b9', '#27ae60', '#d35400', '#7f8c8d'
            ].map((color) => (
              <button
                key={color}
                className={`color-swatch ${getPillarColor(colorPickerPillar.Code, 0) === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>
          <div className="color-picker-custom">
            <label>Custom:</label>
            <input
              type="color"
              value={getPillarColor(colorPickerPillar.Code, 0)}
              onChange={(e) => handleColorSelect(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default StrategyMapTab;
