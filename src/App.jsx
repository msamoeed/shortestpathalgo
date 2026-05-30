import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import GridCanvas from './components/GridCanvas.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import { bfs } from './algorithms/bfs.js';
import { dijkstra } from './algorithms/dijkstra.js';
import { astar } from './algorithms/astar.js';
import { bidirectional } from './algorithms/bidirectional.js';
const MapMode = lazy(() => import('./components/MapMode.jsx'));

const ALGORITHMS = [
  { key: 'BFS', label: 'BFS', fn: bfs, desc: 'Breadth-First Search — unweighted, guarantees fewest hops', optimal: false },
  { key: 'Dijkstra', label: 'Dijkstra', fn: dijkstra, desc: "Dijkstra's — weighted, guarantees shortest cost path", optimal: true },
  { key: 'A*', label: 'A*', fn: astar, desc: 'A* — uses Manhattan heuristic to guide search toward goal', optimal: true },
  { key: 'Bi-Dir Dijkstra', label: 'Bi-Dir Dijkstra', fn: bidirectional, desc: 'Bi-directional — searches from both ends simultaneously, halves search area', optimal: true },
];

const MODES = { DRAW: 'draw', SINGLE: 'single', COMPARE: 'compare', MAP: 'map' };
const DRAW_MODES = { NONE: 'none', WALL: 'wall', ERASE: 'erase' };

function makeGrid(rows, cols) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r, col: c, isWall: false, weight: 1,
    }))
  );
}

function generateMaze(rows, cols) {
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r, col: c, isWall: true, weight: 1,
    }))
  );
  const visited = new Set();

  function carve(r, c) {
    visited.add(`${r},${c}`);
    grid[r][c].isWall = false;
    const dirs = [[-2,0],[2,0],[0,-2],[0,2]].sort(() => Math.random() - 0.5);
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && !visited.has(`${nr},${nc}`)) {
        grid[r + dr/2][c + dc/2].isWall = false;
        carve(nr, nc);
      }
    }
  }

  const sr = 1, sc = 1;
  carve(sr, sc);
  return grid;
}

function addWeights(grid) {
  return grid.map(row => row.map(cell => ({
    ...cell,
    weight: cell.isWall ? 1 : Math.random() < 0.3 ? Math.floor(Math.random() * 4) + 2 : 1,
  })));
}

const SPEED_OPTIONS = [
  { label: 'Slow', ms: 80 },
  { label: 'Normal', ms: 25 },
  { label: 'Fast', ms: 8 },
  { label: 'Instant', ms: 0 },
];

export default function App() {
  const ROWS = 28, COLS = 56;
  const COMPARE_ROWS = 20, COMPARE_COLS = 40;

  const [mode, setMode] = useState(MODES.DRAW);
  const [grid, setGrid] = useState(() => makeGrid(ROWS, COLS));
  const [startNode, setStartNode] = useState({ row: 14, col: 8 });
  const [endNode, setEndNode] = useState({ row: 14, col: 47 });
  const [selectedAlgo, setSelectedAlgo] = useState('A*');
  const [speedIdx, setSpeedIdx] = useState(1);
  const [placing, setPlacing] = useState('start');

  const [results, setResults] = useState({});
  const [animStep, setAnimStep] = useState(0);
  const [animRunning, setAnimRunning] = useState(false);

  const drawMode = useRef(DRAW_MODES.NONE);
  const mouseDown = useRef(false);
  const animRef = useRef(null);
  const stepRef = useRef(0);
  const resultsRef = useRef({});

  // Compute visited/path snapshots from results + animStep
  const getSnapshot = useCallback((algoKey, step) => {
    const r = resultsRef.current[algoKey];
    if (!r) return { visited: new Map(), path: new Set(), done: false, found: false };
    const clampedStep = Math.min(step, r.visitedInOrder.length);
    const visited = new Map();
    for (let i = 0; i < clampedStep; i++) {
      const n = r.visitedInOrder[i];
      visited.set(`${n.row},${n.col}`, n.dir || 'fwd');
    }
    const done = clampedStep >= r.visitedInOrder.length;
    const path = new Set();
    if (done && r.found) {
      for (const n of r.path) path.add(`${n.row},${n.col}`);
    }
    return { visited, path, done, found: r.found };
  }, []);

  const runAlgorithms = useCallback((algoKeys, g, sr, sc, er, ec) => {
    const newResults = {};
    for (const key of algoKeys) {
      const algo = ALGORITHMS.find(a => a.key === key);
      if (!algo) continue;
      const t0 = performance.now();
      const r = algo.fn(g, sr, sc, er, ec);
      const t1 = performance.now();
      const optimalAlgo = ALGORITHMS.find(a => a.key === 'Dijkstra');
      const optR = optimalAlgo.fn(g, sr, sc, er, ec);
      newResults[key] = {
        ...r,
        timeMs: t1 - t0,
        optimal: algo.optimal && r.path.length === optR.path.length,
      };
    }
    return newResults;
  }, []);

  const startAnimation = useCallback((newResults, speed) => {
    if (animRef.current) clearInterval(animRef.current);
    resultsRef.current = newResults;
    stepRef.current = 0;
    setAnimStep(0);
    setAnimRunning(true);

    const maxSteps = Math.max(...Object.values(newResults).map(r => r.visitedInOrder.length));

    if (speed === 0) {
      stepRef.current = maxSteps + 1;
      setAnimStep(maxSteps + 1);
      setAnimRunning(false);
      return;
    }

    animRef.current = setInterval(() => {
      stepRef.current += Math.max(1, Math.floor(25 / speed));
      setAnimStep(stepRef.current);
      if (stepRef.current > maxSteps) {
        clearInterval(animRef.current);
        setAnimRunning(false);
      }
    }, speed);
  }, []);

  const handleVisualize = useCallback(() => {
    const algoKeys = mode === MODES.COMPARE
      ? ALGORITHMS.map(a => a.key)
      : [selectedAlgo];
    const g = mode === MODES.COMPARE ? makeGrid(COMPARE_ROWS, COMPARE_COLS) : grid;
    const rows = g.length, cols = g[0].length;
    const sr = Math.min(startNode.row, rows - 1);
    const sc = Math.min(startNode.col, cols - 1);
    const er = Math.min(endNode.row, rows - 1);
    const ec = Math.min(endNode.col, cols - 1);

    const activeGrid = mode === MODES.COMPARE ? grid.slice(0, rows).map(row => row.slice(0, cols)) : grid;
    const newResults = runAlgorithms(algoKeys, activeGrid, sr, sc, er, ec);
    setResults(newResults);
    startAnimation(newResults, SPEED_OPTIONS[speedIdx].ms);
    setMode(mode === MODES.DRAW ? MODES.SINGLE : mode);
  }, [mode, selectedAlgo, grid, startNode, endNode, speedIdx, runAlgorithms, startAnimation]);

  const handleReset = useCallback(() => {
    if (animRef.current) clearInterval(animRef.current);
    setResults({});
    setAnimStep(0);
    setAnimRunning(false);
    resultsRef.current = {};
    stepRef.current = 0;
    setMode(MODES.DRAW);
  }, []);

  const handleClearWalls = useCallback(() => {
    setGrid(g => g.map(row => row.map(cell => ({ ...cell, isWall: false, weight: 1 }))));
  }, []);

  const handleMaze = useCallback(() => {
    handleReset();
    const maze = generateMaze(ROWS, COLS);
    setGrid(maze);
    setStartNode({ row: 1, col: 1 });
    setEndNode({ row: ROWS - 2, col: COLS - 2 });
  }, [handleReset]);

  const handleWeights = useCallback(() => {
    setGrid(g => addWeights(g));
  }, []);

  // Mouse interaction for wall drawing
  const handleMouseDown = useCallback(({ row, col }) => {
    mouseDown.current = true;
    if (placing === 'start') {
      setStartNode({ row, col });
      return;
    }
    if (placing === 'end') {
      setEndNode({ row, col });
      return;
    }
    const isWall = grid[row]?.[col]?.isWall;
    drawMode.current = isWall ? DRAW_MODES.ERASE : DRAW_MODES.WALL;
    setGrid(g => {
      const ng = g.map(r => [...r]);
      if (ng[row]?.[col]) ng[row][col] = { ...ng[row][col], isWall: !isWall };
      return ng;
    });
  }, [placing, grid]);

  const handleMouseEnter = useCallback(({ row, col }) => {
    if (!mouseDown.current || placing !== 'wall') return;
    const toWall = drawMode.current === DRAW_MODES.WALL;
    setGrid(g => {
      const ng = g.map(r => [...r]);
      if (ng[row]?.[col]) ng[row][col] = { ...ng[row][col], isWall: toWall };
      return ng;
    });
  }, [placing]);

  const handleMouseUp = useCallback(() => { mouseDown.current = false; }, []);

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  const cellSize = mode === MODES.COMPARE ? 14 : 18;
  const compareRows = COMPARE_ROWS, compareCols = COMPARE_COLS;

  return (
    <div style={{
      height: '100vh', background: '#0d1117', color: '#e6edf3',
      fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#161b22', borderBottom: '1px solid #21262d',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>
            Shortest Path Visualizer
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
            BFS · Dijkstra · A* · Bi-directional — powered by OpenStreetMap
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { m: MODES.DRAW, label: 'Grid' },
            { m: MODES.COMPARE, label: 'Compare All' },
            { m: MODES.MAP, label: '🗺 Map Mode' },
          ].map(({ m, label }) => (
            <button key={m} onClick={() => { handleReset(); setMode(m); }}
              style={tabStyle(mode === m || (mode === MODES.SINGLE && m === MODES.DRAW))}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === MODES.MAP ? (
        <Suspense fallback={<div style={{ padding: 40, color: '#8b949e' }}>Loading map…</div>}>
          <MapMode />
        </Suspense>
      ) : null}

      <div style={{ display: mode === MODES.MAP ? 'none' : 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 220, background: '#161b22', borderRight: '1px solid #21262d',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
        }}>

          {/* Algorithm selector (single mode) */}
          {mode !== MODES.COMPARE && (
            <section>
              <Label>Algorithm</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ALGORITHMS.map(a => (
                  <button key={a.key} onClick={() => setSelectedAlgo(a.key)}
                    style={algoBtn(selectedAlgo === a.key)}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</span>
                    <span style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{a.desc}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Speed */}
          <section>
            <Label>Speed</Label>
            <div style={{ display: 'flex', gap: 4 }}>
              {SPEED_OPTIONS.map((s, i) => (
                <button key={s.label} onClick={() => setSpeedIdx(i)}
                  style={chipStyle(speedIdx === i)}>
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* Placement mode */}
          {mode !== MODES.COMPARE && (
            <section>
              <Label>Place</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['start', 'end', 'wall'].map(p => (
                  <button key={p} onClick={() => setPlacing(p)}
                    style={chipStyle(placing === p, p === 'start' ? '#3fb950' : p === 'end' ? '#f85149' : undefined)}>
                    {p === 'start' ? '▶ Start' : p === 'end' ? '■ End' : '⬛ Wall'}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Grid tools */}
          {mode !== MODES.COMPARE && (
            <section>
              <Label>Grid</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Btn onClick={handleMaze}>Generate Maze</Btn>
                <Btn onClick={handleWeights}>Random Weights</Btn>
                <Btn onClick={handleClearWalls}>Clear Walls</Btn>
                <Btn onClick={handleReset} danger>Reset</Btn>
              </div>
            </section>
          )}

          {/* Action */}
          <button onClick={handleVisualize} disabled={animRunning}
            style={{
              background: animRunning ? '#21262d' : '#1f6feb',
              color: animRunning ? '#8b949e' : '#fff',
              border: 'none', borderRadius: 8,
              padding: '10px 16px', fontSize: 14, fontWeight: 700,
              cursor: animRunning ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}>
            {animRunning ? 'Running…' : 'Visualize'}
          </button>

          {/* Legend */}
          <section>
            <Label>Legend</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
              {[
                { color: '#3fb950', label: 'Start' },
                { color: '#f85149', label: 'End' },
                { color: '#1f6feb', label: 'Visited (fwd)' },
                { color: '#bc4558', label: 'Visited (bwd)' },
                { color: '#e3b341', label: 'Shortest Path' },
                { color: '#21262d', label: 'Wall' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <span style={{ color: '#8b949e' }}>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {mode === MODES.COMPARE ? (
            <>
              <div style={{ fontSize: 13, color: '#8b949e' }}>
                All algorithms run on the same grid simultaneously — watch which one explores less.
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
              }}>
                {ALGORITHMS.map(algo => {
                  const snap = getSnapshot(algo.key, animStep);
                  const r = results[algo.key];
                  return (
                    <div key={algo.key} style={{
                      background: '#161b22', borderRadius: 10, padding: 12,
                      border: snap.done && snap.found ? '1px solid #e3b341' : '1px solid #21262d',
                      overflow: 'hidden',
                    }}>
                      <GridCanvas
                        grid={grid.slice(0, compareRows).map(row => row.slice(0, compareCols))}
                        startNode={startNode}
                        endNode={endNode}
                        visitedNodes={snap.visited}
                        pathNodes={snap.path}
                        cellSize={cellSize}
                        algoName={algo.label}
                        found={snap.found}
                        done={snap.done}
                        nodesExplored={r?.visitedInOrder.length}
                        pathLength={r?.path.length}
                        interactive={false}
                      />
                    </div>
                  );
                })}
              </div>
              <StatsPanel results={results} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#8b949e' }}>
                {results[selectedAlgo]
                  ? ALGORITHMS.find(a => a.key === selectedAlgo)?.desc
                  : 'Place start and end points, draw walls, then click Visualize.'}
              </div>
              <div style={{
                background: '#161b22', borderRadius: 10, padding: 12,
                border: '1px solid #21262d', display: 'inline-block',
              }}>
                <GridCanvas
                  grid={grid}
                  startNode={startNode}
                  endNode={endNode}
                  visitedNodes={getSnapshot(selectedAlgo, animStep).visited}
                  pathNodes={getSnapshot(selectedAlgo, animStep).path}
                  cellSize={cellSize}
                  onMouseDown={handleMouseDown}
                  onMouseEnter={handleMouseEnter}
                  onMouseUp={handleMouseUp}
                  interactive={mode === MODES.DRAW}
                  algoName={selectedAlgo}
                  found={getSnapshot(selectedAlgo, animStep).found}
                  done={getSnapshot(selectedAlgo, animStep).done}
                  nodesExplored={results[selectedAlgo]?.visitedInOrder.length}
                  pathLength={results[selectedAlgo]?.path.length}
                />
              </div>
              {results[selectedAlgo] && (
                <StatsPanel results={{ [selectedAlgo]: results[selectedAlgo] }} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer — hidden in map mode to maximise map area */}
      {mode !== MODES.MAP && (
        <div style={{
          background: '#161b22', borderTop: '1px solid #21262d',
          padding: '8px 24px', fontSize: 11, color: '#8b949e', display: 'flex', gap: 16, flexShrink: 0,
        }}>
          <span>Map data © <a href="https://www.openstreetmap.org/copyright" style={{ color: '#58a6ff' }}>OpenStreetMap</a> contributors</span>
          <span>·</span>
          <span>Inspired by Dijkstra's 1956 coffee-shop invention</span>
        </div>
      )}
    </div>
  );
}

// Style helpers
function tabStyle(active) {
  return {
    background: active ? '#1f6feb' : 'transparent',
    color: active ? '#fff' : '#8b949e',
    border: '1px solid',
    borderColor: active ? '#1f6feb' : '#30363d',
    borderRadius: 6, padding: '5px 14px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s',
  };
}

function algoBtn(active) {
  return {
    background: active ? '#0d419d22' : 'transparent',
    border: '1px solid',
    borderColor: active ? '#1f6feb' : '#21262d',
    borderRadius: 8, padding: '8px 12px',
    cursor: 'pointer', textAlign: 'left', color: '#e6edf3',
    display: 'flex', flexDirection: 'column', gap: 2,
    transition: 'all 0.15s',
  };
}

function chipStyle(active, activeColor) {
  return {
    flex: 1, background: active ? (activeColor ? activeColor + '22' : '#1f6feb22') : 'transparent',
    border: '1px solid',
    borderColor: active ? (activeColor || '#1f6feb') : '#21262d',
    borderRadius: 6, padding: '5px 8px',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    color: active ? (activeColor || '#58a6ff') : '#8b949e',
    transition: 'all 0.15s',
  };
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
      color: '#8b949e', textTransform: 'uppercase', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent',
      border: '1px solid',
      borderColor: danger ? '#f8514922' : '#30363d',
      borderRadius: 6, padding: '6px 12px',
      fontSize: 12, cursor: 'pointer',
      color: danger ? '#f85149' : '#8b949e',
      textAlign: 'left',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}
