import { getNeighbors, PriorityQueue } from './utils.js';

export function bidirectional(grid, startRow, startCol, endRow, endCol) {
  const visitedInOrder = [];

  const fwdDist = {};
  const bwdDist = {};
  const fwdPrev = {};
  const bwdPrev = {};
  const fwdSettled = new Set();
  const bwdSettled = new Set();
  const fwdPQ = new PriorityQueue();
  const bwdPQ = new PriorityQueue();

  const startKey = `${startRow},${startCol}`;
  const endKey = `${endRow},${endCol}`;

  fwdDist[startKey] = 0;
  bwdDist[endKey] = 0;
  fwdPQ.push(0, { row: startRow, col: startCol });
  bwdPQ.push(0, { row: endRow, col: endCol });

  let bestCost = Infinity;
  let meetingNode = null;

  while (fwdPQ.size > 0 || bwdPQ.size > 0) {
    const fwdTop = fwdPQ.peek()?.priority ?? Infinity;
    const bwdTop = bwdPQ.peek()?.priority ?? Infinity;

    if (fwdTop + bwdTop >= bestCost) break;

    if (fwdPQ.size > 0 && fwdTop <= bwdTop) {
      const { priority: cost, value: cur } = fwdPQ.pop();
      const curKey = `${cur.row},${cur.col}`;
      if (fwdSettled.has(curKey)) continue;
      fwdSettled.add(curKey);
      visitedInOrder.push({ row: cur.row, col: cur.col, dir: 'fwd' });

      if (bwdSettled.has(curKey)) {
        const total = (fwdDist[curKey] ?? Infinity) + (bwdDist[curKey] ?? Infinity);
        if (total < bestCost) { bestCost = total; meetingNode = curKey; }
      }

      for (const nb of getNeighbors(grid, cur.row, cur.col)) {
        const nbKey = `${nb.row},${nb.col}`;
        if (fwdSettled.has(nbKey)) continue;
        const newDist = cost + nb.weight;
        if (fwdDist[nbKey] === undefined || newDist < fwdDist[nbKey]) {
          fwdDist[nbKey] = newDist;
          fwdPrev[nbKey] = curKey;
          fwdPQ.push(newDist, { row: nb.row, col: nb.col });
          if (bwdDist[nbKey] !== undefined) {
            const total = newDist + bwdDist[nbKey];
            if (total < bestCost) { bestCost = total; meetingNode = nbKey; }
          }
        }
      }
    } else if (bwdPQ.size > 0) {
      const { priority: cost, value: cur } = bwdPQ.pop();
      const curKey = `${cur.row},${cur.col}`;
      if (bwdSettled.has(curKey)) continue;
      bwdSettled.add(curKey);
      visitedInOrder.push({ row: cur.row, col: cur.col, dir: 'bwd' });

      if (fwdSettled.has(curKey)) {
        const total = (fwdDist[curKey] ?? Infinity) + (bwdDist[curKey] ?? Infinity);
        if (total < bestCost) { bestCost = total; meetingNode = curKey; }
      }

      for (const nb of getNeighbors(grid, cur.row, cur.col)) {
        const nbKey = `${nb.row},${nb.col}`;
        if (bwdSettled.has(nbKey)) continue;
        const newDist = cost + nb.weight;
        if (bwdDist[nbKey] === undefined || newDist < bwdDist[nbKey]) {
          bwdDist[nbKey] = newDist;
          bwdPrev[nbKey] = curKey;
          bwdPQ.push(newDist, { row: nb.row, col: nb.col });
          if (fwdDist[nbKey] !== undefined) {
            const total = fwdDist[nbKey] + newDist;
            if (total < bestCost) { bestCost = total; meetingNode = nbKey; }
          }
        }
      }
    }
  }

  if (!meetingNode) return { visitedInOrder, path: [], found: false };

  // Reconstruct path: forward half + backward half
  const fwdPath = [];
  let cur = meetingNode;
  while (cur && cur !== startKey) {
    const [r, c] = cur.split(',').map(Number);
    fwdPath.unshift({ row: r, col: c });
    cur = fwdPrev[cur];
  }
  fwdPath.unshift({ row: startRow, col: startCol });

  const bwdPath = [];
  cur = bwdPrev[meetingNode];
  while (cur && cur !== endKey) {
    const [r, c] = cur.split(',').map(Number);
    bwdPath.push({ row: r, col: c });
    cur = bwdPrev[cur];
  }
  bwdPath.push({ row: endRow, col: endCol });

  return { visitedInOrder, path: [...fwdPath, ...bwdPath], found: true };
}
