(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const labelEl = [...root.querySelectorAll('p,label,h3,h4,span')].find(e => e.textContent.trim() === 'Coordination (TCC)' && !e.querySelector('button'));
  let container = labelEl.parentElement;
  let btns = [];
  for (let i = 0; i < 4 && container; i++) {
    btns = [...container.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim()));
    if (btns.length >= 3) break;
    container = container.parentElement;
  }
  const before = btns.map(b => b.className.match(/bg-(emerald|rose|slate)[^ ]*/)?.[0]);
  const viewOnly = btns.find(b => b.textContent.trim() === 'View Only');
  viewOnly.click();
  const after = btns.map(b => b.className.match(/bg-(emerald|rose|slate)[^ ]*/)?.[0]);
  return JSON.stringify({ before, after });
})()