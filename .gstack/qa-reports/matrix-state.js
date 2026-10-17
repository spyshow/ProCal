(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const rows = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node;
  let rowLabel = '';
  const seen = new Set();
  while ((node = walker.nextNode())) {
    const el = node;
    if (el.tagName === 'P' || el.tagName === 'LABEL' || el.tagName === 'H3' || el.tagName === 'SPAN') {
      const t = el.textContent.trim();
      if (t && t.length < 45 && !/Edit & View|View Only|No Access/.test(t) && !el.querySelector('button')) rowLabel = t;
    }
    if (el.tagName === 'BUTTON') {
      const perm = el.textContent.trim();
      if (/Edit & View|View Only|No Access/.test(perm)) {
        const cls = el.className;
        const isActive = /bg-orange|text-orange|ring/.test(cls) || el.getAttribute('data-active') === 'true';
        if (isActive) {
          const key = rowLabel + '|' + perm;
          if (!seen.has(key)) { seen.add(key); rows.push({ label: rowLabel, selected: perm }); }
        }
      }
    }
  }
  return JSON.stringify(rows);
})()