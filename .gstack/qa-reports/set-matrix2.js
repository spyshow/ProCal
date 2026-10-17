(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const rows = [...root.querySelectorAll('div')].filter(d => {
    const btns = [...d.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim()));
    return btns.length === 3 && [...btns[0].parentElement.parentElement.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length === 3;
  });
  const result = [];
  for (const row of rows) {
    const labelEl = [...row.parentElement.querySelectorAll(':scope > *')].find(p => p.textContent.trim() === row.textContent.trim().replace(/Edit & View|View Only|No Access/g, '').trim() && p !== row);
    const label = (labelEl ? labelEl.textContent.trim() : row.textContent.trim().replace(/Edit & View|View Only|No Access/g, '').trim()).slice(0, 40);
    const btns = [...row.querySelectorAll('button')];
    const target = { 'Coordination (TCC)': 'View Only', 'Panel Designer (MDB)': 'No Access' }[label];
    const choice = btns.find(b => b.textContent.trim() === target);
    if (choice) { choice.click(); result.push(label + ' -> ' + target); }
  }
  return JSON.stringify(result);
})()