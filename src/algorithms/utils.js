export function getNeighbors(grid, row, col) {
  const rows = grid.length;
  const cols = grid[0].length;
  const neighbors = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols && !grid[r][c].isWall) {
      neighbors.push({ row: r, col: c, weight: grid[r][c].weight });
    }
  }
  return neighbors;
}

export function reconstructPath(prev, endRow, endCol, startRow, startCol) {
  const path = [];
  let cur = `${endRow},${endCol}`;
  const startKey = `${startRow},${startCol}`;

  while (cur && cur !== startKey) {
    const [r, c] = cur.split(',').map(Number);
    path.unshift({ row: r, col: c });
    cur = prev[cur];
  }
  if (cur === startKey) path.unshift({ row: startRow, col: startCol });
  return path;
}

export class PriorityQueue {
  constructor() { this.heap = []; }

  push(priority, value) {
    this.heap.push({ priority, value });
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() { return this.heap[0]; }
  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].priority <= this.heap[i].priority) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].priority < this.heap[s].priority) s = l;
      if (r < n && this.heap[r].priority < this.heap[s].priority) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
      i = s;
    }
  }
}
