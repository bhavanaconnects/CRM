// Thin fetch wrapper matching the {success, data} / {success, error}
// envelope from src/lib/api-response.ts. Always sends the crm_session
// cookie (credentials: "include") so FastAPI's auth dependency works.
const API_BASE = window.API_BASE_URL || "http://localhost:8000";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers,
    ...options,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  if (!res.ok || !json || json.success === false) {
    const message = json && json.error ? json.error.message : `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = json && json.error ? json.error.details : null;
    throw err;
  }
  return json.data;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: (path) => apiFetch(path, { method: "DELETE" }),
};
