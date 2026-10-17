(() => {
  const inputs = [...document.querySelectorAll('input')].map(i => i.value);
  const emerald = [...document.querySelectorAll('div')].find(d => d.textContent.includes('Account found'));
  return JSON.stringify({ inputs, found: emerald ? emerald.textContent.slice(0, 100) : null });
})()