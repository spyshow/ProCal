(() => {
  const u = document.querySelector('input[placeholder="e.g., engineer_ahmad"]');
  if (!u) return 'no username input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(u, 'engineer');
  u.dispatchEvent(new Event('input', { bubbles: true }));
  u.dispatchEvent(new Event('change', { bubbles: true }));
  return 'filled ' + u.value;
})()