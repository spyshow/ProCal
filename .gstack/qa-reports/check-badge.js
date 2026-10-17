(() => {
  const all = [...document.querySelectorAll('div,span')];
  const found = all.find(d => /Account found|userFound|accountFound/i.test(d.textContent) && d.textContent.length < 150);
  return JSON.stringify({ badge: found ? found.textContent.trim().slice(0, 120) : null });
})()