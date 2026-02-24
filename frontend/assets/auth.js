// frontend/assets/auth.js
import { api, getToken, setToken } from "/assets/api.js";

function isAuthPage() {
  const p = location.pathname;
  return p.endsWith("/login.html") || p.endsWith("/criar-conta.html");
}

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

/**
 * ✅ Criar conta (usa o backend real: POST /api/auth/register)
 * Backend espera: { name, email, password, ref }
 */
export async function register(name, email, password, ref = null) {
  const payload = {
    name,
    email,
    password,
    ref: ref || null,
  };

  const data = await api("/api/auth/register", { method: "POST", body: payload });

  const token = data?.token || null;
  if (token) {
    setToken(token);
    addTokenToLinks();
  }

  return data;
}

/**
 * ✅ Login (usa o backend real: POST /api/auth/login)
 */
export async function login(email, password) {
  const payload = { email, password };
  const data = await api("/api/auth/login", { method: "POST", body: payload });

  const token = data?.token || null;
  if (token) {
    setToken(token);
    addTokenToLinks();
  }

  return data;
}

export function logout() {
  setToken(null);
}

export async function ensureLoggedIn({
  redirectToLogin = true,
  requireActive = false,
  redirectToAssinatura = true,
} = {}) {
  if (isAuthPage()) return null;

  const token = getToken();

  if (!token) {
    if (redirectToLogin) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login.html?next=${next}`;
    }
    return null;
  }

  try {
    const me = await api("/api/me");
    addTokenToLinks();

    const sub = me?.user?.subscription || me?.subscription || null;
    const status = sub?.status || "inactive";

    if (requireActive && status !== "active") {
      if (redirectToAssinatura) location.href = "/assinatura.html";
      return me;
    }

    return me;
  } catch (e) {
    setToken(null);
    if (redirectToLogin) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login.html?next=${next}`;
    }
    return null;
  }
}

// roda automaticamente em páginas que incluem auth.js
ensureLoggedIn().catch(() => {});
