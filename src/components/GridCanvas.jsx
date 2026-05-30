import { useRef, useEffect, useCallback } from 'react';

const COLORS = {
  empty: '#0d1117',
  wall: '#21262d',
  start: '#3fb950',
  end: '#f85149',
  visitedFwd: '#1f6feb',
  visitedBwd: '#bc4558',
  path: '#e3b341',
  grid: '#161b22',
};

function weightColor(weight) {
  const t = (weight - 1) / 4;
  const r = Math.round(13 + t * 20);
  const g = Math.round(17 + t * 15);
  const b = Math.round(23 + t * 30);
  return `rgb(${r},${g},${b})`;
}

export default function GridCanvas({
  grid,
  startNode,
  endNode,
  visitedNodes,
  pathNodes,
  cellSize,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  interactive = false,
  algoName,
  found,
  done,
  nodesExplored,
  pathLength,
}) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid.length) return;
    const ctx = canvas.getContext('2d');
    const rows = grid.length;
    const cols = grid[0].length;

    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const cell = grid[r][c];
        const key = `${r},${c}`;
        const isStart = startNode && r === startNode.row && c === startNode.col;
        const isEnd = endNode && r === endNode.row && c === endNode.col;

        let color;
        if (isStart) {
          color = COLORS.start;
        } else if (isEnd) {
          color = COLORS.end;
        } else if (pathNodes && pathNodes.has(key)) {
          color = COLORS.path;
        } else if (visitedNodes) {
          const v = visitedNodes.get(key);
          if (v === 'fwd') color = COLORS.visitedFwd;
          else if (v === 'bwd') color = COLORS.visitedBwd;
          else if (v) color = COLORS.visitedFwd;
          else if (cell.isWall) color = COLORS.wall;
          else color = weightColor(cell.weight);
        } else if (cell.isWall) {
          color = COLORS.wall;
        } else {
          color = weightColor(cell.weight);
        }

        ctx.fillStyle = color;
        ctx.fillRect(x, y, cellSize, cellSize);

        // Grid lines
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Weight dot for Dijkstra-type on heavier cells
        if (!cell.isWall && !isStart && !isEnd && cell.weight > 1 && cellSize >= 14) {
          const dotR = Math.min(cellSize / 6, 3) * (cell.weight - 1) / 4;
          ctx.beginPath();
          ctx.arc(x + cellSize / 2, y + cellSize / 2, dotR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fill();
        }
      }
    }
  }, [grid, startNode, endNode, visitedNodes, pathNodes, cellSize]);

  useEffect(() => { draw(); }, [draw]);

  const getCellFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return { row: Math.floor(y / cellSize), col: Math.floor(x / cellSize) };
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
        onMouseDown={interactive ? (e) => onMouseDown?.(getCellFromEvent(e)) : undefined}
        onMouseEnter={interactive ? (e) => onMouseEnter?.(getCellFromEvent(e)) : undefined}
        onMouseUp={interactive ? onMouseUp : undefined}
        onMouseLeave={interactive ? onMouseUp : undefined}
      />
      {algoName && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          borderRadius: 6, padding: '4px 10px',
          fontSize: 12, fontWeight: 700, letterSpacing: 1,
          color: done ? (found ? COLORS.path : '#f85149') : '#8b949e',
          border: `1px solid ${done ? (found ? COLORS.path : '#f85149') : '#30363d'}`,
          fontFamily: 'monospace',
        }}>
          {algoName}
          {done && (
            <span style={{ marginLeft: 8, fontSize: 10 }}>
              {found ? `✓ ${nodesExplored} nodes · path ${pathLength}` : '✗ no path'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
