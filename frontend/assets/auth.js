// frontend/assets/auth.js
import { api, getToken, setToken } from "/assets/api.js";

// ===============================
// Util: páginas públicas (não forçar auth guard)
// ===============================
function isPublicPage() {
  const p = location.pathname || "/";
  // páginas que DEVEM abrir sem estar logado
  if (p === "/" || p.endsWith("/index.html")) return true;
  if (p.endsWith("/login.html")) return true;
  if (p.endsWith("/criar-conta.html")) return true;
  if (p.endsWith("/cadastro.html")) return true;
  // assinatura pode abrir mesmo sem login (mas botões exigem login)
  if (p.endsWith("/assinatura.html")) return true;
  return false;
}

// páginas de dashboard (precisa estar logado + assinatura ativa)
function isDashboardPage() {
  const p = location.pathname || "";
  return p.includes("/dashboard");
}

// evita poluir links públicos com token
function addTokenToLinks() {
  const t = getToken();
  if (!t) return;

  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    try {
      const href = a.getAttribute("href") || "";
      // não colocar token em páginas públicas sensíveis
      if (
        href.startsWith("/login.html") ||
        href.startsWith("/criar-conta.html") ||
        href.startsWith("/cadastro.html") ||
        href.startsWith("/index.html") ||
        href === "/"
      ) return;

      const u = new URL(href, location.origin);
      if (!u.searchParams.get("t")) u.searchParams.set("t", t);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    } catch {}
  });
}

// ===============================
// Login / Logout
// ===============================
export async function login(email, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });

  if (data?.token) setToken(data.token);
  // mantém links internos funcionando sem perder sessão
  addTokenToLinks();
  return data;
}

export function logout({ redirect = true } = {}) {
  setToken(null);
  if (redirect) location.href = "/login.html";
}

// ===============================
// Guard: garante sessão e (opcional) assinatura ativa
// ===============================
export async function ensureLoggedIn({ redirectToLogin = true } = {}) {
  const token = getToken();

  // se não tem token, não tenta (e não entra em loop em páginas públicas)
  if (!token) {
    if (redirectToLogin && !isPublicPage()) location.href = "/login.html";
    return null;
  }

  try {
    const me = await api("/api/me");
    addTokenToLinks();
    return me;
  } catch (e) {
    // token inválido/expirado
    setToken(null);
    if (redirectToLogin && !isPublicPage()) location.href = "/login.html";
    return null;
  }
}

// ===============================
// Guard extra: dashboard exige assinatura ativa
// ===============================
async function guardDashboard() {
  // só protege dashboard
  if (!isDashboardPage()) return;

  const me = await ensureLoggedIn({ redirectToLogin: true });
  if (!me) return;

  const status = me?.user?.subscription?.status || "inactive";

  // se não está ativo, manda pra assinatura antes
  if (status !== "active") {
    location.href = "/assinatura.html";
  }
}

// ===============================
// Auto-run seguro (SEM LOOP)
// - NÃO roda em páginas públicas (ex: login)
// - roda em dashboards automaticamente
// ===============================
(function autoRun() {
  if (isPublicPage()) return;
  // só roda guard do dashboard quando for dashboard
  guardDashboard().catch(() => {});
})();
