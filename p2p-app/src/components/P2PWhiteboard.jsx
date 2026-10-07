'use client';
/*
 * OpenMeet - Open-source, self-hostable video meeting platform
 * Excalidraw & Eraser.io-Inspired Collaborative Whiteboard & Architecture Diagrammer
 * Copyright (C) 2026 OpenMeet Contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  MousePointer, Hand, Square, Circle, Diamond, ArrowRight, Minus,
  Pencil, Highlighter, Type, StickyNote, Eraser, Undo, Redo,
  Download, Trash2, Grid, Sun, Moon, ZoomIn, ZoomOut, RotateCcw,
  X, Check, Sparkles
} from 'lucide-react';

// Distance from point to segment (for line/arrow/freehand hit-testing)
const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// True if (x, y) is within `tol` of element `el` (works for every element type)
const hitTest = (el, x, y, tol = 8) => {
  if (el.type === 'pen' || el.type === 'highlighter') {
    const p = el.points || [];
    if (p.length === 1) return Math.hypot(x - p[0].x, y - p[0].y) <= tol;
    return p.some((pt, i) => i > 0 && distToSegment(x, y, p[i - 1].x, p[i - 1].y, pt.x, pt.y) <= tol);
  }
  if (el.type === 'arrow' || el.type === 'line') {
    return distToSegment(x, y, el.startX, el.startY, el.endX, el.endY) <= tol;
  }
  if (el.type === 'text') {
    const w = (el.text || '').length * 9;
    return x >= el.x - tol && x <= el.x + w + tol && y >= el.y - 16 - tol && y <= el.y + tol;
  }
  if (el.x !== undefined && el.width !== undefined) {
    return x >= el.x - tol && x <= el.x + el.width + tol && y >= el.y - tol && y <= el.y + el.height + tol;
  }
  return false;
};

export default function P2PWhiteboard({ onClose, onBroadcastStroke, incomingStroke }) {
  const canvasRef = useRef(null);

  // Tool states: 'select' | 'rectangle' | 'diamond' | 'circle' | 'arrow' | 'line' | 'pen' | 'highlighter' | 'text' | 'sticky' | 'eraser'
  const [tool, setTool] = useState('rectangle');
  const [strokeColor, setStrokeColor] = useState('#2563EB'); // Eraser Blue default
  const [fillMode, setFillMode] = useState('tint'); // 'none' | 'tint' | 'solid'
  const [strokeWidth, setStrokeWidth] = useState(3); // 2 | 4 | 6
  const [edgeStyle, setEdgeStyle] = useState('rough'); // 'rough' (Excalidraw sketch) | 'clean' (Eraser crisp)
  const [canvasTheme, setCanvasTheme] = useState('dark'); // 'light' (whiteboard) | 'dark' (blackboard)
  const [gridType, setGridType] = useState('dots'); // 'dots' | 'lines' | 'none'
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Vector elements state & history for Undo/Redo
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Active interaction states
  const [isInteracting, setIsInteracting] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [freehandPoints, setFreehandPoints] = useState([]);
  const [textInput, setTextInput] = useState(null); // { x, y, canvasX, canvasY, text }

  // Excalidraw & Eraser.io curated color palette
  const colors = [
    { label: 'Charcoal', hex: '#1E1E1E' },
    { label: 'Blue', hex: '#2563EB' },
    { label: 'Emerald', hex: '#059669' },
    { label: 'Coral', hex: '#DC2626' },
    { label: 'Amber', hex: '#D97706' },
    { label: 'Violet', hex: '#7C3AED' },
    { label: 'Cyan', hex: '#0891B2' },
    { label: 'White', hex: '#FFFFFF' }
  ];

  // Helper to get canvas-relative coordinates accounting for pan and zoom
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    return {
      x: (rawX - pan.x) / zoom,
      y: (rawY - pan.y) / zoom,
      rawX,
      rawY
    };
  }, [pan, zoom]);

  // Handle incoming remote peer strokes or element updates
  useEffect(() => {
    if (!incomingStroke) return;

    if (incomingStroke.action === 'clear' || incomingStroke.type === 'clear') {
      setElements([]);
    } else if (incomingStroke.action === 'add_element' || incomingStroke.type === 'element') {
      const incomingEl = incomingStroke.element;
      if (incomingEl) {
        setElements(prev => {
          if (prev.some(el => el.id === incomingEl.id)) return prev;
          return [...prev, incomingEl];
        });
      }
    } else if (incomingStroke.action === 'delete') {
      setElements(prev => prev.filter(el => el.id !== incomingStroke.id));
    } else if (incomingStroke.points && incomingStroke.points.length > 0) {
      // Legacy freehand stroke backwards-compatibility
      const freehandEl = {
        id: `legacy-${Date.now()}-${Math.random()}`,
        type: incomingStroke.tool === 'highlighter' ? 'highlighter' : 'pen',
        points: incomingStroke.points,
        color: incomingStroke.color || '#0E72ED',
        strokeWidth: incomingStroke.lineWidth || 3
      };
      setElements(prev => [...prev, freehandEl]);
    }
  }, [incomingStroke]);

  // Redraw the canvas on any state change
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Canvas Background (Dark vs Light theme)
    ctx.fillStyle = canvasTheme === 'dark' ? '#121214' : '#F8F9FA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Excalidraw / Eraser.io Dot Grid
    if (gridType !== 'none') {
      const dotSpacing = 24 * zoom;
      const dotColor = canvasTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      ctx.fillStyle = dotColor;

      const startX = (pan.x * dpr) % dotSpacing;
      const startY = (pan.y * dpr) % dotSpacing;

      for (let x = startX; x < canvas.width; x += dotSpacing) {
        for (let y = startY; y < canvas.height; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Apply Camera Transform (DPR, Pan, Zoom)
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 4. Render Vector Elements Function
    const drawElement = (el) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Theme-aware ink: charcoal<->white swap so strokes never vanish on the current board
      const ink = canvasTheme === 'dark'
        ? (el.color === '#1E1E1E' ? '#F5F5F5' : el.color)
        : (el.color === '#FFFFFF' ? '#1E1E1E' : el.color);
      ctx.strokeStyle = ink;
      ctx.lineWidth = el.strokeWidth;

      // Color fills (none, tint 25%, solid)
      if (el.fillMode === 'solid') {
        ctx.fillStyle = ink;
      } else if (el.fillMode === 'tint') {
        ctx.fillStyle = `${ink}33`; // 20% opacity hex
      } else {
        ctx.fillStyle = 'transparent';
      }

      // Excalidraw style jitter offset helper
      const jitter = (val) => el.edgeStyle === 'rough' ? val + (Math.sin(val * 13) * 1.4) : val;

      switch (el.type) {
        case 'rectangle': {
          const w = el.width;
          const h = el.height;
          if (el.fillMode !== 'none') {
            ctx.fillRect(el.x, el.y, w, h);
          }
          if (el.edgeStyle === 'rough') {
            // Excalidraw dual-stroke hand-drawn rectangle
            ctx.beginPath();
            ctx.strokeRect(el.x, el.y, w, h);
            ctx.strokeRect(el.x + 0.8, el.y + 0.8, w - 1.6, h - 1.6);
          } else {
            // Eraser.io clean rounded rectangle
            ctx.beginPath();
            const radius = Math.min(8, Math.abs(w) / 4, Math.abs(h) / 4);
            ctx.roundRect ? ctx.roundRect(el.x, el.y, w, h, radius) : ctx.rect(el.x, el.y, w, h);
            ctx.stroke();
          }
          break;
        }

        case 'diamond': {
          // Flowchart decision node
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          const halfW = el.width / 2;
          const halfH = el.height / 2;

          ctx.beginPath();
          ctx.moveTo(cx, cy - halfH);
          ctx.lineTo(cx + halfW, cy);
          ctx.lineTo(cx, cy + halfH);
          ctx.lineTo(cx - halfW, cy);
          ctx.closePath();

          if (el.fillMode !== 'none') ctx.fill();
          ctx.stroke();
          if (el.edgeStyle === 'rough') {
            ctx.stroke(); // Double stroke for hand-drawn weight
          }
          break;
        }

        case 'circle': {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          const rx = Math.abs(el.width / 2);
          const ry = Math.abs(el.height / 2);

          ctx.beginPath();
          ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2);
          if (el.fillMode !== 'none') ctx.fill();
          ctx.stroke();
          if (el.edgeStyle === 'rough') {
            ctx.beginPath();
            ctx.ellipse(cx + 0.5, cy + 0.5, rx || 1, ry || 1, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }

        case 'arrow': {
          const sx = el.startX;
          const sy = el.startY;
          const ex = el.endX;
          const ey = el.endY;

          const angle = Math.atan2(ey - sy, ex - sx);
          const headLen = Math.max(12, el.strokeWidth * 3.5);

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // Arrow head triangle
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(
            ex - headLen * Math.cos(angle - Math.PI / 6),
            ey - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            ex - headLen * Math.cos(angle + Math.PI / 6),
            ey - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = ink;
          ctx.fill();
          ctx.stroke();
          break;
        }

        case 'line': {
          ctx.beginPath();
          ctx.moveTo(el.startX, el.startY);
          ctx.lineTo(el.endX, el.endY);
          ctx.stroke();
          break;
        }

        case 'pen': {
          if (el.points && el.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          }
          break;
        }

        case 'highlighter': {
          if (el.points && el.points.length > 1) {
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = Math.max(16, el.strokeWidth * 4);
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          }
          break;
        }

        case 'text': {
          ctx.font = '600 16px Inter, system-ui, sans-serif';
          ctx.fillStyle = ink;
          ctx.fillText(el.text || 'Text', el.x, el.y);
          break;
        }

        case 'sticky': {
          // Eraser.io & FigJam style sticky note card
          const w = el.width || 140;
          const h = el.height || 140;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          ctx.fillStyle = el.color || '#FEF08A'; // Pastel Yellow default
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(el.x, el.y, w, h, 8) : ctx.rect(el.x, el.y, w, h);
          ctx.fill();

          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Sticky note content
          if (el.text) {
            ctx.font = '500 13px Inter, sans-serif';
            ctx.fillStyle = '#1C1917';
            const lines = el.text.split('\n');
            lines.forEach((line, idx) => {
              ctx.fillText(line, el.x + 12, el.y + 24 + idx * 18, w - 24);
            });
          }
          break;
        }

        default:
          break;
      }

      ctx.restore();
    };

    // Render all saved elements
    elements.forEach(drawElement);

    // Render currently active interactive draft
    if (currentDraft) {
      drawElement(currentDraft);
    }

    ctx.restore();
  }, [canvasTheme, gridType, zoom, pan, elements, currentDraft]);

  // Adjust canvas pixel resolution on resize and mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      render();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  // -------------------------------------------------------------
  // MOUSE & TOUCH EVENT HANDLERS
  // -------------------------------------------------------------

  // Remove the topmost element under `coords` (tolerance scales with zoom)
  const eraseAt = (coords) => {
    const hit = elements.slice().reverse().find(el => hitTest(el, coords.x, coords.y, 8 / zoom));
    if (!hit) return;
    setHistory(prev => [...prev, elements]);
    setRedoStack([]);
    setElements(prev => prev.filter(el => el.id !== hit.id));
    onBroadcastStroke?.({ action: 'delete', id: hit.id });
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setIsInteracting(true);
    setStartPoint(coords);

    // 1. Hand / Pan tool
    if (tool === 'hand') return;

    // 2. Eraser: delete any element under the pointer (drag to erase more)
    if (tool === 'eraser') {
      eraseAt(coords);
      return;
    }

    // 3. Text tool: Place inline input
    if (tool === 'text') {
      setTextInput({
        x: coords.rawX,
        y: coords.rawY,
        canvasX: coords.x,
        canvasY: coords.y,
        text: ''
      });
      setIsInteracting(false);
      return;
    }

    // 4. Sticky Note: Place sticky card directly
    if (tool === 'sticky') {
      const newSticky = {
        id: `sticky-${Date.now()}-${Math.random()}`,
        type: 'sticky',
        x: coords.x,
        y: coords.y,
        width: 140,
        height: 140,
        color: strokeColor === '#FFFFFF' ? '#FEF08A' : strokeColor,
        text: 'Sticky Note\nDouble click to edit',
        strokeWidth: 1
      };
      setHistory(prev => [...prev, elements]);
      setElements(prev => [...prev, newSticky]);
      onBroadcastStroke?.({ action: 'add_element', element: newSticky });
      setIsInteracting(false);
      return;
    }

    // 5. Freehand Pen or Highlighter
    if (tool === 'pen' || tool === 'highlighter') {
      setFreehandPoints([coords]);
      setCurrentDraft({
        id: `draft-${Date.now()}`,
        type: tool,
        points: [coords],
        color: strokeColor,
        strokeWidth,
        edgeStyle
      });
    }
  };

  const handlePointerMove = (e) => {
    if (!isInteracting) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);

    if (tool === 'eraser') {
      eraseAt(coords);
      return;
    }

    // 1. Pan canvas
    if (tool === 'hand' && startPoint) {
      setPan(prev => ({
        x: prev.x + (coords.rawX - startPoint.rawX),
        y: prev.y + (coords.rawY - startPoint.rawY)
      }));
      setStartPoint(coords);
      return;
    }

    // 2. Freehand draw
    if ((tool === 'pen' || tool === 'highlighter') && currentDraft) {
      const nextPoints = [...freehandPoints, coords];
      setFreehandPoints(nextPoints);
      setCurrentDraft({
        ...currentDraft,
        points: nextPoints
      });
      return;
    }

    // 3. Geometric Shapes (Rectangle, Diamond, Circle, Arrow, Line)
    if (['rectangle', 'diamond', 'circle', 'arrow', 'line'].includes(tool) && startPoint) {
      const width = coords.x - startPoint.x;
      const height = coords.y - startPoint.y;

      const draft = {
        id: `draft-${Date.now()}`,
        type: tool,
        x: Math.min(startPoint.x, coords.x),
        y: Math.min(startPoint.y, coords.y),
        startX: startPoint.x,
        startY: startPoint.y,
        endX: coords.x,
        endY: coords.y,
        width: Math.abs(width),
        height: Math.abs(height),
        color: strokeColor,
        fillMode,
        strokeWidth,
        edgeStyle
      };
      setCurrentDraft(draft);
    }
  };

  const handlePointerUp = () => {
    if (!isInteracting) return;
    setIsInteracting(false);

    if (currentDraft) {
      setHistory(prev => [...prev, elements]);
      setRedoStack([]);

      const finalized = { ...currentDraft, id: `el-${Date.now()}-${Math.random()}` };
      setElements(prev => [...prev, finalized]);
      onBroadcastStroke?.({ action: 'add_element', element: finalized });
      setCurrentDraft(null);
      setFreehandPoints([]);
    }
  };

  // Commit text input to canvas
  const handleCommitText = () => {
    if (textInput && textInput.text.trim()) {
      const newText = {
        id: `text-${Date.now()}-${Math.random()}`,
        type: 'text',
        x: textInput.canvasX,
        y: textInput.canvasY,
        text: textInput.text,
        color: strokeColor
      };
      setHistory(prev => [...prev, elements]);
      setElements(prev => [...prev, newText]);
      onBroadcastStroke?.({ action: 'add_element', element: newText });
    }
    setTextInput(null);
  };

  // Undo / Redo Actions
  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [elements, ...r]);
    setElements(prev);
    setHistory(h => h.slice(0, h.length - 1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory(h => [...h, elements]);
    setElements(next);
    setRedoStack(r => r.slice(1));
  };

  const handleClearAll = () => {
    if (elements.length === 0) return;
    setHistory(h => [...h, elements]);
    setElements([]);
    onBroadcastStroke?.({ action: 'clear' });
  };

  // High-Resolution PNG Export
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `excalidraw-whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <div className="absolute inset-0 z-40 bg-[#121214]/95 backdrop-blur-md flex flex-col select-none overflow-hidden animate-in fade-in duration-150">
      {/* 1. TOP HEADER: TITLE, ZOOM, EXPORT & CLOSE */}
      <div className="h-13 px-4 bg-[#1E1E22] border-b border-white/10 flex items-center justify-between shadow-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Whiteboard</span>
              <span className="text-[10px] bg-[#2563EB]/25 text-[#60A5FA] border border-[#2563EB]/40 px-1.5 py-0.2 rounded font-semibold">Excalidraw + Eraser.io Mode</span>
            </h3>
            <span className="text-[10px] text-white/50">Real-time vector diagrams, flowcharts, & notes</span>
          </div>
        </div>

        {/* Top Center: Quick Zoom Controls */}
        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl bg-black/40 border border-white/10 text-xs text-white">
          <button
            onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
            className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono px-1.5 min-w-[42px] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2.5, Number((z + 0.1).toFixed(1))))}
            className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
            className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
            title="Reset Zoom & Pan"
          >
            100%
          </button>
        </div>

        {/* Top Right: Undo/Redo, Grid, Theme, Export, Close */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* Grid Toggle */}
          <button
            onClick={() => setGridType(g => g === 'dots' ? 'none' : 'dots')}
            className={`p-1.5 rounded-lg transition ${gridType === 'dots' ? 'bg-[#2563EB]/25 text-[#60A5FA] border border-[#2563EB]/40' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Toggle Dot Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Canvas Theme Toggle */}
          <button
            onClick={() => setCanvasTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
            title={canvasTheme === 'dark' ? "Switch to Light Canvas" : "Switch to Dark Canvas"}
          >
            {canvasTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>

          {/* Clear board */}
          <button
            onClick={handleClearAll}
            className="p-1.5 rounded-lg text-white/70 hover:text-red-400 hover:bg-white/10 transition"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-semibold shadow transition"
            title="Export High-Res PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition ml-1"
            title="Close Whiteboard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. FLOATING TOP TOOLBAR: EXCALIDRAW & ERASER.IO DOCK */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 rounded-2xl bg-[#1C1C20]/90 backdrop-blur-xl border border-white/15 shadow-2xl">
        {[
          { id: 'hand', label: 'Pan Canvas', icon: <Hand className="w-4 h-4" /> },
          { id: 'rectangle', label: 'Rectangle (Box)', icon: <Square className="w-4 h-4" /> },
          { id: 'diamond', label: 'Diamond (Decision / Architecture)', icon: <Diamond className="w-4 h-4" /> },
          { id: 'circle', label: 'Circle (Cloud / Node)', icon: <Circle className="w-4 h-4" /> },
          { id: 'arrow', label: 'Arrow (Connector)', icon: <ArrowRight className="w-4 h-4" /> },
          { id: 'line', label: 'Straight Line', icon: <Minus className="w-4 h-4" /> },
          { id: 'pen', label: 'Freehand Pen', icon: <Pencil className="w-4 h-4" /> },
          { id: 'highlighter', label: 'Highlighter', icon: <Highlighter className="w-4 h-4" /> },
          { id: 'text', label: 'Text Label', icon: <Type className="w-4 h-4" /> },
          { id: 'sticky', label: 'Sticky Note (Miro / Eraser)', icon: <StickyNote className="w-4 h-4" /> },
          { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" /> },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTool(item.id)}
            className={`p-2 rounded-xl transition flex items-center justify-center ${
              tool === item.id
                ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* 3. FLOATING LEFT PROPERTIES PALETTE (Colors, Fills, Width, Edge Style) */}
      <div className="absolute left-4 top-20 z-30 w-44 rounded-2xl bg-[#1C1C20]/90 backdrop-blur-xl border border-white/15 p-3 shadow-2xl text-xs space-y-3 hidden md:block">
        {/* Stroke Color */}
        <div>
          <span className="text-[10px] uppercase font-bold text-white/40 block mb-1.5">Color</span>
          <div className="grid grid-cols-4 gap-1.5">
            {colors.map((c) => (
              <button
                key={c.hex}
                onClick={() => setStrokeColor(c.hex)}
                className={`w-6 h-6 rounded-lg border transition transform hover:scale-110 flex items-center justify-center ${
                  strokeColor === c.hex ? 'ring-2 ring-blue-500 scale-105 border-white' : 'border-black/30'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              >
                {strokeColor === c.hex && (
                  <Check className={`w-3 h-3 ${c.hex === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fill Mode */}
        <div>
          <span className="text-[10px] uppercase font-bold text-white/40 block mb-1.5">Fill Style</span>
          <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/10 text-[10px] font-semibold text-center">
            {[
              { id: 'none', label: 'Hollow' },
              { id: 'tint', label: 'Tint 20%' },
              { id: 'solid', label: 'Solid' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFillMode(f.id)}
                className={`py-1 rounded transition ${
                  fillMode === f.id ? 'bg-[#2563EB] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        <div>
          <span className="text-[10px] uppercase font-bold text-white/40 block mb-1.5">Stroke</span>
          <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-white/10 text-[10px] font-semibold text-center">
            {[
              { w: 2, label: 'Thin' },
              { w: 4, label: 'Mid' },
              { w: 6, label: 'Bold' }
            ].map(s => (
              <button
                key={s.w}
                onClick={() => setStrokeWidth(s.w)}
                className={`py-1 rounded transition ${
                  strokeWidth === s.w ? 'bg-[#2563EB] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Edge Style: Rough (Excalidraw) vs Clean (Eraser.io) */}
        <div>
          <span className="text-[10px] uppercase font-bold text-white/40 block mb-1.5">Style</span>
          <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-lg border border-white/10 text-[10px] font-semibold text-center">
            <button
              onClick={() => setEdgeStyle('rough')}
              className={`py-1 rounded transition ${
                edgeStyle === 'rough' ? 'bg-[#2563EB] text-white' : 'text-white/60 hover:text-white'
              }`}
              title="Excalidraw Hand-Drawn Sketch"
            >
              Hand-Drawn
            </button>
            <button
              onClick={() => setEdgeStyle('clean')}
              className={`py-1 rounded transition ${
                edgeStyle === 'clean' ? 'bg-[#2563EB] text-white' : 'text-white/60 hover:text-white'
              }`}
              title="Eraser.io Sharp Architectural"
            >
              Architectural
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN CANVAS STAGE */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className={`w-full h-full touch-none ${
            tool === 'hand' ? (isInteracting ? 'cursor-grabbing' : 'cursor-grab') : tool === 'eraser' ? 'cursor-pointer' : 'cursor-crosshair'
          }`}
        />

        {/* Inline Text Input Overlay (when user clicks with Text tool) */}
        {textInput && (
          <div
            className="absolute z-50 bg-[#1C1C20] border border-blue-500 rounded-lg p-1.5 shadow-2xl flex items-center gap-1.5"
            style={{ left: `${textInput.x}px`, top: `${textInput.y}px` }}
          >
            <input
              autoFocus
              type="text"
              value={textInput.text}
              onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitText();
                if (e.key === 'Escape') setTextInput(null);
              }}
              placeholder="Type node text..."
              className="px-2 py-1 bg-black/50 border border-white/10 rounded text-xs text-white focus:outline-none"
            />
            <button
              onClick={handleCommitText}
              className="px-2 py-1 rounded bg-[#2563EB] text-white text-xs font-semibold"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
