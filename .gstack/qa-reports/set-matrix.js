(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const target = { 'Coordination (TCC)': 'View Only', 'Panel Designer (MDB)': 'No Access' };
  const results = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node;
  let rowLabel = '';
  while ((node = walker.nextNode())) {
    const el = node;
    if (el.tagName === 'P' || el.tagName === 'LABEL' || el.tagName === 'H3' || el.tagName === 'SPAN') {
      const t = el.textContent.trim();
      if (t && t.length < 45 && !/Edit & View|View Only|No Access/.test(t)) {
        const btns = [...el.querySelectorAll('button')];
        if (btns.length === 0) rowLabel = t;
      }
    }
    if (el.tagName === 'BUTTON') {
      const perm = el.textContent.trim();
      if (/Edit & View|View Only|No Access/.test(perm) && target[rowLabel]) {
        const need = target[rowLabel];
        const parent = el.parentElement;
        const choice = [...parent.querySelectorAll('button')].find(b => b.textContent.trim() === need);
        if (choice) {
          choice.click();
          results.push(rowLabel + ' -> ' + need);
        }
      }
    }
  }
  return JSON.stringify(results);
})()