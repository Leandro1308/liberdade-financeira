// frontend/assets/auth.js
import { api, getToken, setToken } from "/assets/api.js";

// ===============================
// Helpers
// ===============================
function addTokenToLinks() {
  const t = getToken();
  if (!t) return;

  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    try {
      const u = new URL(a.getAttribute("href"), location.origin);
      if (!u.searchParams.get("t")) u.searchParams.set("t", t);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    } catch {}
  });
}

// 🔁 Migração: se existir token salvo em chaves antigas, reaproveita
function migrateLegacyToken() {
  try {
    const current = getToken();
    if (current) return;

    const legacyKeys = ["token", "jwt", "auth_token", "lfToken", "lf.jwt"];
    for (const k of legacyKeys) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) {
        setToken(String(v).trim());
        return;
      }
    }
  } catch {}
}

function extractTokenFromResponse(data) {
  if (!data) return null;

  const candidates = [
    data.token,
    data.accessToken,
    data.jwt,
    data.bearer,
    data?.data?.token,
    data?.data?.accessToken,
    data?.data?.jwt,
  ];

  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }

  if (typeof data === "string" && data.trim()) return data.trim();
  return null;
}

// Faz /api/me com fetch direto para captar status real (não deslogar por erro de rede)
async function safeMeCheck() {
  const t = getToken();
  if (!t) return { ok: false, status: 401, data: null };

  try {
    const res = await fetch(`${location.origin}/api/me?_t=${Date.now()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");

    return { ok: res.ok, status: res.status, data };
  } catch {
    // erro de rede -> não limpar token
    return { ok: false, status: 0, data: null };
  }
}

// ===============================
// Login (usado em login.html)
// ===============================
export async function login(email, password) {
  const e = String(email || "").trim();
  const p = String(password || "");

  if (!e || !p) throw new Error("Informe e-mail e senha.");

  const data = await api("/api/auth/login", {
    method: "POST",
    body: { email: e, password: p },
  });

  const token = extractTokenFromResponse(data);
  if (!token) throw new Error("Login OK, mas o servidor não retornou token.");

  setToken(token);
  addTokenToLinks();
  return data;
}

export function logout({ redirect = true } = {}) {
  try { setToken(null); } catch {}
  if (redirect) location.href = "/login.html";
}

// ===============================
// Proteção de páginas privadas
// ===============================
export async function ensureLoggedIn({ redirectToLogin = true } = {}) {
  migrateLegacyToken();

  const token = getToken();
  if (!token) {
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }

  const check = await safeMeCheck();

  if (check.ok) {
    addTokenToLinks();
    return check.data;
  }

  // só limpa token se o servidor realmente rejeitou
  if (check.status === 401 || check.status === 403) {
    setToken(null);
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }

  // erro de rede / 5xx -> não desloga; tenta fallback via api()
  try {
    const me = await api("/api/me");
    addTokenToLinks();
    return me;
  } catch {
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }
}

// roda automaticamente em páginas que incluem auth.js
ensureLoggedIn().catch(() => {});
