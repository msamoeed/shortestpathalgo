import { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { geocode, fetchRoadGraph, findNearestNode, haversine } from '../utils/osmApi.js';
import { bfsGraph, dijkstraGraph, astarGraph, bidirectionalGraph } from '../algorithms/graphSearch.js';

const MAP_ALGOS = [
  { key: 'Dijkstra', fn: dijkstraGraph, desc: 'Weighted shortest distance' },
  { key: 'A*', fn: astarGraph, desc: 'Heuristic-guided (fastest in practice)' },
  { key: 'BFS', fn: bfsGraph, desc: 'Unweighted — ignores road length' },
  { key: 'Bi-Dir Dijkstra', fn: bidirectionalGraph, desc: 'Bidirectional — meets in the middle' },
];

const SPEED_OPTIONS = [
  { label: 'Slow', ms: 30, batch: 1 },
  { label: 'Normal', ms: 16, batch: 3 },
  { label: 'Fast', ms: 8, batch: 10 },
  { label: 'Instant', ms: 0, batch: 99999 },
];

// ─── Canvas overlay that draws explored nodes + path on the Leaflet map ───────
function MapCanvas({ osmNodes, visitedInOrder, path, animStep, startNode, endNode }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:650;';
    container.appendChild(canvas);
    canvasRef.current = canvas;
    return () => canvas.remove();
  }, [map]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !osmNodes) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const step = animStep ?? 0;
    const limit = Math.min(step, visitedInOrder?.length ?? 0);

    // Visited nodes
    for (let i = 0; i < limit; i++) {
      const v = visitedInOrder[i];
      const n = osmNodes.get(v.id);
      if (!n) continue;
      const pt = map.latLngToContainerPoint([n.lat, n.lng]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = v.dir === 'bwd' ? 'rgba(188,69,88,0.65)' : 'rgba(31,111,235,0.65)';
      ctx.fill();
    }

    const done = limit >= (visitedInOrder?.length ?? 0);

    // Path polyline
    if (done && path?.length > 1) {
      ctx.beginPath();
      let first = true;
      for (const id of path) {
        const n = osmNodes.get(id);
        if (!n) continue;
        const pt = map.latLngToContainerPoint([n.lat, n.lng]);
        if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#e3b341';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Start marker
    if (startNode) {
      const pt = map.latLngToContainerPoint([startNode.lat, startNode.lng]);
      drawPin(ctx, pt.x, pt.y, '#3fb950');
    }
    // End marker
    if (endNode) {
      const pt = map.latLngToContainerPoint([endNode.lat, endNode.lng]);
      drawPin(ctx, pt.x, pt.y, '#f85149');
    }
  }, [map, osmNodes, visitedInOrder, path, animStep, startNode, endNode]);

  useMapEvents({ move: draw, zoom: draw, moveend: draw, zoomend: draw });
  useEffect(() => { draw(); }, [draw]);

  return null;
}

function drawPin(ctx, x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Inner dot
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// ─── Map click handler ────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ─── Map auto-fit ─────────────────────────────────────────────────────────────
function MapFitter({ startLatLng, endLatLng }) {
  const map = useMap();
  useEffect(() => {
    if (startLatLng && endLatLng) {
      const L = window.L || map._container?.__leaflet__;
      map.fitBounds([[startLatLng.lat, startLatLng.lng], [endLatLng.lat, endLatLng.lng]], { padding: [60, 60] });
    } else if (startLatLng) {
      map.setView([startLatLng.lat, startLatLng.lng], 14);
    }
  }, [startLatLng, endLatLng, map]);
  return null;
}

// ─── Main MapMode component ───────────────────────────────────────────────────
export default function MapMode() {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [startLatLng, setStartLatLng] = useState(null);
  const [endLatLng, setEndLatLng] = useState(null);
  const [placing, setPlacing] = useState('start'); // 'start' | 'end' | null
  const [selectedAlgo, setSelectedAlgo] = useState('A*');
  const [speedIdx, setSpeedIdx] = useState(1);
  const [status, setStatus] = useState('idle'); // idle | geocoding | fetching | running | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [graphData, setGraphData] = useState(null);
  const [visitedInOrder, setVisitedInOrder] = useState(null);
  const [path, setPath] = useState(null);
  const [animStep, setAnimStep] = useState(0);
  const [stats, setStats] = useState(null);

  const animRef = useRef(null);
  const stepRef = useRef(0);

  const stopAnim = () => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
  };

  const runAnimation = useCallback((visited, speed, batch) => {
    stopAnim();
    stepRef.current = 0;
    setAnimStep(0);

    if (speed === 0) {
      setAnimStep(visited.length + 1);
      return;
    }

    animRef.current = setInterval(() => {
      stepRef.current += batch;
      setAnimStep(stepRef.current);
      if (stepRef.current >= visited.length) {
        stopAnim();
        setStatus('done');
      }
    }, speed);
  }, []);

  const handleVisualize = useCallback(async () => {
    if (!startLatLng || !endLatLng) {
      setStatus('error');
      setStatusMsg('Set both a start and end location first.');
      return;
    }
    stopAnim();
    setVisitedInOrder(null);
    setPath(null);
    setAnimStep(0);
    setStats(null);

    try {
      let graph = graphData;
      if (!graph) {
        setStatus('fetching');
        setStatusMsg('Fetching road network from OpenStreetMap…');
        const s = Math.min(startLatLng.lat, endLatLng.lat);
        const w = Math.min(startLatLng.lng, endLatLng.lng);
        const n = Math.max(startLatLng.lat, endLatLng.lat);
        const e = Math.max(startLatLng.lng, endLatLng.lng);
        graph = await fetchRoadGraph(s, w, n, e);
        setGraphData(graph);
      }

      setStatus('running');
      setStatusMsg('Running algorithm…');

      const startId = findNearestNode(graph.nodes, startLatLng.lat, startLatLng.lng);
      const endId = findNearestNode(graph.nodes, endLatLng.lat, endLatLng.lng);

      const algo = MAP_ALGOS.find(a => a.key === selectedAlgo);
      const t0 = performance.now();
      const result = algo.fn(graph.nodes, graph.adjacency, startId, endId);
      const t1 = performance.now();

      setVisitedInOrder(result.visitedInOrder);
      setPath(result.path);

      let distM = 0;
      for (let i = 0; i < result.path.length - 1; i++) {
        const a = graph.nodes.get(result.path[i]);
        const b = graph.nodes.get(result.path[i + 1]);
        if (a && b) distM += haversine(a.lat, a.lng, b.lat, b.lng);
      }

      setStats({
        found: result.found,
        nodesExplored: result.visitedInOrder.length,
        totalNodes: graph.nodes.size,
        pathNodes: result.path.length,
        distKm: (distM / 1000).toFixed(2),
        timeMs: (t1 - t0).toFixed(2),
      });

      const sp = SPEED_OPTIONS[speedIdx];
      runAnimation(result.visitedInOrder, sp.ms, sp.batch);
    } catch (err) {
      setStatus('error');
      setStatusMsg(err.message);
    }
  }, [startLatLng, endLatLng, selectedAlgo, speedIdx, graphData, runAnimation]);

  const handleGeocode = useCallback(async (which) => {
    const query = which === 'start' ? startInput : endInput;
    if (!query.trim()) return;
    setStatus('geocoding');
    setStatusMsg(`Looking up "${query}"…`);
    setGraphData(null); // clear old road network when points change
    try {
      const loc = await geocode(query);
      if (which === 'start') setStartLatLng(loc);
      else setEndLatLng(loc);
      setStatus('idle');
      setStatusMsg('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(err.message);
    }
  }, [startInput, endInput]);

  const handleMapClick = useCallback((latlng) => {
    setGraphData(null);
    setVisitedInOrder(null);
    setPath(null);
    setStats(null);
    setStatus('idle');
    if (placing === 'start') {
      setStartLatLng(latlng);
      setStartInput(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
      setPlacing('end');
    } else if (placing === 'end') {
      setEndLatLng(latlng);
      setEndInput(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
      setPlacing(null);
    }
  }, [placing]);

  const handleReset = () => {
    stopAnim();
    setStartLatLng(null); setEndLatLng(null);
    setStartInput(''); setEndInput('');
    setGraphData(null); setVisitedInOrder(null); setPath(null);
    setStats(null); setStatus('idle'); setStatusMsg('');
    setAnimStep(0); setPlacing('start');
  };

  useEffect(() => () => stopAnim(), []);

  const isRunning = status === 'geocoding' || status === 'fetching' || status === 'running';
  const startNodeObj = graphData && startLatLng ? { lat: startLatLng.lat, lng: startLatLng.lng } : startLatLng;
  const endNodeObj = graphData && endLatLng ? { lat: endLatLng.lat, lng: endLatLng.lng } : endLatLng;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 260, background: '#161b22', borderRight: '1px solid #21262d',
        padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flexShrink: 0,
      }}>

        {/* Location inputs */}
        <section>
          <SideLabel>Start</SideLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={startInput}
              onChange={e => setStartInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGeocode('start')}
              placeholder="City, address, or coords…"
              style={inputStyle(placing === 'start')}
            />
            <button onClick={() => handleGeocode('start')} style={iconBtn}>⏎</button>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 4 }}>
            {startLatLng
              ? `📍 ${startLatLng.lat.toFixed(4)}, ${startLatLng.lng.toFixed(4)}`
              : placing === 'start' ? '← or click on map' : 'Not set'}
          </div>
        </section>

        <section>
          <SideLabel>End</SideLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={endInput}
              onChange={e => setEndInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGeocode('end')}
              placeholder="City, address, or coords…"
              style={inputStyle(placing === 'end')}
            />
            <button onClick={() => handleGeocode('end')} style={iconBtn}>⏎</button>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 4 }}>
            {endLatLng
              ? `📍 ${endLatLng.lat.toFixed(4)}, ${endLatLng.lng.toFixed(4)}`
              : placing === 'end' ? '← or click on map' : 'Not set'}
          </div>
        </section>

        {/* Click mode indicator */}
        <div style={{
          background: placing ? '#1f6feb18' : 'transparent',
          border: `1px solid ${placing ? '#1f6feb' : '#21262d'}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 12,
          color: placing ? '#58a6ff' : '#8b949e',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>🗺</span>
          {placing ? `Click map to place ${placing}` : 'Points set — ready to visualize'}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setPlacing('start')} style={chipStyle(placing === 'start', '#3fb950')}>▶ Start</button>
          <button onClick={() => setPlacing('end')} style={chipStyle(placing === 'end', '#f85149')}>■ End</button>
        </div>

        <div style={{ height: 1, background: '#21262d' }} />

        {/* Algorithm */}
        <section>
          <SideLabel>Algorithm</SideLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {MAP_ALGOS.map(a => (
              <button key={a.key} onClick={() => { setSelectedAlgo(a.key); setGraphData(null); }}
                style={algoBtn(selectedAlgo === a.key)}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{a.key}</span>
                <span style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{a.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Speed */}
        <section>
          <SideLabel>Animation Speed</SideLabel>
          <div style={{ display: 'flex', gap: 4 }}>
            {SPEED_OPTIONS.map((s, i) => (
              <button key={s.label} onClick={() => setSpeedIdx(i)} style={chipStyle(speedIdx === i)}>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Status */}
        {(statusMsg || status === 'done') && (
          <div style={{
            background: status === 'error' ? '#f8514910' : '#1f6feb10',
            border: `1px solid ${status === 'error' ? '#f85149' : '#1f6feb'}`,
            borderRadius: 8, padding: '8px 12px', fontSize: 12,
            color: status === 'error' ? '#f85149' : '#58a6ff',
          }}>
            {statusMsg || (status === 'done' ? '✓ Complete' : '')}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{
            background: '#0d1117', borderRadius: 8, padding: '10px 12px',
            border: '1px solid #21262d', fontSize: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#8b949e', marginBottom: 8 }}>RESULTS</div>
            {stats.found ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Stat label="Nodes explored" value={`${stats.nodesExplored.toLocaleString()} / ${stats.totalNodes.toLocaleString()}`} />
                <Stat label="Path nodes" value={stats.pathNodes} />
                <Stat label="Distance" value={`${stats.distKm} km`} highlight />
                <Stat label="Compute time" value={`${stats.timeMs} ms`} />
              </div>
            ) : (
              <div style={{ color: '#f85149' }}>No path found between these points.</div>
            )}
          </div>
        )}

        <div style={{ height: 1, background: '#21262d' }} />

        {/* Actions */}
        <button onClick={handleVisualize} disabled={isRunning || !startLatLng || !endLatLng}
          style={{
            background: isRunning || !startLatLng || !endLatLng ? '#21262d' : '#1f6feb',
            color: isRunning || !startLatLng || !endLatLng ? '#8b949e' : '#fff',
            border: 'none', borderRadius: 8, padding: '10px 16px',
            fontSize: 14, fontWeight: 700, cursor: isRunning ? 'wait' : 'pointer',
          }}>
          {isRunning ? (status === 'fetching' ? 'Loading map…' : status === 'geocoding' ? 'Looking up…' : 'Running…') : 'Visualize'}
        </button>

        <button onClick={handleReset} style={{
          background: 'transparent', border: '1px solid #30363d', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, color: '#8b949e', cursor: 'pointer',
        }}>Reset</button>

        {/* Legend */}
        <section>
          <SideLabel>Legend</SideLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
            {[
              { color: '#3fb950', label: 'Start point' },
              { color: '#f85149', label: 'End point' },
              { color: 'rgba(31,111,235,0.65)', label: 'Visited (forward)' },
              { color: 'rgba(188,69,88,0.65)', label: 'Visited (backward)' },
              { color: '#e3b341', label: 'Shortest path' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ color: '#8b949e' }}>{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[48.8566, 2.3522]}
          zoom={5}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapFitter startLatLng={startLatLng} endLatLng={endLatLng} />
          <MapCanvas
            osmNodes={graphData?.nodes}
            visitedInOrder={visitedInOrder}
            path={path}
            animStep={animStep}
            startNode={startNodeObj}
            endNode={endNodeObj}
          />
        </MapContainer>
      </div>
    </div>
  );
}

function SideLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#8b949e', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#8b949e' }}>{label}</span>
      <span style={{ color: highlight ? '#e3b341' : '#e6edf3', fontWeight: highlight ? 700 : 400, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

const inputStyle = (active) => ({
  flex: 1, background: '#0d1117', border: `1px solid ${active ? '#1f6feb' : '#30363d'}`,
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#e6edf3', outline: 'none',
  fontFamily: 'inherit',
});

const iconBtn = {
  background: '#21262d', border: '1px solid #30363d', borderRadius: 6,
  padding: '0 10px', fontSize: 14, color: '#8b949e', cursor: 'pointer',
};

function chipStyle(active, activeColor) {
  return {
    flex: 1, background: active ? (activeColor ? activeColor + '22' : '#1f6feb22') : 'transparent',
    border: '1px solid', borderColor: active ? (activeColor || '#1f6feb') : '#21262d',
    borderRadius: 6, padding: '5px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    color: active ? (activeColor || '#58a6ff') : '#8b949e',
  };
}

function algoBtn(active) {
  return {
    background: active ? '#0d419d22' : 'transparent',
    border: `1px solid ${active ? '#1f6feb' : '#21262d'}`,
    borderRadius: 8, padding: '7px 10px', cursor: 'pointer', textAlign: 'left',
    color: '#e6edf3', display: 'flex', flexDirection: 'column', gap: 2,
  };
}
