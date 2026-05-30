# Shortest Path Visualizer

An interactive visualizer for classic shortest-path algorithms, running on both a freehand grid and real OpenStreetMap road networks.

**Live demo:** https://msamoeed.github.io/shortestpathalgo/

---

## Algorithms

| Algorithm | Weighted | Optimal | Strategy |
|---|---|---|---|
| BFS | No | Hops only | Explores level by level, uniform cost |
| Dijkstra | Yes | Always | Priority queue, settles lowest-cost node first |
| A* | Yes | Always | Dijkstra + Manhattan heuristic to guide search toward goal |
| Bi-directional Dijkstra | Yes | Always | Simultaneous forward + backward search, meet in the middle |

## Modes

### Grid Mode
- Draw walls by clicking and dragging
- Place start (▶) and end (■) points
- Apply random terrain weights (cost 1–5) to see how Dijkstra and A* handle uneven surfaces
- Generate a random maze using recursive backtracking

### Compare All
- Runs all four algorithms simultaneously on the same grid
- Watch which one explores fewer nodes and finds the path first
- Stats table shows nodes explored, path length, compute time, and whether the result is optimal

### Map Mode
- Type any real-world location (city, address, landmark) — geocoded via [Nominatim](https://nominatim.openstreetmap.org/)
- Or click directly on the map to place start and end points
- Fetches the real road network from [Overpass API](https://overpass-api.de/) (OpenStreetMap data)
- Snaps coordinates to the nearest road node and runs the selected algorithm
- Animates explored nodes as dots on the map, then draws the shortest path as a gold polyline
- Works best for journeys within ~40 km

## Running locally

```bash
git clone https://github.com/msamoeed/shortestpathalgo.git
cd shortestpathalgo
npm install
npm run dev
```

Open http://localhost:5173

## Tech stack

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) for the map
- [OpenStreetMap](https://www.openstreetmap.org/) tiles
- [Nominatim](https://nominatim.openstreetmap.org/) for geocoding
- [Overpass API](https://overpass-api.de/) for road network data
- Canvas API for grid and map overlay rendering

## Background

Dijkstra's algorithm was designed in 20 minutes over coffee in Amsterdam in 1956 — without pencil and paper. That constraint forced a clarity of logic that made the algorithm run perfectly on its first public demonstration on the ARMAC computer. Every modern routing engine (Google Maps, Apple Maps) is built on the same core idea. This visualizer exists to make that logic visible.

## License

MIT
