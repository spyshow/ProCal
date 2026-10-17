(async () => {
  const res = await fetch('/api/users/lookup?username=engineer');
  const data = await res.json();
  return JSON.stringify(data);
})()