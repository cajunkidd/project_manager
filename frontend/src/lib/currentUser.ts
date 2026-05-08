// Foundation: no auth yet. We persist the active user id locally so dashboards
// and creations can be attributed. This will be replaced with real auth later.
const KEY = "pm.currentUserId";

export function getCurrentUserId(): string | null {
  return localStorage.getItem(KEY);
}

export function setCurrentUserId(id: string | null) {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("pm:user-changed"));
}
