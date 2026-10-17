(() => {
  const inputs = [...document.querySelectorAll('input')].map((i, idx) => ({ idx, type: i.type, ph: i.placeholder, value: i.value }));
  const u = inputs.find(x => x.ph.includes('engineer_ahmad'));
  let result = 'blur';
  if (u) {
    const el = document.querySelectorAll('input')[u.idx];
    el.blur();
    result = 'blurred';
  }
  return JSON.stringify({ result, inputs });
})()