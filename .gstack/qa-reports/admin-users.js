(async () => {
  const res = await fetch('/api/admin/users');
  const data = await res.json();
  return JSON.stringify({ status: res.status, users: (data.users || data || []).map(u => ({ username: u.username, role: u.role, disabled: u.disabled, email: u.email })).slice(0, 20) });
})()