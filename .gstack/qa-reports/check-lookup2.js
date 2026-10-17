(() => {
  const all = [...document.querySelectorAll('div,span,p')];
  const match = all.find(d => /Account found|user found|Account/i.test(d.textContent) && d.textContent.length < 200);
  const nameVal = document.querySelectorAll('input')[1]?.value;
  const emailVal = document.querySelectorAll('input')[2]?.value;
  return JSON.stringify({ nameVal, emailVal, match: match ? match.textContent.slice(0,120) : null });
})()