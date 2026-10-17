(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const btns = [...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim()));
  const rows = [];
  for (let i = 0; i < btns.length; i += 3) {
    const trio = btns.slice(i, i + 3);
    const sel = trio.find(b => /bg-emerald|bg-rose|bg-amber|bg-orange/.test(b.className)) || trio.find(b => !/bg-slate-800\/60/.test(b.className));
    rows.push({ t: trio[0].textContent.trim(), selected: sel ? sel.textContent.trim() : '?' });
  }
  return JSON.stringify(rows);
})()