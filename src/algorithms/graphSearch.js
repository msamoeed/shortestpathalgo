import { PriorityQueue } from './utils.js';
import { haversine } from '../utils/osmApi.js';

function tracePath(prev, startId, endId) {
  const path = [];
  let cur = endId;
  while (cur !== undefined && cur !== null) {
    path.unshift(cur);
    if (cur === startId) break;
    cur = prev.get(cur);
  }
  return path.length > 0 && path[0] === startId ? path : [];
}

export function bfsGraph(nodes, adjacency, startId, endId) {
  const visited = new Set([startId]);
  const prev = new Map();
  const queue = [startId];
  const visitedInOrder = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    visitedInOrder.push({ id: cur });
    if (cur === endId) break;
    for (const { targetId } of adjacency.get(cur) || []) {
      if (!visited.has(targetId)) {
        visited.add(targetId);
        prev.set(targetId, cur);
        queue.push(targetId);
      }
    }
  }

  const path = tracePath(prev, startId, endId);
  return { visitedInOrder, path, found: path.length > 0 };
}

export function dijkstraGraph(nodes, adjacency, startId, endId, useTime = false) {
  const dist = new Map([[startId, 0]]);
  const prev = new Map();
  const settled = new Set();
  const pq = new PriorityQueue();
  const visitedInOrder = [];

  pq.push(0, startId);

  while (pq.size > 0) {
    const { priority: cost, value: cur } = pq.pop();
    if (settled.has(cur)) continue;
    settled.add(cur);
    visitedInOrder.push({ id: cur });
    if (cur === endId) break;

    for (const { targetId, weight, timeWeight } of adjacency.get(cur) || []) {
      if (settled.has(targetId)) continue;
      const w = useTime ? timeWeight : weight;
      const newDist = cost + w;
      if (!dist.has(targetId) || newDist < dist.get(targetId)) {
        dist.set(targetId, newDist);
        prev.set(targetId, cur);
        pq.push(newDist, targetId);
      }
    }
  }

  const path = tracePath(prev, startId, endId);
  return { visitedInOrder, path, found: path.length > 0 };
}

export function astarGraph(nodes, adjacency, startId, endId, useTime = false) {
  const endNode = nodes.get(endId);
  const h = (id) => {
    const n = nodes.get(id);
    return n && endNode ? haversine(n.lat, n.lng, endNode.lat, endNode.lng) : 0;
  };

  const gScore = new Map([[startId, 0]]);
  const prev = new Map();
  const settled = new Set();
  const pq = new PriorityQueue();
  const visitedInOrder = [];

  pq.push(h(startId), startId);

  while (pq.size > 0) {
    const { value: cur } = pq.pop();
    if (settled.has(cur)) continue;
    settled.add(cur);
    visitedInOrder.push({ id: cur });
    if (cur === endId) break;

    const g = gScore.get(cur) ?? Infinity;
    for (const { targetId, weight, timeWeight } of adjacency.get(cur) || []) {
      if (settled.has(targetId)) continue;
      const w = useTime ? timeWeight : weight;
      const tentG = g + w;
      if (!gScore.has(targetId) || tentG < gScore.get(targetId)) {
        gScore.set(targetId, tentG);
        prev.set(targetId, cur);
        pq.push(tentG + h(targetId), targetId);
      }
    }
  }

  const path = tracePath(prev, startId, endId);
  return { visitedInOrder, path, found: path.length > 0 };
}

export function bidirectionalGraph(nodes, adjacency, startId, endId, useTime = false) {
  const fwdDist = new Map([[startId, 0]]);
  const bwdDist = new Map([[endId, 0]]);
  const fwdPrev = new Map(), bwdPrev = new Map();
  const fwdSettled = new Set(), bwdSettled = new Set();
  const fwdPQ = new PriorityQueue(), bwdPQ = new PriorityQueue();
  const visitedInOrder = [];

  fwdPQ.push(0, startId);
  bwdPQ.push(0, endId);

  let bestCost = Infinity, meeting = null;

  while (fwdPQ.size > 0 || bwdPQ.size > 0) {
    const fTop = fwdPQ.peek()?.priority ?? Infinity;
    const bTop = bwdPQ.peek()?.priority ?? Infinity;
    if (fTop + bTop >= bestCost) break;

    const doFwd = fwdPQ.size > 0 && fTop <= bTop;

    if (doFwd) {
      const { priority: cost, value: cur } = fwdPQ.pop();
      if (fwdSettled.has(cur)) continue;
      fwdSettled.add(cur);
      visitedInOrder.push({ id: cur, dir: 'fwd' });
      if (bwdSettled.has(cur)) {
        const total = (fwdDist.get(cur) ?? Infinity) + (bwdDist.get(cur) ?? Infinity);
        if (total < bestCost) { bestCost = total; meeting = cur; }
      }
      for (const { targetId, weight, timeWeight } of adjacency.get(cur) || []) {
        if (fwdSettled.has(targetId)) continue;
        const w = useTime ? timeWeight : weight;
        const nd = cost + w;
        if (!fwdDist.has(targetId) || nd < fwdDist.get(targetId)) {
          fwdDist.set(targetId, nd);
          fwdPrev.set(targetId, cur);
          fwdPQ.push(nd, targetId);
          if (bwdDist.has(targetId)) {
            const t = nd + bwdDist.get(targetId);
            if (t < bestCost) { bestCost = t; meeting = targetId; }
          }
        }
      }
    } else {
      const { priority: cost, value: cur } = bwdPQ.pop();
      if (bwdSettled.has(cur)) continue;
      bwdSettled.add(cur);
      visitedInOrder.push({ id: cur, dir: 'bwd' });
      if (fwdSettled.has(cur)) {
        const total = (fwdDist.get(cur) ?? Infinity) + (bwdDist.get(cur) ?? Infinity);
        if (total < bestCost) { bestCost = total; meeting = cur; }
      }
      for (const { targetId, weight, timeWeight } of adjacency.get(cur) || []) {
        if (bwdSettled.has(targetId)) continue;
        const w = useTime ? timeWeight : weight;
        const nd = cost + w;
        if (!bwdDist.has(targetId) || nd < bwdDist.get(targetId)) {
          bwdDist.set(targetId, nd);
          bwdPrev.set(targetId, cur);
          bwdPQ.push(nd, targetId);
          if (fwdDist.has(targetId)) {
            const t = fwdDist.get(targetId) + nd;
            if (t < bestCost) { bestCost = t; meeting = targetId; }
          }
        }
      }
    }
  }

  if (!meeting) return { visitedInOrder, path: [], found: false };

  const fwd = [];
  let cur = meeting;
  while (cur !== undefined) { fwd.unshift(cur); if (cur === startId) break; cur = fwdPrev.get(cur); }

  const bwd = [];
  cur = bwdPrev.get(meeting);
  while (cur !== undefined) { bwd.push(cur); if (cur === endId) break; cur = bwdPrev.get(cur); }

  const path = [...fwd, ...bwd];
  return { visitedInOrder, path, found: path[0] === startId };
}
