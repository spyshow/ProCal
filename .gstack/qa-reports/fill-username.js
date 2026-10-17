(() => {
  const u = document.querySelector('input[placeholder="e.g., engineer_ahmad"]');
  if (!u) return 'no username input';
  u.value = 'engineer';
  u.dispatchEvent(new Event('input', { bubbles: true }));
  u.blur();
  return 'filled';
})()