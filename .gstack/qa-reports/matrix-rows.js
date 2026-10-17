(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    const btns = [...root.querySelectorAll('button')];
    const permCount = btns.filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length;
    if (permCount >= 24) break;
  }
  const rows = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node;
  let rowLabel = '';
  while ((node = walker.nextNode())) {
    const el = node;
    const tag = el.tagName;
    const t = el.textContent.trim();
    if (tag === 'P' || tag === 'LABEL' || tag === 'H3' || tag === 'H4' || tag === 'SPAN') {
      if (t && t.length < 45 && !/Edit & View|View Only|No Access|Cancel|Send Invitation/.test(t)) {
        const btns = [...el.querySelectorAll('button')];
        if (btns.length === 0) rowLabel = t;
      }
    }
    if (tag === 'BUTTON') {
      const perm = el.textContent.trim();
      if (/Edit & View|View Only|No Access/.test(perm)) {
        const row = rows.find(r => r.label === rowLabel);
        if (row) row.buttons.push(perm); else rows.push({ label: rowLabel, buttons: [perm] });
      }
    }
  }
  return JSON.stringify(rows);
})()