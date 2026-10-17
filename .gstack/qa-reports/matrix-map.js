(() => {
  const modal = document.querySelector('[role=dialog]') || document.querySelector('dialog') || [...document.querySelectorAll('div')].find(d => d.textContent.includes('Send Invitation') && d.children.length > 5);
  const root = modal || document.body;
  const rows = [];
  const labels = [...root.querySelectorAll('label, p, h3, span, th, td')].map(e => ({ t: e.textContent.trim(), cls: e.className }));
  const btns = [...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access|Project Manager|Engineer|QA/.test(b.textContent.trim()));
  return JSON.stringify({ labels: labels.filter(l => l.t && l.t.length < 40).slice(0, 30), buttons: btns.map(b => ({ t: b.textContent.trim(), cls: b.className.slice(0, 60), ariaPressed: b.getAttribute('aria-pressed') })) });
})()