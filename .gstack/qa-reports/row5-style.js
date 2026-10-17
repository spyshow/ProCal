(() => {
  const sendBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send Invitation');
  if (!sendBtn) return 'no send btn';
  let root = sendBtn;
  for (let i = 0; i < 6; i++) {
    root = root.parentElement;
    if (!root) break;
    if ([...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim())).length >= 24) break;
  }
  const perms = [...root.querySelectorAll('button')].filter(b => /Edit & View|View Only|No Access/.test(b.textContent.trim()));
  const row5 = perms.slice(12, 15);
  return JSON.stringify(row5.map(b => ({ t: b.textContent.trim(), cls: b.className, disabled: b.disabled })));
})()