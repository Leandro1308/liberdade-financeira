import { api, getToken, setToken } from "/assets/api.js";

function addTokenToLinks() {
  const t = getToken();
  if (!t) return;

  // adiciona token só em links internos (mesmo domínio)
  document.querySelectorAll('a[href^="/"]').forEach(a => {
    try {
      const u = new URL(a.getAttribute("href"), location.origin);
      // não poluir se já tem
      if (!u.searchParams.get("t")) u.searchParams.set("t", t);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    } catch {}
  });
}

export async function ensureLoggedIn({ redirectToLogin = true } = {}) {
  const token = getToken();

  // sem token: depende de cookie. Se seu sistema não usa cookie, redireciona
  if (!token) {
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }

  try {
    const me = await api("/api/me");
    // mantém links com token para não "cair" em /assinatura.html sem token
    addTokenToLinks();
    return me;
  } catch (e) {
    // token inválido/expirado
    setToken(null);
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }
}

// roda automaticamente em páginas que incluem auth.js
ensureLoggedIn().catch(()=>{});
