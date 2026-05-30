import { getNeighbors, reconstructPath, PriorityQueue } from './utils.js';

function heuristic(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

export function astar(grid, startRow, startCol, endRow, endCol) {
  const visitedInOrder = [];
  const gScore = {};
  const prev = {};
  const settled = new Set();
  const pq = new PriorityQueue();
  const startKey = `${startRow},${startCol}`;
  const endKey = `${endRow},${endCol}`;

  gScore[startKey] = 0;
  pq.push(heuristic(startRow, startCol, endRow, endCol), { row: startRow, col: startCol });

  while (pq.size > 0) {
    const { value: cur } = pq.pop();
    const curKey = `${cur.row},${cur.col}`;

    if (settled.has(curKey)) continue;
    settled.add(curKey);
    visitedInOrder.push({ row: cur.row, col: cur.col });

    if (curKey === endKey) {
      const path = reconstructPath(prev, endRow, endCol, startRow, startCol);
      return { visitedInOrder, path, found: true };
    }

    const g = gScore[curKey] ?? Infinity;

    for (const nb of getNeighbors(grid, cur.row, cur.col)) {
      const nbKey = `${nb.row},${nb.col}`;
      if (settled.has(nbKey)) continue;
      const tentativeG = g + nb.weight;
      if (gScore[nbKey] === undefined || tentativeG < gScore[nbKey]) {
        gScore[nbKey] = tentativeG;
        prev[nbKey] = curKey;
        const f = tentativeG + heuristic(nb.row, nb.col, endRow, endCol);
        pq.push(f, { row: nb.row, col: nb.col });
      }
    }
  }

  return { visitedInOrder, path: [], found: false };
}
