const ALGO_COLORS = {
  BFS: '#58a6ff',
  Dijkstra: '#3fb950',
  'A*': '#f0883e',
  'Bi-Dir Dijkstra': '#bc4558',
};

export default function StatsPanel({ results }) {
  if (!results || Object.keys(results).length === 0) return null;

  const entries = Object.entries(results);

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 10,
      padding: '16px 20px',
      marginTop: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#8b949e', marginBottom: 12 }}>
        COMPARISON
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: '#8b949e', fontSize: 11 }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Algorithm</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Nodes Explored</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Path Length</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Run Time</th>
            <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 500 }}>Optimal</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, r]) => (
            <tr key={name} style={{ borderTop: '1px solid #21262d' }}>
              <td style={{ padding: '6px 8px' }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: ALGO_COLORS[name] || '#8b949e',
                  marginRight: 8,
                }} />
                <span style={{ color: '#e6edf3', fontWeight: 600 }}>{name}</span>
              </td>
              <td style={{ textAlign: 'right', padding: '6px 8px', color: '#e6edf3', fontFamily: 'monospace' }}>
                {r.found ? r.visitedInOrder.length.toLocaleString() : '—'}
              </td>
              <td style={{ textAlign: 'right', padding: '6px 8px', color: '#e6edf3', fontFamily: 'monospace' }}>
                {r.found ? r.path.length : '—'}
              </td>
              <td style={{ textAlign: 'right', padding: '6px 8px', color: '#e6edf3', fontFamily: 'monospace' }}>
                {r.timeMs != null ? `${r.timeMs.toFixed(2)} ms` : '—'}
              </td>
              <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                {r.found
                  ? <span style={{ color: r.optimal ? '#3fb950' : '#f85149' }}>{r.optimal ? '✓' : '✗'}</span>
                  : <span style={{ color: '#8b949e' }}>—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
