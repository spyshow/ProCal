fetch('/api/invites/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: '98110edaa9e7f4978a0a8c7c394636339a969371b97a797783bd6b5e1741b4da' }),
}).then(r => r.text()).then(t => { window.__accept = t; }); null