export const API_BASE = `${location.origin}`;

const TOKEN_KEY = "lf_token";

// Pega token da URL (?t=...) se existir
function getTokenFromUrl() {
  try {
    const u = new URL(location.href);
    const t = u.searchParams.get("t");
    return t && String(t).trim() ? String(t).trim() : null;
  } catch {
    return null;
  }
}

// Salva token e remove da URL (pra não ficar exposto)
function captureTokenOnce() {
  const t = getTokenFromUrl();
  if (!t) return;

  try { localStorage.setItem(TOKEN_KEY, t); } catch {}

  try {
    const u = new URL(location.href);
    u.searchParams.delete("t");
    history.replaceState({}, "", u.toString());
  } catch {}
}

function getStoredToken() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && String(t).trim() ? String(t).trim() : null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, String(token).trim());
  } catch {}
}

export function getToken() {
  return getStoredToken();
}

captureTokenOnce();

export async function api(path, { method = "GET", token = null, body = null } = {}) {
  const headers = { "Content-Type": "application/json" };

  const autoToken = token || getStoredToken();
  if (autoToken) headers.Authorization = `Bearer ${autoToken}`;

  // anti-cache em GET
  const url = new URL(`${API_BASE}${path}`);
  if (method === "GET") url.searchParams.set("_t", Date.now().toString());

  const res = await fetch(url.toString(), {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : null
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : "Erro na requisição";
    throw new Error(msg);
  }
  return data;
}
