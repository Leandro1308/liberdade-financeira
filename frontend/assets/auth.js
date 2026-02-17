// frontend/assets/auth.js
import { api, getToken, setToken } from "/assets/api.js";

// 🔁 Migração: se você já usou outra chave antiga, reaproveita sem quebrar nada
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

function addTokenToLinks() {
  const t = getToken();
  if (!t) return;

  // adiciona token só em links internos (mesmo domínio)
  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    try {
      const u = new URL(a.getAttribute("href"), location.origin);
      if (!u.searchParams.get("t")) u.searchParams.set("t", t);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    } catch {}
  });
}

// ✅ Checagem "real" do status HTTP para decidir se limpa token ou não
async function safeMeCheck() {
  const t = getToken();
  if (!t) {
    // sem token -> nem tenta
    return { ok: false, status: 401, data: null };
  }

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
  } catch (e) {
    // erro de rede / fetch falhou -> NÃO é motivo pra limpar token
    return { ok: false, status: 0, data: null };
  }
}

export async function ensureLoggedIn({ redirectToLogin = true } = {}) {
  migrateLegacyToken();

  const token = getToken();

  // sem token: depende de cookie. Como seu backend usa Bearer, redireciona.
  if (!token) {
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }

  // ✅ primeiro tenta checar com status real
  const check = await safeMeCheck();

  if (check.ok) {
    // mantém links com token para não "cair" em páginas sem token
    addTokenToLinks();

    // Se sua API retorna { user: {...} }, devolve igual
    return check.data;
  }

  // ✅ só limpa token se o servidor realmente rejeitou (401/403)
  if (check.status === 401 || check.status === 403) {
    setToken(null);
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }

  // ❗ Qualquer outro erro (0 rede, 5xx etc) não deve deslogar
  // apenas tenta usar o api() normal como fallback
  try {
    const me = await api("/api/me");
    addTokenToLinks();
    return me;
  } catch {
    // aqui também NÃO limpa token (para evitar logout por instabilidade)
    if (redirectToLogin) location.href = "/login.html";
    return null;
  }
}

// roda automaticamente em páginas que incluem auth.js
ensureLoggedIn().catch(() => {});
