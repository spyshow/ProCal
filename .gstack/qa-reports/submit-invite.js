(() => {
  const form = document.querySelector('form');
  if (!form) return 'no form';
  const btn = [...form.querySelectorAll('button')].find(b => b.type === 'submit');
  if (!btn) return 'no submit';
  btn.click();
  return 'submitted';
})()