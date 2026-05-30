export async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'ShortestPathVisualizer/1.0' },
  });
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: "${query}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SPEED = {
  motorway: 120, motorway_link: 80,
  trunk: 100, trunk_link: 70,
  primary: 80, primary_link: 60,
  secondary: 60, secondary_link: 50,
  tertiary: 50, tertiary_link: 40,
  residential: 30, living_street: 15, service: 20, unclassified: 40,
};

export async function fetchRoadGraph(south, west, north, east) {
  const pad = 0.002;
  const s = south - pad, w = west - pad, n = north + pad, e = east + pad;

  // Safety: reject if bbox diagonal > 40km
  const diagKm = haversine(s, w, n, e) / 1000;
  if (diagKm > 50) throw new Error(`Area too large (${diagKm.toFixed(0)} km). Try two points within 40 km of each other.`);

  const query = `[out:json][timeout:30];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${s},${w},${n},${e});>;);out body;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  if (!res.ok) throw new Error('Overpass API error — try again in a moment.');
  const data = await res.json();
  return buildGraph(data);
}

function buildGraph(osmData) {
  const nodes = new Map();
  const adjacency = new Map();

  for (const el of osmData.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lng: el.lon });
      adjacency.set(el.id, []);
    }
  }

  for (const el of osmData.elements) {
    if (el.type !== 'way' || !el.nodes?.length) continue;
    const highway = el.tags?.highway ?? 'residential';
    const speed = SPEED[highway] ?? 30;
    const oneWay = el.tags?.oneway === 'yes';
    const reversed = el.tags?.oneway === '-1';

    for (let i = 0; i < el.nodes.length - 1; i++) {
      const from = el.nodes[i], to = el.nodes[i + 1];
      const fn = nodes.get(from), tn = nodes.get(to);
      if (!fn || !tn) continue;
      const dist = haversine(fn.lat, fn.lng, tn.lat, tn.lng);
      const timeWeight = dist / speed; // seconds proportional

      if (!reversed) adjacency.get(from)?.push({ targetId: to, weight: dist, timeWeight });
      if (!oneWay && !reversed) adjacency.get(to)?.push({ targetId: from, weight: dist, timeWeight });
      if (reversed) adjacency.get(to)?.push({ targetId: from, weight: dist, timeWeight });
    }
  }

  return { nodes, adjacency };
}

export function findNearestNode(nodes, lat, lng) {
  let best = null, bestDist = Infinity;
  for (const [id, n] of nodes) {
    const d = haversine(lat, lng, n.lat, n.lng);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return best;
}
