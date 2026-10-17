fetch('/api/invites/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'd40c12894cf573c028d710e976bff80e5c0297e7a6e7f45985ed06efeb3e22b9' }),
}).then(r => r.text()).then(t => { window.__accept2 = t; }); null