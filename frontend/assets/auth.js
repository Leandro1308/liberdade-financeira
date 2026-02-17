// frontend/assets/auth.js
import { api, getToken, setToken } from "/assets/api.js";

function isAuthPage() {
  const p = location.pathname;
  return p.endsWith("/login.html") || p.endsWith("/criar-conta.html");
}

function addTokenToLinks() {
  const t = getToken();
  if (!t) return;

  // adiciona token só em links internos (mesmo domínio)
  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    try {
      const u = new URL(a.getAttribute("href"), location.origin);
      // não poluir se já tem
      if (!u.searchParams.get("t")) u.searchParams.set("t", t);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    } catch {}
  });
}

export async function ensureLoggedIn({
  redirectToLogin = true,
  requireActive = false,
  redirectToAssinatura = true,
} = {}) {
  // ✅ evita loop infinito: não forçar auth dentro do login/criar-conta
  if (isAuthPage()) return null;

  const token = getToken();

  // sem token: redireciona
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

    // ✅ se quiser exigir assinatura ativa em páginas do painel
    const sub = me?.user?.subscription || me?.subscription || null;
    const status = sub?.status || "inactive";
    if (requireActive && status !== "active") {
      if (redirectToAssinatura) {
        location.href = "/assinatura.html";
      }
      return me;
    }

    return me;
  } catch (e) {
    // token inválido/expirado
    setToken(null);
    if (redirectToLogin) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login.html?next=${next}`;
    }
    return null;
  }
}

// ✅ roda automaticamente em páginas que incluem auth.js
// (mas não roda no login/criar-conta por causa do isAuthPage())
ensureLoggedIn().catch(() => {});
