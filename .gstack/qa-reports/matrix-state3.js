(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const mods = ['Load Calculator', 'Breaker Schedule', 'Coordination (TCC)', 'Cable Schedule', 'Panel Designer (MDB)', 'Riser Diagram', 'Single Line Diagram (SLD)', 'Engineering Reports'];
  const result = [];
  for (const mod of mods) {
    const labelEl = [...root.querySelectorAll('p,label,h3,h4,span')].find(e => e.textContent.trim() === mod && !e.querySelector('button'));
    if (!labelEl) { result.push({ mod, state: 'label-not-found' }); continue; }
    let container = labelEl.parentElement;
    let btns = [];
    for (let i = 0; i < 4 && container; i++) {
      btns = [...container.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim()));
      if (btns.length >= 3) break;
      container = container.parentElement;
    }
    if (btns.length < 3) { result.push({ mod, state: 'btns-not-found' }); continue; }
    const sel = btns.find(b => /bg-emerald|bg-rose|bg-blue/.test(b.className)) || btns[0];
    result.push({ mod, selected: sel.textContent.trim() });
  }
  return JSON.stringify(result);
})()