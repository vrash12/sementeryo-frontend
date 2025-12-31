const KEY = "auth";

export function setAuth(authObj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(authObj));
  } catch {}
}

export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function isAuthed() {
  return !!getAuth()?.token;
}

export function hasRole(...roles) {
  const a = getAuth();
  return !!a && roles.includes(a.user?.role);
}
