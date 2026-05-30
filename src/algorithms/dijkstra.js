import { getNeighbors, reconstructPath, PriorityQueue } from './utils.js';

export function dijkstra(grid, startRow, startCol, endRow, endCol) {
  const visitedInOrder = [];
  const dist = {};
  const prev = {};
  const settled = new Set();
  const pq = new PriorityQueue();
  const startKey = `${startRow},${startCol}`;
  const endKey = `${endRow},${endCol}`;

  dist[startKey] = 0;
  pq.push(0, { row: startRow, col: startCol });

  while (pq.size > 0) {
    const { priority: cost, value: cur } = pq.pop();
    const curKey = `${cur.row},${cur.col}`;

    if (settled.has(curKey)) continue;
    settled.add(curKey);
    visitedInOrder.push({ row: cur.row, col: cur.col });

    if (curKey === endKey) {
      const path = reconstructPath(prev, endRow, endCol, startRow, startCol);
      return { visitedInOrder, path, found: true };
    }

    for (const nb of getNeighbors(grid, cur.row, cur.col)) {
      const nbKey = `${nb.row},${nb.col}`;
      if (settled.has(nbKey)) continue;
      const newDist = cost + nb.weight;
      if (dist[nbKey] === undefined || newDist < dist[nbKey]) {
        dist[nbKey] = newDist;
        prev[nbKey] = curKey;
        pq.push(newDist, { row: nb.row, col: nb.col });
      }
    }
  }

  return { visitedInOrder, path: [], found: false };
}
