fetch('/api/floors/2a2fe9c6-048b-4af9-aad2-20d82647747c', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ riserCableLength: 3 }),
}).then(r => r.text()).then(t => { window.__restored = t; }); null