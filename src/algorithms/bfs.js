import { getNeighbors, reconstructPath } from './utils.js';

export function bfs(grid, startRow, startCol, endRow, endCol) {
  const visitedInOrder = [];
  const prev = {};
  const visited = new Set();
  const startKey = `${startRow},${startCol}`;
  const endKey = `${endRow},${endCol}`;

  const queue = [{ row: startRow, col: startCol }];
  visited.add(startKey);

  while (queue.length > 0) {
    const cur = queue.shift();
    const curKey = `${cur.row},${cur.col}`;
    visitedInOrder.push({ row: cur.row, col: cur.col });

    if (curKey === endKey) {
      const path = reconstructPath(prev, endRow, endCol, startRow, startCol);
      return { visitedInOrder, path, found: true };
    }

    for (const nb of getNeighbors(grid, cur.row, cur.col)) {
      const nbKey = `${nb.row},${nb.col}`;
      if (!visited.has(nbKey)) {
        visited.add(nbKey);
        prev[nbKey] = curKey;
        queue.push({ row: nb.row, col: nb.col });
      }
    }
  }

  return { visitedInOrder, path: [], found: false };
}
