fetch('/api/breaker-settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ breakerId: 'qa-rbac-probe', model: 'TEST PROBE ACB', manufacturer: 'Schneider', frameSize: '630A' }),
}).then(r => r.text()).then(t => { window.__bs = t; }); null